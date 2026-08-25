/**
 * Admin data import API — tickets + GeistKB (JSON body or multipart CSV/JSON file).
 */

import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import {
  getKbTemplateCsv,
  getTicketTemplateCsv,
  IMPORT_CANONICAL_FIELDS,
  importKbArticles,
  importTickets,
  parseImportPayload,
  type FieldMapping,
  type ImportResult,
} from '../lib/import-service.js';
import { getVectorQueueDepth } from '../lib/ai/vector-queue.js';
import { resolveTenantFromRequest } from '../lib/tenant-context.js';
import { safeErrorMessage, safeLog } from '../lib/safe-log.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const ok =
      name.endsWith('.csv') ||
      name.endsWith('.json') ||
      (file.mimetype || '').includes('csv') ||
      (file.mimetype || '').includes('json') ||
      (file.mimetype || '').includes('text');
    if (!ok) {
      cb(new Error('Only .csv or .json files are accepted'));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

const fieldMappingSchema = z.record(z.string(), z.string()).optional();

const jsonBodySchema = z.object({
  records: z.array(z.record(z.string(), z.unknown())).optional(),
  data: z.array(z.record(z.string(), z.unknown())).optional(),
  fieldMapping: fieldMappingSchema,
  // tenantId intentionally omitted from trusted schema — session only
});

function resolveImporter(req: Request): string {
  const user = (req as Request & { user?: { id?: string; email?: string } }).user;
  return user?.id || user?.email || 'admin';
}

function parseFieldMappingFromBody(body: unknown): FieldMapping | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const raw = (body as { fieldMapping?: unknown }).fieldMapping;
  if (!raw) return undefined;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as FieldMapping;
      }
    } catch {
      return undefined;
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as FieldMapping;
  }
  return undefined;
}

function extractRecordsFromRequest(req: Request): {
  records: Record<string, unknown>[];
  headers: string[];
  format: 'csv' | 'json';
} {
  const file = (
    req as Request & { file?: { buffer: Buffer; originalname: string; mimetype: string } }
  ).file;

  if (file?.buffer) {
    return parseImportPayload(file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });
  }

  const parsed = jsonBodySchema.safeParse(req.body || {});
  if (!parsed.success) {
    throw new Error('Invalid JSON payload. Provide { records: [...] } or upload a file.');
  }

  const records = parsed.data.records || parsed.data.data;
  if (!records || !Array.isArray(records)) {
    throw new Error(
      'No records found. Send JSON { records: [...] } or multipart field "file" (.csv / .json).',
    );
  }
  const headers = records[0] ? Object.keys(records[0]) : [];
  return { records, headers, format: 'json' };
}

async function enrichResult(result: ImportResult) {
  return {
    ...result,
    queueDepth: await getVectorQueueDepth(),
  };
}

/** Maps import/parse failures to HTTP status codes: 4xx for client-caused
 *  validation errors, 5xx for unexpected server failures. */
function importErrorStatus(err: unknown): number {
  const message = err instanceof Error ? err.message : String(err);
  if (
    /^Invalid JSON|^CSV parse error|^Missing required field|^No records|^Invalid payload/i.test(message)
  ) {
    return 400;
  }
  return 500;
}

/** Generic catch handler: safe-redacts the message and picks a proper status. */
function handleImportError(res: Response, err: unknown, fallback: string) {
  const message = safeErrorMessage(err, fallback);
  safeLog('error', '[import]', message);
  return res.status(importErrorStatus(err)).json({ error: message });
}

router.use(authenticate, requireRole(['SYSTEM_ADMIN']));

/** Downloadable CSV templates */
router.get('/templates/tickets', (_req, res: Response) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tickets_import_template.csv"');
  res.send(getTicketTemplateCsv());
});

router.get('/templates/kb', (_req, res: Response) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="kb_import_template.csv"');
  res.send(getKbTemplateCsv());
});

router.get('/fields', (_req, res: Response) => {
  res.json({
    tickets: IMPORT_CANONICAL_FIELDS.tickets,
    kb: IMPORT_CANONICAL_FIELDS.kb,
  });
});

router.post('/tickets', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenantFromRequest(req);
    const fieldMapping = parseFieldMappingFromBody(req.body);
    const { records } = extractRecordsFromRequest(req);

    if (records.length === 0) {
      return res.status(400).json({ error: 'Import file/payload contained no rows.' });
    }

    const result = await importTickets(records, {
      tenantId,
      fieldMapping,
      importedBy: resolveImporter(req),
    });

    return res.status(result.errorCount && !result.successCount ? 422 : 200).json({
      success: result.successCount > 0,
      tenantId,
      ...(await enrichResult(result)),
    });
  } catch (err: unknown) {
    return handleImportError(res, err, 'Ticket import failed');
  }
});

router.post('/kb', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenantFromRequest(req);
    const fieldMapping = parseFieldMappingFromBody(req.body);
    const { records } = extractRecordsFromRequest(req);

    if (records.length === 0) {
      return res.status(400).json({ error: 'Import file/payload contained no rows.' });
    }

    const result = await importKbArticles(records, {
      tenantId,
      fieldMapping,
      importedBy: resolveImporter(req),
    });

    return res.status(result.errorCount && !result.successCount ? 422 : 200).json({
      success: result.successCount > 0,
      tenantId,
      ...(await enrichResult(result)),
    });
  } catch (err: unknown) {
    return handleImportError(res, err, 'KB import failed');
  }
});

/** Preview parse only — returns headers + sample rows for the field mapper UI. */
router.post('/preview', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { records, headers, format } = extractRecordsFromRequest(req);
    return res.json({
      format,
      headers,
      rowCount: records.length,
      sample: records.slice(0, 5),
    });
  } catch (err: unknown) {
    const message = safeErrorMessage(err, 'Preview failed');
    safeLog('error', '[import/preview]', message);
    return res.status(400).json({ error: message });
  }
});

export default router;
