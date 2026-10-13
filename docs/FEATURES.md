# GeistDesk — Feature Overview

Concise public registry of product modules. For deep route inventories, explore `src/App.tsx` and `src/components/admin/hub/adminHubConfig.ts`.

## Stack

- **Client:** React 19, Vite, Tailwind  
- **Server:** Express (Node.js 24), esbuild → `dist/server.cjs`  
- **Data:** PostgreSQL 15 + pgvector (`KnowledgeEmbedding`), JSONB document store (`geistdesk_documents`)  
- **Edge:** Traefik (`docker-compose.traefik.yml`) or Caddy profile  

## Modules

| Module | Highlights | Primary routes |
|--------|------------|----------------|
| **Tickets** | Multi-channel inbox, AI triage/drafts, checklists, Kanban | `/tickets` |
| **GeistKB** | Articles, categories, RAG indexing, hybrid search | `/kb` |
| **GeistVault** | Client-side encrypted credential vault (ZKP-style unlock) | `/credentials` |
| **GeistExchange** | Server-encrypted secrets, dropzones, audit log | `/vault` |
| **AI Orchestrator** | Provider routing, PII shield, personas/skills | `/admin?tab=ai-engine` |
| **Insights** | Executive / SLA analytics | `/insights` |
| **Admin Hub** | RAG, governance, mail/integrations, system | `/admin` |
| **Native MCP** | Streamable HTTP tools for KB / tickets / vault | `/api/mcp` (Admin: `/admin?tab=integrations`) |

## Admin Hub tabs

| Tab | Purpose |
|-----|---------|
| Übersicht | Control-plane overview |
| Kern-KI & Modelle | Orchestrator providers, keys, feature routing |
| RAG & Wissensbasis | Vector index status, retrieval tests, sources |
| PII & Compliance | Redaction / legal guardrails |
| Mail & Schnittstellen | Email channels, webhooks, **API & MCP** |
| Infrastruktur & Backups | Import, health, platform flags |

## MCP tools

| Tool | Scope |
|------|--------|
| `geistkb_search`, `geistkb_get_article`, `geistkb_create_article` | `geistkb:read` / `geistkb:write` |
| `tickets_list`, `tickets_get`, `tickets_update_status` | `tickets:read` / `tickets:write` |
| `vault_search_secrets`, `vault_get_secret` | `vault:read` / `vault:reveal` |

Tokens are minted in Admin Hub (`gdk_…`). See [README](../README.md#model-context-protocol-mcp).
