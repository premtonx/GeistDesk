/**
 * Driver C helpers — parse passive push webhooks (JSON, Mailgun, SendGrid, Postal, multipart).
 */

import { extractEmailAddress } from '../../global-blacklist.js';
import type { InboundAttachment, NormalizedInboundEmail } from '../types.js';

interface UploadedFileLike {
  originalname?: string;
  fieldname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
      return value[0].trim();
    }
  }
  return '';
}

function fileToAttachment(file: UploadedFileLike): InboundAttachment {
  return {
    filename: file.originalname || file.fieldname || 'attachment',
    contentType: file.mimetype || 'application/octet-stream',
    size: file.size || file.buffer?.length || 0,
    contentBase64: file.buffer ? file.buffer.toString('base64') : undefined,
  };
}

/**
 * Normalize Mailgun / SendGrid Inbound Parse / Postal / custom JSON into NormalizedInboundEmail.
 */
export function parseInboundWebhookPayload(params: {
  body: Record<string, any>;
  files?: UploadedFileLike[];
  defaultMailbox?: string;
}): NormalizedInboundEmail | null {
  const body = params.body || {};
  const files = params.files || [];

  // Custom GeistDesk JSON (legacy + native)
  const customSender = firstString(body.sender, body.from_email, body.from, body.From);
  const customSubject = firstString(body.subject, body.title, body.Subject);
  const customHtml = firstString(
    body.html_content,
    body.html,
    body['body-html'],
    body['stripped-html'],
    body.bodyHtml,
  );
  const customText = firstString(
    body.body,
    body.text,
    body['body-plain'],
    body['stripped-text'],
    body.plain,
    body.text_content,
  );

  // SendGrid Inbound Parse uses `headers` + `envelope`
  const envelopeFrom = (() => {
    try {
      if (typeof body.envelope === 'string') {
        return JSON.parse(body.envelope)?.from || '';
      }
      return body.envelope?.from || '';
    } catch {
      return '';
    }
  })();

  const sender = extractEmailAddress(
    customSender || envelopeFrom || firstString(body.sender),
  );
  const subject = customSubject || '(no subject)';
  const html_content =
    customHtml ||
    (customText
      ? `<pre>${customText
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</pre>`
      : '');

  if (!sender || (!html_content && !customText)) {
    return null;
  }

  const attachments: InboundAttachment[] = files.map(fileToAttachment);

  // Mailgun attachment-info may list names without multipart files in some configs
  if (attachments.length === 0 && typeof body['attachment-info'] === 'string') {
    try {
      const info = JSON.parse(body['attachment-info']);
      for (const key of Object.keys(info || {})) {
        const meta = info[key];
        attachments.push({
          filename: meta?.filename || key,
          contentType: meta?.['content-type'] || 'application/octet-stream',
          size: Number(meta?.size) || 0,
        });
      }
    } catch {
      /* ignore */
    }
  }

  // Inline JSON attachments array
  if (Array.isArray(body.attachments)) {
    for (const att of body.attachments) {
      if (!att || typeof att !== 'object') continue;
      attachments.push({
        filename: att.filename || att.name || 'attachment',
        contentType: att.contentType || att.type || 'application/octet-stream',
        size: Number(att.size) || 0,
        contentBase64: att.contentBase64 || att.content || att.data,
      });
    }
  }

  const recipient = firstString(
    body.recipient,
    body.to,
    body.To,
    body['delivered-to'],
    params.defaultMailbox,
  );

  return {
    sender,
    from_email: sender,
    subject,
    title: subject,
    html_content,
    text_content: customText || undefined,
    attachments,
    externalMessageId: firstString(
      body['Message-Id'],
      body.messageId,
      body['message-id'],
      body.headers?.['message-id'],
    ) || undefined,
    mailbox: extractEmailAddress(recipient) || recipient || undefined,
    source: 'webhook',
  };
}

/**
 * Extract router alias from recipient fields (e.g. ticket-xyz@app.premtonx.cloud).
 */
export function extractRouterAlias(body: Record<string, any>): string {
  return firstString(
    body.recipient,
    body.to,
    body.To,
    body['delivered-to'],
    body.mailbox,
  );
}
