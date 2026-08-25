# GeistDesk — Feature Inventory

> **Scope:** Every page, view, sub-tab, and feature implemented in the application as of **Aug 25, 2026**.
> **Method:** Static code audit of `src/` (routes in `src/App.tsx`, backend routes in `src/routes/`, services in `src/services/`, lib modules, and worker pipelines). Line counts from `wc -l` on `src/**/*.{ts,tsx}`.
> **Legend:** ✅ Implemented · 🔶 Partial / best-effort · ⏳ Planned / stubbed

---

## 1. Platform Overview

| Aspect | Detail |
|---|---|
| Name | GeistDesk (geistdesk-sovereign-ai-orchestrator) |
| License | AGPL-3.0 |
| Frontend | React 19 + Vite 6 + TypeScript + Tailwind 4 (via `@tailwindcss/vite`) |
| UI kit | Base UI (Shadcn-style), `lucide-react` icons, `recharts`, `framer-motion`, Tiptap 3 / react-quill rich text |
| Backend | Express 5 + Node ≥ 20 (single `server.ts`, esbuild-bundled `dist/server.cjs`) |
| Data layer | **PostgreSQL + `pgvector`** (primary, via `src/lib/postgres-backend.ts`), Firestore legacy/emulated, Dexie (indexedDB) for client cache |
| AI | Detachable engines — local Ollama (sovereign) or cloud (OpenAI / Azure / Anthropic / Groq), via an orchestrator layer (`ai-orchestrator-service.ts`, `ai-orchestrator-store.ts`) |
| Crypto | Argon2id password hashing, AES-256-GCM, ML-KEM-1024 + X25519 hybrid KEM (post-quantum), Shamir secret sharing |
| Runtime scripts | `dev` (tsx), `build` (vite + esbuild), `build:strict`, `verify:*` release checks, `db:migrate`, `seed`, `vectors:backfill` |
| Documentation | `README.md`, `DEPLOYMENT.md`, `INSTALLATION_AND_CONFIG.md`, `FEATURES_MANIFEST.md`, `security_spec.md` |

---

## 2. Route Map (frontend)

| Route | Page component | Guard | Module gate |
|---|---|---|---|
| `/onboarding` | `OnboardingWizardPage` | first-run / needsResume | — |
| `/login` | `LoginPage` | — | — |
| `/` | `MainLayout` | `OnboardingGate` | — |
| `/dashboard` | `DashboardPage` | auth | — |
| `/tickets`, `/tickets/:ticketId` | `TicketsPage` | auth | — |
| `/customers` | `CustomersPage` | auth | — |
| `/kb` | `KBPage` | auth | `geistKB` |
| `/migrator` | `GeistDeskMigratorPage` | auth | — |
| `/vault` | `VaultPage` | auth | `geistExchange` |
| `/credentials` | `CredentialVaultPage` | auth | `geistVault` |
| `/insights` | `InsightsPage` | auth | — |
| `/audit` | `AuditLogPage` | admin | — |
| `/settings` | `SettingsPage` | auth | — |
| `/admin` | `AdminHubPage` | admin | — |
| `/admin/legal` | `LegalSettingsPage` | admin | — |
| `/admin/notifications` | `NotificationEnginePage` | admin | — |
| `/admin/schema` | `CompanySchemaPage` | admin | — |
| `/admin/contact-schema` | `ContactSchemaPage` | admin | — |
| `/admin/pii` | `PIIShieldPage` | admin | — |
| `/admin/sovereignty` | `SovereigntyCenterPage` | admin | — |
| `/admin/integrations` | `IntegrationsPage` | admin | — |
| `/admin/polyglot` | `PolyglotBridgeAdminPage` | admin | — |
| `/admin/groups` | `GroupsPage` | admin | — |
| `/admin/workforce` | `WorkforcePage` | admin | — |
| `/admin/roles` | `RolesPage` | admin | — |
| `/admin/vault-portfolio` | `VaultPortfolioManagementPage` | admin | — |
| `/admin/import` | `AdminImportPage` | admin | — |
| `/email-channels` | `EmailChannelsPage` | auth | — |
| `/help` | `HelpCenterPage` | public | — |
| `/v/:id` | `SecretViewerPage` | public (token) | — |
| `/admin/mcp`, `/admin/ai`, `/ai-orchestrator` | redirect → `/admin?tab=ai-engine` | — | — |

Legacy redirect aliases: `/admin/mcp`, `/admin/ai`, `/ai-orchestrator` all redirect to the AI-Engine tab of Admin Hub.

---

## 3. Day-0 Onboarding Wizard (`OnboardingWizardPage`)

A 3-step (plus resume states) first-run setup that also powers re-initiation/resume:

