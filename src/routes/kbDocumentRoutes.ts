/**
 * GeistKB Document Library routes.
 * - POST /api/kb/documents/upload — multipart upload, returns HTTP 202 { documentId, status: 'queued' }
 * - GET  /api/kb/documents        — tenant-scoped document list
 * - PATCH /api/kb/documents/:id   — index_in_rag toggle (enqueue / purge)
 * - DELETE /api/kb/documents/:id  — atomic purge: raw file + vector chunks + doc row
 * - GET/POST /api/kb/documents/sources, POST /api/kb/documents/sync — external connectors
 *
 * Parsing + embedding run in the vector-queue worker — never on the request path.
 */
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import {
  addDocDirect,
  deleteDocDirect,
  getDocDirect,
  getDocsDirect,
  updateDocDirect,
} from '../lib/postgres-backend.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { resolveTenantFromRequest } from '../lib/tenant-context.js';
import { safeErrorMessage } from '../lib/safe-log.js';
import {
  sha256Buffer,
  isAllowedDocumentExtension,
  saveRawFile,
  deleteDocumentFiles,
  sanitizeFilename,
  DOCUMENT_STORAGE_DIR,
} from '../lib/kb/document-store.js';
import {
  enqueueKbDocumentIndex,
  enqueueDeleteDocumentEmbeddings,
  deleteEmbeddingsForSource,
} from '../lib/ai/vector-queue.js';
import {
  listExternalSources,
  createExternalSource,
  updateExternalSource,
  deleteExternalSource,
  getExternalSourceById,
  type ExternalSourceInput,
} from '../lib/kb/external-sources.js';
import { enqueueExternalSourceSync } from '../lib/kb/sync-external-source.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const DOC_LIST_LIMIT = 1000;

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/** POST /upload — accept multipart, hash, persist raw bytes, enqueue, 202. */
router.post('/upload', authenticate, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = (req as Request & { file?: { buffer: Buffer; originalname: string; mimetype: string } }).file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded. Use multipart field name "file".' });
    }
    if (!isAllowedDocumentExtension(file.originalname)) {
      return res.status(415).json({
        error: 'Unsupported file type. Allowed: .pdf, .docx, .txt, .md, .csv.',
      });
    }

    const tenantId = resolveTenantFromRequest(req);
    const hash = sha256Buffer(file.buffer);

    // Duplicate detection (same content already uploaded to this workspace).
    const existing = await getDocsDirect('kb_documents', [
      { type: 'where', field: 'tenantId', op: '==', value: tenantId },
      { type: 'where', field: 'sha256Hash', op: '==', value: hash },
    ]);
    if (existing.length > 0) {
      return res.status(200).json({
        duplicate: true,
        documentId: existing[0].id,
        warning: 'A document with identical content already exists in this workspace.',
      });
    }

    const now = new Date().toISOString();
    const created = await addDocDirect('kb_documents', {
      tenantId,
      filename: file.originalname,
      size: file.buffer.length,
      mime: file.mimetype || 'application/octet-stream',
      sha256Hash: hash,
      status: 'queued',
      index_in_rag: true,
      source: 'upload',
      sourcePath: null,
      chunkCount: 0,
      pages: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    });

    await saveRawFile(tenantId, created.id, file.originalname, file.buffer);
    enqueueKbDocumentIndex(created.id, tenantId);

    return res.status(202).json({ documentId: created.id, status: 'queued' });
  } catch (err: unknown) {
    return res.status(500).json({ error: safeErrorMessage(err, 'Upload failed.') });
  }
});

/** GET / — tenant-scoped document list. */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenantFromRequest(req);
    const docs = await getDocsDirect('kb_documents', [
      { type: 'where', field: 'tenantId', op: '==', value: tenantId },
    ]);
    const limited = docs.slice(0, DOC_LIST_LIMIT);
    return res.json({
      documents: limited.map((doc) => ({
        id: doc.id,
        filename: doc.filename || 'document.bin',
        title: doc.title || doc.filename || 'document.bin',
        size: doc.size || 0,
        mime: doc.mime || null,
        sha256Hash: doc.sha256Hash || null,
        status: doc.status || 'queued',
        index_in_rag: doc.index_in_rag !== false,
        chunkCount: doc.chunkCount || 0,
        pages: doc.pages ?? null,
        error: doc.error || null,
        source: doc.source || 'upload',
        sourcePath: doc.sourcePath || null,
        createdAt: doc.createdAt || null,
        updatedAt: doc.updatedAt || null,
      })),
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: safeErrorMessage(err, 'Failed to list documents.') });
  }
});

/** PATCH /:id — toggle index_in_rag (enqueue embed or purge vectors). */
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenantFromRequest(req);
    const id = String(req.params.id || '');
    const doc = await getDocDirect('kb_documents', id);
    if (!doc || String(doc.tenantId ?? '') !== tenantId) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const body = (req.body || {}) as { index_in_rag?: unknown };
    if (typeof body.index_in_rag !== 'boolean') {
      return res.status(400).json({ error: 'index_in_rag must be a boolean.' });
    }

    await updateDocDirect('kb_documents', id, {
      index_in_rag: body.index_in_rag,
      updatedAt: new Date().toISOString(),
    });

    if (body.index_in_rag) {
      enqueueKbDocumentIndex(id, tenantId);
    } else {
      await deleteEmbeddingsForSource(tenantId, 'KB_DOCUMENT', id);
    }

    return res.json({ success: true, documentId: id, index_in_rag: body.index_in_rag });
  } catch (err: unknown) {
    return res.status(500).json({ error: safeErrorMessage(err, 'Failed to update document.') });
  }
});

