/**
 * Public Admin RAG API surface used by Admin-Hub:
 *   POST /api/rag/search
 *   POST /api/rag/index-pending
 *   GET  /api/rag/status
 *   PUT  /api/rag/config
 */

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
import { cosineSearchRagChunks } from '../lib/ai/rag-search.js';
import { enqueuePendingRagIndex, loadRagStatus } from '../lib/ai/rag-status.js';

const router = Router();

const searchSchema = z.object({
  query: z.string().min(1).max(8000),
  limit: z.number().int().min(1).max(20).optional(),
  minSimilarity: z.number().min(0).max(1).optional(),
});

const indexPendingSchema = z.object({
  type: z.enum(['kb', 'ticket', 'all']).optional(),
});

const updateConfigSchema = z.object({
  resolutionMode: z.string().optional(),
  redactPii: z.boolean().optional(),
  chunkOverlapTokens: z.number().int().min(20).max(300).optional(),
  indexResolvedTickets: z.boolean().optional(),
  indexNewKbArticles: z.boolean().optional(),
  detectDuplicates: z.boolean().optional(),
});

/** GET /api/rag/status — KB / ticket counters for Admin-Hub cards. */
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

/**
 * POST /api/rag/search
 * Body: { query, limit?, minSimilarity? }
 * Pure cosine similarity against KnowledgeEmbedding / rag_chunks.
 */
router.post(
  '/search',
  authenticate,
  requireRole(['SYSTEM_ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const parsed = searchSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid search payload', details: parsed.error.flatten() });
      }
      const tenantId = resolveTenantFromRequest(req);
      const hits = await cosineSearchRagChunks({
        query: parsed.data.query,
        tenantId,
        limit: parsed.data.limit,
        minSimilarity: parsed.data.minSimilarity,
      });
      return res.json({
        success: true,
        tenantId,
        query: parsed.data.query,
        minSimilarity: parsed.data.minSimilarity ?? 0.65,
        hitCount: hits.length,
        hits,
      });
    } catch (err: unknown) {
      return res.status(500).json({ error: safeErrorMessage(err, 'RAG search failed') });
    }
  },
);

/**
 * POST /api/rag/index-pending
 * Enqueue embedding jobs only for published KB articles / resolved tickets
 * that are not yet present in KnowledgeEmbedding ("Artikel ohne Index").
 */
router.post(
  '/index-pending',
  authenticate,
  requireRole(['SYSTEM_ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const parsed = indexPendingSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: 'Invalid index-pending payload', details: parsed.error.flatten() });
      }
      const tenantId = resolveTenantFromRequest(req);
      const result = await enqueuePendingRagIndex({
        tenantId,
        type: parsed.data.type || 'kb',
      });
      return res.status(202).json({ success: true, ...result });
    } catch (err: unknown) {
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to enqueue pending RAG index') });
    }
  },
);

/** GET /api/rag/config */
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

/**
 * PUT /api/rag/config — persist resolution mode, PII masking, chunk overlap, toggles
 * to rag_pipeline_config (workspace settings table).
 */
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

export default router;
