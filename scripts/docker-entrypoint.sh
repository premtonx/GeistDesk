#!/bin/sh
# GeistDesk production container entrypoint — zero-config one-command bootstrap:
#   1. Wait for PostgreSQL
#   2. Deploy schema (idempotent DDL via dist/migrate.cjs)
#   3. Seed German platform defaults (idempotent via dist/seed.cjs)
#   4. Start the Express gateway (PID 1 via exec)
set -eu

echo "[entrypoint] GeistDesk production bootstrap starting..."

if [ -z "${DATABASE_URL:-}" ] && [ -z "${PG_DATABASE_URL:-}" ]; then
  echo "[entrypoint] FATAL: DATABASE_URL (or PG_DATABASE_URL) is required." >&2
  exit 1
fi

echo "[entrypoint] Waiting for PostgreSQL..."
node <<'NODE'
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.PG_DATABASE_URL;
const pool = new Pool({ connectionString });

(async () => {
  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      await pool.end();
      console.log('[entrypoint] PostgreSQL is ready.');
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[entrypoint] PostgreSQL not ready (attempt ${attempt}/${maxAttempts}): ${message}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  console.error('[entrypoint] FATAL: PostgreSQL did not become ready in time.');
  process.exit(1);
})();
NODE

echo "[entrypoint] Step 1/3 — deploying database schema (npm run db:deploy:prod)..."
npm run db:deploy:prod

echo "[entrypoint] Step 2/3 — running idempotent platform seed (npm run seed:prod)..."
npm run seed:prod

echo "[entrypoint] Step 3/3 — starting application server (node dist/server.cjs)..."
exec node dist/server.cjs
