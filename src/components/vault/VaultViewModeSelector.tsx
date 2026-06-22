import React from 'react';
import { LayoutGrid, List, Table2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';

export type VaultAssetViewMode = 'table' | 'grid' | 'card';

interface VaultViewModeSelectorProps {
  value: VaultAssetViewMode;
  onChange: (mode: VaultAssetViewMode) => void;
}

const MODES: { id: VaultAssetViewMode; icon: React.ReactNode; labelKey: string; defaultLabel: string }[] = [
  { id: 'table', icon: <Table2 className="w-3.5 h-3.5" />, labelKey: 'vault.layout.table', defaultLabel: 'Table' },
  { id: 'grid', icon: <LayoutGrid className="w-3.5 h-3.5" />, labelKey: 'vault.layout.grid', defaultLabel: 'Grid' },
  { id: 'card', icon: <List className="w-3.5 h-3.5" />, labelKey: 'vault.layout.card', defaultLabel: 'Card' },
];

export function VaultViewModeSelector({ value, onChange }: VaultViewModeSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="inline-flex h-8 items-center rounded-xl border border-slate-200/80 bg-slate-50/80 p-0.5" role="group">
      {MODES.map((mode) => (
        <button
          key={mode.id}
          type="button"
          onClick={() => onChange(mode.id)}
          className={cn(
            'inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px] font-medium transition-colors',
            value === mode.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {mode.icon}
          <span className="hidden sm:inline">{t(mode.labelKey, mode.defaultLabel)}</span>
        </button>
      ))}
    </div>
  );
}
