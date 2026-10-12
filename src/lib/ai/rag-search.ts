/**
 * Pure pgvector cosine similarity search for Admin-Hub end-to-end tests
 * and POST /api/rag/search.
 */

import { queryDb } from '../postgres-backend.js';
import { embedTexts, vectorToSqlLiteral } from './embeddings.js';
import { stripHtmlToPlainText } from './text-chunker.js';

export interface RagSimilarityHit {
  id: string;
  sourceType: string;
  sourceId: string;
  chunkIndex: number;
  content: string;
  title: string;
  similarityScore: number;
  metadata: Record<string, unknown>;
}

const DEFAULT_TENANT = 'default';
const DEFAULT_MIN_SIMILARITY = 0.65;

/**
 * Embed the query and return top chunks by cosine similarity:
 *   similarity = 1 - (embedding <=> query_vector)
 */
export async function cosineSearchRagChunks(params: {
  query: string;
  tenantId: string;
  limit?: number;
  minSimilarity?: number;
}): Promise<RagSimilarityHit[]> {
  const tenantId = String(params.tenantId || '').trim() || DEFAULT_TENANT;
  const limit = Math.min(Math.max(params.limit ?? 5, 1), 20);
  const minSimilarity = Math.min(
    Math.max(params.minSimilarity ?? DEFAULT_MIN_SIMILARITY, 0),
    1,
  );
  const queryText = stripHtmlToPlainText(params.query).slice(0, 4000);
  if (!queryText.trim()) return [];

  const [vec] = await embedTexts([queryText], { workspaceId: tenantId });
  if (!vec) return [];
  const literal = vectorToSqlLiteral(vec);

  const sql = `
    SELECT
      id::text AS id,
      source_type::text AS source_type,
      source_id,
      chunk_index,
      chunk_content AS content,
      metadata,
      1 - (embedding <=> $1::vector) AS similarity_score
    FROM "KnowledgeEmbedding"
    WHERE tenant_id = $2
      AND embedding IS NOT NULL
      AND 1 - (embedding <=> $1::vector) > $3
    ORDER BY embedding <=> $1::vector
    LIMIT $4
  `;

  const res = await queryDb(sql, [literal, tenantId, minSimilarity, limit]);
  return res.rows.map((row: any) => {
    const metadata =
      typeof row.metadata === 'string'
        ? (JSON.parse(row.metadata) as Record<string, unknown>)
        : ((row.metadata as Record<string, unknown>) || {});
    return {
      id: String(row.id),
      sourceType: String(row.source_type || ''),
      sourceId: String(row.source_id || ''),
      chunkIndex: Number(row.chunk_index) || 0,
      content: String(row.content || ''),
      title: String(metadata.title || row.source_id || ''),
      similarityScore: Number(row.similarity_score) || 0,
      metadata,
    };
  });
}
