import React, { useState } from 'react';
import { GripVertical, Plus, Trash2, Users } from 'lucide-react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useTranslation } from '../../lib/context/I18nContext';
import { FAVORITES_SECTION_ID, TICKETS_SIDEBAR_GROUPS } from './ticketsSidebarConfig';
import type { CustomTicketView, CustomTicketViewFilters } from '../../lib/ticketsSidebarPreferences';
import { cn } from '../../lib/utils';

interface TicketsSidebarManageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  favoriteViewIds: string[];
  hiddenGroupIds: string[];
  groupOrder: string[];
  collapsedGroups: Record<string, boolean>;
  customViews: CustomTicketView[];
  onToggleGroupVisibility: (groupId: string) => void;
  onReorderGroups: (from: number, to: number) => void;
  onSetGroupCollapsed: (groupId: string, collapsed: boolean) => void;
  onAddCustomView: (view: Omit<CustomTicketView, 'id' | 'createdAt'>) => void;
  onUpdateCustomView: (id: string, patch: Partial<CustomTicketView>) => void;
  onRemoveCustomView: (id: string) => void;
}

const EMPTY_FILTERS: CustomTicketViewFilters = {
  statusNot: 'closed',
  priorityMin: 'high',
  assignedToMe: true,
};

export function TicketsSidebarManageSheet({
  open,
  onOpenChange,
  hiddenGroupIds,
  groupOrder,
  collapsedGroups,
  customViews,
  onToggleGroupVisibility,
  onReorderGroups,
  onSetGroupCollapsed,
  onAddCustomView,
  onRemoveCustomView,
}: TicketsSidebarManageSheetProps) {
  const { t } = useTranslation();
  const [newViewName, setNewViewName] = useState('');
  const [newFilters, setNewFilters] = useState<CustomTicketViewFilters>({ ...EMPTY_FILTERS });

  const orderedGroups = groupOrder
    .map((id) => TICKETS_SIDEBAR_GROUPS.find((g) => g.id === id))
    .filter(Boolean);

  const collapseSectionIds = [FAVORITES_SECTION_ID, ...groupOrder];

  const onGroupDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    onReorderGroups(result.source.index, result.destination.index);
  };

  const handleCreateView = () => {
    const name = newViewName.trim();
    if (!name) return;
    onAddCustomView({
      name,
      filters: newFilters,
      shared: false,
      pinned: true,
    });
    setNewViewName('');
    setNewFilters({ ...EMPTY_FILTERS });
  };

  const sectionLabel = (id: string) => {
    if (id === FAVORITES_SECTION_ID) {
      return t('tickets.groups.favorites', 'Favorites');
    }
    const group = TICKETS_SIDEBAR_GROUPS.find((g) => g.id === id);
    return group ? t(`tickets.groups.${group.id}`, group.label) : id;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[380px] sm:max-w-[380px] p-0 flex flex-col">
        <SheetHeader className="p-5 border-b border-border">
          <SheetTitle className="text-base font-bold">
            {t('tickets.sidebar.manageViews', 'Manage views')}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {t('tickets.sidebar.manageViewsDesc', 'Personalize queues, favorites, and saved filters for your workspace.')}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <section>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
              {t('tickets.sidebar.defaultSectionState', 'Default section state')}
            </h3>
            <p className="text-[11px] text-muted-foreground mb-2">
              {t('tickets.sidebar.defaultSectionStateDesc', 'Choose which sections start expanded or collapsed in the sidebar.')}
            </p>
            <ul className="space-y-1 rounded-lg border border-border divide-y divide-border overflow-hidden">
              {collapseSectionIds.map((id) => {
                const collapsed = collapsedGroups[id] ?? true;
                const hidden = id !== FAVORITES_SECTION_ID && hiddenGroupIds.includes(id);
                return (
                  <li
                    key={id}
                    className={cn(
                      'flex items-center justify-between gap-2 px-3 py-2 bg-card',
                      hidden && 'opacity-50',
                    )}
                  >
                    <span className="text-xs font-semibold truncate">{sectionLabel(id)}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] px-2 shrink-0"
                      onClick={() => onSetGroupCollapsed(id, !collapsed)}
                    >
                      {collapsed
                        ? t('tickets.sidebar.startCollapsed', 'Starts collapsed')
                        : t('tickets.sidebar.startExpanded', 'Starts expanded')}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
              {t('tickets.sidebar.sectionOrder', 'Section order & visibility')}
            </h3>
            <DragDropContext onDragEnd={onGroupDragEnd}>
              <Droppable droppableId="sidebar-groups">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                    {orderedGroups.map((group, index) => {
                      if (!group) return null;
                      const hidden = hiddenGroupIds.includes(group.id);
                      return (
                        <Draggable key={group.id} draggableId={group.id} index={index}>
                          {(dragProvided) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className={cn(
                                'flex items-center gap-2 rounded-lg border border-border px-2 py-2 bg-card',
                                hidden && 'opacity-50',
                              )}
                            >
                              <span {...dragProvided.dragHandleProps} className="text-muted-foreground cursor-grab">
                                <GripVertical className="w-4 h-4" />
                              </span>
                              <span className="flex-1 text-xs font-semibold truncate">
                                {t(`tickets.groups.${group.id}`, group.label)}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] px-2"
                                onClick={() => onToggleGroupVisibility(group.id)}
                              >
                                {hidden
                                  ? t('tickets.sidebar.showSection', 'Show')
                                  : t('tickets.sidebar.hideSection', 'Hide')}
                              </Button>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </section>

          <section className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {t('tickets.sidebar.customViews', 'Custom views')}
            </h3>
            {customViews.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t('tickets.sidebar.noCustomViews', 'No custom views yet. Create one below.')}
              </p>
            ) : (
              <ul className="space-y-2">
                {customViews.map((view) => (
                  <li key={view.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 bg-card">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{view.name}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        {view.shared && <Users className="w-3 h-3" />}
                        {view.pinned ? t('tickets.sidebar.pinned', 'Pinned') : t('tickets.sidebar.unpinned', 'Not pinned')}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => onRemoveCustomView(view.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="rounded-xl border border-dashed border-border p-3 space-y-2 bg-muted/30">
              <Input
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder={t('tickets.sidebar.customViewName', 'e.g. Critical Work')}
                className="h-9 text-xs"
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={!!newFilters.assignedToMe}
                  onChange={(e) => setNewFilters((f) => ({ ...f, assignedToMe: e.target.checked }))}
                />
                {t('tickets.sidebar.filterAssignedMe', 'Assigned to me')}
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={newFilters.statusNot === 'closed'}
                  onChange={(e) =>
                    setNewFilters((f) => ({ ...f, statusNot: e.target.checked ? 'closed' : undefined }))
                  }
                />
                {t('tickets.sidebar.filterNotClosed', 'Status not closed')}
              </label>
              <select
                value={newFilters.priorityMin ?? 'high'}
                onChange={(e) =>
                  setNewFilters((f) => ({
                    ...f,
                    priorityMin: e.target.value as CustomTicketViewFilters['priorityMin'],
                  }))
                }
                className="w-full h-9 rounded-lg border border-border bg-background text-xs px-2"
              >
                <option value="low">{t('tickets.priority.low', 'Low')}+</option>
                <option value="medium">{t('tickets.priority.medium', 'Medium')}+</option>
                <option value="high">{t('tickets.priority.high', 'High')}+</option>
                <option value="urgent">{t('tickets.priority.urgent', 'Urgent')}+</option>
              </select>
              <Button type="button" size="sm" className="w-full h-9 text-xs gap-1" onClick={handleCreateView}>
                <Plus className="w-3.5 h-3.5" />
                {t('tickets.sidebar.saveCustomView', 'Save custom view')}
              </Button>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
