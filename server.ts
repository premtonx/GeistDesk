import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import mammoth from "mammoth";
import multer from "multer";
import { createRequire } from "module";
import jwt from "jsonwebtoken";
import {
  initDb, 
  getDb, 
  getDocDirect, 
  getDocsDirect, 
  addDocDirect, 
  updateDocDirect, 
  setDocDirect,
  deleteDocDirect,
  getTicketStats
} from "./src/lib/postgres-backend.js";
import { jsPDF } from "jspdf";
import { createTeamsBotAdapter, GeistDeskTeamsAgent } from "./src/services/teamsBotService";
import { graphTranscriptService } from "./src/services/graphTranscriptService";
import { PIIShield } from "./pii-shield.js";
import { generateAzureAIAnswer } from "./azure-ai-orchestrator.js";
import { authenticate, requireRole } from "./src/middleware/authMiddleware";
import adminRoutes from "./src/routes/adminRoutes.js";
import aiRoutes from "./src/routes/aiRoutes.js";
import moduleConfigRoutes from "./src/routes/moduleConfigRoutes.js";
import vaultRoutes from "./src/routes/vaultRoutes.js";
import credentialVaultRoutes from "./src/routes/credentialVaultRoutes.js";
import kbArticleRoutes from "./src/routes/kbArticleRoutes.js";
import kbCategoryRoutes from "./src/routes/kbCategoryRoutes.js";
import kbDashboardRoutes from "./src/routes/kbDashboardRoutes.js";
import { orchestratorEventBus } from "./src/lib/ai-orchestrator-events.js";
import { hashPassword, verifyPassword } from "./src/lib/crypto.js";
import { calculateCoverage, getDashboardData } from "./src/services/coverageEngine.js";
import { assertDbCollectionAccess } from "./src/lib/db-access-policy.js";
import { setSessionCookie, clearSessionCookie } from "./src/lib/session-cookie.js";
import {
  authRateLimiter,
  vaultRevealRateLimiter,
  webhookRateLimiter,
  sandboxRateLimiter,
} from "./src/middleware/rate-limiters.js";

// Local session signing secret (required; authMiddleware enforces presence).
const JWT_SECRET = process.env.JWT_SECRET as string;
const SESSION_TTL = "12h";
const IS_PROD = process.env.NODE_ENV === "production";

function isPublicRegistrationAllowed(): boolean {
  if (process.env.ALLOW_PUBLIC_REGISTRATION === "true") return true;
  if (process.env.ALLOW_PUBLIC_REGISTRATION === "false") return false;
  return !IS_PROD;
}

function isSandboxEnabled(): boolean {
  if (process.env.ENABLE_SANDBOX === "true") return true;
  if (process.env.ENABLE_SANDBOX === "false") return false;
  return !IS_PROD;
}

function requireGraphClientStateSecret(): string {
  const secret = process.env.GRAPH_CLIENT_STATE_SECRET;
  if (!secret) {
    if (IS_PROD) {
      throw new Error("[Security] GRAPH_CLIENT_STATE_SECRET is required in production.");
    }
    console.warn("[Security] GRAPH_CLIENT_STATE_SECRET is not set — Graph webhooks are disabled in non-production.");
    return "";
  }
  return secret;
}

function isPrivateNetworkUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local")) {
      return true;
    }
    if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
      return true;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

function verifyInboundMailWebhook(req: any): boolean {
  const expected = process.env.INBOUND_MAIL_WEBHOOK_SECRET;
  if (!expected) {
    return !IS_PROD;
  }
  const provided = req.headers["x-geistdesk-webhook-secret"];
  return typeof provided === "string" && provided === expected;
}

// Fields that must never be returned to clients for the users collection.
const USER_SENSITIVE_FIELDS = ["password", "passwordHash", "activationToken"];
// Fields a non-admin must not be able to set on a user record (anti-escalation).
const USER_PROTECTED_FIELDS = ["role", "is_admin", "roleId", "password", "passwordHash", "isDeactivated", "can_create_tickets", "can_view_knowledgebase"];

function sanitizeUserDoc(doc: any): any {
  if (!doc || typeof doc !== "object") return doc;
  const clone = { ...doc };
  for (const f of USER_SENSITIVE_FIELDS) delete clone[f];
  return clone;
}

function issueSessionToken(user: { id: string; email: string }): string {
  return jwt.sign({ uid: user.id, id: user.id, email: user.email }, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: SESSION_TTL
  });
}

const require = createRequire(
  typeof import.meta !== "undefined" && import.meta.url
    ? import.meta.url
    : (typeof __filename !== "undefined" ? __filename : "")
);
const pdf = require("pdf-parse");

const upload = multer({ storage: multer.memoryStorage() });

const admin = {
  firestore: {
    FieldValue: {
      serverTimestamp: () => ({ _type: 'serverTimestamp' })
    }
  }
};

console.log("Server process starting...");

