/** Detect whether stored article content is HTML markup vs markdown/plain text. */
export function isHtmlContent(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;
  return /<\/?[a-z][\s\S]*>/i.test(trimmed);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

/** Unwrap double-encoded entity fragments such as &amp;nbsp; before render. */
function fixDoubleEncodedEntities(value: string): string {
  let normalized = value;
  for (let i = 0; i < 3; i += 1) {
    const next = normalized.replace(/&amp;(nbsp|amp|lt|gt|quot|#39|#x27);/gi, (_, entity: string) => `&${entity};`);
    if (next === normalized) break;
    normalized = next;
  }
  return normalized;
}

/** Normalize raw article strings before markdown/HTML conversion. */
export function sanitizeArticleContent(content: string): string {
  if (!content.trim()) return '';
  return decodeHtmlEntities(fixDoubleEncodedEntities(content));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Convert legacy HTML article bodies into editable markdown for the inline editor. */
export function htmlToMarkdown(html: string): string {
  let md = html
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, text) => `## ${decodeHtmlEntities(text.replace(/<[^>]+>/g, '').trim())}\n\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, text) => `### ${decodeHtmlEntities(text.replace(/<[^>]+>/g, '').trim())}\n\n`)
    .replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, code) => `\`\`\`\n${decodeHtmlEntities(code.trim())}\n\`\`\`\n\n`)
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, code) => `\`${decodeHtmlEntities(code.trim())}\``)
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, text) => `${decodeHtmlEntities(text.replace(/<[^>]+>/g, '').trim())}\n\n`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, text) => `- ${decodeHtmlEntities(text.replace(/<[^>]+>/g, '').trim())}\n`)
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return decodeHtmlEntities(md);
}

/** Render markdown (or passthrough HTML) into HTML for the read-only prose view. */
export function markdownToHtml(markdown: string): string {
  const trimmed = markdown.trim();
  if (!trimmed) return '';

  const lines = trimmed.split('\n');
  const blocks: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const text = paragraphLines.join(' ').trim();
    if (!text) {
      paragraphLines = [];
      return;
    }
    const withInlineCode = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    blocks.push(`<p>${withInlineCode}</p>`);
    paragraphLines = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      flushParagraph();
      if (inCodeBlock) {
        blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith('### ')) {
      flushParagraph();
      blocks.push(`<h3>${escapeHtml(line.slice(4).trim())}</h3>`);
      continue;
    }

    if (line.startsWith('## ')) {
      flushParagraph();
      blocks.push(`<h2>${escapeHtml(line.slice(3).trim())}</h2>`);
      continue;
    }

    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    if (line.startsWith('- ')) {
      flushParagraph();
      blocks.push(`<p>${escapeHtml(line.slice(2).trim())}</p>`);
      continue;
    }

    paragraphLines.push(line.trim());
  }

  flushParagraph();
  if (inCodeBlock && codeLines.length) {
    blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }

  return blocks.join('\n');
}

/** Final HTML passed into the Quill preview surface. */
export function sanitizeArticleHtml(html: string): string {
  if (!html.trim()) return '';
  return fixDoubleEncodedEntities(html);
}

/** Source string shown inside the markdown textarea while editing. */
export function toEditableMarkdown(content: string): string {
  const normalized = sanitizeArticleContent(content);
  if (!normalized.trim()) return '';
  return isHtmlContent(normalized) ? htmlToMarkdown(normalized) : normalized;
}

/** HTML consumed by the preview renderer and heading/TOC pipeline. */
export function toRenderableHtml(content: string): string {
  const normalized = sanitizeArticleContent(content);
  if (!normalized.trim()) return '';
  const html = isHtmlContent(normalized) ? normalized : markdownToHtml(normalized);
  return sanitizeArticleHtml(html);
}

/** HTML string loaded into the rich-text editor while editing. */
export function toEditableHtml(content: string): string {
  return toRenderableHtml(content);
}

export function buildKbArticleDeepLink(articleId: string): string {
  if (typeof window === 'undefined') return `/kb?article=${articleId}`;
  return `${window.location.origin}/kb?article=${encodeURIComponent(articleId)}`;
}
