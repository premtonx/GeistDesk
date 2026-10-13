# GeistDesk — Code Audit & Improvement Plan

> **Audit date:** Aug 25, 2026
> **Method:** Static analysis of `src/` (TS/TSX), package manifests, route definitions, and backend modules. File-size scan via `wc -l`, React lifecycle inspection of the largest components, security-surface review of crypto/auth/data-layer code, and TypeScript compile (`tsc --noEmit`) + production build pass.
> **Scope:** File organization · component sizing · React performance/lifecycle · backend architecture · async safety · security & error handling · refactoring action plan.

---

## 1. File Organization & Repository Structure

### 1.1 Layout (healthy parts)
- `src/components/pages/*` — route-level page components (32 files), clean 1:1 with `App.tsx` routes.
- `src/components/<module>/` — feature folders: `kb` (29), `vault` (21), `ticket-details` (15), `tickets` (14), `exchange` (14), `geistvault` (9), `companies` (5), `admin/hub` (7).
- `src/routes/*` — thin Express routers (22 files) delegating to `src/lib/*` stores/services. Good separation.
- `src/services/*` — frontend API clients (28 files) mirroring the backend routes.
- `src/lib/*` — backend domain logic; `src/lib/ai/` (embeddings, vector-queue), `src/lib/kb/`, `src/lib/email-ingestion/`, `src/lib/context/`.

### 1.2 Structural problems
1. **Frontend and backend live in one source tree** with shared `src/lib` serving both (server imports `./lib/postgres-backend.js` while `src/components` import `./services/*`). This works via Vite/esbuild but makes bundle-splitting, tree-shaking, and dependency isolation harder, and risks accidental browser-import of server-only modules.
2. **Root-level loose files**: `azure-ai-orchestrator.js`, `teams-adaptive-cards.js`, `pii-shield.js` now live in `src/server/` (moved 2026-08); the dead twins `teams-bot.js` / `graph-transcripts.js` were deleted (TS twins `teamsBotService.ts` / `graphTranscriptService.ts` are the live implementations).
3. **No `src/workers` directory** — despite the task description mentioning background workers, background processing lives inside `src/lib/` (vector-queue, email ingestion, KB sync) and in ad-hoc `scripts/*`; no dedicated worker pool/queue runner directory exists.
4. **Two vaults coexist**: `CredentialVaultPage` (GeistVault) and `VaultPage` (legacy GeistVault + GeistExchange share the `/vault` route). Feature overlap is confusing and routes `geistExchange` → `VaultPage` while `geistVault` → `CredentialVaultPage`.

### 1.3 Recommendations
- (M) Introduce `src/server/` vs `src/client/` separation (or at minimum an ESLint boundary rule forbidding `src/lib/*` imports from `src/components/*`).
- (M) Migrate root `.js` files into `src/server/bots/`, `src/server/ai/`, `src/server/graph/` with proper TS types; delete from repo root.
- (L) Reconcile legacy `VaultPage`/`VaultComponent` with GeistExchange — pick one canonical module and deprecate the other.

---

## 2. Component Sizing — The 5,000-Line Component Problem

### 2.1 Size scan (>400 lines in `src/`)

