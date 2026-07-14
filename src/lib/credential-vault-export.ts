/**
 * Client-only GeistVault export transformers.
 * Decrypted payloads stay in browser memory and stream straight to a local download —
 * never POST'd, logged, or cached on the server.
 */
import type { VaultCredential } from './credential-vault-sync';

export type VaultExportFormat = 'chrome-csv' | 'bitwarden-json' | 'keepass-csv';

export interface DecryptedVaultExportItem {
  id: string;
  type: string;
  label: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  favorite: boolean;
  totp?: string;
  group: string;
}

export interface VaultExportFormatOption {
  id: VaultExportFormat;
  labelEn: string;
  labelDe: string;
  extension: string;
  mimeType: string;
  descriptionEn: string;
  descriptionDe: string;
}

export const VAULT_EXPORT_FORMATS: VaultExportFormatOption[] = [
  {
    id: 'chrome-csv',
    labelEn: 'Google Chrome Password Manager',
    labelDe: 'Google Chrome Passwortmanager',
    extension: 'csv',
    mimeType: 'text/csv;charset=utf-8',
    descriptionEn: 'CSV with url,username,password,title columns.',
    descriptionDe: 'CSV mit Spalten url,username,password,title.',
  },
  {
    id: 'bitwarden-json',
    labelEn: 'Bitwarden / Vaultwarden',
    labelDe: 'Bitwarden / Vaultwarden',
    extension: 'json',
    mimeType: 'application/json;charset=utf-8',
    descriptionEn: 'Official Bitwarden unencrypted JSON interchange schema.',
    descriptionDe: 'Offizielles Bitwarden-JSON-Austauschformat (unverschlüsselter Export).',
  },
  {
    id: 'keepass-csv',
    labelEn: 'KeePass / KeePassXC',
    labelDe: 'KeePass / KeePassXC',
    extension: 'csv',
    mimeType: 'text/csv;charset=utf-8',
    descriptionEn: 'Generic KeePass group import CSV matrix.',
    descriptionDe: 'Generische KeePass-Gruppen-Import-CSV-Matrix.',
  },
];

function csvEscape(value: string): string {
  const normalized = String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function resolveUrl(cred: Pick<VaultCredential, 'host' | 'type'>): string {
  const host = (cred.host || '').trim();
  if (!host) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(host)) return host;
  if (cred.type === 'web' || cred.type === 'cloud') return `https://${host}`;
  return host;
}

function resolveGroup(cred: VaultCredential): string {
  const type = (cred.type || 'login').trim();
  switch (type) {
    case 'web':
      return 'Web';
    case 'ssh':
      return 'SSH';
    case 'rdp':
      return 'RDP';
    case 'vpn':
      return 'VPN';
    case 'db':
      return 'Database';
    case 'api':
      return 'API';
    case 'cloud':
      return 'Cloud';
    case 'cert':
      return 'Certificates';
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

/** Map decrypted credentials into a neutral export record (in-memory only). */
export function toExportItems(
  credentials: VaultCredential[],
  passwordsById: Map<string, string>,
): DecryptedVaultExportItem[] {
  const items: DecryptedVaultExportItem[] = [];
  for (const cred of credentials) {
    if (cred.deleted) continue;
    if (cred.securitySettings?.disableExport) continue;
    const id = String(cred.id ?? '');
    if (!id) continue;
    const password = passwordsById.get(id);
    if (password === undefined) continue;
    items.push({
      id,
      type: cred.type || 'web',
      label: cred.label || '',
      username: cred.username || '',
      password,
      url: resolveUrl(cred),
      notes: cred.notes || '',
      favorite: !!cred.favorite,
      totp: cred.totpSecret || undefined,
      group: resolveGroup(cred),
    });
  }
  return items;
}

/** Chrome Password Manager import CSV — exact header: url,username,password,title */
export function formatChromePasswordCsv(items: DecryptedVaultExportItem[]): string {
  const lines = ['url,username,password,title'];
  for (const item of items) {
    lines.push(
      [item.url, item.username, item.password, item.label].map(csvEscape).join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Bitwarden / Vaultwarden unencrypted export object.
 * Mirrors the official interchange schema (`encrypted: false` + `items[]` login entries).
 */
export function formatBitwardenJson(items: DecryptedVaultExportItem[]): string {
  const folderIds = new Map<string, string>();
  const folders: Array<{ id: string; name: string }> = [];
  for (const item of items) {
    if (!folderIds.has(item.group)) {
      const id = crypto.randomUUID();
      folderIds.set(item.group, id);
      folders.push({ id, name: item.group });
    }
  }

  const payload = {
    encrypted: false,
    folders,
    items: items.map((item) => ({
      id: item.id.includes('-') ? item.id : crypto.randomUUID(),
      organizationId: null,
      folderId: folderIds.get(item.group) ?? null,
      type: 1,
      reprompt: 0,
      name: item.label || item.username || 'Untitled',
      notes: item.notes || null,
      favorite: item.favorite,
      login: {
        uris: item.url
          ? [
              {
                match: null,
                uri: item.url,
              },
            ]
          : [],
        username: item.username || null,
        password: item.password || null,
        totp: item.totp || null,
      },
      collectionIds: null,
    })),
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}

/** KeePass / KeePassXC generic CSV group import matrix. */
export function formatKeePassCsv(items: DecryptedVaultExportItem[]): string {
  const header = ['Group', 'Title', 'Username', 'Password', 'URL', 'Notes'];
  const lines = [header.map(csvEscape).join(',')];
  for (const item of items) {
    lines.push(
      [item.group, item.label, item.username, item.password, item.url, item.notes]
        .map(csvEscape)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

export function buildVaultExportPayload(
  format: VaultExportFormat,
  items: DecryptedVaultExportItem[],
): { content: string; filename: string; mimeType: string } {
  const stamp = new Date().toISOString().slice(0, 10);
  const option = VAULT_EXPORT_FORMATS.find((f) => f.id === format)!;
  let content: string;
  switch (format) {
    case 'chrome-csv':
      content = formatChromePasswordCsv(items);
      break;
    case 'bitwarden-json':
      content = formatBitwardenJson(items);
      break;
    case 'keepass-csv':
      content = formatKeePassCsv(items);
      break;
    default:
      throw new Error('Unsupported export format.');
  }
  return {
    content,
    filename: `geistdesk-vault-export-${stamp}.${option.extension}`,
    mimeType: option.mimeType,
  };
}

/**
 * Stream plaintext export directly to the browser download directory.
 * Uses a short-lived object URL — never uploads or logs the payload.
 */
export function downloadLocalTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke promptly so the blob is not retained in memory longer than needed.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

/** Best-effort wipe of in-memory plaintext map after export. */
export function scrubPasswordMap(map: Map<string, string>): void {
  for (const key of [...map.keys()]) {
    map.set(key, '');
    map.delete(key);
  }
  map.clear();
}
