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

function collectCustomerEmails(ticket: Ticket): Set<string> {
  const emails = [
    extractEmail(ticket.customerEmail),
    extractEmail(ticket.from_email),
    extractEmail(ticket.customerId),
  ].filter(Boolean);
  return new Set(emails);
}

function collectCustomerIds(ticket: Ticket): Set<string> {
  const ids = [ticket.customerId, ticket.contactId]
    .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
    .filter((value) => value && !value.includes('@'));
  return new Set(ids);
}

/**
 * Same customer if any identity overlaps (email, customerId, contactId, or name).
 * A single preferred key is too strict: one ticket may only have a name while
 * another for Jonas Weber has an email.
 */
export function ticketsAreSameCustomer(a: Ticket, b: Ticket): boolean {
  const emailsA = collectCustomerEmails(a);
  const emailsB = collectCustomerEmails(b);
  for (const email of emailsA) {
    if (emailsB.has(email)) return true;
  }

  const idsA = collectCustomerIds(a);
  const idsB = collectCustomerIds(b);
  for (const id of idsA) {
    if (idsB.has(id)) return true;
  }

  const nameA = typeof a.customerName === 'string' ? a.customerName.trim().toLowerCase() : '';
  const nameB = typeof b.customerName === 'string' ? b.customerName.trim().toLowerCase() : '';
  return Boolean(nameA && nameB && nameA === nameB);
}

export function ticketsShareCustomer(tickets: Ticket[]): boolean {
  if (tickets.length < 2) return false;
  return tickets.every((ticket) => ticketsAreSameCustomer(tickets[0], ticket));
}

export function isMergeableOpenTicket(ticket: Ticket): boolean {
  const status = String(ticket.status ?? '').toLowerCase().trim();
  return !TERMINAL_MERGE_STATUSES.has(status);
}

export function formatTicketShortRef(id: string): string {
  return formatTicketCode({ id });
}

/** Display badge like #TKT-013 from TKT-DEMO-SIM-013 / GD-SIM-013 / uuid. */
export function formatTicketCode(ticket: { id: string; customId?: string }): string {
  const custom = String(ticket.customId ?? '').trim().toUpperCase();
  const id = String(ticket.id ?? '').trim().toUpperCase();
  const source = custom || id;
  const digits = source.match(/(\d+)\s*$/);
  if (digits) return `#TKT-${digits[1]}`;
  if (id.startsWith('TKT')) return `#${id}`;
  return `#${id.slice(-5)}`;
}

function ticketSearchHaystack(ticket: Ticket): string {
  return [
    ticket.subject,
    ticket.id,
    ticket.customId,
    ticket.customerName,
    ticket.customerEmail,
    ticket.from_email,
    formatTicketCode(ticket),
  ]
    .map((value) => String(value ?? '').toLowerCase())
    .join(' ');
}

export function sameCustomerOpenTickets(current: Ticket, allTickets: Ticket[]): Ticket[] {
  return allTickets.filter((other) => {
    if (other.id === current.id) return false;
    if (!isMergeableOpenTicket(other)) return false;
    return ticketsAreSameCustomer(current, other);
  });
}

export function searchMergeCandidateTickets(
  current: Ticket,
  allTickets: Ticket[],
  query: string,
): Ticket[] {
  const q = query.trim().toLowerCase();
  const others = allTickets.filter(
    (other) => other.id !== current.id && isMergeableOpenTicket(other),
  );
  if (!q) {
    return sameCustomerOpenTickets(current, others);
  }
  const matched = others.filter((ticket) => ticketSearchHaystack(ticket).includes(q));
  matched.sort((a, b) => {
    const sameA = ticketsAreSameCustomer(current, a) ? 0 : 1;
    const sameB = ticketsAreSameCustomer(current, b) ? 0 : 1;
    if (sameA !== sameB) return sameA - sameB;
    return String(a.subject ?? '').localeCompare(String(b.subject ?? ''));
  });
  return matched;
}
