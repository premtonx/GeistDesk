# GeistDesk — Installation & Configuration Guide

Enterprise production / pilot runbook for deploying GeistDesk with Docker, wiring inbound mail (Postal, Microsoft Graph, IMAP OAuth2), corporate SSO, and operating core modules (Tickets, GeistKB, GeistVault, GeistExchange, Admin Hub, KI Orchestrator).

> **Stack notes**
> - PostgreSQL is the singular source of truth (no Prisma). Schema deploy = `initDb()` via `npm run db:deploy:prod`.
> - Frontend talks to the same origin via relative `/api/*` paths (no `NEXT_PUBLIC_API_URL` required).
> - Secrets must come from environment variables — never commit `.env`.

---

## 1. Step-by-step deployment

### 1.1 Prerequisites

- Docker Engine 24+ and Docker Compose v2
- Outbound HTTPS for LLM / Microsoft / SMTP integrations (as needed)
- A DNS name for production (optional for local pilot on `localhost:3000`)

### 1.2 Create the environment file

```bash
cp .env.example .env
```

Generate secrets:

```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(48).toString('hex'))"
node -e "console.log('VAULT_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('INBOUND_MAIL_WEBHOOK_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('MASTER_KEY_SALT=' + require('crypto').randomBytes(24).toString('hex'))"
```

Edit `.env` and set at minimum:

| Variable | Purpose |
|----------|---------|
| `POSTGRES_PASSWORD` | Bundled Postgres password |
| `DATABASE_URL` | Must match Postgres user/password/db (`…@geistdesk-db:5432/…`) |
| `JWT_SECRET` | Session JWT signing (fail-fast if missing) |
| `VAULT_ENCRYPTION_KEY` | 64 hex chars — GeistVault / GeistExchange at-rest crypto |
| `INBOUND_MAIL_WEBHOOK_SECRET` | Postal / gateway webhook auth |
| `PUBLIC_APP_URL` | Canonical public URL (e.g. `https://helpdesk.example.com`) |

Optional but recommended for a fresh pilot:

- `MASTER_KEY_SALT` **and** `VITE_MASTER_KEY_SALT` (same value) — Argon2 pepper for vault master keys. Set **before first vault unlock** or leave both empty for legacy salt compatibility.
- `OLLAMA_ENDPOINT` / Azure / Gemini keys for AI features.

### 1.3 Build and start

**Local / greenfield** (Compose builds from prebuilt or host `dist/`):

```bash
npm ci && npm run build   # if dist/ is not already present
docker compose up --build -d
```

**CI / production host model** (matches `premtonx` deploy): CI uploads `dist/`, host runs:

```bash
docker compose build --pull --build-arg BUILD_ID="$DEPLOY_COMMIT" geistdesk-gateway
docker compose up -d geistdesk-gateway
```

The default `Dockerfile` is **runtime-only** (copies `dist/`). For a full source build inside Docker, use `Dockerfile.multistage`.

> **Important:** `.dockerignore` must **not** exclude `dist/` — the production image copies the CI-prebuilt artifact from the host build context.

> **Compose defaults:** `POSTGRES_PASSWORD` defaults to `geist_password` so existing production `.env` files without that key keep working. Override only when creating a **new** empty DB volume. `DATABASE_URL` defaults to `postgresql://geist_user:geist_password@geistdesk-db:5432/geistdesk_prod?sslmode=disable`.

On every container start, `scripts/docker-entrypoint.sh` runs:

1. Wait for PostgreSQL health  
2. `npm run db:deploy:prod` → idempotent DDL (`dist/migrate.cjs` → `initDb()`)  
3. `npm run seed:prod` → platform defaults / seed users  
4. `exec node dist/server.cjs` → gateway on port `3000`

### 1.4 Verify

```bash
docker compose ps
curl -fsS "${PUBLIC_APP_URL:-http://localhost:3000}/api/health"
docker compose logs -f geistdesk-gateway
```

Open the UI at `PUBLIC_APP_URL` (default `http://localhost:3000`).

### 1.5 Stop / reset

```bash
docker compose down          # keep DB volume
docker compose down -v       # DESTROYS database volume — irreversible
```

---

## 2. Day-1 configuration runbook

### 2.1 Initial admin authentication

1. Open `/login`.
2. Sign in with a seeded admin account from `npm run seed:prod` (see seed output / `src/db/seed-data.json` for the pilot identity your image ships with), **or** create the first admin via your identity provider once SSO is wired.
3. Immediately rotate the password under **User settings → Security** (or Admin Hub → Users → Set password).

> Production hardening: keep `BETA_AUTO_ADMIN=false`, `ALLOW_PUBLIC_REGISTRATION=false`, `VITE_DEMO_MODE=false`, `ENABLE_SANDBOX=false`.

### 2.2 Navigate Admin Hub