| File | Lines | Risk |
|---|---|---|
| `components/pages/TicketsPage.tsx` | **5,008** | 🔴 Extreme monolith |
| `components/pages/CredentialVaultPage.tsx` | 2,653 | 🔴 |
| `components/pages/KBPage.tsx` | 1,827 | 🟠 |
| `components/pages/CustomersPage.tsx` | 1,566 | 🟠 |
| `components/pages/VaultPage.tsx` | 1,331 | 🟠 |
| `components/pages/EmailChannelsPage.tsx` | 1,223 | 🟠 |
| `components/AIRelationshipGraph2.tsx` | 1,215 | 🟠 |
| `components/vault/VaultEntryCreateWorkspace.tsx` | 1,177 | 🟠 |
| `lib/onboarding-service.ts` | 1,099 | 🟠 (logic, acceptable-ish) |
| `components/pages/OnboardingWizardPage.tsx` | 1,089 | 🟠 |
| `routes/adminRoutes.ts` | 1,038 | 🟠 |
| `types/aiOrchestrator.ts` | 1,019 | 🟠 (types, acceptable) |
| `components/admin/hub/AdminHubAiEngineTab.tsx` | 903 | 🟠 |
| `lib/postgres-backend.ts` | 889 | 🟠 (DB layer, acceptable-ish) |
| `components/admin/hub/AdminHubRagTab.tsx` | 852 | 🟠 |
| `lib/ai-orchestrator-store.ts` | 851 | 🟠 |
| `components/pages/GeistDeskMigratorPage.tsx` | 824 | 🟠 |
| `components/pages/LoginPage.tsx` | 803 | 🟠 |
| `components/pages/InsightsPage.tsx` | 802 | 🟠 |
| `components/pages/SettingsPage.tsx` | 761 | 🟠 |
| `components/pages/companies/CompanyOtherTabs.tsx` | 746 | 🟠 |
| `components/pages/SovereigntyCenterPage.tsx` | 737 | 🟠 |
| `lib/ai-request-lifecycle.ts` | 722 | 🟠 |
| `components/pages/DashboardPage.tsx` | 680 | 🟡 |
| `components/CreateTicketDialog.tsx` | 665 | 🟡 |

56 files exceed 400 lines. TicketsPage alone is ~10× the healthy 500-line guideline and holds **42 `useState`, 23 `useEffect`, plus memos/callbacks (≈55 hooks total)** — it is a component, a store, a router, and several feature modules in one file.

### 2.2 Why it matters
- **Re-render blast radius:** every state change re-renders the entire 5,008-line subtree unless memoized; un-memoized inline JSX props (common in large maps) defeat `React.memo` downstream.
- **No isolated code-splitting:** the tickets feature is one chunk; `React.lazy` per page exists only at route level, not within the giant components.
- **Stateful coupling:** dozens of unrelated UI states (mobile sidebar, translation cache, presence, pagination, sentiment modal) in one component make `useEffect` deps hard to reason about (see §3).

### 2.3 Recommendations
- (H) Split `TicketsPage` into: `TicketsPageShell` (layout/state orchestration) + `TicketSidebar` (already 594-line `RedesignedSidebar` — extract further into `SidebarViews`, `SidebarGroups`), `TicketListView`/`TicketPipelineView` (already distinct via `layoutMode`), `TicketDetailPanel`, `TicketComposer` (already `EmailComposer` + `ConversationTimeline`), `TicketModals` (resolve/handoff/spam), `TicketTranslationEngine` (extract the 3 Polyglot effects + caches into a custom hook `usePolyglot(ticket, messages)`).
- (M) Do the same for `CredentialVaultPage` (folders/tree, search, drawer, launcher) and `KBPage` (already partially split into `KBDocumentsTab`, `KBExternalSourcesTab` — keep going: extract `KBSearchOverlay`, `KBCategoryGrid`, `KBArticleList`).
- (M) Extract the three translation `useEffect`s in TicketsPage into `usePolyglotTranslation` hook with its own `translatedMessages` cache in a `useRef`/Dexie store instead of component state.

---

## 3. React Lifecycle & Performance Audit (deep-dive on the top files)

### 3.1 `OnboardingWizardPage.tsx` (1,089 lines)
- Only **2 `useEffect`s** — excellent discipline for a 1k-line file. ✅
- Effect 1 (`[status, navigate, user]`) branches on `status.isInitialized` / `hasAdminUser` / `needsResume` to set step state; correct guards, no infinite-loop risk, and it clears `adminEmail`/`adminName` from the auth user — good resume handling. ✅
- Effect 2 (`[useVaultForAdmin, newPassword, confirmPassword]`) mirrors password state into vault fields — acceptable but a form-level `useMemo`/derived value would be cleaner than a sync effect.
- **Issue:** many of the ~70 form states could collapse into a single `form` object or `useForm`-style reducer; the state list is long but each is trivial.

