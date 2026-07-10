import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  getDocDirect,
  getDocsDirect,
  setDocDirect,
  updateDocDirect,
  deleteDocDirect,
  addDocDirect,
} from '../lib/postgres-backend.js';
import { routeParam } from '../lib/route-params.js';
import {
  getPersonalVaultInitialized,
  setPersonalVaultInitialized,
  PERSONAL_VAULT_ID,
  PERSONAL_VAULT_TYPE,
} from '../lib/personal-vault-store.js';

const router = Router();
const COLLECTION = 'geist_vault_portfolios';
const FOLDER_COLLECTION = 'vault_folders';
/** Zero-knowledge encrypted credential blobs (separate from UI folder tree). */
const ENCRYPTED_VAULT_STORE = 'geist_vault_encrypted_stores';

const folderIconSchema = z.enum(['folder', 'lock', 'server', 'key', 'database', 'cloud']);

const createFolderSchema = z.object({
  name: z.string().min(1).max(120),
  icon: folderIconSchema.default('folder'),
  parentId: z.string().nullable().optional(),
  vaultId: z.string().min(1).max(128),
  sortOrder: z.number().int().min(0).optional(),
});

const updateFolderSchema = createFolderSchema.partial().omit({ vaultId: true });

function folderId(): string {
  return `folder-${crypto.randomUUID()}`;
}

/** GET /api/credential-vault/status — whether the authenticated user has initialized a personal vault */
router.get('/status', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.user!.id;
    const initialized = await getPersonalVaultInitialized(userId);
    return res.json({ initialized });
  } catch (err: any) {
    console.error('[credential-vault] status', err);
    return res.status(500).json({ error: 'Failed to resolve personal vault status' });
  }
});

/** POST /api/credential-vault/initialize — mark personal vault as initialized (zero-knowledge: no password stored) */
router.post('/initialize', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.user!.id;
    await setPersonalVaultInitialized(userId, true);
    return res.status(200).json({ success: true, initialized: true });
  } catch (err: any) {
    console.error('[credential-vault] initialize', err);
    return res.status(500).json({ error: 'Failed to register personal vault initialization' });
  }
});

async function userCanAccessVaultFolder(vaultId: string, userId: string, isAdmin: boolean): Promise<boolean> {
  if (isAdmin) return true;
  if (vaultId === 'local' || vaultId === 'shared' || vaultId === 'shared-company') return true;
  const portfolio = await getDocDirect(COLLECTION, vaultId);
  if (!portfolio) return vaultId === 'local';
  return userCanAccessPortfolio(portfolio, userId, false);
}

/** GET /api/credential-vault/folders — list folders for a vault partition */
router.get('/folders', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const vaultId = String(req.query.vaultId || 'local');
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'SYSTEM_ADMIN' || (req.user as any).is_admin === true;

    if (!(await userCanAccessVaultFolder(vaultId, userId, isAdmin))) {
      return res.status(403).json({ error: 'Insufficient permissions for this vault.' });
    }

    const all = await getDocsDirect(FOLDER_COLLECTION, [{ type: 'where', field: 'vaultId', op: '==', value: vaultId }]);
    const folders = all.sort(
      (a: any, b: any) =>
        (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) || String(a.name).localeCompare(String(b.name)),
    );
    return res.json({ folders });
  } catch (err: any) {
    console.error('[credential-vault] list folders', err);
    return res.status(500).json({ error: 'Failed to list vault folders' });
  }
});

/** POST /api/credential-vault/folders — create folder */
router.post('/folders', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const parsed = createFolderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
    }

    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'SYSTEM_ADMIN' || (req.user as any).is_admin === true;
    const { vaultId, parentId = null, name, icon, sortOrder } = parsed.data;

    if (!(await userCanAccessVaultFolder(vaultId, userId, isAdmin))) {
      return res.status(403).json({ error: 'Insufficient permissions for this vault.' });
    }

    if (parentId) {
      const parent = await getDocDirect(FOLDER_COLLECTION, parentId);
      if (!parent || parent.vaultId !== vaultId) {
        return res.status(400).json({ error: 'Parent folder not found in this vault.' });
      }
    }

    const id = folderId();
    const now = new Date().toISOString();
    const isPersonalVault = vaultId === PERSONAL_VAULT_ID;
    const data = {
      name,
      icon,
      parentId,
      vaultId,
      vaultType: isPersonalVault ? PERSONAL_VAULT_TYPE : undefined,
      ownerId: isPersonalVault ? userId : undefined,
      sortOrder: sortOrder ?? 0,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    await setDocDirect(FOLDER_COLLECTION, id, data);
    const folder = await getDocDirect(FOLDER_COLLECTION, id);
    return res.status(201).json({ folder });
  } catch (err: any) {
    console.error('[credential-vault] create folder', err);
    return res.status(500).json({ error: 'Failed to create vault folder' });
  }
});

