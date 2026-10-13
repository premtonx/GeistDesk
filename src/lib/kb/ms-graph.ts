/**
 * Minimal Microsoft Graph client for SharePoint / OneDrive connectors.
 * Uses the client-credentials flow (app registration with Files.Read.All /
 * Sites.Read.All + admin consent). Tokens are never persisted.
 */
import axios from 'axios';
import { safeErrorMessage } from '../safe-log.js';

export interface GraphDriveItem {
  id: string;
  name: string;
  folder?: boolean;
  size?: number;
  quickXorHash?: string | null;
  file?: { mimeType?: string } | null;
  webUrl?: string | null;
}

interface GraphTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

const GRAPH_API = 'https://graph.microsoft.com/v1.0';
const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;

function assertGraphConfig(clientId: string, azureTenantId: string, clientSecret: string): void {
  if (!clientId || !azureTenantId || !clientSecret) {
    throw new Error('SharePoint/OneDrive connectors require Client ID, Tenant ID and Secret.');
  }
}

/** Client-credentials token for the app registration. */
export async function acquireGraphToken(params: {
  clientId: string;
  azureTenantId: string;
  clientSecret: string;
}): Promise<string> {
  assertGraphConfig(params.clientId, params.azureTenantId, params.clientSecret);
  const url = `https://login.microsoftonline.com/${encodeURIComponent(params.azureTenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await axios.post<GraphTokenResponse>(url, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 30_000,
  });

  const data = res.data || {};
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || 'Graph token request failed.');
  }
  return data.access_token;
}

export async function graphListDriveChildren(params: {
  token: string;
  driveId: string;
  folderId?: string;
}): Promise<GraphDriveItem[]> {
  const path = params.folderId
    ? `/drives/${encodeURIComponent(params.driveId)}/items/${encodeURIComponent(params.folderId)}/children`
    : `/drives/${encodeURIComponent(params.driveId)}/root/children`;
  const items: GraphDriveItem[] = [];
  let nextUrl: string | null = `${GRAPH_API}${path}`;

  while (nextUrl && items.length < 2000) {
    const res = await axios.get<{ value?: GraphDriveItem[]; '@odata.nextLink'?: string }>(nextUrl, {
      headers: { Authorization: `Bearer ${params.token}` },
      timeout: 30_000,
    });
    const batch = res.data?.value || [];
    for (const item of batch) {
      if (!item || typeof item.id !== 'string') continue;
      items.push({
        id: item.id,
        name: item.name || 'unnamed',
        folder: Boolean(item.folder),
        size: Number(item.size) || 0,
        file: item.file || null,
        webUrl: item.webUrl || null,
      });
    }
    nextUrl = res.data?.['@odata.nextLink'] || null;
  }
  return items;
}

/** Fetch file metadata including quickXorHash (content fingerprint for delta sync). */
export async function graphGetDriveItem(params: {
  token: string;
  driveId: string;
  itemId: string;
}): Promise<GraphDriveItem | null> {
  interface GraphItemResponse {
    id: string;
    name: string;
    folder?: unknown;
    size?: number;
    webUrl?: string | null;
    file?: { hashes?: { quickXorHash?: string }; mimeType?: string } | null;
  }
  const url = `${GRAPH_API}/drives/${encodeURIComponent(params.driveId)}/items/${encodeURIComponent(params.itemId)}`;
  const res = await axios.get<GraphItemResponse>(url, {
    headers: { Authorization: `Bearer ${params.token}` },
    timeout: 30_000,
  });
  const data = res.data;
  return {
    id: data.id,
    name: data.name || 'unnamed',
    folder: Boolean(data.folder),
    size: Number(data.size) || 0,
    quickXorHash: data.file?.hashes?.quickXorHash || null,
    file: data.file ? { mimeType: data.file.mimeType } : null,
    webUrl: data.webUrl || null,
  };
}

/** Stream a file into memory (capped at 25 MB like uploads). */
export async function graphDownloadFile(params: {
  token: string;
  driveId: string;
  itemId: string;
}): Promise<Buffer> {
  const url = `${GRAPH_API}/drives/${encodeURIComponent(params.driveId)}/items/${encodeURIComponent(params.itemId)}/content`;
  const res = await axios.get<ArrayBuffer>(url, {
    headers: { Authorization: `Bearer ${params.token}` },
    responseType: 'arraybuffer',
    timeout: 60_000,
    maxContentLength: MAX_DOWNLOAD_BYTES,
  });
  if (res.data.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Graph file exceeds the 25 MB download limit (${res.data.byteLength} bytes).`);
  }
  return Buffer.from(res.data);
}

/** Human-readable Graph error. */
export function graphErrorMessage(err: unknown): string {
  const message = safeErrorMessage(err);
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    if (status === 401) return 'Graph authentication failed — check Client ID / Tenant ID / Secret and admin consent.';
    if (status === 403) return 'Graph access denied — grant Files.Read.All / Sites.Read.All with admin consent.';
    if (status === 404) return 'Graph folder or drive not found — check the Folder/Drive ID.';
    if (status === 429) return 'Graph rate limit reached — retry later.';
    return `Graph request failed (${status ?? 'network'}): ${message}`;
  }
  return message;
}
