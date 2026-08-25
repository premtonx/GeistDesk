/**
 * GeistKB Document Library API client.
 * Uploads go through the async vector-queue pipeline (HTTP 202 → status polling).
 */
import axios from 'axios';

export type KbDocumentStatus = 'queued' | 'processing' | 'indexed' | 'error' | 'no_text';

export interface KbDocumentRecord {
  id: string;
  filename: string;
  title: string;
  size: number;
  mime: string | null;
  sha256Hash: string | null;
  status: KbDocumentStatus;
  index_in_rag: boolean;
  chunkCount: number;
  pages: number | null;
  error: string | null;
  source: 'upload' | 'external';
  sourcePath: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface KbExternalSource {
  id: string;
  type: 'local_dir' | 'sftp' | 'sharepoint' | 'onedrive';
  name: string;
  basePath: string | null;
  host: string | null;
  port: number | null;
  username: string | null;
  authMode: 'password' | 'privateKey' | null;
  folderId: string | null;
  clientId: string | null;
  azureTenantId: string | null;
  hasSecret: boolean;
  enabled: boolean;
  status: 'idle' | 'syncing' | 'error';
  lastSyncedAt: string | null;
  lastError: string | null;
  lastSyncSummary: { added: number; updated: number; unchanged: number; failed: number } | null;
}

export interface UploadDocumentResult {
  documentId: string;
  status: 'queued';
  duplicate?: boolean;
  warning?: string;
}

export const kbDocumentsApi = {
  async list(): Promise<KbDocumentRecord[]> {
    const res = await axios.get<{ documents: KbDocumentRecord[] }>('/api/kb/documents', {
      withCredentials: true,
    });
    return res.data.documents || [];
  },

  async upload(file: File, onProgress?: (percent: number) => void): Promise<UploadDocumentResult> {
    const form = new FormData();
    form.append('file', file);
    const res = await axios.post<UploadDocumentResult>('/api/kb/documents/upload', form, {
      withCredentials: true,
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
    });
    return res.data;
  },

  async toggleRag(id: string, indexInRag: boolean): Promise<void> {
    await axios.patch(
      `/api/kb/documents/${id}`,
      { index_in_rag: indexInRag },
      { withCredentials: true },
    );
  },

  async remove(id: string): Promise<void> {
    await axios.delete(`/api/kb/documents/${id}`, { withCredentials: true });
  },

  // External connectors (SYSTEM_ADMIN)
  async listSources(): Promise<KbExternalSource[]> {
    const res = await axios.get<{ sources: KbExternalSource[] }>('/api/kb/documents/sources', {
      withCredentials: true,
    });
    return res.data.sources || [];
  },

  async createSource(input: {
    type: 'local_dir' | 'sftp' | 'sharepoint' | 'onedrive';
    name: string;
    basePath?: string;
    host?: string;
    port?: number;
    username?: string;
    authMode?: 'password' | 'privateKey';
    folderId?: string;
    clientId?: string;
    azureTenantId?: string;
    secret?: string;
    enabled?: boolean;
  }): Promise<KbExternalSource> {
    const res = await axios.post<{ source: KbExternalSource }>('/api/kb/documents/sources', input, {
      withCredentials: true,
    });
    return res.data.source;
  },

  async patchSource(
    id: string,
    patch: Partial<{
      name: string;
      enabled: boolean;
      basePath: string;
      host: string;
      port: number;
      username: string;
      authMode: 'password' | 'privateKey';
      folderId: string;
      clientId: string;
      azureTenantId: string;
      secret: string;
    }>,
  ): Promise<KbExternalSource> {
    const res = await axios.patch<{ source: KbExternalSource }>(
      `/api/kb/documents/sources/${id}`,
      patch,
      { withCredentials: true },
    );
    return res.data.source;
  },

  async deleteSource(id: string): Promise<void> {
    await axios.delete(`/api/kb/documents/sources/${id}`, { withCredentials: true });
  },

  async syncSource(sourceId?: string): Promise<void> {
    await axios.post(
      '/api/kb/documents/sync',
      sourceId ? { sourceId } : {},
      { withCredentials: true },
    );
  },
};