### 3.2 `TicketsPage.tsx` (5,008 lines) — 23 effects
**Healthy patterns found:**
- Mobile detection effect with proper listener cleanup. ✅
- `localStorage` persistence effects (category, additionalCategory, default view, agent language) — correct deps, no loops. ✅
- Subscription effects return unsubscribe functions (`subscribeToTickets`, `subscribeToMessages`, `subscribeToArticles`) — real-time data is cleaned up. ✅
- Presence cleared on unmount/ticket-change. ✅
- Translation effects debounce (800 ms) and cache by message id. ✅
- `useMemo` for filtered tickets, queue stats, view-filter context. ✅

**Problematic patterns:**
1. **`useEffect` at lines 917–922:**
   ```ts
   useEffect(() => {
     if (selectedTicketId) {
       navigate(`/tickets/${selectedTicketId}`);
       updateSummary();
     }
   }, [selectedTicketId, selectedTicket, messages.length]);
   ```
   `updateSummary` is re-created every render; including the whole `selectedTicket` object + `messages.length` re-runs navigation on every message arrival — navigation to the same URL is a no-op, but `updateSummary()` fires on every new message. This couples navigation with summary generation and can double-fire during streaming message updates. **Fix:** split into two effects — one for `navigate` keyed on `selectedTicketId` only; one for summary keyed on explicit `[selectedTicketId, messages.length, isAiReady]` with a ref guard.
2. **Missing `translatedMessages` in deps of the incoming-translation effect (line ~971):** effect reads `translatedMessages[m.id]` to skip already-translated messages but omits it from the deps array (intentional to avoid loops, but the closure is stale). Safer: keep the translated cache in a `useRef`/Dexie store so the effect doesn't need it as a dep.
3. **`handleMouseMove` setState on every mousemove** for the hover peek — throttled via hover id check, but `setMousePos` itself is per-move; consider pointer-event coalescing or moving to a CSS transform via a ref.
4. **Perf risk:** `viewFilterContext` re-created when `allTickets` changes (every live update) → invalidates `baseSidebarTickets` → invalidates `finalRenderedTickets`; the list re-renders on each new message from any ticket. Recommend splitting the live "allTickets" array from the filter context (e.g. keep counts/ids in the filter context, not the full array).
5. `any` casts (`selectedTicket = allTickets.find(...) as any`) — type hygiene issue (§5).

### 3.3 `KBDocumentsTab.tsx` (426 lines) — only 2 effects ✅
Both are simple load/subscription effects with cleanup. Good.

### 3.4 `AdminHubRagTab.tsx` (852) / `AdminHubAiEngineTab.tsx` (903)
- Form state + connector list state are local; SFTP form fields added conditionally (host/port/username/authMode) — conditional rendering is correct.
- Watch: long `form` objects are passed to many sub-render functions; fine for now, but consider `useReducer` when the SFTP/SharePoint field matrix grows.

### 3.5 Global observations
- **No ErrorBoundary** anywhere (grep for `ErrorBoundary|componentDidCatch` = 0 hits). A single uncaught render error in a 5k-line component blanks the whole app.
- **No route-level lazy loading** (`React.lazy` absent; all 32 pages imported eagerly in `App.tsx`).
- No `React.memo`/`useCallback` in most list-heavy areas; several `onChange` handlers are re-created inline.
- Several `useEffect` deps include whole objects (`selectedTicket`) where primitive deps would suffice.
- Repeated `localStorage` JSON parsing without try/catch (e.g. `watchedTickets` initializer) — one corrupted value crashes the app at mount.

### 3.6 Recommendations (priority-ordered)
1. (H) Add a top-level `ErrorBoundary` (class component) with a retry + report surface, plus a per-route boundary for Tickets.
2. (H) Fix the navigation+summary coupled effect; add ref guards to AI-summary regeneration.
3. (M) Route-level `React.lazy` for the 5 largest pages (Tickets, CredentialVault, KB, Customers, EmailChannels) — cuts initial bundle significantly.
4. (M) Extract `usePolyglot` hook; move translated-message cache out of component state.
5. (M) Add `useLocalStorage<T>` hook with JSON try/catch + schema validation (zod) for all `localStorage.getItem(..., JSON.parse)` call sites.
6. (L) Add eslint react-hooks rules (exhaustive-deps) and enforce `no-implicit-any-casts` on new code.