1. Go to **Admin Hub** (`/admin` or the Admin entry in the sidebar).
2. Confirm:
   - **Users / Roster** loads from Postgres  
   - **Roles (RBAC)** switches persist  
   - **Email Channels** lists channels (may be empty)  
   - **KI Orchestrator** shows workspace AI config  

### 2.3 Password rotation checklist

- [ ] Admin local password rotated  
- [ ] `JWT_SECRET` is unique per environment (rotating it invalidates all sessions)  
- [ ] `VAULT_ENCRYPTION_KEY` stored in a secrets manager (rotating it breaks server-side vault ciphertext)  
- [ ] `INBOUND_MAIL_WEBHOOK_SECRET` matches Postal / gateway config  

---

## 3. Ingestion integration recipes

Inbound mail converges on a unified driver factory (`src/lib/email-ingestion/*`) and shared pipeline `ingestNormalizedEmail` → blacklist → ticket/message → `processAiTriage`.

### 3.1 Postal (passive webhook)

**Goal:** Forward `support@your-domain` (or Postal routes) into GeistDesk.

1. In GeistDesk → **Admin Hub → Email Channels → Channel hinzufügen**.
2. Set **Verbindungstyp** = `E-Mail-Weiterleitung (Webhook)`.
3. Save — copy:
   - **Forwarding address** (e.g. `ticket-<id>@app.premtonx.cloud`)
   - **Webhook-Secret**
4. In Postal:
   - Create a route / HTTP endpoint pointing to:  
     `https://<PUBLIC_APP_URL>/api/webhooks/inbound-mail`
   - Send the secret as header:  
     `x-geistdesk-webhook-secret: <Webhook-Secret>`  
     (global fallback: `INBOUND_MAIL_WEBHOOK_SECRET` from `.env`)
5. Postal may POST `multipart/form-data` or JSON — both are accepted (`from` / `sender`, `subject`, `body-html` / `html` / `text`).
6. Test by mailing the support alias. Confirm a ticket appears with status **Offen** and HTML body renders in the timeline.
7. Blacklisted senders (Admin spam workflow) are silently dropped (`action: drop`).

### 3.2 Microsoft Graph API (active pull)

**Goal:** Poll a shared mailbox every 60 seconds without IMAP Basic Auth.

1. In **Microsoft Entra ID**:
   - App registration → **New registration**
   - Certificates & secrets → create a **Client secret**
   - API permissions → Microsoft Graph **Application** permissions:
     - `Mail.Read`
     - `Mail.ReadWrite` (to mark messages read)
   - Grant admin consent
2. Note **Tenant ID**, **Application (client) ID**, client secret.
3. In GeistDesk → Email Channels:
   - Verbindungstyp = `Microsoft Graph API`
   - Target Support Email = mailbox UPN (e.g. `support@contoso.com`)
   - Tenant ID / Client ID / Client Secret
   - Enable channel → **Verbindung testen**
4. Scheduler (`EMAIL_INGESTION_INTERVAL_MS`, default 60000) pulls unread messages, persists attachments, marks read, and runs AI triage.

### 3.3 IMAP OAuth2 (XOAUTH2)

**Goal:** Modern Exchange / Google IMAP without Basic Auth.

1. Provision OAuth client credentials at the identity provider (Entra / Google Cloud).
2. Token endpoint examples:
   - Entra: `https://login.microsoftonline.com/<tenantId>/oauth2/v2.0/token`
3. Email Channels → Verbindungstyp = `IMAP (OAuth2)`:
   - Host / Port (993) / Email  
   - OAuth Client ID, Client Secret, Token Endpoint URL  
   - SSL/TLS on  
4. **Verbindung testen** → enable channel for 60s polling.

Legacy private servers: use **IMAP (Standard)** with username + password instead.

### 3.4 Corporate SSO (OIDC / Microsoft Entra)

1. Register a web application in Entra (or your OIDC IdP).
2. Redirect URI = `{PUBLIC_APP_URL}/login` (or your configured callback).
3. Set in `.env`:

```env
MICROSOFT_PROVIDER_CLIENT_ID=<app-client-id>
AZURE_TENANT_ID=<tenant-id>
AZURE_CLIENT_ID=<app-client-id>
AZURE_CLIENT_SECRET=<secret>
OIDC_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0
OIDC_CLIENT_ID=<app-client-id>
OIDC_CLIENT_SECRET=<secret>
OIDC_REDIRECT_URI=https://helpdesk.example.com/login
```

4. Redeploy gateway: `docker compose up -d --build geistdesk-gateway`
5. Users authenticate via the SSO control on the login page; server validates tokens against `MICROSOFT_PROVIDER_CLIENT_ID`.

---

## 4. Core application operator guides

### 4.1 Tickets

