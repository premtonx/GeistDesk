# GeistDesk Security Notes

Contributor-facing access-control invariants and regression cases. Operational secrets (JWT, vault keys, MCP tokens) must never be committed — see `.gitignore` and `.env.example`.

## Sovereignty by design

GeistDesk is positioned as a **Sovereign IT Operations Platform**: keep helpdesk, vault, knowledge, and AI workloads on infrastructure you control. Prefer local model endpoints where possible; encrypt secret envelopes at rest; scrub PII before model egress (**AI PII Shield**). Hybrid post-quantum KEM (**ML-KEM-1024 + X25519**) protects GeistExchange/GeistVault payload envelopes. Deployment patterns support regulated-industry residency expectations (e.g. GDPR, HIPAA, ITAR, ISO-oriented controls) without mandating a vendor SaaS control plane.

## Data invariants

1. **Identity integrity:** `ownerId` / `senderId` must match the authenticated user UID where applicable.
2. **Relational sync:** Ticket message access requires access to the parent ticket.
3. **Role enforcement:** Only agents/admins (verified via `/users` / RBAC) may list all tickets; customers see their own.
4. **PII protection:** Customer profile emails are restricted to the owner or admins.
5. **Terminal state:** Non-admins cannot modify tickets in `closed` status.
6. **MCP vault reveal:** `vault_get_secret` requires `vault:reveal`, a business reason, and writes an immutable audit event.
7. **API tokens:** Stored as SHA-256 hashes only; plaintext `gdk_…` values are shown once at creation.

## Regression matrix (“Dirty Dozen”)

| Test ID | Method | Collection | Payload / condition | Expected |
|---------|--------|------------|---------------------|----------|
| D-01 | create | /tickets | Setting `customerId` to someone else's UID | DENY |
| D-02 | list | /tickets | Customer fetching all tickets without ownership filter | DENY |
| D-03 | update | /tickets | Modifying `agentId` as a standard user | DENY |
| D-04 | create | /messages | Message on a ticket the user does not own | DENY |
| D-05 | delete | /kb | Non-admin deleting a global KB article | DENY |
| D-06 | create | /users | Self-registering as `admin` | DENY |
| D-07 | get | /tickets | Pathologically large ticket ID | DENY |
| D-08 | update | /tickets | Changing subject of a `closed` ticket (non-admin) | DENY |
| D-09 | create | /tickets | Missing required schema fields | DENY |
| D-10 | update | /users | User changing their own `email` arbitrarily | DENY |
| D-11 | create | /messages | Client forging `senderType: ai` | DENY |
| D-12 | list | /messages | Scraping messages across ticket threads | DENY |