---

## 4. Backend Architecture & Async Safety

### 4.1 Strengths
- **`postgres-backend.ts`** (889 lines) centralizes Postgres access with typed helpers (`queryDb`, `getDocDirect`, `setDocDirect`, `updateDocDirect`, `withPgTransaction`) — a clean data-access seam that made the Firestore→Postgres migration possible.
- **`ai-request-lifecycle.ts`** (722 lines) implements an explicit state machine (evaluator–optimizer, self-critique, confidence scoring) — good async discipline with timeout/fallback handling.
- **`vector-queue.ts`** (539 lines) provides a retryable background queue for embeddings.
- Routes are thin and delegate; services are testable.
- Transactional onboarding `/complete` + atomic flags.

### 4.2 Concerns
1. **Background work is in-process:** the vector queue / KB sync / email polling run inside the Express process (`server.ts`). A crash or horizontal scale-out duplicates or loses work. No job broker (BullMQ/Redis) or DB-backed worker table with leases.
2. **Bot process wiring**: the live Teams bot / Graph transcript implementations are `src/services/teamsBotService.ts` and `src/services/graphTranscriptService.ts` (imported by `server.ts`); the legacy root scripts (`teams-bot.js`, `graph-transcripts.js`) were deleted in 2026-08 as dead twins, and the remaining server-side scripts live in `src/server/`. Operational wiring (start scripts/env docs) is still documented outside the repo.
3. **Long-running sync jobs** (`sync-external-source.ts`: NAS walk, SFTP walk, MS Graph paging) have no cancellation token / job progress persistence — a 10k-file NAS sync blocks a request handler unless streamed; confirm they run detached (they appear to be invoked from route handlers via promises).
4. **Email ingestion** (`email-ingestion/channel-store.ts` 403 lines) polls IMAP; no backoff/cooldown accounting documented, and OAuth2 token refresh handling needs periodic verification (stored client secret).
5. **Migration paths:** `GeistDeskMigratorPage` + `firebase-custom-client.ts` suggest dual-write during migration; ensure no write path still silently dual-writes Firestore in production.

### 4.3 Recommendations
- (H) Move background work (vector queue, external-source sync, email polling) behind a DB-backed job table (`pg_advisory_lock` or leased rows) so multiple instances don't duplicate work; expose job status via existing `vectorRoutes`/`kbDocumentRoutes` style endpoints.
- (M) Add cancellation + progress events to `sync-external-source.ts`; persist last-sync cursor per source (already partially in `external-sources.ts` — extend with per-run stats).
- (M) Document/containerize bot processes (`src/services/teamsBotService.ts`, `src/services/graphTranscriptService.ts`) with start scripts and env docs.
- (L) Add structured logging + request-id correlation middleware (currently mixed `console.*` and `safe-log.js`).

---

## 5. Type Hygiene

- `Ticket` (182–260) and `KBArticle` (311–343) in `src/types/index.ts` are broad but include many optional/`any` fields: `firstResponseDue?: any`, `createdAt: any`, `updatedAt: any`, `slaDueAt?: any`, `resolvedAt?: any`. Replace with proper `Date | string` (ISO) types.
- `TicketsPage` uses `as any` casts (e.g. `allTickets.find(...) as any`, `(selectedTicket as any).originalLanguage`).
- `types/aiOrchestrator.ts` (1,019 lines) is a monolith — split into `provider.ts`, `routing.ts`, `lifecycle.ts` types.
- Frontend service types (e.g. `KbExternalSource` in `kbDocumentsApi.ts`) duplicate backend interfaces (`external-sources.ts`); consider a shared `src/shared/types.ts` imported by both client and server to prevent drift (SFTP fields were recently added to both manually).

