/**
 * Per-workspace RAG pipeline configuration (resolution mode, PII redaction,
 * chunk overlap). Stored in the rag_pipeline_config table keyed by workspace_id.
 */

import { queryDb } from './postgres-backend.js';

export type RagResolutionMode = 'extract' | 'ai_generated' | 'hybrid';

export interface RagPipelineConfig {
  workspaceId: string;
  /** How the "final accepted resolution" of a resolved ticket is captured. */
  resolutionMode: RagResolutionMode;
  /** Redact obvious PII (emails, credit cards, secrets, tokens) before embedding. */
  redactPii: boolean;
  /** Token overlap between adjacent chunks when indexing KB articles / tickets. */
  chunkOverlapTokens: number;
  /** Index resolved/closed tickets into RAG automatically. */
  indexResolvedTickets: boolean;
  /** Index newly created KB articles into RAG automatically. */
  indexNewKbArticles: boolean;
  /** Semantic duplicate detection on new KB articles / ticket resolutions. */
  detectDuplicates: boolean;
  updatedBy?: string | null;
  updatedAt?: string;
}

export const DEFAULT_RAG_PIPELINE_CONFIG: RagPipelineConfig = {
  workspaceId: 'default',
  resolutionMode: 'hybrid',
  redactPii: true,
  chunkOverlapTokens: 100,
  indexResolvedTickets: true,
  indexNewKbArticles: true,
  detectDuplicates: true,
};

export function isRagResolutionMode(value: unknown): value is RagResolutionMode {
  return value === 'extract' || value === 'ai_generated' || value === 'hybrid';
}

/** Read the config for a workspace, falling back to defaults when absent. */
export async function getRagPipelineConfig(workspaceId = 'default'): Promise<RagPipelineConfig> {
  try {
    const res = await queryDb(
      `SELECT workspace_id, resolution_mode, redact_pii, chunk_overlap_tokens,
              index_resolved_tickets, index_new_kb_articles, detect_duplicates,
              updated_by, updated_at
       FROM rag_pipeline_config
       WHERE workspace_id = $1`,
      [workspaceId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    if (!row) return { ...DEFAULT_RAG_PIPELINE_CONFIG, workspaceId };
    const mode = row.resolution_mode;
    return {
      workspaceId: String(row.workspace_id || workspaceId),
      resolutionMode: isRagResolutionMode(mode) ? mode : 'hybrid',
      redactPii: row.redact_pii !== false,
      chunkOverlapTokens: Number.isFinite(Number(row.chunk_overlap_tokens))
        ? Number(row.chunk_overlap_tokens)
        : 100,
      indexResolvedTickets: row.index_resolved_tickets !== false,
      indexNewKbArticles: row.index_new_kb_articles !== false,
      detectDuplicates: row.detect_duplicates !== false,
      updatedBy: row.updated_by ? String(row.updated_by) : null,
      updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : undefined,
    };
  } catch (err: unknown) {
    console.warn('[rag-pipeline-config] read failed, using defaults:', (err as Error)?.message || err);
    return { ...DEFAULT_RAG_PIPELINE_CONFIG, workspaceId };
  }
}

/** Upsert the config for a workspace. */
export async function setRagPipelineConfig(
  patch: Partial<
    Pick<
      RagPipelineConfig,
      | 'resolutionMode'
      | 'redactPii'
      | 'chunkOverlapTokens'
      | 'indexResolvedTickets'
      | 'indexNewKbArticles'
      | 'detectDuplicates'
    >
  >,
  workspaceId = 'default',
  updatedBy?: string | null,
): Promise<RagPipelineConfig> {
  const current = await getRagPipelineConfig(workspaceId);
  const next: RagPipelineConfig = {
    ...current,
    resolutionMode: patch.resolutionMode ?? current.resolutionMode,
    redactPii: patch.redactPii ?? current.redactPii,
    chunkOverlapTokens: patch.chunkOverlapTokens ?? current.chunkOverlapTokens,
    indexResolvedTickets: patch.indexResolvedTickets ?? current.indexResolvedTickets,
    indexNewKbArticles: patch.indexNewKbArticles ?? current.indexNewKbArticles,
    detectDuplicates: patch.detectDuplicates ?? current.detectDuplicates,
    updatedBy: updatedBy ?? current.updatedBy,
  };

  await queryDb(
    `INSERT INTO rag_pipeline_config
       (workspace_id, resolution_mode, redact_pii, chunk_overlap_tokens,
        index_resolved_tickets, index_new_kb_articles, detect_duplicates, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
     ON CONFLICT (workspace_id)
     DO UPDATE SET
       resolution_mode = EXCLUDED.resolution_mode,
       redact_pii = EXCLUDED.redact_pii,
       chunk_overlap_tokens = EXCLUDED.chunk_overlap_tokens,
       index_resolved_tickets = EXCLUDED.index_resolved_tickets,
       index_new_kb_articles = EXCLUDED.index_new_kb_articles,
       detect_duplicates = EXCLUDED.detect_duplicates,
       updated_by = EXCLUDED.updated_by,
       updated_at = CURRENT_TIMESTAMP`,
    [
      workspaceId,
      next.resolutionMode,
      next.redactPii,
      next.chunkOverlapTokens,
      next.indexResolvedTickets,
      next.indexNewKbArticles,
      next.detectDuplicates,
      updatedBy ?? null,
    ],
  );

  return { ...next, updatedAt: new Date().toISOString() };
}
