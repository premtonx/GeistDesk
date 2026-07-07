import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  buildDashboardStats,
  getTicketQualityScore,
} from '../lib/dashboard-stats-service.js';

const router = Router();

router.get('/stats', authenticate, async (_req: Request, res: Response) => {
  try {
    const stats = await buildDashboardStats();
    return res.json(stats);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load dashboard stats.';
    return res.status(500).json({ error: message });
  }
});

router.get('/quality-score', authenticate, async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.force === 'true';
    const payload = await getTicketQualityScore(forceRefresh);
    return res.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load ticket quality score.';
    return res.status(500).json({ error: message });
  }
});

export default router;