/** PUT /api/credential-vault/folders/:id */
router.put('/folders/:id', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const id = routeParam(req.params.id);
    const parsed = updateFolderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
    }

    const existing = await getDocDirect(FOLDER_COLLECTION, id);
    if (!existing) return res.status(404).json({ error: 'Folder not found' });

    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'SYSTEM_ADMIN' || (req.user as any).is_admin === true;
    if (!(await userCanAccessVaultFolder(String(existing.vaultId), userId, isAdmin))) {
      return res.status(403).json({ error: 'Insufficient permissions for this vault.' });
    }

    if (parsed.data.parentId) {
      const parent = await getDocDirect(FOLDER_COLLECTION, parsed.data.parentId);
      if (!parent || parent.vaultId !== existing.vaultId) {
        return res.status(400).json({ error: 'Parent folder not found in this vault.' });
      }
      if (parsed.data.parentId === id) {
        return res.status(400).json({ error: 'A folder cannot be its own parent.' });
      }
    }

    await updateDocDirect(FOLDER_COLLECTION, id, {
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    });
    const folder = await getDocDirect(FOLDER_COLLECTION, id);
    return res.json({ folder });
  } catch (err: any) {
    console.error('[credential-vault] update folder', err);
    return res.status(500).json({ error: 'Failed to update vault folder' });
  }
});

/** DELETE /api/credential-vault/folders/:id */
router.delete('/folders/:id', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const id = routeParam(req.params.id);
    const existing = await getDocDirect(FOLDER_COLLECTION, id);
    if (!existing) return res.status(404).json({ error: 'Folder not found' });

    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'SYSTEM_ADMIN' || (req.user as any).is_admin === true;
    if (!(await userCanAccessVaultFolder(String(existing.vaultId), userId, isAdmin))) {
      return res.status(403).json({ error: 'Insufficient permissions for this vault.' });
    }

    await deleteDocDirect(FOLDER_COLLECTION, id);
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[credential-vault] delete folder', err);
    return res.status(500).json({ error: 'Failed to delete vault folder' });
  }
});

const assignmentSchema = z.object({
  userId: z.string().min(1),
  userEmail: z.string().email().optional(),
  userName: z.string().optional(),
  role: z.enum(['Besitzer', 'Admin', 'Bearbeiter', 'Betrachter']),
});

const createPortfolioSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  emoji: z.string().max(8).optional(),
  scope: z.enum(['personal', 'department', 'team', 'global']).default('personal'),
  assignments: z.array(assignmentSchema).optional(),
});

const updatePortfolioSchema = createPortfolioSchema.partial();

function generateSalt(): string {
  return crypto.randomBytes(32).toString('hex');
}

function portfolioId(): string {
  return `vault-${crypto.randomUUID()}`;
}

function userCanAccessPortfolio(portfolio: any, userId: string, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (portfolio.createdBy === userId) return true;
  return (portfolio.assignments || []).some((a: any) => a.userId === userId);
}

function resolveUserRole(portfolio: any, userId: string, isAdmin: boolean): string {
  if (isAdmin || portfolio.createdBy === userId) return 'Besitzer';
  const assignment = (portfolio.assignments || []).find((a: any) => a.userId === userId);
  return assignment?.role || 'Betrachter';
}

/** GET /api/credential-vault/portfolios — all portfolios (admin) or owned/assigned */
router.get('/portfolios', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'SYSTEM_ADMIN' || (req.user as any).is_admin === true;
    const all = await getDocsDirect(COLLECTION, []);

    const visible = isAdmin
      ? all
      : all.filter((p: any) => userCanAccessPortfolio(p, userId, false));

    return res.json({ portfolios: visible });
  } catch (err: any) {
    console.error('[credential-vault] list portfolios', err);
    return res.status(500).json({ error: 'Failed to list vault portfolios' });
  }
});

