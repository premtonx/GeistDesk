#!/usr/bin/env bash
# GeistDesk Cloud Agent — per-boot service startup (idempotent).
# Starts PostgreSQL and ensures the app role/database/extension exist.
set -euo pipefail
cd "$(dirname "$0")/.."

# Start the PostgreSQL 16 cluster (no-op if already running).
sudo pg_ctlcluster 16 main start 2>/dev/null || true

# Wait for the server to accept connections.
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q 2>/dev/null; then
    break
  fi
  sleep 1
done

# Ensure the login role exists.
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='geist_user'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE ROLE geist_user LOGIN PASSWORD 'geist_password';"
fi

# Ensure the database exists.
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='geistdesk_dev'" | grep -q 1; then
  sudo -u postgres createdb -O geist_user geistdesk_dev
fi

# Ensure schema grants + pgvector extension (the app also self-heals these).
sudo -u postgres psql -d geistdesk_dev -c "GRANT ALL ON SCHEMA public TO geist_user;" >/dev/null
sudo -u postgres psql -d geistdesk_dev -c "CREATE EXTENSION IF NOT EXISTS vector;" >/dev/null

echo "[start] PostgreSQL ready; database 'geistdesk_dev' provisioned."
