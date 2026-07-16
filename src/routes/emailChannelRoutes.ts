import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import {
  createEmailChannel,
  deleteEmailChannel,
  getEmailChannel,
  listEmailChannels,
  updateEmailChannel,
} from '../lib/email-ingestion/channel-store.js';
import { createEmailIngestionDriver } from '../lib/email-ingestion/factory.js';
import type { EmailConnectionType } from '../lib/email-ingestion/types.js';
import { routeParam } from '../lib/route-params.js';
import { updateDocDirect } from '../lib/postgres-backend.js';
import { EMAIL_CHANNELS_COLLECTION } from '../lib/email-ingestion/types.js';

const router = Router();

const connectionTypes = z.enum([
  'webhook',
  'imap_basic',
  'imap_oauth2',
  'microsoft_graph',
]);

const channelSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().max(320).optional(),
  group: z.string().max(200).optional(),
  status: z.enum(['verified', 'pending', 'failed', 'active', 'disabled']).optional(),
  connectionType: connectionTypes.optional(),
  enabled: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
  provider: z.enum(['gmail', 'outlook', 'custom', 'microsoft', 'google']).optional(),
  webhookSecret: z.string().max(256).optional(),
  forwardingAddress: z.string().max(320).optional(),
  imapHost: z.string().max(255).optional(),
  imapPort: z.union([z.string(), z.number()]).optional(),
  imapUser: z.string().max(320).optional(),
  imapPassword: z.string().max(500).optional(),
  imapTls: z.boolean().optional(),
  oauthClientId: z.string().max(255).optional(),
  oauthClientSecret: z.string().max(500).optional(),
  oauthTokenUrl: z.string().max(500).optional(),
  oauthRefreshToken: z.string().max(2000).optional(),
  oauthScope: z.string().max(500).optional(),
  tenantId: z.string().max(255).optional(),
  clientId: z.string().max(255).optional(),
  clientSecret: z.string().max(500).optional(),
  mailbox: z.string().max(320).optional(),
});

router.get('/', authenticate, requireRole(['SYSTEM_ADMIN']), async (_req, res: Response) => {
  try {
    const channels = await listEmailChannels();
    res.json({ channels });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to list email channels' });
  }
});

router.post('/', authenticate, requireRole(['SYSTEM_ADMIN']), async (req: Request, res: Response) => {
  const parsed = channelSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid channel payload', details: parsed.error.flatten() });
  }
  try {
    const channel = await createEmailChannel(parsed.data);
    res.status(201).json({ channel });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create channel' });
  }
});

router.put('/:id', authenticate, requireRole(['SYSTEM_ADMIN']), async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const parsed = channelSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid channel payload', details: parsed.error.flatten() });
  }
  try {
    const channel = await updateEmailChannel(id, parsed.data);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    res.json({ channel });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update channel' });
  }
});

router.delete('/:id', authenticate, requireRole(['SYSTEM_ADMIN']), async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  try {
    const ok = await deleteEmailChannel(id);
    if (!ok) return res.status(404).json({ error: 'Channel not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete channel' });
  }
});

/**
 * POST /api/email-channels/:id/test
 * Instant handshake for the channel's driver (Graph / IMAP / webhook noop).
 */
router.post('/:id/test', authenticate, requireRole(['SYSTEM_ADMIN']), async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  try {
    const channel = await getEmailChannel(id, { includeSecrets: true });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    // Allow testing unsaved form overrides
    const overrides = channelSchema.safeParse(req.body || {});
    const effective = {
      ...channel,
      ...(overrides.success ? overrides.data : {}),
      connectionType: (overrides.success && overrides.data.connectionType
        ? overrides.data.connectionType
        : channel.connectionType) as EmailConnectionType,
    };

    // Restore secrets when client sent masked placeholders
    for (const key of ['imapPassword', 'oauthClientSecret', 'clientSecret', 'webhookSecret', 'oauthRefreshToken'] as const) {
      if ((effective as any)[key] === '••••••••') {
        (effective as any)[key] = (channel as any)[key];
      }
    }

    const driver = createEmailIngestionDriver(effective);
    const result = driver.testConnection
      ? await driver.testConnection()
      : { ok: true, message: 'No test implemented for this driver.' };

    await updateDocDirect(EMAIL_CHANNELS_COLLECTION, id, {
      lastTestAt: new Date().toISOString(),
      lastTestOk: result.ok,
      status: result.ok ? 'verified' : 'failed',
      lastError: result.ok ? null : result.message,
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: result.ok, message: result.message, ok: result.ok });
  } catch (err: any) {
    res.status(500).json({ success: false, ok: false, error: err?.message || 'Connection test failed' });
  }
});

export default router;
