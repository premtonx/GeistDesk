/**
 * /api/portal/email-channel — CLIENT_ADMIN (and Hubcom SYSTEM_ADMIN) org Graph channel.
 *
 * Secrets are encrypted at rest; GET never returns plaintext client_secret.
 * Connection test runs server-side (client-credentials) to avoid browser CORS.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authMiddleware.js';
import { attachClientOrganizationContext } from '../middleware/clientPortalMiddleware.js';
import {
  createEmailChannel,
  findOrganizationEmailChannel,
  updateEmailChannel,
  updateEmailChannelStatus,
} from '../lib/email-ingestion/channel-store.js';
import { createEmailIngestionDriver } from '../lib/email-ingestion/factory.js';
import { decryptEmailChannelSecret } from '../lib/email-ingestion/channel-secret-crypto.js';
import type { EmailChannelConfig } from '../lib/email-ingestion/types.js';
import { resolveOrganizationIdFromUser } from '../lib/client-portal/ticket-visibility.js';
import {
  getOrganization,
  updateOrganizationSsoSettings,
} from '../lib/client-portal/organizations.js';
import { isClientPortalRole } from '../lib/client-portal/roles.js';
import { safeErrorMessage, safeLog } from '../lib/safe-log.js';

const router = Router();

const optionalText = (max: number) =>
  z
    .union([z.string().max(max), z.null()])
    .optional()
    .transform((value) => {
      if (value == null) return undefined;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    });

const channelUpsertSchema = z.object({
  email: optionalText(320),
  mailbox: optionalText(320),
  tenantId: optionalText(255),
  clientId: optionalText(255),
  clientSecret: optionalText(500),
  inboundEnabled: z.boolean().optional(),
  sendAsEnabled: z.boolean().optional(),
  name: optionalText(200),
});

const testSchema = channelUpsertSchema.extend({
  /** Allow testing before save — same fields as upsert. */
});

const ssoSchema = z.object({
  m365TenantId: optionalText(255),
  m365_tenant_id: optionalText(255),
  ssoEnabled: z.boolean().optional(),
  sso_enabled: z.boolean().optional(),
});

function resolveOrgId(req: Request): string | null {
  if (isClientPortalRole(req.user?.role)) {
    return resolveOrganizationIdFromUser(req.user!);
  }
  // SYSTEM_ADMIN may pass ?organizationId= for Hubcom-operated client setup.
  const q =
    (typeof req.query.organizationId === 'string' && req.query.organizationId) ||
    (typeof req.body?.organizationId === 'string' && req.body.organizationId) ||
    '';
  return q.trim() || null;
}

function publicChannelView(channel: EmailChannelConfig | null) {
  if (!channel) return null;
  return {
    id: channel.id,
    name: channel.name,
    email: channel.email,
    mailbox: channel.mailbox || channel.email,
    tenantId: channel.tenantId || null,
    clientId: channel.clientId || null,
    hasClientSecret: Boolean(
      channel.hasClientSecret ||
        channel.clientSecretSet ||
        (channel.clientSecret && channel.clientSecret.length > 0),
    ),
    inboundEnabled: channel.inboundEnabled !== false,
    sendAsEnabled: Boolean(channel.sendAsEnabled),
    status: channel.status,
    lastTestOk: channel.lastTestOk ?? null,
    lastTestAt: channel.lastTestAt ?? null,
    lastError: channel.lastError ?? null,
    organizationId: channel.organizationId || channel.organization_id || null,
    connectionType: channel.connectionType,
  };
}

async function requireOrgAccess(req: Request, res: Response): Promise<string | null> {
  const organizationId = resolveOrgId(req);
  if (!organizationId) {
    res.status(400).json({
      error:
        'organizationId is required. CLIENT_ADMIN accounts use their bound organization; SYSTEM_ADMIN must pass organizationId.',
    });
    return null;
  }
  const org = await getOrganization(organizationId);
  if (!org || !org.is_active) {
    res.status(404).json({ error: 'Organization not found or inactive.' });
    return null;
  }
  return organizationId;
}

/**
 * GET /api/portal/email-channel
 * Returns the org's Microsoft Graph channel (redacted) + SSO settings.
 */
