import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { AI_DECISION_ENGINE_FLOW, type AiExecutionContext, type AiFeatureId, type AiOperatorLanguage } from '../types/aiOrchestrator.js';
import { executeAiFeatureRequest } from '../lib/ai-orchestrator-service.js';

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

function resolveOperatorLanguage(req: Request): AiOperatorLanguage {
  const fromBody = String(req.body.operatorLanguage || '').toLowerCase();
  if (fromBody === 'de' || fromBody === 'en') return fromBody;
  const accept = String(req.headers['accept-language'] || '').toLowerCase();
  if (accept.startsWith('de')) return 'de';
  return 'en';
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
      operatorLanguage: resolveOperatorLanguage(req),
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
      operatorLanguage: resolveOperatorLanguage(req),
      metadata: req.body.metadata,
    };

    const result = await executeAiFeatureRequest(ctx, { approvalAlreadyGranted: true });
    return res.status(200).json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: 'AI lifecycle resume failed.', details: message });
  }
});

export default router;
