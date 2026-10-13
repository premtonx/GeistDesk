#!/usr/bin/env bash
# GeistDesk turnkey installer — Ubuntu/Debian (and most Docker hosts).
#
#   curl -fsSL https://raw.githubusercontent.com/premtonx/GeistDesk/main/install.sh | bash
#
# Or from a git clone:
#   ./install.sh
#   ./install.sh --yes
set -euo pipefail

REPO_URL="${GEISTDESK_REPO_URL:-https://github.com/premtonx/GeistDesk.git}"
REPO_BRANCH="${GEISTDESK_REPO_BRANCH:-main}"
INSTALL_DIR="${GEISTDESK_INSTALL_DIR:-}"
ASSUME_YES=0

log() { printf '\n\033[1;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWARN:\033[0m %s\n' "$*" >&2; }
err() { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; }

usage() {
  cat <<'EOF'
Usage: install.sh [options]

  --yes, -y     Non-interactive (defaults: localhost, keep existing .env secrets)
  --dir PATH    Install / use repository at PATH (default: ./GeistDesk or $PWD)
  --help, -h    Show help

Environment:
  PUBLIC_APP_URL / DOMAIN   Pre-set public URL or hostname (skips prompt)
  GEISTDESK_INSTALL_DIR     Same as --dir
  GEISTDESK_REPO_URL        Git clone URL when bootstrapping from curl|bash
  GEISTDESK_SKIP_CLONE=1    Do not clone; require an existing checkout
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y) ASSUME_YES=1; shift ;;
    --dir) INSTALL_DIR="${2:-}"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) err "Unknown option: $1"; usage; exit 1 ;;
  esac
done

rand_hex() {
  local bytes="${1:-16}"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$bytes"
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c "import secrets; print(secrets.token_hex(${bytes}))"
  else
    err "Need openssl or python3 to generate secrets."
    exit 1
  fi
}

ensure_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "Docker and Compose are available."
    return
  fi
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    return
  fi

  log "Docker not found — installing via get.docker.com (requires sudo)..."
  if [[ "$(id -u)" -ne 0 ]] && ! command -v sudo >/dev/null 2>&1; then
    err "Root or sudo is required to install Docker."
    exit 1
  fi
  local run=""
  if [[ "$(id -u)" -ne 0 ]]; then run="sudo"; fi
  curl -fsSL https://get.docker.com | $run sh
  $run systemctl enable --now docker 2>/dev/null || true
  if [[ "$(id -u)" -ne 0 ]]; then
    $run usermod -aG docker "$USER" 2>/dev/null || true
    warn "You may need to log out/in for docker group membership to apply."
  fi
  if ! docker compose version >/dev/null 2>&1; then
    err "Docker Compose plugin missing after install. Install docker-compose-plugin and retry."
    exit 1
  fi
}

resolve_repo_root() {
  # Already inside a GeistDesk checkout?
  if [[ -f "./docker-compose.yml" && -f "./Dockerfile" && -f "./package.json" ]]; then
    pwd
    return
  fi
  if [[ -n "$INSTALL_DIR" ]]; then
    printf '%s\n' "$INSTALL_DIR"
    return
  fi
  if [[ -n "${GEISTDESK_INSTALL_DIR:-}" ]]; then
    printf '%s\n' "$GEISTDESK_INSTALL_DIR"
    return
  fi
  # curl|bash typically starts in $HOME
  printf '%s\n' "${HOME%/}/GeistDesk"
}

ensure_checkout() {
  local root="$1"
  if [[ -f "$root/docker-compose.yml" && -f "$root/Dockerfile" ]]; then
    log "Using existing checkout at $root"
    return
  fi
  if [[ "${GEISTDESK_SKIP_CLONE:-0}" == "1" ]]; then
    err "No GeistDesk checkout at $root (GEISTDESK_SKIP_CLONE=1)."
    exit 1
  fi
  log "Cloning $REPO_URL (branch $REPO_BRANCH) → $root"
  mkdir -p "$(dirname "$root")"
  if [[ -d "$root/.git" ]]; then
    git -C "$root" fetch origin "$REPO_BRANCH"
    git -C "$root" checkout "$REPO_BRANCH"
    git -C "$root" pull --ff-only origin "$REPO_BRANCH" || true
  else
    git clone --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$root"
  fi
}

env_get() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  python3 - "$file" "$key" <<'PY'
import sys
path, key = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as fh:
    for raw in fh:
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.partition("=")
        if name.strip() == key:
            print(value.strip().strip("'").strip('"'))
            break
PY
}

