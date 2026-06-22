import { Ticket } from '../types';

export type AppWorkspace = 'support' | 'developer';
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
  return tickets.filter((t) =>
    workspace === 'support' ? isSupportTicket(t) : isBugTicket(t),
  );
}

export function getLinkedBugTicket(ticket: Ticket, allTickets: Ticket[]): Ticket | undefined {
  const bugId =
    ticket.linkedBugId ??
    ticket.linkedTicketIds?.find((id) => {
      const linked = allTickets.find((t) => t.id === id);
      return linked && isBugTicket(linked);
    });
  return bugId ? allTickets.find((t) => t.id === bugId) : undefined;
}

export function getLinkedSupportTickets(ticket: Ticket, allTickets: Ticket[]): Ticket[] {
  const ids = new Set<string>([
    ...(ticket.linkedTicketIds ?? []),
    ...allTickets.filter((t) => t.linkedBugId === ticket.id || t.masterTicketId === ticket.id).map((t) => t.id),
  ]);
  return allTickets.filter((t) => ids.has(t.id) && isSupportTicket(t) && t.id !== ticket.id);
}

export function devStatusLabelKey(status?: DevStatus | string): string {
  switch (status) {
    case 'in_dev':
      return 'tickets.devStatus.inDev';
    case 'qa':
      return 'tickets.devStatus.qa';
    case 'merged':
      return 'tickets.devStatus.merged';
    default:
      return 'tickets.devStatus.backlog';
  }
}
