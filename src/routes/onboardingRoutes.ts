/**
 * Admin first-run onboarding API.
 *   GET  /api/admin/onboarding/status     — public (no secrets)
 *   POST /api/admin/onboarding/test-ai    — public only while uninitialized
 *   POST /api/admin/onboarding/complete   — public only while uninitialized
 *
 * After is_initialized=true, mutations require an authenticated SYSTEM_ADMIN
 * and complete is rejected so the wizard cannot be replayed.
 */

import { Router, type NextFunction, type Request, type Response } from 'express';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { authRateLimiter } from '../middleware/rate-limiters.js';
import {
  OnboardingAlreadyCompleteError,
  completeOnboarding,
  completeOnboardingSchema,
  getOnboardingStatus,
  loadModuleConfigDoc,
  testAiConnection,
  testAiSchema,
} from '../lib/onboarding-service.js';
import { safeErrorMessage } from '../lib/safe-log.js';
import { issueSessionToken } from '../lib/session-token.js';
import { setSessionCookie } from '../lib/session-cookie.js';

const router = Router();

async function allowFirstRunOrAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const config = await loadModuleConfigDoc();
    if (config?.is_initialized !== true) {
      return next();
    }
    return authenticate(req, res, () => requireRole(['SYSTEM_ADMIN'])(req, res, next));
  } catch (err) {
    return res.status(500).json({ error: safeErrorMessage(err, 'Failed to verify onboarding state') });
  }
}

router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await getOnboardingStatus(req);
    return res.json(status);
  } catch (err) {
    return res.status(500).json({ error: safeErrorMessage(err, 'Failed to load onboarding status') });
  }
});

router.post(
  '/test-ai',
  authRateLimiter,
  allowFirstRunOrAdmin,
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
  authRateLimiter,
  allowFirstRunOrAdmin,
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
      const token = issueSessionToken({ id: result.user.id, email: result.user.email });
      setSessionCookie(res, token);
      return res.json(result);
    } catch (err) {
      if (err instanceof OnboardingAlreadyCompleteError) {
        return res.status(403).json({ error: err.message });
      }
      console.error('[onboarding/complete]', safeErrorMessage(err));
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to complete onboarding') });
    }
  },
);

export default router;
