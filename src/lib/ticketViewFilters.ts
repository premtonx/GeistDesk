import { Ticket } from '../types';
import { getLinkedSupportTickets, isBugTicket } from './ticketWorkspace';
import {
  type CustomTicketView,
  customViewId,
  isCustomViewId,
  matchesCustomViewFilters,
} from './ticketsSidebarPreferences';

export type TopStatusFilterId =
  | 'all'
  | 'open'
  | 'pending'
  | 'onhold'
  | 'urgent'
  | 'unassigned';

export const matchStatus = (status: string | undefined, target: string): boolean => {
  if (!status) return false;
  return status.toLowerCase().trim() === target.toLowerCase().trim();
};

export const matchStatusNot = (status: string | undefined, target: string): boolean => {
  if (!status) return true;
  return status.toLowerCase().trim() !== target.toLowerCase().trim();
};

export const hasTagCaseInsensitive = (tags: string[] | undefined, target: string): boolean => {
  if (!tags) return false;
  return tags.some((tag) => tag.toLowerCase().trim() === target.toLowerCase().trim());
};

export interface TicketViewFilterContext {
  userId: string;
  watchedTicketIds: string[];
  allTickets: Ticket[];
  isAiReady: boolean;
  customViews?: CustomTicketView[];
}

export function isActiveSupportTicket(ticket: Ticket): boolean {
  return (
    matchStatusNot(ticket.status, 'trash') &&
    matchStatusNot(ticket.status, 'spam') &&
    matchStatusNot(ticket.status, 'merged')
  );
}

export function isTeamAllOpenTicket(ticket: Ticket): boolean {
  return (
    matchStatusNot(ticket.status, 'resolved') &&
    matchStatusNot(ticket.status, 'closed') &&
    matchStatusNot(ticket.status, 'trash') &&
    matchStatusNot(ticket.status, 'spam') &&
    matchStatusNot(ticket.status, 'merged')
  );
}

export function isUnassignedTicket(ticket: Ticket): boolean {
  return (
    !ticket.agentId &&
    matchStatusNot(ticket.status, 'resolved') &&
    matchStatusNot(ticket.status, 'closed') &&
    matchStatusNot(ticket.status, 'trash') &&
    matchStatusNot(ticket.status, 'spam') &&
    matchStatusNot(ticket.status, 'merged')
  );
}

export function isNewTicket(ticket: Ticket): boolean {
  return matchStatus(ticket.status, 'open') && !ticket.agentId;
}

export function isWaitingReviewTicket(ticket: Ticket): boolean {
  return (
    (ticket.aiConfidence !== undefined && ticket.aiConfidence < 0.7) ||
    matchStatus(ticket.status, 'pending') ||
    ((!ticket.tags || ticket.tags.length === 0) &&
      matchStatusNot(ticket.status, 'resolved') &&
      matchStatusNot(ticket.status, 'closed'))
  );
}

export function isHelpRequestedTicket(ticket: Ticket): boolean {
  return ticket.isHelpRequested === true && isActiveSupportTicket(ticket);
}

export function isVipCustomerTicket(ticket: Ticket): boolean {
  return (
    (ticket as { customerTier?: string }).customerTier === 'VIP' ||
    ticket.priority === 'urgent' ||
    hasTagCaseInsensitive(ticket.tags, 'VIP') ||
    ticket.customerName?.toLowerCase().includes('sarah') === true
  );
}

export function isEscalationTicket(ticket: Ticket): boolean {
  return (
    matchStatus(ticket.status, 'open') &&
    (ticket.priority === 'urgent' ||
      ticket.priority === 'high' ||
      hasTagCaseInsensitive(ticket.tags, 'Escalation'))
  );
}

export function isSlaRiskTicket(ticket: Ticket): boolean {
  return (
    matchStatusNot(ticket.status, 'resolved') &&
    matchStatusNot(ticket.status, 'closed') &&
    matchStatusNot(ticket.status, 'trash') &&
    matchStatusNot(ticket.status, 'spam') &&
    (ticket.priority === 'urgent' ||
      (typeof ticket.aiConfidence === 'number' && ticket.aiConfidence < 0.5) ||
      hasTagCaseInsensitive(ticket.tags, 'SLA_Risk'))
  );
}

