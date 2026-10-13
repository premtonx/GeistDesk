/**
 * Background vector sync queue for KnowledgeEmbedding (pgvector).
 * Jobs: INDEX_KB_ARTICLE | INDEX_RESOLVED_TICKET | INDEX_KB_DOCUMENT | DELETE_EMBEDDINGS
 */

import { getDocDirect, queryDb } from '../postgres-backend.js';
import { chunkText, stripHtmlToPlainText } from './text-chunker.js';
import { embedTexts, vectorToSqlLiteral } from './embeddings.js';
import { documentBelongsToTenant, DEFAULT_TENANT_ID } from '../tenant-context.js';
import { safeErrorMessage, safeLog } from '../safe-log.js';
import {
  buildTicketResolution,
  fetchTicketMessages,
  redactForRag,
} from './resolution-extractor.js';
import { getRagPipelineConfig } from '../rag-pipeline-config.js';
import {
  deduplicateTicketVector,
  TICKET_RAG_DEDUP_THRESHOLD,
} from './ticket-rag-dedup.js';
import {
  extractDocumentText,
  readRawFile,
  isNoText,
  buildChunkHeader,
} from '../kb/document-store.js';
import { updateDocDirect } from '../postgres-backend.js';
import {
  enqueueJob,
  leaseNextJob,
  completeJob,
  failJob,
  recoverOrphanedJobs,
  type BackgroundJobRow,
} from '../job-queue.js';

export type VectorJobType =
  | 'INDEX_KB_ARTICLE'
  | 'INDEX_RESOLVED_TICKET'
  | 'INDEX_KB_DOCUMENT'
  | 'DELETE_EMBEDDINGS';
export type KnowledgeSourceType = 'KB_ARTICLE' | 'RESOLVED_TICKET' | 'KB_DOCUMENT';

export interface VectorJob {
  id: string;
  type: VectorJobType;
  tenantId: string;
  sourceId: string;
  sourceType?: KnowledgeSourceType;
  enqueuedAt: string;
  attempts: number;
}

const DEFAULT_TENANT = DEFAULT_TENANT_ID;
let workerStarted = false;

/** Map a durable job row back to the legacy VectorJob shape. */
function toVectorJob(row: BackgroundJobRow): VectorJob {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    type: (payload.type as VectorJobType) || 'INDEX_KB_ARTICLE',
    tenantId: String(payload.tenantId || DEFAULT_TENANT),
    sourceId: String(payload.sourceId || ''),
    sourceType: payload.sourceType as KnowledgeSourceType | undefined,
    enqueuedAt: row.created_at,
    attempts: row.attempts,
  };
}

/**
 * Enqueue a vector job on the durable `background_jobs` table. Kept as a thin
 * wrapper over `enqueueJob` for backwards compatibility with route callers.
 */
export async function enqueueVectorJob(
  type: VectorJobType,
  params: { sourceId: string; tenantId?: string; sourceType?: KnowledgeSourceType },
): Promise<VectorJob> {
  const id = await enqueueJob('VECTOR_INDEX', {
    type,
    sourceId: params.sourceId,
    tenantId: params.tenantId || DEFAULT_TENANT,
    sourceType: params.sourceType,
  });
  return {
    id,
    type,
    tenantId: params.tenantId || DEFAULT_TENANT,
    sourceId: params.sourceId,
    sourceType: params.sourceType,
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
  };
}

export function enqueueKbArticleIndex(sourceId: string, tenantId = DEFAULT_TENANT): Promise<VectorJob> {
  return enqueueVectorJob('INDEX_KB_ARTICLE', { sourceId, tenantId, sourceType: 'KB_ARTICLE' });
}

export function enqueueKbDocumentIndex(sourceId: string, tenantId = DEFAULT_TENANT): Promise<VectorJob> {
  return enqueueVectorJob('INDEX_KB_DOCUMENT', { sourceId, tenantId, sourceType: 'KB_DOCUMENT' });
}

export function enqueueDeleteDocumentEmbeddings(
  sourceId: string,
  tenantId = DEFAULT_TENANT,
): Promise<VectorJob> {
  return enqueueVectorJob('DELETE_EMBEDDINGS', { sourceId, tenantId, sourceType: 'KB_DOCUMENT' });
}

export function enqueueResolvedTicketIndex(sourceId: string, tenantId = DEFAULT_TENANT): Promise<VectorJob> {
  return enqueueVectorJob('INDEX_RESOLVED_TICKET', {
    sourceId,
    tenantId,
    sourceType: 'RESOLVED_TICKET',
  });
}

