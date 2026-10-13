import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Sparkles, SlidersHorizontal, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';
import { isQuestionLikeQuery } from './kbSearchUtils';

interface KBSearchSectionProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onAdvancedFilters?: () => void;
  showFilters?: boolean;
  popularTerms?: string[];
  onPopularSearch?: (term: string) => void;
  onAskAi?: (query: string) => void;
  className?: string;
}

export function KBSearchSection({
  searchQuery,
  onSearchChange,
  onAdvancedFilters,
  showFilters,
  popularTerms = [],
  onPopularSearch,
  onAskAi,
  className,
}: KBSearchSectionProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const showAskAiBadge = isQuestionLikeQuery(searchQuery);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopPropagation();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const applyPopularSearch = (term: string) => {
    onSearchChange(term);
    onPopularSearch?.(term);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(term.length, term.length);
    });
  };

  const handleAskAi = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed || !isQuestionLikeQuery(trimmed)) return;
    onAskAi?.(trimmed);
  };

  const handleInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && showAskAiBadge) {
      e.preventDefault();
      handleAskAi();
    }
  };

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
          ref={inputRef}
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={t('kb.aiSearchPlaceholder', 'Ask Geist AI or search documentation...')}
          className={cn(
            'w-full h-12 pl-11 pr-28 sm:pr-32 rounded-xl border border-slate-200/80 bg-white',
            'text-sm text-slate-800 placeholder:text-slate-400 shadow-sm',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all',
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          <kbd className="hidden sm:inline-flex h-6 items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-400">
            ⌘K
          </kbd>
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

      {showAskAiBadge ? (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <button
            type="button"
            onClick={handleAskAi}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:border-violet-300 transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            {t('kb.askGeistAi', 'Ask Geist AI')}
          </button>
          <span className="text-[10px] text-slate-400">
            {t('kb.askGeistAiHint', 'Press Enter or click to get an AI summary')}
          </span>
        </div>
      ) : null}

      {popularTerms.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className="text-[11px] font-medium text-slate-500">{t('kb.popularLabel', 'Popular')}:</span>
        {popularTerms.map((label) => {
          return (
            <button
              key={label}
              type="button"
              onClick={() => applyPopularSearch(label)}
              className={cn(
                'text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors',
                searchQuery === label
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-200/80 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      ) : null}
    </section>
  );
}
