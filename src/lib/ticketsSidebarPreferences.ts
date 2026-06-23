import { useCallback, useEffect, useMemo, useState } from 'react';

export interface CustomTicketViewFilters {
  status?: string;
  statusNot?: string;
  priorityMin?: 'low' | 'medium' | 'high' | 'urgent';
  assignedToMe?: boolean;
  unassigned?: boolean;
}

export interface CustomTicketView {
  id: string;
  name: string;
  filters: CustomTicketViewFilters;
  shared: boolean;
  pinned: boolean;
  createdAt: number;
}

export interface TicketsSidebarPreferences {
  favoriteViewIds: string[];
  hiddenGroupIds: string[];
  groupOrder: string[];
  collapsedGroups: Record<string, boolean>;
  customViews: CustomTicketView[];
}

export const DEFAULT_FAVORITE_VIEW_IDS = [
  'assigned_me',
  'help_requested',
  'sla_risk',
  'vip_customers',
];

export const DEFAULT_GROUP_ORDER = [
  'my_work',
  'inbox',
  'status',
  'customers_sla',
  'ai_views',
];

export const DEFAULT_COLLAPSED_GROUPS: Record<string, boolean> = {
  favorites: false,
  my_work: true,
  inbox: true,
  status: true,
  customers_sla: true,
  ai_views: true,
};

const PRIORITY_RANK: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

function storageKey(userId: string) {
  return `geistdesk_tickets_sidebar_${userId || 'anonymous'}`;
}

function loadPreferences(userId: string): TicketsSidebarPreferences {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) {
      return {
        favoriteViewIds: [...DEFAULT_FAVORITE_VIEW_IDS],
        hiddenGroupIds: [],
        groupOrder: [...DEFAULT_GROUP_ORDER],
        collapsedGroups: { ...DEFAULT_COLLAPSED_GROUPS },
        customViews: [],
      };
    }
    const parsed = JSON.parse(raw) as Partial<TicketsSidebarPreferences>;
    return {
      favoriteViewIds: parsed.favoriteViewIds ?? [...DEFAULT_FAVORITE_VIEW_IDS],
      hiddenGroupIds: parsed.hiddenGroupIds ?? [],
      groupOrder: parsed.groupOrder ?? [...DEFAULT_GROUP_ORDER],
      collapsedGroups: { ...DEFAULT_COLLAPSED_GROUPS, ...parsed.collapsedGroups },
      customViews: parsed.customViews ?? [],
    };
  } catch {
    return {
      favoriteViewIds: [...DEFAULT_FAVORITE_VIEW_IDS],
      hiddenGroupIds: [],
      groupOrder: [...DEFAULT_GROUP_ORDER],
      collapsedGroups: { ...DEFAULT_COLLAPSED_GROUPS },
      customViews: [],
    };
  }
}

function savePreferences(userId: string, prefs: TicketsSidebarPreferences) {
  localStorage.setItem(storageKey(userId), JSON.stringify(prefs));
}

export function customViewId(view: CustomTicketView) {
  return `custom:${view.id}`;
}

export function isCustomViewId(viewId: string) {
  return viewId.startsWith('custom:');
}

export function matchesCustomViewFilters(
  ticket: {
    status?: string;
    priority?: string;
    agentId?: string;
  },
  filters: CustomTicketViewFilters,
  userId: string,
): boolean {
  const status = ticket.status?.toLowerCase() ?? '';
  if (filters.status && status !== filters.status.toLowerCase()) return false;
  if (filters.statusNot && status === filters.statusNot.toLowerCase()) return false;
  if (filters.assignedToMe && ticket.agentId !== userId) return false;
  if (filters.unassigned && ticket.agentId) return false;
  if (filters.priorityMin) {
    const min = PRIORITY_RANK[filters.priorityMin] ?? 0;
    const cur = PRIORITY_RANK[ticket.priority?.toLowerCase() ?? 'low'] ?? 0;
    if (cur < min) return false;
  }
  return true;
}