/** GET /api/credential-vault/portfolios/mine — accessible portfolios with user role */
router.get('/portfolios/mine', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'SYSTEM_ADMIN' || (req.user as any).is_admin === true;
    const all = await getDocsDirect(COLLECTION, []);

    const accessible = all
      .filter((p: any) => userCanAccessPortfolio(p, userId, isAdmin))
      .map((p: any) => ({
        ...p,
        userRole: resolveUserRole(p, userId, isAdmin),
      }));

    return res.json({ portfolios: accessible });
  } catch (err: any) {
    console.error('[credential-vault] list my portfolios', err);
    return res.status(500).json({ error: 'Failed to list accessible portfolios' });
  }
});

/** POST /api/credential-vault/portfolios — create new vault instance */
router.post('/portfolios', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const parsed = createPortfolioSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
    }

    const userId = req.user!.id;
    const id = portfolioId();
    const now = new Date().toISOString();
    const data = {
      name: parsed.data.name,
      description: parsed.data.description || '',
      emoji: parsed.data.emoji || '🔒',
      scope: parsed.data.scope,
      encryptionSalt: generateSalt(),
      assignments: parsed.data.assignments || [
        { userId, role: 'Besitzer' as const },
      ],
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    await setDocDirect(COLLECTION, id, data);
    const record = await getDocDirect(COLLECTION, id);
    return res.status(201).json({ portfolio: record });
  } catch (err: any) {
    console.error('[credential-vault] create portfolio', err);
    return res.status(500).json({ error: 'Failed to create vault portfolio' });
  }
});

/** PUT /api/credential-vault/portfolios/:id */
router.put('/portfolios/:id', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const id = routeParam(req.params.id);
    const parsed = updatePortfolioSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
    }

    const existing = await getDocDirect(COLLECTION, id);
    if (!existing) return res.status(404).json({ error: 'Portfolio not found' });

    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'SYSTEM_ADMIN';
    const userRole = resolveUserRole(existing, userId, isAdmin);
    if (!['Besitzer', 'Admin'].includes(userRole) && !isAdmin) {
      return res.status(403).json({ error: 'Insufficient permissions to update portfolio' });
    }

    await updateDocDirect(COLLECTION, id, {
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    });
    const updated = await getDocDirect(COLLECTION, id);
    return res.json({ portfolio: updated });
  } catch (err: any) {
    console.error('[credential-vault] update portfolio', err);
    return res.status(500).json({ error: 'Failed to update vault portfolio' });
  }
});

/** DELETE /api/credential-vault/portfolios/:id — owner or system admin */
router.delete('/portfolios/:id', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const id = routeParam(req.params.id);
    const existing = await getDocDirect(COLLECTION, id);
    if (!existing) return res.status(404).json({ error: 'Portfolio not found' });

    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'SYSTEM_ADMIN' || (req.user as any).is_admin === true;
    const userRole = resolveUserRole(existing, userId, isAdmin);
    if (!isAdmin && userRole !== 'Besitzer') {
      return res.status(403).json({ error: 'Only the vault owner can delete this portfolio' });
    }

    await deleteDocDirect(COLLECTION, id);
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[credential-vault] delete portfolio', err);
    return res.status(500).json({ error: 'Failed to delete vault portfolio' });
  }
});

// -----------------------------------------------------------------------------
// Zero-knowledge encrypted vault stores (ciphertext only — separate collection)
// -----------------------------------------------------------------------------

const encryptedVaultLayoutSchema = z
  .object({
    permission: z.string().optional(),
    sortOrder: z.number().int().optional(),
    collapsed: z.boolean().optional(),
    color: z.string().optional(),
  })
  .optional();

const createEncryptedVaultSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .optional(),
  type: z.enum(['personal', 'shared']),
  emoji: z.string().max(8).optional(),
  layout: encryptedVaultLayoutSchema,
  sharedWith: z.array(z.string().email()).optional(),
  encryptedBlob: z.string().min(1),
  blobVersion: z.number().int().positive().optional().default(1),
});

const updateEncryptedVaultSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  emoji: z.string().max(8).optional(),
  layout: encryptedVaultLayoutSchema,
  sharedWith: z.array(z.string().email()).optional(),
  encryptedBlob: z.string().min(1).optional(),
  blobVersion: z.number().int().positive().optional(),
});

function slugifyEncryptedVaultName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return base || `vault-${Date.now()}`;
}

