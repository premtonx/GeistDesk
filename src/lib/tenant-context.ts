/**
 * Session-derived tenant isolation helpers.
 * Tenant identity MUST come from the authenticated user record — never from
 * client body/query parameters alone.
 */

import type { Request } from 'express';

export const DEFAULT_TENANT_ID = 'default';

/** Document collections that must be scoped to the caller's tenant. */
export const TENANT_SCOPED_COLLECTIONS = new Set([
  'tickets',
  'kb_articles',
  'kb_relationships',
  'kb_trust_scores',
  'kb_coverage',
  'kb_article_history',
  'kb_categories',
  'kb_settings',
  'customers',
  'companies',
  'contacts',
  'tags',
  'notifications',
  'notification_templates',
  'autopilot_suggestions',
  'platform_analytics',
]);

/**
 * Resolve tenantId exclusively from the verified session / DB user record.
 * Client-supplied body/query values are intentionally ignored.
 */
export function resolveTenantFromRequest(req: Request | { user?: Express.UserContext }): string {
  const user = (req as { user?: Express.UserContext & { tenantId?: string } }).user;
  if (!user) return DEFAULT_TENANT_ID;

  const fromUser = typeof user.tenantId === 'string' ? user.tenantId.trim() : '';
  if (fromUser) return fromUser;

  const record = user.dbRecord as Record<string, unknown> | undefined;
  if (record) {
    const fromRecord =
      (typeof record.tenantId === 'string' && record.tenantId.trim()) ||
      (typeof record.tenant_id === 'string' && record.tenant_id.trim()) ||
      (typeof record.workspaceId === 'string' && record.workspaceId.trim()) ||
      '';
    if (fromRecord) return fromRecord;
  }

  return DEFAULT_TENANT_ID;
}

/** Normalize a stored document's tenant (legacy docs without tenantId → default). */
export function documentTenantId(doc: Record<string, unknown> | null | undefined): string {
  if (!doc) return DEFAULT_TENANT_ID;
  const raw = doc.tenantId ?? doc.tenant_id ?? doc.workspaceId;
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value || DEFAULT_TENANT_ID;
}

/** True when the document belongs to the session tenant (or is legacy-unscoped → default). */
export function documentBelongsToTenant(
  doc: Record<string, unknown> | null | undefined,
  tenantId: string,
): boolean {
  return documentTenantId(doc) === (tenantId || DEFAULT_TENANT_ID);
}

/** Stamp / overwrite tenantId on outgoing write payloads. */
export function stampTenantId<T extends Record<string, unknown>>(
  data: T | null | undefined,
  tenantId: string,
): T {
  const base = { ...(data || {}) } as T;
  (base as Record<string, unknown>).tenantId = tenantId || DEFAULT_TENANT_ID;
  delete (base as Record<string, unknown>).tenant_id;
  return base;
}
