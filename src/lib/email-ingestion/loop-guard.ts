/**
 * Infinite email loop guard.
 *
 * Drops inbound mail that is an auto-reply / out-of-office / bounce / system
 * notification, or that comes from the platform's own support addresses.
 * Prevents the classic OOO-responder loop from generating thousands of tickets.
 */

import { extractEmailAddress } from '../global-blacklist.js';
import { getDocsDirect } from '../postgres-backend.js';
import { EMAIL_CHANNELS_COLLECTION } from './types.js';

export interface LoopGuardResult {
  blocked: boolean;
  reason?: string;
}

const AUTOREPLY_HEADER_VALUES = /auto-replied|auto-generated|auto-reply|autoreply|vacation|out-of-office/i;

/** True when the message declares itself auto-generated via RFC 3834 headers. */
export function hasAutoReplyHeaders(rawHeaders?: Record<string, string> | null): boolean {
  if (!rawHeaders || typeof rawHeaders !== 'object') return false;

  const autoSubmitted = String(rawHeaders['auto-submitted'] || rawHeaders['auto-submitted'] || '').toLowerCase();
  if (autoSubmitted && AUTOREPLY_HEADER_VALUES.test(autoSubmitted)) return true;

  const xAutoreply = String(rawHeaders['x-autoreply'] || rawHeaders['x-autoreply'] || '').toLowerCase();
  if (xAutoreply === 'yes' || xAutoreply === 'true') return true;

  const autoSuppress = String(rawHeaders['x-auto-response-suppress'] || rawHeaders['x-auto-response-suppress'] || '').toLowerCase();
  if (autoSuppress && autoSuppress !== 'none') return true;

  const xAutorespond = String(rawHeaders['x-autorespond'] || rawHeaders['x-autorespond'] || '').toLowerCase();
  if (xAutorespond === 'yes') return true;

  const precedence = String(rawHeaders.precedence || rawHeaders['x-precedence'] || '').toLowerCase();
  if (precedence === 'bulk' || precedence === 'auto-reply' || precedence === 'list') return true;

  return false;
}

/** True when the sender is a classic bounce / daemon / no-reply system address. */
export function isBounceOrSystemSender(from: string): boolean {
  const sender = extractEmailAddress(from || '').toLowerCase();
  if (!sender) return false;
  return (
    sender.startsWith('mailer-daemon@') ||
    sender.startsWith('mailerdaemon@') ||
    sender.startsWith('noreply@') ||
    sender.startsWith('no-reply@') ||
    sender.startsWith('donotreply@') ||
    sender.startsWith('do-not-reply@') ||
    sender.startsWith('postmaster@') ||
    sender.startsWith('administrator@') ||
    sender.startsWith('root@')
  );
}

const normalize = (value: unknown): string =>
  extractEmailAddress(String(value || '')).toLowerCase().trim();

/**
 * True when the sender matches one of the platform's own support addresses
 * (channel email / forwarding address / system From), which would otherwise
 * loop back into tickets.
 */
export async function isOwnSupportAddress(
  from: string,
): Promise<boolean> {
  const sender = extractEmailAddress(from || '').toLowerCase();
  if (!sender) return false;

  const systemFrom = normalize(process.env.MAIL_FROM_ADDRESS || process.env.SMTP_FROM);
  if (systemFrom && sender === systemFrom) return true;

  try {
    const channels = await getDocsDirect(EMAIL_CHANNELS_COLLECTION, []);
    for (const channel of channels) {
      const data = channel.data || channel;
      const email = normalize(data.email);
      const forwarding = normalize(data.forwardingAddress);
      const mailbox = normalize(data.mailbox);
      if ((email && sender === email) || (forwarding && sender === forwarding) || (mailbox && sender === mailbox)) {
        return true;
      }
    }
  } catch (err: unknown) {
    console.warn('[loop-guard] channel lookup failed:', (err as Error)?.message || err);
  }
  return false;
}

/** Combined guard used at the top of the ingest pipeline. */
export async function checkEmailLoopGuard(params: {
  from: string;
  rawHeaders?: Record<string, string> | null;
}): Promise<LoopGuardResult> {
  if (isBounceOrSystemSender(params.from)) {
    return { blocked: true, reason: 'system_or_bounce_sender' };
  }
  if (hasAutoReplyHeaders(params.rawHeaders)) {
    return { blocked: true, reason: 'auto_reply_headers' };
  }
  if (await isOwnSupportAddress(params.from)) {
    return { blocked: true, reason: 'own_support_address' };
  }
  return { blocked: false };
}
