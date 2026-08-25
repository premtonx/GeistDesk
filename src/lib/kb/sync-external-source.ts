/**
 * External source sync worker — delta-hash only.
 *
 * Compares each file's content hash (sha256 for local files, quickXorHash for
 * Graph) against the stored `kb_documents.sha256Hash` for the same
 * (tenant, source, sourcePath). Only new/changed files are copied into the
 * document store and enqueued for embedding; unchanged files are skipped.
 */
import fsp from 'fs/promises';
import path from 'path';
import { readFile } from 'fs/promises';
import {
  listExternalSources,
  getExternalSourceById,
  decryptSourceSecret,
  resolveSourceDirectory,
  finalizeSync,
  recordSyncedDocument,
  type ExternalSource,
} from './external-sources.js';
import {
  sha256Buffer,
  isAllowedDocumentExtension,
  saveRawFile,
  sanitizeFilename,
} from './document-store.js';
import {
  acquireGraphToken,
  graphListDriveChildren,
  graphGetDriveItem,
  graphDownloadFile,
  graphErrorMessage,
} from './ms-graph.js';

export interface SyncResultSummary {
  added: number;
  updated: number;
  unchanged: number;
  failed: number;
}

const SYNC_LIMIT = 500;

/** Local NAS directory walk (recursive, symlinks skipped). */
async function walkLocalDirectory(
  dir: string,
  relPrefix: string,
  out: Array<{ relPath: string; absPath: string; size: number }>,
  depth = 0,
): Promise<void> {
  if (depth > 6) return;
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === '@eaDir') continue;
    const abs = path.join(dir, entry.name);
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await walkLocalDirectory(abs, rel, out, depth + 1);
    } else if (entry.isFile() && isAllowedDocumentExtension(entry.name)) {
      try {
        const stat = await fsp.stat(abs);
        out.push({ relPath: rel, absPath: abs, size: stat.size });
      } catch {
        /* skip unreadable files */
      }
    }
  }
}

/** Copy one local file into the document store and enqueue embedding. */
async function syncLocalFile(
  tenantId: string,
  source: ExternalSource,
  file: { relPath: string; absPath: string; size: number },
  summary: SyncResultSummary,
): Promise<void> {
  const buf = await readFile(file.absPath);
  if (buf.length > 25 * 1024 * 1024) {
    summary.failed += 1;
    return;
  }
  const hash = sha256Buffer(buf);
  const recorded = await recordSyncedDocument({
    tenantId,
    sourceId: source.id,
    sourcePath: file.relPath,
    filename: path.basename(file.relPath),
    size: file.size,
    hash,
    status: 'queued',
  });
  if (!recorded.changed) {
    summary.unchanged += 1;
    return;
  }
  await saveRawFile(tenantId, recorded.docId, path.basename(file.relPath), buf);
  if (recorded.wasExisting) summary.updated += 1;
  else summary.added += 1;
}

/** Sync one local_dir source. */
async function syncLocalDirectorySource(
  tenantId: string,
  source: ExternalSource,
): Promise<SyncResultSummary> {
  const summary: SyncResultSummary = { added: 0, updated: 0, unchanged: 0, failed: 0 };
  const dir = resolveSourceDirectory(source);
  const files: Array<{ relPath: string; absPath: string; size: number }> = [];
  await walkLocalDirectory(dir, '', files);
  const targets = files.slice(0, SYNC_LIMIT);
  for (const file of targets) {
    try {
      await syncLocalFile(tenantId, source, file, summary);
    } catch {
      summary.failed += 1;
    }
  }
  return summary;
}

