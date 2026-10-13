import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { resolveTenantFromRequest } from '../lib/tenant-context.js';
import { safeErrorMessage } from '../lib/safe-log.js';
import {
  getRagPipelineConfig,
  setRagPipelineConfig,
  isRagResolutionMode,
  type RagPipelineConfig,
} from '../lib/rag-pipeline-config.js';
import {
  enqueueKbArticleIndex,
  enqueueResolvedTicketIndex,
  getVectorQueueDepth,
} from '../lib/ai/vector-queue.js';
import { hybridSearchKnowledge } from '../lib/ai/ki-orchestrator.js';
import { cosineSearchRagChunks } from '../lib/ai/rag-search.js';
import { enqueuePendingRagIndex, loadRagStatus } from '../lib/ai/rag-status.js';
import { queryDb } from '../lib/postgres-backend.js';

const router = Router();

const updateConfigSchema = z.object({
  resolutionMode: z.string().optional(),
  redactPii: z.boolean().optional(),
  chunkOverlapTokens: z.number().int().min(20).max(300).optional(),
  indexResolvedTickets: z.boolean().optional(),
  indexNewKbArticles: z.boolean().optional(),
  detectDuplicates: z.boolean().optional(),
});

/** GET /api/admin/rag/status — indexed KB articles vs chunks, solved tickets vs vectors. */
router.get(
  '/status',
  authenticate,
  requireRole(['SYSTEM_ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const tenantId = resolveTenantFromRequest(req);
      return res.json(await loadRagStatus(tenantId));
    } catch (err: unknown) {
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to load RAG status') });
    }
  },
);

/** GET /api/admin/rag/config — read RAG pipeline configuration. */
router.get(
  '/config',
  authenticate,
  requireRole(['SYSTEM_ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const tenantId = resolveTenantFromRequest(req);
      return res.json({ success: true, tenantId, config: await getRagPipelineConfig(tenantId) });
    } catch (err: unknown) {
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to load RAG config') });
    }
  },
);

/** PUT /api/admin/rag/config — update resolution mode / PII redaction / chunk overlap. */
router.put(
  '/config',
  authenticate,
  requireRole(['SYSTEM_ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const parsed = updateConfigSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid RAG config payload', details: parsed.error.flatten() });
      }
      const tenantId = resolveTenantFromRequest(req);
      const {
        resolutionMode,
        redactPii,
        chunkOverlapTokens,
        indexResolvedTickets,
        indexNewKbArticles,
        detectDuplicates,
      } = parsed.data;
      if (resolutionMode !== undefined && !isRagResolutionMode(resolutionMode)) {
        return res.status(400).json({
          error: "resolutionMode must be one of 'extract' | 'ai_generated' | 'hybrid'",
        });
      }
      const config = await setRagPipelineConfig(
        {
          resolutionMode: resolutionMode as RagPipelineConfig['resolutionMode'] | undefined,
          redactPii,
          chunkOverlapTokens,
          indexResolvedTickets,
          indexNewKbArticles,
          detectDuplicates,
        },
        tenantId,
        req.user?.email ?? req.user?.id ?? null,
      );
      return res.json({ success: true, tenantId, config });
    } catch (err: unknown) {
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to update RAG config') });
    }
  },
);

const searchTestSchema = z.object({
  q: z.string().min(1).max(8000).default('password reset'),
  limit: z.coerce.number().int().min(1).max(10).optional(),
  minSimilarity: z.coerce.number().min(0).max(1).optional(),
});

/** GET /api/admin/rag/search-test — cosine similarity end-to-end within the tenant. */
router.get(
  '/search-test',
  authenticate,
  requireRole(['SYSTEM_ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const parsed = searchTestSchema.safeParse({
        q: req.query.q,
        limit: req.query.limit,
        minSimilarity: req.query.minSimilarity,
      });
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid search-test params', details: parsed.error.flatten() });
      }
      const tenantId = resolveTenantFromRequest(req);
      const hits = await cosineSearchRagChunks({
        query: parsed.data.q,
        tenantId,
        limit: parsed.data.limit ?? 5,
        minSimilarity: parsed.data.minSimilarity,
      });
      return res.json({
        success: true,
        tenantId,
        query: parsed.data.q,
        hitCount: hits.length,
        hits,
        matchedTenantOnly: true,
      });
    } catch (err: unknown) {
      // Fall back to hybrid search if pure cosine fails (e.g. no embedding provider).
      try {
        const tenantId = resolveTenantFromRequest(req);
        const q = String(req.query.q || 'password reset');
        const hits = await hybridSearchKnowledge({
          query: q,
          tenantId,
          limit: Number(req.query.limit) || 5,
        });
        return res.json({
          success: true,
          tenantId,
          query: q,
          hitCount: hits.length,
          hits,
          matchedTenantOnly: true,
          fallback: 'hybrid',
        });
      } catch {
        return res.status(500).json({ error: safeErrorMessage(err, 'RAG search test failed') });
      }
    }
  },
);

/** POST /api/admin/rag/index-pending — alias of /api/rag/index-pending. */
router.post(
  '/index-pending',
  authenticate,
  requireRole(['SYSTEM_ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const type = String(req.body?.type || 'kb');
      if (type !== 'kb' && type !== 'ticket' && type !== 'all') {
        return res.status(400).json({ error: "type must be 'kb' | 'ticket' | 'all'" });
      }
      const tenantId = resolveTenantFromRequest(req);
      const result = await enqueuePendingRagIndex({ tenantId, type });
      return res.status(202).json({ success: true, ...result });
    } catch (err: unknown) {
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to enqueue pending RAG index') });
    }
  },
);

/** GET /api/admin/rag/backfill?type=kb|ticket — enqueue re-index for all published/solved sources. */
router.get(
  '/backfill',
  authenticate,
  requireRole(['SYSTEM_ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const tenantId = resolveTenantFromRequest(req);
      const type = String(req.query.type || 'kb');
      const docs = await queryDb(
        `SELECT id, data FROM geistdesk_documents
         WHERE collection = $1 AND (data->>'tenantId' IS NULL OR data->>'tenantId' = $2)`,
        [type === 'ticket' ? 'tickets' : 'kb_articles', tenantId],
      );
      let enqueued = 0;
      for (const row of docs.rows) {
        const id = String((row as { id: string }).id);
        const data = ((row as { data?: Record<string, unknown> }).data || {}) as Record<string, unknown>;
        if (type === 'ticket') {
          const status = String(data.status || '').toLowerCase();
          if (status === 'resolved' || status === 'closed') {
            await enqueueResolvedTicketIndex(id, tenantId);
            enqueued += 1;
          }
        } else {
          const status = String(data.status || '').toLowerCase();
          const published =
            status === 'published' ||
            status === 'public' ||
            data.visibility === 'Public' ||
            status === '';
          if (published) {
            await enqueueKbArticleIndex(id, tenantId);
            enqueued += 1;
          }
        }
      }
      return res.json({
        success: true,
        tenantId,
        type,
        enqueued,
        queueDepth: await getVectorQueueDepth(),
      });
    } catch (err: unknown) {
      return res.status(500).json({ error: safeErrorMessage(err, 'RAG backfill enqueue failed') });
    }
  },
);

export default router;
