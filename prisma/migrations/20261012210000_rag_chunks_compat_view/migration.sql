-- Compatibility view exposing KnowledgeEmbedding as rag_chunks (Admin / docs naming).
-- Canonical store remains "KnowledgeEmbedding" (vector(1536) + HNSW + FTS).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE OR REPLACE VIEW rag_chunks AS
SELECT
  id,
  CASE source_type::text
    WHEN 'KB_ARTICLE' THEN 'kb_article'
    WHEN 'RESOLVED_TICKET' THEN 'resolved_ticket'
    WHEN 'KB_DOCUMENT' THEN 'file'
    ELSE lower(source_type::text)
  END AS source_type,
  source_id,
  chunk_index,
  chunk_content AS content,
  embedding,
  tenant_id,
  metadata,
  created_at,
  updated_at
FROM "KnowledgeEmbedding";

-- Ensure HNSW cosine index exists (no-op when already present).
CREATE INDEX IF NOT EXISTS "idx_knowledge_embedding_hnsw"
  ON "KnowledgeEmbedding"
  USING hnsw ("embedding" vector_cosine_ops);
