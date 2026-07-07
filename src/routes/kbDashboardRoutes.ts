import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { getDocDirect, getDocsDirect, setDocDirect } from '../lib/postgres-backend.js';
import {
  computeDashboardMetrics,
  computeHealthScore,
  type KBGlobalSettings,
} from '../lib/kb-dashboard-metrics.js';

const router = Router();

router.get('/stats', authenticate, async (_req: Request, res: Response) => {
  try {
    const [articles, settingsDoc] = await Promise.all([
      getDocsDirect('kb_articles', []),
      getDocDirect('kb_settings', 'global'),
    ]);

    const settings = (settingsDoc || null) as KBGlobalSettings | null;
    const metrics = computeDashboardMetrics(articles, settings);

    return res.json({
      metrics,
      settings: settings || {},
      articleCount: articles.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load dashboard stats.';
    return res.status(500).json({ error: message });
  }
});

router.get('/settings/global', authenticate, async (_req: Request, res: Response) => {
  try {
    const settings = await getDocDirect('kb_settings', 'global');
    return res.json({ settings: settings || {} });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load KB settings.';
    return res.status(500).json({ error: message });
  }
});

router.patch('/settings/global', authenticate, async (req: Request, res: Response) => {
  try {
    const existing = (await getDocDirect('kb_settings', 'global')) as KBGlobalSettings | null;
    const articles = await getDocsDirect('kb_articles', []);
    const computedHealth = computeHealthScore(articles);

    const patch = {
      ...(existing || {}),
      ...(req.body || {}),
      healthScore:
        typeof req.body?.healthScore === 'number' ? req.body.healthScore : (existing?.healthScore ?? computedHealth),
      previousHealthScore: existing?.healthScore ?? computedHealth,
      updatedAt: new Date().toISOString(),
    };

    await setDocDirect('kb_settings', 'global', patch);
    return res.json({ settings: patch });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update KB settings.';
    return res.status(500).json({ error: message });
  }
});

export default router;
