import { Router, type Request, type Response } from 'express';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { getDocDirect, setDocDirect } from '../lib/postgres-backend.js';
import {
  normalizePolyglotBridgeSettings,
  resolvePolyglotTranslationProviderMode,
} from '../lib/module-config.js';
import { z } from 'zod';

const router = Router();
const COLLECTION = 'module_config';
const DOC_ID = 'global';

/** Secret-bearing keys that must never be returned to any client. */
const SECRET_FIELDS = {
  'ai.apiKey': 'ai.hasKey',
  'ai.customApiKey': 'ai.hasCustomKey',
  'personioClientSecret': 'hasPersonioSecret',
  'polyglot.translationProviderKey': 'polyglot.hasTranslationKey',
} as const;

function getPath(obj: Record<string, unknown>, path: string): unknown {
  const [head, ...rest] = path.split('.');
  const value = obj[head];
  if (rest.length === 0 || !value || typeof value !== 'object') return value;
  return getPath(value as Record<string, unknown>, rest.join('.'));
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const [head, ...rest] = path.split('.');
  if (rest.length === 0) {
    obj[head] = value;
    return;
  }
  const nested = (obj[head] ??= {}) as Record<string, unknown>;
  setPath(nested, rest.join('.'), value);
}

function deletePath(obj: Record<string, unknown>, path: string): void {
  const [head, ...rest] = path.split('.');
  if (rest.length === 0) {
    delete obj[head];
    return;
  }
  const nested = obj[head];
  if (nested && typeof nested === 'object') {
    deletePath(nested as Record<string, unknown>, rest.join('.'));
  }
}

/**
 * Strip every secret field out of the stored document and replace it with a
 * `hasX` boolean so admin UIs can show "configured" without ever receiving
 * the raw secret. This applies to admins too — the browser is not a trusted
 * place for provider credentials.
 */
function sanitizeModuleConfig(doc: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!doc || typeof doc !== 'object') return null;

  const copy: Record<string, unknown> = JSON.parse(JSON.stringify(doc));
  for (const [secretPath, flagKey] of Object.entries(SECRET_FIELDS)) {
    const raw = getPath(copy, secretPath);
    const hasValue = typeof raw === 'string' && raw.length > 0;
    deletePath(copy, secretPath);
    const [head, ...rest] = flagKey.split('.');
    if (rest.length === 0) {
      copy[head] = hasValue;
    } else {
      const nested = (copy[head] ??= {}) as Record<string, unknown>;
      nested[rest.join('.')] = hasValue;
    }
  }

  return copy;
}

/** True when the incoming `hasX` flag means "keep the stored secret unchanged". */
function wantsKeepSecret(payload: Record<string, unknown>, flagKey: string): boolean {
  const [head, ...rest] = flagKey.split('.');
  const value = rest.length === 0 ? payload[head] : getPath(payload, flagKey);
  return value === true;
}

/**
 * Re-attach stored secrets for fields the client indicated should be kept
 * (`hasX === true`). If the client sends a genuinely new value for a secret
 * field, that value is stored instead.
 */
function mergeKeptSecrets(
  stored: Record<string, unknown> | null,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...incoming };
  for (const [secretPath, flagKey] of Object.entries(SECRET_FIELDS)) {
    const incomingSecret = getPath(incoming, secretPath);
    const hasNewValue = typeof incomingSecret === 'string' && incomingSecret.length > 0;
    if (hasNewValue) {
      // New secret value provided — store it, drop the flag.
      deletePath(next, flagKey);
      continue;
    }
    if (stored && wantsKeepSecret(incoming, flagKey)) {
      const existing = getPath(stored, secretPath);
      setPath(next, secretPath, existing);
    }
  }
  return next;
}

/**
 * Allow-list schema for module-config updates. Only fields the Admin UI is
 * permitted to touch are accepted; everything else is dropped.
 */
