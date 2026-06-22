import React from 'react';
import { Ticket as TicketType } from '../../types';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { TicketStatusChip, TicketPriorityChip } from './TicketTableCells';

interface TicketsKanbanBoardProps {
  tickets: TicketType[];
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: TicketType['status']) => void;
  onPriorityChange: (id: string, priority: TicketType['priority']) => void;
}

const COLUMNS = [
  { id: 'open', status: 'open', dot: 'bg-blue-500' },
  { id: 'pending', status: 'pending', dot: 'bg-violet-500' },
  { id: 'resolved', status: 'resolved', dot: 'bg-emerald-500' },
] as const;

export function TicketsKanbanBoard({
  tickets,
  onSelect,
  onStatusChange,
  onPriorityChange,
}: TicketsKanbanBoardProps) {
  const { t } = useTranslation();

  return (
    <div className="flex gap-3 p-4 min-h-[400px] overflow-x-auto">
      {COLUMNS.map((col) => {
        const items = tickets.filter((tk) => (tk.status ?? 'open').toLowerCase() === col.status);
        return (
          <div key={col.id} className="flex-1 min-w-[240px] max-w-[320px] flex flex-col rounded-xl bg-slate-50/80 border border-slate-200/80">
            <div className="px-3 py-2 border-b border-slate-200/80 flex items-center gap-2">
              <span className={cn('h-2 w-2 rounded-full', col.dot)} />
              <span className="text-xs font-semibold text-slate-700 capitalize">
                {t(`tickets.status.${col.status}`, col.status)}
              </span>
              <span className="text-[10px] font-medium text-slate-400 tabular-nums">({items.length})</span>
            </div>
            <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-280px)]">
              {items.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => onSelect(ticket.id)}
                  className="w-full text-left rounded-lg border border-slate-200/80 bg-white p-3 shadow-sm hover:border-blue-200 hover:shadow transition-all"
                >
                  <p className="text-xs font-semibold text-slate-900 line-clamp-2">{ticket.subject}</p>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">
                    {t('tickets.ticketIdShort', '#{{id}}').replace('{{id}}', ticket.id.slice(0, 8).toUpperCase())}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 truncate">{ticket.customerName}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                    <TicketStatusChip
                      status={ticket.status ?? 'open'}
                      onChange={(s) => onStatusChange(ticket.id, s)}
                    />
                    <TicketPriorityChip
                      priority={ticket.priority ?? 'medium'}
                      onChange={(p) => onPriorityChange(ticket.id, p)}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
