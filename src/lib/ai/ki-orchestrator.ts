/**
 * KI Orchestrator hybrid search (pgvector cosine + PostgreSQL FTS) for RAG triage.
 */

import { queryDb } from '../postgres-backend.js';
import { embedTexts, vectorToSqlLiteral } from './embeddings.js';
import { stripHtmlToPlainText } from './text-chunker.js';

export interface HybridSearchHit {
  id: string;
  tenantId: string;
  sourceType: 'KB_ARTICLE' | 'RESOLVED_TICKET';
  sourceId: string;
  chunkIndex: number;
  chunkContent: string;
  metadata: Record<string, unknown>;
  title: string;
  vectorDistance: number | null;
  ftsRank: number | null;
  hybridScore: number;
}

export interface GroundedRagContext {
  snippets: HybridSearchHit[];
  promptBlock: string;
  linkedKb: Array<{ id: string; title: string }>;
  linkedTickets: Array<{ id: string; title: string }>;
}

const DEFAULT_TENANT = 'default';

/**
 * Hybrid retrieval via raw SQL:
 *   - vector cosine distance (`embedding <=> query_vector`)
 *   - full-text rank (`ts_rank(search_tsv, plainto_tsquery(...))`)
 * Candidate sets are always scoped by tenantId.
 */
export async function hybridSearchKnowledge(params: {
  query: string;
  tenantId?: string;
  limit?: number;
  sourceTypes?: Array<'KB_ARTICLE' | 'RESOLVED_TICKET'>;
}): Promise<HybridSearchHit[]> {
  const tenantId = params.tenantId || DEFAULT_TENANT;
  const limit = Math.min(Math.max(params.limit ?? 5, 1), 20);
  const queryText = stripHtmlToPlainText(params.query).slice(0, 4000);
  if (!queryText.trim()) return [];

  let queryVector: number[] | null = null;
  try {
    const [vec] = await embedTexts([queryText]);
    queryVector = vec || null;
  } catch (err: any) {
    console.warn('[ki-orchestrator] embedding unavailable — FTS-only hybrid fallback:', err?.message || err);
  }

  const sourceFilter = params.sourceTypes?.length
    ? params.sourceTypes
    : (['KB_ARTICLE', 'RESOLVED_TICKET'] as const);

  if (queryVector) {
    const literal = vectorToSqlLiteral(queryVector);
    const typePlaceholders = sourceFilter
      .map((_, i) => `$${i + 4}::"KnowledgeSourceType"`)
      .join(', ');
    const sql = `
      WITH candidates AS (
        SELECT
          id::text AS id,
          tenant_id,
          source_type::text AS source_type,
          source_id,
          chunk_index,
          chunk_content,
          metadata,
          (embedding <=> $1::vector) AS vector_distance,
          ts_rank(search_tsv, plainto_tsquery('english', $2)) AS fts_rank
        FROM "KnowledgeEmbedding"
        WHERE tenant_id = $3
          AND source_type IN (${typePlaceholders})
          AND embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT 40
      )
      SELECT *
      FROM candidates
      ORDER BY
        (COALESCE(1.0 - LEAST(vector_distance, 1.0), 0) * 0.7
          + COALESCE(fts_rank, 0) * 0.3) DESC
      LIMIT $${sourceFilter.length + 4}
    `;
    const res = await queryDb(sql, [literal, queryText, tenantId, ...sourceFilter, limit]);
    return res.rows.map(mapRow);
  }

  // FTS-only fallback when embeddings are not configured
  const typePlaceholders = sourceFilter
    .map((_, i) => `$${i + 3}::"KnowledgeSourceType"`)
    .join(', ');
  const sql = `
    SELECT
      id::text AS id,
      tenant_id,
      source_type::text AS source_type,
      source_id,
      chunk_index,
      chunk_content,
      metadata,
      NULL::float8 AS vector_distance,
      ts_rank(search_tsv, plainto_tsquery('english', $1)) AS fts_rank
    FROM "KnowledgeEmbedding"
    WHERE tenant_id = $2
      AND source_type IN (${typePlaceholders})
      AND search_tsv @@ plainto_tsquery('english', $1)
    ORDER BY fts_rank DESC NULLS LAST
    LIMIT $${sourceFilter.length + 3}
  `;
  const res = await queryDb(sql, [queryText, tenantId, ...sourceFilter, limit]);
  return res.rows.map(mapRow);
}

function mapRow(row: any): HybridSearchHit {
  const metadata =
    typeof row.metadata === 'string'
      ? (JSON.parse(row.metadata) as Record<string, unknown>)
      : (row.metadata as Record<string, unknown>) || {};
  const vectorDistance =
    row.vector_distance == null ? null : Number(row.vector_distance);
  const ftsRank = row.fts_rank == null ? null : Number(row.fts_rank);
  const hybridScore =
    (vectorDistance == null ? 0 : 1 - Math.min(vectorDistance, 1)) * 0.7 +
    (ftsRank || 0) * 0.3;

  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    sourceType: row.source_type as HybridSearchHit['sourceType'],
    sourceId: String(row.source_id),
    chunkIndex: Number(row.chunk_index) || 0,
    chunkContent: String(row.chunk_content || ''),
    metadata,
    title: String(metadata.title || row.source_id),
    vectorDistance,
    ftsRank,
    hybridScore,
  };
}

/** Build grounded prompt context + linked sources for agent UI / LLM. */
export async function buildGroundedRagContext(params: {
  query: string;
  tenantId?: string;
  limit?: number;
}): Promise<GroundedRagContext> {
  const snippets = await hybridSearchKnowledge({
    query: params.query,
    tenantId: params.tenantId,
    limit: params.limit ?? 5,
  });

  const linkedKbMap = new Map<string, string>();
  const linkedTicketMap = new Map<string, string>();
  for (const hit of snippets) {
    if (hit.sourceType === 'KB_ARTICLE') linkedKbMap.set(hit.sourceId, hit.title);
    if (hit.sourceType === 'RESOLVED_TICKET') linkedTicketMap.set(hit.sourceId, hit.title);
  }

  const promptBlock = snippets
    .map(
      (hit, idx) =>
        `[${idx + 1}] (${hit.sourceType === 'KB_ARTICLE' ? 'KB' : 'Ticket'} · ${hit.title} · id=${hit.sourceId})\n${hit.chunkContent}`,
    )
    .join('\n\n---\n\n');

  return {
    snippets,
    promptBlock,
    linkedKb: [...linkedKbMap.entries()].map(([id, title]) => ({ id, title })),
    linkedTickets: [...linkedTicketMap.entries()].map(([id, title]) => ({ id, title })),
  };
}

/**
 * Server-side triage helper: ground an inbound ticket with hybrid RAG,
 * returning LLM-ready context plus linked articles/tickets for the agent UI.
 */
export async function groundInboundTicketForTriage(params: {
  subject: string;
  body: string;
  tenantId?: string;
}): Promise<GroundedRagContext> {
  const query = `${params.subject}\n${params.body}`.slice(0, 6000);
  return buildGroundedRagContext({ query, tenantId: params.tenantId, limit: 5 });
}
