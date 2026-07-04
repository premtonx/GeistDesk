# 🌟 GeistDesk: Enterprise Sovereign AI Orchestrator

GeistDesk is a secure, high-performance, and deeply integrated Customer Support portal and sovereign AI Orchestrator. Designed to respect data sovereignty and infrastructure privacy, GeistDesk is capable of being hosted in internal isolated networks while providing advanced AI-powered insights, intelligence routing, private secret management, and robust CRM functionalities.

This repository holds a modern, full-stack application leveraging **React 19 (Vite)** on the client side and an **Express.js** backend compiled as a single bundle for optimal multi-environment compatibility.

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

### 💾 Demo Data & Admins Migration
*   The system pre-packages default login identities and seed properties directly inside the DB schema.
*   When moving to production, the root user and local assets saved in `/geistdesk_local_db.json` can be mirrored or directly seeded, ensuring no work is lost.

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

### 2️⃣ Docker Production Build
A clean and optimized `Dockerfile` is pre-configured to bundle assets, drop heavy devDependencies, isolate server outputs, and serve the application:
```bash
# Build the production docker image
docker build -t geistdesk-support-gate .

# Run the docker container locally or on your remote host
docker run -p 3000:3000 \
  -e PG_DATABASE_URL="postgres://username:password@your-db-host:5432/db_name" \
  geistdesk-support-gate
```

### 3️⃣ Docker-Compose Multi-Container Orchestration
A custom `docker-compose.yml` file is provided, mapping essential environment variables and allowing quick, scaling deployments:
```bash
# Bring the service up under high performance container isolation
docker-compose up --build -d
```

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
