import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authMiddleware.js';
import { routeParam } from '../lib/route-params.js';
import {
  addDocDirect,
  getDocDirect,
  getDocsDirect,
  updateDocDirect,
} from '../lib/postgres-backend.js';
import { executeAiFeatureRequest, requireLifecycleOutput } from '../lib/ai-orchestrator-service.js';
import { resolveTenantFromRequest } from '../lib/tenant-context.js';
import {
  enqueueKbArticleIndex,
  deleteEmbeddingsForSource,
} from '../lib/ai/vector-queue.js';
import { safeLog } from '../lib/safe-log.js';

const router = Router();

/** Hard ceiling for an AI summary request — unreachable providers must not hang the UI. */
const AI_SUMMARY_TIMEOUT_MS = 15_000;

/** Promise-based timeout that rejects once the deadline passes. */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

const historyBodySchema = z.object({
  changeSummary: z.string().min(1).max(4000),
  snapshotTitle: z.string().max(500).optional(),
  authorName: z.string().max(200).optional(),
});

const summaryBodySchema = z.object({
  forceRefresh: z.boolean().optional(),
});

const translationBodySchema = z.object({
  language: z.string().min(1).max(40),
  translation: z
    .object({
      title: z.string().min(1).max(500),
      content: z.string().min(1),
    })
    .refine((t) => t.title.length > 0 && t.content.length > 0, {
      message: 'translation title and content are required',
    }),
});

const articlePatchSchema = z
  .object({
    content: z.string().max(500_000).optional(),
    title: z.string().max(500).optional(),
    alerts: z.unknown().optional(),
    infrastructureTrust: z.unknown().optional(),
    aiSummary: z.string().max(20_000).optional(),
    workflowSteps: z.unknown().optional(),
    index_in_rag: z.boolean().optional(),
  })
  .refine((p) => Object.keys(p).length > 0, {
    message: 'No supported fields to update.',
  });

function parseTimestamp(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'string') return new Date(value).getTime() || 0;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const date = (value as { toDate?: () => Date }).toDate?.();
    return date ? date.getTime() : 0;
  }
  if (value instanceof Date) return value.getTime();
  return 0;
}

async function loadArticle(id: string) {
  const article = await getDocDirect('kb_articles', id);
  if (!article) return null;
  return { ...article, id };
}

router.post('/:id/view', authenticate, async (req: Request, res: Response) => {
  try {
    const id = routeParam(req.params.id);
    const article = await loadArticle(id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found.' });
    }

    const views = (Number(article.views) || 0) + 1;
    await updateDocDirect('kb_articles', id, { views });
    return res.json({ views });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to increment views.';
    return res.status(500).json({ error: message });
  }
});

router.get('/:id/history', authenticate, async (req: Request, res: Response) => {
  try {
    const id = routeParam(req.params.id);
    const rows = await getDocsDirect('kb_article_history', [
      { type: 'where', field: 'articleId', op: '==', value: id },
    ]);
    const history = rows
      .map((row) => ({ ...row, id: row.id }))
      .sort((a, b) => parseTimestamp(b.createdAt) - parseTimestamp(a.createdAt));
    return res.json({ history });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load history.';
    return res.status(500).json({ error: message });
  }
});

router.post('/:id/history', authenticate, async (req: Request, res: Response) => {
  try {
    const id = routeParam(req.params.id);
    const article = await loadArticle(id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found.' });
    }

    const parsed = historyBodySchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'changeSummary is required.', details: parsed.error.flatten() });
    }
    const { changeSummary, snapshotTitle, authorName } = parsed.data;

    const user = (req as any).user;
    const entry = await addDocDirect('kb_article_history', {
      articleId: id,
      authorId: user?.id,
      authorName: authorName || user?.name || user?.email || 'Agent',
      changeSummary,
      snapshotTitle: snapshotTitle || article.title,
      createdAt: new Date().toISOString(),
    });

    return res.json({ entry: { ...entry.data, id: entry.id } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to record history.';
    return res.status(500).json({ error: message });
  }
});