export function isUrgentPriorityTicket(ticket: Ticket): boolean {
  return ticket.priority === 'urgent' || ticket.priority === 'high';
}

export function isOnHoldTicket(ticket: Ticket): boolean {
  return (
    matchStatus(ticket.status, 'on-hold') ||
    matchStatus(ticket.status, 'on_hold') ||
    matchStatus(ticket.status, 'paused')
  );
}

export function isPausedTicket(ticket: Ticket): boolean {
  return isOnHoldTicket(ticket);
}

export function isQsTicket(ticket: Ticket): boolean {
  return matchStatus(ticket.status, 'qs');
}

export function isWaitingCustomerTicket(ticket: Ticket): boolean {
  return matchStatus(ticket.status, 'waiting_customer');
}

export function isWaitingDevTicket(ticket: Ticket): boolean {
  return matchStatus(ticket.status, 'waiting_dev');
}

export function isWaitingVendorTicket(ticket: Ticket): boolean {
  return matchStatus(ticket.status, 'waiting_vendor');
}

export function isDueTodayTicket(ticket: Ticket, userId: string): boolean {
  if (ticket.agentId !== userId) return false;
  const due = ticket.slaDueAt || ticket.firstResponseDue;
  if (!due) return false;
  const dueDate = due.toDate ? due.toDate() : new Date(due as unknown as string);
  const today = new Date();
  return (
    dueDate.toDateString() === today.toDateString() &&
    matchStatusNot(ticket.status, 'resolved') &&
    matchStatusNot(ticket.status, 'closed')
  );
}

export function isWaitingMyResponseTicket(ticket: Ticket, userId: string): boolean {
  return (
    ticket.agentId === userId &&
    (matchStatus(ticket.status, 'open') || matchStatus(ticket.status, 'pending')) &&
    matchStatusNot(ticket.status, 'resolved') &&
    matchStatusNot(ticket.status, 'closed')
  );
}

export function isNegativeSentimentTicket(ticket: Ticket): boolean {
  return ticket.sentiment === 'angry' || ticket.sentiment === 'negative';
}

export function isPotentialEscalationTicket(ticket: Ticket): boolean {
  return (
    isNegativeSentimentTicket(ticket) &&
    (ticket.priority === 'urgent' || ticket.priority === 'high' || isEscalationTicket(ticket))
  );
}

export function isDuplicateTicket(ticket: Ticket, allTickets: Ticket[]): boolean {
  const subject = ticket.subject?.toLowerCase().trim();
  if (!subject) return false;
  return allTickets.some(
    (other) => other.id !== ticket.id && other.subject?.toLowerCase().trim() === subject,
  );
}

export function isKbSuggestionTicket(ticket: Ticket): boolean {
  return (
    (typeof ticket.aiConfidence === 'number' && ticket.aiConfidence >= 0.7) ||
    hasTagCaseInsensitive(ticket.tags, 'KB_Candidate') ||
    hasTagCaseInsensitive(ticket.tags, 'KB_Suggestion')
  );
}

export function isVipRequestTicket(ticket: Ticket): boolean {
  return isVipCustomerTicket(ticket) && isTeamAllOpenTicket(ticket);
}

function filterByStatusValue(tickets: Ticket[], status: string): Ticket[] {
  switch (status) {
    case 'open':
      return tickets.filter((t) => matchStatus(t.status, 'open'));
    case 'pending':
      return tickets.filter((t) => matchStatus(t.status, 'pending'));
    case 'paused':
      return tickets.filter(isPausedTicket);
    case 'qs':
      return tickets.filter(isQsTicket);
    case 'waiting_customer':
      return tickets.filter((t) => matchStatus(t.status, 'waiting_customer'));
    case 'waiting_dev':
      return tickets.filter(isWaitingDevTicket);
    case 'waiting_vendor':
      return tickets.filter(isWaitingVendorTicket);
    case 'resolved':
      return tickets.filter((t) => matchStatus(t.status, 'resolved'));
    case 'closed':
      return tickets.filter((t) => matchStatus(t.status, 'closed'));
    default:
      return tickets.filter((t) => matchStatus(t.status, status));
  }
}

