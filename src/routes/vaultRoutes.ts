import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  getDocDirect,
  addDocDirect,
  updateDocDirect,
  deleteDocDirect
} from "../lib/postgres-backend.js";
import {
  encryptString,
  decryptString,
  encryptStringArray,
  decryptStringArray,
  EncryptedPayload
} from "../lib/crypto.js";

const router = Router();

// Item metadata lives here (NEVER any secret material).
const VAULT_ITEMS = "vault_items";
// Encrypted secret material (shares / uploaded content) lives in a SEPARATE
// collection, keyed by an independent reference id so reconstruction material
// is never co-located in the same row as the item identifier.
const VAULT_SECRETS = "vault_item_secrets";

const createSecretSchema = z.object({
  type: z.enum(["secret", "request"]).default("secret"),
  // Shamir shares produced client-side; optional for "request" dropzones.
  shares: z.array(z.string()).optional(),
  threshold: z.number().int().positive().optional(),
  expirationType: z.enum(["read", "time"]).default("read"),
  expiresAt: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

function isExpired(item: any): boolean {
  if (item?.expirationType === "time" && item?.expiresAt) {
    return new Date(item.expiresAt).getTime() < Date.now();
  }
  return false;
}

/**
 * POST /api/vault/secrets — create an encrypted secret.
 * Encrypts shares with AES-256-GCM and stores them in a separate collection.
 * The vault_items row stores only non-sensitive metadata + a reference id.
 */
router.post("/secrets", authenticate, async (req: any, res: Response): Promise<any> => {
  const parsed = createSecretSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid vault payload", details: parsed.error.flatten().fieldErrors });
  }
  const { type, shares, threshold, expirationType, expiresAt, metadata } = parsed.data;

  try {
    // 1. Persist encrypted secret material under its own reference id.
    const encryptedShares = shares && shares.length > 0 ? encryptStringArray(shares) : undefined;
    const secretRecord = await addDocDirect(VAULT_SECRETS, {
      encryptedShares: encryptedShares || null,
      encryptedContent: null,
      createdBy: req.user.id,
      createdAt: new Date().toISOString()
    });
    const secretRef = secretRecord.id;

    // 2. Persist the item metadata row (no shares, no plaintext content).
    const itemRecord = await addDocDirect(VAULT_ITEMS, {
      type,
      secretRef,
      sharesCount: shares?.length || 0,
      threshold: threshold || (shares ? 3 : undefined),
      expirationType,
      expiresAt: expirationType === "time" ? expiresAt || null : null,
      isBurned: false,
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      metadata: metadata || {}
    });

    return res.status(201).json({ id: itemRecord.id });
  } catch (e: any) {
    console.error("[Vault] Failed to create secret:", e?.message || e);
    return res.status(500).json({ error: "Failed to store encrypted secret." });
  }
});

/**
 * GET /api/vault/secrets/:id — public capability endpoint for share links.
 * Returns ONLY non-sensitive metadata so the viewer can render its shell.
 * No secret material is returned here.
 */
router.get("/secrets/:id", async (req: Request, res: Response): Promise<any> => {
  try {
    const item = await getDocDirect(VAULT_ITEMS, req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });

    const burned = item.isBurned || isExpired(item);
    return res.json({
      id: item.id,
      type: item.type,
      expirationType: item.expirationType,
      isBurned: burned,
      metadata: item.metadata || {}
    });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to load vault item." });
  }
});

/**
 * POST /api/vault/secrets/:id/reveal — public capability endpoint.
 * Returns decrypted shares/content exactly once. For read-once secrets it
 * burns the item and destroys the secret material immediately afterward.
 */
router.post("/secrets/:id/reveal", async (req: Request, res: Response): Promise<any> => {
  try {
    const item = await getDocDirect(VAULT_ITEMS, req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });
    if (item.isBurned || isExpired(item)) {
      return res.status(410).json({ error: "This secret has already been burned or expired.", isBurned: true });
    }

    const secret = item.secretRef ? await getDocDirect(VAULT_SECRETS, item.secretRef) : null;
    const shares = secret?.encryptedShares ? decryptStringArray(secret.encryptedShares as EncryptedPayload[]) : [];
    const content = secret?.encryptedContent ? decryptString(secret.encryptedContent as EncryptedPayload) : null;

    // Burn-after-read: destroy material and mark item burned.
    if (item.expirationType === "read") {
      if (item.secretRef) {
        await deleteDocDirect(VAULT_SECRETS, item.secretRef);
      }
      await updateDocDirect(VAULT_ITEMS, item.id, { isBurned: true, burnedAt: new Date().toISOString() });
    }

    return res.json({ id: item.id, type: item.type, shares, content, metadata: item.metadata || {} });
  } catch (e: any) {
    console.error("[Vault] Reveal failed:", e?.message || e);
    return res.status(500).json({ error: "Failed to reveal secret." });
  }
});

/**
 * POST /api/vault/secrets/:id/content — authenticated dropzone upload.
 * Encrypts uploaded content with AES-256-GCM into the separate secret store.
 */
router.post("/secrets/:id/content", authenticate, async (req: any, res: Response): Promise<any> => {
  const content = typeof req.body?.content === "string" ? req.body.content : null;
  if (!content) return res.status(400).json({ error: "content is required" });

  try {
    const item = await getDocDirect(VAULT_ITEMS, req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });

    let secretRef = item.secretRef;
    if (!secretRef) {
      const rec = await addDocDirect(VAULT_SECRETS, { createdBy: req.user.id, createdAt: new Date().toISOString() });
      secretRef = rec.id;
      await updateDocDirect(VAULT_ITEMS, item.id, { secretRef });
    }
    await updateDocDirect(VAULT_SECRETS, secretRef, { encryptedContent: encryptString(content) });
    if (req.body?.metadata) {
      await updateDocDirect(VAULT_ITEMS, item.id, { metadata: { ...(item.metadata || {}), ...req.body.metadata } });
    }
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to store encrypted content." });
  }
});

/** POST /api/vault/secrets/:id/burn — authenticated owner/admin burn. */
router.post("/secrets/:id/burn", authenticate, async (req: any, res: Response): Promise<any> => {
  try {
    const item = await getDocDirect(VAULT_ITEMS, req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });
    if (item.createdBy !== req.user.id && req.user.role !== "SYSTEM_ADMIN") {
      return res.status(403).json({ error: "Forbidden: you cannot burn this secret." });
    }
    if (item.secretRef) await deleteDocDirect(VAULT_SECRETS, item.secretRef);
    await updateDocDirect(VAULT_ITEMS, item.id, { isBurned: true, burnedAt: new Date().toISOString() });
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to burn secret." });
  }
});

export default router;
