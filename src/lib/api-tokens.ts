/**
 * GeistDesk API tokens for machine clients (MCP, integrations).
 * Tokens are stored hashed (SHA-256); the plaintext is shown once at creation.
 */

import { createHash, randomBytes } from 'crypto';
import {
  addDocDirect,
  getDocDirect,
  getDocsDirect,
  updateDocDirect,
} from './postgres-backend.js';

export const API_TOKENS_COLLECTION = 'api_tokens';

export const MCP_SCOPES = [
  'mcp:connect',
  'geistkb:read',
  'geistkb:write',
  'tickets:read',
  'tickets:write',
  'vault:read',
  'vault:reveal',
] as const;

export type McpScope = (typeof MCP_SCOPES)[number];

export const ALL_MCP_SCOPES: McpScope[] = [...MCP_SCOPES];

export const DEFAULT_AGENT_SCOPES: McpScope[] = [
  'mcp:connect',
  'geistkb:read',
  'tickets:read',
  'tickets:write',
  'vault:read',
];

export const DEFAULT_ADMIN_SCOPES: McpScope[] = [...ALL_MCP_SCOPES];

const TOKEN_PREFIX = 'gdk_';

export interface ApiTokenRecord {
  id: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  userId: string;
  userEmail: string;
  role: string;
  scopes: McpScope[];
  tenantId: string;
  createdAt: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
}

export interface ApiTokenPublic {
  id: string;
  name: string;
  tokenPrefix: string;
  userId: string;
  userEmail: string;
  role: string;
  scopes: McpScope[];
  tenantId: string;
  createdAt: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
}

export interface CreatedApiToken extends ApiTokenPublic {
  /** Plaintext token — returned only once at creation. */
  token: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function normalizeScopes(scopes: unknown): McpScope[] {
  if (!Array.isArray(scopes)) return [];
  const allowed = new Set<string>(MCP_SCOPES);
  return [...new Set(scopes.filter((s): s is McpScope => typeof s === 'string' && allowed.has(s)))];
}

export function toPublicApiToken(doc: ApiTokenRecord): ApiTokenPublic {
  return {
    id: doc.id,
    name: doc.name,
    tokenPrefix: doc.tokenPrefix,
    userId: doc.userId,
    userEmail: doc.userEmail,
    role: doc.role,
    scopes: normalizeScopes(doc.scopes),
    tenantId: doc.tenantId || 'default',
    createdAt: doc.createdAt,
    lastUsedAt: doc.lastUsedAt ?? null,
    expiresAt: doc.expiresAt ?? null,
    revokedAt: doc.revokedAt ?? null,
  };
}

export function scopesForRole(role: string): McpScope[] {
  if (role === 'SYSTEM_ADMIN' || role === 'admin') return [...DEFAULT_ADMIN_SCOPES];
  return [...DEFAULT_AGENT_SCOPES];
}

export function hasScope(scopes: readonly string[] | undefined, required: McpScope): boolean {
  if (!scopes || scopes.length === 0) return false;
  return scopes.includes(required);
}

export function mintApiTokenPlaintext(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
}

export async function createApiToken(params: {
  name: string;
  userId: string;
  userEmail: string;
  role: string;
  scopes?: McpScope[];
  tenantId?: string;
  expiresAt?: string | null;
}): Promise<CreatedApiToken> {
  const name = String(params.name || '').trim().slice(0, 120) || 'MCP token';
  const scopes = normalizeScopes(params.scopes?.length ? params.scopes : scopesForRole(params.role));
  if (!scopes.includes('mcp:connect')) {
    scopes.unshift('mcp:connect');
  }

  const token = mintApiTokenPlaintext();
  const now = new Date().toISOString();
  const record = await addDocDirect(API_TOKENS_COLLECTION, {
    name,
    tokenHash: hashToken(token),
    tokenPrefix: token.slice(0, 12),
    userId: params.userId,
    userEmail: params.userEmail,
    role: params.role,
    scopes,
    tenantId: params.tenantId || 'default',
    createdAt: now,
    lastUsedAt: null,
    expiresAt: params.expiresAt ?? null,
    revokedAt: null,
  });

  const publicToken = toPublicApiToken({ id: record.id, ...record } as ApiTokenRecord);
  return { ...publicToken, token };
}

export async function listApiTokensForUser(userId: string): Promise<ApiTokenPublic[]> {
  const rows = await getDocsDirect(API_TOKENS_COLLECTION, [
    { type: 'where', field: 'userId', op: '==', value: userId },
  ]);
  return rows
    .map((row) => toPublicApiToken(row as ApiTokenRecord))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function listAllApiTokens(): Promise<ApiTokenPublic[]> {
  const rows = await getDocsDirect(API_TOKENS_COLLECTION, []);
  return rows
    .map((row) => toPublicApiToken(row as ApiTokenRecord))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function revokeApiToken(id: string): Promise<boolean> {
  const existing = await getDocDirect(API_TOKENS_COLLECTION, id);
  if (!existing) return false;
  await updateDocDirect(API_TOKENS_COLLECTION, id, {
    revokedAt: new Date().toISOString(),
  });
  return true;
}

export interface VerifiedApiToken {
  tokenId: string;
  userId: string;
  userEmail: string;
  role: string;
  scopes: McpScope[];
  tenantId: string;
  name: string;
}

/**
 * Verify a raw Bearer token against hashed api_tokens records.
 * Returns null when the token is unknown, revoked, or expired.
 */
export async function verifyApiToken(rawToken: string): Promise<VerifiedApiToken | null> {
  const token = String(rawToken || '').trim();
  if (!token.startsWith(TOKEN_PREFIX) || token.length < 20) return null;

  const tokenHash = hashToken(token);
  const rows = await getDocsDirect(API_TOKENS_COLLECTION, [
    { type: 'where', field: 'tokenHash', op: '==', value: tokenHash },
  ]);
  const match = rows[0] as ApiTokenRecord | undefined;
  if (!match) return null;
  if (match.revokedAt) return null;
  if (match.expiresAt && new Date(match.expiresAt).getTime() < Date.now()) return null;

  void updateDocDirect(API_TOKENS_COLLECTION, match.id, {
    lastUsedAt: new Date().toISOString(),
  }).catch(() => undefined);

  return {
    tokenId: match.id,
    userId: match.userId,
    userEmail: match.userEmail,
    role: match.role,
    scopes: normalizeScopes(match.scopes),
    tenantId: match.tenantId || 'default',
    name: match.name,
  };
}
