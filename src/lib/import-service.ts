/**
 * Admin bulk-import pipeline for legacy Tickets and GeistKB articles (CSV / JSON).
 * Batches of 50; resolved/closed tickets and published KB articles enqueue pgvector jobs.
 */

import Papa from 'papaparse';
import { addDocDirect } from './postgres-backend.js';
import {
  enqueueKbArticleIndex,
  enqueueResolvedTicketIndex,
} from './ai/vector-queue.js';
import { sanitizeInboundHtml } from './email-ingestion/sanitize-server.js';
import { DEFAULT_TENANT_ID } from './tenant-context.js';

export const IMPORT_BATCH_SIZE = 50;

export interface ImportResult {
  successCount: number;
  errorCount: number;
  errors: string[];
  enqueuedVectors: number;
  createdIds: string[];
}

export type TicketImportField =
  | 'subject'
  | 'html_content'
  | 'body'
  | 'sender_email'
  | 'status'
  | 'created_at'
  | 'tags'
  | 'priority'
  | 'customer_name';

export type KbImportField =
  | 'title'
  | 'content'
  | 'category'
  | 'status'
  | 'tags';

export type FieldMapping = Record<string, string>;

const TICKET_CANONICAL: TicketImportField[] = [
  'subject',
  'html_content',
  'body',
  'sender_email',
  'status',
  'created_at',
  'tags',
  'priority',
  'customer_name',
];

const KB_CANONICAL: KbImportField[] = ['title', 'content', 'category', 'status', 'tags'];

const TICKET_ALIASES: Record<string, TicketImportField> = {
  subject: 'subject',
  ticket_subject: 'subject',
  title: 'subject',
  html_content: 'html_content',
  html: 'html_content',
  body: 'body',
  description: 'body',
  content: 'body',
  article_body: 'body',
  sender_email: 'sender_email',
  email: 'sender_email',
  customer_email: 'sender_email',
  from: 'sender_email',
  from_email: 'sender_email',
  status: 'status',
  ticket_status: 'status',
  created_at: 'created_at',
  created: 'created_at',
  date: 'created_at',
  tags: 'tags',
  label: 'tags',
  labels: 'tags',
  priority: 'priority',
  customer_name: 'customer_name',
  customer: 'customer_name',
  name: 'customer_name',
};

const KB_ALIASES: Record<string, KbImportField> = {
  title: 'title',
  article_title: 'title',
  name: 'title',
  content: 'content',
  body: 'content',
  html_content: 'content',
  article_body: 'content',
  description: 'content',
  category: 'category',
  cat: 'category',
  status: 'status',
  article_status: 'status',
  tags: 'tags',
  label: 'tags',
  labels: 'tags',
};

function emptyResult(): ImportResult {
  return { successCount: 0, errorCount: 0, errors: [], enqueuedVectors: 0, createdIds: [] };
}

function normalizeHeader(h: string): string {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/** Map CSV column headers → canonical fields using explicit mapping or aliases. */
export function resolveFieldMapping(
  headers: string[],
  kind: 'tickets' | 'kb',
  explicit?: FieldMapping,
): FieldMapping {
  const aliases = kind === 'tickets' ? TICKET_ALIASES : KB_ALIASES;
  const mapping: FieldMapping = {};

  if (explicit && Object.keys(explicit).length > 0) {
    for (const [source, target] of Object.entries(explicit)) {
      if (!target || target === '__skip__') continue;
      mapping[source] = target;
    }
    return mapping;
  }

  for (const header of headers) {
    const key = normalizeHeader(header);
    const canonical = aliases[key];
    if (canonical) mapping[header] = canonical;
  }
  return mapping;
}

function applyMapping(row: Record<string, unknown>, mapping: FieldMapping): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [source, target] of Object.entries(mapping)) {
    if (!target || target === '__skip__') continue;
    if (row[source] !== undefined && row[source] !== null && row[source] !== '') {
      out[target] = row[source];
      continue;
    }
    // Try normalized key match on row
    const normalizedSource = normalizeHeader(source);
    for (const [rk, rv] of Object.entries(row)) {
      if (normalizeHeader(rk) === normalizedSource && rv !== undefined && rv !== null && rv !== '') {
        out[target] = rv;
        break;
      }
    }
  }
  // Also accept already-canonical keys on the row
  for (const [k, v] of Object.entries(row)) {
    const n = normalizeHeader(k);
    if (out[n] === undefined && v !== undefined && v !== null && v !== '') {
      out[n] = v;
    }
  }
  return out;
}