export function useTicketsSidebarPreferences(userId: string | undefined) {
  const uid = userId ?? 'anonymous';
  const [prefs, setPrefs] = useState<TicketsSidebarPreferences>(() => loadPreferences(uid));

  useEffect(() => {
    setPrefs(loadPreferences(uid));
  }, [uid]);

  const persist = useCallback(
    (next: TicketsSidebarPreferences) => {
      setPrefs(next);
      savePreferences(uid, next);
    },
    [uid],
  );

  const toggleFavorite = useCallback(
    (viewId: string) => {
      persist({
        ...prefs,
        favoriteViewIds: prefs.favoriteViewIds.includes(viewId)
          ? prefs.favoriteViewIds.filter((id) => id !== viewId)
          : [...prefs.favoriteViewIds, viewId],
      });
    },
    [prefs, persist],
  );

  const reorderFavorites = useCallback(
    (fromIndex: number, toIndex: number) => {
      const next = [...prefs.favoriteViewIds];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      persist({ ...prefs, favoriteViewIds: next });
    },
    [prefs, persist],
  );

  const reorderGroups = useCallback(
    (fromIndex: number, toIndex: number) => {
      const next = [...prefs.groupOrder];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      persist({ ...prefs, groupOrder: next });
    },
    [prefs, persist],
  );

  const toggleGroupVisibility = useCallback(
    (groupId: string) => {
      const hidden = prefs.hiddenGroupIds.includes(groupId)
        ? prefs.hiddenGroupIds.filter((id) => id !== groupId)
        : [...prefs.hiddenGroupIds, groupId];
      persist({ ...prefs, hiddenGroupIds: hidden });
    },
    [prefs, persist],
  );

  const setGroupCollapsed = useCallback(
    (groupId: string, collapsed: boolean) => {
      persist({
        ...prefs,
        collapsedGroups: {
          ...prefs.collapsedGroups,
          [groupId]: collapsed,
        },
      });
    },
    [prefs, persist],
  );

  const toggleGroupCollapsed = useCallback(
    (groupId: string) => {
      setGroupCollapsed(groupId, !prefs.collapsedGroups[groupId]);
    },
    [prefs.collapsedGroups, setGroupCollapsed],
  );

  const addCustomView = useCallback(
    (view: Omit<CustomTicketView, 'id' | 'createdAt'>) => {
      const created: CustomTicketView = {
        ...view,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      };
      const favoriteViewIds = view.pinned
        ? [...prefs.favoriteViewIds, customViewId(created)]
        : prefs.favoriteViewIds;
      persist({
        ...prefs,
        customViews: [...prefs.customViews, created],
        favoriteViewIds,
      });
      return created;
    },
    [prefs, persist],
  );

  const updateCustomView = useCallback(
    (id: string, patch: Partial<CustomTicketView>) => {
      const customViews = prefs.customViews.map((v) => (v.id === id ? { ...v, ...patch } : v));
      let favoriteViewIds = [...prefs.favoriteViewIds];
      const cid = `custom:${id}`;
      if (patch.pinned === true && !favoriteViewIds.includes(cid)) {
        favoriteViewIds.push(cid);
      }
      if (patch.pinned === false) {
        favoriteViewIds = favoriteViewIds.filter((f) => f !== cid);
      }
      persist({ ...prefs, customViews, favoriteViewIds });
    },
    [prefs, persist],
  );

  const removeCustomView = useCallback(
    (id: string) => {
      persist({
        ...prefs,
        customViews: prefs.customViews.filter((v) => v.id !== id),
        favoriteViewIds: prefs.favoriteViewIds.filter((f) => f !== `custom:${id}`),
      });
    },
    [prefs, persist],
  );

  const pinnedCustomViews = useMemo(
    () => prefs.customViews.filter((v) => v.pinned),
    [prefs.customViews],
  );

  return {
    prefs,
    toggleFavorite,
    reorderFavorites,
    reorderGroups,
    toggleGroupVisibility,
    toggleGroupCollapsed,
    setGroupCollapsed,
    addCustomView,
    updateCustomView,
    removeCustomView,
    pinnedCustomViews,
  };
}
