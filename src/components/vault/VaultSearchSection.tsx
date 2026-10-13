import React from 'react';
import { Search, Sparkles, SlidersHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';

interface VaultSearchSectionProps {
  value: string;
  onChange: (v: string) => void;
  filtersOpen?: boolean;
  onToggleFilters?: () => void;
}

export function VaultSearchSection({ value, onChange, filtersOpen, onToggleFilters }: VaultSearchSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="relative">
      <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('vault.globalSearchPlaceholder', 'Search assets, credentials, hosts, API keys...')}
        className={cn(
          'w-full h-11 pl-11 pr-28 rounded-2xl border border-slate-200/80 bg-white shadow-sm text-sm',
          'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300',
        )}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        <kbd className="hidden sm:inline-flex h-6 items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[10px] text-slate-400">
          ⌘K
        </kbd>
        <button
          type="button"
          onClick={onToggleFilters}
          className={cn(
            'h-8 w-8 rounded-xl flex items-center justify-center text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors',
            filtersOpen && 'bg-blue-50 text-blue-600',
          )}
          aria-label={t('vault.advancedFilters', 'Advanced filters')}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
        <div className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
          <Search className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}
