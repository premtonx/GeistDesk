/**
 * Shared RAG status counters + pending-index enqueue for Admin-Hub /api/rag.
 */

import { queryDb } from '../postgres-backend.js';
import { getRagPipelineConfig, type RagPipelineConfig } from '../rag-pipeline-config.js';
import { getRecentFailedJobs } from '../job-queue.js';
import { getLastEmbeddingFailure } from './embeddings.js';
import {
  drainVectorQueue,
  enqueueKbArticleIndex,
  enqueueResolvedTicketIndex,
  getVectorQueueDepth,
} from './vector-queue.js';

export interface RagStatusResult {
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
  /** Latest embedding/provider failure (for Admin-Hub banner). */
  embeddingError?: string | null;
  recentFailures?: Array<{ id: string; jobType: string; lastError: string | null; updatedAt: string }>;
}

export type RagIndexPendingType = 'kb' | 'ticket' | 'all';

function isPublishedArticle(data: Record<string, unknown>): boolean {
  const status = String(data.status || '').toLowerCase();
  return (
    status === 'published' ||
    status === 'public' ||
    data.visibility === 'Public' ||
    status === ''
  );
}

function isResolvedTicket(data: Record<string, unknown>): boolean {
  const status = String(data.status || '').toLowerCase();
  return status === 'resolved' || status === 'closed';
}

export async function loadRagStatus(tenantId: string): Promise<RagStatusResult> {
  const { listEmbeddingProviderStatus, resolveEmbeddingProvider } = await import('./embeddings.js');

  const docs = await queryDb(
    `SELECT collection, data, id FROM geistdesk_documents
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
    const data = ((row as { data?: Record<string, unknown> }).data || {}) as Record<string, unknown>;
    if (collection === 'kb_articles') {
      totalArticles += 1;
      if (isPublishedArticle(data)) {
        publishedArticles += 1;
        publishedIds.push(String((row as { id: string }).id));
      }
    } else if (collection === 'tickets' && isResolvedTicket(data)) {
      totalResolvedClosed += 1;
      resolvedIds.push(String((row as { id: string }).id));
    }
  }

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
        `SELECT DISTINCT source_id FROM "KnowledgeEmbedding"
         WHERE tenant_id = $1 AND source_type = 'KB_ARTICLE'`,
        [tenantId],
      )
    ).rows.map((r) => String(r.source_id)),
  );
  const indexedTicketIds = new Set(
    (
      await queryDb(
        `SELECT DISTINCT source_id FROM "KnowledgeEmbedding"
         WHERE tenant_id = $1 AND source_type = 'RESOLVED_TICKET'`,
        [tenantId],
      )
    ).rows.map((r) => String(r.source_id)),
  );

  const missingKb = publishedIds.filter((id) => !indexedKbIds.has(id));
  const missingTickets = resolvedIds.filter((id) => !indexedTicketIds.has(id));
  const recentFailures = await getRecentFailedJobs(['VECTOR_INDEX', 'VECTOR_DELETE'], 5);

  return {
    success: true,
    tenantId,
    queueDepth: await getVectorQueueDepth(),
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
    embeddingError: getLastEmbeddingFailure(),
    recentFailures,
  };
}

/** Enqueue embedding jobs only for sources that are not yet in KnowledgeEmbedding. */
export async function enqueuePendingRagIndex(params: {
  tenantId: string;
  type?: RagIndexPendingType;
}): Promise<{
  tenantId: string;
  type: RagIndexPendingType;
  enqueued: number;
  missingBefore: number;
  queueDepth: number;
  enqueuedIds: string[];
}> {
  const tenantId = params.tenantId;
  const type: RagIndexPendingType = params.type || 'kb';
  const enqueuedIds: string[] = [];

  const docs = await queryDb(
    `SELECT id, collection, data FROM geistdesk_documents
     WHERE collection IN ('kb_articles', 'tickets')
       AND (data->>'tenantId' IS NULL OR data->>'tenantId' = $1)`,
    [tenantId],
  );

  const indexedKb = new Set(
    (
      await queryDb(
        `SELECT DISTINCT source_id FROM "KnowledgeEmbedding"
         WHERE tenant_id = $1 AND source_type = 'KB_ARTICLE'`,
        [tenantId],
      )
    ).rows.map((r) => String(r.source_id)),
  );
  const indexedTickets = new Set(
    (
      await queryDb(
        `SELECT DISTINCT source_id FROM "KnowledgeEmbedding"
         WHERE tenant_id = $1 AND source_type = 'RESOLVED_TICKET'`,
        [tenantId],
      )
    ).rows.map((r) => String(r.source_id)),
  );

  for (const row of docs.rows) {
    const id = String((row as { id: string }).id);
    const collection = String(row.collection);
    const data = ((row as { data?: Record<string, unknown> }).data || {}) as Record<string, unknown>;

    if ((type === 'kb' || type === 'all') && collection === 'kb_articles') {
      if (isPublishedArticle(data) && !indexedKb.has(id)) {
        await enqueueKbArticleIndex(id, tenantId);
        enqueuedIds.push(id);
      }
    }
    if ((type === 'ticket' || type === 'all') && collection === 'tickets') {
      if (isResolvedTicket(data) && !indexedTickets.has(id)) {
        await enqueueResolvedTicketIndex(id, tenantId);
        enqueuedIds.push(id);
      }
    }
  }

  // Process immediately — do not wait for the worker interval.
  void drainVectorQueue();

  return {
    tenantId,
    type,
    enqueued: enqueuedIds.length,
    missingBefore: enqueuedIds.length,
    queueDepth: await getVectorQueueDepth(),
    enqueuedIds: enqueuedIds.slice(0, 50),
  };
}
