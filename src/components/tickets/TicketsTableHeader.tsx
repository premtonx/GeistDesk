import React from 'react';
import { Checkbox } from '../ui/checkbox';
import { useTranslation } from '../../lib/context/I18nContext';
import { cn } from '../../lib/utils';
import {
  getTicketTableGridClass,
  TICKET_TABLE_HEADER_CELL,
} from './ticketTableLayout';

interface TicketsTableHeaderProps {
  headerCheckboxActive: boolean;
  onToggleSelectAll: () => void;
  className?: string;
}

export function TicketsTableHeader({
  headerCheckboxActive,
  onToggleSelectAll,
  className,
}: TicketsTableHeaderProps) {
  const { t } = useTranslation();
  const grid = getTicketTableGridClass();

  return (
    <div
      className={cn(
        grid,
        'px-4 h-9 bg-muted/80 border-b border-border sticky top-0 z-10',
        className,
      )}
    >
      <div className="justify-self-center">
        <Checkbox
          checked={headerCheckboxActive}
          onCheckedChange={onToggleSelectAll}
          className="bg-card border-border cursor-pointer"
          aria-label={t('tickets.table.selectAll', 'Alle auswählen')}
        />
      </div>

      <div className={TICKET_TABLE_HEADER_CELL}>{t('tickets.table.customer', 'Customer').toUpperCase()}</div>
      <div className={TICKET_TABLE_HEADER_CELL}>{t('tickets.table.subjectPreview', 'Subject & Preview').toUpperCase()}</div>
      <div className={TICKET_TABLE_HEADER_CELL}>{t('tickets.table.status', 'Status').toUpperCase()}</div>
      <div className={TICKET_TABLE_HEADER_CELL}>{t('tickets.table.priority', 'Priority').toUpperCase()}</div>
      <div className={TICKET_TABLE_HEADER_CELL}>{t('tickets.table.assignee', 'Assignee').toUpperCase()}</div>
      <div className={TICKET_TABLE_HEADER_CELL}>{t('tickets.table.lastUpdate', 'Last Update').toUpperCase()}</div>
      <div className="justify-self-center" aria-hidden />
    </div>
  );
}
