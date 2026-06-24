import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../middleware/authMiddleware.js";
import { 
  getDocDirect, 
  getDocsDirect, 
  addDocDirect, 
  updateDocDirect, 
  setDocDirect 
} from "../lib/postgres-backend.js";
import { hashPassword } from "../lib/crypto.js";
import {
  appendOrchestratorAudit,
  getOrchestratorAudit,
  getOrchestratorConfig,
  listConfigVersions,
  listProviderSecretStatus,
  restoreConfigVersion,
  setProviderSecret,
  upsertOrchestratorConfig,
} from "../lib/ai-orchestrator-store.js";
import {
  detectLocalModels,
  getOrchestratorHealth,
  testOrchestratorConfiguration,
} from "../lib/ai-orchestrator-service.js";
import { orchestratorEventBus } from "../lib/ai-orchestrator-events.js";
import type { AiFeatureRouting, AiKillSwitch, AiOrchestratorConfig } from "../types/aiOrchestrator.js";

const router = Router();

// Zod schema for an admin setting/resetting a user's password
const setPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters").max(256, "Password too long")
});

// Zod schema for manual local user creation
const createLocalUserSchema = z.object({
  email: z.string().email("Invalid email format").transform(val => val.toLowerCase().trim()),
  name: z.string().min(1, "Name is required").max(100, "Name cannot exceed 100 characters"),
  role: z.enum(["admin", "agent", "team_lead", "customer"])
});

// Zod schema for updating a user's role
const updateRoleSchema = z.object({
  role: z.enum(["admin", "agent", "team_lead", "customer"])
});

/**
 * 1. GET /api/admin/users
 * Returns a paginated list of all users, their authentication source, status, and system roles.
 * Securely restricted to SYSTEM_ADMIN.
 */
router.get("/users", authenticate, requireRole(["SYSTEM_ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string || "1", 10);
    const limit = parseInt(req.query.limit as string || "10", 10);

    if (isNaN(page) || page <= 0) {
      return res.status(400).json({ error: "Invalid page parameter" });
    }
    if (isNaN(limit) || limit <= 0 || limit > 100) {
      return res.status(400).json({ error: "Invalid limit parameter (must be between 1 and 100)" });
    }

    // Fetch all user accounts from the database
    const allUsers = await getDocsDirect("users", []);

    // Enhance users with derived fields (authSource, status, role name description)
    const formattedUsers = allUsers.map(u => {
      // Determine authMethod
      const authSource = u.authMethod || (u.email?.endsWith(".onmicrosoft.com") || u.upn ? "SSO" : "Local");
      
      // Determine user status
      const status = u.isDeactivated ? "Deactivated" : "Active";

      return {
        id: u.id,
        name: u.name || "N/A",
        email: u.email || "",
        avatar: u.avatar || "",
        role: u.role || "agent",
        is_admin: u.is_admin || u.role === "admin" || u.role === "SYSTEM_ADMIN",
        authMethod: authSource,
        status: status,
        lastActiveAt: u.lastActiveAt || null,
        createdAt: u.createdAt || null,
        updatedAt: u.updatedAt || null,
        visibilityScope: u.visibilityScope || "all",
        groups: u.groups || []
      };
    });

    // Handle pagination in memory (since we have a lightweight direct read layer)
    const totalCount = formattedUsers.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = formattedUsers.slice(startIndex, endIndex);
    const totalPages = Math.ceil(totalCount / limit);

    return res.status(200).json({
      users: paginatedUsers,
      pagination: {
        totalCount,
        page,
        limit,
        totalPages
      }
    });
  } catch (error: any) {
    console.error("[Admin Users API] Error listing users:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message || String(error)
    });
  }
});

/**
 * 2. POST /api/admin/users/create-local
 * Allows a SYSTEM_ADMIN to manually precheck and pre-provision a clean, local or future SSO user profile.
 * Generates a secure temporary activation token for password reset/verification.
 */