router.get(
  '/',
  authenticate,
  attachClientOrganizationContext,
  async (req: Request, res: Response): Promise<any> => {
    const isAdmin = req.user?.role === 'SYSTEM_ADMIN' || req.user?.is_admin === true;
    if (!isAdmin) {
      // CLIENT_ADMIN only among portal roles
      if (req.user?.role !== 'CLIENT_ADMIN') {
        return res.status(403).json({
          error: 'Forbidden: CLIENT_ADMIN or SYSTEM_ADMIN required.',
        });
      }
    }

    try {
      const organizationId = await requireOrgAccess(req, res);
      if (!organizationId) return;

      const channel = await findOrganizationEmailChannel(organizationId);
      const org = await getOrganization(organizationId);
      return res.json({
        channel: publicChannelView(channel),
        organization: org
          ? {
              id: org.id,
              name: org.name,
              domain: org.domain,
              m365TenantId: org.m365_tenant_id,
              ssoEnabled: org.sso_enabled,
            }
          : null,
        setupHelper: {
          requiredApplicationPermissions: ['Mail.ReadWrite', 'Mail.Send'],
          consent: 'Admin consent required in Entra ID (Azure AD)',
          grantType: 'client_credentials',
          graphSendAs:
            'POST https://graph.microsoft.com/v1.0/users/{supportMailbox}/sendMail',
        },
      });
    } catch (err: any) {
      safeLog('error', '[portal/email-channel] get failed', err?.message || err);
      return res.status(500).json({
        error: safeErrorMessage(err, 'Failed to load email channel'),
      });
    }
  },
);

/**
 * PUT /api/portal/email-channel — create or update the org Graph channel.
 */
router.put(
  '/',
  authenticate,
  attachClientOrganizationContext,
  async (req: Request, res: Response): Promise<any> => {
    const isAdmin = req.user?.role === 'SYSTEM_ADMIN' || req.user?.is_admin === true;
    if (!isAdmin && req.user?.role !== 'CLIENT_ADMIN') {
      return res.status(403).json({
        error: 'Forbidden: CLIENT_ADMIN or SYSTEM_ADMIN required.',
      });
    }

    const parsed = channelUpsertSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid email channel payload',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const organizationId = await requireOrgAccess(req, res);
      if (!organizationId) return;

      const supportEmail =
        parsed.data.mailbox || parsed.data.email || undefined;
      if (!supportEmail) {
        return res.status(400).json({ error: 'Support-E-Mail (mailbox) is required.' });
      }

      const existing = await findOrganizationEmailChannel(organizationId, {
        includeSecrets: true,
      });

      const payload: Partial<EmailChannelConfig> = {
        name:
          parsed.data.name ||
          existing?.name ||
          `M365 — ${supportEmail}`,
        email: supportEmail,
        mailbox: supportEmail,
        connectionType: 'microsoft_graph',
        provider: 'microsoft',
        enabled: true,
        tenantId: parsed.data.tenantId ?? existing?.tenantId ?? undefined,
        clientId: parsed.data.clientId ?? existing?.clientId ?? undefined,
        clientSecret: parsed.data.clientSecret,
        organizationId,
        organization_id: organizationId,
        inboundEnabled:
          parsed.data.inboundEnabled !== undefined
            ? parsed.data.inboundEnabled
            : existing?.inboundEnabled !== false,
        sendAsEnabled:
          parsed.data.sendAsEnabled !== undefined
            ? parsed.data.sendAsEnabled
            : Boolean(existing?.sendAsEnabled),
        status: existing?.status || 'pending',
      };

      let channel: EmailChannelConfig | null;
      if (existing) {
        channel = await updateEmailChannel(existing.id, payload);
      } else {
        if (!payload.tenantId || !payload.clientId || !payload.clientSecret) {
          return res.status(400).json({
            error:
              'Tenant ID, Client ID, and Client Secret are required to create a Graph channel.',
          });
        }
        channel = await createEmailChannel(payload);
      }

      return res.json({ channel: publicChannelView(channel) });
    } catch (err: any) {
      safeLog('error', '[portal/email-channel] upsert failed', err?.message || err);
      return res.status(500).json({
        error: safeErrorMessage(err, 'Failed to save email channel'),
      });
    }
  },
);

/**
 * POST /api/portal/email-channel/test
 * Server-side client-credentials Graph handshake (no browser CORS).
 */
