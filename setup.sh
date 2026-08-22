#!/usr/bin/env bash
# GeistDesk zero-config installer.
# Creates .env from secure defaults, optionally prompts for a public domain,
# then starts the stack with `docker compose up --build -d`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

COMPOSE_FILE="${ROOT}/docker-compose.yml"
ENV_FILE="${ROOT}/.env"
ENV_EXAMPLE="${ROOT}/.env.example"

ASSUME_YES=0
CHECK_ONLY=0
SKIP_COMPOSE="${GEISTDESK_SKIP_COMPOSE:-0}"

usage() {
  cat <<'EOF'
Usage: ./setup.sh [options]

  Interactive / zero-config installer for GeistDesk.

  --yes, -y     Non-interactive (keep existing .env values; use localhost if unset)
  --check       Validate compose, Dockerfile (clean-clone build), and this script
  --help, -h    Show this help

Environment:
  GEISTDESK_SKIP_COMPOSE=1   Write/update .env but do not run docker compose
  PUBLIC_APP_URL             Pre-set the public URL (skips the domain prompt)
EOF
}

log() { printf '%s\n' "$*"; }
err() { printf 'ERROR: %s\n' "$*" >&2; }

rand_hex() {
  local bytes="${1:-16}"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$bytes"
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "import secrets; print(secrets.token_hex(${bytes}))"
    return
  fi
  err "Need openssl or python3 to generate secrets."
  exit 1
}

env_get() {
  local key="$1"
  [[ -f "$ENV_FILE" ]] || return 0
  python3 - "$ENV_FILE" "$key" <<'PY'
import sys
path, key = sys.argv[1], sys.argv[2]
try:
    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, _, value = line.partition("=")
            if name.strip() == key:
                print(value.strip().strip("'").strip('"'))
                break
except FileNotFoundError:
    pass
PY
}

env_set() {
  local key="$1"
  local value="$2"
  python3 - "$ENV_FILE" "$key" "$value" <<'PY'
import sys
path, key, value = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    with open(path, encoding="utf-8") as fh:
        lines = fh.read().splitlines()
except FileNotFoundError:
    lines = []
out = []
found = False
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
with open(path, "w", encoding="utf-8") as fh:
    fh.write("\n".join(out) + "\n")
PY
}

ensure_secret() {
  local key="$1"
  local bytes="$2"
  local current
  current="$(env_get "$key")"
  if [[ -n "$current" ]]; then
    return
  fi
  env_set "$key" "$(rand_hex "$bytes")"
}

normalize_public_url() {
  local raw="${1:-}"
  raw="$(printf '%s' "$raw" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  if [[ -z "$raw" ]]; then
    printf '%s\n' "http://localhost:3000"
    return
  fi
  case "$raw" in
    http://*|https://*)
      printf '%s\n' "${raw%/}"
      ;;
    localhost|localhost:*|127.0.0.1|127.0.0.1:*)
      printf '%s\n' "http://${raw}"
      ;;
    *)
      printf '%s\n' "https://${raw%/}"
      ;;
  esac
}

hostname_from_url() {
  local url="$1"
  python3 - "$url" <<'PY'
from urllib.parse import urlparse
import sys
parsed = urlparse(sys.argv[1])
print(parsed.hostname or "localhost")
PY
}

compose_has_container_name() {
  grep -nE '^[[:space:]]*container_name:' "$COMPOSE_FILE" || true
}

dockerfile_copies_host_dist() {
  local file="$1"
  [[ -f "$file" ]] || return 1
  python3 - "$file" <<'PY'
import re, sys
path = sys.argv[1]
host_copy = re.compile(r"^\s*COPY\s+(?!--from=)\S.*\bdist\b", re.IGNORECASE)
with open(path, encoding="utf-8") as fh:
    for i, line in enumerate(fh, 1):
        if line.lstrip().startswith("#"):
            continue
        if host_copy.search(line):
            print(f"{path}:{i}:{line.rstrip()}")
            sys.exit(0)
sys.exit(1)
PY
}

