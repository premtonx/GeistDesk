/**
 * Credential import pipeline — KeePass XML/CSV, 1Password JSON, Vaultwarden CSV
 * Maps external schemas into native GeistVault asset structures.
 */

export type VaultImportFormat = 'keepass-xml' | 'keepass-csv' | '1password-json' | 'vaultwarden-csv';

export interface VaultImportEntry {
  type: string;
  label: string;
  username: string;
  password: string;
  host?: string;
  notes?: string;
  tags?: string[];
}

export interface VaultImportResult {
  format: VaultImportFormat;
  entries: VaultImportEntry[];
  skipped: number;
  warnings: string[];
}

const HEADER_ALIASES: Record<string, string[]> = {
  label: ['title', 'name', 'entry', 'account', 'label', 'site'],
  username: ['username', 'user', 'login', 'email', 'userid'],
  password: ['password', 'pass', 'secret', 'pwd'],
  url: ['url', 'uri', 'website', 'host', 'login_uri', 'login url'],
  notes: ['notes', 'note', 'comment', 'comments', 'description', 'extra'],
  group: ['group', 'folder', 'category', 'collection'],
  otp: ['otp', 'totp', 'otpauth'],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_\s-]+/g, '');
}

function resolveField(row: Record<string, string>, field: keyof typeof HEADER_ALIASES): string {
  const keys = Object.keys(row);
  for (const alias of HEADER_ALIASES[field]) {
    const match = keys.find((k) => normalizeHeader(k) === normalizeHeader(alias));
    if (match && row[match]?.trim()) return row[match].trim();
  }
  return '';
}

function inferTypeFromGroup(group: string, url: string): string {
  const g = group.toLowerCase();
  const u = url.toLowerCase();
  if (g.includes('ssh') || u.startsWith('ssh://')) return 'ssh';
  if (g.includes('api') || g.includes('token')) return 'api';
  if (g.includes('database') || g.includes('db')) return 'db';
  if (g.includes('server') || g.includes('rdp') || u.startsWith('rdp://')) return 'rdp';
  if (g.includes('cloud') || u.includes('aws') || u.includes('azure')) return 'cloud';
  if (g.includes('license') || g.includes('cert')) return 'cert';
  if (g.includes('slack')) return 'slack';
  if (g.includes('k8s') || g.includes('kubernetes')) return 'k8s';
  return 'web';
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function csvRowsToEntries(rows: Record<string, string>[], warnings: string[]): VaultImportEntry[] {
  const entries: VaultImportEntry[] = [];
  for (const row of rows) {
    const label = resolveField(row, 'label');
    const username = resolveField(row, 'username');
    const password = resolveField(row, 'password');
    if (!label && !username) continue;
    const url = resolveField(row, 'url');
    const notes = resolveField(row, 'notes');
    const group = resolveField(row, 'group');
    entries.push({
      type: inferTypeFromGroup(group, url),
      label: label || username || 'Imported Entry',
      username: username || '',
      password: password || '',
      host: url || undefined,
      notes: notes || undefined,
      tags: group ? [group] : undefined,
    });
  }
  if (entries.length === 0) warnings.push('No valid rows found in CSV.');
  return entries;
}

function parseKeePassXml(content: string, warnings: string[]): VaultImportEntry[] {
  const entries: VaultImportEntry[] = [];
  const entryBlocks = content.match(/<Entry>[\s\S]*?<\/Entry>/gi) || [];
  for (const block of entryBlocks) {
    const getString = (key: string) => {
      const re = new RegExp(`<String>\\s*<Key>${key}</Key>\\s*<Value>([\\s\\S]*?)</Value>\\s*</String>`, 'i');
      const m = block.match(re);
      return m ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim() : '';
    };
    const label = getString('Title');
    const username = getString('UserName');
    const password = getString('Password');
    const url = getString('URL');
    const notes = getString('Notes');
    if (!label && !username) continue;
    entries.push({
      type: inferTypeFromGroup('', url),
      label: label || username,
      username,
      password,
      host: url || undefined,
      notes: notes || undefined,
    });
  }
  if (entryBlocks.length === 0) warnings.push('No KeePass <Entry> nodes found in XML.');
  return entries;
}

function parse1PasswordJson(content: string, warnings: string[]): VaultImportEntry[] {
  const entries: VaultImportEntry[] = [];
  try {
    const data = JSON.parse(content);
    const items: any[] = Array.isArray(data) ? data : data.items || data.accounts || [];
    for (const item of items) {
      const label = item.title || item.name || item.overview?.title || '';
      const fields: any[] = item.fields || item.secureContents?.fields || item.login?.fields || [];
      let username = '';
      let password = '';
      let url = '';
      let notes = item.notesPlain || item.notes || '';
      for (const f of fields) {
        const designation = (f.designation || f.type || f.name || '').toString().toLowerCase();
        const value = f.value || f.v || '';
        if (designation.includes('username') || designation === 'T') username = value;
        if (designation.includes('password') || designation === 'P') password = value;
        if (designation.includes('website') || designation === 'U') url = value;
      }
      if (!username && item.login?.username) username = item.login.username;
      if (!password && item.login?.password) password = item.login.password;
      if (!url && item.urls?.[0]?.url) url = item.urls[0].url;
      if (!label && !username) continue;
      entries.push({
        type: inferTypeFromGroup(item.category || '', url),
        label: label || username,
        username,
        password,
        host: url || undefined,
        notes: notes || undefined,
        tags: item.tags || undefined,
      });
    }
  } catch {
    warnings.push('Failed to parse 1Password JSON structure.');
  }
  return entries;
}

export function detectImportFormat(filename: string, content: string): VaultImportFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.xml') || content.trimStart().startsWith('<?xml') || content.includes('<KeePassFile')) {
    return 'keepass-xml';
  }
  if (lower.endsWith('.json') || content.trimStart().startsWith('{') || content.trimStart().startsWith('[')) {
    return '1password-json';
  }
  if (lower.includes('vaultwarden') || lower.includes('bitwarden')) {
    return 'vaultwarden-csv';
  }
  if (lower.endsWith('.csv') || content.includes(',')) {
    const firstLine = content.split(/\r?\n/)[0]?.toLowerCase() ?? '';
    if (firstLine.includes('login_uri') || firstLine.includes('collection')) return 'vaultwarden-csv';
    return 'keepass-csv';
  }
  return null;
}

export function processVaultImport(filename: string, content: string): VaultImportResult {
  const warnings: string[] = [];
  const format = detectImportFormat(filename, content);
  if (!format) {
    return { format: 'keepass-csv', entries: [], skipped: 0, warnings: ['Unsupported or unrecognized import format.'] };
  }

  let entries: VaultImportEntry[] = [];
  switch (format) {
    case 'keepass-xml':
      entries = parseKeePassXml(content, warnings);
      break;
    case 'keepass-csv':
      entries = csvRowsToEntries(parseCsv(content), warnings);
      break;
    case 'vaultwarden-csv':
      entries = csvRowsToEntries(parseCsv(content), warnings);
      break;
    case '1password-json':
      entries = parse1PasswordJson(content, warnings);
      break;
  }

  const valid = entries.filter((e) => e.label || e.username);
  const skipped = entries.length - valid.length;

  return { format, entries: valid, skipped, warnings };
}