env_set() {
  local file="$1" key="$2" value="$3"
  python3 - "$file" "$key" "$value" <<'PY'
import sys
path, key, value = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    lines = open(path, encoding="utf-8").read().splitlines()
except FileNotFoundError:
    lines = []
out, found = [], False
for line in lines:
    stripped = line.strip()
    if stripped.startswith("#") or "=" not in stripped:
        out.append(line)
        continue
    name = stripped.split("=", 1)[0].strip()
    if name == key:
        out.append(f"{key}={value}")
        found = True
    else:
        out.append(line)
if not found:
    if out and out[-1] != "":
        out.append("")
    out.append(f"{key}={value}")
open(path, "w", encoding="utf-8").write("\n".join(out) + "\n")
PY
}

is_placeholder_secret() {
  local value="${1:-}"
  [[ -z "$value" ]] && return 0
  case "$value" in
    replace_with_*|changeme*|change-me*|geist_password|your_*|TODO*|xxx*|XXXX*)
      return 0
      ;;
  esac
  return 1
}

ensure_secret() {
  local file="$1" key="$2" bytes="$3"
  local current
  current="$(env_get "$file" "$key")"
  # Idempotent: do not overwrite operator-provided secrets.
  if ! is_placeholder_secret "$current"; then
    return
  fi
  env_set "$file" "$key" "$(rand_hex "$bytes")"
}

normalize_public_url() {
  local raw="${1:-}"
  raw="$(printf '%s' "$raw" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  if [[ -z "$raw" || "$raw" == "localhost" ]]; then
    printf '%s\n' "http://localhost"
    return
  fi
  case "$raw" in
    http://*|https://*) printf '%s\n' "${raw%/}" ;;
    localhost:*|127.0.0.1|127.0.0.1:*) printf '%s\n' "http://${raw}" ;;
    # Bare IPv4 — HTTP only (Let's Encrypt does not issue for raw IPs).
    [0-9]*.[0-9]*.[0-9]*.[0-9]*) printf '%s\n' "http://${raw}" ;;
    *) printf '%s\n' "https://${raw%/}" ;;
  esac
}

hostname_from_url() {
  python3 - "$1" <<'PY'
from urllib.parse import urlparse
import sys
print(urlparse(sys.argv[1]).hostname or "localhost")
PY
}

prompt_domain() {
  local suggested answer
  if [[ -n "${PUBLIC_APP_URL:-}" ]]; then
    normalize_public_url "$PUBLIC_APP_URL"
    return
  fi
  if [[ -n "${DOMAIN:-}" ]]; then
    normalize_public_url "$DOMAIN"
    return
  fi
  suggested="localhost"
  if [[ "$ASSUME_YES" -eq 1 || ! -t 0 ]]; then
    normalize_public_url "$suggested"
    return
  fi
  printf '\nPublic domain or IP for GeistDesk [%s]\n' "$suggested" >&2
  printf '  Examples: localhost   desk.example.com   203.0.113.10\n' >&2
  printf '  Domain: ' >&2
  read -r answer || true
  if [[ -z "${answer:-}" ]]; then
    normalize_public_url "$suggested"
  else
    normalize_public_url "$answer"
  fi
}

probe_inference() {
  local url="${LOCAL_EMBEDDING_ENDPOINT:-http://host.docker.internal:8080}"
  # From the host, try localhost:8080 as a stand-in for host.docker.internal.
  local probe="http://127.0.0.1:8080"
  if curl -fsS --connect-timeout 2 "${probe}/v1/models" >/dev/null 2>&1 \
    || curl -fsS --connect-timeout 2 "${probe}/models" >/dev/null 2>&1 \
    || curl -fsS --connect-timeout 2 "${probe}/health" >/dev/null 2>&1; then
    printf 'reachable (%s → container %s)\n' "$probe" "$url"
  else
    printf 'not detected on host :8080 (set LOCAL_EMBEDDING_ENDPOINT or a cloud API key later)\n'
  fi
}

