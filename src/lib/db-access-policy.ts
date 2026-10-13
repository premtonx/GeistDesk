/**
 * Collection-level authorization for the generic POST /api/db router.
 * Unknown or sensitive collections are denied by default.
 */

export const DB_BLOCKED_COLLECTIONS = new Set([
  'vault_item_secrets',
  'vault_items',
  'geist_vault_portfolios',
  'geist_vault_encrypted_stores',
  'geist_vault_user_public_keys',
]);

export const DB_ADMIN_ONLY_COLLECTIONS = new Set([
  'roles',
  'module_config',
  'audits',
  'admins',
  'groups',
  'exchange_analytics_cache',
]);

/** Append-only logs: agents may write, only admins may read or mutate. */
export const DB_APPEND_ONLY_LOG_COLLECTIONS = new Set([
  'audit_logs',
  'compliance_logs',
  'exchange_audit_log',
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
  'kb_coverage',
  'kb_article_history',
  'kb_categories',
  'kb_settings',
  'platform_analytics',
  // Workspace defaults read by schemaService (contact/company field schemas).
  'settings',
  'contact_schemas',
]);

/**
 * Collections whose documents are bound to a single owning user.
 *
 * Non-admin access is scoped to the caller's uid for every action:
 *  - `get_doc` / `update_doc` / `set_doc` / `delete_doc` only succeed when the
 *    existing document's `ownerField` matches the caller.
 *  - `get_docs` is constrained server-side to the caller's ownership field.
 *  - `add_doc` auto-stamps `ownerField` from the verified session uid — any
 *    client-supplied ownership value is overwritten.
 *
 * `createOwnerFrom` names a source payload field whose value is copied into
 * `ownerField` on create *after* being checked against the caller's uid (used
 * when the client already tracks ownership under a different key, e.g.
 * `notifications.userId`). When absent, `ownerField` is stamped directly with
 * the caller's uid.
 */
export const DB_OWNER_SCOPED_COLLECTIONS: Record<string, { ownerField: string; createOwnerFrom?: string }> = {
  notifications: { ownerField: 'userId', createOwnerFrom: 'userId' },
};

/**
 * Shared team collections whose documents remain readable by all
 * authenticated users (tenant-scoped), but where mutation is restricted to
 * admins or the document owner. Reads are never owner-filtered so
 * collaborative features (e.g. reviewing autopilot suggestions) keep working.
 *
 * `add_doc` always stamps `ownerField` from the verified session uid.
 */
export const DB_WRITE_OWNER_OR_ADMIN_COLLECTIONS: Record<string, { ownerField: string }> = {
  autopilot_suggestions: { ownerField: 'ownerId' },
};

export function getOwnerScope(collection: string): { ownerField: string; createOwnerFrom?: string } | null {
  return DB_OWNER_SCOPED_COLLECTIONS[collection] ?? null;
}

export function getWriteScope(collection: string): { ownerField: string } | null {
  return DB_WRITE_OWNER_OR_ADMIN_COLLECTIONS[collection] ?? null;
}

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
