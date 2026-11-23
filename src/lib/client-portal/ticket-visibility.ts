/**
 * Organization-scoped ticket visibility and internal-comment stripping
 * for client portal roles.
 */

import {
  isClientOrgWideTicketRole,
  isClientPortalRole,
} from './roles.js';
import { isTicketParticipant, listTicketIdsForParticipant } from './ticket-participants.js';

export interface ClientSessionContext {
  id: string;
  role: string;
  organizationId: string | null;
}

/** Resolve organization id exclusively from the authenticated session. */
export function resolveOrganizationIdFromUser(
  user?: Express.UserContext | null,
): string | null {
  if (!user) return null;
  const fromCtx =
    typeof (user as { organizationId?: string }).organizationId === 'string'
      ? String((user as { organizationId?: string }).organizationId).trim()
      : '';
  if (fromCtx) return fromCtx;
  const record = user.dbRecord as Record<string, unknown> | undefined;
  if (!record) return null;
  const raw =
    (typeof record.organizationId === 'string' && record.organizationId.trim()) ||
    (typeof record.organization_id === 'string' && record.organization_id.trim()) ||
    '';
  return raw || null;
}

export function ticketOrganizationId(
  ticket: Record<string, unknown> | null | undefined,
): string | null {
  if (!ticket) return null;
  const raw =
    (typeof ticket.organizationId === 'string' && ticket.organizationId.trim()) ||
    (typeof ticket.organization_id === 'string' && ticket.organization_id.trim()) ||
    '';
  return raw || null;
}

export function ticketRequesterId(
  ticket: Record<string, unknown> | null | undefined,
): string | null {
  if (!ticket) return null;
  const raw =
    (typeof ticket.requesterId === 'string' && ticket.requesterId.trim()) ||
    (typeof ticket.requester_id === 'string' && ticket.requester_id.trim()) ||
    (typeof ticket.creatorId === 'string' && ticket.creatorId.trim()) ||
    (typeof ticket.createdBy === 'string' && ticket.createdBy.trim()) ||
    '';
  return raw || null;
}

export function isInternalMessage(msg: Record<string, unknown> | null | undefined): boolean {
  if (!msg) return false;
  if (msg.is_internal === true || msg.isInternal === true) return true;
  if (msg.visibility === 'internal' || msg.channel === 'internal') return true;
  if (msg.senderType === 'internal' || msg.type === 'internal_note') return true;
  return false;
}

/** Hubcom-only fields that must never appear in client portal ticket payloads. */
export const CLIENT_HIDDEN_TICKET_FIELDS = [
  'internalNotes',
  'internal_notes',
  'agentComments',
  'agent_comments',
  'aiSuggestedDraft',
  'aiDraftRaw',
  'aiCritiqueLog',
  'aiSummary',
  'aiInsights',
  'aiRootCause',
  'aiChecklist',
  'aiSentiment',
  'sanitizedAiContext',
] as const;

/** Strip internal notes / Hubcom analysis from a ticket payload for client responses. */
export function sanitizeTicketForClient<T extends Record<string, unknown>>(
  ticket: T,
): T {
  const clone = { ...ticket } as Record<string, unknown>;
  for (const field of CLIENT_HIDDEN_TICKET_FIELDS) {
    delete clone[field];
  }
  return clone as T;
}

/** Drop messages marked internal — never leak to client portal roles. */
export function filterMessagesForClient<T extends Record<string, unknown>>(
  messages: T[],
): T[] {
  return messages.filter((m) => !isInternalMessage(m));
}

/**
 * Pure visibility evaluator (no I/O) — used by clientCanViewTicket and tests.
 * `isParticipant` must be resolved by the caller for CLIENT_USER non-requesters.
 */
export function evaluateClientTicketVisibility(
  user: ClientSessionContext,
  ticket: Record<string, unknown>,
  opts?: { isParticipant?: boolean },
): boolean {
  if (!isClientPortalRole(user.role)) return false;
  if (!user.organizationId) return false;

  const orgId = ticketOrganizationId(ticket);
  if (!orgId || orgId !== user.organizationId) return false;

  if (isClientOrgWideTicketRole(user.role)) return true;

  // CLIENT_USER: requester or explicit participant only.
  const requester = ticketRequesterId(ticket);
  if (requester && requester === user.id) return true;
  return Boolean(opts?.isParticipant);
}

/**
 * Can this client-portal user see the ticket at all?
 * Staff callers should not use this — they use tenant/staff paths.
 */
export async function clientCanViewTicket(
  user: ClientSessionContext,
  ticket: Record<string, unknown>,
): Promise<boolean> {
  if (!isClientPortalRole(user.role) || !user.organizationId) return false;
  const orgId = ticketOrganizationId(ticket);
  if (!orgId || orgId !== user.organizationId) return false;
  if (isClientOrgWideTicketRole(user.role)) return true;

  const requester = ticketRequesterId(ticket);
  if (requester && requester === user.id) return true;
  const isParticipant = await isTicketParticipant(String(ticket.id || ''), user.id);
  return evaluateClientTicketVisibility(user, ticket, { isParticipant });
}

export async function clientCanMutateTicket(
  user: ClientSessionContext,
  ticket: Record<string, unknown>,
): Promise<boolean> {
  // Same visibility gate for Phase 1 (reply / close / participants).
  return clientCanViewTicket(user, ticket);
}

/** Filter a ticket list for a client-portal session. */
export async function filterTicketsForClient(
  user: ClientSessionContext,
  tickets: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  if (!isClientPortalRole(user.role) || !user.organizationId) return [];

  const orgTickets = tickets.filter((t) => ticketOrganizationId(t) === user.organizationId);

  if (isClientOrgWideTicketRole(user.role)) {
    return orgTickets.map((t) => sanitizeTicketForClient(t));
  }

  const participantIds = new Set(await listTicketIdsForParticipant(user.id));
  return orgTickets
    .filter((t) => {
      const requester = ticketRequesterId(t);
      if (requester && requester === user.id) return true;
      return participantIds.has(String(t.id || ''));
    })
    .map((t) => sanitizeTicketForClient(t));
}

/** Fields client roles must never set from the request body (anti-spoof). */
export const CLIENT_SPOOF_FIELDS = [
  'organizationId',
  'organization_id',
  'tenantId',
  'tenant_id',
  'role',
  'roleId',
  'is_admin',
  'isAdmin',
  'is_internal',
  'isInternal',
  'agentComments',
  'agent_comments',
  'internalNotes',
  'internal_notes',
  'aiSummary',
  'aiInsights',
  'aiRootCause',
  'aiChecklist',
  'aiSentiment',
] as const;

export function stripClientSpoofFields<T extends Record<string, unknown>>(
  data: T | null | undefined,
): T {
  const clone = { ...(data || {}) } as Record<string, unknown>;
  for (const field of CLIENT_SPOOF_FIELDS) {
    delete clone[field];
  }
  return clone as T;
}
