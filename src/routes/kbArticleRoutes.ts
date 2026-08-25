import { Router, type Request, type Response } from 'express';
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

const router = Router();

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

    const { changeSummary, snapshotTitle, authorName } = req.body || {};
    if (!changeSummary || typeof changeSummary !== 'string') {
      return res.status(400).json({ error: 'changeSummary is required.' });
    }

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
  try {
    const id = routeParam(req.params.id);
    const forceRefresh = Boolean(req.body?.forceRefresh);
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

    const lifecycle = await executeAiFeatureRequest({
      workspaceId: 'default',
      feature: 'ticket_summarization',
      prompt,
      metadata: {
        entityId: `kb-summary-${id}`,
        kbArticleId: id,
      },
    });

    const aiSummary = requireLifecycleOutput(lifecycle);
    await updateDocDirect('kb_articles', id, { aiSummary });
    return res.json({ aiSummary, cached: false });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate summary.';
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

    const { language, translation } = req.body || {};
    if (!language || !translation?.title || !translation?.content) {
      return res.status(400).json({ error: 'language and translation title/content are required.' });
    }

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
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) {
        patch[key] = req.body[key];
      }
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No supported fields to update.' });
    }

    patch.updatedAt = new Date().toISOString();
    await updateDocDirect('kb_articles', id, patch);

    // Selective RAG: toggling index_in_rag enqueues a re-index (or purges the
    // existing vectors immediately when the article is opted out).
    if (typeof patch.index_in_rag === 'boolean') {
      const tenantId = resolveTenantFromRequest(req);
      if (patch.index_in_rag) {
        enqueueKbArticleIndex(id, tenantId);
      } else {
        await deleteEmbeddingsForSource(tenantId, 'KB_ARTICLE', id);
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
