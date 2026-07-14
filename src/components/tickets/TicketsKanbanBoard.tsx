import React, { useMemo, useState } from 'react';
import { Ticket as TicketType } from '../../types';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { TicketStatusChip, TicketPriorityChip } from './TicketTableCells';
import {
  KANBAN_LANES,
  kanbanLaneToTicketStatus,
  normalizeKanbanStatus,
  type KanbanLaneId,
} from '../../lib/ticket-kanban-status';

interface TicketsKanbanBoardProps {
  tickets: TicketType[];
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: TicketType['status']) => void;
  onPriorityChange: (id: string, priority: TicketType['priority']) => void;
}

export function TicketsKanbanBoard({
  tickets,
  onSelect,
  onStatusChange,
  onPriorityChange,
}: TicketsKanbanBoardProps) {
  const { t } = useTranslation();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<KanbanLaneId | null>(null);

  const ticketsByLane = useMemo(() => {
    const buckets: Record<KanbanLaneId, TicketType[]> = {
      offen: [],
      in_bearbeitung: [],
      geloest: [],
    };
    for (const ticket of tickets) {
      const lane = normalizeKanbanStatus(ticket.status);
      buckets[lane].push(ticket);
    }
    return buckets;
  }, [tickets]);

  const handleDropOnLane = (lane: KanbanLaneId) => {
    if (!draggingId) return;
    const nextStatus = kanbanLaneToTicketStatus(lane);
    const ticket = tickets.find((tk) => tk.id === draggingId);
    // Avoid no-op writes when the ticket already belongs to this lane.
    if (!ticket || normalizeKanbanStatus(ticket.status) === lane) {
      setDraggingId(null);
      setDropTarget(null);
      return;
    }
    onStatusChange(draggingId, nextStatus);
    setDraggingId(null);
    setDropTarget(null);
  };

  return (
    <div className="flex gap-3 p-4 min-h-[400px] overflow-x-auto">
      {KANBAN_LANES.map((col) => {
        const items = ticketsByLane[col.id];
        const isDropActive = dropTarget === col.id;
        return (
          <div
            key={col.id}
            className={cn(
              'flex-1 min-w-[240px] max-w-[320px] flex flex-col rounded-xl bg-slate-50/80 border border-slate-200/80 transition-colors',
              isDropActive && 'border-blue-400 bg-blue-50/40 ring-2 ring-blue-200/60',
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDropTarget(col.id);
            }}
            onDragLeave={() => {
              if (dropTarget === col.id) setDropTarget(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDropOnLane(col.id);
            }}
          >
            <div className="px-3 py-2 border-b border-slate-200/80 flex items-center gap-2">
              <span className={cn('h-2 w-2 rounded-full', col.dot)} />
              <span className="text-xs font-semibold text-slate-700">
                {t(col.labelKey, col.defaultLabel)}
              </span>
              <span className="text-[10px] font-medium text-slate-400 tabular-nums">({items.length})</span>
            </div>
            <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-280px)]">
              {items.length === 0 ? (
                <p className="text-[10px] text-slate-400 font-medium px-1 py-6 text-center">
                  {t('tickets.kanban.emptyLane', 'No tickets in this lane')}
                </p>
              ) : null}
              {items.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', ticket.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggingId(ticket.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDropTarget(null);
                  }}
                  onClick={() => onSelect(ticket.id)}
                  className={cn(
                    'w-full text-left rounded-lg border border-slate-200/80 bg-white p-3 shadow-sm hover:border-blue-200 hover:shadow transition-all cursor-grab active:cursor-grabbing',
                    draggingId === ticket.id && 'opacity-50',
                  )}
                >
                  <p className="text-xs font-semibold text-slate-900 line-clamp-2">{ticket.subject}</p>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">
                    {t('tickets.ticketIdShort', '#{{id}}').replace(
                      '{{id}}',
                      ticket.id.slice(0, 8).toUpperCase(),
                    )}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 truncate">{ticket.customerName}</p>
                  <div
                    className="flex flex-wrap items-center gap-2 mt-2"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
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
