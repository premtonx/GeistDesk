-- Enable pgvector and create KnowledgeEmbedding with HNSW (cosine) + FTS.
CREATE EXTENSION IF NOT EXISTS vector;

DO $$ BEGIN
  CREATE TYPE "KnowledgeSourceType" AS ENUM ('KB_ARTICLE', 'RESOLVED_TICKET');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "KnowledgeEmbedding" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(255) NOT NULL DEFAULT 'default',
  "source_type" "KnowledgeSourceType" NOT NULL,
  "source_id" VARCHAR(255) NOT NULL,
  "chunk_index" INTEGER NOT NULL DEFAULT 0,
  "chunk_content" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "embedding" vector(1536),
  "search_tsv" tsvector,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_embedding_source_chunk_uq"
  ON "KnowledgeEmbedding" ("tenant_id", "source_type", "source_id", "chunk_index");

CREATE INDEX IF NOT EXISTS "idx_knowledge_embedding_source"
  ON "KnowledgeEmbedding" ("tenant_id", "source_type", "source_id");

-- Approximate nearest-neighbor search (cosine distance).
CREATE INDEX IF NOT EXISTS "idx_knowledge_embedding_hnsw"
  ON "KnowledgeEmbedding"
  USING hnsw ("embedding" vector_cosine_ops);

-- Full-text search support for hybrid retrieval.
CREATE INDEX IF NOT EXISTS "idx_knowledge_embedding_fts"
  ON "KnowledgeEmbedding"
  USING gin ("search_tsv");
