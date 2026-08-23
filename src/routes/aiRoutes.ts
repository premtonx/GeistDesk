import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authMiddleware.js';
import { AI_DECISION_ENGINE_FLOW, type AiExecutionContext, type AiFeatureId } from '../types/aiOrchestrator.js';
import { executeAiFeatureRequest } from '../lib/ai-orchestrator-service.js';
import { translatePolyglotContent, resolvePolyglotTranslationEngine } from '../lib/polyglot-translate-service.js';
import { getDocDirect } from '../lib/postgres-backend.js';
import { getApprovalEntry, getApprovalPayload } from '../lib/ai-orchestrator-store.js';
import { resumeApprovedAiRequest } from '../lib/ai-request-lifecycle.js';
import {
  normalizePolyglotBridgeSettings,
} from '../lib/module-config.js';
import { safeErrorMessage } from '../lib/safe-log.js';

const router = Router();

const VALID_FEATURES = new Set<string>([
  'ticket_summarization',
  'sentiment_analysis',
  'smart_reply',
  'kb_generation',
  'escalation_analysis',
  'root_cause_analysis',
  'translation',
  'vault_insights',
]);

const MAX_PROMPT_LENGTH = 32_000;
const MAX_METADATA_KEYS = 32;
const MAX_METADATA_VALUE_LENGTH = 4_000;

const executeSchema = z.object({
  feature: z.string().min(1).max(64),
  prompt: z.string().min(1).max(MAX_PROMPT_LENGTH),
  workspaceId: z.string().max(128).optional().default('default'),
  departmentId: z.string().max(128).optional(),
  customerId: z.string().max(128).optional(),
  customerScope: z.enum(['standard', 'vip', 'enterprise']).optional(),
  ticketId: z.string().max(128).optional(),
  ticketClosed: z.boolean().optional(),
  metadata: z
    .record(
      z.string().max(128),
      z.union([
        z.string().max(MAX_METADATA_VALUE_LENGTH),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(z.string().max(MAX_METADATA_VALUE_LENGTH)).max(200),
      ]),
    )
    .refine((value) => Object.keys(value).length <= MAX_METADATA_KEYS, {
      message: `metadata may contain at most ${MAX_METADATA_KEYS} keys`,
    })
    .optional(),
});

const resumeSchema = z.object({
  workspaceId: z.string().max(128).optional().default('default'),
  approvalId: z.string().min(1).max(256),
});

const translateSchema = z.object({
  text: z.string().min(1).max(MAX_PROMPT_LENGTH),
  targetLanguage: z.string().min(1).max(64),
  mood: z.string().max(64).optional(),
});

/** Provider errors may embed endpoints, model names, or key prefixes — keep the client response generic. */
function genericAiError(err: unknown, fallback: string): string {
  return safeErrorMessage(err, fallback);
}

/**
 * GET /api/ai/lifecycle/flow
 * Returns the programmatic decision-engine step chart.
 */
router.get('/lifecycle/flow', authenticate, (_req: Request, res: Response) => {
  return res.json({ flow: AI_DECISION_ENGINE_FLOW });
});

/**
 * POST /api/ai/execute
 * Runs an AI prompt through the full lifecycle middleware pipeline.
 */
router.post('/execute', authenticate, async (req: Request, res: Response) => {
  const parsed = executeSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid AI execution payload',
      details: parsed.error.flatten(),
    });
  }
  const body = parsed.data;
  if (!VALID_FEATURES.has(body.feature)) {
    return res.status(400).json({ error: 'Invalid or missing feature.' });
  }
  if (!body.prompt.trim()) {
    return res.status(400).json({ error: 'prompt is required.' });
  }

  try {
    const ctx: AiExecutionContext = {
      workspaceId: body.workspaceId,
      feature: body.feature as AiFeatureId,
      prompt: body.prompt,
      userId: req.user?.id,
      userEmail: req.user?.email,
      departmentId: body.departmentId,
      customerId: body.customerId,
      customerScope: body.customerScope,
      ticketId: body.ticketId,
      ticketClosed: body.ticketClosed === true,
      metadata: body.metadata,
    };

    const result = await executeAiFeatureRequest(ctx);
    return res.status(200).json(result);
  } catch (error: unknown) {
    const message = genericAiError(error, 'AI lifecycle execution failed.');
    console.error('[AI Execute] Lifecycle error:', message);
    return res.status(500).json({ error: 'AI lifecycle execution failed.', details: message });
  }
});

