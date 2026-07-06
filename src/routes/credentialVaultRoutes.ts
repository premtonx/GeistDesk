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
} from '../lib/postgres-backend.js';

const router = Router();
const COLLECTION = 'geist_vault_portfolios';

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
    const { id } = req.params;
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
    const { id } = req.params;
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

export default router;
