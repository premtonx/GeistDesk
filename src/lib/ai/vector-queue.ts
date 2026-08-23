/**
 * Background vector sync queue for KnowledgeEmbedding (pgvector).
 * Jobs: INDEX_KB_ARTICLE | INDEX_RESOLVED_TICKET | DELETE_EMBEDDINGS
 */

import { getDocDirect, queryDb } from '../postgres-backend.js';
import { chunkText, stripHtmlToPlainText } from './text-chunker.js';
import { embedTexts, vectorToSqlLiteral } from './embeddings.js';
import { documentBelongsToTenant, DEFAULT_TENANT_ID } from '../tenant-context.js';
import { safeErrorMessage } from '../safe-log.js';
import {
  buildTicketResolution,
  fetchTicketMessages,
  redactForRag,
} from './resolution-extractor.js';
import { getRagPipelineConfig } from '../rag-pipeline-config.js';

export type VectorJobType = 'INDEX_KB_ARTICLE' | 'INDEX_RESOLVED_TICKET' | 'DELETE_EMBEDDINGS';
export type KnowledgeSourceType = 'KB_ARTICLE' | 'RESOLVED_TICKET';

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
const queue: VectorJob[] = [];
let draining = false;
let workerStarted = false;

function jobId(): string {
  return `vj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function enqueueVectorJob(
  type: VectorJobType,
  params: { sourceId: string; tenantId?: string; sourceType?: KnowledgeSourceType },
): VectorJob {
  const job: VectorJob = {
    id: jobId(),
    type,
    tenantId: params.tenantId || DEFAULT_TENANT,
    sourceId: params.sourceId,
    sourceType: params.sourceType,
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
  };
  queue.push(job);
  void drainVectorQueue();
  return job;
}

export function enqueueKbArticleIndex(sourceId: string, tenantId = DEFAULT_TENANT): VectorJob {
  return enqueueVectorJob('INDEX_KB_ARTICLE', { sourceId, tenantId, sourceType: 'KB_ARTICLE' });
}

export function enqueueResolvedTicketIndex(sourceId: string, tenantId = DEFAULT_TENANT): VectorJob {
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
): VectorJob {
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
}): Promise<number> {
  const combined = `${params.title}\n\n${params.body}`.trim();
  const chunks = chunkText(combined, { overlapTokens: params.overlapTokens ?? 100 });
  if (chunks.length === 0) {
    await deleteEmbeddingsForSource(params.tenantId, params.sourceType, params.sourceId);
    return 0;
  }

  const vectors = await embedTexts(chunks);
  await deleteEmbeddingsForSource(params.tenantId, params.sourceType, params.sourceId);

  for (let i = 0; i < chunks.length; i += 1) {
    const content = chunks[i];
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
    console.warn(
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

async function indexResolvedTicket(tenantId: string, sourceId: string): Promise<void> {
  const doc = await getDocDirect('tickets', sourceId);
  if (!doc) {
    await deleteEmbeddingsForSource(tenantId, 'RESOLVED_TICKET', sourceId);
    return;
  }

  if (!documentBelongsToTenant(doc, tenantId)) {
    console.warn(
      `[vector-queue] refusing to index ticket ${sourceId}: tenant mismatch (job=${tenantId})`,
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

export async function drainVectorQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) break;
      try {
        await processJob(job);
      } catch (err: any) {
        console.warn(
          `[vector-queue] job ${job.type} ${job.sourceId} failed (attempt ${job.attempts}):`,
          safeErrorMessage(err),
        );
        if (job.attempts < 3) {
          queue.push(job);
          await new Promise((r) => setTimeout(r, 500 * job.attempts));
        }
      }
    }
  } finally {
    draining = false;
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
        enqueueDeleteEmbeddings(id, 'KB_ARTICLE', tenantId);
        return;
      }
      if ((action === 'add_doc' || action === 'update_doc' || action === 'set_doc') && id) {
        enqueueKbArticleIndex(id, tenantId);
      }
      return;
    }

    if (collection === 'tickets') {
      if (action === 'delete_doc' && id) {
        enqueueDeleteEmbeddings(id, 'RESOLVED_TICKET', tenantId);
        return;
      }
      if ((action === 'update_doc' || action === 'set_doc') && id) {
        const status = String(params.data?.status || '').toLowerCase();
        if (status === 'resolved' || status === 'closed') {
          enqueueResolvedTicketIndex(id, tenantId);
        } else if (status === 'trash' || status === 'deleted') {
          enqueueDeleteEmbeddings(id, 'RESOLVED_TICKET', tenantId);
        }
      }
    }
  } catch (err: any) {
    console.warn('[vector-queue] mutation hook failed:', err?.message || err);
  }
}

export function startVectorQueueWorker(): void {
  if (workerStarted) return;
  workerStarted = true;
  setInterval(() => {
    void drainVectorQueue();
  }, 5_000);
  console.log('[vector-queue] background worker started');
}

export function getVectorQueueDepth(): number {
  return queue.length;
}