/**
 * POST /api/ai/execute/resume
 * Resumes an approved queued request.
 *
 * Security: resuming is only allowed for a queue entry that has already been
 * approved (via POST /api/admin/orchestrator/approvals/:id/resolve), and only
 * by the original requester or a SYSTEM_ADMIN. The prompt/metadata are taken
 * from the stored approval payload — the client cannot substitute its own.
 */
router.post('/execute/resume', authenticate, async (req: Request, res: Response) => {
  const parsed = resumeSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid resume payload',
      details: parsed.error.flatten(),
    });
  }
  const { workspaceId, approvalId } = parsed.data;

  try {
    const entry = await getApprovalEntry(approvalId, workspaceId);
    if (!entry) {
      return res.status(404).json({ error: 'Approval entry not found.' });
    }
    if (entry.status !== 'approved') {
      return res.status(403).json({ error: 'This request has not been approved yet.' });
    }

    const callerEmail = req.user?.email;
    const callerId = req.user?.id;
    const isRequester =
      (entry.requestedBy && callerEmail && entry.requestedBy === callerEmail) ||
      (entry.requestedBy && callerId && entry.requestedBy === callerId);
    const isAdmin = req.user?.role === 'SYSTEM_ADMIN';

    if (!isRequester && !isAdmin) {
      return res.status(403).json({
        error: 'Only the requester of an approved request or an administrator may resume it.',
      });
    }

    const payload = await getApprovalPayload(approvalId, workspaceId);
    if (!payload?.prompt) {
      return res.status(400).json({ error: 'Approved request has no payload to resume.' });
    }

    const result = await resumeApprovedAiRequest({
      workspaceId,
      feature: entry.feature,
      prompt: payload.prompt,
      userId: callerId,
      userEmail: callerEmail,
      metadata: payload.metadata,
    });
    return res.status(200).json(result);
  } catch (error: unknown) {
    const message = genericAiError(error, 'AI lifecycle resume failed.');
    console.error('[AI Execute/Resume]', message);
    return res.status(500).json({ error: 'AI lifecycle resume failed.', details: message });
  }
});

/**
 * POST /api/ai/polyglot/translate
 * Token-efficient Polyglot Bridge translation (dictionary + optional DeepL + optional LLM when enabled).
 */
router.post('/polyglot/translate', authenticate, async (req: Request, res: Response) => {
  const parsed = translateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid translation payload',
      details: parsed.error.flatten(),
    });
  }
  const { text, targetLanguage, mood } = parsed.data;

  try {
    let polyglotOptions: {
      customDictionary?: Record<string, Record<string, string>>;
      translationProviderMode?: 'dictionary_only' | 'deepl' | 'orchestrator';
      translationProviderKey?: string;
      mood?: string;
    } = { mood };
    let providerMode: 'dictionary_only' | 'deepl' | 'orchestrator' = 'dictionary_only';

    try {
      const moduleConfig = await getDocDirect('module_config', 'global');
      if (moduleConfig?.polyglot) {
        const polyglot = normalizePolyglotBridgeSettings(moduleConfig.polyglot);
        providerMode = polyglot.translationProviderMode;
        polyglotOptions = {
          customDictionary: polyglot.customDictionary,
          translationProviderMode: polyglot.translationProviderMode,
          translationProviderKey: polyglot.translationProviderKey,
          mood,
        };
      }
    } catch (configError) {
      console.warn('[Polyglot Bridge] Module config lookup skipped:', configError);
    }

    const translation = await translatePolyglotContent(text, targetLanguage, polyglotOptions);
    const engine = resolvePolyglotTranslationEngine(providerMode);
    return res.status(200).json({ translation, engine, providerMode });
  } catch (error: unknown) {
    const message = genericAiError(error, 'Polyglot translation failed.');
    console.error('[Polyglot Translate]', message);
    return res.status(500).json({ error: 'Polyglot translation failed.', details: message });
  }
});

export default router;
