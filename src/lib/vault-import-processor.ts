/**
 * Client-side vault import processors.
 * Parses popular password-manager formats into GeistVault credential shapes.
 * Plaintext never leaves the browser — callers encrypt before sync.
 */

export interface ImportedCredentialPayload {
  name: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  category: string;
  tags: string[];
}

export type VaultImportFormatId =
  | 'chrome-csv'
  | 'bitwarden-json'
  | 'keepass-csv'
  | 'keepass-xml'
  | 'onepassword-json'
  | 'vaultwarden-csv'
  | 'auto';

export interface VaultImportFormatOption {
  id: Exclude<VaultImportFormatId, 'auto'>;
  label: string;
  description: string;
  accept: string;
}

export const VAULT_IMPORT_FORMATS: VaultImportFormatOption[] = [
  {
    id: 'chrome-csv',
    label: 'Google Chrome / Edge CSV',
    description: 'name, url, username, password columns from browser password export',
    accept: '.csv,text/csv',
  },
  {
    id: 'bitwarden-json',
    label: 'Bitwarden / Vaultwarden JSON',
    description: 'Unencrypted JSON export (encrypted .json is not supported)',
    accept: '.json,application/json',
  },
  {
    id: 'keepass-csv',
    label: 'KeePass CSV',
    description: 'CSV with Group, Title, Username, Password, URL, Notes',
    accept: '.csv,text/csv',
  },
  {
    id: 'keepass-xml',
    label: 'KeePass XML',
    description: 'KeePass 2.x XML (.kdbx must be converted to XML first)',
    accept: '.xml,text/xml,application/xml',
  },
  {
    id: 'onepassword-json',
    label: '1Password JSON',
    description: '1Password unencrypted JSON export',
    accept: '.json,1pif,application/json',
  },
  {
    id: 'vaultwarden-csv',
    label: 'Vaultwarden / Bitwarden CSV',
    description: 'login_uri, login_username, login_password style CSV',
    accept: '.csv,text/csv',
  },
];

function truncate(value: string, max = 240): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      current = '';
      continue;
    }
    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  }

  return rows;
}

function headerIndexMap(header: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  header.forEach((cell, index) => {
    map[cell.trim().toLowerCase().replace(/\s+/g, '_')] = index;
  });
  return map;
}

function cell(row: string[], map: Record<string, number>, ...keys: string[]): string {
  for (const key of keys) {
    const idx = map[key];
    if (idx !== undefined && row[idx] !== undefined) {
      return String(row[idx] ?? '').trim();
    }
  }
  return '';
}

function toCredential(input: {
  name?: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  category?: string;
  tags?: string[];
}): ImportedCredentialPayload | null {
  const name = truncate(input.name || input.url || input.username || 'Imported Secret');
  const username = truncate(input.username || '');
  const password = input.password || '';
  const url = truncate(input.url || '', 500);
  const notes = truncate(input.notes || '', 4000);
  const category = truncate(input.category || 'Imported', 80) || 'Imported';
  const tags = (input.tags || [])
    .map((tag) => truncate(String(tag), 40))
    .filter(Boolean)
    .slice(0, 12);

  if (!name && !username && !password && !url) return null;
  return { name, username, password, url, notes, category, tags };
}

function parseKeePassXml(content: string): ImportedCredentialPayload[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid KeePass XML.');
  }

  const entries = Array.from(doc.querySelectorAll('Entry'));
  return entries
    .map((entry) => {
      const fields = Array.from(entry.querySelectorAll('String'));
      const data: Record<string, string> = {};
      fields.forEach((field) => {
        const key = field.querySelector('Key')?.textContent?.trim() || '';
        const value = field.querySelector('Value')?.textContent || '';
        if (key) data[key] = value;
      });
      const groupName =
        entry.parentElement?.querySelector(':scope > Name')?.textContent?.trim() || 'Imported';
      return toCredential({
        name: data.Title || data.Name,
        username: data.UserName || data.Username,
        password: data.Password,
        url: data.URL || data.Url,
        notes: data.Notes,
        category: groupName,
        tags: ['imported', 'keepass'],
      });
    })
    .filter((item): item is ImportedCredentialPayload => Boolean(item));
}

