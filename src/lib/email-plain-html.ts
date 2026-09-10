/**
 * Convert plaintext email bodies to readable HTML without <pre>/monospace.
 * Shared by ingest drivers and the ticket timeline renderer.
 */

export function escapeHtmlText(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Decode a few entities so unwrapping stored <pre> bodies stays readable. */
export function decodeBasicEntities(input: string): string {
  return String(input || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
}

/**
 * Turn plaintext (including signatures) into paragraph HTML.
 * Blank lines become new <p> blocks; single newlines become <br />.
 */
export function plainTextToEmailHtml(text: string): string {
  const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return '';
  const blocks = normalized.split(/\n{2,}/);
  return blocks
    .map((block) => `<p>${escapeHtmlText(block).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

/**
 * Stored inbound mail used to wrap plaintext in <pre>. Unwrap those so the
 * timeline can render with application typography.
 */
export function unwrapLegacyPreHtml(html: string): string {
  const trimmed = String(html || '').trim();
  if (!trimmed) return '';
  const full = trimmed.match(/^<pre\b[^>]*>([\s\S]*)<\/pre>$/i);
  if (full) {
    return plainTextToEmailHtml(decodeBasicEntities(full[1]));
  }
  return trimmed.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_all, inner: string) =>
    plainTextToEmailHtml(decodeBasicEntities(inner)),
  );
}