/** Sidebar view predicates — single source of truth for counts and table pools. */
export function filterTicketsByView(
  tickets: Ticket[],
  viewId: string,
  ctx: TicketViewFilterContext,
): Ticket[] {
  const { userId, watchedTicketIds, allTickets, isAiReady, customViews = [] } = ctx;

  if (isCustomViewId(viewId)) {
    const custom = customViews.find((v) => customViewId(v) === viewId);
    if (!custom) return [];
    return tickets.filter((t) => matchesCustomViewFilters(t, custom.filters, userId));
  }

  switch (viewId) {
    case 'team_all_open':
      return tickets.filter(isTeamAllOpenTicket);
    case 'unassigned':
      return tickets.filter(isUnassignedTicket);
    case 'new_tickets':
      return tickets.filter(isNewTicket);
    case 'waiting_review':
      return tickets.filter(isWaitingReviewTicket);
    case 'help_requested':
    case 'agent_seeking_help':
      return tickets.filter(isHelpRequestedTicket);
    case 'vip_customers':
      return tickets.filter(isVipCustomerTicket);
    case 'escalations':
      return tickets.filter(isEscalationTicket);
    case 'sla_risk':
      return tickets.filter(isSlaRiskTicket);
    case 'assigned_me':
      return tickets.filter(
        (t) =>
          t.agentId === userId &&
          matchStatusNot(t.status, 'resolved') &&
          matchStatusNot(t.status, 'closed') &&
          matchStatusNot(t.status, 'trash') &&
          matchStatusNot(t.status, 'spam'),
      );
    case 'due_today':
      return tickets.filter((t) => isDueTodayTicket(t, userId));
    case 'waiting_my_response':
      return tickets.filter((t) => isWaitingMyResponseTicket(t, userId));
    case 'my_paused':
      return tickets.filter((t) => t.agentId === userId && isPausedTicket(t));
    case 'my_qs':
      return tickets.filter((t) => t.agentId === userId && isQsTicket(t));
    case 'status_open':
      return filterByStatusValue(tickets, 'open');
    case 'status_pending':
      return filterByStatusValue(tickets, 'pending');
    case 'status_paused':
      return filterByStatusValue(tickets, 'paused');
    case 'status_qs':
      return filterByStatusValue(tickets, 'qs');
    case 'status_waiting_customer':
      return tickets.filter(isWaitingCustomerTicket);
    case 'status_waiting_dev':
      return filterByStatusValue(tickets, 'waiting_dev');
    case 'status_waiting_vendor':
      return filterByStatusValue(tickets, 'waiting_vendor');
    case 'status_resolved':
      return filterByStatusValue(tickets, 'resolved');
    case 'status_closed':
      return filterByStatusValue(tickets, 'closed');
    case 'negative_sentiment':
      return tickets.filter(isNegativeSentimentTicket);
    case 'potential_escalations':
      return tickets.filter(isPotentialEscalationTicket);
    case 'duplicates_detected':
      return tickets.filter((t) => isDuplicateTicket(t, allTickets));
    case 'kb_suggestion':
      return tickets.filter(isKbSuggestionTicket);
    case 'vip_requests':
      return tickets.filter(isVipRequestTicket);
    case 'my_queue':
      return tickets.filter(
        (t) =>
          t.agentId === userId &&
          matchStatusNot(t.status, 'resolved') &&
          matchStatusNot(t.status, 'closed') &&
          matchStatusNot(t.status, 'trash') &&
          matchStatusNot(t.status, 'spam'),
      );
    case 'linked_bugs':
      return tickets.filter(
        (t) => isBugTicket(t) && getLinkedSupportTickets(t, allTickets).length > 0,
      );
    case 'bug_backlog':
      return tickets.filter((t) => isBugTicket(t) && (!t.devStatus || t.devStatus === 'backlog'));
    case 'incidents':
      return tickets.filter(
        (t) =>
          isBugTicket(t) &&
          (t.priority === 'urgent' ||
            hasTagCaseInsensitive(t.tags, 'incident') ||
            hasTagCaseInsensitive(t.tags, 'Incident')),
      );
    case 'ai_inbox':
      return tickets.filter(
        (t) =>
          t.aiConfidence !== undefined || t.sentiment === 'angry' || t.sentiment === 'negative',
      );
    case 'suggestions':
      return tickets.filter(
        (t) => isAiReady && matchStatusNot(t.status, 'resolved') && matchStatusNot(t.status, 'closed'),
      );
    case 'trend_analytics':
      return tickets.filter((t) => t.tags && t.tags.length > 1);
    case 'awaiting_triage':
      return tickets.filter(
        (t) =>
          (!t.tags || t.tags.length === 0) &&
          matchStatusNot(t.status, 'resolved') &&
          matchStatusNot(t.status, 'closed') &&
          matchStatusNot(t.status, 'trash') &&
          matchStatusNot(t.status, 'spam'),
      );
    case 'undelivered_msg':
      return tickets.filter((t) => t.isUndelivered && isActiveSupportTicket(t));
    case 'my_open':
      return tickets.filter(
        (t) =>
          t.agentId === userId &&
          (matchStatus(t.status, 'open') || matchStatus(t.status, 'pending')),
      );
    case 'assigned_me':
      return tickets.filter(
        (t) =>
          t.agentId === userId &&
          matchStatusNot(t.status, 'resolved') &&
          matchStatusNot(t.status, 'closed') &&
          matchStatusNot(t.status, 'trash') &&
          matchStatusNot(t.status, 'spam'),
      );
    case 'mentioned_me':
      return tickets.filter((t) => t.mentions?.includes(userId));
    case 'watching':
      return tickets.filter((t) => watchedTicketIds.includes(t.id));
    case 'waiting_customer':
      return tickets.filter((t) => t.agentId === userId && matchStatus(t.status, 'pending'));
    case 'recently_updated': {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return tickets.filter((t) => {
        const updatedAt = t.updatedAt?.toDate ? t.updatedAt.toDate() : new Date(t.updatedAt);
        return updatedAt > oneDayAgo;
      });
    }
    case 'team_pending':
      return tickets.filter((t) => matchStatus(t.status, 'pending'));
    case 'team_on_hold':
      return tickets.filter(
        (t) => matchStatus(t.status, 'pending') || matchStatus(t.status, 'on-hold'),
      );
    case 'resolved_today': {
      const todayStr = new Date().toDateString();
      return tickets.filter((t) => {
        if (!t.resolvedAt) return false;
        const resolvedAt = t.resolvedAt.toDate ? t.resolvedAt.toDate() : new Date(t.resolvedAt);
        return resolvedAt.toDateString() === todayStr;
      });
    }
    case 'closed_week': {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return tickets.filter((t) => {
        if (!t.closedAt) return false;
        const closedAt = t.closedAt.toDate ? t.closedAt.toDate() : new Date(t.closedAt);
        return closedAt > oneWeekAgo;
      });
    }
    case 'urgent_priority':
      return tickets.filter(
        (t) =>
          t.priority === 'urgent' &&
          matchStatusNot(t.status, 'resolved') &&
          matchStatusNot(t.status, 'closed'),
      );
    case 'high_priority':
      return tickets.filter(
        (t) =>
          t.priority === 'high' &&
          matchStatusNot(t.status, 'resolved') &&
          matchStatusNot(t.status, 'closed'),
      );
    case 'enterprise_accounts':
      return tickets.filter(
        (t) =>
          t.company?.toLowerCase().includes('advanced') ||
          t.company?.toLowerCase().includes('global') ||
          hasTagCaseInsensitive(t.tags, 'Enterprise'),
      );
    case 'escalated_tickets':
      return tickets.filter(
        (t) =>
          matchStatus(t.status, 'open') &&
          (t.priority === 'urgent' || hasTagCaseInsensitive(t.tags, 'Escalation')),
      );
    case 'ai_actions':
      return tickets.filter(
        (t) => isAiReady && matchStatusNot(t.status, 'resolved') && matchStatusNot(t.status, 'closed'),
      );
    case 'ai_review':
      return tickets.filter(
        (t) => (t.aiConfidence !== undefined && t.aiConfidence < 0.7) || t.priority === 'urgent',
      );
    case 'sentiment_alerts':
      return tickets.filter((t) => t.sentiment === 'angry' || t.sentiment === 'negative');
    case 'churn_risk':
      return tickets.filter(
        (t) => t.sentiment === 'angry' || (t.priority === 'urgent' && t.sentiment === 'negative'),
      );
    case 'similar_clusters':
      return tickets.filter((t) => t.tags && t.tags.length > 1);
    case 'kb_opportunities':
      return tickets.filter(
        (t) => matchStatus(t.status, 'resolved') && t.tags && t.tags.length > 0,
      );
    case 'missing_docs':
      return tickets.filter((t) => !t.tags || t.tags.length === 0);
    case 'automation_candidates':
      return tickets.filter(
        (t) =>
          t.channel === 'chat' ||
          hasTagCaseInsensitive(t.tags, 'login') ||
          hasTagCaseInsensitive(t.tags, 'auth'),
      );
    case 'trash':
      return tickets.filter(
        (t) => matchStatus(t.status, 'trash') || matchStatus(t.status, 'deleted'),
      );
    case 'spam':
      return tickets.filter((t) => matchStatus(t.status, 'spam'));
    default:
      return tickets.filter(isActiveSupportTicket);
  }
}