function formatEncryptedVaultRow(row: any) {
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

function userCanWriteEncryptedVault(vault: any, user: any): boolean {
  if (!vault || !user) return false;
  if (user.role === 'SYSTEM_ADMIN') return true;
  if (vault.createdBy === user.id) return true;
  if (vault.type !== 'shared') return false;
  const email = String(user.email || '').toLowerCase();
  const sharedWith: string[] = Array.isArray(vault.sharedWith) ? vault.sharedWith : [];
  return sharedWith.some((entry) => String(entry).toLowerCase() === email);
}

async function listAccessibleEncryptedVaults(user: any): Promise<any[]> {
  const email = String(user.email || '').toLowerCase();
  const owned = await getDocsDirect(ENCRYPTED_VAULT_STORE, [
    { type: 'where', field: 'createdBy', op: '==', value: user.id },
  ]);
  const sharedCandidates = await getDocsDirect(ENCRYPTED_VAULT_STORE, [
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
  return Array.from(byId.values()).map(formatEncryptedVaultRow);
}

router.get('/vaults', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const vaults = await listAccessibleEncryptedVaults(req.user);
    return res.json({ vaults });
  } catch (e: any) {
    console.error('[credential-vault] list encrypted vaults', e?.message || e);
    return res.status(500).json({ error: 'Failed to load credential vault folders.' });
  }
});

router.post('/vaults', authenticate, async (req: Request, res: Response): Promise<any> => {
  const parsed = createEncryptedVaultSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid vault payload', details: parsed.error.flatten().fieldErrors });
  }

  const { name, type, emoji, layout, sharedWith, encryptedBlob, blobVersion } = parsed.data;
  const slug = parsed.data.slug || slugifyEncryptedVaultName(name);
  const now = new Date().toISOString();

  try {
    const existing = await getDocsDirect(ENCRYPTED_VAULT_STORE, [
      { type: 'where', field: 'createdBy', op: '==', value: req.user!.id },
      { type: 'where', field: 'slug', op: '==', value: slug },
    ]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'A vault with this identifier already exists.' });
    }

    const record = await addDocDirect(ENCRYPTED_VAULT_STORE, {
      name: name.trim(),
      slug,
      type,
      emoji: emoji || (type === 'shared' ? '👥' : '🔒'),
      layout: layout || {},
      createdBy: req.user!.id,
      ownerEmail: req.user!.email || null,
      sharedWith: type === 'shared' ? (sharedWith || []) : [],
      encryptedBlob,
      blobVersion,
      createdAt: now,
      updatedAt: now,
    });

    const stored = await getDocDirect(ENCRYPTED_VAULT_STORE, record.id);
    return res.status(201).json({ vault: formatEncryptedVaultRow({ id: record.id, ...stored }) });
  } catch (e: any) {
    console.error('[credential-vault] create encrypted vault', e?.message || e);
    return res.status(500).json({ error: 'Failed to store encrypted vault folder.' });
  }
});

router.put('/vaults/:id', authenticate, async (req: Request, res: Response): Promise<any> => {
  const parsed = updateEncryptedVaultSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid vault update payload', details: parsed.error.flatten().fieldErrors });
  }

  try {
    const vaultId = routeParam(req.params.id);
    const existing = await getDocDirect(ENCRYPTED_VAULT_STORE, vaultId);
    if (!existing) return res.status(404).json({ error: 'Vault folder not found.' });
    if (!userCanWriteEncryptedVault(existing, req.user)) {
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

    await updateDocDirect(ENCRYPTED_VAULT_STORE, vaultId, patch);
    const stored = await getDocDirect(ENCRYPTED_VAULT_STORE, vaultId);
    return res.json({ vault: formatEncryptedVaultRow({ id: vaultId, ...stored }) });
  } catch (e: any) {
    console.error('[credential-vault] update encrypted vault', e?.message || e);
    return res.status(500).json({ error: 'Failed to update encrypted vault folder.' });
  }
});

router.delete('/vaults/:id', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const vaultId = routeParam(req.params.id);
    const existing = await getDocDirect(ENCRYPTED_VAULT_STORE, vaultId);
    if (!existing) return res.status(404).json({ error: 'Vault folder not found.' });
    if (existing.createdBy !== req.user!.id && req.user!.role !== 'SYSTEM_ADMIN') {
      return res.status(403).json({ error: 'Forbidden: only the vault owner can delete this folder.' });
    }

    await deleteDocDirect(ENCRYPTED_VAULT_STORE, vaultId);
    return res.json({ success: true });
  } catch (e: any) {
    console.error('[credential-vault] delete encrypted vault', e?.message || e);
    return res.status(500).json({ error: 'Failed to delete vault folder.' });
  }
});

export default router;
