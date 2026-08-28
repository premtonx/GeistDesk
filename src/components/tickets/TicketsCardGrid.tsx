import React from 'react';
import { Mail, MessageSquare } from 'lucide-react';
import { Ticket as TicketType } from '../../types';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { TicketStatusChip, TicketPriorityChip, TicketAssigneeChip } from './TicketTableCells';

interface TicketsCardGridProps {
  tickets: TicketType[];
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: TicketType['status']) => void;
  onPriorityChange: (id: string, priority: TicketType['priority']) => void;
  onAssigneeChange: (id: string, agentId: string | null | undefined, agentName: string | null | undefined) => void;
  currentUserId?: string;
  currentUserLabel?: string;
  formatTicketRef: (id: string) => string;
}

export function TicketsCardGrid({
  tickets,
  onSelect,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  currentUserId,
  currentUserLabel,
  formatTicketRef,
}: TicketsCardGridProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
      {tickets.map((ticket) => {
        const channelIcon =
          ticket.channel === 'whatsapp' ? (
            <MessageSquare className="w-3 h-3 text-emerald-500 shrink-0" />
          ) : ticket.channel === 'chat' ? (
            <MessageSquare className="w-3 h-3 text-blue-500 shrink-0" />
          ) : (
            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
          );

        return (
          <button
            key={ticket.id}
            type="button"
            onClick={() => onSelect(ticket.id)}
            className="text-left rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm hover:border-blue-200 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <Avatar className="h-7 w-7 border border-slate-200 shrink-0">
                <AvatarFallback className="text-[10px] font-bold bg-slate-100 uppercase">
                  {ticket.customerName?.charAt(0) ?? 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 truncate">{ticket.customerName}</p>
                <p className="text-[10px] text-slate-500 truncate">{ticket.company ?? t('tickets.privateCustomer', 'Private')}</p>
              </div>
            </div>

            <p className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">{ticket.subject}</p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 font-medium font-mono">{formatTicketRef(ticket.id)}</span>
              {ticket.slaDueAt || ticket.firstResponseDue ? (
                <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-blue-100 bg-blue-50 text-blue-700">
                  SLA
                </span>
              ) : null}
              {channelIcon}
            </div>

            <div
              className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              <TicketStatusChip
                status={ticket.status ?? 'open'}
                onChange={(s) => onStatusChange(ticket.id, s)}
              />
              <TicketPriorityChip
                priority={ticket.priority ?? 'medium'}
                onChange={(p) => onPriorityChange(ticket.id, p)}
              />
              <TicketAssigneeChip
                agentId={ticket.agentId}
                agentName={ticket.agentName}
                currentUserId={currentUserId}
                currentUserLabel={currentUserLabel}
                onChange={(agentId, agentName) => onAssigneeChange(ticket.id, agentId, agentName)}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
