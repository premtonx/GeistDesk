import path from 'path';
import * as cheerio from 'cheerio';

export type KbIngestFileKind = 'pdf' | 'docx' | 'csv' | 'md' | 'txt' | 'unknown';

const EXTENSION_MAP: Record<string, KbIngestFileKind> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.csv': 'csv',
  '.md': 'md',
  '.markdown': 'md',
  '.txt': 'txt',
};

const MIME_MAP: Record<string, KbIngestFileKind> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/csv': 'csv',
  'application/csv': 'csv',
  'text/markdown': 'md',
  'text/plain': 'txt',
};

export function detectKbIngestFileKind(originalname: string, mimetype?: string): KbIngestFileKind {
  const ext = path.extname(originalname).toLowerCase();
  if (EXTENSION_MAP[ext]) return EXTENSION_MAP[ext];
  if (mimetype && MIME_MAP[mimetype]) return MIME_MAP[mimetype];
  return 'unknown';
}

export function sanitizeFilenameTitle(originalname: string): string {
  return path.basename(originalname, path.extname(originalname)).replace(/[_-]+/g, ' ').trim() || 'Imported document';
}

export function normalizeExtractedText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\u0000/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

export function plainTextToKbHtml(text: string): string {
  const normalized = normalizeExtractedText(text);
  if (!normalized) return '<p></p>';

  if (normalized.includes('<p>') || normalized.includes('<h1')) {
    return normalized;
  }

  const blocks = normalized.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('# ')) {
        return `<h2>${escapeHtml(trimmed.slice(2))}</h2>`;
      }
      if (trimmed.startsWith('## ')) {
        return `<h3>${escapeHtml(trimmed.slice(3))}</h3>`;
      }
      const lines = trimmed.split('\n').map((line) => escapeHtml(line)).join('<br/>');
      return `<p>${lines}</p>`;
    })
    .filter(Boolean)
    .join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function csvToKbHtml(text: string): string {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rows.length === 0) return '<p></p>';

  const cells = rows.map((row) => {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i += 1) {
      const ch = row[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === ',' && !inQuotes) {
        parts.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }
    parts.push(current.trim());
    return parts;
  });

  const header = cells[0] ?? [];
  const body = cells.slice(1);
  const thead = `<thead><tr>${header.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${body
    .map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('')}</tbody>`;
  return `<table>${thead}${tbody}</table>`;
}

export interface ParsedKbIngestFile {
  title: string;
  content: string;
  plainText: string;
  kind: KbIngestFileKind;
}

export async function parseKbIngestBuffer(
  buffer: Buffer,
  originalname: string,
  mimetype?: string,
  pdfParse?: (data: Buffer) => Promise<{ text: string }>,
  mammothExtract?: (options: { buffer: Buffer }) => Promise<{ value: string }>,
): Promise<ParsedKbIngestFile> {
  const kind = detectKbIngestFileKind(originalname, mimetype);
  const title = sanitizeFilenameTitle(originalname);
  let plainText = '';

  switch (kind) {
    case 'pdf': {
      if (!pdfParse) throw new Error('PDF parser is not available on this server.');
      const data = await pdfParse(buffer);
      plainText = normalizeExtractedText(data.text || '');
      break;
    }
    case 'docx': {
      if (!mammothExtract) throw new Error('DOCX parser is not available on this server.');
      const data = await mammothExtract({ buffer });
      plainText = normalizeExtractedText(data.value || '');
      break;
    }
    case 'csv':
      plainText = normalizeExtractedText(buffer.toString('utf-8'));
      return {
        title,
        plainText,
        kind,
        content: csvToKbHtml(plainText),
      };
    case 'md':
    case 'txt':
    default:
      plainText = normalizeExtractedText(buffer.toString('utf-8'));
      break;
  }

  return {
    title,
    plainText,
    kind,
    content: plainTextToKbHtml(plainText),
  };
}

export function isPrivateNetworkUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) {
      return true;
    }
    if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
      return true;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

const BOILERPLATE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'svg',
  'nav',
  'header',
  'footer',
  'aside',
  '.cookie',
  '.banner',
  '.advertisement',
  '.ads',
  '#cookie',
];

export function extractScrapedArticle(html: string, fallbackUrl: string): { title: string; content: string; plainText: string } {
  const $ = cheerio.load(html);
  for (const selector of BOILERPLATE_SELECTORS) {
    $(selector).remove();
  }

  const title =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('h1').first().text().trim() ||
    $('title').text().trim() ||
    fallbackUrl;

  const contentRoot =
    $('article').first().length > 0
      ? $('article').first()
      : $('main').first().length > 0
        ? $('main').first()
        : $('.content, #content, .post, .article, .markdown-body').first().length > 0
          ? $('.content, #content, .post, .article, .markdown-body').first()
          : $('body');

  const plainText = normalizeExtractedText(contentRoot.text());
  return {
    title,
    plainText,
    content: plainTextToKbHtml(plainText),
  };
}

export function normalizeKbIngestStatus(raw?: string): 'Published' | 'Draft' {
  const value = (raw ?? '').toLowerCase().trim();
  return value === 'published' ? 'Published' : 'Draft';
}
