import React from 'react';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { WorkspaceSwitcher } from '../layout/WorkspaceSwitcher';
import { TicketsAiQualityScore } from './TicketsAiQualityScore';
import {
  TICKETS_SIDEBAR_GROUPS,
  type SidebarGroupConfig,
} from './ticketsSidebarConfig';

interface TicketsLeftSidebarProps {
  effectiveCollapsed: boolean;
  collapsedGroups: Record<string, boolean>;
  toggleGroup: (id: string) => void;
  activeView: string;
  onViewChange: (view: string) => void;
  getViewCount: (view: string) => number;
  className?: string;
  selectedTicketId?: string | null;
  isMobileSidebarOpen?: boolean;
  footer?: React.ReactNode;
}

export function TicketsLeftSidebar({
  effectiveCollapsed,
  collapsedGroups,
  toggleGroup,
  activeView,
  onViewChange,
  getViewCount,
  className,
  selectedTicketId,
  isMobileSidebarOpen,
  footer,
}: TicketsLeftSidebarProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'border-r bg-muted flex flex-col py-4 shrink-0 h-full transition-all duration-300 ease-in-out overflow-y-auto custom-scrollbar shadow-inner',
        isMobileSidebarOpen ? 'w-full flex' : 'hidden md:flex',
        effectiveCollapsed ? 'md:w-20 overflow-hidden' : 'md:w-64',
        selectedTicketId ? 'hidden md:flex' : '',
        className,
      )}
    >
      {!effectiveCollapsed && (
        <div className="px-3 pb-3 border-b border-border/60 shrink-0">
          <WorkspaceSwitcher className="w-full" />
        </div>
      )}

      <div
        className={cn(
          'px-4 mb-3 transition-opacity duration-200',
          effectiveCollapsed ? 'opacity-0 invisible h-0' : 'opacity-100 visible',
        )}
      >
        <div className="flex items-center gap-2 pl-2">
          <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          <h2 className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-[0.2em]">
            {t('tickets.aiSupportOperations', 'AI Support Operations')}
          </h2>
        </div>
      </div>

      <div className="flex-1 space-y-3 px-2">
        {TICKETS_SIDEBAR_GROUPS.map((cat: SidebarGroupConfig) => (
          <div key={cat.id} className="space-y-0.5">
            {!effectiveCollapsed && (
              <button
                type="button"
                onClick={() => toggleGroup(cat.id)}
                className="w-full flex items-center justify-between px-3 py-1 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:text-foreground transition-all"
              >
                <span>{t(`tickets.groups.${cat.id}`, cat.label)}</span>
                {collapsedGroups[cat.id] ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            )}
            {(!collapsedGroups[cat.id] || effectiveCollapsed) && (
              <div className={cn('mt-0.5 space-y-0.5', effectiveCollapsed && 'space-y-2')}>
                {cat.items.map((item) => {
                  const count = getViewCount(item.id);
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onViewChange(item.id)}
                      title={effectiveCollapsed ? t(`tickets.items.${item.id}`, item.label) : undefined}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all group relative',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm font-semibold shadow-primary/10'
                          : item.id === 'my_queue'
                            ? 'text-red-600 hover:text-red-700 hover:bg-rose-50/80 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30 bg-rose-500/5 dark:bg-rose-950/10 border border-red-200/50 dark:border-red-900/40 font-bold'
                            : 'text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-sm',
                        effectiveCollapsed && 'justify-center px-0 h-10 w-10 mx-auto',
                      )}
                    >
                      <item.icon
                        className={cn(
                          'w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-110',
                          isActive
                            ? 'text-primary-foreground'
                            : item.id === 'my_queue'
                              ? 'text-red-500 animate-pulse dark:text-red-400 font-extrabold'
                              : 'text-slate-600 dark:text-slate-300',
                        )}
                      />

                      {!effectiveCollapsed && (
                        <>
                          <span className="truncate flex-1 text-left">
                            {t(`tickets.items.${item.id}`, item.label)}
                          </span>
                          {item.indicator && (
                            <span
                              className={cn(
                                'px-1.5 py-0.5 rounded text-[8px] tracking-tight uppercase leading-none font-bold shrink-0',
                                item.indicator.color,
                              )}
                            >
                              {t(
                                `tickets.indicators.${item.indicator.label}`,
                                item.indicator.label,
                              )}
                            </span>
                          )}
                          {count > 0 && (
                            <span
                              className={cn(
                                'ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center shrink-0',
                                isActive
                                  ? 'bg-primary-foreground text-primary'
                                  : 'bg-card border border-border text-muted-foreground',
                              )}
                            >
                              {count}
                            </span>
                          )}
                        </>
                      )}

                      {effectiveCollapsed && count > 0 && (
                        <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-white text-[8px] font-bold flex items-center justify-center border-2 border-background">
                          {count}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <TicketsAiQualityScore collapsed={effectiveCollapsed} className="mt-auto shrink-0" />
      {footer}
    </div>
  );
}
