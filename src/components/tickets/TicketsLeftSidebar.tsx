import { type ReactNode } from 'react';
import {
  Archive,
  ChevronDown,
  Hourglass,
  MoreHorizontal,
  Settings2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { TicketsAiQualityScore } from './TicketsAiQualityScore';
import {
  ARCHIVE_VIEW_IDS,
  COMPACT_PRIMARY_VIEWS,
  COMPACT_STATUS_VIEWS,
  COMPACT_URGENCY_VIEWS,
  WAITING_QUEUE_VIEW_IDS,
  getCompactOverflowViews,
  getSidebarViewItem,
  type SidebarItemConfig,
} from './ticketsSidebarConfig';
import type { CustomTicketView } from '../../lib/ticketsSidebarPreferences';
import { customViewId } from '../../lib/ticketsSidebarPreferences';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

type BadgeTone = 'default' | 'amber' | 'rose';

interface SidebarNavButtonProps {
  item: SidebarItemConfig;
  label: string;
  count: number;
  isActive: boolean;
  effectiveCollapsed: boolean;
  badgeTone?: BadgeTone;
  helpChip?: boolean;
  onSelect: () => void;
}

function countBadgeClass(isActive: boolean, tone: BadgeTone = 'default') {
  if (isActive) return 'bg-blue-100 text-blue-700';
  if (tone === 'amber') return 'bg-amber-50 text-amber-800';
  if (tone === 'rose') return 'bg-rose-50 text-rose-800';
  return 'bg-slate-100 text-slate-500';
}

function SidebarNavButton({
  item,
  label,
  count,
  isActive,
  effectiveCollapsed,
  badgeTone = 'default',
  helpChip = false,
  onSelect,
}: SidebarNavButtonProps) {
  const roseActive = helpChip && isActive;
  return (
    <button
      type="button"
      onClick={onSelect}
      title={label}
      className={cn(
        'w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors min-w-0',
        roseActive
          ? 'bg-rose-50 text-rose-700 font-semibold'
          : isActive
            ? 'bg-blue-50 text-blue-700'
            : 'text-slate-700 hover:bg-slate-100',
        effectiveCollapsed && 'relative justify-center px-0 h-10 w-10 mx-auto',
      )}
    >
      <span className={cn('flex items-center gap-2 min-w-0', effectiveCollapsed && 'justify-center')}>
        <item.icon
          className={cn(
            'w-4 h-4 shrink-0',
            helpChip ? 'text-rose-500' : isActive ? 'text-blue-600' : 'text-slate-500',
          )}
        />
        {!effectiveCollapsed && <span className="truncate text-left">{label}</span>}
      </span>
      {!effectiveCollapsed && (
        <span className="flex items-center gap-1.5 shrink-0">
          {helpChip && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-100 text-rose-700 border border-rose-200">
              HILFE
            </span>
          )}
          {count > 0 && (
            <span
              className={cn(
                'text-[11px] font-semibold min-w-4 text-center',
                helpChip ? 'text-rose-600' : cn('px-1.5 py-0.5 rounded-full', countBadgeClass(isActive, badgeTone)),
              )}
            >
              {count}
            </span>
          )}
        </span>
      )}
      {effectiveCollapsed && count > 0 && (
        <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-600 text-white text-[8px] font-bold flex items-center justify-center">
          {count}
        </div>
      )}
    </button>
  );
}

function ViewMenuItem({
  item,
  label,
  count,
  onSelect,
  tone = 'default',
}: {
  item: SidebarItemConfig;
  label: string;
  count: number;
  onSelect: () => void;
  tone?: 'default' | 'rose';
}) {
  const Icon = item.icon;
  if (!item.id || Icon == null) return null;
  return (
    <DropdownMenuItem
      className={cn(
        'flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg cursor-pointer',
        tone === 'rose' ? 'text-rose-600 focus:bg-rose-50' : 'text-slate-700',
      )}
      onClick={onSelect}
    >
      <span className="flex items-center gap-2 min-w-0">
        <Icon className={cn('w-3.5 h-3.5 shrink-0', tone === 'rose' ? 'text-rose-500' : 'text-slate-400')} />
        <span className="truncate">{label}</span>
      </span>
      {count > 0 && (
        <span
          className={cn(
            'text-[11px] font-semibold tabular-nums shrink-0',
            tone === 'rose' ? 'text-rose-600' : 'text-slate-500',
          )}
        >
          {count}
        </span>
      )}
    </DropdownMenuItem>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
      {children}
    </div>
  );
}

