import React from 'react';
import { Button } from '../ui/button';
import { ModuleCreateButton } from '../ui/ModuleCreateButton';
import { useTranslation } from '../../lib/context/I18nContext';
import { cn } from '../../lib/utils';

interface TicketsEmptyStateProps {
  onViewUnassigned: () => void;
  onOpenAiSuggestions: () => void;
  onCreateTicket: () => void;
  className?: string;
}

export function TicketsEmptyState({
  onViewUnassigned,
  onOpenAiSuggestions,
  onCreateTicket,
  className,
}: TicketsEmptyStateProps) {
  const { t } = useTranslation();

  const stats = [
    { label: t('tickets.emptyState.resolvedToday', 'Resolved Today'), value: '12' },
    { label: t('tickets.emptyState.slaMet', 'SLA Met'), value: '100%' },
    { label: t('tickets.emptyState.csatScore', 'CSAT Score'), value: '96%' },
  ];

  return (
    <div
      className={cn(
        'mx-4 my-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden',
        className,
      )}
    >
      <div className="grid lg:grid-cols-[1fr_auto] gap-6 p-6 md:p-8">
        <div className="space-y-4 text-left">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
              {t('tickets.emptyState.title', '🎉 Queue Clear / In dieser Ansicht ist alles erledigt')}
            </h2>
            <p className="text-sm text-slate-500 mt-2 max-w-lg leading-relaxed">
              {t(
                'tickets.emptyState.subtitle',
                'No tickets currently require urgent human attention. Run automated audits or view recommendations.',
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onViewUnassigned}
              className="h-9 rounded-lg text-xs font-semibold border-slate-200"
            >
              {t('tickets.emptyState.viewUnassigned', 'View Unassigned')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenAiSuggestions}
              className="h-9 rounded-lg text-xs font-semibold border-slate-200"
            >
              {t('tickets.emptyState.openAiSuggestions', 'Open AI Suggestions')}
            </Button>
            <ModuleCreateButton
              ariaLabelKey="actions.createTicket"
              ariaLabelDefault="Create Ticket"
              onClick={onCreateTicket}
              className="h-9 sm:h-9 sm:px-4"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 min-w-[240px]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
            {t('tickets.emptyState.statsTitle', "Today's Operational Stats")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-slate-500 font-medium truncate">{stat.label}</span>
                <span className="font-bold text-slate-800 shrink-0">{stat.value}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-3 hidden lg:block">
            {t('tickets.emptyState.statsInline', 'Resolved Today: 12 | SLA Met: 100% | CSAT Score: 96%')}
          </p>
        </div>
      </div>
    </div>
  );
}
