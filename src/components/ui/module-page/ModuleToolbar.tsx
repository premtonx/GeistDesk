import React from 'react';
import { Search, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Input } from '../input';
import { Button } from '../button';
import { MODULE_PAGE_BORDER, MODULE_PAGE_MAX_W, MODULE_PAGE_PX } from './styles';
import { useTranslation } from '../../../lib/context/I18nContext';

interface ModuleToolbarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onFilterClick?: () => void;
  filterActive?: boolean;
  sortControl?: React.ReactNode;
  filtersSlot?: React.ReactNode;
  createAction?: React.ReactNode;
  className?: string;
}

export function ModuleToolbar({
  searchPlaceholder,
  searchValue = '',
  onSearchChange,
  onFilterClick,
  filterActive,
  sortControl,
  filtersSlot,
  createAction,
  className,
}: ModuleToolbarProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        MODULE_PAGE_PX,
        'py-3 border-b bg-white shrink-0',
        MODULE_PAGE_BORDER,
        className,
      )}
    >
      <div className={cn(MODULE_PAGE_MAX_W, 'mx-auto flex items-center gap-2 min-w-0')}>
        <div className="flex flex-1 items-center gap-2 min-w-0 flex-wrap">
          {onSearchChange !== undefined ? (
            <div className="relative flex-1 min-w-[140px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder ?? t('actions.search', 'Search')}
                className="h-9 pl-9 pr-3 text-sm bg-slate-50/80 border-slate-200/80 rounded-lg focus:bg-white shadow-none"
              />
            </div>
          ) : null}

          {onFilterClick ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onFilterClick}
              className={cn(
                'h-9 gap-1.5 rounded-lg border-slate-200/80 text-slate-600 font-medium shrink-0',
                filterActive && 'border-blue-200 bg-blue-50/50 text-blue-700',
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden xs:inline text-xs">{t('actions.filter', 'Filter')}</span>
            </Button>
          ) : null}

          {sortControl ?? (
            filtersSlot ? null : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                className="h-9 gap-1.5 rounded-lg border-slate-200/80 text-slate-400 font-medium shrink-0 hidden sm:flex"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span className="text-xs">{t('modulePage.sort', 'Sort')}</span>
              </Button>
            )
          )}

          {filtersSlot}
        </div>

        {createAction ? <div className="shrink-0 ml-1 sm:ml-2">{createAction}</div> : null}
      </div>
    </div>
  );
}

export function ModuleToolbarSelect({
  value,
  onChange,
  children,
  className,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className={cn(
        'h-9 text-xs font-medium text-slate-700 bg-slate-50/80 border border-slate-200/80 rounded-lg px-2.5 cursor-pointer outline-none focus:ring-1 focus:ring-blue-500/30 shrink-0',
        className,
      )}
    >
      {children}
    </select>
  );
}
