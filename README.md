# 🌟 GeistDesk: Enterprise Sovereign AI Orchestrator

GeistDesk is a secure, high-performance, and deeply integrated Customer Support portal and sovereign AI Orchestrator. Designed to respect data sovereignty and infrastructure privacy, GeistDesk is capable of being hosted in internal isolated networks while providing advanced AI-powered insights, intelligence routing, private secret management, and robust CRM functionalities.

This repository holds a modern, full-stack application leveraging **React 19 (Vite)** on the client side and an **Express.js** backend compiled as a single bundle for optimal multi-environment compatibility.

---

### 🚀 Recent Architecture Upgrades

#### 1. 🛡️ Post-Quantum Hybrid Cryptography (GeistExchange & GeistVault)
- **Hybrid Key Encapsulation (KEM):** Upgraded our secure data envelope system to a dual-layered protection model. We combine classic **X25519 (Elliptic Curve)** with **ML-KEM-1024 (Kyber)** via a **Hybrid Key Derivation Function (HKDF-SHA256)** in compliance with NIST FIPS 203. Ciphertext remains mathematically impenetrable even if one primitive is compromised.
- **Malicious-Server Tamper Defenses (v2 Payloads):** Hardened all payloads against server-mediated key substitution attacks. Payload blocks utilize **AES-256-GCM** with strict **Authenticated Additional Data (AAD)** binding context (`userId:itemId`). Verification happens entirely client-side via a strict `CryptoIntegrityError` layer before any plaintext exposure.
- **Backward Compatibility:** Implemented an automated fallback decryption pipeline (`decryptPayloadAuto`) ensuring legacy `v1` data fragments remain operational during migration cycles.

#### 2. 🤖 Interactive & Collaborative AI Checklists (Tickets Module)
- **Optimistic UI Engine:** The `Aufgaben` (Tasks) tab now features an interactive, real-time checklist synced with the Firestore JSONB layer. User state interactions offer zero-latency optimistic feedback loops with automated transaction rollback protections.
- **Bilingual Inline Custom Task Injection:** Supports native multi-language task modifications and creations with clean `Enter` and `Escape` keyboard shortcuts.
- **Visual Milestones:** Features smart responsive badges that shift to high-visibility emerald arrays upon 100% checklist milestone completion.

#### 3. 🧠 Advanced AI Orchestrator Core & Global Agent Skill Registry
- **Single-Page Sub-Tab Router Navigation:** Restructured the massive AI Management Console canvas into a high-density horizontal sub-tab framework (`🚀 Kommandozentrale`, `🧠 Agenten & Personas`, `📊 Qualität & Auditing`). This completely flattens vertical page height and eliminates scrolling fatigue while preserving active operational monitoring pipelines.
- **Permanent "Skills verwalten" Control Anchors:** Standardized a highly visible, uniform interactive card footer button across all Agent Persona profiles (`Support-Agent`, `Sicherheitsanalyst`, `Wissensautor`). Administrative access to agent brain configurations is exposed globally by default, bypassing multi-step selection layers.
- **Multi-Modal Skill Manifest Drawer:** Built a slide-out administrative editor panel allowing operators to customize an agent's runtime instructions, behavioral guardrails, and tool execution privileges. Supports twin operational pathways:
  * *Manual Configuration Canvas:* A raw, high-density text interface allowing real-time edits to system instructions or JSON/YAML tool structures.
  * *Skill File Dropzone:* A client-side `FileReader` parsing slot that allows operators to drag and drop custom `.json` or `.yaml` skill blueprints directly into the validation stream.
- **Built-In System Blueprints Library:** Embedded a set of quick-load, enterprise-optimized template blueprints (*Customer Empathy & Translation*, *Strict Auditing & Zero-Trust PII Redaction*, *Technical Markdown Documentation*). Admins can instantiate production-ready agent boundaries with a single click.
- **Global Immutability and Persistence:** Wired all mutations directly to our centralized data layer (`orchestratorService.updateAgentSkills`), ensuring that modified configurations deploy globally across all operator sessions simultaneously instead of caching locally.
- **Layout Overflows Hardened:** Solved severe compound string clipping bugs by applying fluid responsive width tracking, `min-w-0` grid recalculations, and strict `break-words` text wrapping boundaries to long titles like `KI-Qualitäts-Dashboard`.

