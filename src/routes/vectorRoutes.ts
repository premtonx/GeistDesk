import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import {
  enqueueDeleteEmbeddings,
  enqueueKbArticleIndex,
  enqueueResolvedTicketIndex,
  getVectorQueueDepth,
} from '../lib/ai/vector-queue.js';
import { buildGroundedRagContext, hybridSearchKnowledge } from '../lib/ai/ki-orchestrator.js';

const router = Router();

const enqueueSchema = z.object({
  type: z.enum(['INDEX_KB_ARTICLE', 'INDEX_RESOLVED_TICKET', 'DELETE_EMBEDDINGS']),
  sourceId: z.string().min(1).max(255),
  sourceType: z.enum(['KB_ARTICLE', 'RESOLVED_TICKET']).optional(),
  tenantId: z.string().max(255).optional(),
});

const searchSchema = z.object({
  query: z.string().min(1).max(8000),
  tenantId: z.string().max(255).optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

router.post('/enqueue', authenticate, async (req: Request, res: Response) => {
  const parsed = enqueueSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid enqueue payload', details: parsed.error.flatten() });
  }
  const { type, sourceId, sourceType, tenantId } = parsed.data;
  let job;
  if (type === 'INDEX_KB_ARTICLE') job = enqueueKbArticleIndex(sourceId, tenantId);
  else if (type === 'INDEX_RESOLVED_TICKET') job = enqueueResolvedTicketIndex(sourceId, tenantId);
  else {
    job = enqueueDeleteEmbeddings(sourceId, sourceType || 'KB_ARTICLE', tenantId);
  }
  return res.status(202).json({ success: true, job, queueDepth: getVectorQueueDepth() });
});

router.post('/search', authenticate, async (req: Request, res: Response) => {
  const parsed = searchSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid search payload', details: parsed.error.flatten() });
  }
  try {
    const grounded = await buildGroundedRagContext({
      query: parsed.data.query,
      tenantId: parsed.data.tenantId,
      limit: parsed.data.limit ?? 5,
    });
    return res.json({
      success: true,
      ...grounded,
      hits: grounded.snippets,
    });
  } catch (err: any) {
    console.error('[vectors/search] failed', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Hybrid search failed' });
  }
});

router.get('/status', authenticate, requireRole(['SYSTEM_ADMIN']), async (_req, res) => {
  res.json({ queueDepth: getVectorQueueDepth() });
});

router.post('/hybrid', authenticate, async (req: Request, res: Response) => {
  const parsed = searchSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid search payload' });
  }
  try {
    const hits = await hybridSearchKnowledge({
      query: parsed.data.query,
      tenantId: parsed.data.tenantId,
      limit: parsed.data.limit ?? 5,
    });
    return res.json({ success: true, hits });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Hybrid search failed' });
  }
});

export default router;
