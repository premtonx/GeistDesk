/**
 * Admin Hub demo-data controls:
 *   GET    /api/admin/demo-data/status
 *   POST   /api/admin/demo-data/seed
 *   DELETE /api/admin/demo-data/reset
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import {
  getDemoDataStatus,
  resetDemoData,
  seedDemoData,
} from '../services/seedService.js';

const router = Router();

const seedBodySchema = z.object({
  replaceLegacySamples: z.boolean().optional(),
  /** When true, skip if demo rows already exist. Default false (replace). */
  skipIfPresent: z.boolean().optional(),
});

router.get(
  '/status',
  authenticate,
  requireRole(['SYSTEM_ADMIN']),
  async (_req: Request, res: Response) => {
    try {
      const status = await getDemoDataStatus();
      return res.json({ ok: true, ...status });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Demo status failed.';
      return res.status(500).json({ error: message });
    }
  },
);

router.post(
  '/seed',
  authenticate,
  requireRole(['SYSTEM_ADMIN']),
  async (req: Request, res: Response) => {
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
        skipIfPresent: parsed.data.skipIfPresent === true,
      });
      return res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Demo seed failed.';
      return res.status(500).json({ error: message });
    }
  },
);

router.delete(
  '/reset',
  authenticate,
  requireRole(['SYSTEM_ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const replaceLegacy =
        typeof req.query.replaceLegacySamples === 'string'
          ? req.query.replaceLegacySamples !== 'false'
          : true;
      const result = await resetDemoData({ replaceLegacySamples: replaceLegacy });
      return res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Demo reset failed.';
      return res.status(500).json({ error: message });
    }
  },
);

export default router;
