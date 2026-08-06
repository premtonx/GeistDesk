/**
 * Server-safe HTML helpers for inbound mail / CSV imports (no DOMPurify / window).
 * Stricter allowlist: drop scripts, forms, SVG/math, data: URIs, and event handlers.
 */

import * as cheerio from 'cheerio';

const ALLOWED_TAGS = new Set([
  'a', 'b', 'strong', 'i', 'em', 'u', 's', 'br', 'p', 'div', 'span',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'hr', 'img',
]);

const ALLOWED_ATTRS = new Set(['href', 'title', 'alt', 'src', 'colspan', 'rowspan', 'class']);

function isSafeUrl(value: string): boolean {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return false;
  if (v.startsWith('javascript:') || v.startsWith('vbscript:') || v.startsWith('data:text/html')) {
    return false;
  }
  // Allow http(s), mailto, cid (email inline), and relative paths.
  return /^(https?:|mailto:|cid:|\/|#)/i.test(v) || !/^[a-z][a-z0-9+.-]*:/i.test(v);
}

/** Strip dangerous nodes/attrs while preserving readable email HTML structure. */
export function sanitizeInboundHtml(html: string): string {
  if (!html) return '';
  try {
    const $ = cheerio.load(String(html), { xml: false });
    $('script, style, iframe, object, embed, link, meta, form, input, button, textarea, select, svg, math, base').remove();

    $('*').each((_, el) => {
      const tag = String((el as any).tagName || (el as any).name || '').toLowerCase();
      if (tag && !ALLOWED_TAGS.has(tag) && tag !== 'body' && tag !== 'html' && tag !== 'head') {
        $(el).replaceWith($(el).contents());
        return;
      }

      const attribs = { ...((el as any).attribs || {}) };
      for (const name of Object.keys(attribs)) {
        const lower = name.toLowerCase();
        if (lower.startsWith('on') || lower === 'srcdoc' || lower === 'formaction' || lower.startsWith('xlink:')) {
          $(el).removeAttr(name);
          continue;
        }
        if (!ALLOWED_ATTRS.has(lower)) {
          $(el).removeAttr(name);
          continue;
        }
        if ((lower === 'href' || lower === 'src') && !isSafeUrl(String(attribs[name] || ''))) {
          $(el).removeAttr(name);
        }
      }
    });

    return $('body').html() || $.root().html() || '';
  } catch {
    return String(html)
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<(iframe|object|embed|svg|math|form)[\s\S]*?>[\s\S]*?<\/\1>/gi, '')
      .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/javascript:/gi, '');
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