export function enqueueDeleteEmbeddings(
  sourceId: string,
  sourceType: KnowledgeSourceType,
  tenantId = DEFAULT_TENANT,
): Promise<VectorJob> {
  return enqueueVectorJob('DELETE_EMBEDDINGS', { sourceId, tenantId, sourceType });
}

export async function deleteEmbeddingsForSource(
  tenantId: string,
  sourceType: KnowledgeSourceType,
  sourceId: string,
): Promise<number> {
  const res = await queryDb(
    `DELETE FROM "KnowledgeEmbedding"
     WHERE tenant_id = $1 AND source_type = $2::"KnowledgeSourceType" AND source_id = $3`,
    [tenantId, sourceType, sourceId],
  );
  return res.rowCount || 0;
}

async function upsertChunks(params: {
  tenantId: string;
  sourceType: KnowledgeSourceType;
  sourceId: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  overlapTokens?: number;
  chunkPrefix?: string;
}): Promise<number> {
  const combined = `${params.title}\n\n${params.body}`.trim();
  const chunks = chunkText(combined, { overlapTokens: params.overlapTokens ?? 100 });
  if (chunks.length === 0) {
    await deleteEmbeddingsForSource(params.tenantId, params.sourceType, params.sourceId);
    return 0;
  }

  // Context stamping: prepend a metadata header to each chunk before embedding.
  const stamped = params.chunkPrefix
    ? chunks.map((chunk) => `${params.chunkPrefix!}\n\n${chunk}`)
    : chunks;

  const vectors = await embedTexts(stamped, { workspaceId: params.tenantId });
  await deleteEmbeddingsForSource(params.tenantId, params.sourceType, params.sourceId);

  for (let i = 0; i < chunks.length; i += 1) {
    const content = stamped[i];
    const embedding = vectors[i];
    if (!embedding) continue;
    const literal = vectorToSqlLiteral(embedding);
    const meta = {
      ...params.metadata,
      title: params.title,
      chunkIndex: i,
      chunkCount: chunks.length,
    };
    await queryDb(
      `INSERT INTO "KnowledgeEmbedding"
        (tenant_id, source_type, source_id, chunk_index, chunk_content, metadata, embedding, search_tsv, updated_at)
       VALUES (
         $1,
         $2::"KnowledgeSourceType",
         $3,
         $4,
         $5,
         $6::jsonb,
         $7::vector,
         to_tsvector('english', $5),
         CURRENT_TIMESTAMP
       )
       ON CONFLICT (tenant_id, source_type, source_id, chunk_index)
       DO UPDATE SET
         chunk_content = EXCLUDED.chunk_content,
         metadata = EXCLUDED.metadata,
         embedding = EXCLUDED.embedding,
         search_tsv = EXCLUDED.search_tsv,
         updated_at = CURRENT_TIMESTAMP`,
      [params.tenantId, params.sourceType, params.sourceId, i, content, JSON.stringify(meta), literal],
    );
  }
  return chunks.length;
}

async function indexKbArticle(tenantId: string, sourceId: string): Promise<void> {
  const doc = await getDocDirect('kb_articles', sourceId);
  if (!doc) {
    await deleteEmbeddingsForSource(tenantId, 'KB_ARTICLE', sourceId);
    return;
  }

  if (!documentBelongsToTenant(doc, tenantId)) {
    safeLog('warn', 
      `[vector-queue] refusing to index KB ${sourceId}: tenant mismatch (job=${tenantId})`,
    );
    return;
  }

  const status = String(doc.status || '').toLowerCase();
  const published =
    status === 'published' ||
    status === 'public' ||
    doc.visibility === 'Public' ||
    status === '';

  if (!published) {
    await deleteEmbeddingsForSource(tenantId, 'KB_ARTICLE', sourceId);
    return;
  }

  // Selective RAG: exclude articles opted out via index_in_rag.
  if (doc.index_in_rag === false) {
    await deleteEmbeddingsForSource(tenantId, 'KB_ARTICLE', sourceId);
    safeLog('info', 
      `[RAG] Skipped indexing KB article ${sourceId}: index_in_rag=false (removed existing vectors)`,
    );
    return;
  }

  const title = String(doc.title || 'Untitled');
  const body = await redactForRag(
    stripHtmlToPlainText(String(doc.content || doc.body || '')),
    tenantId,
  );
  const ragConfig = await getRagPipelineConfig(tenantId);
  await upsertChunks({
    tenantId,
    sourceType: 'KB_ARTICLE',
    sourceId,
    title,
    body,
    overlapTokens: ragConfig.chunkOverlapTokens,
    metadata: {
      workspace_id: tenantId,
      article_id: sourceId,
      title: doc.title,
      locale: doc.language || 'en',
      updated_at: doc.updatedAt || doc.createdAt || null,
      status: doc.status,
      visibility: doc.visibility,
      category: doc.category,
      tags: doc.tags || [],
    },
  });
}

