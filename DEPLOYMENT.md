# GeistDesk Deployment Guide

Production bootstrapping for GeistDesk: **Node.js 24 / Alpine**, **PostgreSQL 15 + pgvector**, and a reverse proxy (**Traefik** recommended, **Caddy** optional).

---

## Traefik (recommended)

Use this when Traefik already terminates TLS on the host.

1. Ensure an external Docker network exists (default name `traefik-public`):

   ```bash
   docker network create traefik-public  # skip if it already exists
   ```

2. Configure `.env` (from `.env.example` + `./setup.sh --yes`):

   ```bash
   COMPOSE_FILE=docker-compose.yml:docker-compose.traefik.yml
   DOMAIN_NAME=desk.example.com
   PUBLIC_APP_URL=https://desk.example.com
   TRAEFIK_NETWORK=traefik-public
   TRAEFIK_ENTRYPOINT=websecure
   TRAEFIK_CERTRESOLVER=myresolver
   ROUTER_NAME=geistdesk
   ```

3. Launch:

   ```bash
   docker compose up -d
   ```

   Equivalent explicit form:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d \
     geistdesk-db geistdesk-gateway
   ```

| Service | Role | Published ports |
|---------|------|-----------------|
| `geistdesk-db` | `pgvector/pgvector:pg15` | none (internal) |
| `geistdesk-gateway` | Express API + SPA (`:5000`) | SMTP only (`INBOUND_SMTP_HOST_PORT`, default `25`) |

Traefik routes `Host(${DOMAIN_NAME})` on `websecure` with certresolver `myresolver` to gateway port `5000`. Postgres data persists in volume `geistdesk_db_data` (**pg15** — do not bump the major version without dump/restore).

---

## Caddy turnkey (no existing proxy)

```bash
curl -fsSL https://raw.githubusercontent.com/premtonx/GeistDesk/main/install.sh | bash
# or from a clone:
./install.sh
./install.sh --yes
```

`install.sh` installs Docker if needed, writes `.env`, and runs:

```bash
docker compose -f docker-compose.yml --profile caddy up --build -d
```

| Service | Role | Host ports |
|---------|------|------------|
| `geistdesk-db` | Postgres 15 + pgvector | none |
| `geistdesk-gateway` | API | optional SMTP |
| `frontend` | Nginx static build | internal |
| `caddy` | TLS reverse proxy | `80`, `443` |

Legacy helper (delegates to `install.sh` unless `COMPOSE_FILE` is set):

```bash
./setup.sh --yes
```

---

## Container entrypoint

On every gateway start (`scripts/docker-entrypoint.sh`):

| Step | What it does |
|------|----------------|
| 1 | Wait for PostgreSQL (retries until `DATABASE_URL` accepts connections) |
| 2 | `npm run db:deploy:prod` — idempotent DDL via `dist/migrate.cjs` / `initDb()` |
| 3 | `npm run seed:prod` — platform defaults (demo fixtures only when demo flags allow) |
| 4 | `exec node dist/server.cjs` — listen on port **5000** |

Schema management is **not** Prisma Migrate for the document store. Prisma is used for the pgvector `KnowledgeEmbedding` model; document collections live in `geistdesk_documents` (JSONB).

---

## Required secrets

| Variable | Notes |
|----------|--------|
| `JWT_SECRET` | `openssl rand -hex 48` |
| `VAULT_ENCRYPTION_KEY` | `openssl rand -hex 32` |
| `AI_SECRETS_KEY` | `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | Compose maps `GEISTDESK_DATABASE_URL` → container `DATABASE_URL` |
| `MASTER_KEY_SALT` / `VITE_MASTER_KEY_SALT` | Keep in sync for client/server KDF |

Full template: [`.env.example`](./.env.example). `./setup.sh` fills missing or `replace_with_*` placeholders without overwriting real secrets.

---

## Native MCP

1. Admin Hub → **Mail & Schnittstellen** → **API & MCP** → enable
2. Create a `gdk_…` API token
3. Point clients at `https://<DOMAIN_NAME>/api/mcp` with `Authorization: Bearer gdk_…`

See the [README MCP section](./README.md#model-context-protocol-mcp).

---

## Operations cheat sheet

```bash
# Validate merged compose (with Traefik overlay)
COMPOSE_FILE=docker-compose.yml:docker-compose.traefik.yml docker compose config

# Logs
docker compose logs -f geistdesk-gateway

# Stop
docker compose down

# Installer self-check (no Docker required for most checks)
./setup.sh --check
```

### Health

- App: `GET https://<host>/api/health` (or your health route)
- DB: Compose healthcheck via `pg_isready` inside `geistdesk-db`

### CI

GitHub Actions workflow `.github/workflows/deploy.yml` runs the strict build gate on pushes to `main`, then deploys using the same compose model.

---

## Bare metal (advanced)

```bash
npm ci
npm run build
export DATABASE_URL=postgresql://…
export JWT_SECRET=…
export VAULT_ENCRYPTION_KEY=…
export AI_SECRETS_KEY=…
npm run prod:start   # migrate + seed + server
```

Prefer Docker Compose for production parity with Traefik/Caddy networking.
