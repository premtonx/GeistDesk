import { Router, type Request, type Response } from 'express';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { getEmailChannel } from '../lib/email-ingestion/channel-store.js';
import {
  checkDomainDnsRecords,
  ensureDomainVerificationFields,
  verificationTxtValue,
} from '../lib/email-ingestion/domain-verification.js';
import { EMAIL_CHANNELS_COLLECTION } from '../lib/email-ingestion/types.js';
import { routeParam } from '../lib/route-params.js';
import { updateDocDirect } from '../lib/postgres-backend.js';

const router = Router();

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
    const channelId = routeParam(req.params.channelId);
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
      console.error('[mail/verify-domain] failed', err?.message || err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Domain verification failed',
      });
    }
  },
);

export default router;
