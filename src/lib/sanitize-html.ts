import DOMPurify from 'dompurify';
import { unwrapLegacyPreHtml } from './email-plain-html';

const LINKIFY_ALLOWED_TAGS = ['a', 'br', 'p', 'strong', 'em', 'ul', 'ol', 'li', 'code', 'pre', 'h1', 'h2', 'h3', 'blockquote', 'div', 'span', 'br'];

const TIMELINE_ALLOWED_TAGS = [
  'a',
  'br',
  'p',
  'div',
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'code',
  'pre',
  'h1',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'hr',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
];

/** Sanitize rich HTML before rendering with dangerouslySetInnerHTML. */
export function sanitizeRichHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel', 'class'],
  });
}

/** Decode common HTML entities without introducing XSS (used for legacy double-escaped mail). */
export function decodeHtmlEntities(input: string): string {
  if (!input) return '';
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/gi, "'");
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

/**
 * Escape plain text, then allow only safe link tags for timeline messages.
 * Prefer {@link sanitizeTimelineHtml} when content may already contain HTML.
 */
export function sanitizeLinkifiedText(text: string): string {
  if (!text) return '';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const urlPattern = /(\b(https?):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/gi;
  let result = escaped.replace(
    urlPattern,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline font-semibold">$1</a>',
  );

  const wwwPattern = /(^|[^/])(www\.[A-Za-z0-9_-]+\.[A-Za-z0-9_.-]+(?:\/[^\s<]*)?)/g;
  result = result.replace(
    wwwPattern,
    '$1<a href="https://$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline font-semibold">$2</a>',
  );

  return DOMPurify.sanitize(result, {
    ALLOWED_TAGS: LINKIFY_ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  });
}

/**
 * Timeline / email body renderer:
 * - Decodes entities (&nbsp; → space, &lt;p&gt; → tag when double-escaped)
 * - Renders real HTML safely via DOMPurify when markup is present
 * - Otherwise linkifies plain text
 */
export function sanitizeTimelineHtml(raw: string): string {
  if (!raw) return '';

  let content = String(raw);

  // Undo accidental double-escaping so &lt;p&gt; becomes <p> and &amp;nbsp; → &nbsp; first pass.
  if (/&lt;\/?[a-z]/i.test(content) || /&amp;nbsp;/i.test(content) || /&amp;lt;/i.test(content)) {
    content = decodeHtmlEntities(content);
  }

  // Normalize non-breaking spaces to regular spaces for readable thread copy.
  content = content.replace(/&nbsp;/gi, ' ').replace(/\u00a0/g, ' ');
  content = unwrapLegacyPreHtml(content);

  if (looksLikeHtml(content)) {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: TIMELINE_ALLOWED_TAGS,
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'alt', 'title'],
      ALLOW_DATA_ATTR: false,
    });
  }

  return sanitizeLinkifiedText(decodeHtmlEntities(content));
}

/** Plain-text preview that strips tags and converts entities (list/table snippets). */
export function htmlToPlainText(raw: string): string {
  if (!raw) return '';
  const decoded = decodeHtmlEntities(raw);
  return decoded
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}