router.post('/:id/summary', authenticate, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  try {
    const parsed = summaryBodySchema.safeParse(req.body || {});
    const forceRefresh = parsed.success ? parsed.data.forceRefresh === true : false;
    const article = await loadArticle(id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found.' });
    }

    if (article.aiSummary && typeof article.aiSummary === 'string' && !forceRefresh) {
      return res.json({ aiSummary: article.aiSummary, cached: true });
    }

    const plain = String(article.content || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!plain) {
      safeLog('warn', '[KB Summary]', `Article ${id} has empty content — refusing to call AI.`);
      return res.status(400).json({ error: 'Article content is empty. Add content before generating a summary.' });
    }

    const prompt = `You are a knowledge base analyst. Write a concise AI summary for support operators reading this article.

Return 4 bullet points as plain text (one per line, starting with "• "):
1. Key takeaways
2. Dependencies
3. Permissions or prerequisites
4. Limitations or risks

Use only facts present in the article. Do not invent details.

Article Title: ${article.title || 'Untitled'}
Article Content:
${plain.slice(0, 12000)}`;

    try {
      const lifecycle = await withTimeout(
        executeAiFeatureRequest({
          workspaceId: 'default',
          feature: 'ticket_summarization',
          prompt,
          metadata: {
            entityId: `kb-summary-${id}`,
            kbArticleId: id,
          },
        }),
        AI_SUMMARY_TIMEOUT_MS,
        'AI summary request timed out after 15s.',
      );

      const aiSummary = requireLifecycleOutput(lifecycle);
      await updateDocDirect('kb_articles', id, { aiSummary });
      return res.json({ aiSummary, cached: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate summary.';
      safeLog('error', '[KB Summary]', `Generation failed for article ${id}:`, message);
      return res.status(500).json({ error: message });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate summary.';
    safeLog('error', '[KB Summary]', `Unexpected failure for article ${id}:`, message);
    return res.status(500).json({ error: message });
  }
});

router.patch('/:id/translations', authenticate, async (req: Request, res: Response) => {
  try {
    const id = routeParam(req.params.id);
    const article = await loadArticle(id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found.' });
    }

    const parsed = translationBodySchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'language and translation title/content are required.', details: parsed.error.flatten() });
    }
    const { language, translation } = parsed.data;

    const translations = {
      ...(article.translations || {}),
      [language]: translation,
    };

    await updateDocDirect('kb_articles', id, { translations });
    return res.json({ translations });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save translation.';
    return res.status(500).json({ error: message });
  }
});

router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = routeParam(req.params.id);
    const article = await loadArticle(id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found.' });
    }

    const allowed = ['content', 'title', 'alerts', 'infrastructureTrust', 'aiSummary', 'workflowSteps', 'index_in_rag'] as const;
    const parsed = articlePatchSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'No supported fields to update.' });
    }
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (parsed.data[key] !== undefined) {
        patch[key] = parsed.data[key];
      }
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No supported fields to update.' });
    }

    patch.updatedAt = new Date().toISOString();
    await updateDocDirect('kb_articles', id, patch);

    // Auto-sync RAG: re-index on content/title publish updates, or purge when
    // the article is opted out of the knowledge store.
    const tenantId = resolveTenantFromRequest(req);
    if (patch.index_in_rag === false) {
      await deleteEmbeddingsForSource(tenantId, 'KB_ARTICLE', id);
    } else if (
      typeof patch.index_in_rag === 'boolean' ||
      patch.content !== undefined ||
      patch.title !== undefined
    ) {
      const { getRagPipelineConfig } = await import('../lib/rag-pipeline-config.js');
      const { drainVectorQueue } = await import('../lib/ai/vector-queue.js');
      const ragConfig = await getRagPipelineConfig(tenantId);
      if (ragConfig.indexNewKbArticles && (article.index_in_rag !== false || patch.index_in_rag === true)) {
        await enqueueKbArticleIndex(id, tenantId);
        void drainVectorQueue();
      }
    }

    const user = (req as any).user;
    if (patch.content || patch.title) {
      await addDocDirect('kb_article_history', {
        articleId: id,
        authorId: user?.id,
        authorName: user?.name || user?.email || 'Agent',
        changeSummary: patch.content ? 'Content updated' : 'Title updated',
        snapshotTitle: (patch.title as string) || article.title,
        createdAt: new Date().toISOString(),
      });
    }

    const updated = await loadArticle(id);
    return res.json({ article: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update article.';
    return res.status(500).json({ error: message });
  }
});

export default router;
