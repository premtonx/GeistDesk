/**
 * Admin first-run onboarding API.
 *   GET  /api/admin/onboarding/status
 *   POST /api/admin/onboarding/test-ai
 *   POST /api/admin/onboarding/complete
 */

import { Router, type Request, type Response } from 'express';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import {
  completeOnboarding,
  completeOnboardingSchema,
  getOnboardingStatus,
  testAiConnection,
  testAiSchema,
} from '../lib/onboarding-service.js';
import { safeErrorMessage } from '../lib/safe-log.js';

const router = Router();

router.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    const status = await getOnboardingStatus(req);
    return res.json(status);
  } catch (err) {
    return res.status(500).json({ error: safeErrorMessage(err, 'Failed to load onboarding status') });
  }
});

router.post(
  '/test-ai',
  authenticate,
  requireRole(['SYSTEM_ADMIN']),
  async (req: Request, res: Response) => {
    const parsed = testAiSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid AI test payload',
        details: parsed.error.flatten(),
      });
    }
    try {
      const result = await testAiConnection(parsed.data);
      return res.status(result.success ? 200 : 422).json(result);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: safeErrorMessage(err, 'AI connection test failed'),
      });
    }
  },
);

router.post(
  '/complete',
  authenticate,
  requireRole(['SYSTEM_ADMIN']),
  async (req: Request, res: Response) => {
    const parsed = completeOnboardingSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid onboarding payload',
        details: parsed.error.flatten(),
      });
    }
    try {
      const result = await completeOnboarding(req, parsed.data);
      return res.json(result);
    } catch (err) {
      console.error('[onboarding/complete]', safeErrorMessage(err));
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to complete onboarding') });
    }
  },
);

export default router;
