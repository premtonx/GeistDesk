import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  addDocDirect,
  deleteDocDirect,
  getDocDirect,
  getDocsDirect,
  updateDocDirect,
} from '../lib/postgres-backend.js';

const router = Router();
const VAULT_FOLDERS = 'vault_folders';

const layoutSchema = z
  .object({
    permission: z.string().optional(),
    sortOrder: z.number().int().optional(),
    collapsed: z.boolean().optional(),
    color: z.string().optional(),
  })
  .optional();

const createVaultSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .optional(),
  type: z.enum(['personal', 'shared']),
  emoji: z.string().max(8).optional(),
  layout: layoutSchema,
  sharedWith: z.array(z.string().email()).optional(),
  encryptedBlob: z.string().min(1),
  blobVersion: z.number().int().positive().optional().default(1),
});

const updateVaultSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  emoji: z.string().max(8).optional(),
  layout: layoutSchema,
  sharedWith: z.array(z.string().email()).optional(),
  encryptedBlob: z.string().min(1).optional(),
  blobVersion: z.number().int().positive().optional(),
});

function slugifyName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return base || `vault-${Date.now()}`;
}

function formatVaultRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    emoji: row.emoji ?? '🔒',
    layout: row.layout ?? {},
    createdBy: row.createdBy,
    ownerEmail: row.ownerEmail ?? null,
    sharedWith: Array.isArray(row.sharedWith) ? row.sharedWith : [],
    encryptedBlob: row.encryptedBlob,
    blobVersion: row.blobVersion ?? 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function userCanReadVault(vault: any, user: any): boolean {
  if (!vault || !user) return false;
  if (user.role === 'SYSTEM_ADMIN') return true;
  if (vault.createdBy === user.id) return true;
  const email = String(user.email || '').toLowerCase();
  const sharedWith: string[] = Array.isArray(vault.sharedWith) ? vault.sharedWith : [];
  return sharedWith.some((entry) => String(entry).toLowerCase() === email);
}

function userCanWriteVault(vault: any, user: any): boolean {
  if (!vault || !user) return false;
  if (user.role === 'SYSTEM_ADMIN') return true;
  if (vault.createdBy === user.id) return true;
  if (vault.type !== 'shared') return false;
  const email = String(user.email || '').toLowerCase();
  const sharedWith: string[] = Array.isArray(vault.sharedWith) ? vault.sharedWith : [];
  return sharedWith.some((entry) => String(entry).toLowerCase() === email);
}

async function listAccessibleVaults(user: any): Promise<any[]> {
  const email = String(user.email || '').toLowerCase();
  const owned = await getDocsDirect(VAULT_FOLDERS, [
    { type: 'where', field: 'createdBy', op: '==', value: user.id },
  ]);
  const sharedCandidates = await getDocsDirect(VAULT_FOLDERS, [
    { type: 'where', field: 'type', op: '==', value: 'shared' },
  ]);
  const shared = sharedCandidates.filter((row) => {
    const sharedWith: string[] = Array.isArray(row.sharedWith) ? row.sharedWith : [];
    return sharedWith.some((entry) => String(entry).toLowerCase() === email);
  });

  const byId = new Map<string, any>();
  for (const row of [...owned, ...shared]) {
    if (row?.id) byId.set(row.id, row);
  }
  return Array.from(byId.values()).map(formatVaultRow);
}

/** GET /api/credential-vault/vaults — list encrypted vault folders for the authenticated user. */
router.get('/vaults', authenticate, async (req: any, res: Response): Promise<any> => {
  try {
    const vaults = await listAccessibleVaults(req.user);
    return res.json({ vaults });
  } catch (e: any) {
    console.error('[CredentialVault] list failed:', e?.message || e);
    return res.status(500).json({ error: 'Failed to load credential vault folders.' });
  }
});