router.post("/users/create-local", authenticate, requireRole(["SYSTEM_ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const validationResult = createLocalUserSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Input validation failed",
        details: validationResult.error.flatten().fieldErrors
      });
    }

    const { email, name, role } = validationResult.data;

    // Check if user already exists
    const queryResults = await getDocsDirect("users", [
      { type: "where", field: "email", op: "==", value: email }
    ]);
    if (queryResults.length > 0) {
      return res.status(409).json({
        error: "Conflict: A workforce record with this email already exists."
      });
    }

    // Generate a secure temporary activation token and expired time (e.g. 24 hours)
    const rawActivationToken = "act-" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const activationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 Hours

    // Construct profile payload
    const is_admin = role === "admin";
    const newUserProfile = {
      name,
      email,
      role,
      is_admin,
      authMethod: "password",
      isDeactivated: false,
      can_create_tickets: true,
      can_view_knowledgebase: true,
      activationToken: rawActivationToken,
      activationTokenExpires,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save user document
    const created = await addDocDirect("users", newUserProfile);

    // Write audit details log
    try {
      await addDocDirect("audits", {
        action: "CREATE_USER",
        targetUserId: created.id,
        targetEmail: email,
        performedBy: req.user?.email || "SYSTEM_ADMIN",
        details: `Created manual local user with role ${role}`,
        timestamp: new Date().toISOString()
      });
    } catch (auditErr) {
      console.error("[Admin Users API] Failed to log creation audit:", auditErr);
    }

    return res.status(201).json({
      message: "Successfully pre-provisioned local user.",
      user: {
        id: created.id,
        ...newUserProfile,
        activationToken: rawActivationToken // Returned strictly once for initial invitation setup
      }
    });
  } catch (error: any) {
    console.error("[Admin Users API] Error creating local user:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message || String(error)
    });
  }
});

/**
 * 3. PATCH /api/admin/users/:id/role
 * Allows a SYSTEM_ADMIN to securely re-bind and upgrade/downgrade any user's system role.
 */
router.patch("/users/:id/role", authenticate, requireRole(["SYSTEM_ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    if (!id || id.trim() === "") {
      return res.status(400).json({ error: "Missing required user id parameter." });
    }

    const validationResult = updateRoleSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Input validation failed",
        details: validationResult.error.flatten().fieldErrors
      });
    }

    const { role } = validationResult.data;

    // Retrieve user card
    const userProfile = await getDocDirect("users", id);
    if (!userProfile) {
      return res.status(404).json({
        error: "Not Found: No active user profile matched the provided ID."
      });
    }

    // System Protection: Prevent self-demotion or self-modification
    if (req.user?.id === id && role !== "admin") {
      return res.status(403).json({
        error: "Forbidden: To protect administrative stability, you cannot demote your own account role."
      });
    }

    const updatedData = {
      ...userProfile,
      role,
      is_admin: role === "admin",
      updatedAt: new Date().toISOString()
    };

    // Save back to underlying database structure
    await setDocDirect("users", id, updatedData);

    // Audit logs entry
    try {
      await addDocDirect("audits", {
        action: "CHANGE_ROLE",
        targetUserId: id,
        targetEmail: userProfile.email,
        oldRole: userProfile.role,
        newRole: role,
        performedBy: req.user?.email || "SYSTEM_ADMIN",
        timestamp: new Date().toISOString()
      });
    } catch (auditErr) {
      console.error("[Admin Users API] Failed logging role update audit:", auditErr);
    }

    return res.status(200).json({
      message: "Role updated successfully",
      user: {
        id,
        name: updatedData.name,
        email: updatedData.email,
        role: updatedData.role,
        is_admin: updatedData.is_admin,
        updatedAt: updatedData.updatedAt
      }
    });
  } catch (error: any) {
    console.error("[Admin Users API] Error updating user role:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message || String(error)
    });
  }
});

/**
 * 3b. POST /api/admin/users/:id/set-password
 * Allows a SYSTEM_ADMIN to set or reset a workforce member's local password so
 * admin-provisioned agents can sign in. The password is hashed with Argon2id;
 * plaintext is never stored and never returned.
 */
router.post("/users/:id/set-password", authenticate, requireRole(["SYSTEM_ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    if (!id || id.trim() === "") {
      return res.status(400).json({ error: "Missing required user id parameter." });
    }

    const validationResult = setPasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Input validation failed",
        details: validationResult.error.flatten().fieldErrors
      });
    }

    const userProfile = await getDocDirect("users", id);
    if (!userProfile) {
      return res.status(404).json({ error: "Not Found: No active user profile matched the provided ID." });
    }

    const passwordHash = await hashPassword(validationResult.data.password);
    await updateDocDirect("users", id, {
      passwordHash,
      authMethod: "password",
      // Once a real password exists, any pending invitation token is consumed.
      activationToken: null,
      activationTokenExpires: null,
      updatedAt: new Date().toISOString()
    });

    try {
      await addDocDirect("audits", {
        action: "SET_PASSWORD",
        targetUserId: id,
        targetEmail: userProfile.email,
        performedBy: req.user?.email || "SYSTEM_ADMIN",
        details: "Administrator set/reset a local account password.",
        timestamp: new Date().toISOString()
      });
    } catch (auditErr) {
      console.error("[Admin Users API] Failed logging set-password audit:", auditErr);
    }

    return res.status(200).json({ success: true, message: "Password set successfully." });
  } catch (error: any) {
    console.error("[Admin Users API] Error setting user password:", error);
    return res.status(500).json({ error: "Internal Server Error", details: error.message || String(error) });
  }
});

