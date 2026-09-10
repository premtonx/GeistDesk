import { type ReactNode } from 'react';
import {
  Archive,
  ChevronDown,
  Hourglass,
  MoreHorizontal,
  Settings2,
  Star,
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

function FavoriteStar({
  isFavorite,
  label,
  onToggle,
}: {
  isFavorite: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      data-favorite-star=""
      aria-label={label}
      aria-pressed={isFavorite}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-md pointer-events-auto',
        isFavorite
          ? 'text-amber-500 opacity-100'
          : 'text-slate-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
      )}
    >
      <Star
        className={cn('h-4 w-4 pointer-events-none', isFavorite && 'fill-amber-400 text-amber-500')}
      />
    </button>
  );
}

function navBadgeTone(viewId: string): BadgeTone | undefined {
  if (viewId === 'sla_risk') return 'amber';
  if (viewId === 'help_requested' || viewId === 'escalations') return 'rose';
  return undefined;
}

interface SidebarNavButtonProps {
  item: SidebarItemConfig;
  label: string;
  count: number;
  isActive: boolean;
  effectiveCollapsed: boolean;
  badgeTone?: BadgeTone;
  helpChip?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  favoriteAriaLabel?: string;
  onSelect: () => void;
}

function countBadgeClass(isActive: boolean, tone: BadgeTone = 'default') {
  const base = 'font-mono tabular-nums text-[11px] font-semibold px-1.5 py-0.5 rounded-full';
  if (isActive) return cn(base, 'bg-blue-100 text-blue-700');
  if (tone === 'amber') return cn(base, 'bg-amber-50 text-amber-800');
  if (tone === 'rose') return cn(base, 'bg-rose-50 text-rose-800');
  return cn(base, 'bg-slate-100 text-slate-500');
}

function SidebarNavButton({
  item,
  label,
  count,
  isActive,
  effectiveCollapsed,
  badgeTone = 'default',
  helpChip = false,
  isFavorite = false,
  onToggleFavorite,
  favoriteAriaLabel,
  onSelect,
}: SidebarNavButtonProps) {
  const roseActive = helpChip && isActive;
  const rowTone = roseActive
    ? 'bg-rose-50 text-rose-700 font-semibold'
    : isActive
      ? 'bg-blue-50 text-blue-700 font-semibold'
      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100';

  if (effectiveCollapsed) {
    return (
      <button
        type="button"
        onClick={onSelect}
        title={label}
        className={cn(
          'relative mx-auto flex h-8 w-8 items-center justify-center rounded-md text-[13px] font-medium transition-colors',
          rowTone,
        )}
      >
        <item.icon
          className={cn(
            'h-4 w-4 shrink-0',
            helpChip ? 'text-rose-500' : isActive ? 'text-blue-600' : 'text-slate-500',
          )}
        />
        {count > 0 && (
          <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 font-mono tabular-nums text-[8px] font-bold text-white">
            {count}
          </div>
        )}
      </button>
    );
  }

  return (
    <div className={cn('group flex h-8 w-full min-w-0 items-center rounded-md pr-0.5 transition-colors', rowTone)}>
      <button
        type="button"
        onClick={onSelect}
        title={label}
        className={cn(
          'flex h-8 min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 text-[13px] leading-none bg-transparent',
          isActive || roseActive ? 'font-semibold' : 'font-medium',
        )}
      >
        <item.icon
          className={cn(
            'h-4 w-4 shrink-0',
            helpChip ? 'text-rose-500' : isActive ? 'text-blue-600' : 'text-slate-500',
          )}
        />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        {helpChip && (
          <span className="rounded bg-rose-100 px-1 py-0 text-[10px] font-bold leading-4 text-rose-700 border border-rose-200">
            HILFE
          </span>
        )}
        {count > 0 && (
          <span
            className={cn(
              'min-w-4 text-center leading-4',
              helpChip
                ? 'font-mono tabular-nums text-[11px] font-semibold text-rose-600'
                : countBadgeClass(isActive, badgeTone),
            )}
          >
            {count}
          </span>
        )}
      </button>
      {onToggleFavorite && (
        <FavoriteStar
          isFavorite={isFavorite}
          label={favoriteAriaLabel || 'Favorit umschalten'}
          onToggle={onToggleFavorite}
        />
      )}
    </div>
  );
}

