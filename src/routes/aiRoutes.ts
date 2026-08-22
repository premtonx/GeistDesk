import { Router, type Request, type Response } from 'express';
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
  try {
    const feature = String(req.body.feature || '') as AiFeatureId;
    const prompt = String(req.body.prompt || '');

    if (!VALID_FEATURES.has(feature)) {
      return res.status(400).json({ error: 'Invalid or missing feature.' });
    }
    if (!prompt.trim()) {
      return res.status(400).json({ error: 'prompt is required.' });
    }

    const ctx: AiExecutionContext = {
      workspaceId: String(req.body.workspaceId || 'default'),
      feature,
      prompt,
      userId: req.user?.id,
      userEmail: req.user?.email,
      departmentId: req.body.departmentId ? String(req.body.departmentId) : undefined,
      customerId: req.body.customerId ? String(req.body.customerId) : undefined,
      customerScope: req.body.customerScope,
      ticketId: req.body.ticketId ? String(req.body.ticketId) : undefined,
      ticketClosed: req.body.ticketClosed === true,
      metadata: req.body.metadata,
    };

    const result = await executeAiFeatureRequest(ctx);
    return res.status(200).json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
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
  try {
    const workspaceId = String(req.body.workspaceId || 'default');
    const approvalId = String(req.body.approvalId || '');

    if (!approvalId.trim()) {
      return res.status(400).json({ error: 'approvalId is required.' });
    }

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
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: 'AI lifecycle resume failed.', details: message });
  }
});

/**
 * POST /api/ai/polyglot/translate
 * Token-efficient Polyglot Bridge translation (dictionary + optional DeepL + optional LLM when enabled).
 */
router.post('/polyglot/translate', authenticate, async (req: Request, res: Response) => {
  try {
    const text = String(req.body.text || '');
    const targetLanguage = String(req.body.targetLanguage || '');
    const mood = req.body.mood ? String(req.body.mood) : undefined;
    if (!text.trim()) {
      return res.status(400).json({ error: 'text is required.' });
    }
    if (!targetLanguage.trim()) {
      return res.status(400).json({ error: 'targetLanguage is required.' });
    }

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
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: 'Polyglot translation failed.', details: message });
  }
});

export default router;
