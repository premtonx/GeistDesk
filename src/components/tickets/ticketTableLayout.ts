import { cn } from '../../lib/utils';

/** Support workspace — customer-centric columns */
export const TICKET_TABLE_GRID_SUPPORT =
  'grid items-center gap-x-3 grid-cols-[36px_150px_minmax(240px,1fr)_120px_100px_140px_120px_50px]';

export function getTicketTableGridClass(): string {
  return TICKET_TABLE_GRID_SUPPORT;
}

export function getTicketTableMinWidth(): string {
  return 'min-w-[920px]';
}

export const TICKET_TABLE_HEADER_CELL =
  'font-extrabold text-[11px] text-muted-foreground uppercase tracking-wider text-left truncate';

export const TICKET_TABLE_ROW_BASE =
  'hover:bg-muted/60 cursor-pointer group transition-colors duration-150 border-l-2 border-transparent py-1.5 min-h-[36px]';

export function ticketTableRowClass(selected: boolean): string {
  return cn(
    TICKET_TABLE_ROW_BASE,
    selected && 'bg-primary/5 hover:bg-primary/10 border-l-primary',
  );
}
