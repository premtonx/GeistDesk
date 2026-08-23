/**
 * Pure decision logic for resolved-ticket RAG semantic deduplication.
 * Kept free of database / embedding / AI-secret imports so it can be
 * unit-tested (see scripts/verify-rag-pipeline.ts).
 */

export const TICKET_RAG_DEDUP_THRESHOLD = 0.9;

export interface SimilarVectorRow {
  vector_distance: number | null;
}

export interface DeduplicateTicketVectorParams {
  tenantId: string;
  sourceId: string;
  body: string;
  threshold?: number;
  existing?: SimilarVectorRow[];
}

export interface DeduplicateTicketVectorResult {
  shouldSkip: boolean;
  maxSimilarity: number;
}

/**
 * Decide whether a resolved-ticket vector should be skipped because a
 * near-identical resolved ticket already exists in the same tenant.
 *
 * Cosine similarity is computed as `1 - distance`. When the closest existing
 * vector meets or exceeds `threshold` (default 0.90), the new chunk is
 * considered a duplicate and callers skip the insert.
 */
export function deduplicateTicketVector(
  params: DeduplicateTicketVectorParams,
): DeduplicateTicketVectorResult {
  const threshold = params.threshold ?? TICKET_RAG_DEDUP_THRESHOLD;
  const existing = params.existing || [];
  let maxSimilarity = 0;
  for (const row of existing) {
    if (row.vector_distance == null) continue;
    const similarity = 1 - Math.min(Number(row.vector_distance), 1);
    if (similarity > maxSimilarity) maxSimilarity = similarity;
  }
  return { shouldSkip: maxSimilarity >= threshold, maxSimilarity };
}
