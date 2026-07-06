import DOMPurify from 'dompurify';

const LINKIFY_ALLOWED_TAGS = ['a', 'br', 'p', 'strong', 'em', 'ul', 'ol', 'li', 'code', 'pre', 'h1', 'h2', 'h3', 'blockquote'];

/** Sanitize rich HTML before rendering with dangerouslySetInnerHTML. */
export function sanitizeRichHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel', 'class'],
  });
}

/** Escape plain text, then allow only safe link tags for timeline messages. */
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
