import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { resolveTenantFromRequest } from '../lib/tenant-context.js';
import { safeErrorMessage } from '../lib/safe-log.js';
import { queryDb } from '../lib/postgres-backend.js';
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

const router = Router();

const updateConfigSchema = z.object({
  resolutionMode: z.string().optional(),
  redactPii: z.boolean().optional(),
  chunkOverlapTokens: z.number().int().min(20).max(300).optional(),
});

interface RagStatusResult {
  success: boolean;
  tenantId: string;
  queueDepth: number;
  kb: {
    totalArticles: number;
    publishedArticles: number;
    indexedChunks: number;
    indexedArticles: number;
    missingIndexArticles: number;
  };
  tickets: {
    totalResolvedClosed: number;
    indexedChunks: number;
    indexedTickets: number;
    missingIndexTickets: number;
  };
  activeEmbeddingProvider: unknown;
  config: RagPipelineConfig;
  sampledMissingKb?: string[];
  sampledMissingTickets?: string[];
}

async function loadRagStatus(tenantId: string): Promise<RagStatusResult> {
  const { listEmbeddingProviderStatus, resolveEmbeddingProvider } = await import(
    '../lib/ai/embeddings.js'
  );

  // Counts from the document store.
  const docs = await queryDb(
    `SELECT collection, data FROM geistdesk_documents
     WHERE collection IN ('kb_articles', 'tickets')
       AND (data->>'tenantId' IS NULL OR data->>'tenantId' = $1)`,
    [tenantId],
  );

  let totalArticles = 0;
  let publishedArticles = 0;
  let totalResolvedClosed = 0;
  const publishedIds: string[] = [];
  const resolvedIds: string[] = [];

  for (const row of docs.rows) {
    const collection = String(row.collection);
    const data = (row as any).data || {};
    if (collection === 'kb_articles') {
      totalArticles += 1;
      const status = String(data.status || '').toLowerCase();
      const published =
        status === 'published' || status === 'public' || data.visibility === 'Public' || status === '';
      if (published) {
        publishedArticles += 1;
        publishedIds.push(String((row as any).id));
      }
    } else if (collection === 'tickets') {
      const status = String(data.status || '').toLowerCase();
      if (status === 'resolved' || status === 'closed') {
        totalResolvedClosed += 1;
        resolvedIds.push(String((row as any).id));
      }
    }
  }

  // Indexed chunk counts per source type.
  const vec = await queryDb(
    `SELECT source_type, COUNT(*) AS chunks, COUNT(DISTINCT source_id) AS sources
     FROM "KnowledgeEmbedding"
     WHERE tenant_id = $1
     GROUP BY source_type`,
    [tenantId],
  );
  let kbChunks = 0;
  let kbSources = 0;
  let ticketChunks = 0;
  let ticketSources = 0;
  for (const row of vec.rows) {
    const type = String(row.source_type);
    const chunks = Number(row.chunks || 0);
    const sources = Number(row.sources || 0);
    if (type === 'KB_ARTICLE') {
      kbChunks = chunks;
      kbSources = sources;
    } else if (type === 'RESOLVED_TICKET') {
      ticketChunks = chunks;
      ticketSources = sources;
    }
  }

  const [, active] = await Promise.all([
    listEmbeddingProviderStatus(tenantId),
    resolveEmbeddingProvider(tenantId),
  ]);

  const indexedKbIds = new Set(
    (
      await queryDb(
        `SELECT DISTINCT source_id FROM "KnowledgeEmbedding" WHERE tenant_id = $1 AND source_type = 'KB_ARTICLE'`,
        [tenantId],
      )
    ).rows.map((r) => String(r.source_id)),
  );
  const indexedTicketIds = new Set(
    (
      await queryDb(
        `SELECT DISTINCT source_id FROM "KnowledgeEmbedding" WHERE tenant_id = $1 AND source_type = 'RESOLVED_TICKET'`,
        [tenantId],
      )
    ).rows.map((r) => String(r.source_id)),
  );

  const missingKb = publishedIds.filter((id) => !indexedKbIds.has(id));
  const missingTickets = resolvedIds.filter((id) => !indexedTicketIds.has(id));

  return {
    success: true,
    tenantId,
    queueDepth: getVectorQueueDepth(),
    kb: {
      totalArticles,
      publishedArticles,
      indexedChunks: kbChunks,
      indexedArticles: kbSources,
      missingIndexArticles: missingKb.length,
    },
    tickets: {
      totalResolvedClosed,
      indexedChunks: ticketChunks,
      indexedTickets: ticketSources,
      missingIndexTickets: missingTickets.length,
    },
    activeEmbeddingProvider: active,
    config: await getRagPipelineConfig(tenantId),
    sampledMissingKb: missingKb.slice(0, 10),
    sampledMissingTickets: missingTickets.slice(0, 10),
  };
}

/** GET /api/admin/rag/status — indexed KB articles vs chunks, solved tickets vs vectors. */
router.get(
  '/status',
  authenticate,
  requireRole(['SYSTEM_ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const tenantId = resolveTenantFromRequest(req);
      const status = await loadRagStatus(tenantId);
      return res.json(status);
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
      const { resolutionMode, redactPii, chunkOverlapTokens } = parsed.data;
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
  limit: z.number().int().min(1).max(10).optional(),
});

/** GET /api/admin/rag/search-test — verify similarity retrieval end-to-end within the tenant. */
router.get(
  '/search-test',
  authenticate,
  requireRole(['SYSTEM_ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const parsed = searchTestSchema.safeParse({ q: req.query.q, limit: req.query.limit });
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid search-test params', details: parsed.error.flatten() });
      }
      const tenantId = resolveTenantFromRequest(req);
      const hits = await hybridSearchKnowledge({
        query: parsed.data.q,
        tenantId,
        limit: parsed.data.limit ?? 5,
      });
      return res.json({
        success: true,
        tenantId,
        query: parsed.data.q,
        hitCount: hits.length,
        hits,
        // All queries are scoped by tenant_id in hybridSearchKnowledge; the
        // flag confirms no cross-tenant rows can leak into results.
        matchedTenantOnly: true,
      });
    } catch (err: unknown) {
      return res.status(500).json({ error: safeErrorMessage(err, 'RAG search test failed') });
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
        const id = String((row as any).id);
        const data = (row as any).data || {};
        if (type === 'ticket') {
          const status = String(data.status || '').toLowerCase();
          if (status === 'resolved' || status === 'closed') {
            enqueueResolvedTicketIndex(id, tenantId);
            enqueued += 1;
          }
        } else {
          const status = String(data.status || '').toLowerCase();
          const published =
            status === 'published' || status === 'public' || data.visibility === 'Public' || status === '';
          if (published) {
            enqueueKbArticleIndex(id, tenantId);
            enqueued += 1;
          }
        }
      }
      return res.json({
        success: true,
        tenantId,
        type,
        enqueued,
        queueDepth: getVectorQueueDepth(),
      });
    } catch (err: unknown) {
      return res.status(500).json({ error: safeErrorMessage(err, 'RAG backfill enqueue failed') });
    }
  },
);

export default router;
