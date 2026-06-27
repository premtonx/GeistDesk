import { type ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { MODULE_PAGE_BORDER, MODULE_PAGE_INNER, MODULE_PAGE_PX } from './styles';

export interface ModuleTabItem {
  id: string;
  label: ReactNode;
  count?: number;
}

interface ModulePageTabsProps {
  tabs: ModuleTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function ModulePageTabs({ tabs, activeId, onChange, className }: ModulePageTabsProps) {
  return (
    <nav
      className={cn(
        MODULE_PAGE_PX,
        'border-b bg-white shrink-0',
        MODULE_PAGE_BORDER,
        className,
      )}
      aria-label="Module views"
    >
      <div
        className={cn(
          MODULE_PAGE_INNER,
          'flex items-center gap-0.5 overflow-x-auto no-scrollbar h-9',
        )}
      >
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          const label =
            tab.count !== undefined ? (
              <>
                {tab.label}{' '}
                <span className={cn('tabular-nums', active ? 'text-slate-600' : 'text-slate-400')}>
                  ({tab.count})
                </span>
              </>
            ) : (
              tab.label
            );
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative shrink-0 h-full px-3 text-[13px] font-medium transition-colors',
                active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <span className="inline-flex items-center gap-1 whitespace-nowrap">{label}</span>
              {active ? (
                <span
                  className="absolute bottom-0 left-2 right-2 h-[2px] bg-blue-600 rounded-full"
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
