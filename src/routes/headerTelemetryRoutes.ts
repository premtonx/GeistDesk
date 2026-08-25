import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { getHeaderTelemetry, EMPTY_HEADER_TELEMETRY } from '../lib/header-telemetry.js';
import { safeLog } from '../lib/safe-log.js';

const router = Router();

router.get('/telemetry', authenticate, async (req: Request, res: Response) => {
  try {
    const workspaceId = String(req.query.workspaceId || 'default');
    const snapshot = await getHeaderTelemetry(workspaceId);
    return res.json(snapshot);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load header telemetry.';
    safeLog('error', '[header/telemetry]', message);
    return res.status(200).json(EMPTY_HEADER_TELEMETRY);
  }
});

export default router;