/** Sync one SharePoint / OneDrive source via MS Graph. */
async function syncGraphSource(
  tenantId: string,
  source: ExternalSource,
): Promise<SyncResultSummary> {
  const summary: SyncResultSummary = { added: 0, updated: 0, unchanged: 0, failed: 0 };
  const clientId = source.clientId || '';
  const azureTenantId = source.azureTenantId || '';
  const clientSecret = decryptSourceSecret(source.secretEnc);
  const token = await acquireGraphToken({ clientId, azureTenantId, clientSecret });

  const driveId = source.folderId?.includes('/drives/') ? extractDriveId(source.folderId) : '';
  const items = await graphListDriveChildren({ token, driveId, folderId: source.folderId });
  const targets = items.filter((item) => !item.folder && isAllowedDocumentExtension(item.name)).slice(0, SYNC_LIMIT);

  for (const item of targets) {
    try {
      const meta = await graphGetDriveItem({ token, driveId, itemId: item.id });
      const hash = meta?.quickXorHash || item.quickXorHash || '';
      if (!hash) {
        summary.failed += 1;
        continue;
      }

      const buf = await graphDownloadFile({ token, driveId, itemId: item.id });
      const recorded = await recordSyncedDocument({
        tenantId,
        sourceId: source.id,
        sourcePath: item.name,
        filename: item.name,
        size: item.size || buf.length,
        hash,
        status: 'queued',
      });
      if (!recorded.changed) {
        summary.unchanged += 1;
        continue;
      }
      await saveRawFile(tenantId, recorded.docId, item.name, buf);
      if (recorded.wasExisting) summary.updated += 1;
      else summary.added += 1;
    } catch {
      summary.failed += 1;
    }
  }
  return summary;
}

function extractDriveId(folderRef: string): string {
  const m = /\/drives\/([^/]+)/.exec(folderRef);
  return m ? m[1] : '';
}

/** Run one sync pass for a source (guarded by status=syncing). */
export async function syncExternalSource(sourceId: string, tenantId: string): Promise<SyncResultSummary> {
  const source = await getExternalSourceById(tenantId, sourceId);
  if (!source) throw new Error('External source not found.');

  const { updateDocDirect } = await import('../postgres-backend.js');
  await updateDocDirect('kb_external_sources', sourceId, {
    status: 'syncing',
    lastError: null,
    updatedAt: new Date().toISOString(),
  });

  try {
    let summary: SyncResultSummary;
    if (source.type === 'local_dir') {
      summary = await syncLocalDirectorySource(tenantId, source);
    } else if (source.type === 'sharepoint' || source.type === 'onedrive') {
      summary = await syncGraphSource(tenantId, source);
    } else {
      throw new Error(`Unsupported source type: ${source.type}`);
    }
    await finalizeSync(tenantId, sourceId, summary);
    return summary;
  } catch (err: unknown) {
    const message = graphErrorMessage(err);
    await finalizeSync(tenantId, sourceId, { added: 0, updated: 0, unchanged: 0, failed: 0 }, message);
    throw new Error(message);
  }
}

/** Enqueue a sync pass without awaiting the result (returns 202 to callers). */
export function enqueueExternalSourceSync(sourceId: string, tenantId: string): void {
  void syncExternalSource(sourceId, tenantId)
    .then((summary) => {
      console.log(`[external-sync] ${sourceId} finished:`, JSON.stringify(summary));
    })
    .catch((err) => {
      console.warn(`[external-sync] ${sourceId} failed:`, err?.message || err);
    });
}

let schedulerStarted = false;
let syncRunning = false;

/** Background scheduler following the email-ingestion setInterval + guard pattern. */
export function startExternalSourceSyncScheduler(intervalMs = 30 * 60 * 1000): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  const tick = async (): Promise<void> => {
    if (syncRunning) return;
    syncRunning = true;
    try {
      const sources = await listExternalSources('default');
      const enabled = sources.filter((s) => s.enabled);
      for (const source of enabled) {
        try {
          await syncExternalSource(source.id, source.tenantId || 'default');
        } catch (err) {
          console.warn(`[external-sync] scheduled ${source.id} failed:`, err?.message || err);
        }
      }
    } catch (err) {
      console.warn('[external-sync] scheduler pass failed:', err?.message || err);
    } finally {
      syncRunning = false;
    }
  };
  setInterval(() => void tick(), intervalMs);
  console.log(`[external-sync] scheduler started (interval=${intervalMs}ms)`);
}

export { sanitizeFilename };