1. **Admin account & workspace** — email, display name, 12-char password policy (upper/lower/digit, zod-validated), vault-passphrase mirroring when "use vault for admin" is enabled.
2. **AI engine mode** — `sovereign` (local Ollama, with model detection + endpoint), `cloud` (OpenAI / Azure / Anthropic / Groq provider selection + keys), or `disabled`. Feature routing by model (`featureRoutingForModel`).
3. **RAG defaults & email ingestion** — RAG toggles (index resolved tickets, index new KB articles, detect duplicates) and channel selection (webhook, MS Graph, IMAP basic, IMAP OAuth2).

**Resume logic:** `status.needsResume` / `hasAdminUser` states let a partially-completed install jump to the correct step; fully-initialized workspaces redirect to `/dashboard`.

Backed by `src/lib/onboarding-service.ts` (~1,099 lines) with atomic `/complete` (transactional), AI ping, module-config normalization, demo-data seeding/purging, and personal-vault initialization.

---

## 4. Dashboard (`DashboardPage`)

- KPI cards fed by `dashboard-stats-service.ts` (ticket counts, AI suggestion usage, satisfaction, queue stats).
- **AI Suggestion counter / adoption** — tracks `aiSuggestionUsed` / `aiSuggestionsCount`.
- Charts (recharts): ticket volume over time, status/priority breakdowns, CSAT.
- Module quick-launch tiles and workspace status.
- Team productivity and SLA summaries.

---

## 5. GeistTickets (`TicketsPage` — **5,008 lines**, largest file in the repo)

### 5.1 Sidebar & views
- Sidebar view groups (built-in + custom) with favorites, drag-reorder, grouping, collapsed state, custom-view CRUD, default view persistence (`geistdesk_default_view`).
- View filters in `ticketViewFilters.ts` (486 lines): team/all-open, unassigned, priority, sentiment, AI (needs help), watched, category grouping, custom views, restricted-agent scope.

### 5.2 Ticket list & pipeline
- List / Kanban-pipeline layout toggle (`layoutMode`), list sort (newest / oldest / priority), pagination (25/page), density (comfortable/compact), bulk multi-select + bulk actions, search, advanced filters drawer, category chips, hover **peek preview** (last 2 messages).

### 5.3 Ticket detail
- Message thread (real-time subscription per ticket), reply composer with AI ghostwriting, internal notes, timeline, customer/company context tabs, related tickets, assets tab, AI insights tab, smart context panel.
- **RedesignedSidebar** (594 lines): status, priority, assignee, teams, SLA, account health, sentiment, tags, watchers, AI checklist.
- **AI Summary Card** (`AiSummaryCard.tsx`, 451 lines): deep-dive summary, root cause, insights, confidence score (evaluator-optimizer loop), citations, regenerate + force refresh.
- **Polyglot Bridge in tickets:** native UI translation of ticket content, live ghostwriting of replies (800 ms debounce), incoming-message translation with caching per message id, mood selector (Professional/Casual/Empathetic).
- Handoff: assignee change triggers AI handoff-summary generation + Golden Note (NEXUS handoff briefing).
- Resolve flow: resolve modal with RAG indexing toggle, CSAT capture, resolution-time tracking.
- Spam: mark-as-spam dialog.
- Presence: typing/viewing presence set + cleared on unmount (`setPresence`).
- Duplicate detection / ticket merging (master/child tickets, linked tickets).

### 5.4 Related
- `TicketDetailsPage` wrapper, `CreateTicketDialog` (665 lines), KB article suggestions on tickets.
- Services: `ticketService.ts` (460 lines, subscriptions + mutations), `agentService.ts`, `legalService.ts`.

---

## 6. GeistKB — Knowledge Base (`KBPage` + article pages)

### 6.1 Views & sections
- **Articles tab** — KB list with categories, tags, search, AI search overlay (`KBSearchAiOverlay`), featured articles, KPI cards, bulk actions bar, category grid + category admin panel, view mode selector.
- **Documents tab** (`KBDocumentsTab.tsx`, 426 lines) — uploaded document library with parsing (pdf-parse, mammoth, papaparse), ingestion status.
- **External Sources tab** (`KBExternalSourcesTab.tsx`) — connector management for **NAS/local directory, SFTP, SharePoint (MS Graph), OneDrive (MS Graph)** with sync trigger, toggle, and metadata; mirrors Admin Hub RAG tab.

### 6.2 Article experience
- `KnowledgeBaseArticlePage`, `KBArticleDetailBody/Header/Toolbar`, `KBArticleViews`, rich text editor (Tiptap, `KBRichTextEditor.tsx` 418 lines).
- **AI knowledge intelligence panel** (`KBKnowledgeIntelligencePanel`) — per-article RAG index toggle (`index_in_rag`), trust score, hallucination-risk / coverage / freshness, infrastructure trust, workflow steps, alerts.
- **KBArticleTrustPanel** (512 lines) — trust & review workflow (approval status, reviewer, review-due date).
- **KB Autopilot Dashboard** (`KBAutopilotDashboard.tsx`, 539 lines) — coverage engine, gap detection, article lifecycle automation.
- **Knowledge graph** (`KBKnowledgeGraphModal`, `KBRelationshipService`, `graph-transcripts.js`).
- Manual AI summary button (view-loop guarded with `useRef`; auto-summarize on load was removed).
- Article history/translations (`KBArticleTranslation`, Polyglot).

