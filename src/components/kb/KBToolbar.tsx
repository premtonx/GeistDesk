import React from 'react';
import { Sparkles, SlidersHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';
import { MODULE_PAGE_BORDER, MODULE_PAGE_INNER, MODULE_PAGE_PX } from '../ui/module-page/styles';

interface KBToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onFilterClick?: () => void;
  filterActive?: boolean;
  sortControl?: React.ReactNode;
  viewsSlot?: React.ReactNode;
  createAction?: React.ReactNode;
  className?: string;
}

export function KBToolbar({
  searchQuery,
  onSearchChange,
  onFilterClick,
  filterActive,
  sortControl,
  viewsSlot,
  createAction,
  className,
}: KBToolbarProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        MODULE_PAGE_PX,
        'h-12 max-h-12 py-0 border-b bg-white shrink-0',
        MODULE_PAGE_BORDER,
        className,
      )}
    >
      <div className={cn(MODULE_PAGE_INNER, 'h-full flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap sm:flex-nowrap')}>
        <div className="relative flex-1 min-w-[120px] basis-full sm:basis-auto sm:max-w-md order-1">
          <Sparkles className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-500 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('kb.aiSearchPlaceholder', 'Ask Geist AI or search documentation...')}
            className={cn(
              'w-full h-8 pl-8 pr-14 text-xs bg-slate-50/80 border border-slate-200/80 rounded-lg',
              'text-slate-800 placeholder:text-slate-400 outline-none',
              'focus:bg-white focus:ring-1 focus:ring-blue-500/30 focus:border-blue-200',
            )}
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center rounded border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-400">
            ⌘K
          </kbd>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 order-2 sm:order-none ml-auto">
          {onFilterClick ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onFilterClick}
              className={cn(
                'h-8 gap-1 rounded-lg border-slate-200/80 text-slate-600 font-medium px-2.5',
                filterActive && 'border-blue-200 bg-blue-50/50 text-blue-700',
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">{t('actions.filter', 'Filter')}</span>
            </Button>
          ) : null}

          {sortControl}
          {viewsSlot}
        </div>

        {createAction ? <div className="shrink-0 order-3">{createAction}</div> : null}
      </div>
    </div>
  );
}
