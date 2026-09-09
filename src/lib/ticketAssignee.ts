import type { Ticket } from '../types';

const UNASSIGNED_SENTINELS = new Set([
  '',
  'unassigned',
  'nicht-zugewiesen',
  'nicht zugewiesen',
  'nicht_zugewiesen',
]);

/** Pull a primitive id from a string or `{ id, uid, agentId }` object. */
export function scalarAssigneeId(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const nested = obj.id ?? obj.uid ?? obj.agentId ?? obj.assigneeId;
    return scalarAssigneeId(nested);
  }
  const id = String(val).trim();
  return UNASSIGNED_SENTINELS.has(id.toLowerCase()) ? '' : id;
}

export function scalarAssigneeName(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    return scalarAssigneeName(obj.name ?? obj.displayName ?? obj.label ?? obj.email);
  }
  const name = String(val).trim();
  return UNASSIGNED_SENTINELS.has(name.toLowerCase()) ? '' : name;
}

function norm(value: string): string {
  return value.trim().toLowerCase();
}

function identitySet(values: Array<string | null | undefined>): Set<string> {
  const set = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    const n = norm(value);
    if (!n || UNASSIGNED_SENTINELS.has(n)) continue;
    set.add(n);
  }
  return set;
}

export interface TicketAssigneeUser {
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
}

export function ticketAssigneeIds(ticket: Ticket): string[] {
  return [
    scalarAssigneeId(ticket.agentId),
    scalarAssigneeId(ticket.assigneeId),
    scalarAssigneeId(ticket.assignedTo),
    scalarAssigneeId(ticket.assignedToEmail),
  ].filter(Boolean);
}

/** Displayed assignee label — `assignedTo` is an id alias, not a name. */
export function ticketAssigneeNames(ticket: Ticket): string[] {
  return [scalarAssigneeName(ticket.agentName)].filter(Boolean);
}

export function hasAssignee(ticket: Ticket): boolean {
  return ticketAssigneeIds(ticket).length > 0 || ticketAssigneeNames(ticket).length > 0;
}

function displayedNameMatchesUser(displayed: string, user: TicketAssigneeUser): boolean {
  const n = norm(displayed);
  if (!n) return false;
  const names = identitySet([user.userName, user.userEmail]);
  if (names.has(n)) return true;

  const emailLocal = String(user.userEmail ?? '')
    .split('@')[0]
    ?.trim()
    .toLowerCase();
  if (emailLocal && emailLocal.length >= 3 && (n === emailLocal || n.startsWith(`${emailLocal} `))) {
    return true;
  }

  const userName = norm(user.userName || '');
  if (userName && (n === userName || n.startsWith(`${userName} `) || userName.startsWith(`${n} `))) {
    return true;
  }
  return false;
}

/**
 * True when this ticket belongs in "Mir zugewiesen" for the signed-in agent.
 * Matches assignee id/email against the current user, or the displayed
 * agentName against the current user's name. If the chip shows a different
 * person, the ticket is not treated as mine even when a stale agentId still
 * points at the current user.
 */
export function isTicketAssignedToUser(ticket: Ticket, user: TicketAssigneeUser): boolean {
  const userIds = identitySet([user.userId, user.userEmail]);
  const userNames = identitySet([user.userName, user.userEmail]);
  if (userIds.size === 0 && userNames.size === 0) return false;

  const ids = ticketAssigneeIds(ticket).map(norm);
  const displayedName = scalarAssigneeName(ticket.agentName);
  const idMatches = ids.some((id) => userIds.has(id));
  const nameMatches = displayedName ? displayedNameMatchesUser(displayedName, user) : false;

  if (displayedName && !nameMatches) {
    return false;
  }
  return idMatches || nameMatches;
}
