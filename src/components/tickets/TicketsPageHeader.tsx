import React from 'react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { MODULE_PAGE_PX } from '../ui/module-page/styles';
import { AppWorkspace } from '../../lib/ticketWorkspace';

interface MetaPillProps {
  dotClass: string;
  label: string;
}

function MetaPill({ dotClass, label }: MetaPillProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50/80 px-2.5 py-1 text-[11px] font-medium text-slate-600 shrink-0">
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotClass)} aria-hidden />
      {label}
    </span>
  );
}

export interface TicketsHeaderStats {
  open: number;
  slaRisk?: number;
  pending?: number;
  urgent?: number;
  bugs?: number;
  unassigned?: number;
}

interface TicketsPageHeaderProps {
  trailing?: React.ReactNode;
  className?: string;
  workspace?: AppWorkspace;
  stats?: TicketsHeaderStats;
}

export function TicketsPageHeader({
  trailing,
  className,
  workspace = 'support',
  stats,
}: TicketsPageHeaderProps) {
  const { t } = useTranslation();

  const metaLine = (() => {
    if (!stats) return null;
    if (workspace === 'developer') {
      return t('tickets.headerMetaDev', 'Tickets • {{open}} Open • {{bugs}} Bugs • {{unassigned}} Unassigned')
        .replace('{{open}}', String(stats.open))
        .replace('{{bugs}}', String(stats.bugs ?? 0))
        .replace('{{unassigned}}', String(stats.unassigned ?? 0));
    }
    if (workspace === 'ai_ops') {
      return t('tickets.headerMetaAiOps', 'AI Operations • {{open}} Active • {{slaRisk}} SLA Risk')
        .replace('{{open}}', String(stats.open))
        .replace('{{slaRisk}}', String(stats.slaRisk ?? 0));
    }
    return t('tickets.headerMetaSupport', 'Tickets • {{open}} Open • {{slaRisk}} SLA Risk')
      .replace('{{open}}', String(stats.open))
      .replace('{{slaRisk}}', String(stats.slaRisk ?? 0));
  })();

  return (
    <header
      className={cn(
        MODULE_PAGE_PX,
        'h-14 min-h-[3.5rem] max-h-14 flex items-center justify-between border-b border-slate-200/80 bg-white shrink-0',
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-wrap">
        <h1 className="text-base font-bold tracking-tight text-slate-900 shrink-0">
          {t('tickets.pageTitle', 'Tickets')}
        </h1>
        {metaLine ? (
          <p className="hidden sm:block text-[11px] font-semibold text-slate-500 truncate">{metaLine}</p>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
            <MetaPill dotClass="bg-blue-500" label={t('tickets.metaPillOpen', 'Open')} />
            <MetaPill dotClass="bg-orange-500" label={t('tickets.metaPillInProgress', 'In Progress')} />
            <MetaPill dotClass="bg-red-500" label={t('tickets.metaPillUrgent', 'Urgent')} />
          </div>
        )}
      </div>
      {trailing ? <div className="shrink-0 flex items-center gap-2">{trailing}</div> : null}
    </header>
  );
}