export function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return [];
    if (s.startsWith('[')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map((t) => String(t).trim()).filter(Boolean);
      } catch {
        /* fall through */
      }
    }
    return s
      .split(/[,;|]/)
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

export function normalizeTicketStatus(raw: unknown): string {
  const s = String(raw || 'open')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  const map: Record<string, string> = {
    resolved: 'resolved',
    closed: 'closed',
    open: 'open',
    pending: 'pending',
    spam: 'spam',
    deleted: 'deleted',
    trash: 'trash',
    'on-hold': 'on-hold',
    on_hold: 'on-hold',
    waiting_customer: 'waiting_customer',
    waiting_dev: 'waiting_dev',
    waiting_vendor: 'waiting_vendor',
  };
  return map[s] || s || 'open';
}

export function normalizeKbStatus(raw: unknown): 'Published' | 'Draft' {
  const s = String(raw || 'DRAFT')
    .trim()
    .toUpperCase();
  if (s === 'PUBLISHED' || s === 'PUBLIC' || s === 'LIVE') return 'Published';
  return 'Draft';
}

function parseCreatedAt(raw: unknown): string {
  if (!raw) return new Date().toISOString();
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

/**
 * Parse CSV or JSON buffer/string into an array of plain objects.
 */
export function parseImportPayload(
  input: string | Buffer,
  opts?: { filename?: string; contentType?: string },
): { records: Record<string, unknown>[]; headers: string[]; format: 'csv' | 'json' } {
  const text = Buffer.isBuffer(input) ? input.toString('utf8') : String(input || '');
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return { records: [], headers: [], format: 'json' };
  }

  const filename = (opts?.filename || '').toLowerCase();
  const contentType = (opts?.contentType || '').toLowerCase();
  const looksJson =
    filename.endsWith('.json') ||
    contentType.includes('json') ||
    trimmed.startsWith('[') ||
    trimmed.startsWith('{');

  if (looksJson && !filename.endsWith('.csv')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
    const records = Array.isArray(parsed)
      ? (parsed as Record<string, unknown>[])
      : Array.isArray((parsed as { records?: unknown }).records)
        ? ((parsed as { records: Record<string, unknown>[] }).records)
        : Array.isArray((parsed as { data?: unknown }).data)
          ? ((parsed as { data: Record<string, unknown>[] }).data)
          : [parsed as Record<string, unknown>];

    const headers = records.length > 0 ? Object.keys(records[0] || {}) : [];
    return { records, headers, format: 'json' };
  }

  const result = Papa.parse<Record<string, unknown>>(trimmed, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => String(h || '').trim(),
  });

  if (result.errors?.length) {
    const fatal = result.errors.filter((e) => e.type === 'Delimiter' || e.type === 'Quotes');
    if (fatal.length) {
      throw new Error(`CSV parse error: ${fatal.map((e) => e.message).join('; ')}`);
    }
  }

  const records = (result.data || []).filter((row) =>
    Object.values(row || {}).some((v) => v !== null && v !== undefined && String(v).trim() !== ''),
  );
  const headers = result.meta?.fields?.filter(Boolean) || (records[0] ? Object.keys(records[0]) : []);
  return { records, headers, format: 'csv' };
}

async function processBatches<T>(
  items: T[],
  batchSize: number,
  handler: (item: T, index: number) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    for (let j = 0; j < batch.length; j += 1) {
      await handler(batch[j], i + j);
    }
  }
}

