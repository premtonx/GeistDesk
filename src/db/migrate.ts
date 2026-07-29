/**
 * PostgreSQL schema deployment (production bootstrap step 1).
 *
 * Equivalent to `prisma migrate deploy` for this codebase: applies all DDL via
 * initDb() using CREATE TABLE IF NOT EXISTS / ALTER TABLE IF NOT EXISTS so the
 * operation is safe to run on every container start.
 *
 * Includes KnowledgeEmbedding (pgvector + HNSW) from prisma/migrations.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npm run db:migrate
 *   DATABASE_URL=postgres://... npm run db:migrate:prod
 *   DATABASE_URL=postgres://... npm run db:prisma:migrate   # Prisma-native path
 */

import 'dotenv/config';
import { initDb } from '../lib/postgres-backend.js';

async function main() {
  const databaseUrl = process.env.DATABASE_URL || process.env.PG_DATABASE_URL;
  if (!databaseUrl) {
    console.error('[migrate] DATABASE_URL (or PG_DATABASE_URL) is required.');
    process.exit(1);
  }

  console.log('[migrate] Deploying PostgreSQL schema (idempotent DDL)...');
  await initDb();
  console.log('[migrate] Schema deployment complete.');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[migrate] Failed:', message);
  process.exit(1);
});
