import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import {
  enqueueDeleteEmbeddings,
  enqueueKbArticleIndex,
  enqueueKbDocumentIndex,
  enqueueResolvedTicketIndex,
  getVectorQueueDepth,
} from '../lib/ai/vector-queue.js';
import { buildGroundedRagContext, hybridSearchKnowledge } from '../lib/ai/ki-orchestrator.js';
import { resolveTenantFromRequest } from '../lib/tenant-context.js';
import { safeErrorMessage, safeLog } from '../lib/safe-log.js';

const router = Router();

const enqueueSchema = z.object({
  type: z.enum(['INDEX_KB_ARTICLE', 'INDEX_RESOLVED_TICKET', 'INDEX_KB_DOCUMENT', 'DELETE_EMBEDDINGS']),
  sourceId: z.string().min(1).max(255),
  sourceType: z.enum(['KB_ARTICLE', 'RESOLVED_TICKET', 'KB_DOCUMENT']).optional(),
  // tenantId from body is ignored — session tenant is authoritative
});

const searchSchema = z.object({
  query: z.string().min(1).max(8000),
  limit: z.number().int().min(1).max(20).optional(),
  // tenantId from body is ignored — session tenant is authoritative
});

/** Enqueue / delete embeddings — admin only; tenant bound to session. */
router.post(
  '/enqueue',
  authenticate,
  requireRole(['SYSTEM_ADMIN']),
  async (req: Request, res: Response) => {
    const parsed = enqueueSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid enqueue payload', details: parsed.error.flatten() });
    }
    const tenantId = resolveTenantFromRequest(req);
    const { type, sourceId, sourceType } = parsed.data;
    let job;
    if (type === 'INDEX_KB_ARTICLE') job = await enqueueKbArticleIndex(sourceId, tenantId);
    else if (type === 'INDEX_KB_DOCUMENT') job = await enqueueKbDocumentIndex(sourceId, tenantId);
    else if (type === 'INDEX_RESOLVED_TICKET') job = await enqueueResolvedTicketIndex(sourceId, tenantId);
    else {
      job = await enqueueDeleteEmbeddings(sourceId, sourceType || 'KB_ARTICLE', tenantId);
    }
    return res.status(202).json({ success: true, job, queueDepth: await getVectorQueueDepth(), tenantId });
  },
);

router.post('/search', authenticate, async (req: Request, res: Response) => {
  const parsed = searchSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid search payload', details: parsed.error.flatten() });
  }
  try {
    const tenantId = resolveTenantFromRequest(req);
    const grounded = await buildGroundedRagContext({
      query: parsed.data.query,
      tenantId,
      limit: parsed.data.limit ?? 5,
    });
    return res.json({
      success: true,
      tenantId,
      ...grounded,
      hits: grounded.snippets,
    });
  } catch (err: unknown) {
    const message = safeErrorMessage(err, 'Hybrid search failed');
    safeLog('error', '[vectors/search] failed', message);
    return res.status(500).json({ error: message });
  }
});

router.get('/status', authenticate, requireRole(['SYSTEM_ADMIN']), async (req, res) => {
  try {
    const tenantId = resolveTenantFromRequest(req);
    const { listEmbeddingProviderStatus, resolveEmbeddingProvider } = await import(
      '../lib/ai/embeddings.js'
    );
    const [providers, active] = await Promise.all([
      listEmbeddingProviderStatus(tenantId),
      resolveEmbeddingProvider(tenantId),
    ]);
    res.json({
      queueDepth: await getVectorQueueDepth(),
      tenantId,
      activeEmbeddingProvider: active,
      providers,
      note:
        'Claude/Anthropic has no embeddings API and is skipped. RAG uses OpenAI, Azure OpenAI, Gemini, Ollama, or OpenAI-compatible local gateways.',
    });
  } catch (err: unknown) {
    res.status(500).json({ error: safeErrorMessage(err, 'Failed to read embedding status') });
  }
});

router.post('/hybrid', authenticate, async (req: Request, res: Response) => {
  const parsed = searchSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid search payload' });
  }
  try {
    const tenantId = resolveTenantFromRequest(req);
    const hits = await hybridSearchKnowledge({
      query: parsed.data.query,
      tenantId,
      limit: parsed.data.limit ?? 5,
    });
    return res.json({ success: true, tenantId, hits });
  } catch (err: unknown) {
    return res.status(500).json({ error: safeErrorMessage(err, 'Hybrid search failed') });
  }
});

export default router;