#### 4. 📦 Secure Dropzone Pipelines & Unified UI Consistency
- **High-Density Drawer Framework:** Re-engineered the admin file-auditing telemetry layout to use a modern, expanded fixed full-height viewport canvas (`max-w-4xl`), resolving tight structural sidebar container blowouts.
- **Binary Stream Recovery:** Replaced raw placeholder actions with an authenticated, zero-leak binary blob recovery streaming pipeline (`createObjectURL`), tracking server-side retention timeouts with clean `HTTP 410` error banners.
- **KB Editor Unification:** Stripped out legacy HTML-leaking textareas within GeistKB and successfully ported over the premium markdown rich-text editing workspace framework from our Tickets canvas.

---

## 🛠️ Architecture Overview

GeistDesk utilizes a modular, robust, dual-mode full-stack architecture tailored to run either locally, inside lightweight Docker containers, or inside enterprise-grade environments backed by PostgreSQL.

### 💻 Client-Side
*   **React 19 & Vite**: Ultra-fast hot-reloading development cycle with compiled, minified production assets located inside static `dist/` directory.
*   **Tailwind CSS**: Modern utility classes paired with responsive display properties for fluid multi-device layouts.
*   **Framer Motion**: Smooth interactive animations, active sliding drawers, scale effects, and custom transition timelines.
*   **Lucide React**: Clean vector icon components.

### ⚙️ Server-Side
*   **Express compiled via esbuild**: High-efficiency Node.js application. Our bundle process uses `esbuild` to compile our production environment into a self-contained, high-performance CommonJS file: `dist/server.cjs`. This design completely avoids imports-lookup delays and enables standard, zero-overhead Docker start cycles.
*   **PostgreSQL & Local File Auto-Detect Engine**: 
    Our custom DB manager (`/src/lib/postgres-backend.ts`) automatically probes your environment. If the configuration variable `DATABASE_URL` is set, the application initializes database pools, runs DDL scripts, verifies schemas, and stores documents inside raw structured Postgres tables equipped with JSONB indexes. If Postgres is unavailable, our database engine elegantly initiates zero-dependency persistence fallback writing directly to local text-serialized file `/geistdesk_local_db.json`.

---

## 💎 Features List & Capabilities

### 1. 🎛️ Dual-Row Header Navigation & Admin Hub
*   **Double-Row Structural Separation**: An elegant layout separating user identity, notifications center, active timers, and system status indicators from the deep page-routing navigation menu. This ensures maximum horizontal space, meaning **all navigation buttons and control modules fit beautifully without truncating or overflowing**.
*   **Global Actions Profile Bar**: Access search directly using global keyboard shortcut `⌘K` or click the search prompt anywhere across pages.
*   **Live Engine Status**: Always-on visual connection status representing the state of internal system processes.

### 2. 🛡️ PII Shield Guardrails & Safety Middleware
*   **Automatic Scrubbing**: Real-time prompt safety middleware that automatically detects and redacts sensitive customer patterns.
*   **Information Redaction**: Email addresses, 16-digit credit card integers, and custom identifiable formats are masked before sending prompt packages to downstream AI endpoints, protecting customer privacy.

### 3. 📝 Dynamic Custom Schemas (Contact & Company CRM)
*   **Data Models**: Tailor fields, weights, and constraints representing incoming contact profiles (`ContactSchemaPage`) and enterprise accounts (`CompanySchemaPage`).
*   **Dynamic Data Integration**: Generates context attributes appended dynamically to raw prompt sequences during AI evaluation loops.

### 4. 🔗 Multi-Channel Email Integrations
*   Manage support aliases, configure IMAP/SMTP parameters, configure routing filters, and oversee automated inbound ticket creation workflows seamlessly (`EmailChannelsPage`).

### 5. 🔔 Active Notification Engine
*   Create automated rules, trigger real-time system banners or auditory cues, manage dispatch logs, and control template styles (`NotificationEnginePage`).

