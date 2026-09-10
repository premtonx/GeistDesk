import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Ticket } from '../types';
import { hasAssignee, isTicketAssignedToUser } from './ticketAssignee';

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
  'status_open',
];

const REMOVED_VIEW_IDS = new Set(['vip_customers', 'vip_requests']);

/** Dedicated favorites list — real view ids only (never German slugs). */
export const SIDEBAR_FAVORITES_STORAGE_KEY = 'geistdesk_sidebar_favorites';

const LEGACY_FAVORITE_ID_MAP: Record<string, string> = {
  'mir-zugewiesen': 'assigned_me',
  offen: 'status_open',
};

function normalizeFavoriteId(id: string): string {
  const trimmed = String(id ?? '').trim();
  return LEGACY_FAVORITE_ID_MAP[trimmed] ?? trimmed;
}

function sanitizeFavoriteViewIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of ids) {
    const id = normalizeFavoriteId(raw);
    if (!id || REMOVED_VIEW_IDS.has(id) || seen.has(id)) continue;
    seen.add(id);
    cleaned.push(id);
  }
  return cleaned;
}

function readStandaloneFavorites(): string[] | null {
  try {
    const raw = localStorage.getItem(SIDEBAR_FAVORITES_STORAGE_KEY);
    if (raw == null) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return sanitizeFavoriteViewIds(parsed.map(String));
  } catch {
    return null;
  }
}

function writeStandaloneFavorites(ids: string[]) {
  localStorage.setItem(SIDEBAR_FAVORITES_STORAGE_KEY, JSON.stringify(sanitizeFavoriteViewIds(ids)));
}

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
  const standaloneFavorites = readStandaloneFavorites();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) {
      const favoriteViewIds =
        standaloneFavorites !== null ? standaloneFavorites : [...DEFAULT_FAVORITE_VIEW_IDS];
      if (standaloneFavorites === null) writeStandaloneFavorites(favoriteViewIds);
      return {
        favoriteViewIds,
        hiddenGroupIds: [],
        groupOrder: [...DEFAULT_GROUP_ORDER],
        collapsedGroups: { ...DEFAULT_COLLAPSED_GROUPS },
        customViews: [],
      };
    }
    const parsed = JSON.parse(raw) as Partial<TicketsSidebarPreferences>;
    const favoriteViewIds =
      standaloneFavorites !== null
        ? standaloneFavorites
        : sanitizeFavoriteViewIds(parsed.favoriteViewIds ?? [...DEFAULT_FAVORITE_VIEW_IDS]);
    if (standaloneFavorites === null) writeStandaloneFavorites(favoriteViewIds);
    return {
      favoriteViewIds,
      hiddenGroupIds: parsed.hiddenGroupIds ?? [],
      groupOrder: parsed.groupOrder ?? [...DEFAULT_GROUP_ORDER],
      collapsedGroups: { ...DEFAULT_COLLAPSED_GROUPS, ...parsed.collapsedGroups },
      customViews: parsed.customViews ?? [],
    };
  } catch {
    const favoriteViewIds =
      standaloneFavorites !== null ? standaloneFavorites : [...DEFAULT_FAVORITE_VIEW_IDS];
    return {
      favoriteViewIds,
      hiddenGroupIds: [],
      groupOrder: [...DEFAULT_GROUP_ORDER],
      collapsedGroups: { ...DEFAULT_COLLAPSED_GROUPS },
      customViews: [],
    };
  }
}

function savePreferences(userId: string, prefs: TicketsSidebarPreferences) {
  const favoriteViewIds = sanitizeFavoriteViewIds(prefs.favoriteViewIds);
  try {
    writeStandaloneFavorites(favoriteViewIds);
    localStorage.setItem(
      storageKey(userId),
      JSON.stringify({
        ...prefs,
        favoriteViewIds,
      }),
    );
  } catch {
    // Persistence can fail in private mode; in-memory state still updates.
  }
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
    agentName?: string;
    assignedTo?: string | null;
    assigneeId?: string | null;
  },
  filters: CustomTicketViewFilters,
  user: { userId?: string; userEmail?: string; userName?: string } | string,
): boolean {
  const status = ticket.status?.toLowerCase() ?? '';
  if (filters.status && status !== filters.status.toLowerCase()) return false;
  if (filters.statusNot && status === filters.statusNot.toLowerCase()) return false;
  if (filters.assignedToMe) {
    const ctx = typeof user === 'string' ? { userId: user } : user;
    if (!isTicketAssignedToUser(ticket as Ticket, ctx)) return false;
  }
  if (filters.unassigned && hasAssignee(ticket as Ticket)) return false;
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

  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const toggleFavorite = useCallback(
    (viewId: string) => {
      const id = normalizeFavoriteId(viewId);
      if (!id) return;
      const current = prefsRef.current;
      const favoriteViewIds = current.favoriteViewIds.includes(id)
        ? current.favoriteViewIds.filter((existing) => existing !== id)
        : [...current.favoriteViewIds, id];
      persist({
        ...current,
        favoriteViewIds,
      });
    },
    [persist],
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