/** DELETE /:id — purge raw file + vector chunks + doc row atomically. */
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenantFromRequest(req);
    const id = String(req.params.id || '');
    const doc = await getDocDirect('kb_documents', id);
    if (!doc || String(doc.tenantId ?? '') !== tenantId) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    await deleteEmbeddingsForSource(tenantId, 'KB_DOCUMENT', id);
    await deleteDocumentFiles(tenantId, id);
    await deleteDocDirect('kb_documents', id);

    return res.json({ success: true, documentId: id });
  } catch (err: unknown) {
    return res.status(500).json({ error: safeErrorMessage(err, 'Failed to delete document.') });
  }
});

// ---------------------------------------------------------------------------
// External source connectors (SYSTEM_ADMIN only)
// ---------------------------------------------------------------------------

/** GET /sources — connector list (secrets returned encrypted / redacted). */
router.get('/sources', authenticate, requireRole(['SYSTEM_ADMIN']), async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenantFromRequest(req);
    const sources = await listExternalSources(tenantId);
    return res.json({
      sources: sources.map((s) => ({
        id: s.id,
        type: s.type,
        name: s.name,
        basePath: s.basePath || null,
        host: s.host || null,
        port: s.port || null,
        username: s.username || null,
        authMode: s.authMode || 'password',
        folderId: s.folderId || null,
        clientId: s.clientId || null,
        azureTenantId: s.azureTenantId || null,
        hasSecret: Boolean(s.secretEnc),
        enabled: s.enabled !== false,
        status: s.status || 'idle',
        lastSyncedAt: s.lastSyncedAt || null,
        lastError: s.lastError || null,
        lastSyncSummary: s.lastSyncSummary || null,
      })),
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: safeErrorMessage(err, 'Failed to list sources.') });
  }
});

/** POST /sources — create a connector. */
router.post('/sources', authenticate, requireRole(['SYSTEM_ADMIN']), async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenantFromRequest(req);
    const body = (req.body || {}) as Partial<ExternalSourceInput>;
    const created = await createExternalSource(tenantId, body as ExternalSourceInput);
    return res.status(201).json({ source: { ...created, secretEnc: undefined } });
  } catch (err: unknown) {
    return res.status(400).json({ error: safeErrorMessage(err, 'Failed to create source.') });
  }
});

/** PATCH /sources/:id — update a connector (enable/disable, config, secret). */
router.patch('/sources/:id', authenticate, requireRole(['SYSTEM_ADMIN']), async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenantFromRequest(req);
    const id = String(req.params.id || '');
    const existing = await getExternalSourceById(tenantId, id);
    if (!existing) return res.status(404).json({ error: 'External source not found.' });

    const body = (req.body || {}) as Partial<ExternalSourceInput> & { enabled?: boolean };
    await updateExternalSource(tenantId, id, body);
    const updated = await getExternalSourceById(tenantId, id);
    return res.json({ source: { ...updated, secretEnc: undefined } });
  } catch (err: unknown) {
    return res.status(400).json({ error: safeErrorMessage(err, 'Failed to update source.') });
  }
});

/** DELETE /sources/:id — delete connector + purge imported documents. */
router.delete('/sources/:id', authenticate, requireRole(['SYSTEM_ADMIN']), async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenantFromRequest(req);
    const id = String(req.params.id || '');
    await deleteExternalSource(tenantId, id);
    return res.json({ success: true, sourceId: id });
  } catch (err: unknown) {
    return res.status(500).json({ error: safeErrorMessage(err, 'Failed to delete source.') });
  }
});

/** POST /sync — trigger a manual sync pass (fire-and-forget → 202). */
router.post('/sync', authenticate, requireRole(['SYSTEM_ADMIN']), async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenantFromRequest(req);
    const body = (req.body || {}) as { sourceId?: string };
    const sourceId = String(body.sourceId || '');

    if (sourceId) {
      const source = await getExternalSourceById(tenantId, sourceId);
      if (!source) return res.status(404).json({ error: 'External source not found.' });
      enqueueExternalSourceSync(sourceId, tenantId);
      return res.status(202).json({ status: 'queued', sourceId });
    }

    const sources = await listExternalSources(tenantId);
    for (const source of sources) {
      if (source.enabled) enqueueExternalSourceSync(source.id, tenantId);
    }
    return res.status(202).json({ status: 'queued', sourceCount: sources.filter((s) => s.enabled).length });
  } catch (err: unknown) {
    return res.status(500).json({ error: safeErrorMessage(err, 'Failed to enqueue sync.') });
  }
});

export default router;

export { DOCUMENT_STORAGE_DIR, sanitizeFilename };
