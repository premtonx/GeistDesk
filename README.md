# GeistDesk

**Enterprise sovereign helpdesk** — ticketing, knowledge base (RAG), credential vaults, and a detachable AI orchestrator you can run fully on your own infrastructure.

GeistDesk is a full-stack TypeScript app (**React 19 / Vite** + **Express on Node.js 24**) backed by **PostgreSQL 15 with pgvector**. Production deploys sit behind **Traefik** (or optional Caddy) with Let’s Encrypt TLS.

License: [AGPL-3.0](./LICENSE)

---

## Features

| Area | What you get |
|------|----------------|
| **Ticketing** | Multi-channel inbox, triage, internal notes, AI drafts, checklists |
| **GeistKB + RAG** | Articles/SOPs with hybrid search (pgvector + FTS) |
| **AI Orchestrator** | Local (Ollama) or cloud providers, PII scrubbing, feature routing |
| **GeistVault / Exchange** | Server-side encrypted secrets, audited reveals, dropzones |
| **Native MCP** | Streamable HTTP MCP at `/api/mcp` for Cursor, Claude Desktop, Windsurf |
| **Admin Hub** | Mail & integrations, RAG pipeline, governance, workforce / RBAC |

---

## Quickstart (1-command launch)

### Traefik (recommended production path)

Prerequisites: Docker Compose v2, an existing Traefik stack with an external network named `traefik-public` (override with `TRAEFIK_NETWORK`), and a DNS record pointing at your host.

```bash
git clone https://github.com/premtonx/GeistDesk.git
cd GeistDesk
cp .env.example .env

# Generate secrets + sync DB URL (does not overwrite existing secrets)
./setup.sh --yes
# Or manually:
#   openssl rand -hex 48   → JWT_SECRET
#   openssl rand -hex 32   → VAULT_ENCRYPTION_KEY, AI_SECRETS_KEY, …

# Enable Traefik overlay (uncomment in .env or export):
# COMPOSE_FILE=docker-compose.yml:docker-compose.traefik.yml

# Set your public hostname
# DOMAIN_NAME=desk.example.com
# PUBLIC_APP_URL=https://desk.example.com

docker compose up -d
```

Open `https://<DOMAIN_NAME>` and complete the Day-0 onboarding wizard.

### Turnkey Caddy (no existing reverse proxy)

```bash
./install.sh
# non-interactive:
./install.sh --yes
```

This builds the stack with the `caddy` Compose profile (ports 80/443) when you are not using Traefik.

### Local development

```bash
cp .env.example .env
./setup.sh --yes          # fills secrets; skip compose if you prefer
# Point GEISTDESK_DATABASE_URL at a local Postgres 15 + pgvector instance
npm ci
npm run db:migrate
npm run seed:demo:dev     # optional
npm run dev               # Vite + Express via tsx (see package.json)
```

PostgreSQL is **required** — there is no local JSON file database fallback.

---

## Production architecture

```
                    ┌─────────────────────┐
   Internet ───────►│ Traefik (websecure) │  TLS via certresolver=myresolver
                    │ network: traefik-public
                    └──────────┬──────────┘
                               │ Host(`${DOMAIN_NAME}`)
                               ▼
                    ┌─────────────────────┐
                    │ geistdesk-gateway   │  Node 24 / Alpine · Express :5000
                    │ (API + SPA dist/)   │  MCP · /api/mcp
                    └──────────┬──────────┘
                               │ geistdesk-internal
                               ▼
                    ┌─────────────────────┐
                    │ geistdesk-db        │  pgvector/pgvector:pg15
                    │ volume: geistdesk_db_data
                    └─────────────────────┘
```