/**
 * 4. GET /api/admin/orchestrator/config
 * Workspace-scoped AI control plane configuration (no secrets).
 */
router.get("/orchestrator/config", authenticate, requireRole(["SYSTEM_ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const workspaceId = String(req.query.workspaceId || "default");
    await migrateLegacyOrchestratorConfig(workspaceId);
    const config = await getOrchestratorConfig(workspaceId);
    const secretStatus = await listProviderSecretStatus(workspaceId);
    return res.status(200).json({
      ...config,
      secretStatus,
      updatedAt: config.updatedAt,
    });
  } catch (error: any) {
    console.error("[Admin Orchestrator GET] Error retrieving config:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message || String(error),
    });
  }
});

/**
 * 5. POST /api/admin/orchestrator/config
 * Upserts workspace AI orchestrator settings with audit trail.
 */
router.post("/orchestrator/config", authenticate, requireRole(["SYSTEM_ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const workspaceId = String(req.body.workspaceId || "default");
    const existing = await getOrchestratorConfig(workspaceId);

    if (existing.configLocked && req.body.forceUnlock !== true) {
      return res.status(403).json({
        error: "Configuration is locked. Super Admin unlock required.",
        configLocked: true,
      });
    }

    const payload = req.body as Partial<AiOrchestratorConfig> & {
      secrets?: Record<string, string>;
    };

    if (payload.scope === "global" && req.user?.role !== "SYSTEM_ADMIN") {
      return res.status(403).json({ error: "Only Super Admins may edit Global scope configuration." });
    }

    const updatedBy = req.user?.email || req.user?.id || "SYSTEM_ADMIN";

    const auditFields: Array<keyof AiOrchestratorConfig> = [
      "primaryModel",
      "reasoningModel",
      "triageModel",
      "scope",
      "piiEnabled",
      "autoEscalationEnabled",
      "auditEnabled",
      "configLocked",
      "reasoningLevel",
      "contentFilteringEnabled",
      "endpointUrl",
      "dailyBudgetUsd",
      "monthlyBudgetUsd",
      "budgetExceededAction",
      "configVersion",
    ];

    for (const field of auditFields) {
      if (payload[field] !== undefined && String(payload[field]) !== String((existing as any)[field])) {
        await appendOrchestratorAudit({
          workspaceId,
          userId: req.user?.id,
          userEmail: req.user?.email,
          action: `Changed ${field}`,
          fieldName: field,
          oldValue: String((existing as any)[field]),
          newValue: String(payload[field]),
        });
      }
    }

    if (payload.featureRouting) {
      await appendOrchestratorAudit({
        workspaceId,
        userId: req.user?.id,
        userEmail: req.user?.email,
        action: "Updated Feature Routing",
        fieldName: "featureRouting",
        oldValue: JSON.stringify(existing.featureRouting),
        newValue: JSON.stringify(payload.featureRouting),
      });
    }

    const saved = await upsertOrchestratorConfig(
      {
        workspaceId,
        scope: payload.scope === "personal" ? "workspace" : payload.scope,
        primaryModel: payload.primaryModel,
        reasoningModel: payload.reasoningModel,
        triageModel: payload.triageModel,
        providerPriority: payload.providerPriority,
        fallbackModels: payload.fallbackModels,
        featureRouting: payload.featureRouting as AiFeatureRouting | undefined,
        endpointUrl: payload.endpointUrl,
        piiEnabled: payload.piiEnabled,
        autoEscalationEnabled: payload.autoEscalationEnabled,
        auditEnabled: payload.auditEnabled,
        configLocked: payload.configLocked,
        reasoningLevel: payload.reasoningLevel,
        contentFilteringEnabled: payload.contentFilteringEnabled,
        promptLoggingEnabled: payload.promptLoggingEnabled,
        dataResidency: payload.dataResidency,
        killSwitch: payload.killSwitch as AiKillSwitch | undefined,
        dailyBudgetUsd: payload.dailyBudgetUsd,
        monthlyBudgetUsd: payload.monthlyBudgetUsd,
        budgetExceededAction: payload.budgetExceededAction,
      },
      updatedBy,
    );

    if (payload.secrets && typeof payload.secrets === "object") {
      for (const [provider, secret] of Object.entries(payload.secrets)) {
        if (secret && secret.trim()) {
          await setProviderSecret(provider, secret.trim(), updatedBy, workspaceId);
          await appendOrchestratorAudit({
            workspaceId,
            userId: req.user?.id,
            userEmail: req.user?.email,
            action: `Updated ${provider} API key`,
            fieldName: `${provider}_secret`,
            newValue: "••••••••",
          });
        }
      }
    }

    orchestratorEventBus.emitConfigUpdated(workspaceId, saved, saved.configVersion);

    const secretStatus = await listProviderSecretStatus(workspaceId);
    const versions = await listConfigVersions(workspaceId, 10);
    return res.status(200).json({ success: true, config: saved, secretStatus, versions });
  } catch (error: any) {
    console.error("[Admin Orchestrator POST] Error updating config:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message || String(error),
    });
  }
});