const moduleConfigPatchSchema = z
  .object({
    is_initialized: z.boolean().optional(),
    platformModules: z
      .object({
        geistKB: z.boolean().optional(),
        geistVault: z.boolean().optional(),
        geistExchange: z.boolean().optional(),
      })
      .optional(),
    polyglotEnabled: z.boolean().optional(),
    languages: z
      .array(
        z.object({
          lang: z.string(),
          isoCode: z.string(),
          flagCode: z.string(),
          enabled: z.boolean(),
        }),
      )
      .optional(),
    polyglot: z
      .object({
        translationProviderMode: z.enum(['dictionary_only', 'deepl', 'orchestrator']).optional(),
        translationProviderKey: z.string().optional(),
        hasTranslationKey: z.boolean().optional(),
        customDictionary: z.record(z.string(), z.record(z.string(), z.string())).optional(),
        allowAiFallback: z.boolean().optional(),
      })
      .optional(),
    debugAdminMode: z.boolean().optional(),
    personioEnabled: z.boolean().optional(),
    personioClientId: z.string().optional(),
    personioClientSecret: z.string().optional(),
    hasPersonioSecret: z.boolean().optional(),
    personioEmployeeId: z.string().optional(),
    ai: z
      .object({
        sentimentModel: z.enum(['local-gemma', 'local-llama', 'gemini-flash', 'custom-local']).optional(),
        deepThinkingModel: z.enum(['qwen-36b', 'llama-3-70b', 'gemini-pro', 'custom-local']).optional(),
        summaryModel: z.enum(['sentiment', 'thinking']).optional(),
        localEndpoint: z.string().optional(),
        apiKey: z.string().optional(),
        hasKey: z.boolean().optional(),
        customSentimentModelName: z.string().optional(),
        customThinkingModelName: z.string().optional(),
        customApiKey: z.string().optional(),
        hasCustomKey: z.boolean().optional(),
      })
      .optional(),
    email: z
      .object({
        senderName: z.string().optional(),
        supportEmail: z.string().optional(),
        smtpHost: z.string().optional(),
        smtpPort: z.string().optional(),
        useOAuth: z.boolean().optional(),
        imapHost: z.string().optional(),
        imapPort: z.string().optional(),
        forwardAddress: z.string().optional(),
        threadingEnabled: z.boolean().optional(),
        autoTriageEnabled: z.boolean().optional(),
        signature: z.string().optional(),
      })
      .optional(),
    legalPolicy: z.string().optional(),
    forbiddenText: z.string().optional(),
    ssoEnabled: z.boolean().optional(),
    ssoClientId: z.string().optional(),
    ssoTenantId: z.string().optional(),
    ssoDomains: z.array(z.string()).optional(),
    exchangeCustomTemplates: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          tags: z.array(z.string()),
          description: z.string(),
          acceptedTypes: z.array(z.string()),
          uploadLimit: z.string(),
          variables: z.array(z.string()),
          createdAt: z.string(),
        }),
      )
      .optional(),
    exchangeSettings: z
      .object({
        defaultExpirationHours: z.number().optional(),
        globalDownloadLimit: z.number().optional(),
        storageWarningThresholdPercent: z.number().optional(),
        storageQuotaGb: z.number().optional(),
      })
      .optional(),
  })
  .strict();

/**
 * GET /api/module-config
 * Loads workspace module configuration from PostgreSQL for all authenticated
 * sessions. Secrets are always stripped — the browser never receives provider
 * credentials, only `hasX` indicators.
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const doc = await getDocDirect(COLLECTION, DOC_ID);
    if (!doc) {
      return res.status(200).json(null);
    }

    return res.status(200).json(sanitizeModuleConfig(doc as Record<string, unknown>));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: 'Failed to load module configuration.', details: message });
  }
});

/**
 * PUT /api/module-config
 * Persists workspace module configuration (admin-only). The payload is
 * validated against an allow-list; secrets the client did not change are kept
 * from the stored document via the `hasX` flags.
 */
router.put('/', authenticate, requireRole(['SYSTEM_ADMIN']), async (req: Request, res: Response) => {
  try {
    const parsed = moduleConfigPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Input validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const data = parsed.data as Record<string, unknown>;

    const stored = await getDocDirect(COLLECTION, DOC_ID);
    const merged = mergeKeptSecrets(
      (stored as Record<string, unknown> | null),
      data,
    );

    if (merged.polyglot && typeof merged.polyglot === 'object') {
      merged.polyglot = normalizePolyglotBridgeSettings(merged.polyglot as Record<string, unknown>);
    }

    await setDocDirect(COLLECTION, DOC_ID, merged);
    return res.status(200).json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: 'Failed to save module configuration.', details: message });
  }
});

export default router;
