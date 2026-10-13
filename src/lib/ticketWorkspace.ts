import { Ticket } from '../types';

export type AppWorkspace = 'support' | 'developer' | 'ai_ops';
export type TicketKind = 'support' | 'bug';
export type DevStatus = 'backlog' | 'in_dev' | 'qa' | 'merged';

export function getTicketKind(ticket: Ticket): TicketKind {
  if (ticket.ticketKind === 'bug' || ticket.ticketKind === 'support') {
    return ticket.ticketKind;
  }
  if (
    ticket.team === 'engineering' ||
    ticket.type === 'problem' ||
    ticket.tags?.some((tag) => tag.toLowerCase() === 'bug')
  ) {
    return 'bug';
  }
  return 'support';
}

export function isSupportTicket(ticket: Ticket): boolean {
  return getTicketKind(ticket) === 'support';
}

export function isBugTicket(ticket: Ticket): boolean {
  return getTicketKind(ticket) === 'bug';
}

export function filterTicketsByWorkspace(tickets: Ticket[], workspace: AppWorkspace): Ticket[] {
  if (workspace === 'ai_ops') {
    return tickets.filter(
      (t) =>
        matchStatusNot(t.status, 'trash') &&
        matchStatusNot(t.status, 'spam') &&
        matchStatusNot(t.status, 'closed'),
    );
  }
  return tickets.filter((t) =>
    workspace === 'support' ? isSupportTicket(t) : isBugTicket(t),
  );
}

function matchStatusNot(status: string | undefined, target: string): boolean {
  if (!status) return true;
  return status.toLowerCase().trim() !== target.toLowerCase().trim();
}
