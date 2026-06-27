import { type ReactNode } from 'react';
import { Search, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Input } from '../input';
import { Button } from '../button';
import { MODULE_PAGE_BORDER, MODULE_PAGE_INNER, MODULE_PAGE_PX } from './styles';
import { useTranslation } from '../../../lib/context/I18nContext';

interface ModuleToolbarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onFilterClick?: () => void;
  filterActive?: boolean;
  sortControl?: ReactNode;
  filtersSlot?: ReactNode;
  viewsSlot?: ReactNode;
  createAction?: ReactNode;
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
  viewsSlot,
  createAction,
  className,
}: ModuleToolbarProps) {
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
      <div className={cn(MODULE_PAGE_INNER, 'h-full flex items-center gap-2 min-w-0')}>
        <div className="flex flex-1 items-center gap-1.5 min-w-0">
          {onSearchChange !== undefined ? (
            <div className="relative flex-1 min-w-[120px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <Input
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder ?? t('actions.search', 'Search')}
                className="h-8 pl-8 pr-2.5 text-xs bg-slate-50/80 border-slate-200/80 rounded-md focus:bg-white shadow-none"
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
                'h-8 gap-1 rounded-md border-slate-200/80 text-slate-600 font-medium shrink-0 px-2.5',
                filterActive && 'border-blue-200 bg-blue-50/50 text-blue-700',
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">{t('actions.filter', 'Filter')}</span>
            </Button>
          ) : null}

          {sortControl ?? (
            filtersSlot ? null : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                className="h-8 gap-1 rounded-md border-slate-200/80 text-slate-400 font-medium shrink-0 hidden sm:flex px-2.5"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span className="text-xs">{t('modulePage.sort', 'Sort')}</span>
              </Button>
            )
          )}

          {viewsSlot}

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
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className={cn(
        'h-8 text-xs font-medium text-slate-700 bg-slate-50/80 border border-slate-200/80 rounded-md px-2 cursor-pointer outline-none focus:ring-1 focus:ring-blue-500/30 shrink-0',
        className,
      )}
    >
      {children}
    </select>
  );
}