/** GeistKB Document Library — chunk + embed an uploaded/synced document. */
async function indexKbDocument(tenantId: string, sourceId: string): Promise<void> {
  const doc = await getDocDirect('kb_documents', sourceId);
  if (!doc) {
    await deleteEmbeddingsForSource(tenantId, 'KB_DOCUMENT', sourceId);
    return;
  }

  if (!documentBelongsToTenant(doc, tenantId)) {
    safeLog('warn', 
      `[vector-queue] refusing to index KB document ${sourceId}: tenant mismatch (job=${tenantId})`,
    );
    return;
  }

  // Selective RAG: opting a document out purges existing vectors immediately.
  if (doc.index_in_rag === false) {
    await deleteEmbeddingsForSource(tenantId, 'KB_DOCUMENT', sourceId);
    safeLog('info', 
      `[RAG] Skipped indexing KB document ${sourceId}: index_in_rag=false (removed existing vectors)`,
    );
    return;
  }

  const filename = String(doc.filename || 'document.bin');
  const buffer = await readRawFile(tenantId, sourceId, filename);
  if (!buffer) {
    await updateDocDirect('kb_documents', sourceId, {
      status: 'error',
      error: 'Raw file missing from storage.',
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  let text: string;
  let pages: number | null = null;
  try {
    const extracted = await extractDocumentText({
      filename,
      buffer,
      mimetype: doc.mime ? String(doc.mime) : undefined,
    });
    text = extracted.text;
    pages = extracted.pages;
  } catch (err: any) {
    safeLog('warn', `[RAG] document text extraction failed for ${sourceId}:`, err?.message || err);
    await updateDocDirect('kb_documents', sourceId, {
      status: 'error',
      error: err?.message || 'Text extraction failed.',
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  // Sparse / scanned files get flagged instead of polluting the vector store.
  if (isNoText(text)) {
    await deleteEmbeddingsForSource(tenantId, 'KB_DOCUMENT', sourceId);
    await updateDocDirect('kb_documents', sourceId, {
      status: 'no_text',
      pages,
      chunkCount: 0,
      updatedAt: new Date().toISOString(),
    });
    safeLog('info', 
      `[RAG] KB document ${sourceId} has no extractable text (${filename}) — marked no_text`,
    );
    return;
  }

  const ragConfig = await getRagPipelineConfig(tenantId);
  const body = await redactForRag(text, tenantId);
  const header = buildChunkHeader(filename, sourceId);
  const chunkCount = await upsertChunks({
    tenantId,
    sourceType: 'KB_DOCUMENT',
    sourceId,
    title: String(doc.title || filename),
    body,
    overlapTokens: ragConfig.chunkOverlapTokens,
    chunkPrefix: header,
    metadata: {
      workspace_id: tenantId,
      source: 'kb_doc',
      document_id: sourceId,
      filename,
      index_in_rag: true,
      pages,
      updated_at: doc.updatedAt || doc.createdAt || null,
    },
  });

  await updateDocDirect('kb_documents', sourceId, {
    status: 'indexed',
    pages,
    chunkCount,
    error: null,
    indexedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  safeLog('info', `[RAG] KB document ${sourceId} indexed (${chunkCount} chunks)`);
}

/**
 * Deduplicate a resolved-ticket vector before insert.
 * Runs a cosine-similarity search against existing RESOLVED_TICKET embeddings
 * for the same tenant and returns the max similarity (1 - distance). When it
 * meets or exceeds the threshold, callers skip inserting a duplicate chunk.
 *
 * Pure decision helper lives in ticket-rag-dedup.ts — exported for testability.
 */

/** Query the closest existing RESOLVED_TICKET vectors for the given tenant (excluding self). */
async function findSimilarResolvedTickets(
  tenantId: string,
  sourceId: string,
  body: string,
  limit = 5,
): Promise<Array<{ vector_distance: number | null }>> {
  const [vector] = await embedTexts([body], { workspaceId: tenantId });
  if (!vector) return [];
  const literal = vectorToSqlLiteral(vector);
  const res = await queryDb(
    `SELECT (embedding <=> $4::vector) AS vector_distance
     FROM "KnowledgeEmbedding"
     WHERE tenant_id = $1
       AND source_type = 'RESOLVED_TICKET'::"KnowledgeSourceType"
       AND source_id <> $2
       AND embedding IS NOT NULL
     ORDER BY embedding <=> $4::vector
     LIMIT $3`,
    [tenantId, sourceId, limit, literal],
  );
  return res.rows.map((row) => ({ vector_distance: row.vector_distance == null ? null : Number(row.vector_distance) }));
}

async function indexResolvedTicket(tenantId: string, sourceId: string): Promise<void> {
  const doc = await getDocDirect('tickets', sourceId);
  if (!doc) {
    await deleteEmbeddingsForSource(tenantId, 'RESOLVED_TICKET', sourceId);
    return;
  }

  if (!documentBelongsToTenant(doc, tenantId)) {
    safeLog('warn', 
      `[vector-queue] refusing to index ticket ${sourceId}: tenant mismatch (job=${tenantId})`,
    );
    return;
  }

  // Selective RAG: exclude tickets opted out via include_in_rag.
  if (doc.include_in_rag === false) {
    await deleteEmbeddingsForSource(tenantId, 'RESOLVED_TICKET', sourceId);
    safeLog('info', 
      `[RAG] Skipped indexing ticket ${sourceId}: include_in_rag=false (removed existing vectors)`,
    );
    return;
  }

  const status = String(doc.status || '').toLowerCase();
  if (status !== 'resolved' && status !== 'closed') {
    await deleteEmbeddingsForSource(tenantId, 'RESOLVED_TICKET', sourceId);
    return;
  }

  const title = String(doc.subject || doc.title || `Ticket ${sourceId}`);
  const messages = await fetchTicketMessages(sourceId);
  const { issue, resolution } = await buildTicketResolution(doc, messages, tenantId);

  const body = await redactForRag(
    [
      issue || stripHtmlToPlainText(String(doc.description || '')),
      stripHtmlToPlainText(String(doc.internalNotes || '')),
      resolution,
    ]
      .filter(Boolean)
      .join('\n\n'),
    tenantId,
  );

  const ragConfig = await getRagPipelineConfig(tenantId);

  // Semantic dedup: skip when a near-identical resolved ticket already exists (>= 0.90).
  try {
    const similar = await findSimilarResolvedTickets(tenantId, sourceId, body);
    const { shouldSkip, maxSimilarity } = deduplicateTicketVector({
      tenantId,
      sourceId,
      body,
      existing: similar,
      threshold: TICKET_RAG_DEDUP_THRESHOLD,
    });
    if (shouldSkip) {
      safeLog('info', 
        `[RAG] Skipped duplicate ticket vector for ${sourceId} (similarity >= 0.90, max=${maxSimilarity.toFixed(3)})`,
      );
      return;
    }
  } catch (err: any) {
    safeLog('warn', 
      `[RAG] dedup search failed for ${sourceId} — proceeding with upsert:`,
      err?.message || err,
    );
  }

  await upsertChunks({
    tenantId,
    sourceType: 'RESOLVED_TICKET',
    sourceId,
    title,
    body,
    overlapTokens: ragConfig.chunkOverlapTokens,
    metadata: {
      workspace_id: tenantId,
      source: 'ticket',
      ticket_id: sourceId,
      status: doc.status,
      customId: doc.customId,
      priority: doc.priority,
      category: doc.category || null,
      resolution_date: doc.resolvedAt || doc.closedAt || doc.updatedAt || null,
      tags: doc.tags || [],
    },
  });
}

async function processJob(job: VectorJob): Promise<void> {
  job.attempts += 1;
  switch (job.type) {
    case 'INDEX_KB_ARTICLE':
      await indexKbArticle(job.tenantId, job.sourceId);
      break;
    case 'INDEX_KB_DOCUMENT':
      await indexKbDocument(job.tenantId, job.sourceId);
      break;
    case 'INDEX_RESOLVED_TICKET':
      await indexResolvedTicket(job.tenantId, job.sourceId);
      break;
    case 'DELETE_EMBEDDINGS': {
      const sourceType = job.sourceType || 'KB_ARTICLE';
      await deleteEmbeddingsForSource(job.tenantId, sourceType, job.sourceId);
      break;
    }
    default:
      break;
  }
}

const VECTOR_JOB_TYPES = ['VECTOR_INDEX'] as const;

/**
 * Drain the durable vector queue, leasing jobs with `SKIP LOCKED` so multiple
 * processes can share the workload without double-processing. Kept as a thin
 * wrapper over `leaseNextJob` for backwards compatibility.
 */
export async function drainVectorQueue(): Promise<void> {
  const workerId = `vector-${process.pid}`;
  for (let leased = 0; leased < 50; leased += 1) {
    const row = await leaseNextJob(workerId, [...VECTOR_JOB_TYPES]);
    if (!row) break;
    const job = toVectorJob(row);
    try {
      await processJob(job);
      await completeJob(row.id);
    } catch (err: any) {
      safeLog('warn', 
        `[vector-queue] job ${job.type} ${job.sourceId} failed (attempt ${job.attempts}):`,
        safeErrorMessage(err),
      );
      await failJob(row.id, err);
    }
  }
}

/** Process document-store mutations from /api/db (and server writers). */
export function handleKnowledgeDocumentMutation(params: {
  collection: string;
  action: string;
  id?: string;
  data?: Record<string, unknown> | null;
  tenantId?: string;
}): void {
  const tenantId = params.tenantId || DEFAULT_TENANT;
  const collection = params.collection;
  const action = params.action;
  const id = params.id;

  try {
    if (collection === 'kb_articles') {
      if (action === 'delete_doc' && id) {
        void enqueueDeleteEmbeddings(id, 'KB_ARTICLE', tenantId);
        return;
      }
      if ((action === 'add_doc' || action === 'update_doc' || action === 'set_doc') && id) {
        // Auto-sync on publish/create when RAG indexing is enabled for the article.
        void (async () => {
          try {
            const ragConfig = await getRagPipelineConfig(tenantId);
            if (!ragConfig.indexNewKbArticles) return;
            if (params.data?.index_in_rag === false) {
              await enqueueDeleteEmbeddings(id, 'KB_ARTICLE', tenantId);
              return;
            }
            await enqueueKbArticleIndex(id, tenantId);
            void drainVectorQueue();
          } catch (err: any) {
            safeLog('warn', '[vector-queue] KB auto-index enqueue failed:', err?.message || err);
          }
        })();
      }
      return;
    }

    if (collection === 'kb_documents') {
      if (action === 'delete_doc' && id) {
        void enqueueDeleteEmbeddings(id, 'KB_DOCUMENT', tenantId);
        return;
      }
      if ((action === 'add_doc' || action === 'update_doc' || action === 'set_doc') && id) {
        if (params.data?.index_in_rag === false) {
          void enqueueDeleteEmbeddings(id, 'KB_DOCUMENT', tenantId);
        } else {
          void enqueueKbDocumentIndex(id, tenantId).then(() => void drainVectorQueue());
        }
      }
      return;
    }

    if (collection === 'tickets') {
      if (action === 'delete_doc' && id) {
        void enqueueDeleteEmbeddings(id, 'RESOLVED_TICKET', tenantId);
        return;
      }
      if ((action === 'update_doc' || action === 'set_doc') && id) {
        const status = String(params.data?.status || '').toLowerCase();
        if (params.data?.include_in_rag === false) {
          // Selective RAG: opting a ticket out purges existing vectors immediately.
          void enqueueDeleteEmbeddings(id, 'RESOLVED_TICKET', tenantId);
        } else if (status === 'resolved' || status === 'closed') {
          void (async () => {
            const ragConfig = await getRagPipelineConfig(tenantId);
            if (!ragConfig.indexResolvedTickets) return;
            await enqueueResolvedTicketIndex(id, tenantId);
            void drainVectorQueue();
          })();
        } else if (status === 'trash' || status === 'deleted') {
          void enqueueDeleteEmbeddings(id, 'RESOLVED_TICKET', tenantId);
        }
      }
    }
  } catch (err: any) {
    safeLog('warn', '[vector-queue] mutation hook failed:', err?.message || err);
  }
}

export function startVectorQueueWorker(): void {
  if (workerStarted) return;
  workerStarted = true;
  // Recover hung "running" vector jobs quickly (embedding timeouts used to leave
  // leases stuck for 10 minutes).
  void recoverOrphanedJobs('vector', 2).then((recovered) => {
    if (recovered > 0) safeLog('info', `[vector-queue] recovered ${recovered} orphaned job(s)`);
  });
  setInterval(() => {
    void recoverOrphanedJobs('vector', 2);
    void drainVectorQueue();
  }, 2_000);
  // Kick immediately so index-pending does not wait for the first interval.
  void drainVectorQueue();
  safeLog('info', '[vector-queue] background worker started (durable queue)');
}

export async function getVectorQueueDepth(): Promise<number> {
  const { getJobQueueDepth } = await import('../job-queue.js');
  return getJobQueueDepth(['VECTOR_INDEX', 'VECTOR_DELETE']);
}
