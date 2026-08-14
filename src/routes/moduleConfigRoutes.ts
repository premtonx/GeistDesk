import { Router, type Request, type Response } from 'express';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { getDocDirect, setDocDirect } from '../lib/postgres-backend.js';
import {
  normalizePolyglotBridgeSettings,
  resolvePolyglotTranslationProviderMode,
} from '../lib/module-config.js';

const router = Router();
const COLLECTION = 'module_config';
const DOC_ID = 'global';

/** Strip secrets before returning module config to non-admin operators. */
function sanitizeModuleConfigForOperators(doc: Record<string, unknown> | null) {
  if (!doc || typeof doc !== 'object') return null;

  const polyglot = (doc.polyglot as Record<string, unknown> | undefined) ?? {};

  return {
    is_initialized: doc.is_initialized === true,
    platformModules: doc.platformModules ?? undefined,
    polyglotEnabled: doc.polyglotEnabled ?? true,
    languages: doc.languages ?? [],
    polyglot: {
      translationProviderMode: resolvePolyglotTranslationProviderMode(polyglot),
      allowAiFallback: resolvePolyglotTranslationProviderMode(polyglot) === 'orchestrator',
      customDictionary: {},
      translationProviderKey: '',
    },
    personioEnabled: doc.personioEnabled ?? false,
    personioClientId: doc.personioEnabled ? doc.personioClientId ?? '' : '',
    personioEmployeeId: doc.personioEmployeeId ?? '',
    debugAdminMode: doc.debugAdminMode ?? false,
    email: doc.email ?? undefined,
    legalPolicy: doc.legalPolicy ?? '',
    forbiddenText: doc.forbiddenText ?? '',
    ssoEnabled: doc.ssoEnabled ?? false,
    ssoDomains: Array.isArray(doc.ssoDomains) ? doc.ssoDomains : [],
    exchangeCustomTemplates: Array.isArray(doc.exchangeCustomTemplates) ? doc.exchangeCustomTemplates : [],
    exchangeSettings: doc.exchangeSettings ?? undefined,
  };
}

/**
 * GET /api/module-config
 * Loads workspace module configuration from PostgreSQL for all authenticated sessions.
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const doc = await getDocDirect(COLLECTION, DOC_ID);
    if (!doc) {
      return res.status(200).json(null);
    }

    const isAdmin = req.user?.role === 'SYSTEM_ADMIN';
    return res.status(200).json(isAdmin ? doc : sanitizeModuleConfigForOperators(doc));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: 'Failed to load module configuration.', details: message });
  }
});

/**
 * PUT /api/module-config
 * Persists workspace module configuration (admin-only).
 */
router.put('/', authenticate, requireRole(['SYSTEM_ADMIN']), async (req: Request, res: Response) => {
  try {
    const data = req.body as Record<string, unknown>;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid module configuration payload.' });
    }

    if (data.polyglot && typeof data.polyglot === 'object') {
      data.polyglot = normalizePolyglotBridgeSettings(data.polyglot as Record<string, unknown>);
    }

    await setDocDirect(COLLECTION, DOC_ID, data);
    return res.status(200).json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: 'Failed to save module configuration.', details: message });
  }
});

export default router;
