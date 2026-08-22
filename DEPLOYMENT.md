# GeistDesk Deployment Guide

This document describes how to run GeistDesk in production with **zero-configuration bootstrapping**: a fresh Docker install automatically creates the database schema, seeds German platform defaults, and starts the web server — no SSH or manual CLI steps required.

---

## One-command Docker bootstrap

External adopters can bring up a fully populated environment with:

```bash
./setup.sh
```

The installer creates `.env` from `.env.example` if missing, generates
`POSTGRES_PASSWORD`, `JWT_SECRET`, `MASTER_KEY_SALT`, `VAULT_ENCRYPTION_KEY`,
and `INBOUND_MAIL_WEBHOOK_SECRET`, asks for a public domain (default
`http://localhost:3000`, or e.g. `desk.geistai.eu`), then runs
`docker compose up --build -d`. Non-interactive:

```bash
./setup.sh --yes
```

Do not edit `docker-compose.yml` — host, router, and Traefik network come from `.env`.

On every container start the entrypoint (`scripts/docker-entrypoint.sh`) runs:

| Step | Command | What it does |
|------|---------|----------------|
| 1 | Wait for PostgreSQL | Up to 30 retries (2s apart) until `DATABASE_URL` accepts connections |
| 2 | `npm run db:deploy:prod` | Applies idempotent PostgreSQL DDL (`dist/migrate.cjs` → `initDb()`) |
| 3 | `npm run seed:prod` | Seeds German defaults, vault folders, prompts, agent skills. Fixture users/tickets only when `ENABLE_DEMO_LOGIN=true` **and** not production. |
| 4 | `exec node dist/server.cjs` | Starts the Express gateway on port 3000 |

> **Note:** GeistDesk does not use Prisma. Schema deployment is handled by `src/db/migrate.ts`, which wraps the same `initDb()` routine used at runtime in `src/lib/postgres-backend.ts`.

### Equivalent `package.json` scripts

```json
"db:deploy:prod": "node dist/migrate.cjs",
"seed:prod": "node dist/seed.cjs",
"prod:bootstrap": "npm run db:deploy:prod && npm run seed:prod",
"prod:start": "npm run prod:bootstrap && node dist/server.cjs"
```

For bare-metal or VM hosts (after `npm run build`):

```bash
export DATABASE_URL=postgresql://...
export JWT_SECRET=...
export VAULT_ENCRYPTION_KEY=...
npm run prod:start
```

---

## Required environment variables

Create a `.env` file next to `docker-compose.yml` before first boot:

```env
# Required — application will not start without these
JWT_SECRET=<random-64-char-hex>
VAULT_ENCRYPTION_KEY=<random-32-byte-key>

# Auto-generated on first deploy if missing (production server)
GRAPH_CLIENT_STATE_SECRET=<random-hex>
INBOUND_MAIL_WEBHOOK_SECRET=<random-hex>

# Recommended production hardening (defaults shown)
BETA_AUTO_ADMIN=false
ALLOW_PUBLIC_REGISTRATION=false
ENABLE_SANDBOX=false
```

`DATABASE_URL` is set inside `docker-compose.yml` for the bundled PostgreSQL service. Override it if you attach an external database.

Optional integrations (Azure OpenAI, Firebase, Teams bot, Gemini) are documented in [README.md](README.md#-environment-variables-reference).

---

## Idempotency and restarts

All bootstrap steps are safe to run on **every container restart**:

| Layer | Idempotency mechanism |
|-------|----------------------|
| **Schema (`migrate`)** | `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … IF NOT EXISTS` |
| **Documents (`seed`)** | `ON CONFLICT (collection, id) DO UPDATE` for users/tickets |
| **Platform defaults** | Skips `module_config/global` if already present; upserts vault folders; inserts prompt templates only when missing; seeds persona skills only when empty |

Restarting the container will **not** overwrite custom admin edits or throw unique-constraint errors.

---

## What gets seeded automatically

After first boot (German localization defaults):

- **Polyglot Bridge** — Deutsch-first language roster in `module_config/global`
- **Credential vault folders** — `Produktion`, `VPN & Netzwerk`, `EU-West` (PostgreSQL `vault_folders`)
- **AI prompt templates** — German baselines for summarization, KB generation, RCA, translation
- **Agent persona skills** — Support-Agent, Sicherheitsanalyst, Wissensautor JSON manifests
- **Sample users & tickets** — from `src/db/seed-data.json` only when `ENABLE_DEMO_LOGIN=true` on a non-production runtime. Production boots stay userless until `/onboarding` creates the primary admin.

Demo login and vault password autofill are **disabled** in production (`ENABLE_DEMO_LOGIN` / `VITE_ENABLE_DEMO_LOGIN` are ignored when `NODE_ENV=production`).

---

## Health check

After `docker compose up`:

```bash
curl -fsS http://localhost:3000/api/health
# {"status":"ok"}
```

Production: `https://app.premtonx.cloud/api/health`

A successful health response means the full bootstrap chain completed (schema + seed + server).

---

## Manual operations (optional)

Normally unnecessary in Docker; useful for local development:

```bash
npm run db:migrate      # schema only (tsx, dev)
npm run seed            # data only (tsx, dev)
npm run db:migrate:prod # schema only (compiled)
npm run seed:prod       # data only (compiled)
```

---

## CI/CD (maintainers)

Pushes to `main` trigger `.github/workflows/deploy.yml`:

1. **Strict build gate** (`lint`, license check, `npm run build` on GitHub Actions runners)
2. **Artifact upload** — `dist/` bundle (frontend + `server.cjs`, `migrate.cjs`, `seed.cjs`)
3. **Deploy** — pull `main` on the host and `docker compose build` the multi-stage image (frontend + backend compiled inside the builder; host `dist/` is not required)
4. Post-deploy health check against `https://app.premtonx.cloud/api/health`

Database bootstrap runs inside the container entrypoint — the workflow does not SSH in to run seed manually.

**Local Docker builds** work from a clean clone:

```bash
./setup.sh
# or: docker compose up --build -d
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Container exits immediately | `JWT_SECRET` or `VAULT_ENCRYPTION_KEY` missing | Add to `.env` and recreate container |
| `PostgreSQL did not become ready` | DB container slow or wrong `DATABASE_URL` | Check `geistdesk-db` logs; verify network |
| Health 502 after boot | Bootstrap still running | Wait 30–60s; check gateway logs for `[entrypoint]` lines |
| Empty prompt library | Seed failed silently | Inspect logs for `[seed]` errors; run `docker compose exec geistdesk-gateway npm run seed:prod` once |

Gateway logs show the bootstrap sequence:

```
[entrypoint] GeistDesk production bootstrap starting...
[entrypoint] PostgreSQL is ready.
[entrypoint] Step 1/3 — deploying database schema...
[migrate] Schema deployment complete.
[entrypoint] Step 2/3 — running idempotent platform seed...
[seed] Upserted N users and M tickets...
[entrypoint] Step 3/3 — starting application server...
```
