#!/usr/bin/env bash
# GeistDesk Cloud Agent — repository bootstrap (idempotent).
# Installs system + Node dependencies and materializes local dev config.
set -euo pipefail
cd "$(dirname "$0")/.."

# ---------------------------------------------------------------------------
# System dependencies: PostgreSQL 16 + pgvector (the app requires Postgres;
# pgvector powers the RAG KnowledgeEmbedding store).
# ---------------------------------------------------------------------------
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    postgresql-16 postgresql-16-pgvector
fi

# ---------------------------------------------------------------------------
# Node dependencies.
# ---------------------------------------------------------------------------
npm install

# ---------------------------------------------------------------------------
# Local dev environment file (never overwrite an existing one). Secrets are
# generated once; .env is gitignored so nothing sensitive is committed.
# ---------------------------------------------------------------------------
if [ ! -f .env ]; then
  gen() { node -e "console.log(require('crypto').randomBytes($1).toString('hex'))"; }
  cat > .env <<EOF
# Auto-generated local dev config for Cloud Agent (gitignored).
NODE_ENV=development
PORT=3000
PUBLIC_APP_URL=http://localhost:3000

JWT_SECRET=$(gen 48)
VAULT_ENCRYPTION_KEY=$(gen 32)
AI_SECRETS_KEY=$(gen 32)
MASTER_KEY_SALT=$(gen 24)
INBOUND_MAIL_WEBHOOK_SECRET=$(gen 32)

# Showcase demo login (non-production only).
ENABLE_DEMO_LOGIN=true
VITE_ENABLE_DEMO_LOGIN=true

# Writable storage paths for KB documents / external sources.
DOCUMENT_STORAGE_DIR=$PWD/.data/documents
KB_SOURCES_ROOT=$PWD/.data/sources

# Local PostgreSQL (sslmode=disable → plaintext loopback).
DATABASE_URL=postgresql://geist_user:geist_password@127.0.0.1:5432/geistdesk_dev?sslmode=disable
EOF
  echo "[install] Generated .env with fresh dev secrets."
else
  echo "[install] Existing .env preserved."
fi

mkdir -p .data/documents .data/sources

# ---------------------------------------------------------------------------
# Bring up PostgreSQL and provision the database now so a prebuilt environment
# snapshot captures the initialized cluster + role + database + extension.
# ---------------------------------------------------------------------------
bash .cursor/start.sh

echo "[install] GeistDesk bootstrap complete."
