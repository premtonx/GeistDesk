import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { getEmailChannel } from '../lib/email-ingestion/channel-store.js';
import {
  buildDkimRecordName,
  buildSpfRecordValue,
  checkDomainDnsRecords,
  DEFAULT_DKIM_SELECTOR,
  ensureDomainVerificationFields,
  mailForwardDomain,
  verificationTxtValue,
} from '../lib/email-ingestion/domain-verification.js';
import { EMAIL_CHANNELS_COLLECTION } from '../lib/email-ingestion/types.js';
import { routeParam } from '../lib/route-params.js';
import { getDocsDirect, updateDocDirect } from '../lib/postgres-backend.js';
import { safeErrorMessage, safeLog } from '../lib/safe-log.js';

const router = Router();

const channelIdParamSchema = z.object({ channelId: z.string().min(1).max(200) });
/**
 * POST /api/mail/verify-domain/:channelId
 * Resolve TXT (geist-verification=…) + DKIM via dns.promises.resolveTxt.
 * On success, persist dnsVerified=true on the email channel document.
 */
router.post(
  '/verify-domain/:channelId',
  authenticate,
  requireRole(['SYSTEM_ADMIN']),
  async (req: Request, res: Response) => {
    const paramParsed = channelIdParamSchema.safeParse({ channelId: req.params.channelId });
    if (!paramParsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid channel id.' });
    }
    const channelId = routeParam(paramParsed.data.channelId);
    try {
      let channel = await getEmailChannel(channelId, { includeSecrets: true });
      if (!channel) {
        return res.status(404).json({ success: false, error: 'Channel not found' });
      }

      // Backfill verification material for channels created before this feature.
      if (!channel.verificationToken || !channel.dkimRecordValue) {
        const fields = ensureDomainVerificationFields(channel);
        await updateDocDirect(EMAIL_CHANNELS_COLLECTION, channelId, {
          ...fields,
          updatedAt: new Date().toISOString(),
        });
        channel = {
          ...channel,
          ...fields,
        };
      }

      const result = await checkDomainDnsRecords(channel);
      const now = new Date().toISOString();

      if (result.ok) {
        await updateDocDirect(EMAIL_CHANNELS_COLLECTION, channelId, {
          dnsVerified: true,
          dnsVerifiedAt: now,
          status: channel.status === 'failed' ? 'verified' : channel.status,
          lastError: null,
          updatedAt: now,
        });
      } else {
        await updateDocDirect(EMAIL_CHANNELS_COLLECTION, channelId, {
          dnsVerified: false,
          dnsVerifiedAt: null,
          lastError: result.message,
          updatedAt: now,
        });
      }

      return res.json({
        success: result.ok,
        dnsVerified: result.ok,
        domain: result.domain,
        message: result.message,
        checks: {
          verificationTxt: result.verificationTxtFound,
          dkim: result.dkimFound,
          spf: result.spfFound,
        },
        records: {
          verificationToken: channel.verificationToken,
          verificationTxt: verificationTxtValue(channel.verificationToken || ''),
          dkimRecordName: channel.dkimRecordName,
          dkimRecordValue: channel.dkimRecordValue,
          spfRecordValue: channel.spfRecordValue,
        },
        details: result.details,
        channel: {
          id: channelId,
          email: channel.email,
          dnsVerified: result.ok,
          dnsVerifiedAt: result.ok ? now : null,
        },
      });
    } catch (err: any) {
      safeLog('error', '[mail/verify-domain] failed', safeErrorMessage(err));
      return res.status(500).json({
        success: false,
        error: safeErrorMessage(err, 'Domain verification failed'),
      });
    }
  },
);

/**
 * GET /api/mail/reputation
 * Outbound sender reputation overview: configured SMTP/dispatcher, per-channel
 * SPF/DKIM/DMARC material, and live DNS verification state. Used by the
 * pre-production checklist to confirm mail lands in the inbox, not spam.
 */
router.get(
  '/reputation',
  authenticate,
  requireRole(['SYSTEM_ADMIN']),
  async (_req: Request, res: Response) => {
    try {
      const channels = await getDocsDirect(EMAIL_CHANNELS_COLLECTION, []);
      const domain = mailForwardDomain();

      const channelStatus = [];
      for (const doc of channels) {
        const data = (doc as any).data || {};
        const email = String(data.email || '');
        if (!email) continue;
        const channel = await getEmailChannel(String(doc.id), { includeSecrets: true });
        if (!channel) continue;
        const verified = Boolean(channel.dnsVerified);
        const records = verified
          ? {
              spfRecordValue: channel.spfRecordValue || buildSpfRecordValue(domain),
              dkimRecordName: channel.dkimRecordName || `${DEFAULT_DKIM_SELECTOR}._domainkey`,
              dkimRecordValue: channel.dkimRecordValue || '(generated per channel)',
              verificationTxt: verificationTxtValue(channel.verificationToken || ''),
            }
          : null;
        channelStatus.push({
          id: channel.id,
          email,
          dnsVerified: verified,
          dnsVerifiedAt: channel.dnsVerifiedAt || null,
          provider: channel.provider || 'custom',
          records,
        });
      }

      return res.json({
        success: true,
        configured: {
          smtpHost: process.env.SMTP_HOST || null,
          mailDispatchUrl: process.env.MAIL_DISPATCH_URL || null,
          mailFromAddress: process.env.MAIL_FROM_ADDRESS || null,
          mailForwardDomain: domain,
        },
        // External dispatchers (Resend/Postmark/Mailgun/Mailcow) own SPF/DKIM
        // for their sending domain; the checklist is satisfied when at least
        // one channel is DNS-verified and a dispatcher is configured.
        reputation: {
          dispatcherConfigured: Boolean(
            process.env.MAIL_DISPATCH_URL || process.env.SMTP_HOST || process.env.RESEND_API_KEY,
          ),
          anyChannelVerified: channelStatus.some((c) => c.dnsVerified),
          verifiedDomains: [...new Set(channelStatus.filter((c) => c.dnsVerified).map((c) => c.email.split('@')[1]))],
        },
        channels: channelStatus,
        note: 'Verify SPF, DKIM, and DMARC at your sending domain DNS provider. dnsVerified reflects the TXT/DKIM/SPF records published for each support alias.',
      });
    } catch (err: any) {
      safeLog('error', '[mail/reputation] failed', safeErrorMessage(err));
      return res.status(500).json({ success: false, error: safeErrorMessage(err, 'Reputation check failed') });
    }
  },
);

export default router;