/**
 * 5b. GET /api/admin/orchestrator/audit
 */
router.get("/orchestrator/audit", authenticate, requireRole(["SYSTEM_ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const workspaceId = String(req.query.workspaceId || "default");
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const entries = await getOrchestratorAudit(workspaceId, limit);
    return res.status(200).json({ entries });
  } catch (error: any) {
    console.error("[Admin Orchestrator Audit] Error:", error);
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

/**
 * 5c. POST /api/admin/orchestrator/test
 */
router.post("/orchestrator/test", authenticate, requireRole(["SYSTEM_ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const workspaceId = String(req.body.workspaceId || "default");
    const results = await testOrchestratorConfiguration(workspaceId);
    return res.status(200).json({ results });
  } catch (error: any) {
    console.error("[Admin Orchestrator Test] Error:", error);
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

/**
 * 5d. GET /api/admin/orchestrator/versions
 */
router.get("/orchestrator/versions", authenticate, requireRole(["SYSTEM_ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const workspaceId = String(req.query.workspaceId || "default");
    const versions = await listConfigVersions(workspaceId, Math.min(Number(req.query.limit) || 20, 50));
    return res.status(200).json({ versions });
  } catch (error: any) {
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

/**
 * 5e. POST /api/admin/orchestrator/restore
 */
router.post("/orchestrator/restore", authenticate, requireRole(["SYSTEM_ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const workspaceId = String(req.body.workspaceId || "default");
    const versionId = String(req.body.versionId || "");
    if (!versionId) return res.status(400).json({ error: "versionId is required" });
    const restoredBy = req.user?.email || req.user?.id || "SYSTEM_ADMIN";
    const config = await restoreConfigVersion(workspaceId, versionId, restoredBy);
    orchestratorEventBus.emitConfigUpdated(workspaceId, config, config.configVersion);
    return res.status(200).json({ success: true, config });
  } catch (error: any) {
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

/**
 * 5f. GET /api/admin/orchestrator/models — detect local gateway models
 */
router.get("/orchestrator/models", authenticate, requireRole(["SYSTEM_ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const workspaceId = String(req.query.workspaceId || "default");
    const config = await getOrchestratorConfig(workspaceId);
    const endpoint = String(req.query.endpoint || config.endpointUrl);
    const { getProviderSecret } = await import("../lib/ai-orchestrator-store.js");
    const localKey = await getProviderSecret("local", workspaceId);
    const models = await detectLocalModels(endpoint, localKey);
    return res.status(200).json({ models });
  } catch (error: any) {
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

/**
 * 5g. GET /api/admin/orchestrator/analytics
 */
router.get("/orchestrator/analytics", authenticate, requireRole(["SYSTEM_ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const workspaceId = String(req.query.workspaceId || "default");
    const health = await getOrchestratorHealth(workspaceId);
    return res.status(200).json({ usage: health.usage, metrics: health.metrics });
  } catch (error: any) {
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

async function migrateLegacyOrchestratorConfig(workspaceId: string): Promise<void> {
  const current = await getOrchestratorConfig(workspaceId);
  if (current.updatedBy && current.updatedBy !== "system") return;

  const legacy = await getDocDirect("system_configs", "ai_orchestrator_global");
  if (!legacy) return;

  await upsertOrchestratorConfig(
    {
      workspaceId,
      triageModel: legacy.sentimentModel || current.triageModel,
      reasoningModel: legacy.deepThinkingModel || current.reasoningModel,
      endpointUrl: legacy.localEndpoint || current.endpointUrl,
    },
    "migration",
  );

  if (legacy.apiKey) {
    await setProviderSecret("google", legacy.apiKey, "migration", workspaceId);
  }
  if (legacy.customApiKey) {
    await setProviderSecret("local", legacy.customApiKey, "migration", workspaceId);
  }
}

/**
 * 6. GET /api/admin/orchestrator/health
 * Per-provider health dashboard with cost metrics.
 */
router.get("/orchestrator/health", authenticate, requireRole(["SYSTEM_ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const workspaceId = String(req.query.workspaceId || "default");
    const health = await getOrchestratorHealth(workspaceId);
    return res.status(200).json(health);
  } catch (error: any) {
    console.error("[Admin Orchestrator Health] Top level error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message || String(error),
    });
  }
});

export default router;
