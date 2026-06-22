import { cn } from '../../lib/utils';

/** Shared CSS grid templates — header and rows must use the same class. */
export const TICKET_TABLE_GRID_SUPPORT =
  'grid items-center gap-x-3 grid-cols-[36px_150px_minmax(240px,1fr)_120px_100px_140px_120px_50px]';

export const TICKET_TABLE_GRID_DEVELOPER =
  'grid items-center gap-x-3 grid-cols-[36px_120px_minmax(160px,1fr)_88px_88px_minmax(120px,1fr)_108px_92px_128px_108px_48px]';

export function getTicketTableGridClass(isDeveloperWorkspace: boolean): string {
  return isDeveloperWorkspace ? TICKET_TABLE_GRID_DEVELOPER : TICKET_TABLE_GRID_SUPPORT;
}

export function getTicketTableMinWidth(isDeveloperWorkspace: boolean): string {
  return isDeveloperWorkspace ? 'min-w-[1120px]' : 'min-w-[920px]';
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
