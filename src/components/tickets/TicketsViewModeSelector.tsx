import React from 'react';
import { LayoutGrid, Columns3, List } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';

export type TicketsLayoutMode = 'list' | 'kanban' | 'cards';

interface TicketsViewModeSelectorProps {
  value: TicketsLayoutMode;
  onChange: (mode: TicketsLayoutMode) => void;
  className?: string;
}

const MODES: { id: TicketsLayoutMode; icon: React.ReactNode; labelKey: string; defaultLabel: string }[] = [
  { id: 'list', icon: <List className="w-3.5 h-3.5" />, labelKey: 'tickets.layout.list', defaultLabel: 'List' },
  { id: 'kanban', icon: <Columns3 className="w-3.5 h-3.5" />, labelKey: 'tickets.layout.kanban', defaultLabel: 'Kanban' },
  { id: 'cards', icon: <LayoutGrid className="w-3.5 h-3.5" />, labelKey: 'tickets.layout.cards', defaultLabel: 'Cards' },
];

export function TicketsViewModeSelector({ value, onChange, className }: TicketsViewModeSelectorProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'inline-flex h-8 items-center rounded-md border border-slate-200/80 bg-slate-50/80 p-0.5 shrink-0',
        className,
      )}
      role="group"
      aria-label={t('tickets.views', 'Views')}
    >
      {MODES.map((mode) => {
        const active = value === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            title={t(mode.labelKey, mode.defaultLabel)}
            onClick={() => onChange(mode.id)}
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded px-2 text-[11px] font-medium transition-colors',
              active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {mode.icon}
            <span className="hidden md:inline">{t(mode.labelKey, mode.defaultLabel)}</span>
          </button>
        );
      })}
    </div>
  );
}