function parseKeePassCsv(content: string): ImportedCredentialPayload[] {
  const rows = parseCsv(content);
  if (rows.length < 2) return [];
  const map = headerIndexMap(rows[0]);
  return rows
    .slice(1)
    .map((row) =>
      toCredential({
        name: cell(row, map, 'title', 'name', 'account'),
        username: cell(row, map, 'username', 'user_name', 'user', 'login'),
        password: cell(row, map, 'password', 'pass', 'passwd'),
        url: cell(row, map, 'url', 'web_site', 'website', 'login_uri'),
        notes: cell(row, map, 'notes', 'note', 'comments', 'comment'),
        category: cell(row, map, 'group', 'category', 'folder') || 'Imported',
        tags: ['imported', 'keepass'],
      }),
    )
    .filter((item): item is ImportedCredentialPayload => Boolean(item));
}

function parseChromeCsv(content: string): ImportedCredentialPayload[] {
  const rows = parseCsv(content);
  if (rows.length < 2) return [];
  const map = headerIndexMap(rows[0]);
  const looksLikeChrome =
    'name' in map && 'url' in map && 'username' in map && 'password' in map;
  if (!looksLikeChrome && !('login_uri' in map)) {
    // Still attempt common browser export column names
  }
  return rows
    .slice(1)
    .map((row) =>
      toCredential({
        name: cell(row, map, 'name', 'title', 'account'),
        username: cell(row, map, 'username', 'user_name', 'user', 'login'),
        password: cell(row, map, 'password', 'pass'),
        url: cell(row, map, 'url', 'website', 'web_site', 'origin'),
        notes: cell(row, map, 'note', 'notes'),
        category: 'Browser Import',
        tags: ['imported', 'chrome'],
      }),
    )
    .filter((item): item is ImportedCredentialPayload => Boolean(item));
}

function parseVaultwardenCsv(content: string): ImportedCredentialPayload[] {
  const rows = parseCsv(content);
  if (rows.length < 2) return [];
  const map = headerIndexMap(rows[0]);
  return rows
    .slice(1)
    .map((row) => {
      const type = cell(row, map, 'type').toLowerCase();
      if (type && type !== 'login' && type !== '') return null;
      return toCredential({
        name: cell(row, map, 'name', 'title'),
        username: cell(row, map, 'login_username', 'username'),
        password: cell(row, map, 'login_password', 'password'),
        url: cell(row, map, 'login_uri', 'uri', 'url'),
        notes: cell(row, map, 'notes', 'note'),
        category: cell(row, map, 'folder', 'collection', 'group') || 'Imported',
        tags: ['imported', 'vaultwarden'],
      });
    })
    .filter((item): item is ImportedCredentialPayload => Boolean(item));
}

function parseBitwardenJson(content: string): ImportedCredentialPayload[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Invalid Bitwarden JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Bitwarden JSON must be an object.');
  }

  const root = parsed as {
    encrypted?: boolean;
    items?: unknown[];
    folders?: Array<{ id?: string; name?: string }>;
  };

  if (root.encrypted) {
    throw new Error(
      'Encrypted Bitwarden exports are not supported. Export again with “Export as JSON” (unencrypted) while unlocked.',
    );
  }

  const folderNames = new Map<string, string>();
  (root.folders || []).forEach((folder) => {
    if (folder?.id && folder.name) folderNames.set(folder.id, folder.name);
  });

  const items = Array.isArray(root.items) ? root.items : [];
  return items
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null;
      const item = raw as {
        type?: number;
        name?: string;
        notes?: string;
        folderId?: string | null;
        login?: {
          uris?: Array<{ uri?: string }>;
          username?: string;
          password?: string;
        };
        fields?: Array<{ name?: string; value?: string }>;
      };
      // Bitwarden type 1 = login
      if (item.type !== undefined && item.type !== 1) return null;
      const url = item.login?.uris?.map((u) => u.uri).filter(Boolean).join('\n') || '';
      const extraFields = (item.fields || [])
        .map((field) => `${field.name || 'field'}: ${field.value || ''}`)
        .join('\n');
      const notes = [item.notes || '', extraFields].filter(Boolean).join('\n\n');
      return toCredential({
        name: item.name,
        username: item.login?.username,
        password: item.login?.password,
        url,
        notes,
        category: (item.folderId && folderNames.get(item.folderId)) || 'Imported',
        tags: ['imported', 'bitwarden'],
      });
    })
    .filter((item): item is ImportedCredentialPayload => Boolean(item));
}

