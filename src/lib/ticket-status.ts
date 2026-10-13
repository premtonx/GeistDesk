import type { TicketStatus } from '../types';

/** Statuses agents may pick in dispatch / table dropdowns. Merging is an action, not a status. */
export const SELECTABLE_TICKET_STATUSES: TicketStatus[] = [
  'open',
  'pending',
  'in_progress',
  'resolved',
  'closed',
  'qs',
];

export const READONLY_TERMINAL_STATUSES: ReadonlySet<string> = new Set(['merged']);

export function isReadonlyTerminalStatus(status: string | undefined | null): boolean {
  return READONLY_TERMINAL_STATUSES.has(String(status ?? '').toLowerCase().trim());
}

export function isSelectableTicketStatus(status: string | undefined | null): boolean {
  return SELECTABLE_TICKET_STATUSES.includes(String(status ?? '').toLowerCase().trim() as TicketStatus);
}
