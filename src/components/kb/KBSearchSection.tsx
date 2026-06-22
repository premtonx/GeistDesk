import React from 'react';
import { Sparkles, Mic, SlidersHorizontal, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';

interface KBSearchSectionProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onAdvancedFilters?: () => void;
  showFilters?: boolean;
  onPopularSearch?: (term: string) => void;
  className?: string;
}

const POPULAR_KEYS = [
  { key: 'kb.popular.ssoSetup', defaultLabel: 'SSO Setup' },
  { key: 'kb.popular.apiAuth', defaultLabel: 'API Authentication' },
  { key: 'kb.popular.billing', defaultLabel: 'Billing FAQ' },
  { key: 'kb.popular.vpn', defaultLabel: 'VPN Troubleshooting' },
] as const;

export function KBSearchSection({
  searchQuery,
  onSearchChange,
  onAdvancedFilters,
  showFilters,
  onPopularSearch,
  className,
}: KBSearchSectionProps) {
  const { t } = useTranslation();

  return (
    <section
      className={cn(
        'rounded-2xl border border-violet-100/80 bg-gradient-to-br from-violet-50/40 via-white to-blue-50/30 p-5 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-blue-600" />
        <p className="text-sm font-semibold text-slate-800">
          {t('kb.aiSearchHeading', 'Ask Geist AI or search documentation...')}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('kb.aiSearchPlaceholder', 'Ask Geist AI or search documentation...')}
          className={cn(
            'w-full h-12 pl-11 pr-36 rounded-xl border border-slate-200/80 bg-white',
            'text-sm text-slate-800 placeholder:text-slate-400 shadow-sm',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all',
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <kbd className="hidden sm:inline-flex h-6 items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-400">
            ⌘K
          </kbd>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50"
            aria-label={t('kb.voiceSearch', 'Voice search')}
          >
            <Mic className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAdvancedFilters}
            className={cn(
              'h-8 rounded-lg text-xs font-medium gap-1 border-slate-200/80',
              showFilters && 'border-blue-200 bg-blue-50/50 text-blue-700',
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {t('actions.filter', 'Filters')}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className="text-[11px] font-medium text-slate-500">{t('kb.popularLabel', 'Popular')}:</span>
        {POPULAR_KEYS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onPopularSearch?.(t(item.key, item.defaultLabel))}
            className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-slate-200/80 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700 transition-colors"
          >
            {t(item.key, item.defaultLabel)}
          </button>
        ))}
      </div>
    </section>
  );
}
