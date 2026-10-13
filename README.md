# GeistDesk

**Sovereign IT Operations Platform**  
The Open-Source Standard for Secure IT Operations

Unify helpdesk, assets, credentials, knowledge, and AI orchestration in a sovereign self-hosted platform. **Keep your data, your rules.**

Self-hosted helpdesk, RAG-powered knowledge base, credential management, encrypted exchange, and local AI — on infrastructure you control.

| | |
|---|---|
| **Self-Hosted** | 100% data sovereignty |
| **AGPLv3** | Sovereign & open source |
| **Post-Quantum** | Hybrid ML-KEM-1024 + X25519 secret envelopes (NIST FIPS 203–aligned) |
| **AI PII Shield** | Privacy by design — redact before model egress |

Built with **React 19 / Vite**, **Express on Node.js 24**, **PostgreSQL 15 + pgvector**, and **Traefik** (or optional Caddy) for TLS.

---

## Core pillars

| Pillar | Focus |
|--------|--------|
| **Helpdesk** | Ticketing & workflows — multi-channel inbox, triage, AI drafts, checklists |
| **Assets** | Hardware & software — account coverage, CRM schemas, operational context |
| **Phantom Vault** | Secure secret exchange — GeistExchange / GeistVault, audited reveals, dropzones |
| **AI Orchestration** | Local AI with PII Shield — Ollama or cloud providers, feature routing, RAG |

Also included: **GeistKB** (knowledge + hybrid search), **Native MCP** at `/api/mcp`, and **Admin Hub** (mail, governance, workforce / RBAC).

---

## Sovereignty & security

**Sovereignty by design.** Keep operations inside your perimeter: local processing options, encrypted storage, scoped API tokens (`gdk_…`), and no requirement to ship tickets, vault material, or knowledge to a vendor SaaS control plane.

Aligned with regulated-industry expectations — structural practices relevant to **GDPR**, **HIPAA**, **ITAR**, and **ISO**-oriented controls (access isolation, audit trails, PII redaction, self-hosted residency). You remain the data controller; GeistDesk is the open runtime.

**Access-control invariants (summary):** ticket/message access is ownership- and role-scoped; closed tickets are terminal for non-admins; MCP vault reveal requires `vault:reveal` + a reason + immutable audit; API tokens are stored hashed (plaintext shown once).

---

## Quickstart

### Traefik (recommended)

Prerequisites: Docker Compose v2, external Traefik network `traefik-public`, DNS for your host.

```bash
git clone https://github.com/premtonx/GeistDesk.git
cd GeistDesk
cp .env.example .env
./setup.sh --yes

# Uncomment in .env (or export):
# COMPOSE_FILE=docker-compose.yml:docker-compose.traefik.yml
# DOMAIN_NAME=desk.example.com
# PUBLIC_APP_URL=https://desk.example.com

docker compose up -d
```

### Caddy (no existing reverse proxy)

```bash
./install.sh
# or: ./install.sh --yes
```

### Local development

```bash
cp .env.example .env && ./setup.sh --yes
# Point GEISTDESK_DATABASE_URL at Postgres 15 + pgvector
npm ci && npm run db:migrate && npm run dev
```

PostgreSQL is **required**. Full ops detail: [DEPLOYMENT.md](./DEPLOYMENT.md). Env template: [`.env.example`](./.env.example).

---

## Architecture

```
Internet → Traefik (websecure / myresolver / traefik-public)
              → geistdesk-gateway  (Node 24 · Express :5000 · MCP /api/mcp)
              → geistdesk-db       (pgvector/pgvector:pg15 · volume geistdesk_db_data)
```

Set `COMPOSE_FILE=docker-compose.yml:docker-compose.traefik.yml` so `docker compose up -d` merges the Traefik overlay.

---

## Native MCP

1. **Admin Hub → Mail & Schnittstellen → API & MCP** → enable  
2. Create a Bearer token (`gdk_…`)  
3. Connect clients to `https://<your-domain>/api/mcp`

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

| Tools | Area |
|-------|------|
| `geistkb_search`, `geistkb_get_article`, `geistkb_create_article` | Knowledge / RAG |
| `tickets_list`, `tickets_get`, `tickets_update_status` | Helpdesk |
| `vault_search_secrets`, `vault_get_secret` | Phantom Vault (metadata / audited reveal) |

---

## Configuration

| Required | Generate |
|----------|----------|
| `JWT_SECRET` | `openssl rand -hex 48` |
| `VAULT_ENCRYPTION_KEY` | `openssl rand -hex 32` |
| `AI_SECRETS_KEY` | `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | `openssl rand -hex 16` |

`./setup.sh` fills missing or `replace_with_*` placeholders without overwriting real secrets.

---

## Documentation

| File | Purpose |
|------|---------|
| [README.md](./README.md) | Product positioning, quickstart, MCP |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Traefik/Caddy production ops |
| [`.env.example`](./.env.example) | Full environment template |

---

## License

GNU Affero General Public License v3.0 — see [LICENSE](./LICENSE).
