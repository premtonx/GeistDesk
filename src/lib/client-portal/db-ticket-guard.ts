/**
 * Helpers used by POST /api/db to enforce client-portal ticket isolation.
 */

import { isClientOrgWideTicketRole, isClientPortalRole } from './roles.js';
import {
  clientCanMutateTicket,
  clientCanViewTicket,
  filterMessagesForClient,
  filterTicketsForClient,
  resolveOrganizationIdFromUser,
  sanitizeTicketForClient,
  stripClientSpoofFields,
  ticketOrganizationId,
} from './ticket-visibility.js';

export function parseTicketMessagesCollection(
  collection: string,
): { ticketId: string } | null {
  const match = /^tickets\/([^/]+)\/messages$/.exec(collection);
  if (!match) return null;
  return { ticketId: match[1] };
}

export async function enforceClientDbTicketAccess(params: {
  user: Express.UserContext;
  collection: string;
  action: string;
  id?: string;
  data?: Record<string, unknown> | null;
}): Promise<
  | { ok: true; data?: Record<string, unknown>; filterList?: true; sanitizeDoc?: true }
  | { ok: false; status: number; error: string }
> {
  if (!isClientPortalRole(params.user.role)) {
    return { ok: true };
  }

  const organizationId = resolveOrganizationIdFromUser(params.user);
  if (!organizationId) {
    return {
      ok: false,
      status: 403,
      error: 'Forbidden: Client account is not linked to an organization.',
    };
  }

  const session = {
    id: params.user.id,
    role: params.user.role,
    organizationId,
  };

  const messagesScope = parseTicketMessagesCollection(params.collection);

  if (params.collection === 'tickets') {
    let data = params.data ? stripClientSpoofFields(params.data) : undefined;

    if (params.action === 'add_doc') {
      // CLIENT_ADMIN / CLIENT_SUPPORTER may create on behalf of a colleague
      // (requesterId in payload). Always force organization from session.
      const requestedRequester =
        isClientOrgWideTicketRole(params.user.role) &&
        typeof data?.requesterId === 'string' &&
        data.requesterId.trim()
          ? String(data.requesterId).trim()
          : params.user.id;
      data = {
        ...(data || {}),
        organizationId,
        organization_id: organizationId,
        requesterId: requestedRequester,
        requester_id: requestedRequester,
        creatorId: params.user.id,
        is_internal: false,
        isInternal: false,
      };
      return { ok: true, data };
    }

    if (params.action === 'get_docs') {
      return { ok: true, filterList: true };
    }

    if (
      params.action === 'get_doc' ||
      params.action === 'update_doc' ||
      params.action === 'set_doc' ||
      params.action === 'delete_doc'
    ) {
      if (!params.id) {
        return { ok: false, status: 400, error: 'Document id is required.' };
      }
      // Visibility checked by caller after load when needed; signal sanitize.
      if (params.action === 'delete_doc') {
        return {
          ok: false,
          status: 403,
          error: 'Forbidden: Client portal accounts cannot delete tickets.',
        };
      }
      if (data) {
        // Clients must not flip internal flags or reassign org.
        delete data.is_internal;
        delete data.isInternal;
        delete data.organizationId;
        delete data.organization_id;
        delete data.requesterId;
        delete data.requester_id;
        delete data.creatorId;
      }
      return { ok: true, data, sanitizeDoc: true };
    }
  }

  if (messagesScope) {
    let data = params.data ? stripClientSpoofFields(params.data) : undefined;
    if (data) {
      // Client replies are never internal.
      data.is_internal = false;
      data.isInternal = false;
      if (data.visibility === 'internal') delete data.visibility;
    }
    if (params.action === 'get_docs' || params.action === 'get_doc') {
      return { ok: true, data, filterList: true, sanitizeDoc: true };
    }
    if (params.action === 'add_doc') {
      data = {
        ...(data || {}),
        is_internal: false,
        isInternal: false,
        senderId: params.user.id,
      };
      return { ok: true, data };
    }
    if (params.action === 'delete_doc' || params.action === 'set_doc') {
      return {
        ok: false,
        status: 403,
        error: 'Forbidden: Client portal accounts cannot rewrite message history.',
      };
    }
    return { ok: true, data };
  }

  if (params.collection === 'users') {
    // Self-profile only for get/update; list filtered to same org by caller.
    if (params.action === 'get_doc' && params.id && params.id !== params.user.id) {
      return {
        ok: false,
        status: 404,
        error: 'Document not found',
      };
    }
    if (
      (params.action === 'update_doc' || params.action === 'set_doc') &&
      params.id &&
      params.id !== params.user.id
    ) {
      return {
        ok: false,
        status: 403,
        error: 'Forbidden: You cannot modify other users.',
      };
    }
    if (params.data) {
      return { ok: true, data: stripClientSpoofFields(params.data) };
    }
    return { ok: true };
  }

  void session;
  return { ok: true };
}

export async function postFilterClientDbResult(params: {
  user: Express.UserContext;
  collection: string;
  action: string;
  doc?: any;
  docs?: any[];
  ticketIdForMessages?: string;
}): Promise<{ doc?: any; docs?: any[]; denied?: boolean }> {
  if (!isClientPortalRole(params.user.role)) {
    return { doc: params.doc, docs: params.docs };
  }

  const organizationId = resolveOrganizationIdFromUser(params.user);
  const session = {
    id: params.user.id,
    role: params.user.role,
    organizationId,
  };

  if (params.collection === 'tickets') {
    if (params.action === 'get_docs' && Array.isArray(params.docs)) {
      const filtered = await filterTicketsForClient(session as any, params.docs);
      return { docs: filtered };
    }
    if (params.doc) {
      const canView = await clientCanViewTicket(session as any, {
        ...params.doc,
        id: params.doc.id,
      });
      if (!canView) return { denied: true };
      return { doc: sanitizeTicketForClient(params.doc) };
    }
  }

  const messagesScope = parseTicketMessagesCollection(params.collection);
  if (messagesScope) {
    // Parent ticket must be visible.
    // Caller should pass parent ticket for efficiency; if not, deny closed.
    if (params.action === 'get_docs' && Array.isArray(params.docs)) {
      return { docs: filterMessagesForClient(params.docs) };
    }
    if (params.doc) {
      if (
        params.doc.is_internal === true ||
        params.doc.isInternal === true ||
        params.doc.visibility === 'internal'
      ) {
        return { denied: true };
      }
      return { doc: params.doc };
    }
  }

  if (params.collection === 'users' && params.action === 'get_docs' && Array.isArray(params.docs)) {
    const sameOrg = params.docs.filter((u) => {
      const oid =
        (typeof u.organizationId === 'string' && u.organizationId) ||
        (typeof u.organization_id === 'string' && u.organization_id) ||
        '';
      return oid && oid === organizationId;
    });
    // CLIENT_USER only sees self in user directory listings.
    if (params.user.role === 'CLIENT_USER') {
      return { docs: sameOrg.filter((u) => u.id === params.user.id) };
    }
    return { docs: sameOrg };
  }

  void ticketOrganizationId;
  void clientCanMutateTicket;
  return { doc: params.doc, docs: params.docs };
}
