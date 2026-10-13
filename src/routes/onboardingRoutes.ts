/**
 * Admin first-run onboarding API.
 *   GET  /api/admin/onboarding/status          — public (no secrets)
 *   POST /api/admin/onboarding/register-admin  — public only when no admin exists
 *   POST /api/admin/onboarding/test-ai         — authenticated admin session
 *   POST /api/admin/onboarding/complete        — authenticated admin session
 *
 * After the first admin is written, register-admin is locked (409).
 * After is_initialized=true, complete is rejected so the wizard cannot be replayed.
 */

import { Router, type NextFunction, type Request, type Response } from 'express';
import { authenticate, optionalAuthenticate, requireRole } from '../middleware/authMiddleware.js';
import { authRateLimiter, credentialRateLimiter } from '../middleware/rate-limiters.js';
import {
  OnboardingAdminExistsError,
  OnboardingAlreadyCompleteError,
  completeOnboarding,
  completeOnboardingSchema,
  getOnboardingStatus,
  hasPrimaryAdmin,
  loadModuleConfigDoc,
  registerAdminSchema,
  registerPrimaryAdmin,
  testAiConnection,
  testAiSchema,
} from '../lib/onboarding-service.js';
import { safeErrorMessage, safeLog } from '../lib/safe-log.js';
import { issueSessionToken } from '../lib/session-token.js';
import { setSessionCookie } from '../lib/session-cookie.js';

const router = Router();

/** Public only while no administrator row exists. */
async function allowRegisterAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    if (await hasPrimaryAdmin()) {
      return res.status(409).json({
        error: 'An administrator already exists. Sign in at /login.',
      });
    }
    const config = await loadModuleConfigDoc();
    if (config?.is_initialized === true) {
      return res.status(403).json({
        error: 'GeistDesk is already initialized. Sign in at /login.',
      });
    }
    return next();
  } catch (err) {
    return res.status(500).json({ error: safeErrorMessage(err, 'Failed to verify onboarding state') });
  }
}

/**
 * Steps 2–4 and complete require the session cookie issued by register-admin.
 * If no admin exists yet, force the client through Step 1 first.
 */
async function requireWizardAdminSession(req: Request, res: Response, next: NextFunction) {
  try {
    if (!(await hasPrimaryAdmin())) {
      return res.status(401).json({
        error: 'Create the administrator account first.',
      });
    }
    return authenticate(req, res, () => requireRole(['SYSTEM_ADMIN'])(req, res, next));
  } catch (err) {
    return res.status(500).json({ error: safeErrorMessage(err, 'Failed to verify onboarding state') });
  }
}

router.get('/status', optionalAuthenticate, async (req: Request, res: Response) => {
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
  credentialRateLimiter,
  requireWizardAdminSession,
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
  '/register-admin',
  authRateLimiter,
  credentialRateLimiter,
  allowRegisterAdmin,
  async (req: Request, res: Response) => {
    const parsed = registerAdminSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid administrator payload',
        details: parsed.error.flatten(),
      });
    }
    try {
      const result = await registerPrimaryAdmin(req, parsed.data);
      const token = issueSessionToken({ id: result.user.id, email: result.user.email });
      setSessionCookie(res, token);
      return res.status(201).json(result);
    } catch (err) {
      if (err instanceof OnboardingAdminExistsError) {
        return res.status(409).json({ error: err.message });
      }
      if (err instanceof OnboardingAlreadyCompleteError) {
        return res.status(403).json({ error: err.message });
      }
      safeLog('error', '[onboarding/register-admin]', safeErrorMessage(err));
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to create administrator') });
    }
  },
);

router.post(
  '/complete',
  authRateLimiter,
  credentialRateLimiter,
  requireWizardAdminSession,
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
      safeLog('error', '[onboarding/complete]', safeErrorMessage(err));
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to complete onboarding') });
    }
  },
);

export default router;
