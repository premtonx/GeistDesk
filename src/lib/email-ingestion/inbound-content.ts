/**
 * Split inbound mail into agent-facing bodies vs AI-only redacted context.
 * XSS sanitization is allowed on stored HTML; PII tokens are not.
 */

import { redactPII } from '../ai/pii-shield.js';
import { htmlToPlainTextServer, sanitizeInboundHtml } from './sanitize-server.js';
import type { NormalizedInboundEmail } from './types.js';

export function prepareInboundContent(
  email: Pick<NormalizedInboundEmail, 'html_content' | 'text_content' | 'subject' | 'title'>,
): { html: string; textFallback: string; bodyForAi: string } {
  const subject = String(email.subject || email.title || '(no subject)').trim();
  const html = sanitizeInboundHtml(email.html_content || '');
  const textFallback =
    String(email.text_content || '').trim() ||
    (html ? htmlToPlainTextServer(html) : '') ||
    String(email.html_content || '').trim();
  return {
    html,
    textFallback,
    bodyForAi: redactPII(textFallback || html || subject),
  };
}