export function countTicketsByView(
  tickets: Ticket[],
  viewId: string,
  ctx: TicketViewFilterContext,
): number {
  return filterTicketsByView(tickets, viewId, ctx).length;
}

/** Sub-tab filters applied on top of the active sidebar view pool. */
export function filterTicketsByTopStatus(
  tickets: Ticket[],
  filterId: TopStatusFilterId,
): Ticket[] {
  switch (filterId) {
    case 'open':
      return tickets.filter((t) => matchStatus(t.status, 'open'));
    case 'pending':
      return tickets.filter((t) => matchStatus(t.status, 'pending'));
    case 'onhold':
      return tickets.filter(isOnHoldTicket);
    case 'urgent':
      return tickets.filter(isUrgentPriorityTicket);
    case 'unassigned':
      return tickets.filter(isUnassignedTicket);
    case 'all':
    default:
      return tickets;
  }
}

export interface TicketQueueStats {
  all: number;
  open: number;
  pending: number;
  onhold: number;
  urgent: number;
  unassigned: number;
  vip: number;
  critical: number;
  slaRisk: number;
  bugs: number;
}

export function computeTicketQueueStats(pool: Ticket[]): TicketQueueStats {
  const activePool = pool.filter(isActiveSupportTicket);
  return {
    all: activePool.length,
    open: activePool.filter((t) => matchStatus(t.status, 'open')).length,
    pending: activePool.filter((t) => matchStatus(t.status, 'pending')).length,
    onhold: activePool.filter(isOnHoldTicket).length,
    urgent: activePool.filter(isUrgentPriorityTicket).length,
    unassigned: activePool.filter(isUnassignedTicket).length,
    vip: activePool.filter(isVipCustomerTicket).length,
    critical: activePool.filter(isUrgentPriorityTicket).length,
    slaRisk: activePool.filter(isSlaRiskTicket).length,
    bugs: activePool.filter((t) => isBugTicket(t)).length,
  };
}
