import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import {
  getCachedExchangeAnalytics,
  getExchangeActivityFeed,
  getExchangeDashboardStats,
  getExchangeSettings,
  getExchangeStorageBreakdown,
  saveExchangeSettings,
} from '../lib/exchange-analytics-service.js';

const router = Router();

const settingsSchema = z.object({
  defaultExpirationHours: z.number().int().min(1).max(8760).optional(),
  globalDownloadLimit: z.number().int().min(1).max(1000).optional(),
  storageWarningThresholdPercent: z.number().int().min(1).max(100).optional(),
  storageQuotaGb: z.number().int().min(1).max(102400).optional(),
});

/** GET /api/exchange/dashboard — live KPI counters with month-over-month trends */
router.get('/dashboard', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const stats = await getExchangeDashboardStats(req.user!.id);
    return res.json(stats);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[exchange] dashboard', message);
    return res.status(500).json({ error: 'Failed to load exchange dashboard metrics.' });
  }
});

/** GET /api/exchange/storage — real blob size breakdown */
router.get('/storage', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const breakdown = await getExchangeStorageBreakdown(req.user!.id);
    return res.json(breakdown);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[exchange] storage', message);
    return res.status(500).json({ error: 'Failed to load exchange storage breakdown.' });
  }
});

/** GET /api/exchange/analytics — cached AI security insights */
router.get('/analytics', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const analytics = await getCachedExchangeAnalytics(req.user!.id, forceRefresh);
    return res.json(analytics);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[exchange] analytics', message);
    return res.status(500).json({ error: 'Failed to load exchange analytics cache.' });
  }
});

/** POST /api/exchange/analytics/refresh — explicit analytics regeneration */
router.post('/analytics/refresh', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const analytics = await getCachedExchangeAnalytics(req.user!.id, true);
    return res.json(analytics);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[exchange] analytics refresh', message);
    return res.status(500).json({ error: 'Failed to refresh exchange analytics.' });
  }
});

/** GET /api/exchange/audit-log — recent exchange activity timeline */
router.get('/audit-log', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '12'), 10) || 12));
    const entries = await getExchangeActivityFeed(req.user!.id, limit);
    return res.json({ entries });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[exchange] audit-log', message);
    return res.status(500).json({ error: 'Failed to load exchange audit log.' });
  }
});

/** GET /api/exchange/settings */
router.get('/settings', authenticate, async (_req: Request, res: Response): Promise<any> => {
  try {
    const settings = await getExchangeSettings();
    return res.json({ settings });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: 'Failed to load exchange settings.', details: message });
  }
});

/** PATCH /api/exchange/settings — admin workspace exchange defaults */
router.patch('/settings', authenticate, requireRole(['SYSTEM_ADMIN']), async (req: Request, res: Response): Promise<any> => {
  try {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid settings payload.' });
    }
    const settings = await saveExchangeSettings(parsed.data);
    return res.json({ settings });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: 'Failed to save exchange settings.', details: message });
  }
});

export default router;