### 6.3 Dashboards
- `KnowledgeBaseDashboardPage` + `kbDashboardApi` + KPI cards.

---

## 7. GeistVault — Credential Vault (`CredentialVaultPage` — **2,653 lines**)

- Folder sidebar tree, drag-and-drop, search, asset views (list/grid), properties pane, tags.
- **Credential drawer** (`CredentialDrawer.tsx`, 453 lines) with per-item metadata (secret type, expiry, max views, virus/malware scan flags, retention policy, IP allowlist, allowed email domains, MFA-required, share-via-email, notify-on-view).
- **GeistVaultSessionLauncher** (442 lines) — session-based access to secrets with hybrid crypto.
- **VaultEntryCreateWorkspace** (1,177 lines) — creation flow: dropzone/upload bucket, custom fields, expiry presets, sharing.
- Export/Import dialogs (`vault-import-processor.ts`, 447 lines), delete-confirm banner, FAB menu, security sidebar, AI security banner.
- Backend: `credentialVaultRoutes.ts` (610 lines) + `vaultRoutes.ts` (674 lines) + `vaultService.ts` + `personal-vault-store.ts`.
- **Admin:** `VaultPortfolioManagementPage` (admin/vault-portfolio) — portfolio-wide vault overview.

### 7.1 Secret Viewer (`SecretViewerPage`, `/v/:id`)
- Public token-based single-secret reveal; burn-on-read (`isBurned`), quota/max-views, passphrase-protected, time-expiry; hybrid post-quantum decryption on reveal.

> **Route reconciliation (2026-08):** the legacy vault page has been removed. `/vault` is exclusively **GeistExchange** (gated `geistExchange`), and `/credentials` is the **GeistVault** credential vault (gated `geistVault`).

---

## 8. GeistExchange (`VaultPage` + `src/components/exchange/` — 14 components)

- **Canonical module for the `/vault` route** (gated `geistExchange`); no legacy vault overlap remains.
- **Create secret/instance** — `ExchangeCreateSecretPanel` (520 lines), create-template modal.
- **Active transfers table** (`ExchangeActiveTable`), recent transfers, KPI cards, quick actions.
- **Security sidebar** — PQC level, delivery options, trust footer, delete-confirm modal, settings panel.
- **AI insights banner** (`ExchangeAiInsightsBanner`), detail drawer.
- Backend: `exchangeRoutes.ts`, `exchangeApi.ts` + `scripts/verify-exchange-secret-crypto.mjs` release check.

---

## 9. Customers & Contacts (`CustomersPage` — 1,566 lines)

- Company list + detail (tabs in `companies/`: `CompanyOverviewTab` 401 lines, `CompanyOtherTabs` 746 lines), contact records, related tickets/assets, custom schema fields (Company/Contact schemas), customer health & account health.

---

## 10. Admin Hub (`AdminHubPage` + `src/components/admin/hub/`)

| Tab | Component | Scope |
|---|---|---|
| Overview | `AdminHubOverviewTab` | Workspace overview, stats, module status grid |
| Section grid | `AdminHubSectionGrid` | Module toggles/launch grid |
| **AI Engine** | `AdminHubAiEngineTab` (903 lines) | Orchestrator config: provider (Ollama/OpenAI/Azure/Anthropic/Groq), models, feature routing, API keys, ping/test, MCP-style endpoints, `ai-orchestrator-store` |
| **RAG** | `AdminHubRagTab` (852 lines) | Vector store settings, embedding model, chunking, external sources (NAS/SFTP/SharePoint/OneDrive), sync/toggle, RAG pipeline config |
| Governance | `AdminHubGovernanceTab` | PII redaction rules, legal validation, policies |
| Integrations | `AdminHubIntegrationsTab` | Webhooks, MS Graph, IMAP, bots |
| System | `AdminHubSystemTab` | Health, env, migrations, seed, logs |

Admin sub-pages (routes above): LegalSettings, NotificationEngine, Schema (Company/Contact), PIIShield, Sovereignty Center, Integrations, Polyglot Bridge, Groups, Workforce, Roles, Vault Portfolio, Import.

---

## 11. Email Channels & Ingestion (`EmailChannelsPage` — 1,223 lines)