/** POST /api/credential-vault/vaults — persist a new zero-knowledge encrypted vault folder. */
router.post('/vaults', authenticate, async (req: any, res: Response): Promise<any> => {
  const parsed = createVaultSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid vault payload', details: parsed.error.flatten().fieldErrors });
  }

  const { name, type, emoji, layout, sharedWith, encryptedBlob, blobVersion } = parsed.data;
  const slug = parsed.data.slug || slugifyName(name);
  const now = new Date().toISOString();

  try {
    const existing = await getDocsDirect(VAULT_FOLDERS, [
      { type: 'where', field: 'createdBy', op: '==', value: req.user.id },
      { type: 'where', field: 'slug', op: '==', value: slug },
    ]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'A vault with this identifier already exists.' });
    }

    const record = await addDocDirect(VAULT_FOLDERS, {
      name: name.trim(),
      slug,
      type,
      emoji: emoji || (type === 'shared' ? '👥' : '🔒'),
      layout: layout || {},
      createdBy: req.user.id,
      ownerEmail: req.user.email || null,
      sharedWith: type === 'shared' ? (sharedWith || []) : [],
      encryptedBlob,
      blobVersion,
      createdAt: now,
      updatedAt: now,
    });

    const stored = await getDocDirect(VAULT_FOLDERS, record.id);
    return res.status(201).json({ vault: formatVaultRow({ id: record.id, ...stored }) });
  } catch (e: any) {
    console.error('[CredentialVault] create failed:', e?.message || e);
    return res.status(500).json({ error: 'Failed to store encrypted vault folder.' });
  }
});

/** PUT /api/credential-vault/vaults/:id — update encrypted blob and/or metadata. */
router.put('/vaults/:id', authenticate, async (req: any, res: Response): Promise<any> => {
  const parsed = updateVaultSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid vault update payload', details: parsed.error.flatten().fieldErrors });
  }

  try {
    const vaultId = String(req.params.id || '');
    const existing = await getDocDirect(VAULT_FOLDERS, vaultId);
    if (!existing) return res.status(404).json({ error: 'Vault folder not found.' });
    if (!userCanWriteVault(existing, req.user)) {
      return res.status(403).json({ error: 'Forbidden: you cannot modify this vault folder.' });
    }

    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    const data = parsed.data;
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.emoji !== undefined) patch.emoji = data.emoji;
    if (data.layout !== undefined) patch.layout = data.layout;
    if (data.sharedWith !== undefined && existing.type === 'shared') patch.sharedWith = data.sharedWith;
    if (data.encryptedBlob !== undefined) patch.encryptedBlob = data.encryptedBlob;
    if (data.blobVersion !== undefined) patch.blobVersion = data.blobVersion;

    await updateDocDirect(VAULT_FOLDERS, vaultId, patch);
    const stored = await getDocDirect(VAULT_FOLDERS, vaultId);
    return res.json({ vault: formatVaultRow({ id: vaultId, ...stored }) });
  } catch (e: any) {
    console.error('[CredentialVault] update failed:', e?.message || e);
    return res.status(500).json({ error: 'Failed to update encrypted vault folder.' });
  }
});

/** DELETE /api/credential-vault/vaults/:id — remove a vault folder (owner/admin only). */
router.delete('/vaults/:id', authenticate, async (req: any, res: Response): Promise<any> => {
  try {
    const vaultId = String(req.params.id || '');
    const existing = await getDocDirect(VAULT_FOLDERS, vaultId);
    if (!existing) return res.status(404).json({ error: 'Vault folder not found.' });
    if (existing.createdBy !== req.user.id && req.user.role !== 'SYSTEM_ADMIN') {
      return res.status(403).json({ error: 'Forbidden: only the vault owner can delete this folder.' });
    }

    await deleteDocDirect(VAULT_FOLDERS, vaultId);
    return res.json({ success: true });
  } catch (e: any) {
    console.error('[CredentialVault] delete failed:', e?.message || e);
    return res.status(500).json({ error: 'Failed to delete vault folder.' });
  }
});

export default router;
