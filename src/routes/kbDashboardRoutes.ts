import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { getDocDirect, getDocsDirect, setDocDirect } from '../lib/postgres-backend.js';
import {
  computeDashboardMetrics,
  computeHealthScore,
  type KBGlobalSettings,
} from '../lib/kb-dashboard-metrics.js';
import {
  resolveTenantFromRequest,
  stampTenantId,
} from '../lib/tenant-context.js';
import { safeErrorMessage } from '../lib/safe-log.js';

const router = Router();

/** KB global settings patch — free-form but bounded to known keys. */
const settingsPatchSchema = z
  .object({
    healthScore: z.number().min(0).max(100).optional(),
    aiSuggestionsEnabled: z.boolean().optional(),
    autoCategorize: z.boolean().optional(),
    defaultVisibility: z.string().max(40).optional(),
    suggestedArticleCount: z.number().min(0).max(50).optional(),
    enabled: z.boolean().optional(),
    name: z.string().max(200).optional(),
    updatedAt: z.string().optional(),
  })
  .optional()
  .default({});

router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenantFromRequest(req);
    const [articles, settingsDoc] = await Promise.all([
      getDocsDirect('kb_articles', [], { tenantId }),
      getDocDirect('kb_settings', 'global', { tenantId }),
    ]);

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
      const parsedBody = settingsPatchSchema.parse(req.body || {});
      const existing = (await getDocDirect('kb_settings', 'global', { tenantId })) as KBGlobalSettings | null;
      const articles = await getDocsDirect('kb_articles', [], { tenantId });
      const computedHealth = computeHealthScore(articles);

      const patch = stampTenantId(
        {
          ...(existing || {}),
          ...parsedBody,
          healthScore:
            typeof parsedBody.healthScore === 'number'
              ? parsedBody.healthScore
              : (existing?.healthScore ?? computedHealth),
          previousHealthScore: existing?.healthScore ?? computedHealth,
          updatedAt: new Date().toISOString(),
        },
        tenantId,
      );

      await setDocDirect('kb_settings', 'global', patch, { tenantId });
      return res.json({ settings: patch });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid settings payload.', details: error.flatten() });
      }
      return res.status(500).json({ error: safeErrorMessage(error, 'Failed to update KB settings.') });
    }
  },
);

export default router;
