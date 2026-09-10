/**
 * RFC 5322 / MIME → NormalizedInboundEmail for the inbound SMTP receiver.
 */

import { simpleParser, type AddressObject, type ParsedMail } from 'mailparser';
import { extractEmailAddress } from '../global-blacklist.js';
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  type InboundAttachment,
  type NormalizedInboundEmail,
} from './types.js';

const LOOP_HEADER_KEYS = [
  'auto-submitted',
  'x-autoreply',
  'x-auto-response-suppress',
  'x-autorespond',
  'precedence',
  'x-precedence',
  'list-unsubscribe',
  'list-id',
  'x-failed-recipients',
  'return-path',
  'x-original-to',
  'delivered-to',
];

function firstAddress(value: AddressObject | AddressObject[] | undefined): string {
  if (!value) return '';
  const list = Array.isArray(value) ? value : [value];
  for (const entry of list) {
    for (const item of entry.value || []) {
      const addr = extractEmailAddress(item.address || item.name || '');
      if (addr) return addr;
    }
  }
  return '';
}

function htmlFromParsed(parsed: ParsedMail, text: string): string {
  if (typeof parsed.html === 'string' && parsed.html.trim()) return parsed.html;
  if (!text) return '';
  return `<pre>${text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')}</pre>`;
}

function collectRawHeaders(parsed: ParsedMail): Record<string, string> {
  const raw: Record<string, string> = {};
  const headers = parsed.headers;
  if (!headers || typeof headers.get !== 'function') return raw;
  for (const key of LOOP_HEADER_KEYS) {
    const value = headers.get(key);
    if (value == null) continue;
    const text = Array.isArray(value) ? String(value[0] ?? '') : String(value);
    if (text.trim()) raw[key] = text.trim();
  }
  return raw;
}

export async function parseRfc822ToNormalizedEmail(
  raw: Buffer,
  envelope: { mailFrom?: string; rcptTo: string[] },
): Promise<NormalizedInboundEmail | null> {
  let parsed: ParsedMail;
  try {
    parsed = await simpleParser(raw, { skipImageLinks: true });
  } catch {
    return null;
  }

  const sender =
    firstAddress(parsed.from) ||
    extractEmailAddress(envelope.mailFrom || '') ||
    extractEmailAddress(String(parsed.headers?.get('return-path') || ''));

  const subject = String(parsed.subject || '').trim() || '(no subject)';
  const text = typeof parsed.text === 'string' ? parsed.text : '';
  const html_content = htmlFromParsed(parsed, text);

  if (!sender) return null;

  const attachments: InboundAttachment[] = [];
  for (const att of parsed.attachments || []) {
    if (attachments.length >= MAX_ATTACHMENTS_PER_MESSAGE) break;
    const content = att.content;
    const buf = Buffer.isBuffer(content)
      ? content
      : content
        ? Buffer.from(content)
        : Buffer.alloc(0);
    const size = buf.length || Number(att.size) || 0;
    attachments.push({
      filename: att.filename || 'attachment',
      contentType: att.contentType || 'application/octet-stream',
      size,
      contentBase64: size > 0 && size <= MAX_ATTACHMENT_BYTES ? buf.toString('base64') : undefined,
      contentId: att.contentId || undefined,
    });
  }

  const mailbox =
    extractEmailAddress(envelope.rcptTo[0] || '') ||
    firstAddress(parsed.to) ||
    undefined;

  return {
    sender,
    from_email: sender,
    subject,
    title: subject,
    html_content,
    text_content: text || undefined,
    attachments,
    externalMessageId: parsed.messageId || undefined,
    mailbox,
    source: 'smtp',
    rawHeaders: collectRawHeaders(parsed),
  };
}
