/**
 * Collection-level authorization for the generic POST /api/db router.
 * Unknown or sensitive collections are denied by default.
 */

export const DB_BLOCKED_COLLECTIONS = new Set([
  'vault_item_secrets',
  'vault_items',
  'geist_vault_portfolios',
]);

export const DB_ADMIN_ONLY_COLLECTIONS = new Set([
  'roles',
  'module_config',
  'audits',
  'admins',
  'groups',
]);

/** Append-only logs: agents may write, only admins may read or mutate. */
export const DB_APPEND_ONLY_LOG_COLLECTIONS = new Set([
  'audit_logs',
  'compliance_logs',
]);

/** Collections any authenticated user may read/write (subject to per-collection rules). */
export const DB_AUTHENTICATED_COLLECTIONS = new Set([
  'tickets',
  'users',
  'kb_articles',
  'tags',
  'kb_relationships',
  'kb_trust_scores',
  'customers',
  'companies',
  'contacts',
  'notifications',
  'notification_templates',
  'autopilot_suggestions',
  'vaults',
  'kb_coverage',
]);

export type DbAction = 'get_doc' | 'get_docs' | 'add_doc' | 'update_doc' | 'set_doc' | 'delete_doc';

export interface DbAccessContext {
  collection: string;
  action: DbAction;
  userIsAdmin: boolean;
  userId?: string;
  docId?: string;
}

export function assertDbCollectionAccess(ctx: DbAccessContext): { allowed: true } | { allowed: false; status: number; error: string } {
  const { collection, action, userIsAdmin } = ctx;

  if (DB_BLOCKED_COLLECTIONS.has(collection)) {
    return {
      allowed: false,
      status: 403,
      error: `Forbidden: Collection "${collection}" is not accessible through the generic database API.`,
    };
  }

  if (DB_ADMIN_ONLY_COLLECTIONS.has(collection)) {
    if (!userIsAdmin) {
      return {
        allowed: false,
        status: 403,
        error: `Forbidden: Strict Administrative access required for collection ${collection}`,
      };
    }
    return { allowed: true };
  }

  if (DB_APPEND_ONLY_LOG_COLLECTIONS.has(collection)) {
    if (action === 'add_doc') {
      return { allowed: true };
    }
    if (!userIsAdmin) {
      return {
        allowed: false,
        status: 403,
        error: `Forbidden: Strict Administrative access required for collection ${collection}`,
      };
    }
    return { allowed: true };
  }

  if (!DB_AUTHENTICATED_COLLECTIONS.has(collection)) {
    return {
      allowed: false,
      status: 403,
      error: `Forbidden: Collection "${collection}" is not registered for generic database access.`,
    };
  }

  // audit_logs / compliance_logs handled above.

  void action;
  return { allowed: true };
}