function ViewMenuItem({
  item,
  label,
  count,
  onSelect,
  tone = 'default',
  isFavorite = false,
  onToggleFavorite,
  favoriteAriaLabel,
}: {
  item: SidebarItemConfig;
  label: string;
  count: number;
  onSelect: () => void;
  tone?: 'default' | 'rose';
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  favoriteAriaLabel?: string;
}) {
  const Icon = item.icon;
  if (!item.id || Icon == null) return null;
  return (
    <DropdownMenuItem
      nativeButton={false}
      className={cn(
        'group flex h-8 items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium leading-none cursor-pointer',
        tone === 'rose' ? 'text-rose-600 focus:bg-rose-50' : 'text-slate-600',
      )}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('[data-favorite-star]')) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onSelect();
      }}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon className={cn('h-4 w-4 shrink-0 pointer-events-none', tone === 'rose' ? 'text-rose-500' : 'text-slate-400')} />
        <span className="truncate">{label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {count > 0 && (
          <span
            className={cn(
              'font-mono tabular-nums text-[11px] font-semibold leading-none',
              tone === 'rose' ? 'text-rose-600' : 'text-slate-500',
            )}
          >
            {count}
          </span>
        )}
        {onToggleFavorite && (
          <FavoriteStar
            isFavorite={isFavorite}
            label={favoriteAriaLabel || 'Favorit umschalten'}
            onToggle={onToggleFavorite}
          />
        )}
      </span>
    </DropdownMenuItem>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none">
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
  favoriteViewIds,
  onToggleFavorite,
  customViews,
  onOpenManageViews,
  className,
  selectedTicketId,
  isMobileSidebarOpen,
  footer,
}: TicketsLeftSidebarProps) {
  const { t } = useTranslation();
  const favoriteAriaLabel = t('tickets.sidebar.toggleFavorite', 'Toggle favorite');

  const resolveLabel = (item: SidebarItemConfig) => {
    if (item.id.startsWith('custom:')) return item.label;
    return t(`tickets.items.${item.id}`, item.label);
  };

  const resolveFavoriteItem = (viewId: string): SidebarItemConfig | null => {
    if (viewId.startsWith('custom:')) {
      const custom = customViews.find((view) => customViewId(view) === viewId);
      if (!custom) return null;
      return {
        id: viewId,
        label: custom.name,
        icon: getSidebarViewItem(viewId)?.icon ?? Star,
      };
    }
    return getSidebarViewItem(viewId) ?? null;
  };

  const favoriteItems = favoriteViewIds
    .map(resolveFavoriteItem)
    .filter((item): item is SidebarItemConfig => item != null);

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

  const renderItem = (item: SidebarItemConfig, badgeTone?: BadgeTone, helpChip?: boolean, keyPrefix = '') => (
    <SidebarNavButton
      key={`${keyPrefix}${item.id}`}
      item={item}
      label={resolveLabel(item)}
      count={getViewCount(item.id)}
      isActive={activeView === item.id}
      effectiveCollapsed={effectiveCollapsed}
      badgeTone={badgeTone ?? navBadgeTone(item.id)}
      helpChip={helpChip ?? item.id === 'help_requested'}
      isFavorite={favoriteViewIds.includes(item.id)}
      onToggleFavorite={() => onToggleFavorite(item.id)}
      favoriteAriaLabel={favoriteAriaLabel}
      onSelect={() => onViewChange(item.id)}
    />
  );

  const renderMenuItem = (item: SidebarItemConfig, extra?: { tone?: 'default' | 'rose'; label?: string }) => (
    <ViewMenuItem
      key={item.id}
      item={item}
      label={extra?.label ?? resolveLabel(item)}
      count={getViewCount(item.id)}
      onSelect={() => onViewChange(item.id)}
      tone={extra?.tone}
      isFavorite={favoriteViewIds.includes(item.id)}
      onToggleFavorite={() => onToggleFavorite(item.id)}
      favoriteAriaLabel={favoriteAriaLabel}
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
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate pl-1 select-none">
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

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 py-1">
        {favoriteItems.length > 0 && (
          <div className="mb-1">
            {!effectiveCollapsed && (
              <div className="px-3 pt-3 pb-1 flex items-center gap-1.5 min-w-0">
                <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate select-none">
                  {t('tickets.groups.favorites', 'Favoriten')}
                </span>
              </div>
            )}
            <div className={cn('space-y-0.5', effectiveCollapsed && 'space-y-2')}>
              {favoriteItems.map((item) => renderItem(item, undefined, undefined, 'fav-'))}
            </div>
            {!effectiveCollapsed && <div className="mx-3 mt-2 border-b border-slate-100" />}
          </div>
        )}

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
                    'flex h-8 w-full min-w-0 items-center justify-between gap-2 px-2.5 py-1.5 text-[13px] font-medium leading-none rounded-md transition-colors',
                    waitingActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
                    effectiveCollapsed && 'justify-center px-0 h-8 w-8 mx-auto',
                  )}
                />
              }
            >
              <span className="flex items-center gap-2 min-w-0">
                <Hourglass className={cn('h-4 w-4 shrink-0', waitingActive ? 'text-blue-600' : 'text-slate-500')} />
                {!effectiveCollapsed && (
                  <span className="truncate text-left">{t('tickets.items.waiting_queues', 'Wartend')}</span>
                )}
              </span>
              {!effectiveCollapsed && (
                <span className="flex items-center gap-1 shrink-0">
                  {waitingCount > 0 && (
                    <span
                      className={cn(
                        'font-mono tabular-nums text-[11px] font-semibold px-1.5 py-0.5 rounded-full',
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
                return renderMenuItem(item);
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
                    'flex h-8 w-full min-w-0 items-center justify-between gap-2 px-2.5 py-1.5 text-[13px] font-medium leading-none rounded-md transition-colors',
                    archiveActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
                    effectiveCollapsed && 'justify-center px-0 h-8 w-8 mx-auto',
                  )}
                />
              }
            >
              <span className="flex items-center gap-2 min-w-0">
                <Archive className={cn('h-4 w-4 shrink-0', archiveActive ? 'text-blue-600' : 'text-slate-500')} />
                {!effectiveCollapsed && (
                  <span className="truncate text-left">{t('tickets.items.archive', 'Gelöst / Geschlossen')}</span>
                )}
              </span>
              {!effectiveCollapsed && (
                <span className="flex items-center gap-1 shrink-0">
                  {archiveCount > 0 && (
                    <span
                      className={cn(
                        'font-mono tabular-nums text-[11px] font-semibold px-1.5 py-0.5 rounded-full',
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
                return renderMenuItem(item);
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {overflowItems.length > 0 && (
          <div className="mt-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className={cn(
                      'flex h-8 w-full min-w-0 items-center justify-between gap-2 px-2.5 py-1.5 text-[13px] font-medium leading-none rounded-md transition-colors text-slate-600 hover:text-slate-900 hover:bg-slate-100',
                      overflowItems.some((item) => item.id === activeView) && 'bg-blue-50 text-blue-700 font-semibold',
                      effectiveCollapsed && 'justify-center px-0 h-8 w-8 mx-auto',
                    )}
                  />
                }
              >
                <span className="flex items-center gap-2 min-w-0">
                  <MoreHorizontal className="h-4 w-4 shrink-0 text-slate-500" />
                  {!effectiveCollapsed && (
                    <span className="truncate">{t('tickets.sidebar.moreViews', 'Mehr')}</span>
                  )}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 p-1.5 shadow-lg border border-slate-200 bg-white rounded-xl">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none">
                  {t('tickets.sidebar.moreViewsSection', 'Weitere Ansichten')}
                </div>
                {(['watching', 'due_today', 'status_qs', 'status_paused'] as const).map((id) => {
                  const item = getSidebarViewItem(id);
                  if (!item) return null;
                  return renderMenuItem(item, {
                    label:
                      id === 'status_qs'
                        ? t('tickets.items.status_qs_long', 'In Qualitätssicherung (QS)')
                        : resolveLabel(item),
                  });
                })}
                <div className="my-1 border-t border-slate-100" />
                {(() => {
                  const item = getSidebarViewItem('spam');
                  if (!item) return null;
                  return renderMenuItem(item, { tone: 'rose' });
                })()}
                {overflowItems.length > 0 && (
                  <>
                    <div className="my-1 border-t border-slate-100" />
                    {overflowItems.map((item) => renderMenuItem(item))}
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