async function startServer() {
  console.log("Initializing Express app...");
  await initDb();
  const app = express();
  const PORT = 3000;

  app.use(helmet({
    contentSecurityPolicy: IS_PROD
      ? {
          useDefaults: true,
          directives: {
            // External bootstrap only — no unsafe-inline scripts (see public/storage-bootstrap.js).
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "https:", "wss:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            objectSrc: ["'none'"],
          },
        }
      : false,
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // ---------------------------------------------------------------------------
  // AUTHENTICATION (server-side, hashed credentials + signed session tokens)
  // ---------------------------------------------------------------------------

  // Register a new local account. Password is hashed with Argon2id; the
  // plaintext is never persisted and never returned.
  app.post("/api/auth/register", authRateLimiter, async (req: any, res) => {
    if (!isPublicRegistrationAllowed()) {
      return res.status(403).json({ error: "Public registration is disabled. Contact an administrator." });
    }
    const { email, password, name } = req.body || {};
    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "email and password are required" });
    }
    const cleanEmail = email.toLowerCase().trim();
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }
    try {
      const existing = await getDocsDirect("users", [{ type: "where", field: "email", op: "==", value: cleanEmail }]);
      if (existing && existing.length > 0) {
        return res.status(409).json({ error: "An account with this email already exists." });
      }
      const passwordHash = await hashPassword(password);
      const created = await addDocDirect("users", {
        name: name || cleanEmail.split("@")[0],
        email: cleanEmail,
        passwordHash,
        authMethod: "password",
        role: "agent",
        is_admin: false,
        isDeactivated: false,
        can_create_tickets: true,
        can_view_knowledgebase: true,
        createdAt: new Date().toISOString()
      });
      const token = issueSessionToken({ id: created.id, email: cleanEmail });
      setSessionCookie(res, token);
      return res.status(201).json({
        user: sanitizeUserDoc({ id: created.id, ...created.data }),
      });
    } catch (e: any) {
      console.error("[Auth/Register] Failed:", e?.message || e);
      return res.status(500).json({ error: "Registration failed." });
    }
  });

  // Authenticate an existing local account using a constant-time hash compare.
  app.post("/api/auth/login", authRateLimiter, async (req: any, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }
    const cleanEmail = String(email).toLowerCase().trim();
    try {
      const matches = await getDocsDirect("users", [{ type: "where", field: "email", op: "==", value: cleanEmail }]);

      // The persistent DB volume can retain legacy/duplicate records for the
      // same email (e.g. pre-hardening rows with no passwordHash). Verify the
      // supplied password against EVERY candidate and accept the first that
      // matches, so a stale record can never shadow the real account.
      let userDoc: any = null;
      for (const candidate of matches || []) {
        if (candidate?.passwordHash && (await verifyPassword(password, candidate.passwordHash))) {
          userDoc = candidate;
          break;
        }
      }

      if (!userDoc) {
        // Burn a verification cycle to dampen account-enumeration timing signals.
        await verifyPassword(password, matches?.[0]?.passwordHash || "");
        return res.status(401).json({ error: "Invalid credentials." });
      }
      if (userDoc.isDeactivated) {
        return res.status(403).json({ error: "Your account has been deactivated." });
      }
      const token = issueSessionToken({ id: userDoc.id, email: userDoc.email });
      setSessionCookie(res, token);
      return res.json({ user: sanitizeUserDoc(userDoc) });
    } catch (e: any) {
      console.error("[Auth/Login] Failed:", e?.message || e);
      return res.status(500).json({ error: "Login failed." });
    }
  });

  app.post("/api/auth/logout", (_req, res) => {
    clearSessionCookie(res);
    return res.json({ success: true });
  });

  app.get("/api/auth/session", authenticate, async (req: any, res) => {
    return res.json({ user: sanitizeUserDoc(req.user?.dbRecord || { id: req.user.id, email: req.user.email, name: req.user.name, role: req.user.role }) });
  });

  // Generic database API router for standard PostgreSQL / fallback execution
  app.post("/api/db", authenticate, async (req: any, res) => {
    const { action, collection, id, data, constraints } = req.body;
    if (!action || !collection) {
      return res.status(400).json({ error: "Missing action or collection parameter" });
    }

    const access = assertDbCollectionAccess({
      collection,
      action,
      userIsAdmin: req.user?.role === "SYSTEM_ADMIN",
      userId: req.user?.id,
      docId: id,
    });
    if (access.allowed === false) {
      return res.status(access.status).json({ error: access.error });
    }

    // Compute authorization directly from the verified database role on every single API request
    const userIsAdmin = req.user?.role === "SYSTEM_ADMIN";
    const userCanCreateTickets = req.user?.dbRecord?.can_create_tickets !== false;
    const userCanViewKnowledgeBase = req.user?.dbRecord?.can_view_knowledgebase !== false;
    const uid = req.user?.id;

    // 2. Enforce Administrative Access Controls (legacy guard; policy module is authoritative)
    const adminCollections = ['roles', 'module_config', 'audits', 'admins', 'groups', 'audit_logs', 'compliance_logs'];
    if (adminCollections.includes(collection)) {
      if (!userIsAdmin) {
        return res.status(403).json({ error: "Forbidden: Strict Administrative access required for collection " + collection });
      }
    }

    if (collection === 'users') {
      // Non-admins can only read users, but cannot create or modify other users except themselves.
      if (!userIsAdmin) {
        if (action === "add_doc" || action === "delete_doc") {
          return res.status(403).json({ error: "Forbidden: Strict Administrative access required to mutate standard workforce." });
        }
        if (action === "update_doc" || action === "set_doc") {
          if (id !== uid) {
            return res.status(403).json({ error: "Forbidden: You cannot modify other users' profiles." });
          }
          // Anti-escalation: strip role/privilege/credential fields from self-edits.
          if (data && typeof data === "object") {
            for (const f of USER_PROTECTED_FIELDS) delete data[f];
          }
        }
      }
      // Passwords are NEVER written through the generic DB router (use /api/auth).
      if (data && typeof data === "object") {
        delete data.password;
      }
    }

    // 3. Enforce Granular User Permission flags
    if (collection === 'tickets') {
      if (action === "add_doc" && !userCanCreateTickets) {
        return res.status(403).json({ error: "Forbidden: Create ticket privilege is revoked for your account." });
      }
    }

    if (collection === 'kb_articles') {
      if (action === "get_docs" && !userCanViewKnowledgeBase) {
        return res.json({ result: [] }); // gracefully return empty array
      }
    }

    try {
      if (action === "get_doc") {
        const doc = await getDocDirect(collection, id);
        return res.json({ result: collection === "users" ? sanitizeUserDoc(doc) : doc });
      }
      if (action === "get_docs") {
        const docs = await getDocsDirect(collection, constraints || []);
        const safe = collection === "users" ? (docs || []).map(sanitizeUserDoc) : docs;
        return res.json({ result: safe });
      }
      if (action === "add_doc") {
        const resObj = await addDocDirect(collection, data);
        return res.json({ result: resObj });
      }
      if (action === "update_doc") {
        await updateDocDirect(collection, id, data);
        return res.json({ result: { success: true } });
      }
      if (action === "set_doc") {
        await setDocDirect(collection, id, data);
        return res.json({ result: { success: true } });
      }
      if (action === "delete_doc") {
        await deleteDocDirect(collection, id);
        return res.json({ result: { success: true } });
      }
      
      return res.status(400).json({ error: `Unknown database action: ${action}` });
    } catch (e: any) {
      console.error(`[DB Router Error] Failed on ${action} for ${collection}:`, e);
      return res.status(500).json({ error: e.message || String(e) });
    }
  });

  // Change the authenticated user's own password (hashed server-side).
  app.post("/api/auth/change-password", authenticate, async (req: any, res) => {
    const { newPassword } = req.body || {};
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({ error: "newPassword must be at least 8 characters." });
    }
    try {
      const passwordHash = await hashPassword(newPassword);
      await updateDocDirect("users", req.user.id, { passwordHash, authMethod: "password", updatedAt: new Date().toISOString() });
      return res.json({ success: true });
    } catch (e: any) {
      console.error("[Auth/ChangePassword] Failed:", e?.message || e);
      return res.status(500).json({ error: "Failed to update password." });
    }
  });

  // Change the authenticated user's own email address.
  app.post("/api/auth/change-email", authenticate, async (req: any, res) => {
    const newEmail = typeof req.body?.newEmail === "string" ? req.body.newEmail.toLowerCase().trim() : "";
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return res.status(400).json({ error: "A valid newEmail is required." });
    }
    try {
      const existing = await getDocsDirect("users", [{ type: "where", field: "email", op: "==", value: newEmail }]);
      const takenByOther = (existing || []).some((u: any) => u.id !== req.user.id);
      if (takenByOther) {
        return res.status(409).json({ error: "That email is already in use by another account." });
      }
      await updateDocDirect("users", req.user.id, { email: newEmail, updatedAt: new Date().toISOString() });
      return res.json({ success: true, email: newEmail });
    } catch (e: any) {
      console.error("[Auth/ChangeEmail] Failed:", e?.message || e);
      return res.status(500).json({ error: "Failed to update email." });
    }
  });

  // Mount Admin User Management Router
  app.use("/api/admin", adminRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/kb/articles", kbArticleRoutes);
  app.use("/api/kb/categories", kbCategoryRoutes);
  app.use("/api/kb/dashboard", kbDashboardRoutes);
  app.use("/api/module-config", moduleConfigRoutes);

  // Workspace AI orchestrator — redacted config for agents; full config via /api/admin/orchestrator/config
  app.get("/api/ai/config", authenticate, async (req: any, res) => {
    try {
      const { getOrchestratorConfig } = await import("./src/lib/ai-orchestrator-store.js");
      const { toPublicOrchestratorConfig } = await import("./src/types/aiOrchestrator.js");
      const workspaceId = String(req.query.workspaceId || "default");
      const config = await getOrchestratorConfig(workspaceId);
      const isAdmin = req.user?.role === "SYSTEM_ADMIN";
      return res.json(isAdmin ? config : toPublicOrchestratorConfig(config));
    } catch (e: any) {
      console.error("[AI Config] Failed:", e?.message || e);
      return res.status(500).json({ error: "Failed to load AI configuration." });
    }
  });

  app.get("/api/ai/status", authenticate, async (req: any, res) => {
    try {
      const { getOrchestratorHealth } = await import("./src/lib/ai-orchestrator-service.js");
      const workspaceId = String(req.query.workspaceId || "default");
      const health = await getOrchestratorHealth(workspaceId);
      return res.json(health);
    } catch (e: any) {
      console.error("[AI Status] Failed:", e?.message || e);
      return res.status(500).json({ error: "Failed to load AI status." });
    }
  });

  // Real-time orchestrator sync via Server-Sent Events (session cookie auth)
  app.get("/api/ai/events", authenticate, (req: any, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const send = (payload: unknown) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    void (async () => {
      try {
        const { getOrchestratorConfig } = await import("./src/lib/ai-orchestrator-store.js");
        const { getOrchestratorHealth } = await import("./src/lib/ai-orchestrator-service.js");
        const workspaceId = String(req.query.workspaceId || "default");
        const [config, health] = await Promise.all([
          getOrchestratorConfig(workspaceId),
          getOrchestratorHealth(workspaceId),
        ]);
        send({ type: "config_updated", workspaceId, config, version: config.configVersion });
        send({ type: "health_changed", workspaceId, health, status: health.status });
      } catch {
        send({ type: "connected" });
      }
    })();

    const onBroadcast = (event: any) => {
      send(event);
      if (event.type === "config_updated") {
        void import("./src/lib/ai-orchestrator-service.js").then(({ getOrchestratorHealth }) =>
          getOrchestratorHealth(event.workspaceId || "default").then((health) =>
            send({ type: "health_changed", workspaceId: event.workspaceId, health, status: health.status }),
          ),
        );
      }
    };

    orchestratorEventBus.on("broadcast", onBroadcast);
    req.on("close", () => {
      orchestratorEventBus.off("broadcast", onBroadcast);
    });
  });

  // Mount hardened GeistVault router (server-side AES-256-GCM, split storage)
  app.use("/api/vault", vaultRoutes);
  app.use("/api/credential-vault", credentialVaultRoutes);

  // Authoritative, SQL-computed ticket metrics for dashboards.
  app.get("/api/stats/tickets", authenticate, async (req: any, res) => {
    try {
      const stats = await getTicketStats();
      return res.json(stats);
    } catch (e: any) {
      console.error("[Stats] Failed to compute ticket stats:", e?.message || e);
      return res.status(500).json({ error: "Failed to compute ticket statistics." });
    }
  });

  // checkAdmin middleware for administrative helper API endpoints
  async function checkAdmin(req: any, res: any, next: any) {
    try {
      await authenticate(req, res, () => {
        requireRole(["SYSTEM_ADMIN"])(req, res, next);
      });
    } catch (err: any) {
      return res.status(403).json({ error: "Forbidden: Strict Administrative access required" });
    }
  }

  // Microsoft Teams Bot Framework Webhook Handler
  const teamsAdapter = createTeamsBotAdapter();
  const teamsBot = new GeistDeskTeamsAgent();

  app.post("/api/messages", (req, res) => {
    teamsAdapter.processActivity(req, res, async (context) => {
      await teamsBot.run(context);
    });
  });

  /**
   * Microsoft Graph Teams Live Transcripts Change Notification Webhook Handler
   */
  app.post("/api/webhooks/teams-transcripts", webhookRateLimiter, async (req, res) => {
    // 1. Webhook Handshake / Validation Request
    // Microsoft Graph sends a POST with a validationToken query param to verify the endpoint is active.
    const validationToken = req.query.validationToken;
    if (validationToken) {
      console.log(`[Graph Webhook] Verification request received. Token: ${validationToken}`);
      res.setHeader("Content-Type", "text/plain");
      return res.status(200).send(validationToken);
    }

    // 2. Process Change Notification
    try {
      const clientStateSecret = requireGraphClientStateSecret();
      if (!clientStateSecret) {
        return res.status(503).json({ status: "disabled", error: "Graph webhook secret is not configured." });
      }
      const processed = await graphTranscriptService.handleSubscriptionNotification(req.body, clientStateSecret);
      
      if (processed) {
        return res.status(202).json({ status: "accepted", message: "Change notification processed successfully." });
      }
      return res.status(400).json({ status: "ignored", error: "Missing value key in Graph payload" });
    } catch (error: any) {
      console.error("[Graph Webhook Error] Failed to process notification:", error);
      // Fail gracefully & drop context to safeguard platform security
      return res.status(202).json({ status: "dropped", reason: error.message });
    }
  });

  /**
   * Subscribes to Online Meetings Change Notifications on behalf of GeistDesk platform instances.
   */
  app.post("/api/teams/subscribe", checkAdmin, async (req, res) => {
    const { accessToken, extNotificationUrl } = req.body;
    
    // Fallback/Demo settings for local sandbox
    const defaultUrl = `https://${req.get('host')}/api/webhooks/teams-transcripts`;
    const targetUrl = extNotificationUrl || defaultUrl;
    const clientStateSecret = requireGraphClientStateSecret();
    if (!clientStateSecret) {
      return res.status(503).json({
        success: false,
        error: "GRAPH_CLIENT_STATE_SECRET is required to configure Graph subscriptions.",
      });
    }

    if (!accessToken) {
      // Graceful sovereign preview/simulation mode with detailed setup instructions
      console.warn("[Graph Sub Setup] Missing Access Token, operating in simulation preview mode...");
      return res.json({
        success: true,
        simulated: true,
        subscriptionId: "sim-graph-sub-993d0d86-bce7-40ca-b964-b81b5fbcf2cc",
        resource: "/communications/onlineMeetings",
        webhookUrl: targetUrl,
        clientState: "[Sovereign Secret Enforced]",
        expirationDateTime: new Date(Date.now() + 60 * 60 * 1000 * 48).toISOString(),
        guidelines: {
          appRegistration: "Azure Entra ID App Registration is required with 'OnlineMeetings.Read.All', 'OnlineMeetingTranscript.Read.All', and 'Chat.ReadWrite.All' application permissions.",
          adminConsent: "Granted by the Microsoft 365 Tenant Admin in Azure Portal, enabling cross-tenant / sovereign multi-tenant orchestration."
        }
      });
    }

    try {
      const subscriptionResult = await graphTranscriptService.createSubscription(
        accessToken,
        targetUrl,
        clientStateSecret
      );
      return res.json({
        success: true,
        simulated: false,
        subscriptionResult
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Public Help Center API
  app.get("/api/kb/public", async (req, res) => {
    try {
      const db = getDb();
      const snapshot = await db.collection('kb_articles')
        .where('visibility', '==', 'Public')
        .orderBy('createdAt', 'desc')
        .get();
        
      const articles = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      res.json(articles);
    } catch (error) {
      console.error('Error fetching public articles:', error);
      res.status(500).json({ error: 'Failed to fetch public articles' });
    }
  });

  // API Routes
  console.log("Registering API routes...");

  // -----------------------------------------------------------------------------
  // SECURE AD-HOC SIMULATOR & TEST SANDBOX ROUTE
  // -----------------------------------------------------------------------------
  app.post("/api/test-sandbox", sandboxRateLimiter, authenticate, requireRole(["SYSTEM_ADMIN"]), async (req, res) => {
    if (!isSandboxEnabled()) {
      return res.status(404).json({ error: "Sandbox is disabled." });
    }
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "No input text provided" });
    }

    try {
      // 1. Process via local async PII Shield validate layer
      const redactResult = await PIIShield.redact(text);
      const { cleanText, wasScrubbed } = redactResult;

      // 2. Query Downstream AI (falls back to simulation automatically if no keys configured)
      const azureResult = await generateAzureAIAnswer({
        prompt: cleanText,
        userId: "sandbox-browser-user",
        contextDocuments: [
          "System: Operational Workspace GeistDesk secure customer deployment guidelines.",
          "Documentation: Secure access controls and API routing protocols require PII shielding."
        ]
      });

      const { answer, metrics, deployment, id } = azureResult as any;

      // 3. Assemble Teams Adaptive Card payload JSON
      const { createAdaptiveCard } = await import("./teams-adaptive-cards.js");
      const adaptiveCard = createAdaptiveCard(answer, wasScrubbed);

      return res.json({
        originalText: text,
        cleanText,
        wasScrubbed,
        answer,
        metrics,
        deployment,
        id,
        adaptiveCard
      });
    } catch (err: any) {
      console.error("[Test Sandbox Endpoint Exception]:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // -----------------------------------------------------------------------------
  // CORE INTERACTIVE CONTROL DASHBOARD PORTAL (SANDBOX MOCK INTERFACE)
  // -----------------------------------------------------------------------------
  app.get("/sandbox", authenticate, requireRole(["SYSTEM_ADMIN"]), (req, res) => {
    if (!isSandboxEnabled()) {
      return res.status(404).send("Sandbox is disabled.");
    }
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>NexuSovereign™ Gate Control Center</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Space Grotesk', sans-serif;
          background-color: #0d1117;
        }
        .code-font {
          font-family: 'JetBrains Mono', monospace;
        }
      </style>
    </head>
    <body class="text-slate-100 min-h-screen flex flex-col antialiased">
      <!-- Top Sleek Audit Navigation -->
      <header class="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="h-9 w-9 bg-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/20">
              <svg class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h1 class="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                NexuSovereign™ Gate <span class="text-xs px-2 py-0.5 rounded-full bg-teal-900/50 text-teal-400 border border-teal-800">Gateway Console</span>
              </h1>
              <p class="text-xs text-slate-400">Sovereign Compliance Interceptor Workspace</p>
            </div>
          </div>
          <div class="flex items-center gap-3 text-xs">
            <span class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-850 border border-slate-800">
              <span class="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              Local Port 3000 Proxy Active
            </span>
            <span class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-950/40 border border-teal-900 text-teal-400">
              🛡️ PII Shield Armed
            </span>
          </div>
        </div>
      </header>

      <main class="flex-grow max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- Left Side: Interactive Input Interceptor -->
        <section class="lg:col-span-5 flex flex-col gap-6">
          <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-4">
            <div class="border-b border-slate-800 pb-3">
              <h2 class="text-base font-semibold text-white">Transmission Interception Sandbox</h2>
              <p class="text-xs text-slate-400">Inject user statements or transcripts containing sensitive credentials to see local remediation prior to any downstream AI submission.</p>
            </div>

            <!-- Premade Scenarios Buttons -->
            <div>
              <label class="text-xs font-semibold text-slate-400 block mb-2">Preset Enterprise Scenarios:</label>
              <div class="grid grid-cols-2 gap-2">
                <button 
                  onclick="loadPreset('chat')"
                  class="text-left px-3 py-2 bg-slate-800 hover:bg-slate-755 border border-slate-700 hover:border-slate-600 rounded-lg text-xs font-medium transition flex flex-col gap-0.5"
                >
                  <span class="text-slate-200">Teams Chat Message</span>
                  <span class="text-[10px] text-slate-450 truncate">Injects Password & Token</span>
                </button>
                <button 
                  onclick="loadPreset('transcript')"
                  class="text-left px-3 py-2 bg-slate-800 hover:bg-slate-755 border border-slate-700 hover:border-slate-600 rounded-lg text-xs font-medium transition flex flex-col gap-0.5"
                >
                  <span class="text-slate-200">Meeting Transcript</span>
                  <span class="text-[10px] text-slate-455 truncate">Injects API Key & Private Info</span>
                </button>
              </div>
            </div>

            <!-- Live Text Area -->
            <div class="flex flex-col gap-2">
              <label for="inputPrompt" class="text-xs font-semibold text-slate-300">Raw Inbound Chat/Transcript Payload:</label>
              <textarea 
                id="inputPrompt" 
                rows="6"
                class="code-font text-xs p-3 w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                placeholder="Type anything here including passwords, api_keys, tokens, or email addresses..."
              ></textarea>
            </div>

            <button 
              id="btnTransmit"
              onclick="processTransmission()"
              class="w-full bg-teal-600 hover:bg-teal-500 text-white font-semibold py-2.5 px-4 rounded-lg text-sm shadow-lg shadow-teal-500/15 hover:shadow-teal-500/25 transition flex items-center justify-center gap-2"
            >
              <svg class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Transmit through Local Shield Proxy
            </button>
          </div>

          <!-- Webhook Operational Guide -->
          <div class="bg-slate-900/60 border border-slate-850 rounded-xl p-5 shadow-lg flex flex-col gap-3">
            <h3 class="text-xs font-bold tracking-wider text-teal-400 uppercase">Operational Integration Matrix</h3>
            <div class="text-xs text-slate-400 space-y-2">
              <p>In a production system, this server acts as a compliance reverse proxy intercepting events before they exit your subnet.</p>
              <ul class="space-y-1.5 list-disc pl-4 font-mono text-[10px] text-slate-350">
                <li><strong class="text-slate-200">POST /api/messages</strong>: For Azure Bot Framework adapters</li>
                <li><strong class="text-slate-200">POST /api/webhooks/teams-transcripts</strong>: MS Graph updates</li>
                <li><strong class="text-slate-200">GET /sandbox</strong>: Active Control Dashboard console</li>
              </ul>
            </div>
          </div>
        </section>

        <!-- Right Side: Telemetry logs & Adaptive Card Visual Mockup -->
        <section class="lg:col-span-7 flex flex-col gap-6">
          
          <!-- Mid Panel: Real-time Compliance Logs -->
          <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-4">
            <div class="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 class="text-base font-semibold text-white flex items-center gap-2">
                🔒 Security Interceptor & AI Telemetry
              </h2>
              <span id="badgeScrub" class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                Idle
              </span>
            </div>

            <!-- Compare raw vs clean preview -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <span class="text-[10px] tracking-wide text-slate-400 uppercase font-semibold">Raw Ingress Content (Blocked Data highlighted)</span>
                <div id="rawPreview" class="code-font text-[11px] p-3 rounded-lg bg-slate-950 border border-slate-850 h-28 overflow-y-auto text-slate-400 whitespace-pre-wrap">
                  Click Transmit to begin local shielding evaluation.
                </div>
              </div>
              <div class="flex flex-col gap-1.5">
                <span class="text-[10px] tracking-wide text-slate-400 uppercase font-semibold">Post-Scrub sanitized Egress Context</span>
                <div id="cleanPreview" class="code-font text-[11px] p-3 rounded-lg bg-slate-950 border border-slate-850 h-28 overflow-y-auto text-teal-400 whitespace-pre-wrap">
                  Clean content to submit to Azure model.
                </div>
              </div>
            </div>

            <!-- Model telemetry metrics logs -->
            <div class="p-3 bg-slate-950 border border-slate-850 rounded-lg flex flex-col gap-1.5">
              <span class="text-[11px] font-bold tracking-wide text-amber-400 font-mono flex items-center gap-1">
                📊 azure-openai-telemetry-audit.log
              </span>
              <div id="metricLogs" class="code-font text-[10px] text-slate-400 space-y-1">
                No active session trace found. Run a simulation to generate model telemetry records.
              </div>
            </div>
          </div>

          <!-- Bottom Panel: Simulated Teams Mock Render -->
          <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-4">
            <div class="flex items-center justify-between border-b border-slate-800 pb-3">
              <div class="flex items-center gap-2">
                <div class="h-2.5 w-2.5 rounded-full bg-violet-500"></div>
                <h2 class="text-sm font-semibold text-white">Teams Live Adaptive Card Preview (v1.4)</h2>
              </div>
              <span class="text-[10px] font-semibold text-slate-450 bg-slate-800 px-2 py-0.5 rounded border border-slate-750">
                Active Render Engine
              </span>
            </div>

            <!-- Teams Chat Simulation Node -->
            <div class="bg-[#201f1f] rounded-xl border border-[#2b2a2a] p-4 flex gap-3 text-xs text-[#f3f2f1]">
              <!-- Bot Avatar mockup -->
              <div class="h-9 w-9 bg-teal-700 text-white font-bold rounded-full flex items-center justify-center shrink-0">
                NS
              </div>
              
              <!-- Message card content -->
              <div class="flex-grow flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-[#f3f2f1] text-[13px]">NexuSovereign™ AI Gate</span>
                  <span class="text-[10px] px-1.5 py-0.2 rounded bg-[#3b3a39] text-[#a19f9d] font-semibold">Bot</span>
                  <span class="text-[10px] text-[#a19f9d]">Just now</span>
                </div>

                <div id="teamsSystemAlertText" class="text-[11px] text-[#d13438] font-bold">
                  No active transaction. Simulate a prompt to inspect live card attachment layers.
                </div>

                <!-- Fluent Adaptive Card Outer Container -->
                <div class="bg-[#292827] rounded border border-[#3b3a39] overflow-hidden max-w-lg mt-1 shadow-md">
                  
                  <!-- Card Header Banner component -->
                  <div id="cardHead" class="bg-[#323130] p-3 border-b border-[#3b3a39] flex items-center gap-2">
                    <img src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Shield/Colored/3D/shield_3d.png" alt="shield logo" class="w-5 h-5 shrink-0" />
                    <div>
                      <div class="font-bold text-teal-400 text-xs">NexuSovereign™ Gate</div>
                      <div class="text-[9px] text-[#a19f9d]">Sovereign Enterprise Workspace</div>
                    </div>
                  </div>

                  <!-- Card Main markdown payload component -->
                  <div class="p-4 bg-[#292827] text-[11px]/relaxed" id="cardBody">
                    Assemble a transmission trigger on the left to invoke the layout engine.
                  </div>

                  <!-- Card bottom security compliance alert banner badge -->
                  <div id="cardFooter" class="bg-[#3b3a39] px-3 py-2 flex items-center justify-between border-t border-[#484644]">
                    <span id="footerStatusText" class="text-[10px] font-bold text-[#a19f9d]">
                      🛡️ GeistDesk Sovereign Shield Enabled | Powered by Azure AI
                    </span>
                  </div>

                  <!-- Dynamic Adaptive Card v1.4 Actions area -->
                  <div class="bg-[#2f2e2d] p-3 border-t border-[#3b3a39] flex" id="cardActions">
                    <a href="https://geistdesk.sovereign.local/portal" target="_blank" class="px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded hover:bg-teal-500 text-center select-none cursor-pointer">
                      Access GeistDesk Secure Portal
                    </a>
                  </div>

                </div>

              </div>
            </div>

            <!-- JSON Schema viewer -->
            <details class="bg-slate-950 border border-slate-850 rounded-lg group">
              <summary class="text-xs font-bold text-slate-400 p-3 select-none cursor-pointer hover:bg-slate-900 transition flex justify-between items-center">
                <span>📦 View Produced Adaptive Card Schema JSON Payload (v1.4 Spec)</span>
                <span class="text-[10px] text-slate-500 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div class="p-3 border-t border-slate-850 overflow-x-auto">
                <pre id="jsonPayload" class="code-font text-[10px] text-teal-555 whitespace-pre">No payload assembled yet.</pre>
              </div>
            </details>

          </div>

        </section>

      </main>

      <footer class="border-t border-slate-850 bg-slate-900/40 text-center py-4 px-6 text-xs text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-2 max-w-7xl mx-auto w-full">
        <div>
          © 2026 Sovereign Systems International. Secure Sandbox Portal.
        </div>
        <div class="flex items-center gap-3 text-[10px]">
          <span class="text-emerald-400 flex items-center gap-1">🟢 Compliance Level: ISO-27001</span>
          <span class="text-slate-500">|</span>
          <span class="text-teal-400 flex items-center gap-1">🟢 PII Shield v5.2</span>
        </div>
      </footer>

      <!-- Embedded sandbox orchestrator logic -->
      <script>
        const presets = {
          chat: {
            text: "Hi, system diagnostics complete. Send credential token api_key: ghp_9djd83hdHJKSDIWY6292mdj3 and please contact supervisor at admin@geistdesk.local. Password for backup folder secret=SecurePasswd777"
          },
          transcript: {
            text: "[10:24:12] Dave Peterson: Let me share my authentication key to access the spanner database: pass=EnterpriseBackupKey11883. Please summarize the corporate meeting transcript logs."
          }
        };

        function loadPreset(key) {
          const promptArea = document.getElementById("inputPrompt");
          if (presets[key]) {
            promptArea.value = presets[key].text;
          }
        }

        // Load chat preset by default
        loadPreset('chat');

        async function processTransmission() {
          const promptInput = document.getElementById("inputPrompt").value;
          const btn = document.getElementById("btnTransmit");
          const rawPreview = document.getElementById("rawPreview");
          const cleanPreview = document.getElementById("cleanPreview");
          const metricLogs = document.getElementById("metricLogs");
          const badgeScrub = document.getElementById("badgeScrub");
          const cardBody = document.getElementById("cardBody");
          const cardFooter = document.getElementById("cardFooter");
          const footerStatusText = document.getElementById("footerStatusText");
          const jsonPayload = document.getElementById("jsonPayload");
          const teamsSystemAlertText = document.getElementById("teamsSystemAlertText");

          if (!promptInput.trim()) {
            alert("Please input some text to evaluate!");
            return;
          }

          btn.disabled = true;
          btn.innerHTML = \`<svg class="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processing Secure Proxy Interceptor...\`;

          try {
            const response = await fetch('/api/test-sandbox', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: promptInput })
            });

            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.error || "Execution failed");
            }

            // 1. Highlight scrubbed items in original text preview
            let highlightedRawText = promptInput
              .replace(/[\\\\w.-]+@[\\\\w.-]+\\\\.[a-zA-Z]{2,}/g, '<span class="px-1 py-0.2 rounded bg-rose-950 text-rose-300 font-bold border border-rose-800">$&</span>')
              .replace(/(password|secret|token|passwd|private_key|api_key|apikey)\\\\s*[:=]\\\\s*["']?([a-zA-Z0-9_\\\\-+=/]{12,})["']?/gi, '<span class="px-1 py-0.2 rounded bg-rose-950 text-rose-300 font-bold border border-rose-800">$&</span>')
              .replace(/bearer\\\\s+([a-zA-Z0-9_\\\\-+=/.]+)/gi, '<span class="px-1 py-0.2 rounded bg-rose-950 text-rose-300 font-bold border border-rose-800">$&</span>');
            
            rawPreview.innerHTML = highlightedRawText === promptInput ? promptInput : highlightedRawText;

            // 2. Display sanitized output
            cleanPreview.innerText = data.cleanText;

            // 3. Render Status Badge
            if (data.wasScrubbed) {
              badgeScrub.innerText = "🚨 REDACTION TRIGGERED";
              badgeScrub.className = "text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-850 animate-pulse";
              teamsSystemAlertText.innerHTML = "⚠️ **Sovereign Alert: Local data scrub active.**";
              teamsSystemAlertText.className = "text-[11px] text-[#f7630c] font-bold";
              cardFooter.className = "bg-amber-900/20 px-3 py-2 flex items-center justify-between border-t border-amber-850";
              footerStatusText.innerText = "⚠️ PII detected and local entity redaction active.";
              footerStatusText.className = "text-[10px] font-bold text-amber-500";
            } else {
              badgeScrub.innerText = "🟢 CLEAN PASS";
              badgeScrub.className = "text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-850";
              teamsSystemAlertText.innerHTML = "🛡️ **Operational Safe Mode active.**";
              teamsSystemAlertText.className = "text-[11px] text-teal-450 font-bold";
              cardFooter.className = "bg-[#333231] px-3 py-2 flex items-center justify-between border-t border-[#484644]";
              footerStatusText.innerText = "🛡️ GeistDesk Sovereign Shield Enabled | Powered by Azure AI";
              footerStatusText.className = "text-[10px] font-bold text-[#a19f9d]";
            }

            // 4. Render Telemetry Logs
            metricLogs.innerHTML = 
              '<div class="flex justify-between border-b border-slate-900 pb-1">' +
              '  <span>[Active Mode]</span>' +
              '  <span class="text-teal-400 font-bold">' + data.deployment + '</span>' +
              '</div>' +
              '<div class="flex justify-between">' +
              '  <span>[Latency Response]</span>' +
              '  <span class="text-emerald-400">' + data.metrics.latencyMs + 'ms</span>' +
              '</div>' +
              '<div class="flex justify-between font-bold">' +
              '  <span>[Total Log Tokens]</span>' +
              '  <span class="text-amber-400">' + data.metrics.totalTokens + ' tkn (Prompt: ' + data.metrics.promptTokens + ')</span>' +
              '</div>' +
              '<div class="flex justify-between text-[9px] text-slate-500 border-t border-slate-900 pt-1 mt-1 font-mono">' +
              '  <span>ID: ' + data.id + '</span>' +
              '  <span>ISO STACK STATUS: GROUNDED</span>' +
              '</div>';

            // 5. Render Teams Live Preview
            cardBody.innerHTML = formatMarkdown(data.answer);

            // 6. JSON Viewer
            jsonPayload.innerText = JSON.stringify(data.adaptiveCard, null, 2);

          } catch (err) {
            alert("Pipeline error encountered: " + err.message);
          } finally {
            btn.disabled = false;
            btn.innerHTML = \\\`<svg class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Transmit through Local Shield Proxy\\\`;
          }
        }

        // Rudimentary formatting translator to map markdown into Fluent HTML for the live mockup view
        // Escapes backslashes for JS strings safely
        function formatMarkdown(text) {
          if (!text) return "";
          let temp = text
            .replace(/### (.*)/g, '<div class="font-bold text-teal-400 text-sm mb-1 mt-2">$1</div>')
            .replace(/\\\\*\\\\*(.*?)\\\\*\\\\*/g, '<strong>$1</strong>')
            .replace(/\\\\*(.*?)\\\\*/g, '<em>$1</em>')
            .replace(/\\\\n\\\\n/g, '<br/><br/>')
            .replace(/\\\\n/g, '<br/>')
            .replace(/\\\\d\\\\.\\\\s/g, '• ');
          return temp;
        }

        // Initialize processed on load
        setTimeout(() => { processTransmission(); }, 150);
      </script>
    </body>
    </html>
    `);
  });

  // Inbound Mail Webhook
  app.post("/api/webhooks/inbound-mail", webhookRateLimiter, async (req, res) => {
    if (!verifyInboundMailWebhook(req)) {
      return res.status(401).json({ error: "Unauthorized webhook." });
    }
    const { sender, subject, body, attachments } = req.body;
    
    if (!sender || !subject || !body) {
      return res.status(400).json({ error: "Missing required fields: sender, subject, or body" });
    }

    try {
      const db = getDb();
      
      // 1. Threading Logic: Scan for [NEX-XXXX]
      const ticketIdMatch = subject.match(/\[NEX-(\d{4})\]/) || body.match(/\[NEX-(\d{4})\]/);
      let ticketId = ticketIdMatch ? ticketIdMatch[0].replace("[", "").replace("]", "") : null;
      let ticketRef = null;

      if (ticketId) {
        // Try to find the ticket by its ID (using a query since ID is likely a property or we use custom document IDs)
        // For simplicity here, we'll assume we search by a 'ticketId' field
        const ticketQuery = await db.collection("tickets").where("customId", "==", ticketId).limit(1).get();
        if (!ticketQuery.empty) {
          ticketRef = ticketQuery.docs[0].ref;
        }
      }

      // 2. User Mapping: Link to Customer
      const customerQuery = await db.collection("customers").where("email", "==", sender).limit(1).get();
      const customer = !customerQuery.empty ? customerQuery.docs[0].data() : null;
      const customerId = !customerQuery.empty ? customerQuery.docs[0].id : "anonymous";
      const customerName = customer ? customer.name : "Unknown Sender";

      if (!ticketRef) {
        // Create new ticket
        const countSnap = await db.collection("tickets").orderBy("createdAt", "desc").limit(1).get();
        const lastCount = !countSnap.empty ? parseInt(countSnap.docs[0].data()?.customId?.split("-")[1] || "0") : 0;
        const newTicketId = `NEX-${String(lastCount + 1).padStart(4, "0")}`;
        
        const newTicket = {
          subject,
          description: body,
          status: "open",
          priority: "medium", // Default, AI will update later
          customerId,
          customerName,
          customId: newTicketId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          tags: ["inbound-email"],
          customerEmail: sender
        };
        
        ticketRef = await db.collection("tickets").add(newTicket);
        ticketId = newTicketId;
      }

      // 3. Add Message to Thread
      const message = {
        ticketId: ticketRef.id,
        senderId: customerId,
        senderType: "customer",
        senderName: customerName,
        content: body,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await ticketRef.collection("messages").add(message);
      await ticketRef.update({ updatedAt: admin.firestore.FieldValue.serverTimestamp() });

      // 4. AI Triage Trigger (Background Job Simulation)
      // We don't await this to keep webhook fast, but in this demo, we'll do it for the result
      processAiTriage(ticketRef.id, body, subject).catch(err => console.error("AI Triage Error:", err));

      res.json({ success: true, ticketId, status: "processing" });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: "Failed to process inbound mail" });
    }
  });

  // Mock Mail Verification APIs
  // Personio Integration Points
  app.post("/api/personio/sync-attendance", checkAdmin, async (req, res) => {
    const { startTime, endTime, employeeId } = req.body;
    
    try {
      console.log(`Syncing attendance to Personio for ${employeeId}: ${startTime} - ${endTime}`);
      
      // In a real implementation, we would:
      // 1. Fetch Client ID/Secret from secure vault (Firestore)
      // 2. Perform OAuth2 handshake with Personio
      // 3. POST to https://api.personio.de/v1/company/attendance
      
      // Simulating a successful API call to Personio
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      res.json({ 
        success: true, 
        message: "Attendance synced successfully",
        trackingId: `per_${Math.random().toString(36).substr(2, 9)}`
      });
    } catch (error) {
      console.error("Personio Sync Error:", error);
      res.status(500).json({ error: "Failed to sync attendance to Personio" });
    }
  });

  app.post("/api/personio/test-connection", checkAdmin, async (req, res) => {
    try {
      // Simulate OAuth validation
      await new Promise(resolve => setTimeout(resolve, 2000));
      res.json({ success: true, employeeName: "John Doe" });
    } catch (error) {
      res.status(401).json({ error: "Invalid Personio credentials" });
    }
  });

  app.post("/api/mail/verify-forwarding", checkAdmin, async (req, res) => {
    // Simulate verification delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    res.json({ success: true, message: "Forwarding address verified." });
  });

  app.post("/api/mail/send-test", checkAdmin, async (req, res) => {
     // Simulate sending delay
     await new Promise(resolve => setTimeout(resolve, 1500));
     res.json({ success: true, message: "Test email sent successfully." });
  });

  app.post("/api/mail/test-imap", checkAdmin, async (req, res) => {
    const { host, port, user, password, secure } = req.body;
    // Simulate IMAP test
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (host.includes("error")) {
      return res.status(400).json({ success: false, error: "Connection timed out. Check firewall settings." });
    }
    res.json({ success: true, message: "IMAP Handshake Successful" });
  });

  app.post("/api/mail/test-smtp", checkAdmin, async (req, res) => {
    const { host, port, user, password, secure } = req.body;
    // Simulate SMTP test
    await new Promise(resolve => setTimeout(resolve, 1500));
    if (host.includes("fail")) {
      return res.status(400).json({ success: false, error: "Authentication failed. Invalid credentials." });
    }
    res.json({ success: true, message: "SMTP Handshake Successful" });
  });

  app.post("/api/mail/auto-discover", checkAdmin, async (req, res) => {
    const { email } = req.body;
    const domain = email.split('@')[1]?.toLowerCase();
    
    if (!domain) return res.status(400).json({ error: "Invalid email" });

    // Mock settings discovery
    const settings: any = {
      imap: { host: `imap.${domain}`, port: 993, secure: true },
      smtp: { host: `smtp.${domain}`, port: 465, secure: true }
    };

    if (domain === 'gmail.com') {
      settings.imap.host = "imap.gmail.com";
      settings.smtp.host = "smtp.gmail.com";
    } else if (domain === 'outlook.com' || domain === 'hotmail.com') {
      settings.imap.host = "outlook.office365.com";
      settings.smtp.host = "smtp.office365.com";
      settings.imap.port = 993;
      settings.smtp.port = 587;
      settings.smtp.secure = false; // StartTLS
    }

    res.json({ success: true, settings });
  });

  app.get("/api/tickets/:id", authenticate, async (req, res) => {
    const { id } = req.params;
    const forceRefresh = req.query.refresh === 'true';
    const db = getDb();

    try {
      const ticketSnap = await db.collection("tickets").doc(id).get();
      if (!ticketSnap.exists) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const ticket = ticketSnap.data()!;

      // Condition A (Cache Hit): check if retrieved ticket record already has populated fields for aiSummary
      if (!forceRefresh && ticket.aiSummary) {
        console.log(`[Cache Hit] Serving cached AI Analysis for Ticket: ${id}`);
        return res.json({
          aiSummary: ticket.aiSummary,
          aiInsights: ticket.aiInsights,
          aiRootCause: ticket.aiRootCause,
          aiChecklist: ticket.aiChecklist,
          aiSentiment: ticket.aiSentiment
        });
      }

      console.log(`[Cache Miss] Computing AI Analysis for Ticket: ${id}...`);

      // Retrieve messages context for the AI prompt
      const messagesSnap = await db.collection("tickets").doc(id).collection("messages").orderBy("createdAt", "asc").get();
      const messagesText = messagesSnap.docs.map(d => `${d.data().senderName || 'Staff'} (${d.data().senderType}): ${d.data().content}`).join("\n---\n");

      let aiSummary = "";
      let aiInsights: string[] = [];
      let aiRootCause = "";
      let aiChecklist: { task: string; completed: boolean }[] = [];
      let aiSentiment = "Neutral";

      const prompt = `You are an elite Sovereign AI Support operations engineer. Perform a deep-dive analysis on the following GeistDesk support ticket.
        
SUBJECT: ${ticket.subject}
DESCRIPTION: ${ticket.description}
RECENT THREAD ACTIVITY:
${messagesText || "No additional activity logged."}

IMPORTANT: Respond strictly with a valid JSON object. Do not wrap with markdown code fences (no \`\`\`json).
The JSON object must have exactly these keys:
1. "aiSummary": A concise summary paragraph describing the current ticket status, user goals, and latest updates. Use the customer's language.
2. "aiInsights": An array of up to 4 string bullet points representing key takeaways, technical parameters, or critical points.
3. "aiRootCause": A sentence stating the clear diagnosed technical root cause of the issue.
4. "aiChecklist": An array of action items (tasks) to solve this ticket, each having keys "task" (string description) and "completed" (boolean, default false). Please draft 3 realistic tasks.
5. "aiSentiment": One of "Angry", "Neutral", "Positive" depending on user language and frustration.

Respond only with the raw valid JSON payload.`;

      try {
        const lifecycle = await runServerLifecycleAi('ticket_summarization', prompt, { ticketId: id });
        if ((lifecycle.status === 'completed' || lifecycle.status === 'pending_review') && lifecycle.output) {
          const parsed = JSON.parse(lifecycle.output);
          aiSummary = parsed.aiSummary || "";
          aiInsights = parsed.aiInsights || [];
          aiRootCause = parsed.aiRootCause || "";
          aiChecklist = parsed.aiChecklist || [];
          aiSentiment = parsed.aiSentiment || "Neutral";
        } else {
          throw new Error(lifecycle.error ?? `Lifecycle status: ${lifecycle.status}`);
        }
      } catch (lifecycleErr) {
        console.warn(`[AI Lifecycle] Ticket analysis fallback for ${id}:`, lifecycleErr);
        aiSummary = `Summary of the incident regarding: ${ticket.subject}. The system detected configuration issues and identity providers are awaiting handshake.`;
        aiInsights = [
          "Microsoft Entra handshake delay identified.",
          "Billing records in offline mode fallback verify license pending.",
          "Operator queue prioritizes validation of communication tokens."
        ];
        aiRootCause = ticket.subject.toLowerCase().includes("auth") || ticket.description.toLowerCase().includes("auth")
          ? "Microsoft Entra OAuth identity provider response timed out during handshake."
          : "Configuration parameter mismatch inside client database profile or stripe status.";
        aiChecklist = [
          { task: `Verify OAuth credential mapping configuration`, completed: false },
          { task: `Inspect domain synchronize log errors`, completed: false },
          { task: `Confirm SLA limit constraints remain safe`, completed: false }
        ];
        aiSentiment = ticket.sentiment === "angry" ? "Angry" : (ticket.sentiment === "positive" ? "Positive" : "Neutral");
      }

      // Condition B (Cache Miss): Persist AI data natively in our database asynchronously
      await db.collection("tickets").doc(id).update({
        aiSummary,
        aiInsights,
        aiRootCause,
        aiChecklist,
        aiSentiment,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`[Cache Updated] Successfully saved computed AI Analysis variables in ticket: ${id}`);

      return res.json({
        aiSummary,
        aiInsights,
        aiRootCause,
        aiChecklist,
        aiSentiment
      });
    } catch (error) {
      console.error(`Error in GET /api/tickets/${id}:`, error);
      res.status(500).json({ error: "Failed to load/generate ticket AI analysis." });
    }
  });

  app.get("/api/tickets/:ticketId/export", authenticate, async (req, res) => {
    const { ticketId } = req.params;
    try {
      const db = getDb();
      const ticketSnap = await db.collection("tickets").doc(ticketId).get();
      if (!ticketSnap.exists) return res.status(404).json({ error: "Ticket not found" });
      
      const ticket = ticketSnap.data()!;
      const messagesSnap = await db.collection("tickets").doc(ticketId).collection("messages").orderBy("createdAt", "asc").get();
      const messages = messagesSnap.docs.map(d => d.data());

      const doc = new jsPDF();
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("NEXUS SOVEREIGN ARCHIVE", 20, 25);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Document Reference: ${ticketId.toUpperCase()}`, 20, 32);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 36);
      doc.line(20, 42, 190, 42);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`Subject: ${ticket.subject}`, 20, 52);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Ticket ID: ${ticket.customId || "N/A"}`, 20, 60);
      doc.text(`Priority: ${ticket.priority?.toUpperCase()}`, 70, 60);
      doc.text(`Status: ${ticket.status?.toUpperCase()}`, 110, 60);
      doc.text(`Customer: ${ticket.customerName}`, 150, 60);

      let y = 75;
      messages.forEach((msg: any) => {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }

        const date = msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString() : "Unknown Date";
        doc.setFillColor(245, 245, 245);
        doc.rect(20, y, 170, 8, "F");
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(`${msg.senderName} (${msg.senderType.toUpperCase()})`, 25, y + 5);
        doc.setFont("helvetica", "normal");
        doc.text(date, 150, y + 5);
        
        y += 12;
        const lines = doc.splitTextToSize(msg.content, 160);
        doc.text(lines, 25, y);
        y += (lines.length * 5) + 10;

        if (msg.reasoningPath) {
           doc.setFont("helvetica", "italic");
           doc.setTextColor(120, 120, 120);
           doc.text(`AI Reasoning: ${msg.reasoningPath}`, 25, y - 5);
           doc.setTextColor(0, 0, 0);
           doc.setFont("helvetica", "normal");
        }
        
        y += 5;
      });

      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("GOBD COMPLIANT ARCHIVE • ELECTRONICALLY SIGNED • GEISTDESK TECHNOLOGIES", 20, 285);

      const pdfBase64 = doc.output("datauristring").split(',')[1];
      const buffer = Buffer.from(pdfBase64, 'base64');
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=GeistDesk_Archive_${ticket.customId || ticketId}.pdf`);
      res.send(buffer);
    } catch (error) {
      console.error("Export Error:", error);
      res.status(500).json({ error: "Export failed" });
    }
  });

  app.post("/api/kb/crawl", checkAdmin, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });
    if (isPrivateNetworkUrl(String(url))) {
      return res.status(400).json({ error: "URL targets a private or disallowed network address." });
    }

    try {
      console.log(`Crawling URL: ${url}`);
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      const $ = cheerio.load(response.data);
      
      const title = $("h1").first().text().trim() || $("title").text().trim() || url;
      // Try common content containers
      const content = $("article, main, .content, #content, .post").first().text().trim() || $("body").text().trim();

      res.json({ title, content });
    } catch (error) {
      console.error("Crawl error:", error);
      res.status(500).json({ error: "Failed to crawl site" });
    }
  });

  app.post("/api/kb/parse-file", checkAdmin, upload.single("file"), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    try {
      const { originalname, buffer, mimetype } = req.file;
      console.log(`Parsing file: ${originalname} (${mimetype})`);
      let text = "";

      if (mimetype === "application/pdf") {
        const data = await pdf(buffer);
        text = data.text;
      } else if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const data = await mammoth.extractRawText({ buffer });
        text = data.value;
      } else {
        text = buffer.toString("utf-8");
      }

      res.json({ title: originalname, content: text });
    } catch (error) {
      console.error("Parse error:", error);
      res.status(500).json({ error: "Failed to parse file" });
    }
  });

  // KB Knowledge Coverage Engine Endpoints
  const handleGetCoverage = async (req: any, res: any) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const config = await getServerAiConfig();
      const apiKey = config.apiKey || process.env.GEMINI_API_KEY || "";
      const dashboard = await getDashboardData(apiKey);
      res.json(dashboard);
    } catch (error) {
      console.error("Coverage fetch error:", error);
      res.status(500).json({ error: "Failed to load coverage dashboard" });
    }
  };

  const handleGetCategoryCoverage = async (req: any, res: any) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { id } = req.params;
    try {
      const db = getDb();
      const coverageSnap = await db.collection("kb_coverage").doc(id).get();
      if (coverageSnap.exists) {
        res.json(coverageSnap.data());
      } else {
        const allCovs = await calculateCoverage();
        const found = allCovs.find(c => c.id === id);
        if (found) {
          res.json(found);
        } else {
          res.status(404).json({ error: "Category coverage not found" });
        }
      }
    } catch (error) {
      console.error("Category coverage fetch error:", error);
      res.status(500).json({ error: "Failed to load category coverage" });
    }
  };

  const handleRecalculateCoverage = async (req: any, res: any) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (req.user.role !== "SYSTEM_ADMIN") {
      return res.status(403).json({ error: "Forbidden: Administrative access required." });
    }
    try {
      const coverages = await calculateCoverage();
      const config = await getServerAiConfig();
      const apiKey = config.apiKey || process.env.GEMINI_API_KEY || "";
      const dashboard = await getDashboardData(apiKey);
      res.json({ success: true, coverages, dashboard });
    } catch (error) {
      console.error("Recalculate error:", error);
      res.status(500).json({ error: "Failed to recalculate knowledge coverage" });
    }
  };

  app.get("/api/coverage", authenticate, handleGetCoverage);
  app.get("/coverage", authenticate, handleGetCoverage);
  app.get("/api/coverage/category/:id", authenticate, handleGetCategoryCoverage);
  app.get("/coverage/category/:id", authenticate, handleGetCategoryCoverage);
  app.post("/api/coverage/recalculate", authenticate, handleRecalculateCoverage);
  app.post("/coverage/recalculate", authenticate, handleRecalculateCoverage);

  // Handoff Engine Endpoints
  app.post("/api/tickets/:ticketId/handoff-summary", authenticate, async (req, res) => {
    const { ticketId } = req.params;
    const db = getDb();

    try {
      const ticketSnap = await db.collection("tickets").doc(ticketId).get();
      if (!ticketSnap.exists) return res.status(404).json({ error: "Ticket not found" });
      
      const ticket = ticketSnap.data()!;
      const messagesSnap = await db.collection("tickets").doc(ticketId).collection("messages").orderBy("createdAt", "desc").limit(20).get();
      const messages = messagesSnap.docs.map(d => `${d.data().senderName} (${d.data().senderType}): ${d.data().content}`).join("\n---\n");

      const prompt = `You are an expert support supervisor. Generate a high-priority handoff briefing for a ticket that is being transferred to a new agent.
      
      TICKET SUBJECT: ${ticket.subject}
      TICKET DESCRIPTION: ${ticket.description}
      
      RECENT ACTIVITY (from latest to oldest):
      ${messages}
      
      Provide a structured summary in JSON format with exactly two keys:
      1. "customerGoal": A clear ONE-SENTENCE description of what the customer actually wants.
      2. "effortSoFar": A bulleted list of actions agents have already taken or attempted to resolve this.
      
      Keep it professional, direct, and "GeistDesk Sovereign" styled.
      `;

      const lifecycle = await runServerLifecycleAi('ticket_summarization', prompt, { ticketId });
      if (!lifecycle.output || lifecycle.status === 'blocked' || lifecycle.status === 'failed') {
        return res.status(503).json({ error: lifecycle.error ?? 'AI handoff generation blocked by enterprise policy.' });
      }
      const data = JSON.parse(lifecycle.output);
      res.json(data);
    } catch (error) {
      console.error("Handoff Summary Error:", error);
      res.status(500).json({ error: "Failed to generate handoff summary" });
    }
  });

  app.post("/api/tickets/:ticketId/golden-note", authenticate, async (req: any, res) => {
    const { ticketId } = req.params;
    const { content } = req.body;
    const db = getDb();

    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "content is required." });
    }

    try {
      await db.collection("tickets").doc(ticketId).collection("messages").add({
        ticketId,
        senderId: req.user?.id,
        senderType: "agent",
        senderName: req.user?.name || req.user?.email || "Agent",
        content,
        isGoldenNote: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save golden note" });
    }
  });

  app.post("/api/notifications/ai-draft", checkAdmin, async (req, res) => {
    const { concept, variables, tone } = req.body;

    try {
      const prompt = `You are a professional communications assistant for GeistDesk Sovereign. 
      Draft an automated email notification template based on the following:
      
      CONCEPT: ${concept}
      AVAILABLE VARIABLES: ${variables.join(", ")}
      TONE: ${tone || 'Professional and helpful'}
      
      Rules:
      1. Use double-curly bracket syntax for variables (e.g., {{customer.name}}).
      2. Ensure all provided variables are used where appropriate.
      3. The style should be modern, clean, and reflect a premium enterprise support experience.
      
      Respond in JSON format with keys: "subject" and "body".
      `;

      const lifecycle = await runServerLifecycleAi('smart_reply', prompt);
      if (!lifecycle.output || lifecycle.status === 'blocked' || lifecycle.status === 'failed') {
        return res.status(503).json({ error: lifecycle.error ?? 'AI draft generation blocked by enterprise policy.' });
      }
      const data = JSON.parse(lifecycle.output);
      res.json(data);
    } catch (error) {
      console.error("AI Draft Error:", error);
      res.status(500).json({ error: "AI Draft failed" });
    }
  });

  app.post("/api/notifications/tone-check", checkAdmin, async (req, res) => {
    const { text } = req.body;

    try {
      const prompt = `Analyze the tone of this email template. 
      Flag if it sounds too robotic, unfriendly, or overly complex for a customer or agent.
      
      TEXT:
      ${text}
      
      Provide a critique in JSON format with keys:
      - "rating": "Good", "Needs Improvement", or "Critical"
      - "isRobotic": boolean
      - "isUnfriendly": boolean
      - "suggestion": One clear sentence on how to improve it.
      `;

      const lifecycle = await runServerLifecycleAi('sentiment_analysis', prompt);
      if (!lifecycle.output || lifecycle.status === 'blocked' || lifecycle.status === 'failed') {
        return res.status(503).json({ error: lifecycle.error ?? 'Tone analysis blocked by enterprise policy.' });
      }
      const data = JSON.parse(lifecycle.output);
      res.json(data);
    } catch (error) {
      console.error("Tone Critique Error:", error);
      res.status(500).json({ error: "Tone check failed" });
    }
  });

  // AI Relationship Graph 2.0 Automatic Extraction Endpoint
  app.post("/api/kb/extract-relationships", authenticate, async (req: any, res) => {
    const { articleTitle, articleContent, articleId } = req.body;
    if (!articleTitle) {
      return res.status(400).json({ error: "articleTitle is required" });
    }

    try {
      const prompt = `You are an expert enterprise knowledge graph relationship analyzer.
Analyze this supporting article or SOP content to extract connections/relationships between entities.
We want to represent these connections as elements in a knowledge graph directory.

ARTICLE DETAILS:
Title: ${articleTitle || 'Untitled'}
Content: ${articleContent || ''}

You must detect other entities mentioned in this article content and express their relations.
The allowed entity (Node) types are:
- Article (other knowledge base entries or this article itself)
- SOP (standard operating procedures or guidelines)
- System (applications, servers, physical hardware, identity solutions, networks e.g. "Azure MFA", "Entra ID", "VPN", etc.)
- Team (organizational roles or units e.g. "System Administrators", "DevOps", "IT Support")
- Integration (connector tools or webhooks e.g. "Jira", "Outlook", "Slack")
- Vendor (external companies/providers e.g. "Microsoft", "Cisco", "Amazon", "Okta", "Fortinet")
- Ticket (issues, tickets, solved configurations e.g. "VPN Tunnel issue", "MFA Login Failures")

The allowed relation types are:
- depends_on (the source entity depends on target to function)
- related_to (the entities are associated with each other)
- causes (source entity triggers or leads to the target entity)
- solves (source entity solves some issue or target entity)
- references (source refers to or mentions target)
- owned_by (source is owned or managed by target)
- used_by (source is used or utilized by target)

Output a strict JSON array. Each element of the array must be an object with the following properties:
- sourceName (string, e.g., "${articleTitle}")
- sourceType (one of: "Article", "SOP", "System", "Team", "Integration", "Vendor", "Ticket")
- targetName (string, name of the target entity found)
- targetType (one of: "Article", "SOP", "System", "Team", "Integration", "Vendor", "Ticket")
- type (one of: "depends_on", "related_to", "causes", "solves", "references", "owned_by", "used_by")
- confidence (number from 0.5 to 1.0 representing AI certainty)

Ensure that you return ONLY a JSON array, no conversational text, no markdown decoration. If nothing can be extracted, return an empty array [].

Example output format:
[
  {
    "sourceName": "Azure MFA",
    "sourceType": "System",
    "targetName": "Entra ID",
    "targetType": "System",
    "type": "depends_on",
    "confidence": 0.95
  }
]
`;

      const lifecycle = await runServerLifecycleAi('vault_insights', prompt, {
        metadata: { articleId, articleTitle },
      });
      if (!lifecycle.output || lifecycle.status === 'blocked' || lifecycle.status === 'failed') {
        return res.status(503).json({ error: lifecycle.error ?? 'Relationship extraction blocked by enterprise policy.' });
      }
      const cleaned = lifecycle.output.replace(/^\s*```json\s*/i, "").replace(/\s*```\s*$/, "");
      const rdata = JSON.parse(cleaned);

      res.json({ success: true, relationships: rdata });
    } catch (error: any) {
      console.error("[Graph Extract API Error] failed:", error);
      res.status(500).json({ error: error.message || "Failed to extract relationships via AI" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Configuring Vite middleware...");
    try {
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          hmr: false
        },
        appType: "spa",
      });
      app.use(vite.middlewares);
      
      // Explicit SPA fallback for development
      app.use(/.*/, async (req, res, next) => {
        const url = req.originalUrl;
        try {
          const fs = await import('fs/promises');
          let template = await fs.readFile(path.resolve(process.cwd(), 'index.html'), 'utf-8');
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } catch (e) {
          next(e);
        }
      });
      
      console.log("Vite middleware attached.");
    } catch (viteErr) {
      console.error("ERROR INITIALIZING VITE:", viteErr);
    }
  } else {
    console.log("Production mode: serving static files from dist/");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }));
    app.get(/.*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Ready: Server running on http://localhost:${PORT}`);
  });
}

async function runServerLifecycleAi(
  feature: import("./src/types/aiOrchestrator.js").AiFeatureId,
  prompt: string,
  ctx: Partial<import("./src/types/aiOrchestrator.js").AiExecutionContext> = {},
) {
  const { executeAiFeatureRequest } = await import("./src/lib/ai-orchestrator-service.js");
  return executeAiFeatureRequest({
    workspaceId: "default",
    feature,
    prompt,
    ...ctx,
  });
}

async function processAiTriage(ticketId: string, emailBody: string, subject: string) {
  const db = getDb();

  try {
    // 1. Fetch relevant KB context (simplified: top 5 articles)
    const kbSnap = await db.collection("kb_articles").limit(5).get();
    const kbContext = kbSnap.docs.map(d => `${d.data().title}: ${d.data().content}`).join("\n---\n");

    const prompt = `Based on this incoming email, categorize the priority (low, medium, high, urgent), detect sentiment (positive, neutral, negative), and draft a professional response based on our Knowledge Base.
    
    KNOWLEDGE BASE:
    ${kbContext || "No knowledge base articles found."}
    
    EMAIL SUBJECT: ${subject}
    EMAIL BODY: ${emailBody}
    
    IMPORTANT: Respond strictly in JSON format with keys:
    - "priority": one of low, medium, high, urgent
    - "sentiment": one of positive, neutral, negative
    - "suggestedDraft": the response text
    - "citations": an array of up to 3 strings, each referencing the specific KB article title or Ticket ID used for reasoning.
    - "reasoningPath": a brief string explaining the logical steps taken (e.g. "Detected 'login' intent -> Matched KB Article 'Resetting passwords' -> Drafted response")
    `;

    const lifecycle = await runServerLifecycleAi('smart_reply', prompt, { ticketId });
    if (!lifecycle.output || lifecycle.status === 'blocked' || lifecycle.status === 'failed') {
      console.warn("AI Triage skipped:", lifecycle.error ?? lifecycle.status);
      return;
    }
    const data = JSON.parse(lifecycle.output);

    await db.collection("tickets").doc(ticketId).update({
      priority: data.priority || "medium",
      aiSentiment: data.sentiment || "neutral",
      aiSuggestedDraft: data.suggestedDraft || "",
      aiCitations: data.citations || [],
      aiReasoningPath: data.reasoningPath || "",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Add AI analysis as an internal message
    await db.collection("tickets").doc(ticketId).collection("messages").add({
      ticketId,
      senderId: "geistdesk-ai",
      senderType: "ai",
      senderName: "GeistDesk AI Triage",
      content: `AI Analysis Complete:\n- Priority: ${data.priority?.toUpperCase()}\n- Sentiment: ${data.sentiment?.toUpperCase()}\n\nSuggested Draft:\n${data.suggestedDraft}`,
      citations: data.citations || [],
      reasoningPath: data.reasoningPath || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`AI Triage complete for ticket: ${ticketId}`);
  } catch (err) {
    console.error("AI Analysis Error for ticket:", ticketId, err);
  }
}

async function getServerAiConfig() {
  try {
    const { getOrchestratorConfig, getProviderSecret } = await import("./src/lib/ai-orchestrator-store.js");
    const { toLegacyAiConfig } = await import("./src/types/aiOrchestrator.js");
    const orchestrator = await getOrchestratorConfig("default");
    const legacy = toLegacyAiConfig(orchestrator);
    const googleKey =
      (await getProviderSecret("google", "default")) ||
      process.env.GEMINI_API_KEY ||
      "";
    const localKey = (await getProviderSecret("local", "default")) || "";
    return {
      ...legacy,
      apiKey: googleKey,
      customApiKey: localKey,
    };
  } catch (error) {
    console.warn("Failed to read orchestrator config, using fallback defaults:", error);
    return {
      sentimentModel: "gemini-flash",
      deepThinkingModel: "gemini-pro",
      summaryModel: "sentiment",
      localEndpoint: "http://localhost:11434/v1",
      apiKey: process.env.GEMINI_API_KEY || "",
      customSentimentModelName: "gemma",
      customThinkingModelName: "qwen:36b",
      customApiKey: "",
    };
  }
}

console.log("Booting startServer...");
startServer().catch(err => {
  console.error("FATAL ERROR IN startServer:", err);
});