check_dockerfile_self_contained() {
  local failed=0
  local df="${ROOT}/Dockerfile"
  local df_multi="${ROOT}/Dockerfile.multistage"
  local dockerignore="${ROOT}/.dockerignore"

  if [[ ! -f "$df" ]]; then
    err "Missing ${df}"
    return 1
  fi
  if [[ ! -f "${ROOT}/prisma.config.ts" || ! -f "${ROOT}/prisma/schema.prisma" ]]; then
    err "prisma.config.ts and prisma/schema.prisma are required for prisma generate in Docker."
    failed=1
  fi

  if ! grep -qE '^FROM[[:space:]].+[[:space:]]AS[[:space:]]builder' "$df"; then
    err "Dockerfile must have a builder stage (FROM … AS builder)."
    failed=1
  fi
  if ! grep -qE '^FROM[[:space:]].+[[:space:]]AS[[:space:]]runner' "$df"; then
    err "Dockerfile must have a runner stage (FROM … AS runner)."
    failed=1
  fi
  if ! grep -qE 'prisma generate' "$df"; then
    err "Dockerfile builder must run prisma generate."
    failed=1
  fi
  if ! grep -q 'npm run build' "$df"; then
    err "Dockerfile builder must run npm run build to produce dist/."
    failed=1
  fi
  if ! grep -qE 'COPY --from=builder .*/dist' "$df"; then
    err "Dockerfile runner must COPY dist/ from the builder stage."
    failed=1
  fi
  if ! grep -qE 'COPY --from=builder .*/node_modules' "$df"; then
    err "Dockerfile runner must COPY production node_modules from the builder."
    failed=1
  fi
  if ! grep -q 'docker-entrypoint.sh' "$df"; then
    err "Dockerfile runner must copy scripts/docker-entrypoint.sh."
    failed=1
  fi

  local host_dist
  host_dist="$(dockerfile_copies_host_dist "$df" || true)"
  if [[ -n "$host_dist" ]]; then
    err "Dockerfile must not COPY host dist/ (breaks clean clones; dist/ is gitignored):"
    printf '%s\n' "$host_dist" >&2
    failed=1
  fi

  if [[ -f "$df_multi" ]]; then
    if ! grep -qE '^FROM[[:space:]].+[[:space:]]AS[[:space:]]builder' "$df_multi" \
      || ! grep -q 'npm run build' "$df_multi"; then
      err "Dockerfile.multistage must remain a full in-Docker source build."
      failed=1
    fi
  fi

  if [[ ! -f "$dockerignore" ]] || ! grep -qE '^dist$' "$dockerignore"; then
    err ".dockerignore must ignore host dist/ so the image builds from source."
    failed=1
  fi
  if [[ -f "$dockerignore" ]] && grep -qE '^Dockerfile(\.multistage)?$' "$dockerignore"; then
    err ".dockerignore must not exclude the Dockerfiles."
    failed=1
  fi

  if grep -qE 'dockerfile:[[:space:]]+' "$COMPOSE_FILE"; then
    if ! grep -qE 'dockerfile:[[:space:]]+Dockerfile$' "$COMPOSE_FILE"; then
      err "docker-compose.yml must build from the default multi-stage Dockerfile."
      failed=1
    fi
  fi

  return "$failed"
}

check_compose_sanitized() {
  local failed=0
  if [[ ! -f "$COMPOSE_FILE" ]]; then
    err "Missing ${COMPOSE_FILE}"
    return 1
  fi
  local names
  names="$(compose_has_container_name)"
  if [[ -n "$names" ]]; then
    err "docker-compose.yml still hardcodes container_name:"
    printf '%s\n' "$names" >&2
    failed=1
  fi
  if ! grep -q 'Host(`${DOMAIN_NAME:-localhost}`)' "$COMPOSE_FILE"; then
    err "Traefik Host rule must use Host(\`\${DOMAIN_NAME:-localhost}\`)."
    failed=1
  fi
  if ! grep -q '\${ROUTER_NAME:-geistdesk}' "$COMPOSE_FILE"; then
    err "Router names must use \${ROUTER_NAME:-geistdesk}."
    failed=1
  fi
  if ! grep -q '\${TRAEFIK_NETWORK:-traefik-public}' "$COMPOSE_FILE"; then
    err "Traefik network must use \${TRAEFIK_NETWORK:-traefik-public}."
    failed=1
  fi
  return "$failed"
}

ensure_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    return
  fi
  if [[ -f "$ENV_EXAMPLE" ]]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    log "Created .env from .env.example"
  else
    : > "$ENV_FILE"
    log "Created empty .env"
  fi
}

fill_secrets() {
  ensure_secret POSTGRES_PASSWORD 16
  ensure_secret JWT_SECRET 48
  ensure_secret MASTER_KEY_SALT 24
  ensure_secret VAULT_ENCRYPTION_KEY 32
  ensure_secret INBOUND_MAIL_WEBHOOK_SECRET 32

  local salt
  salt="$(env_get MASTER_KEY_SALT)"
  if [[ -n "$salt" && -z "$(env_get VITE_MASTER_KEY_SALT)" ]]; then
    env_set VITE_MASTER_KEY_SALT "$salt"
  fi
}

sync_database_url() {
  local user db password
  user="$(env_get POSTGRES_USER)"
  db="$(env_get POSTGRES_DB)"
  password="$(env_get POSTGRES_PASSWORD)"
  user="${user:-geist_user}"
  db="${db:-geistdesk_prod}"
  if [[ -z "$password" ]]; then
    return
  fi
  env_set GEISTDESK_DATABASE_URL \
    "postgresql://${user}:${password}@geistdesk-db:5432/${db}?sslmode=disable"
}

