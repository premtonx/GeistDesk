import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { AI_DECISION_ENGINE_FLOW, type AiExecutionContext, type AiFeatureId } from '../types/aiOrchestrator.js';
import { executeAiFeatureRequest } from '../lib/ai-orchestrator-service.js';
import { translatePolyglotContent } from '../lib/polyglot-translate-service.js';
import { getDocDirect } from '../lib/postgres-backend.js';

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
 * Resumes a previously approved queued request.
 */
router.post('/execute/resume', authenticate, async (req: Request, res: Response) => {
  try {
    const feature = String(req.body.feature || '') as AiFeatureId;
    const prompt = String(req.body.prompt || '');

    if (!VALID_FEATURES.has(feature) || !prompt.trim()) {
      return res.status(400).json({ error: 'feature and prompt are required.' });
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
      metadata: req.body.metadata,
    };

    const result = await executeAiFeatureRequest(ctx, { approvalAlreadyGranted: true });
    return res.status(200).json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: 'AI lifecycle resume failed.', details: message });
  }
});

/**
 * POST /api/ai/polyglot/translate
 * Token-efficient Polyglot Bridge translation (dictionary + optional DeepL).
 * Premium LLM orchestrator tokens are never used for this endpoint.
 */
router.post('/polyglot/translate', authenticate, async (req: Request, res: Response) => {
  try {
    const text = String(req.body.text || '');
    const targetLanguage = String(req.body.targetLanguage || '');
    if (!text.trim()) {
      return res.status(400).json({ error: 'text is required.' });
    }
    if (!targetLanguage.trim()) {
      return res.status(400).json({ error: 'targetLanguage is required.' });
    }

    let polyglotOptions: { customDictionary?: Record<string, Record<string, string>>; translationProviderKey?: string } = {};
    try {
      const moduleConfig = await getDocDirect('module_config', 'global');
      if (moduleConfig?.polyglot) {
        polyglotOptions = {
          customDictionary: moduleConfig.polyglot.customDictionary,
          translationProviderKey: moduleConfig.polyglot.translationProviderKey,
        };
      }
    } catch (configError) {
      console.warn('[Polyglot Bridge] Module config lookup skipped:', configError);
    }

    const translation = await translatePolyglotContent(text, targetLanguage, polyglotOptions);
    return res.status(200).json({ translation, engine: 'polyglot-bridge' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: 'Polyglot translation failed.', details: message });
  }
});

export default router;