function parseOnePasswordJson(content: string): ImportedCredentialPayload[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    // 1PIF-style: one JSON object per line
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('{'));
    if (lines.length === 0) throw new Error('Invalid 1Password export.');
    parsed = { items: lines.map((line) => JSON.parse(line)) };
  }

  const root = parsed as { items?: unknown[]; accounts?: unknown[] };
  const items = Array.isArray(root.items)
    ? root.items
    : Array.isArray(parsed)
      ? parsed
      : [];

  return items
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null;
      const item = raw as {
        title?: string;
        name?: string;
        category?: string;
        notesPlain?: string;
        secureContents?: {
          fields?: Array<{ designation?: string; name?: string; value?: string }>;
          notesPlain?: string;
          URLs?: Array<{ url?: string }>;
        };
        details?: {
          fields?: Array<{ designation?: string; name?: string; value?: string }>;
          notesPlain?: string;
        };
        overview?: { title?: string; url?: string; URLs?: Array<{ url?: string }> };
      };

      const fields = item.secureContents?.fields || item.details?.fields || [];
      const username =
        fields.find((f) => f.designation === 'username')?.value ||
        fields.find((f) => /user|login|email/i.test(f.name || ''))?.value ||
        '';
      const password =
        fields.find((f) => f.designation === 'password')?.value ||
        fields.find((f) => /pass/i.test(f.name || ''))?.value ||
        '';
      const url =
        item.overview?.url ||
        item.overview?.URLs?.[0]?.url ||
        item.secureContents?.URLs?.[0]?.url ||
        '';
      const notes =
        item.notesPlain || item.secureContents?.notesPlain || item.details?.notesPlain || '';

      return toCredential({
        name: item.title || item.name || item.overview?.title,
        username,
        password,
        url,
        notes,
        category: item.category || 'Imported',
        tags: ['imported', '1password'],
      });
    })
    .filter((item): item is ImportedCredentialPayload => Boolean(item));
}

function detectFormat(filename: string, content: string): Exclude<VaultImportFormatId, 'auto'> {
  const lower = filename.toLowerCase();
  const trimmed = content.trim();

  if (lower.endsWith('.xml') || trimmed.startsWith('<?xml') || trimmed.includes('<KeePassFile')) {
    return 'keepass-xml';
  }

  if (lower.endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as { items?: unknown; encrypted?: boolean; accounts?: unknown };
      if (parsed && typeof parsed === 'object' && ('items' in parsed || 'encrypted' in parsed)) {
        return 'bitwarden-json';
      }
      if (parsed && typeof parsed === 'object' && ('accounts' in parsed || Array.isArray(parsed))) {
        return 'onepassword-json';
      }
    } catch {
      // fall through
    }
    if (lower.includes('1password') || lower.endsWith('.1pif')) return 'onepassword-json';
    return 'bitwarden-json';
  }

  // CSV detection via header row
  const firstLine = content.split(/\r?\n/)[0]?.toLowerCase() || '';
  if (firstLine.includes('login_uri') || firstLine.includes('login_username')) {
    return 'vaultwarden-csv';
  }
  if (
    firstLine.includes('group') &&
    firstLine.includes('title') &&
    firstLine.includes('username')
  ) {
    return 'keepass-csv';
  }
  if (firstLine.includes('name') && firstLine.includes('url') && firstLine.includes('password')) {
    return 'chrome-csv';
  }
  if (lower.includes('keepass')) return 'keepass-csv';
  if (lower.includes('chrome') || lower.includes('edge')) return 'chrome-csv';
  return 'vaultwarden-csv';
}

export function processVaultImportFile(
  content: string,
  filename: string,
  format: VaultImportFormatId = 'auto',
): ImportedCredentialPayload[] {
  const resolved = format === 'auto' ? detectFormat(filename, content) : format;

  let items: ImportedCredentialPayload[];
  switch (resolved) {
    case 'chrome-csv':
      items = parseChromeCsv(content);
      break;
    case 'bitwarden-json':
      items = parseBitwardenJson(content);
      break;
    case 'keepass-csv':
      items = parseKeePassCsv(content);
      break;
    case 'keepass-xml':
      items = parseKeePassXml(content);
      break;
    case 'onepassword-json':
      items = parseOnePasswordJson(content);
      break;
    case 'vaultwarden-csv':
      items = parseVaultwardenCsv(content);
      break;
    default:
      throw new Error('Unsupported import format.');
  }

  if (items.length === 0) {
    throw new Error('No importable login entries found in this file.');
  }
  return items;
}

/** @deprecated Use processVaultImportFile */
export function processVaultImport(
  content: string,
  filename: string,
): ImportedCredentialPayload[] {
  return processVaultImportFile(content, filename, 'auto');
}