prompt_public_url() {
  local current suggested answer
  current="$(env_get PUBLIC_APP_URL)"
  if [[ -n "${PUBLIC_APP_URL:-}" ]]; then
    printf '%s\n' "$(normalize_public_url "$PUBLIC_APP_URL")"
    return
  fi
  if [[ -n "$current" ]]; then
    suggested="$current"
  else
    suggested="http://localhost:3000"
  fi
  if [[ "$ASSUME_YES" -eq 1 || ! -t 0 ]]; then
    printf '%s\n' "$(normalize_public_url "$suggested")"
    return
  fi
  printf '\nPublic URL for GeistDesk [%s]\n' "$suggested" >&2
  printf '  Examples: http://localhost:3000   desk.geistai.eu   https://desk.example.com\n' >&2
  printf '  Domain: ' >&2
  read -r answer || true
  if [[ -z "${answer:-}" ]]; then
    printf '%s\n' "$(normalize_public_url "$suggested")"
  else
    printf '%s\n' "$(normalize_public_url "$answer")"
  fi
}

apply_public_url() {
  local url="$1"
  local host
  host="$(hostname_from_url "$url")"
  env_set PUBLIC_APP_URL "$url"
  env_set DOMAIN_NAME "$host"
  env_set PUBLIC_HOSTNAME "$host"
  if [[ -z "$(env_get INBOUND_MAIL_FORWARD_DOMAIN)" ]]; then
    env_set INBOUND_MAIL_FORWARD_DOMAIN "$host"
  fi
  if [[ -z "$(env_get HOST_PORT)" ]]; then
    env_set HOST_PORT "3000"
  fi
  if [[ -z "$(env_get ROUTER_NAME)" ]]; then
    env_set ROUTER_NAME "geistdesk"
  fi
  if [[ -z "$(env_get TRAEFIK_NETWORK)" ]]; then
    env_set TRAEFIK_NETWORK "traefik-public"
  fi
}

ensure_traefik_network() {
  local network
  network="$(env_get TRAEFIK_NETWORK)"
  network="${network:-traefik-public}"
  if ! command -v docker >/dev/null 2>&1; then
    return
  fi
  if docker network inspect "$network" >/dev/null 2>&1; then
    return
  fi
  log "Creating Docker network ${network} (external Traefik attach)…"
  docker network create "$network" >/dev/null
}

compose_up() {
  if [[ "$SKIP_COMPOSE" == "1" ]]; then
    log "Skipping docker compose (GEISTDESK_SKIP_COMPOSE=1)."
    return
  fi
  if ! command -v docker >/dev/null 2>&1; then
    err "docker is not installed. Install Docker, then re-run ./setup.sh"
    exit 1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    err "docker compose is not available. Install Docker Compose v2."
    exit 1
  fi
  ensure_traefik_network
  log "Building from source inside Docker (host node_modules/ and dist/ are not required)…"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up --build -d
}

print_banner() {
  local url host
  url="$(env_get PUBLIC_APP_URL)"
  host="$(env_get DOMAIN_NAME)"
  url="${url:-http://localhost:3000}"
  host="${host:-localhost}"
  local display="$url"
  if [[ "$host" != "localhost" && "$host" != "127.0.0.1" ]]; then
    display="https://${host}"
  fi
  cat <<EOF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  GeistDesk is ready at ${display}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Compose file:  docker-compose.yml
  Environment:   .env   (never commit this file)
  Stop stack:    docker compose down
  Follow logs:   docker compose logs -f geistdesk-gateway

EOF
}

run_check() {
  local failed=0
  if [[ ! -x "$0" && ! -x "${ROOT}/setup.sh" ]]; then
    err "setup.sh is not executable (chmod +x setup.sh)."
    failed=1
  fi
  if ! check_compose_sanitized; then
    failed=1
  fi
  if ! check_dockerfile_self_contained; then
    failed=1
  fi
  if [[ ! -f "$ENV_EXAMPLE" ]]; then
    err "Missing .env.example"
    failed=1
  else
    for key in DOMAIN_NAME ROUTER_NAME TRAEFIK_NETWORK POSTGRES_PASSWORD JWT_SECRET MASTER_KEY_SALT VAULT_ENCRYPTION_KEY INBOUND_MAIL_WEBHOOK_SECRET; do
      if ! grep -qE "^${key}=" "$ENV_EXAMPLE"; then
        err ".env.example is missing ${key}"
        failed=1
      fi
    done
  fi
  if ! command -v python3 >/dev/null 2>&1; then
    err "python3 is required by setup.sh"
    failed=1
  fi
  bash -n "$0"
  log "setup.sh --check passed"
  return "$failed"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y) ASSUME_YES=1; shift ;;
    --check) CHECK_ONLY=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) err "Unknown option: $1"; usage; exit 1 ;;
  esac
done

if [[ "$CHECK_ONLY" -eq 1 ]]; then
  run_check
  exit $?
fi

if ! command -v python3 >/dev/null 2>&1; then
  err "python3 is required to manage .env safely."
  exit 1
fi

check_compose_sanitized
check_dockerfile_self_contained
ensure_env_file
fill_secrets
public_url="$(prompt_public_url)"
apply_public_url "$public_url"
sync_database_url
compose_up
print_banner