### 6. 🕒 Active Work Timer & Schedules Tracker
*   **Real-Time Tracker**: Keep track of agent online shifts, work levels, and active schedules directly inside the global header using the `WorkTimer` component.
*   **Shift Rotations**: Establish scheduled shifts, weights, and fallback queues across multiple agents inside the group directories.

### 7. 🔑 Vault Manager & Secret Vault Page
*   Securely store application keys, private company logins, and connection parameters.
*   **Shamir Secret Sharing**: Fully supports advanced data sharing protocols to divide private master keys or encrypt sensitive properties inside local profiles.

### 8. 🎫 Visual Pipelines, Kanban Board & Help Center
*   Manage customer tickets inside beautiful visually organized drag-and-drop pipeline blocks (`TicketsPage`), update logs, query knowledge bases (`KBPage`), and generate deep visual telemetry charts (`InsightsPage`).

---

## 🐳 Ready to Deploy: GitHub & Production Servers

Yes, **everything in this directory is fully production ready** for instant migration to a remote GitHub repository and custom deployment servers! 

Here is exactly how the database and demo data are prepared:

### 🗄️ Database Ready State
1.  **Dual Storage Reliability**:
    *   **In Development/Sandbox**: It automatically uses the local file `/geistdesk_local_db.json` which contains your existing root admin workspace user data (`premtonxh@gmail.com`).
    *   **In Production**: Connect your live production database by setting the `DATABASE_URL` environment variables. The server will detect it instantly on startup, automatically execute the DDL table creation scripts, and connect smoothly.
2.  **Zero-Configuration Table Generation**: On connection with Postgres, the system runs raw query commands creating the robust `geistdesk_documents` table and optimized `idx_geistdesk_documents_collection` indexes if they do not yet exist, removing manual SQL installation steps.

### 💾 First-run wizard (no default password)
*   Production boots stay uninitialized (`module_config.is_initialized=false`) with no fixture admin accounts.
*   Opening `/` or `/login` routes to `/onboarding`, where the operator creates the primary administrator.
*   Showcase demo users are seeded only when `ENABLE_DEMO_LOGIN=true` on a non-production runtime.

---

## 🚀 Easy Installation & Setup Instructions

### 1️⃣ Local Development Setup
Clone the project, install packages, and boot up the development server:
```bash
# Clone the repository (or import into your local repository)
git clone <your-repository-url>
cd geistdesk

# Install top-level and node dependency packages
npm install

# Start the Vite + Express Development Server
npm run dev
```
The client and backend server boot simultaneously at `http://localhost:3000`.

### 2️⃣ One-command turnkey deploy (recommended)
On a clean Ubuntu/Debian host (installs Docker if needed, generates `.env`, starts Postgres + API + UI + Caddy):
```bash
curl -fsSL https://raw.githubusercontent.com/premtonx/GeistDesk/main/install.sh | bash
# or from a clone:
./install.sh
./install.sh --yes   # non-interactive (localhost)
```
Host ports: **80 / 443** (Caddy), optional **25** (inbound SMTP). See **[DEPLOYMENT.md](DEPLOYMENT.md)**.

### 3️⃣ Docker / Compose (from a clone)
Multi-stage `Dockerfile` targets: `backend` (API :5000 + SMTP), `frontend` (Nginx static UI).
```bash
./setup.sh          # delegates to install.sh
# or:
docker compose up --build -d
```

**Zero-config bootstrap:** The container entrypoint deploys the PostgreSQL schema, seeds German platform defaults, and starts the server — no manual `npm run seed` required.

---

## 🔒 Environment Variables Reference

Define these secrets inside your server environment variables or within your persistent secure local environments:

```env
# Database Credentials
DATABASE_URL=postgres://your_user:your_password@your_host:5432/your_database

# Sovereign AI Integrations: Local Ollama Model OR Azure OpenAI
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=gemma

# Optional Azure OpenAI (if preferred over local Ollama)
AZURE_OPENAI_API_KEY=your_azure_openai_api_key_here
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4o

# Firebase Auth Configuration (Optional frontend bindings)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
```

Enjoy using **GeistDesk**! Keep your infrastructure sovereign, safe, and powerful! 🚀

---

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0) - see the [LICENSE](LICENSE) file for details.

Copyright (C) 2026 Premton Xhafa. All rights reserved.