router.post(
  '/test',
  authenticate,
  attachClientOrganizationContext,
  async (req: Request, res: Response): Promise<any> => {
    const isAdmin = req.user?.role === 'SYSTEM_ADMIN' || req.user?.is_admin === true;
    if (!isAdmin && req.user?.role !== 'CLIENT_ADMIN') {
      return res.status(403).json({
        error: 'Forbidden: CLIENT_ADMIN or SYSTEM_ADMIN required.',
      });
    }

    const parsed = testSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid test payload',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const organizationId = await requireOrgAccess(req, res);
      if (!organizationId) return;

      const existing = await findOrganizationEmailChannel(organizationId, {
        includeSecrets: true,
      });

      let clientSecret = parsed.data.clientSecret;
      if (!clientSecret || clientSecret === '••••••••') {
        clientSecret = existing?.clientSecret
          ? decryptEmailChannelSecret(existing.clientSecret)
          : undefined;
      }

      const supportEmail =
        parsed.data.mailbox ||
        parsed.data.email ||
        existing?.mailbox ||
        existing?.email ||
        '';

      const effective: EmailChannelConfig = {
        id: existing?.id || `test-${organizationId}`,
        name: existing?.name || 'Connection test',
        email: supportEmail,
        mailbox: supportEmail,
        connectionType: 'microsoft_graph',
        enabled: true,
        status: 'pending',
        tenantId: parsed.data.tenantId || existing?.tenantId || null,
        clientId: parsed.data.clientId || existing?.clientId || null,
        clientSecret: clientSecret || null,
        organizationId,
        organization_id: organizationId,
        inboundEnabled: true,
        sendAsEnabled: true,
      };

      if (!effective.tenantId || !effective.clientId || !effective.clientSecret) {
        return res.status(400).json({
          ok: false,
          success: false,
          error:
            'Tenant ID, Client ID, and Client Secret are required for the connection test.',
        });
      }
      if (!supportEmail) {
        return res.status(400).json({
          ok: false,
          success: false,
          error: 'Support-E-Mail (mailbox) is required for the connection test.',
        });
      }

      const driver = createEmailIngestionDriver(effective);
      const result = driver.testConnection
        ? await driver.testConnection()
        : { ok: false, message: 'Graph driver unavailable.' };

      const message = result.ok
        ? result.message
        : safeErrorMessage(result.message, 'Connection test failed');

      if (existing?.id) {
        await updateEmailChannelStatus(existing.id, {
          status: result.ok ? 'connected' : /auth|credential|token|401|403/i.test(message)
            ? 'auth_error'
            : 'failed',
          lastTestOk: result.ok,
          lastTestAt: new Date().toISOString(),
          lastError: result.ok ? null : message,
        });
      }

      return res.json({
        ok: result.ok,
        success: result.ok,
        message,
      });
    } catch (err: any) {
      safeLog('error', '[portal/email-channel] test failed', err?.message || err);
      return res.status(500).json({
        ok: false,
        success: false,
        error: safeErrorMessage(err, 'Connection test failed'),
      });
    }
  },
);

/**
 * PUT /api/portal/email-channel/sso — optional per-org M365 SSO mapping.
 */
router.put(
  '/sso',
  authenticate,
  attachClientOrganizationContext,
  async (req: Request, res: Response): Promise<any> => {
    const isAdmin = req.user?.role === 'SYSTEM_ADMIN' || req.user?.is_admin === true;
    if (!isAdmin && req.user?.role !== 'CLIENT_ADMIN') {
      return res.status(403).json({
        error: 'Forbidden: CLIENT_ADMIN or SYSTEM_ADMIN required.',
      });
    }

    const parsed = ssoSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid SSO payload',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const organizationId = await requireOrgAccess(req, res);
      if (!organizationId) return;

      const m365TenantId =
        parsed.data.m365TenantId ?? parsed.data.m365_tenant_id ?? undefined;
      const ssoEnabled =
        parsed.data.ssoEnabled ?? parsed.data.sso_enabled ?? undefined;

      const org = await updateOrganizationSsoSettings(organizationId, {
        m365_tenant_id: m365TenantId === undefined ? undefined : m365TenantId || null,
        sso_enabled: ssoEnabled,
      });

      return res.json({
        organization: org
          ? {
              id: org.id,
              name: org.name,
              m365TenantId: org.m365_tenant_id,
              ssoEnabled: org.sso_enabled,
            }
          : null,
      });
    } catch (err: any) {
      safeLog('error', '[portal/email-channel] sso update failed', err?.message || err);
      return res.status(500).json({
        error: safeErrorMessage(err, 'Failed to update SSO settings'),
      });
    }
  },
);

export default router;
