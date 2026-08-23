import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import {
  createEmailChannel,
  deleteEmailChannel,
  getEmailChannel,
  listEmailChannels,
  updateEmailChannel,
  updateEmailChannelStatus,
} from '../lib/email-ingestion/channel-store.js';
import { createEmailIngestionDriver } from '../lib/email-ingestion/factory.js';
import type { EmailConnectionType } from '../lib/email-ingestion/types.js';
import { routeParam } from '../lib/route-params.js';
import { safeErrorMessage } from '../lib/safe-log.js';

const router = Router();

const connectionTypes = z.enum([
  'webhook',
  'imap_basic',
  'imap_oauth2',
  'microsoft_graph',
]);

/** Accept undefined / null / empty from UI + document-store round-trips. */
const optionalText = (max: number) =>
  z
    .union([z.string().max(max), z.null()])
    .optional()
    .transform((value) => {
      if (value == null) return undefined;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    });

const optionalPort = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value) => {
    if (value == null || value === '') return undefined;
    return value;
  });

const optionalBool = z
  .union([z.boolean(), z.null()])
  .optional()
  .transform((value) => (value == null ? undefined : value));

const channelSchema = z
  .object({
    name: optionalText(200),
    email: optionalText(320),
    group: optionalText(200),
    status: z
      .enum(['verified', 'pending', 'failed', 'active', 'disabled', 'connected', 'auth_error'])
      .optional(),
    connectionType: connectionTypes.optional(),
    enabled: optionalBool,
    isPrimary: optionalBool,
    provider: z.enum(['gmail', 'outlook', 'custom', 'microsoft', 'google']).nullish(),
    webhookSecret: optionalText(256),
    forwardingAddress: optionalText(320),
    // IMAP fields are optional at the schema level — required only for IMAP types below.
    imapHost: optionalText(255),
    imapPort: optionalPort,
    imapUser: optionalText(320),
    imapPassword: optionalText(500),
    imapTls: optionalBool,
    oauthClientId: optionalText(255),
    oauthClientSecret: optionalText(500),
    oauthTokenUrl: optionalText(500),
    oauthRefreshToken: optionalText(2000),
    oauthScope: optionalText(500),
    tenantId: optionalText(255),
    clientId: optionalText(255),
    clientSecret: optionalText(500),
    mailbox: optionalText(320),
  })
  .superRefine((data, ctx) => {
    const type = data.connectionType || 'webhook';

    // Webhook / passive forwarding: never require IMAP / Graph server credentials.
    if (type === 'webhook') {
      return;
    }

    // Soft checks only — secrets may be omitted on update (masked •••••••• restored later).
    if ((type === 'imap_basic' || type === 'imap_oauth2') && !data.imapHost) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['imapHost'],
        message: 'IMAP host is required for IMAP connection types',
      });
    }
  });

/** Drop driver-specific secrets that do not apply to the selected connection type. */
function sanitizeByConnectionType<T extends Record<string, unknown>>(data: T): T {
  const type = (data.connectionType as EmailConnectionType | undefined) || 'webhook';
  const next: Record<string, unknown> = { ...data };

  if (type === 'webhook') {
    next.imapHost = undefined;
    next.imapPort = undefined;
    next.imapUser = undefined;
    next.imapPassword = undefined;
    next.imapTls = undefined;
    next.oauthClientId = undefined;
    next.oauthClientSecret = undefined;
    next.oauthTokenUrl = undefined;
    next.oauthRefreshToken = undefined;
    next.oauthScope = undefined;
    next.tenantId = undefined;
    next.clientId = undefined;
    next.clientSecret = undefined;
    next.mailbox = undefined;
  } else if (type === 'imap_basic') {
    next.oauthClientId = undefined;
    next.oauthClientSecret = undefined;
    next.oauthTokenUrl = undefined;
    next.oauthRefreshToken = undefined;
    next.oauthScope = undefined;
    next.tenantId = undefined;
    next.clientId = undefined;
    next.clientSecret = undefined;
  } else if (type === 'imap_oauth2') {
    next.imapPassword = undefined;
    next.tenantId = undefined;
    next.clientId = undefined;
    next.clientSecret = undefined;
  } else if (type === 'microsoft_graph') {
    next.imapHost = undefined;
    next.imapPort = undefined;
    next.imapUser = undefined;
    next.imapPassword = undefined;
    next.imapTls = undefined;
    next.oauthClientId = undefined;
    next.oauthClientSecret = undefined;
    next.oauthTokenUrl = undefined;
    next.oauthRefreshToken = undefined;
    next.oauthScope = undefined;
  }

  return next as T;
}

router.get('/', authenticate, requireRole(['SYSTEM_ADMIN']), async (_req, res: Response) => {
  try {
    const channels = await listEmailChannels();
    res.json({ channels });
  } catch (err: any) {
    res.status(500).json({ error: safeErrorMessage(err, 'Failed to list email channels') });
  }
});

router.post('/', authenticate, requireRole(['SYSTEM_ADMIN']), async (req: Request, res: Response) => {
  const parsed = channelSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid channel payload', details: parsed.error.flatten() });
  }
  try {
    const channel = await createEmailChannel(sanitizeByConnectionType(parsed.data));
    res.status(201).json({ channel });
  } catch (err: any) {
    res.status(500).json({ error: safeErrorMessage(err, 'Failed to create channel') });
  }
});

router.put('/:id', authenticate, requireRole(['SYSTEM_ADMIN']), async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const parsed = channelSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid channel payload', details: parsed.error.flatten() });
  }
  try {
    const channel = await updateEmailChannel(id, sanitizeByConnectionType(parsed.data));
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    res.json({ channel });
  } catch (err: any) {
    res.status(500).json({ error: safeErrorMessage(err, 'Failed to update channel') });
  }
});

router.delete('/:id', authenticate, requireRole(['SYSTEM_ADMIN']), async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  try {
    const ok = await deleteEmailChannel(id);
    if (!ok) return res.status(404).json({ error: 'Channel not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: safeErrorMessage(err, 'Failed to delete channel') });
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
    const overrideData = overrides.success
      ? sanitizeByConnectionType(overrides.data)
      : {};
    const effective = {
      ...channel,
      ...overrideData,
      connectionType: (overrideData.connectionType
        ? overrideData.connectionType
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

    // Driver errors (IMAP / Graph auth details) can embed hosts, tenant IDs, or
    // token fragments — persist a redacted copy and never return raw details.
    const redactedMessage = safeErrorMessage(result.message, 'Connection test failed');
    const isAuthFailure = !result.ok && /auth|credential|token|401|403|denied|password/i.test(redactedMessage);
    await updateEmailChannelStatus(id, {
      status: result.ok ? 'connected' : isAuthFailure ? 'auth_error' : 'failed',
      lastTestOk: result.ok,
      lastTestAt: new Date().toISOString(),
      lastError: result.ok ? null : redactedMessage,
    });

    res.json({ success: result.ok, message: redactedMessage, ok: result.ok });
  } catch (err: any) {
    const message = safeErrorMessage(err, 'Connection test failed');
    res.status(500).json({ success: false, ok: false, error: message });
  }
});

export default router;
