import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { DEMO_CATALOG_COLLECTION, seedDemoData } from '../services/seedService.js';
import { getDocDirect } from '../lib/postgres-backend.js';

const router = Router();

const seedBodySchema = z.object({
  replaceLegacySamples: z.boolean().optional(),
});

/**
 * POST /api/demo/seed
 * Legacy alias of POST /api/admin/demo-data/seed.
 */
router.post('/seed', authenticate, requireRole(['SYSTEM_ADMIN']), async (req: Request, res: Response) => {
  try {
    const parsed = seedBodySchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid seed payload.', details: parsed.error.flatten() });
    }
    const result = await seedDemoData({
      actorUserId: String(req.user?.id || 'user-demo-admin'),
      actorName: String(req.user?.name || req.user?.email || 'Administrator'),
      actorEmail: String(req.user?.email || ''),
      tenantId: String(req.user?.tenantId || 'default'),
      replaceLegacySamples: parsed.data.replaceLegacySamples !== false,
    });
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Demo seed failed.';
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/demo/catalog
 * GeistVault simulation secrets (labels/categories/tags). Empty when not seeded.
 */
router.get('/catalog', authenticate, async (_req: Request, res: Response) => {
  try {
    const catalog = await getDocDirect(DEMO_CATALOG_COLLECTION, 'global');
    return res.json({
      credentials: Array.isArray(catalog?.credentials) ? catalog.credentials : [],
      categories: Array.isArray(catalog?.categories) ? catalog.categories : [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Catalog load failed.';
    return res.status(500).json({ error: message });
  }
});

export default router;
