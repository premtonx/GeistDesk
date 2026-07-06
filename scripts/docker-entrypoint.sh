#!/bin/sh
# GeistDesk production container entrypoint.
# 1. Wait for PostgreSQL to accept connections
# 2. Run idempotent platform seed (users/tickets/defaults)
# 3. Start the Express gateway
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

echo "[entrypoint] Running idempotent database seed (node dist/seed.cjs)..."
node dist/seed.cjs

echo "[entrypoint] Starting application server (node dist/server.cjs)..."
exec node dist/server.cjs
