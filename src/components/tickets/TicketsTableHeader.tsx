import React from 'react';
import { Checkbox } from '../ui/checkbox';
import { useTranslation } from '../../lib/context/I18nContext';
import { cn } from '../../lib/utils';
import {
  getTicketTableGridClass,
  TICKET_TABLE_HEADER_CELL,
} from './ticketTableLayout';

interface TicketsTableHeaderProps {
  isDeveloperWorkspace: boolean;
  headerCheckboxActive: boolean;
  onToggleSelectAll: () => void;
  className?: string;
}

export function TicketsTableHeader({
  isDeveloperWorkspace,
  headerCheckboxActive,
  onToggleSelectAll,
  className,
}: TicketsTableHeaderProps) {
  const { t } = useTranslation();
  const grid = getTicketTableGridClass(isDeveloperWorkspace);

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
          className="bg-card border-border"
        />
      </div>

      <div className={TICKET_TABLE_HEADER_CELL}>{t('tickets.table.customer', 'Customer').toUpperCase()}</div>
      <div className={TICKET_TABLE_HEADER_CELL}>{t('tickets.table.subjectPreview', 'Subject & Preview').toUpperCase()}</div>

      {isDeveloperWorkspace ? (
        <>
          <div className={TICKET_TABLE_HEADER_CELL}>{t('tickets.table.affectedVersion', 'Version').toUpperCase()}</div>
          <div className={TICKET_TABLE_HEADER_CELL}>{t('tickets.table.environment', 'Environment').toUpperCase()}</div>
          <div className={TICKET_TABLE_HEADER_CELL}>
            {t('tickets.table.stepsToReproduce', 'Steps to Reproduce').toUpperCase()}
          </div>
        </>
      ) : null}

      <div className={TICKET_TABLE_HEADER_CELL}>{t('tickets.table.status', 'Status').toUpperCase()}</div>
      <div className={TICKET_TABLE_HEADER_CELL}>{t('tickets.table.priority', 'Priority').toUpperCase()}</div>
      <div className={TICKET_TABLE_HEADER_CELL}>{t('tickets.table.assignee', 'Assignee').toUpperCase()}</div>
      <div className={TICKET_TABLE_HEADER_CELL}>{t('tickets.table.lastUpdate', 'Last Update').toUpperCase()}</div>
      <div className="justify-self-center" aria-hidden />
    </div>
  );
}
