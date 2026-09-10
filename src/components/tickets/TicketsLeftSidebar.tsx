import { useMemo, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Settings2, Sparkles, Star } from 'lucide-react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { TicketsAiQualityScore } from './TicketsAiQualityScore';
import {
  FAVORITES_SECTION_ID,
  getSidebarViewItem,
  TICKETS_SIDEBAR_GROUPS,
  type SidebarGroupConfig,
  type SidebarItemConfig,
} from './ticketsSidebarConfig';
import type { CustomTicketView } from '../../lib/ticketsSidebarPreferences';
import { customViewId } from '../../lib/ticketsSidebarPreferences';

interface SidebarNavButtonProps {
  item: SidebarItemConfig;
  label: string;
  count: number;
  isActive: boolean;
  effectiveCollapsed: boolean;
  isFavorite?: boolean;
  onSelect: () => void;
  onToggleFavorite?: () => void;
}

function SidebarNavButton({
  item,
  label,
  count,
  isActive,
  effectiveCollapsed,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: SidebarNavButtonProps) {
  const { t } = useTranslation();
  const isHighlight = item.highlight || item.id === 'help_requested';

  return (
    <button
      type="button"
      onClick={onSelect}
      title={effectiveCollapsed ? label : undefined}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all group relative',
        isActive
          ? 'bg-primary text-primary-foreground shadow-sm font-semibold shadow-primary/10'
          : isHighlight
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
            : isHighlight
              ? 'text-red-500 animate-pulse dark:text-red-400 font-extrabold'
              : 'text-slate-600 dark:text-slate-300',
        )}
      />

      {!effectiveCollapsed && (
        <>
          <span className="truncate flex-1 text-left">{label}</span>
          {item.indicator && (
            <span
              className={cn(
                'px-1.5 py-0.5 rounded text-[8px] tracking-tight uppercase leading-none font-bold shrink-0',
                item.indicator.color,
              )}
            >
              {t(`tickets.indicators.${item.indicator.label}`, item.indicator.label)}
            </span>
          )}
          {onToggleFavorite && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleFavorite();
                }
              }}
              className={cn(
                'shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity',
                isFavorite && 'opacity-100 text-amber-500',
              )}
              aria-label={t('tickets.sidebar.toggleFavorite', 'Toggle favorite')}
            >
              <Star className={cn('w-3 h-3', isFavorite && 'fill-current')} />
            </span>
          )}
          {count > 0 && (
            <span
              className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center shrink-0',
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
  collapsedGroups,
  toggleGroup,
  activeView,
  onViewChange,
  getViewCount,
  favoriteViewIds,
  onToggleFavorite,
  onReorderFavorites,
  groupOrder,
  hiddenGroupIds,
  customViews,
  onOpenManageViews,
  className,
  selectedTicketId,
  isMobileSidebarOpen,
  footer,
}: TicketsLeftSidebarProps) {
  const { t } = useTranslation();

  const orderedGroups = useMemo(() => {
    const map = new Map(TICKETS_SIDEBAR_GROUPS.map((g) => [g.id, g]));
    return groupOrder
      .filter((id) => !hiddenGroupIds.includes(id))
      .map((id) => map.get(id))
      .filter(Boolean) as SidebarGroupConfig[];
  }, [groupOrder, hiddenGroupIds]);

  const favoriteItems = useMemo(() => {
    return favoriteViewIds
      .map((viewId) => {
        if (viewId.startsWith('custom:')) {
          const custom = customViews.find((v) => customViewId(v) === viewId);
          if (!custom) return null;
          return {
            id: viewId,
            label: custom.name,
            icon: Star,
            highlight: false,
          } satisfies SidebarItemConfig;
        }
        return getSidebarViewItem(viewId) ?? null;
      })
      .filter(Boolean) as SidebarItemConfig[];
  }, [favoriteViewIds, customViews]);

  const resolveLabel = (item: SidebarItemConfig) => {
    if (item.id.startsWith('custom:')) return item.label;
    return t(`tickets.items.${item.id}`, item.label);
  };

  const renderGroup = (cat: SidebarGroupConfig, withDivider: boolean) => (
    <div
      key={cat.id}
      className={cn('space-y-0.5', withDivider && 'pt-2.5 mt-2.5 border-t border-border/70')}
    >
      {!effectiveCollapsed && (
        <button
          type="button"
          onClick={() => toggleGroup(cat.id)}
          className="w-full flex items-center justify-between px-3 py-1 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:text-foreground transition-all"
        >
          <span>{t(`tickets.groups.${cat.id}`, cat.label)}</span>
          {collapsedGroups[cat.id] ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      )}
      {(!collapsedGroups[cat.id] || effectiveCollapsed) && (
        <div className={cn('mt-0.5 space-y-0.5', effectiveCollapsed && 'space-y-2')}>
          {cat.items
            .filter((item) => effectiveCollapsed || !favoriteViewIds.includes(item.id))
            .map((item) => (
            <SidebarNavButton
              key={item.id}
              item={item}
              label={resolveLabel(item)}
              count={getViewCount(item.id)}
              isActive={activeView === item.id}
              effectiveCollapsed={effectiveCollapsed}
              isFavorite={favoriteViewIds.includes(item.id)}
              onSelect={() => onViewChange(item.id)}
              onToggleFavorite={() => onToggleFavorite(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );

  const onFavoriteDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    onReorderFavorites(result.source.index, result.destination.index);
  };

  return (
    <div
      className={cn(
        'w-64 shrink-0 flex flex-col border-r border-slate-200 bg-white overflow-hidden shadow-inner h-full min-h-0 transition-all duration-300 ease-in-out',
        isMobileSidebarOpen ? 'w-full flex' : 'hidden md:flex',
        effectiveCollapsed ? 'md:w-20' : 'md:w-64',
        selectedTicketId ? 'hidden md:flex' : '',
        className,
      )}
    >
      {!effectiveCollapsed && (
        <div className="px-3 pb-2 pt-3 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 pl-1 min-w-0">
            <Sparkles className="w-4 h-4 text-primary animate-pulse shrink-0" />
            <h2 className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-[0.2em] truncate">
              {t('tickets.aiSupportOperations', 'AI Support Operations')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenManageViews}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card shrink-0"
            title={t('tickets.sidebar.manageViews', 'Manage views')}
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2 py-1">
        {!effectiveCollapsed && favoriteItems.length > 0 && (
          <div className="space-y-0.5 pb-2.5 mb-0.5 border-b border-border/70">
            <button
              type="button"
              onClick={() => toggleGroup(FAVORITES_SECTION_ID)}
              className="w-full flex items-center justify-between px-3 py-1 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:text-foreground transition-all"
            >
              <span className="flex items-center gap-1.5">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                {t('tickets.groups.favorites', 'Favorites')}
              </span>
              {collapsedGroups[FAVORITES_SECTION_ID] ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
            {!collapsedGroups[FAVORITES_SECTION_ID] && (
              <DragDropContext onDragEnd={onFavoriteDragEnd}>
                <Droppable droppableId="ticket-favorites">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-0.5">
                      {favoriteItems.map((item, index) => (
                        <Draggable key={item.id} draggableId={item.id} index={index}>
                          {(dragProvided) => (
                            <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}>
                              <SidebarNavButton
                                item={item}
                                label={resolveLabel(item)}
                                count={getViewCount(item.id)}
                                isActive={activeView === item.id}
                                effectiveCollapsed={false}
                                isFavorite
                                onSelect={() => onViewChange(item.id)}
                                onToggleFavorite={() => onToggleFavorite(item.id)}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </div>
        )}

        {orderedGroups.map((cat, index) => renderGroup(cat, index > 0 || favoriteItems.length > 0))}
      </div>

      <div className="shrink-0 border-t border-border/70 bg-muted/95 backdrop-blur-sm px-2 py-2 space-y-2">
        <TicketsAiQualityScore collapsed={effectiveCollapsed} />
        {footer}
      </div>
    </div>
  );
}
