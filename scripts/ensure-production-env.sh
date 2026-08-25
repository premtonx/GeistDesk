#!/usr/bin/env bash
# Ensures required production security variables exist in a host .env file.
# Existing values are never overwritten.
set -euo pipefail

ENV_FILE="${1:-.env}"
touch "$ENV_FILE"

set_env_default() {
  local key="$1"
  local value="$2"
  if ! grep -q "^${key}=" "$ENV_FILE"; then
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

set_env_if_missing() {
  local key="$1"
  if ! grep -q "^${key}=" "$ENV_FILE"; then
    echo "${key}=$(openssl rand -hex 32)" >> "$ENV_FILE"
  fi
}

set_env_default NODE_ENV production
set_env_default BETA_AUTO_ADMIN false
set_env_default ALLOW_PUBLIC_REGISTRATION false
set_env_default ENABLE_SANDBOX false
set_env_if_missing GRAPH_CLIENT_STATE_SECRET
set_env_if_missing INBOUND_MAIL_WEBHOOK_SECRET

if ! grep -q "^JWT_SECRET=" "$ENV_FILE"; then
  echo "ERROR: JWT_SECRET is missing from ${ENV_FILE}" >&2
  exit 1
fi

if ! grep -q "^VAULT_ENCRYPTION_KEY=" "$ENV_FILE"; then
  echo "ERROR: VAULT_ENCRYPTION_KEY is missing from ${ENV_FILE}" >&2
  exit 1
fi

if ! grep -q "^AI_SECRETS_KEY=" "$ENV_FILE"; then
  echo "ERROR: AI_SECRETS_KEY is missing from ${ENV_FILE}" >&2
  exit 1
fi

echo "Production env verified: ${ENV_FILE}"
