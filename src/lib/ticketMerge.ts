import type { Ticket } from '../types';

const TERMINAL_MERGE_STATUSES = new Set([
  'merged',
  'closed',
  'resolved',
  'deleted',
  'trash',
  'spam',
]);

function extractEmail(raw: unknown): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim().toLowerCase();
  const angle = trimmed.match(/<([^>]+)>/);
  const email = (angle?.[1] || trimmed).trim();
  return email.includes('@') ? email : '';
}

/**
 * Stable identity for "same customer" merge checks.
 * Prefers email, then contactId, then customerId — never display name alone.
 */
export function getTicketCustomerKey(ticket: Ticket): string {
  const email =
    extractEmail(ticket.customerEmail) ||
    extractEmail(ticket.from_email) ||
    extractEmail(ticket.customerId);
  if (email) return `email:${email}`;

  const contactId = typeof ticket.contactId === 'string' ? ticket.contactId.trim() : '';
  if (contactId) return `contact:${contactId}`;

  const customerId = typeof ticket.customerId === 'string' ? ticket.customerId.trim() : '';
  if (customerId) return `customer:${customerId.toLowerCase()}`;

  const name = typeof ticket.customerName === 'string' ? ticket.customerName.trim().toLowerCase() : '';
  if (name) return `name:${name}`;

  return '';
}

export function ticketsShareCustomer(tickets: Ticket[]): boolean {
  if (tickets.length < 2) return false;
  const keys = tickets.map(getTicketCustomerKey);
  if (keys.some((key) => !key)) return false;
  return keys.every((key) => key === keys[0]);
}

export function isMergeableOpenTicket(ticket: Ticket): boolean {
  const status = String(ticket.status ?? '').toLowerCase().trim();
  return !TERMINAL_MERGE_STATUSES.has(status);
}

export function formatTicketShortRef(id: string): string {
  return `#${id.slice(-5).toUpperCase()}`;
}

export function sameCustomerOpenTickets(current: Ticket, allTickets: Ticket[]): Ticket[] {
  const currentKey = getTicketCustomerKey(current);
  if (!currentKey) return [];
  return allTickets.filter((other) => {
    if (other.id === current.id) return false;
    if (!isMergeableOpenTicket(other)) return false;
    return getTicketCustomerKey(other) === currentKey;
  });
}
