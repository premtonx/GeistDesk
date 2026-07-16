/**
 * Server-safe HTML helpers for inbound mail (no DOMPurify / window).
 */

import * as cheerio from 'cheerio';

/** Strip dangerous nodes/attrs while preserving readable email HTML structure. */
export function sanitizeInboundHtml(html: string): string {
  if (!html) return '';
  try {
    const $ = cheerio.load(String(html), { xml: false });
    $('script, style, iframe, object, embed, link, meta').remove();
    $('*').each((_, el) => {
      const attribs = (el as any).attribs || {};
      for (const name of Object.keys(attribs)) {
        const lower = name.toLowerCase();
        if (lower.startsWith('on') || lower === 'srcdoc' || lower === 'formaction') {
          $(el).removeAttr(name);
        }
        if ((lower === 'href' || lower === 'src') && /^\s*javascript:/i.test(String(attribs[name] || ''))) {
          $(el).removeAttr(name);
        }
      }
    });
    return $('body').html() || $.root().html() || '';
  } catch {
    return String(html)
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  }
}

export function htmlToPlainTextServer(raw: string): string {
  if (!raw) return '';
  return String(raw)
    .replace(/&nbsp;/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .trim();
}