| Piece | Detail |
|-------|--------|
| **Compose** | `docker-compose.yml` + optional `docker-compose.traefik.yml` |
| **COMPOSE_FILE** | Set `COMPOSE_FILE=docker-compose.yml:docker-compose.traefik.yml` in `.env` so `docker compose up -d` merges both files |
| **Traefik** | Labels use `TRAEFIK_ENTRYPOINT` (default `websecure`) and `TRAEFIK_CERTRESOLVER` (default `myresolver`) |
| **Network** | Gateway joins external `traefik-public` (name configurable) |
| **Persistence** | Postgres data in Docker volume `geistdesk_db_data` (pg15 — do not jump major versions without dump/restore) |
| **Boot** | Entrypoint waits for DB → migrates schema → seeds defaults → starts `dist/server.cjs` |

See [DEPLOYMENT.md](./DEPLOYMENT.md) for entrypoint details, CI notes, and the Caddy profile.

---

## Model Context Protocol (MCP)

GeistDesk embeds a native MCP server (Streamable HTTP / SSE) so external agents can call GeistKB, tickets, and vault tools with scoped API tokens.

### Enable

1. Sign in as **SYSTEM_ADMIN**
2. Open **Admin Hub → Mail & Schnittstellen → API & MCP**
3. Toggle **Enable MCP server**
4. Optionally set custom system instructions
5. Create an API token (`gdk_…`) and copy it once

### Connect Cursor / Claude Desktop / Windsurf

**URL:** `https://<your-domain>/api/mcp`  
**Auth:** `Authorization: Bearer gdk_<your-token>`

Cursor `mcp.json` / Claude Desktop config:

```json
{
  "mcpServers": {
    "geistdesk": {
      "url": "https://desk.example.com/api/mcp",
      "headers": {
        "Authorization": "Bearer gdk_YOUR_API_TOKEN"
      }
    }
  }
}
```

| Tool | Purpose |
|------|---------|
| `geistkb_search` / `geistkb_get_article` / `geistkb_create_article` | RAG search & KB writes |
| `tickets_list` / `tickets_get` / `tickets_update_status` | Ticket ops + audit |
| `vault_search_secrets` | Metadata only (no plaintext) |
| `vault_get_secret` | Decrypt with mandatory reason + immutable audit |

Scopes follow the token’s role (`vault:reveal` requires admin). MCP is **disabled** until enabled in Admin Hub.

---

## Configuration

All runtime knobs live in **`.env`** (never commit it). Start from [`.env.example`](./.env.example).

| Required | Purpose | Generate |
|----------|---------|----------|
| `JWT_SECRET` | Session tokens | `openssl rand -hex 48` |
| `VAULT_ENCRYPTION_KEY` | Exchange/vault at-rest crypto | `openssl rand -hex 32` |
| `AI_SECRETS_KEY` | Provider API key encryption | `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | Database password | `openssl rand -hex 16` |
| `GEISTDESK_DATABASE_URL` | Postgres DSN used by the gateway | synced by `./setup.sh` |

`./setup.sh` copies `.env.example` if needed and **idempotently fills missing or placeholder secrets** without overwriting real values you already set.

---

## Project layout

```
├── docker-compose.yml           # Postgres + gateway (+ optional Caddy profile)
├── docker-compose.traefik.yml   # Traefik labels / external network
├── setup.sh / install.sh        # Env bootstrap & turnkey launchers
├── server.ts                    # Express entry (dev + bundled prod)
├── src/mcp/                     # Native MCP tools & server factory
├── src/routes/mcpRoutes.ts      # /api/mcp transport + auth
├── prisma/                      # pgvector KnowledgeEmbedding model
└── docs/                        # Extra references (features, security)
```

---

## Documentation

| Doc | Contents |
|-----|----------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production boot, Traefik/Caddy, migrations, ops |
| [docs/FEATURES.md](./docs/FEATURES.md) | Feature registry (modules & routes) |
| [docs/SECURITY.md](./docs/SECURITY.md) | Access-control invariants & test cases |
| [`.env.example`](./.env.example) | Full environment template with comments |

---

## License

GeistDesk is free software under the **GNU Affero General Public License v3.0**. See [LICENSE](./LICENSE).