export async function importTickets(
  records: Record<string, unknown>[],
  opts: {
    tenantId: string;
    fieldMapping?: FieldMapping;
    importedBy?: string;
  },
): Promise<ImportResult> {
  const result = emptyResult();
  const headers = records[0] ? Object.keys(records[0]) : [];
  const mapping = resolveFieldMapping(headers, 'tickets', opts.fieldMapping);
  const tenantId = opts.tenantId || 'default';

  await processBatches(records, IMPORT_BATCH_SIZE, async (raw, index) => {
    const rowNum = index + 1;
    try {
      const mapped = applyMapping(raw, mapping);
      const subject = String(mapped.subject || '').trim();
      if (!subject) {
        throw new Error('Missing required field: subject');
      }

      const rawHtml = String(mapped.html_content || '').trim();
      const rawBody = String(mapped.body || rawHtml || '').trim();
      // Sanitize before persist — imports bypass the inbound-mail pipeline.
      const htmlContent = rawHtml ? sanitizeInboundHtml(rawHtml) : '';
      const body = rawBody.includes('<') ? sanitizeInboundHtml(rawBody) : rawBody;
      const status = normalizeTicketStatus(mapped.status);
      const createdAt = parseCreatedAt(mapped.created_at);
      const senderEmail = String(mapped.sender_email || '').trim();
      const tags = parseTags(mapped.tags);
      const priority = String(mapped.priority || 'medium')
        .trim()
        .toLowerCase();
      const customerName = String(mapped.customer_name || '').trim();
      const scopedTenant = tenantId || DEFAULT_TENANT_ID;

      const doc = await addDocDirect('tickets', {
        subject,
        description: body || htmlContent,
        html_content: htmlContent || undefined,
        status,
        priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
        tags,
        from_email: senderEmail || undefined,
        customerEmail: senderEmail || undefined,
        customerName: customerName || undefined,
        contactId: '',
        companyId: '',
        channel: 'email',
        team: 'support',
        tenantId: scopedTenant,
        source: 'admin_import',
        importedBy: opts.importedBy,
        createdAt,
        updatedAt: new Date().toISOString(),
        ...(status === 'resolved' || status === 'closed'
          ? { resolvedAt: createdAt, closedAt: status === 'closed' ? createdAt : undefined }
          : {}),
      });

      result.successCount += 1;
      result.createdIds.push(doc.id);

      if (status === 'resolved' || status === 'closed') {
        await enqueueResolvedTicketIndex(doc.id, scopedTenant);
        result.enqueuedVectors += 1;
      }
    } catch (err) {
      result.errorCount += 1;
      result.errors.push(
        `Row ${rowNum}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  return result;
}

export async function importKbArticles(
  records: Record<string, unknown>[],
  opts: {
    tenantId: string;
    fieldMapping?: FieldMapping;
    importedBy?: string;
  },
): Promise<ImportResult> {
  const result = emptyResult();
  const headers = records[0] ? Object.keys(records[0]) : [];
  const mapping = resolveFieldMapping(headers, 'kb', opts.fieldMapping);
  const tenantId = opts.tenantId || 'default';

  await processBatches(records, IMPORT_BATCH_SIZE, async (raw, index) => {
    const rowNum = index + 1;
    try {
      const mapped = applyMapping(raw, mapping);
      const title = String(mapped.title || '').trim();
      const content = String(mapped.content || '').trim();
      if (!title) throw new Error('Missing required field: title');
      if (!content) throw new Error('Missing required field: content');

      const status = normalizeKbStatus(mapped.status);
      const category = String(mapped.category || 'uncategorized').trim() || 'uncategorized';
      const tags = parseTags(mapped.tags);
      const now = new Date().toISOString();
      const safeContent = sanitizeInboundHtml(content);
      const scopedTenant = tenantId || DEFAULT_TENANT_ID;

      const doc = await addDocDirect('kb_articles', {
        title,
        content: safeContent,
        category,
        subCategory: 'Imported',
        visibility: 'Public',
        tags: tags.length ? tags : ['imported'],
        status,
        views: 0,
        helpfulCount: 0,
        unhelpfulCount: 0,
        language: 'English',
        source: 'admin_import',
        tenantId: scopedTenant,
        authorId: opts.importedBy || '',
        createdAt: now,
        updatedAt: now,
      });

      result.successCount += 1;
      result.createdIds.push(doc.id);

      if (status === 'Published') {
        await enqueueKbArticleIndex(doc.id, scopedTenant);
        result.enqueuedVectors += 1;
      }
    } catch (err) {
      result.errorCount += 1;
      result.errors.push(
        `Row ${rowNum}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  return result;
}

export function getTicketTemplateCsv(): string {
  return [
    'subject,html_content,body,sender_email,status,created_at,tags,priority,customer_name',
    '"VPN disconnects on wake","","Laptop loses VPN after sleep","user@acme.com",RESOLVED,2024-01-15T10:00:00Z,"vpn;network",medium,"Alice Example"',
    '"Cannot reset MFA","","Need help resetting authenticator","bob@acme.com",OPEN,2024-02-01T09:30:00Z,"mfa;security",high,"Bob Example"',
  ].join('\n');
}

export function getKbTemplateCsv(): string {
  return [
    'title,content,category,status,tags',
    '"How to reset your password","<p>Open Settings → Security → Reset Password.</p>",Account,PUBLISHED,"password;howto"',
    '"Draft: SSO rollout notes","Internal notes for SSO cutover.",IT,DRAFT,"sso;draft"',
  ].join('\n');
}

export const IMPORT_CANONICAL_FIELDS = {
  tickets: TICKET_CANONICAL,
  kb: KB_CANONICAL,
};
