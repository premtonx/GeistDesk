import { Router, type Request, type Response } from 'express';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { getDocDirect, getDocsDirect, setDocDirect } from '../lib/postgres-backend.js';
import {
  computeDashboardMetrics,
  computeHealthScore,
  type KBGlobalSettings,
} from '../lib/kb-dashboard-metrics.js';
import {
  resolveTenantFromRequest,
  documentBelongsToTenant,
  stampTenantId,
} from '../lib/tenant-context.js';
import { safeErrorMessage } from '../lib/safe-log.js';

const router = Router();

router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenantFromRequest(req);
    const [articlesRaw, settingsDoc] = await Promise.all([
      getDocsDirect('kb_articles', []),
      getDocDirect('kb_settings', 'global'),
    ]);

    const articles = (articlesRaw || []).filter((a: any) => documentBelongsToTenant(a, tenantId));
    const settings = (settingsDoc || null) as KBGlobalSettings | null;
    const metrics = computeDashboardMetrics(articles, settings);

    return res.json({
      metrics,
      settings: settings || {},
      articleCount: articles.length,
      tenantId,
    });
  } catch (error: unknown) {
    return res.status(500).json({ error: safeErrorMessage(error, 'Failed to load dashboard stats.') });
  }
});

router.get('/settings/global', authenticate, async (_req: Request, res: Response) => {
  try {
    const settings = await getDocDirect('kb_settings', 'global');
    return res.json({ settings: settings || {} });
  } catch (error: unknown) {
    return res.status(500).json({ error: safeErrorMessage(error, 'Failed to load KB settings.') });
  }
});

router.patch(
  '/settings/global',
  authenticate,
  requireRole(['SYSTEM_ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const tenantId = resolveTenantFromRequest(req);
      const existing = (await getDocDirect('kb_settings', 'global')) as KBGlobalSettings | null;
      const articlesRaw = await getDocsDirect('kb_articles', []);
      const articles = (articlesRaw || []).filter((a: any) => documentBelongsToTenant(a, tenantId));
      const computedHealth = computeHealthScore(articles);

      const patch = stampTenantId(
        {
          ...(existing || {}),
          ...(req.body || {}),
          healthScore:
            typeof req.body?.healthScore === 'number'
              ? req.body.healthScore
              : (existing?.healthScore ?? computedHealth),
          previousHealthScore: existing?.healthScore ?? computedHealth,
          updatedAt: new Date().toISOString(),
        },
        tenantId,
      );

      await setDocDirect('kb_settings', 'global', patch);
      return res.json({ settings: patch });
    } catch (error: unknown) {
      return res.status(500).json({ error: safeErrorMessage(error, 'Failed to update KB settings.') });
    }
  },
);

export default router;
