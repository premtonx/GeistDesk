/**
 * GeistKB Document Library — persistent raw-file store + text extraction.
 *
 * Files are written to a persistent volume (DOCUMENT_STORAGE_DIR, default
 * /app/storage/documents) under {tenantId}/{docId}/{sanitizedFilename} so a
 * DELETE purges exactly one directory. Extraction runs inside the vector-queue
 * worker, never on the Express request path.
 */
import { createHash } from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
import mammoth from 'mammoth';
import { detectKbIngestFileKind, normalizeExtractedText, type KbIngestFileKind } from '../kb-ingestion.js';

const require = createRequire(
  typeof import.meta !== 'undefined' && import.meta.url
    ? import.meta.url
    : (typeof __filename !== 'undefined' ? __filename : ''),
);
const pdfParse = require('pdf-parse') as (data: Buffer) => Promise<{ text: string; numpages?: number }>;

export const DOCUMENT_STORAGE_DIR: string =
  process.env.DOCUMENT_STORAGE_DIR || '/app/storage/documents';

/** Root the NAS / local-directory external source sandbox. */
export const KB_SOURCES_ROOT: string = process.env.KB_SOURCES_ROOT || '/data/sources';

export const DOCUMENT_ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.csv'] as const;
export type DocumentExtension = (typeof DOCUMENT_ALLOWED_EXTENSIONS)[number];

export interface ExtractedDocumentText {
  text: string;
  pages: number | null;
  kind: KbIngestFileKind;
}

/** Deterministic content fingerprint used for delta-hash sync + duplicate uploads. */
export function sha256Buffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Strip path separators / traversal tokens; return a safe basename. */
export function sanitizeFilename(filename: string): string {
  const base = path.basename(filename || '').replace(/[\\/]/g, '_').trim();
  if (!base || base === '.' || base === '..') return 'document.bin';
  return base;
}

/** Block traversal outside the sandbox: resolved path must stay under base. */
export function resolveSandboxPath(base: string, relative: string): string {
  const root = path.resolve(base);
  const candidate = path.resolve(root, relative || '');
  if (candidate !== root && !candidate.startsWith(root + path.sep)) {
    throw new Error(`Sandbox violation: path escapes "${base}"`);
  }
  return candidate;
}

export function documentStoragePath(tenantId: string, docId: string): string {
  return path.join(DOCUMENT_STORAGE_DIR, sanitizeFilename(tenantId), sanitizeFilename(docId));
}

export function isAllowedDocumentExtension(filename: string): boolean {
  const ext = path.extname(filename || '').toLowerCase();
  return (DOCUMENT_ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

/** Persist the raw bytes; returns the absolute path written. */
export async function saveRawFile(
  tenantId: string,
  docId: string,
  filename: string,
  buffer: Buffer,
): Promise<string> {
  const dir = documentStoragePath(tenantId, docId);
  await fsp.mkdir(dir, { recursive: true });
  const target = path.join(dir, sanitizeFilename(filename));
  await fsp.writeFile(target, buffer);
  return target;
}

export async function readRawFile(
  tenantId: string,
  docId: string,
  filename: string,
): Promise<Buffer | null> {
  try {
    return await fsp.readFile(path.join(documentStoragePath(tenantId, docId), sanitizeFilename(filename)));
  } catch {
    return null;
  }
}

/** Atomically purge every file belonging to a document. */
export async function deleteDocumentFiles(tenantId: string, docId: string): Promise<void> {
  const dir = documentStoragePath(tenantId, docId);
  try {
    await fsp.rm(dir, { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
}

export interface ExtractDocumentTextParams {
  filename: string;
  buffer: Buffer;
  mimetype?: string;
}

/**
 * Extract plain text from an uploaded/synced document.
 * - PDF  → pdf-parse (text + page count)
 * - DOCX → mammoth (raw text)
 * - TXT/MD/CSV → utf-8
 */
export async function extractDocumentText({
  filename,
  buffer,
  mimetype,
}: ExtractDocumentTextParams): Promise<ExtractedDocumentText> {
  const kind = detectKbIngestFileKind(filename, mimetype);
  switch (kind) {
    case 'pdf': {
      const data = await pdfParse(buffer);
      return { text: normalizeExtractedText(data.text || ''), pages: data.numpages ?? null, kind };
    }
    case 'docx': {
      const data = await mammoth.extractRawText({ buffer });
      return { text: normalizeExtractedText(data.value || ''), pages: null, kind };
    }
    case 'csv':
    case 'md':
    case 'txt':
    default:
      return { text: normalizeExtractedText(buffer.toString('utf-8')), pages: null, kind };
  }
}

/** True when extracted text is too sparse to embed (mark as no_text). */
export function isNoText(text: string): boolean {
  return (text || '').replace(/\s/g, '').length < 30;
}

/** Header stamped onto every chunk before embedding. */
export function buildChunkHeader(filename: string, docId: string): string {
  return `[Source: ${sanitizeFilename(filename)} | DocId: ${docId}]`;
}

/** Guard for the local-directory connector sandbox at boot. */
export function ensureStorageDirs(): void {
  fs.mkdirSync(DOCUMENT_STORAGE_DIR, { recursive: true });
  fs.mkdirSync(KB_SOURCES_ROOT, { recursive: true });
}