- **Views:** List / Kanban / Card from the tickets toolbar.  
- **Status normalization:** Raw aliases (`in_progress`, `on_hold`, …) map to Kanban lanes via `src/lib/ticket-kanban-status.ts` (Offen / In Bearbeitung / Gelöst).  
- **HTML email bodies:** Timeline prefers `html_content`, sanitized with DOMPurify (`sanitizeTimelineHtml`) — no raw `&lt;p&gt;` / `&nbsp;` artifacts.  
- **Attachments:** Shown as cards under the message when ingested.  
- **Replies:** `POST /api/tickets/:id/replies` always persists to Postgres first. If `SMTP_HOST` / `MAIL_DISPATCH_URL` are unset, UI shows **Saved Locally**.  
- **Spam:** Ticket details → **Als Spam markieren** → status `spam` + `global_blacklist` row; future inbound mail from that address is dropped.

### 4.2 GeistKB

- Create categories and articles in the KB UI — persisted via `/api/kb/*` → Postgres.  
- Populate structured troubleshooting content so AI Copilot / triage can cite KB during draft generation.  
- Dashboard metrics and ingestion pipelines read live DB collections (`kb_articles`, `kb_categories`).  
- Prefer authoring production articles in DB rather than relying on any showcase seed blurbs.

### 4.3 GeistVault

- Unlock with the user’s master password (client-side Argon2id → AES-GCM).  
- **Personal vs shared vaults:** Per-vault data encryption keys (VK) wrapped by the master key; shared vaults use hybrid wrap for collaborators.  
- Server stores ciphertext + key wrappers only (`/api/credential-vault`).  
- **Import:** Vault actions → Import (Chrome / Bitwarden / KeePass / 1Password / Vaultwarden).  
- **Export:** Personal vault → Export (Chrome CSV, Bitwarden JSON, KeePass CSV) — local download only after master-password re-verify.  
- Production tip: leave demo password autofill off (`VITE_DEMO_MODE=false`).

### 4.4 GeistExchange

- Configure exchange / dropzone settings under Exchange + Admin module config (`module_config/global.exchangeSettings`).  
- Secure shares and dropzone uploads persist encrypted payloads through vault/exchange APIs.  
- Audit / analytics endpoints read Postgres; treat malware badges as metadata unless an external scanner is integrated.

### 4.5 Admin Hub

- **Roster:** Create users, set roles, reset passwords (`/api/admin/users*`).  
- **RBAC:** Role documents control module permissions; `SYSTEM_ADMIN` gates hub APIs.  
- **Global spam blacklist:** Built via ticket spam action; enforced in inbound ingest.  
- **Email Channels:** Switch Verbindungstyp, save to Postgres (`email_channels`), run **Verbindung testen**.

### 4.6 KI Orchestrator Settings

- Admin → KI / AI Orchestrator persists to `ai_orchestrator_config` (Postgres).  
- Configure primary / reasoning / triage models, feature routing, temperature / reasoning level, PII + content filters.  
- Provider secrets encrypted at rest with `AI_SECRETS_KEY` (falls back to `JWT_SECRET`).  
- Local models: set `OLLAMA_ENDPOINT` (and optionally `VITE_OLLAMA_ENDPOINT`) — do not rely on hardcoded localhost defaults.  
- Ticket inbound mail calls `processAiTriage` using these workspace profiles.

---

## 5. Environment variable quick reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string |
| `JWT_SECRET` | Yes | Session JWT HS256 secret |
| `VAULT_ENCRYPTION_KEY` | Yes | 64-hex key for server-side vault crypto |
| `INBOUND_MAIL_WEBHOOK_SECRET` | Yes (mail pilots) | Webhook handshake secret |
| `MASTER_KEY_SALT` / `VITE_MASTER_KEY_SALT` | Optional | Vault Argon2 pepper (fresh installs) |
| `PUBLIC_APP_URL` | Recommended | Canonical external URL |
| `OLLAMA_ENDPOINT` | Optional | OpenAI-compatible local LLM base |
| `MICROSOFT_PROVIDER_CLIENT_ID` | SSO | Entra audience / client id |
| `SMTP_HOST` + `MAIL_DISPATCH_URL` | Optional | Outbound reply delivery |
| `BETA_AUTO_ADMIN` | No | Keep `false` in production |

Frontend API base: same-origin relative `/api` (no `NEXT_PUBLIC_API_URL`).

---

## 6. Production compile checklist (pre-image)

On a clean workspace before exporting container layers:

```bash
npm ci
npm run lint
npm run build
```

Expected: `tsc --noEmit` clean; Vite + `dist/server.cjs` / `dist/migrate.cjs` / `dist/seed.cjs` produced.

Then:

```bash
docker compose up --build -d
```

---

## 7. Related docs

- [DEPLOYMENT.md](./DEPLOYMENT.md) — bootstrap internals and idempotency details  
- [README.md](./README.md) — product overview  
- [`.env.example`](./.env.example) — full variable template  

---

*GeistDesk Sovereign — installation guide for enterprise pilot deployments.*