main() {
  log "GeistDesk turnkey installer"
  ensure_docker

  local root
  root="$(resolve_repo_root)"
  ensure_checkout "$root"
  cd "$root"

  if [[ ! -f docker-compose.yml || ! -f Dockerfile || ! -f deploy/Caddyfile ]]; then
    err "Checkout at $root is missing deploy files."
    exit 1
  fi

  local env_file="$root/.env"
  if [[ ! -f "$env_file" ]]; then
    if [[ -f "$root/.env.example" ]]; then
      cp "$root/.env.example" "$env_file"
      log "Created .env from .env.example"
    else
      : >"$env_file"
      log "Created empty .env"
    fi
  else
    log "Preserving existing .env (secrets are never overwritten)"
  fi

  local public_url domain
  public_url="$(prompt_domain)"
  domain="$(hostname_from_url "$public_url")"

  ensure_secret "$env_file" POSTGRES_PASSWORD 16
  ensure_secret "$env_file" JWT_SECRET 48
  ensure_secret "$env_file" MASTER_KEY_SALT 24
  ensure_secret "$env_file" VAULT_ENCRYPTION_KEY 32
  ensure_secret "$env_file" AI_SECRETS_KEY 32
  ensure_secret "$env_file" INBOUND_MAIL_WEBHOOK_SECRET 32
  ensure_secret "$env_file" GRAPH_CLIENT_STATE_SECRET 32

  local pg_user pg_db pg_pass salt
  pg_user="$(env_get "$env_file" POSTGRES_USER)"
  pg_db="$(env_get "$env_file" POSTGRES_DB)"
  pg_pass="$(env_get "$env_file" POSTGRES_PASSWORD)"
  pg_user="${pg_user:-geist_user}"
  pg_db="${pg_db:-geistdesk_prod}"

  env_set "$env_file" POSTGRES_USER "$pg_user"
  env_set "$env_file" POSTGRES_DB "$pg_db"
  env_set "$env_file" PUBLIC_APP_URL "$public_url"
  env_set "$env_file" DOMAIN "$domain"
  env_set "$env_file" DOMAIN_NAME "$domain"
  env_set "$env_file" PUBLIC_HOSTNAME "$domain"
  env_set "$env_file" NODE_ENV production
  env_set "$env_file" PORT 5000
  if [[ -z "$(env_get "$env_file" LOCAL_EMBEDDING_ENDPOINT)" ]]; then
    env_set "$env_file" LOCAL_EMBEDDING_ENDPOINT "http://host.docker.internal:8080"
  fi
  env_set "$env_file" GEISTDESK_DATABASE_URL \
    "postgresql://${pg_user}:${pg_pass}@geistdesk-db:5432/${pg_db}?sslmode=disable"

  salt="$(env_get "$env_file" MASTER_KEY_SALT)"
  if [[ -n "$salt" && -z "$(env_get "$env_file" VITE_MASTER_KEY_SALT)" ]]; then
    env_set "$env_file" VITE_MASTER_KEY_SALT "$salt"
  fi

  # Non-root hosts often cannot bind :25 — fall back to 2525 when not root and default.
  if [[ "$(id -u)" -ne 0 && "$(env_get "$env_file" INBOUND_SMTP_HOST_PORT)" == "" ]]; then
    env_set "$env_file" INBOUND_SMTP_HOST_PORT 2525
    env_set "$env_file" INBOUND_SMTP_PORT 2525
    warn "Non-root install: inbound SMTP published on host port 2525 (not 25)."
  fi

  log "Building and starting containers (db, backend, frontend, caddy)..."
  # frontend/caddy are behind Compose profile `caddy` so Traefik hosts stay clean.
  docker compose -f "$root/docker-compose.yml" --env-file "$env_file" --profile caddy pull caddy || true
  docker compose -f "$root/docker-compose.yml" --env-file "$env_file" --profile caddy up --build -d

  log "Waiting for API health..."
  local ok=0 i
  for i in $(seq 1 40); do
    if curl -fsS --connect-timeout 2 "http://127.0.0.1/api/health" >/dev/null 2>&1 \
      || curl -fsS --connect-timeout 2 "${public_url}/api/health" >/dev/null 2>&1; then
      ok=1
      break
    fi
    sleep 3
  done

  local inference
  inference="$(probe_inference)"

  printf '\n'
  printf '╔══════════════════════════════════════════════════════════╗\n'
  printf '║           GeistDesk is up (turnkey compose)              ║\n'
  printf '╠══════════════════════════════════════════════════════════╣\n'
  printf '║  URL:        %-44s ║\n' "$public_url"
  printf '║  Health:     %-44s ║\n' "$([[ "$ok" -eq 1 ]] && echo OK || echo pending — check docker compose logs)"
  printf '║  Inference:  %-44s ║\n' "$inference"
  printf '║  Data dir:   %-44s ║\n' "$root"
  printf '╚══════════════════════════════════════════════════════════╝\n'
  printf '\nUseful commands:\n'
  printf '  cd %s\n' "$root"
  printf '  docker compose logs -f geistdesk-gateway\n'
  printf '  docker compose ps\n'
  printf '\nOpen %s and complete the first-run onboarding wizard.\n' "$public_url"
}

main "$@"