interface TicketsLeftSidebarProps {
  effectiveCollapsed: boolean;
  collapsedGroups: Record<string, boolean>;
  toggleGroup: (id: string) => void;
  activeView: string;
  onViewChange: (view: string) => void;
  getViewCount: (view: string) => number;
  favoriteViewIds: string[];
  onToggleFavorite: (viewId: string) => void;
  onReorderFavorites: (fromIndex: number, toIndex: number) => void;
  groupOrder: string[];
  hiddenGroupIds: string[];
  customViews: CustomTicketView[];
  onOpenManageViews: () => void;
  className?: string;
  selectedTicketId?: string | null;
  isMobileSidebarOpen?: boolean;
  footer?: ReactNode;
}

export function TicketsLeftSidebar({
  effectiveCollapsed,
  activeView,
  onViewChange,
  getViewCount,
  customViews,
  onOpenManageViews,
  className,
  selectedTicketId,
  isMobileSidebarOpen,
  footer,
}: TicketsLeftSidebarProps) {
  const { t } = useTranslation();

  const resolveLabel = (item: SidebarItemConfig) => {
    if (item.id.startsWith('custom:')) return item.label;
    return t(`tickets.items.${item.id}`, item.label);
  };

  const waitingCount = WAITING_QUEUE_VIEW_IDS.reduce((sum, id) => sum + getViewCount(id), 0);
  const archiveCount = ARCHIVE_VIEW_IDS.reduce((sum, id) => sum + getViewCount(id), 0);
  const waitingActive = WAITING_QUEUE_VIEW_IDS.includes(activeView as (typeof WAITING_QUEUE_VIEW_IDS)[number]);
  const archiveActive = ARCHIVE_VIEW_IDS.includes(activeView as (typeof ARCHIVE_VIEW_IDS)[number]);

  const overflowItems: SidebarItemConfig[] = [
    ...getCompactOverflowViews(),
    ...customViews.map(
      (view) =>
        ({
          id: customViewId(view),
          label: view.name,
          icon: getSidebarViewItem(customViewId(view))?.icon ?? MoreHorizontal,
        }) satisfies SidebarItemConfig,
    ),
  ];

  const renderItem = (item: SidebarItemConfig, badgeTone?: BadgeTone, helpChip?: boolean) => (
    <SidebarNavButton
      key={item.id}
      item={item}
      label={resolveLabel(item)}
      count={getViewCount(item.id)}
      isActive={activeView === item.id}
      effectiveCollapsed={effectiveCollapsed}
      badgeTone={badgeTone}
      helpChip={helpChip}
      onSelect={() => onViewChange(item.id)}
    />
  );

  return (
    <div
      className={cn(
        'w-64 shrink-0 flex flex-col border-r border-slate-200 bg-white overflow-hidden h-full min-h-0',
        isMobileSidebarOpen ? 'w-full flex' : 'hidden md:flex',
        effectiveCollapsed ? 'md:w-20' : 'md:w-64',
        selectedTicketId ? 'hidden md:flex' : '',
        className,
      )}
    >
      {!effectiveCollapsed && (
        <div className="px-3 pb-1 pt-3 flex items-center justify-between gap-2 shrink-0">
          <h2 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate pl-1">
            {t('tickets.aiSupportOperations', 'AI Support Operations')}
          </h2>
          <button
            type="button"
            onClick={onOpenManageViews}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
            title={t('tickets.sidebar.manageViews', 'Manage views')}
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden px-2 py-1">
        {!effectiveCollapsed && (
          <SectionLabel>{t('tickets.groups.primaryViews', 'Hauptansichten')}</SectionLabel>
        )}
        <div className={cn('space-y-0.5', effectiveCollapsed && 'space-y-2')}>
          {COMPACT_PRIMARY_VIEWS.map((item) => renderItem(item))}
        </div>

        {!effectiveCollapsed && (
          <SectionLabel>{t('tickets.groups.urgency', 'Dringlichkeit & SLA')}</SectionLabel>
        )}
        <div className={cn('space-y-0.5', effectiveCollapsed && 'space-y-2')}>
          {renderItem(COMPACT_URGENCY_VIEWS[0], 'amber')}
          {renderItem(COMPACT_URGENCY_VIEWS[1], 'rose', true)}
          {renderItem(COMPACT_URGENCY_VIEWS[2], 'rose')}
        </div>

        {!effectiveCollapsed && (
          <SectionLabel>{t('tickets.groups.statusQueues', 'Status & Queues')}</SectionLabel>
        )}
        <div className={cn('space-y-0.5', effectiveCollapsed && 'space-y-2')}>
          {COMPACT_STATUS_VIEWS.map((item) => renderItem(item))}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  title={t('tickets.items.waiting_queues', 'Wartend')}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors min-w-0',
                    waitingActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100',
                    effectiveCollapsed && 'justify-center px-0 h-10 w-10 mx-auto',
                  )}
                />
              }
            >
              <span className="flex items-center gap-2 min-w-0">
                <Hourglass className={cn('w-3.5 h-3.5 shrink-0', waitingActive ? 'text-blue-600' : 'text-slate-500')} />
                {!effectiveCollapsed && (
                  <span className="truncate text-left">{t('tickets.items.waiting_queues', 'Wartend')}</span>
                )}
              </span>
              {!effectiveCollapsed && (
                <span className="flex items-center gap-1 shrink-0">
                  {waitingCount > 0 && (
                    <span
                      className={cn(
                        'text-[11px] font-semibold px-1.5 py-0.5 rounded-full',
                        countBadgeClass(waitingActive),
                      )}
                    >
                      {waitingCount}
                    </span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </span>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 min-w-56">
              {WAITING_QUEUE_VIEW_IDS.map((id) => {
                const item = getSidebarViewItem(id);
                if (!item) return null;
                return (
                  <ViewMenuItem
                    key={id}
                    item={item}
                    label={resolveLabel(item)}
                    count={getViewCount(id)}
                    onSelect={() => onViewChange(id)}
                  />
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  title={t('tickets.items.archive', 'Gelöst / Geschlossen')}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors min-w-0',
                    archiveActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100',
                    effectiveCollapsed && 'justify-center px-0 h-10 w-10 mx-auto',
                  )}
                />
              }
            >
              <span className="flex items-center gap-2 min-w-0">
                <Archive className={cn('w-3.5 h-3.5 shrink-0', archiveActive ? 'text-blue-600' : 'text-slate-500')} />
                {!effectiveCollapsed && (
                  <span className="truncate text-left">{t('tickets.items.archive', 'Gelöst / Geschlossen')}</span>
                )}
              </span>
              {!effectiveCollapsed && (
                <span className="flex items-center gap-1 shrink-0">
                  {archiveCount > 0 && (
                    <span
                      className={cn(
                        'text-[11px] font-semibold px-1.5 py-0.5 rounded-full',
                        countBadgeClass(archiveActive),
                      )}
                    >
                      {archiveCount}
                    </span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </span>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 min-w-56">
              {ARCHIVE_VIEW_IDS.map((id) => {
                const item = getSidebarViewItem(id);
                if (!item) return null;
                return (
                  <ViewMenuItem
                    key={id}
                    item={item}
                    label={resolveLabel(item)}
                    count={getViewCount(id)}
                    onSelect={() => onViewChange(id)}
                  />
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {overflowItems.length > 0 && (
          <div className="mt-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors text-slate-700 hover:bg-slate-100 min-w-0',
                      overflowItems.some((item) => item.id === activeView) && 'bg-blue-50 text-blue-700',
                      effectiveCollapsed && 'justify-center px-0 h-10 w-10 mx-auto',
                    )}
                  />
                }
              >
                <span className="flex items-center gap-2 min-w-0">
                  <MoreHorizontal className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                  {!effectiveCollapsed && (
                    <span className="truncate">{t('tickets.sidebar.moreViews', 'Mehr')}</span>
                  )}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 p-1.5 shadow-lg border border-slate-200 bg-white rounded-xl">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {t('tickets.sidebar.moreViewsSection', 'Weitere Ansichten')}
                </div>
                {(['watching', 'due_today', 'status_qs', 'status_paused'] as const).map((id) => {
                  const item = getSidebarViewItem(id);
                  if (!item) return null;
                  return (
                    <ViewMenuItem
                      key={id}
                      item={item}
                      label={
                        id === 'status_qs'
                          ? t('tickets.items.status_qs_long', 'In Qualitätssicherung (QS)')
                          : resolveLabel(item)
                      }
                      count={getViewCount(id)}
                      onSelect={() => onViewChange(id)}
                    />
                  );
                })}
                <div className="my-1 border-t border-slate-100" />
                {(() => {
                  const item = getSidebarViewItem('spam');
                  if (!item) return null;
                  return (
                    <ViewMenuItem
                      item={item}
                      label={resolveLabel(item)}
                      count={getViewCount('spam')}
                      onSelect={() => onViewChange('spam')}
                      tone="rose"
                    />
                  );
                })()}
                {overflowItems.length > 0 && (
                  <>
                    <div className="my-1 border-t border-slate-100" />
                    {overflowItems.map((item) => (
                      <ViewMenuItem
                        key={item.id}
                        item={item}
                        label={resolveLabel(item)}
                        count={getViewCount(item.id)}
                        onSelect={() => onViewChange(item.id)}
                      />
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-slate-200 mt-auto shrink-0 space-y-2">
        <TicketsAiQualityScore collapsed={effectiveCollapsed} />
        {footer}
      </div>
    </div>
  );
}