---

## 6. Security & Error Handling

### 6.1 What's done well ✅
- Argon2id password hashing; AES-256-GCM secrets; ML-KEM-1024 + X25519 hybrid KEM; Shamir secret sharing; release verification scripts (`verify-hybrid-crypto.mjs`, `verify-exchange-secret-crypto.mjs`, `verify-vault-secret-store.mjs`).
- JWT sessions in `httpOnly` cookies; `helmet`; `express-rate-limit`.
- Input sanitization: DOMPurify (client), Cheerio allowlist (server) for rich text.
- Path traversal protection in file ingestion; `multer` with size limits; zip-slip-style checks in vault-import-processor.
- PII redaction at rest/in-flight in `pii-shield.js` + governance tab.
- Onboarding requires ≥12-char passwords with composition rules (zod).
- `isSystemAdminSession` + `AdminRoute` + `OnboardingGate` guard rails; module gates (`ModuleRoute`) per workspace config.

### 6.2 Concerns
1. **`beta-admin-bypass`** (`isSystemAdminSession`) — a bypass flag exists in the codebase; ensure it is **disabled in production builds** (verify it's guarded by an env flag). 🔶
2. **Admin check reliance:** `useAdmin`/`AdminRoute` are client-side; ensure every sensitive backend route re-verifies admin via server middleware (spot-check `adminRoutes.ts`).
3. **Rate limiting:** `express-rate-limit` is present but not visible on all auth/onboarding endpoints; brute-force on `/api/onboarding/complete` or login should be strictly limited + account lockout.
4. **Error handling style:** many `catch` blocks do `console.error` + `toast.error` without structured error taxonomy; `safe-log.js` exists but isn't used everywhere; user-facing errors leak internals in a few places (`Failed to generate handoff summary` is fine; raw axios errors elsewhere may leak).
5. **`localStorage` trusted data:** `watchedTickets`/`default_view` parsed without schema validation — XSS-resistant but crash-prone (see §3.5).
6. **Secrets in config:** cloud provider keys stored via `ai-orchestrator-store`/`setProviderSecret` — now AES-256-GCM at rest using a dedicated `AI_SECRETS_KEY` (256-bit, no fallback to `JWT_SECRET`), asserted at prod boot. ✅ resolved 2026-08
7. **No CSRF consideration** for cookie-authenticated state-changing endpoints (sameSite=Lax mitigates, but custom headers/Origin checks are recommended).
8. **File uploads:** KB document ingestion accepts pdf/docx/csv — check for SVG/HTML upload rejection and MIME sniffing (DOMPurify covers rendering; server-side allowlist needs to match).

### 6.3 Recommendations
- (H) Grep-and-verify the `beta-admin-bypass` path is env-gated (suggest removing the import in production bundles).
- (H) Add rate limiters to `/api/auth/*` and `/api/onboarding/*` with distinct keying + lockout; add Origin/referer checks to cookie-authenticated mutating routes.
- (M) Introduce a typed `AppError` with `status`/`code`/`publicMessage` and a global Express error middleware; stop leaking raw errors.
- (M) Add zod validation middleware to all request bodies (onboarding already uses zod; extend to tickets/KB/vault routes).
- (M) Encrypt orchestrator provider secrets at rest (AES-GCM) like vault secrets; rotate `setProviderSecret`. ✅ done 2026-08 — dedicated `AI_SECRETS_KEY`, boot assertion, no `JWT_SECRET` fallback.
- (L) Add file-type allowlist + magic-byte validation on KB document ingestion.

---

## 7. Tenancy & Multi-Workspace

- `tenant-context.ts` (`resolveTenantFromRequest`, `DEFAULT_TENANT_ID`) exists, and module config is per-workspace (`WorkspaceContext`, `getModuleConfig`).
- **Concern:** Most stores default to `WORKSPACE_ID = 'default'` / `DEFAULT_TENANT_ID`; true multi-tenant data isolation is not yet enforced at the query layer across all stores. If multi-workspace is a product goal, this is the highest-leverage security work.
- **Recommendation:** (M) Enforce tenant scoping in `postgres-backend.ts` query helpers (require `tenantId` param, no global default in production), and add a test that cross-tenant reads fail.

---

## 8. Performance Quick Wins

1. Route-level `React.lazy` for the 5 biggest pages. (M)
2. In `TicketsPage`, stop putting `allTickets` into `viewFilterContext`; derive filter context from stable primitives (counts, ids) to avoid full re-filter on every message. (H)
3. `useMemo` the message list before passing to `ConversationTimeline`; memoize `ConversationTimeline` with custom comparator (content + order only). (M)
4. Debounce/coalesce `handleMouseMove`. (L)
5. Add `content-visibility: auto` / `virtualize` the ticket list (only ~25/page already paginated — virtualization lower priority). (L)
6. Prefetch KB articles + static config via `useQuery`-style caching; services currently re-subscribe on mount (fine for realtime, but cache static config in module scope). (L)

---

## 9. Action Plan (Prioritized Roadmap)

### Phase 1 — Stability & correctness (do first)
| # | Task | Effort |
|---|---|---|
| 1 | Add global + route-level ErrorBoundary | S |
| 2 | Fix TicketsPage coupled navigate/summary effect; add ref guards | S |
| 3 | Safe `useLocalStorage` hook (JSON try/catch + zod) for all localStorage reads | S |
| 4 | Rate-limit auth + onboarding endpoints; Origin checks on mutating routes | S–M |
| 5 | Verify `beta-admin-bypass` is prod-gated | S |

### Phase 2 — Decomposition (largest payoff)
| # | Task | Effort |
|---|---|---|
| 6 | Split `TicketsPage` (5,008) into shell/list/detail/modals/translation-hook | L |
| 7 | Split `CredentialVaultPage` (2,653) | M |
| 8 | Extract `usePolyglot` + translation cache out of component state | M |
| 9 | Route-level `React.lazy` for top-5 pages | M |
| 10 | Reconcile legacy `VaultPage` with GeistExchange | M |

### Phase 3 — Architecture hardening
| # | Task | Effort |
|---|---|---|
| 11 | DB-backed job queue/leases for vector queue + external-source sync + email polling | L |
| 12 | Move root `.js` scripts into `src/server/`; add process docs/units | M |
| 13 | Enforce tenant scoping in query helpers | L |
| 14 | Shared `src/shared/types.ts` to de-duplicate client/server interfaces | M |
| 15 | Typed `AppError` + global error middleware; zod on all bodies | M |
| 16 | Encrypt orchestrator provider secrets at rest | M |

### Phase 4 — Tooling & hygiene
| # | Task | Effort |
|---|---|---|
| 17 | Enable `react-hooks/exhaustive-deps` + `no-explicit-any` (new code) | S |
| 18 | ESLint boundary rule: `src/components` → `src/lib` import ban | S |
| 19 | Structured logging + request-id correlation | M |
| 20 | Split `types/aiOrchestrator.ts` | S |

Effort legend: **S** ≤ 1 day · **M** ≤ 3 days · **L** > 3 days.

---

## 10. Appendix — Data points

- Total `.ts/.tsx` files > 400 lines: **56**
- `TicketsPage.tsx`: **42** `useState`, **23** `useEffect`, ~55 total hooks
- `KBDocumentsTab.tsx`: **2** effects (healthy)
- `OnboardingWizardPage.tsx`: **2** effects (healthy)
- Error boundaries: **0**
- `React.lazy` usage: **0**
- Backend route files: **22** (`src/routes/`)
- Frontend service API files: **28** (`src/services/`)
- Root-level non-TS scripts: **0** (moved to `src/server/`: `azure-ai-orchestrator.js`, `teams-adaptive-cards.js`, `pii-shield.js`; dead twins `teams-bot.js` / `graph-transcripts.js` deleted)
- Type-check: ✅ `tsc --noEmit` passes; Production build: ✅ passes
