/**
 * Shared downstream pipeline: blacklist → thread/create ticket → store message → AI triage.
 */

import {
  addDocDirect,
  getDocsDirect,
  updateDocDirect,
} from '../postgres-backend.js';
import {
  extractEmailAddress,
  isSenderBlacklisted,
  logBlacklistDrop,
} from '../global-blacklist.js';
import { checkEmailLoopGuard } from './loop-guard.js';
import { checkSenderRateLimit } from './sender-rate-limiter.js';
import { classifySpam, shouldDropSpam, isDisposableSender } from './spam-guard.js';
import { prepareInboundContent } from './inbound-content.js';
import type { NormalizedInboundEmail } from './types.js';
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_MESSAGE } from './types.js';

export type AiTriageFn = (
  ticketId: string,
  emailBody: string,
  subject: string,
) => Promise<void>;

let triageHook: AiTriageFn | null = null;

export function registerAiTriageHook(fn: AiTriageFn): void {
  triageHook = fn;
}

function nextCustomId(existing: Array<{ customId?: string }>): string {
  let max = 0;
  for (const ticket of existing) {
    const n = parseInt(String(ticket.customId || '').split('-')[1] || '0', 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `NEX-${String(max + 1).padStart(4, '0')}`;
}

function sanitizeAttachments(email: NormalizedInboundEmail) {
  return (email.attachments || [])
    .slice(0, MAX_ATTACHMENTS_PER_MESSAGE)
    .map((att) => {
      const size = Number(att.size) || (att.contentBase64 ? Math.floor((att.contentBase64.length * 3) / 4) : 0);
      if (size > MAX_ATTACHMENT_BYTES) {
        return {
          filename: att.filename || 'attachment',
          contentType: att.contentType || 'application/octet-stream',
          size,
          omitted: true,
          reason: 'exceeds_size_limit',
        };
      }
      return {
        filename: att.filename || 'attachment',
        contentType: att.contentType || 'application/octet-stream',
        size,
        contentBase64: att.contentBase64,
        contentId: att.contentId,
      };
    });
}

export interface IngestResult {
  success: boolean;
  blocked?: boolean;
  ticketId?: string;
  customId?: string;
  status: 'processing' | 'ignored' | 'error';
  action?: 'drop';
  error?: string;
}

/**
 * Ingest a normalized inbound email into GeistDesk tickets.
 * All drivers (Graph, IMAP, Webhook) must call this after producing NormalizedInboundEmail.
 */
export async function ingestNormalizedEmail(
  email: NormalizedInboundEmail,
): Promise<IngestResult> {
  const sender = extractEmailAddress(email.from_email || email.sender) || email.sender;
  const subject = String(email.subject || email.title || '(no subject)').trim();
  const { html, textFallback, bodyForAi } = prepareInboundContent(email);
  const rawBody = textFallback || html || subject;

  if (!sender || !subject) {
    return {
      success: false,
      status: 'error',
      error: 'Missing required fields: sender or subject',
    };
  }

  // --- Pre-ticket safety gates (loop guard, rate limit, spam) ---
  const loop = await checkEmailLoopGuard({
    from: sender,
    recipient: email.mailbox || undefined,
    rawHeaders: email.rawHeaders || null,
  });
  if (loop.blocked) {
    await logBlacklistDrop({
      sender,
      subject,
      reason: loop.reason || 'auto_reply_loop_guard',
    });
    return {
      success: true,
      blocked: true,
      status: 'ignored',
      action: 'drop',
    };
  }

  const rate = checkSenderRateLimit(sender);
  if (!rate.allowed) {
    await logBlacklistDrop({
      sender,
      subject,
      reason: `per_sender_rate_limit:${rate.domain}`,
    });
    return {
      success: true,
      blocked: true,
      status: 'ignored',
      action: 'drop',
    };
  }

  const spam = classifySpam({ from: sender, subject, body: rawBody });
  if (spam.isSpam || isDisposableSender(sender)) {
    if (shouldDropSpam()) {
      await logBlacklistDrop({
        sender,
        subject,
        reason: `spam_classification:${spam.reasons.join(',')}`,
      });
      return {
        success: true,
        blocked: true,
        status: 'ignored',
        action: 'drop',
      };
    }
    // Non-drop mode: allow ticket creation but never auto-dispatch AI replies.
    email.tags = ['spam-suspected', ...(email.tags || [])];
  }

  if (await isSenderBlacklisted(sender)) {
    await logBlacklistDrop({
      sender,
      subject,
      reason: 'global_blacklist_hit',
    });
    return {
      success: true,
      blocked: true,
      status: 'ignored',
      action: 'drop',
    };
  }

  try {
    const ticketIdMatch =
      subject.match(/\[NEX-(\d{4})\]/i) || rawBody.match(/\[NEX-(\d{4})\]/i);
    const customIdHint = ticketIdMatch
      ? `NEX-${ticketIdMatch[1]}`.toUpperCase()
      : null;

    const allTickets = await getDocsDirect('tickets', []);
    let ticket =
      (customIdHint
        ? allTickets.find(
            (t: any) =>
              String(t.customId || '').toUpperCase() === customIdHint,
          )
        : null) || null;

    const now = new Date().toISOString();
    const attachments = sanitizeAttachments(email);

    if (!ticket) {
      const customId = nextCustomId(allTickets);
      const created = await addDocDirect('tickets', {
        subject,
        description: html || textFallback,
        html_content: html || undefined,
        status: 'open',
        priority: 'medium',
        customerId: sender,
        customerName: (email.from_name || '').trim() || sender.split('@')[0] || 'Unknown Sender',
        customerEmail: sender,
        from_email: sender,
        customId,
        channel: 'email',
        include_in_rag: true,
        tags: ['inbound-email', `source:${email.source}`, ...(email.tags || [])],
        mailbox: email.mailbox || undefined,
        sanitizedAiContext: bodyForAi || undefined,
        createdAt: now,
        updatedAt: now,
      });
      ticket = { id: created.id, ...created.data, customId };
    } else {
      await updateDocDirect('tickets', ticket.id, {
        updatedAt: now,
        from_email: sender,
        customerEmail: (ticket as any).customerEmail || sender,
      });
    }

    const ticketId = String(ticket.id);
    const createdMessage = await addDocDirect(`tickets/${ticketId}/messages`, {
      ticketId,
      senderId: sender,
      senderType: 'customer',
      senderName: (email.from_name || '').trim() || sender.split('@')[0] || 'Customer',
      content: html || textFallback,
      html_content: html || undefined,
      text_content: textFallback || undefined,
      attachments,
      externalMessageId: email.externalMessageId || null,
      source: email.source,
      sanitizedAiContext: bodyForAi || undefined,
      redactedContent: bodyForAi || undefined,
      createdAt: now,
    });
    const messageId = String(createdMessage.id);

    // Persist oversized-safe attachment blobs as side documents when present.
    for (const att of attachments) {
      if (!att.contentBase64 || (att as any).omitted) continue;
      await addDocDirect('email_attachments', {
        ticketId,
        messageId,
        filename: att.filename,
        contentType: att.contentType,
        size: att.size,
        contentBase64: att.contentBase64,
        createdAt: now,
      }).catch((err) => {
        console.warn('[email-ingestion] attachment persist failed', err);
      });
    }

    if (triageHook) {
      void triageHook(ticketId, bodyForAi, subject).catch((err) =>
        console.error('[email-ingestion] AI triage error:', err),
      );
    }

    return {
      success: true,
      ticketId,
      customId: (ticket as any).customId,
      status: 'processing',
    };
  } catch (err: any) {
    console.error('[email-ingestion] ingest failed:', err);
    return {
      success: false,
      status: 'error',
      error: err?.message || 'Failed to ingest inbound email',
    };
  }
}