- Channel CRUD (webhook, MS Graph, IMAP basic, IMAP OAuth2), forwarding domain management (`mailDomainRoutes`), channel store (`channel-store.ts` 403 lines), inbound-mail webhook, ticket-spam routes.
- IMAP OAuth2 config (tenant id, client id/secret, token URL), header telemetry (`headerTelemetryRoutes`).

---

## 12. AI Platform & Sovereignty

| Feature | Where | Status |
|---|---|---|
| AI Orchestrator (detachable engines) | `ai-orchestrator-service.ts`, `ai-orchestrator-store.ts`, `azure-ai-orchestrator.js` | ✅ |
| AI request lifecycle (evaluator–optimizer, self-critique, confidence) | `ai-request-lifecycle.ts` (722 lines) | ✅ |
| Vector queue / embedding backfill | `vector-queue.ts` (539 lines), `embeddings.ts` (415 lines), `vectorRoutes`, `vectors:backfill` | ✅ |
| RAG pipeline (pgvector) | `rag-pipeline-config.ts`, `ragService.ts`, `ragAdminRoutes` | ✅ |
| PII Shield / redaction | `PIIShieldPage`, `pii-shield.js`, `AdminHubGovernanceTab` | ✅ |
| Swarm detection / duplicates | `ticketService`, orchestrator | ✅ |
| Human-diff feedback learning | `ai-request-lifecycle`, autopilot | ✅ |
| Polyglot Bridge (translation) | `PolyglotBridgeConfigPanel` (537 lines), `PolyglotBridgeAdminPage`, `i18n` | ✅ |
| Sovereignty Center (data residency, model sovereignty) | `SovereigntyCenterPage` (737 lines) | ✅ |
| KB Autopilot / coverage engine | `KBAutopilotDashboard`, `coverageEngine.ts`, `autopilotService.ts` | ✅ |
| Trust score engine | `trustScoreService.ts` | ✅ |
| Neural Link (graph transcripts) | `neuralLinkService.ts`, `graph-transcripts.js` | ✅ |
| Teams bot / adaptive cards | `teams-bot.js`, `teams-adaptive-cards.js`, `teamsBotService.ts` | ✅ |
| Import service (bulk CSV/JSON) | `import-service.ts` (422 lines), `importRoutes`, `AdminImportPage` | ✅ |
| Migrator (Firestore → Postgres) | `GeistDeskMigratorPage` (824 lines), `firebase-custom-client.ts` (478 lines) | ✅ |
| Notification engine | `NotificationEnginePage`, `notificationService.ts` | ✅ |
| Audit log | `AuditLogPage` (411 lines), `auditService.ts` | ✅ |
| RBAC (roles/groups/workforce) | `RolesPage` 426, `GroupsPage` 479, `WorkforcePage` 643, `rbacService.ts` | ✅ |
| Demo simulation seed | `demo-simulation-seed.ts` (789 lines) | 🔶 seed-only |
| Executive dashboard | `executiveDashboardRoutes`, `executiveDashboardApi` | ✅ |

---

## 13. Backend Route Inventory (`src/routes/` — 22 files)

`adminRoutes` (1,038) · `aiRoutes` · `credentialVaultRoutes` (610) · `demoSeedRoutes` · `emailChannelRoutes` · `exchangeRoutes` · `executiveDashboardRoutes` · `headerTelemetryRoutes` · `importRoutes` · `kbArticleRoutes` · `kbCategoryRoutes` · `kbDashboardRoutes` · `kbDocumentRoutes` · `kbIngestionRoutes` · `mailDomainRoutes` · `moduleConfigRoutes` · `onboardingRoutes` · `ragAdminRoutes` · `ticketReplyRoutes` · `ticketSpamRoutes` · `vaultRoutes` (674) · `vectorRoutes`.

Largest lib modules: `onboarding-service.ts` (1,099) · `postgres-backend.ts` (889) · `ai-orchestrator-store.ts` (851) · `demo-simulation-seed.ts` (789) · `ai-request-lifecycle.ts` (722) · `dashboard-stats-service.ts` (532) · `vector-queue.ts` (539).

---

## 14. Feature Completeness Summary

| Module | Coverage | Notable gaps / risks |
|---|---|---|
| Onboarding | ✅ Complete incl. resume | — |
| Dashboard | ✅ | Depends on stats service coverage |
| Tickets | ✅ Very high | 5,008-line monolith; translation effects fire per message set |
| GeistKB | ✅ Very high | External sources newly added; document OCR not seen |
| GeistVault | ✅ High | Canonical at `/credentials` (`CredentialVaultPage`) |
| GeistExchange | ✅ High | Canonical at `/vault` (`VaultPage`); legacy vault removed |
| Admin Hub | ✅ High | RAG tab large (852 lines) |
| AI platform | ✅ High | Cloud-provider parity varies by model |
| Bots/Teams | 🔶 Partial | Bot files at repo root (not `src/`) |
| Import/Migrator | ✅ | — |
