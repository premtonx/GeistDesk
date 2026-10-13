# GeistDesk — Deployment

Production guide for the **Sovereign IT Operations Platform**: Node.js 24 / Alpine, PostgreSQL 15 + pgvector, Traefik (recommended) or Caddy.

Product overview and MCP setup: [README.md](./README.md).

---

## Traefik (recommended)

```bash
docker network create traefik-public   # if needed

# .env essentials
COMPOSE_FILE=docker-compose.yml:docker-compose.traefik.yml
DOMAIN_NAME=desk.example.com
PUBLIC_APP_URL=https://desk.example.com
TRAEFIK_NETWORK=traefik-public
TRAEFIK_ENTRYPOINT=websecure
TRAEFIK_CERTRESOLVER=myresolver
ROUTER_NAME=geistdesk

./setup.sh --yes
docker compose up -d
```

| Service | Role | Ports |
|---------|------|-------|
| `geistdesk-db` | `pgvector/pgvector:pg15` | internal |
| `geistdesk-gateway` | API + SPA (`:5000`) | SMTP via `INBOUND_SMTP_HOST_PORT` (default `25`) |

TLS: Traefik `Host(${DOMAIN_NAME})` → gateway `:5000` with certresolver `myresolver`.  
Data: Docker volume `geistdesk_db_data` (**stay on pg15** unless you dump/restore).

---

## Caddy turnkey

```bash
curl -fsSL https://raw.githubusercontent.com/premtonx/GeistDesk/main/install.sh | bash
# or: ./install.sh --yes
```

Runs `docker compose --profile caddy up --build -d` (ports 80/443). Use when no Traefik exists. `./setup.sh` delegates here unless `COMPOSE_FILE` is set.

---

## Container boot

Entrypoint (`scripts/docker-entrypoint.sh`):

1. Wait for Postgres  
2. `npm run db:deploy:prod` — idempotent DDL  
3. `npm run seed:prod` — platform defaults  
4. `node dist/server.cjs` on port **5000**

Document store: `geistdesk_documents` (JSONB). Prisma covers the pgvector `KnowledgeEmbedding` model.

---

## Secrets

| Variable | Generate |
|----------|----------|
| `JWT_SECRET` | `openssl rand -hex 48` |
| `VAULT_ENCRYPTION_KEY` | `openssl rand -hex 32` |
| `AI_SECRETS_KEY` | `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | `openssl rand -hex 16` |
| `MASTER_KEY_SALT` / `VITE_MASTER_KEY_SALT` | keep identical |

See [`.env.example`](./.env.example). Never commit `.env`.

---

## Ops

```bash
COMPOSE_FILE=docker-compose.yml:docker-compose.traefik.yml docker compose config
docker compose logs -f geistdesk-gateway
docker compose down
./setup.sh --check
```

CI: `.github/workflows/deploy.yml` on `main`.

### Bare metal

```bash
npm ci && npm run build
export DATABASE_URL=… JWT_SECRET=… VAULT_ENCRYPTION_KEY=… AI_SECRETS_KEY=…
npm run prod:start
```
