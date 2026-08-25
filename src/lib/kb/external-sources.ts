/**
 * External KB source connectors — local NAS directory + SharePoint/OneDrive.
 *
 * Source records live in the tenant-scoped `kb_external_sources` collection.
 * Client secrets are encrypted at rest via GeistVault crypto (encryptExchangeAtRest)
 * and decrypted only inside the sync worker. All sync work is enqueued onto the
 * vector queue so parsing/embedding never blocks the request path.
 */
import { addDocDirect, deleteDocDirect, getDocDirect, getDocsDirect, updateDocDirect } from '../postgres-backend.js';
import { encryptExchangeAtRest, decryptPayloadAuto, type AnyEncryptedPayload } from '../crypto.js';
import { safeErrorMessage } from '../safe-log.js';
import { resolveSandboxPath, KB_SOURCES_ROOT, deleteDocumentFiles } from './document-store.js';
import { enqueueKbDocumentIndex, enqueueDeleteDocumentEmbeddings } from '../ai/vector-queue.js';

export type ExternalSourceType = 'local_dir' | 'sftp' | 'sharepoint' | 'onedrive';

export interface ExternalSource {
  id: string;
  tenantId: string;
  type: ExternalSourceType;
  name: string;
  basePath?: string;
  host?: string;
  port?: number;
  username?: string;
  authMode?: 'password' | 'privateKey';
  folderId?: string;
  clientId?: string;
  azureTenantId?: string;
  secretEnc?: AnyEncryptedPayload;
  enabled: boolean;
  lastSyncedAt?: string | null;
  status?: 'idle' | 'syncing' | 'error' | null;
  lastError?: string | null;
  lastSyncSummary?: { added: number; updated: number; unchanged: number; failed: number } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExternalSourceInput {
  type: ExternalSourceType;
  name: string;
  basePath?: string;
  host?: string;
  port?: number;
  username?: string;
  authMode?: 'password' | 'privateKey';
  /** Password for SFTP password-auth; also used for Graph client secret. */
  secret?: string;
  folderId?: string;
  clientId?: string;
  azureTenantId?: string;
  enabled?: boolean;
}

const TENANT_SCOPED = true;

function sanitizeName(name: string): string {
  return String(name || '').trim().slice(0, 120);
}

/** Encrypt the connector secret at rest (GeistVault crypto). */
export function encryptSourceSecret(secret: string): AnyEncryptedPayload {
  return encryptExchangeAtRest(String(secret || ''), 'external-source-secret');
}

/** Decrypt a stored secret. Throws when malformed. */
export function decryptSourceSecret(secretEnc: AnyEncryptedPayload | undefined | null): string {
  if (!secretEnc) return '';
  try {
    return decryptPayloadAuto(secretEnc);
  } catch (err) {
    throw new Error(`Failed to decrypt connector secret: ${safeErrorMessage(err)}`);
  }
}

/** List every external source for a tenant (secrets returned encrypted). */
export async function listExternalSources(tenantId: string): Promise<ExternalSource[]> {
  const docs = await getDocsDirect('kb_external_sources', [
    { type: 'where', field: 'tenantId', op: '==', value: tenantId },
  ]);
  return docs
    .map((doc) => ({ ...(doc.data || {}), id: doc.id }) as ExternalSource)
    .filter(
      (s) =>
        s.type === 'local_dir' ||
        s.type === 'sftp' ||
        s.type === 'sharepoint' ||
        s.type === 'onedrive',
    )
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

/** Fetch a single connector by id (tenant-scoped). */
export async function getExternalSourceById(
  tenantId: string,
  id: string,
): Promise<ExternalSource | null> {
  const doc = await getDocDirect('kb_external_sources', id);
  if (!doc) return null;
  if (String(doc.tenantId ?? doc.tenant_id ?? '') !== tenantId) return null;
  return { ...doc, id: doc.id } as ExternalSource;
}

/** Create a connector. `secret` (when provided) is encrypted before storage. */
export async function createExternalSource(
  tenantId: string,
  input: ExternalSourceInput,
): Promise<ExternalSource> {
  const now = new Date().toISOString();
  const name = sanitizeName(input.name);
  if (!name) throw new Error('Source name is required.');
  if (
    input.type !== 'local_dir' &&
    input.type !== 'sftp' &&
    input.type !== 'sharepoint' &&
    input.type !== 'onedrive'
  ) {
    throw new Error('Invalid source type.');
  }
  if (input.type === 'local_dir' && !input.basePath) {
    throw new Error('Base path is required for local directory sources.');
  }
  if (input.type === 'sftp' && !input.host) {
    throw new Error('SFTP host is required.');
  }

  const data: Record<string, unknown> = {
    tenantId,
    type: input.type,
    name,
    enabled: input.enabled !== false,
    status: 'idle',
    lastSyncedAt: null,
    lastError: null,
    lastSyncSummary: null,
    createdAt: now,
    updatedAt: now,
  };

  if (input.type === 'local_dir') {
    data.basePath = String(input.basePath || '').replace(/^\/+|\/+$/g, '');
  } else if (input.type === 'sftp') {
    data.host = String(input.host || '').trim();
    data.port = Number(input.port) || 22;
    data.username = String(input.username || '').trim() || null;
    data.basePath = String(input.basePath || '').replace(/^\/+|\/+$/g, '');
    data.authMode = input.authMode === 'privateKey' ? 'privateKey' : 'password';
    if (input.secret) data.secretEnc = encryptSourceSecret(input.secret);
  } else {
    data.folderId = String(input.folderId || '').trim() || null;
    data.clientId = String(input.clientId || '').trim() || null;
    data.azureTenantId = String(input.azureTenantId || '').trim() || null;
    if (input.secret) data.secretEnc = encryptSourceSecret(input.secret);
  }

  const created = await addDocDirect('kb_external_sources', data);
  return { ...(created.data || {}), id: created.id } as ExternalSource;
}

/** Update connector fields; an empty secret leaves the stored one untouched. */
export async function updateExternalSource(
  tenantId: string,
  id: string,
  patch: Partial<ExternalSourceInput> & { enabled?: boolean },
): Promise<void> {
  const current = await getExternalSourceById(tenantId, id);
  if (!current) throw new Error('External source not found.');

  const data: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (patch.name !== undefined) data.name = sanitizeName(patch.name);
  if (patch.enabled !== undefined) data.enabled = patch.enabled;
  if (patch.type === 'local_dir') {
    data.basePath = String(patch.basePath || '').replace(/^\/+|\/+$/g, '');
  } else if (patch.type === 'sftp') {
    if (patch.host !== undefined) data.host = String(patch.host || '').trim();
    if (patch.port !== undefined) data.port = Number(patch.port) || 22;
    if (patch.username !== undefined) data.username = String(patch.username || '').trim() || null;
    if (patch.basePath !== undefined) data.basePath = String(patch.basePath || '').replace(/^\/+|\/+$/g, '');
    if (patch.authMode !== undefined) data.authMode = patch.authMode === 'privateKey' ? 'privateKey' : 'password';
    if (patch.secret) data.secretEnc = encryptSourceSecret(patch.secret);
  } else if (patch.type === 'sharepoint' || patch.type === 'onedrive') {
    if (patch.folderId !== undefined) data.folderId = String(patch.folderId || '').trim() || null;
    if (patch.clientId !== undefined) data.clientId = String(patch.clientId || '').trim() || null;
    if (patch.azureTenantId !== undefined) data.azureTenantId = String(patch.azureTenantId || '').trim() || null;
    if (patch.secret) data.secretEnc = encryptSourceSecret(patch.secret);
  }
  if (Object.keys(data).length > 1) {
    await updateDocDirect('kb_external_sources', id, data);
  }
}

/** Delete a connector and purge any documents it imported (vectors + files). */
export async function deleteExternalSource(tenantId: string, id: string): Promise<void> {
  const current = await getExternalSourceById(tenantId, id);
  if (!current) return;

  const imported = await getDocsDirect('kb_documents', [
    { type: 'where', field: 'tenantId', op: '==', value: tenantId },
    { type: 'where', field: 'source', op: '==', value: 'external' },
    { type: 'where', field: 'sourceId', op: '==', value: id },
  ]);
  for (const doc of imported) {
    await deleteDocDirect('kb_documents', doc.id);
    enqueueDeleteDocumentEmbeddings(doc.id, tenantId);
    void deleteDocumentFiles(tenantId, doc.id);
  }
  await deleteDocDirect('kb_external_sources', id);
}

/** Existing doc keyed by external source path — used for delta-hash sync. */
export async function findDocumentBySourcePath(
  tenantId: string,
  sourceId: string,
  sourcePath: string,
): Promise<{ id: string; sha256Hash?: string; filename?: string } | null> {
  const docs = await getDocsDirect('kb_documents', [
    { type: 'where', field: 'tenantId', op: '==', value: tenantId },
    { type: 'where', field: 'source', op: '==', value: 'external' },
    { type: 'where', field: 'sourceId', op: '==', value: sourceId },
    { type: 'where', field: 'sourcePath', op: '==', value: sourcePath },
  ]);
  const doc = docs[0];
  if (!doc) return null;
  return { id: doc.id, sha256Hash: doc.data?.sha256Hash, filename: doc.data?.filename };
}

/**
 * Create or update the kb_documents row for a synced file and enqueue
 * embedding. Returns the document id plus whether the file changed.
 * Delta-hash comparison happens in the sync worker; this helper records.
 */
export async function recordSyncedDocument(params: {
  tenantId: string;
  sourceId: string;
  sourcePath: string;
  filename: string;
  size: number;
  hash: string;
  status: 'queued' | 'indexed' | 'no_text' | 'error';
  indexInRag?: boolean;
}): Promise<{ docId: string; changed: boolean; wasExisting: boolean }> {
  const existing = await findDocumentBySourcePath(
    params.tenantId,
    params.sourceId,
    params.sourcePath,
  );
  if (existing && existing.sha256Hash === params.hash) {
    return { docId: existing.id, changed: false, wasExisting: true };
  }

  const now = new Date().toISOString();
  const data: Record<string, unknown> = {
    tenantId: params.tenantId,
    filename: params.filename,
    size: params.size,
    sha256Hash: params.hash,
    mime: 'application/octet-stream',
    status: params.status,
    index_in_rag: params.indexInRag !== false,
    source: 'external',
    sourceId: params.sourceId,
    sourcePath: params.sourcePath,
    chunkCount: 0,
    error: null,
    createdAt: now,
    updatedAt: now,
  };

  if (existing) {
    data.previousHash = existing.sha256Hash || null;
    data.filename = existing.filename || params.filename;
    await updateDocDirect('kb_documents', existing.id, data);
    enqueueKbDocumentIndex(existing.id, params.tenantId);
    return { docId: existing.id, changed: true, wasExisting: true };
  }

  const created = await addDocDirect('kb_documents', data);
  enqueueKbDocumentIndex(created.id, params.tenantId);
  return { docId: created.id, changed: true, wasExisting: false };
}

/** Mark a source record after a sync pass. */
export async function finalizeSync(
  tenantId: string,
  sourceId: string,
  summary: { added: number; updated: number; unchanged: number; failed: number },
  error?: string | null,
): Promise<void> {
  await updateDocDirect('kb_external_sources', sourceId, {
    status: error ? 'error' : 'idle',
    lastError: error ? String(error).slice(0, 1000) : null,
    lastSyncedAt: new Date().toISOString(),
    lastSyncSummary: summary,
    updatedAt: new Date().toISOString(),
  });
}

/** Resolve the sandboxed absolute directory for a local_dir source. */
export function resolveSourceDirectory(source: ExternalSource): string {
  const basePath = String(source.basePath || '').replace(/^\/+|\/+$/g, '');
  return resolveSandboxPath(KB_SOURCES_ROOT, basePath);
}

// Re-export to avoid duplicate imports in routes / worker.
export { KB_SOURCES_ROOT };
