import type { ExchangeItemRow, ExchangeQuickFilter } from './exchange-utils';

/** Items expiring within this window qualify for the "Expiring Soon" Schnellfilter. */
export const EXPIRING_SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function resolveExpiresAt(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'object' && raw !== null && 'toDate' in raw && typeof (raw as { toDate: () => Date }).toDate === 'function') {
    return (raw as { toDate: () => Date }).toDate();
  }
  if (typeof raw === 'string' || typeof raw === 'number') {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function isExchangeExpiringSoon(item: ExchangeItemRow): boolean {
  if (item.status !== 'Active') return false;
  if (item.expiresAt) {
    const expiryMs = item.expiresAt.getTime();
    const now = Date.now();
    return expiryMs > now && expiryMs - now <= EXPIRING_SOON_WINDOW_MS;
  }
  if (item.expires === 'Once Read') return false;
  return /\b(expires in|in \d+h|in \d+d|\d+h|\d+d)\b/i.test(item.expires);
}

export function matchesQuickFilter(item: ExchangeItemRow, filter: ExchangeQuickFilter): boolean {
  if (!filter) return true;
  switch (filter) {
    case 'active':
      return item.status === 'Active';
    case 'expiring':
      return isExchangeExpiringSoon(item);
    case 'shared':
      return item.type === 'secret';
    case 'received':
      return item.type === 'request';
    case 'burned':
      return item.status === 'Burned';
    case 'archived':
      return item.status === 'Expired';
    default:
      return true;
  }
}

export type ExchangeQuickFilterCounts = {
  active: number;
  expiring: number;
  shared: number;
  received: number;
  burned: number;
  archived: number;
};

export function computeQuickFilterCounts(items: ExchangeItemRow[]): ExchangeQuickFilterCounts {
  return {
    active: items.filter((i) => matchesQuickFilter(i, 'active')).length,
    expiring: items.filter((i) => matchesQuickFilter(i, 'expiring')).length,
    shared: items.filter((i) => matchesQuickFilter(i, 'shared')).length,
    received: items.filter((i) => matchesQuickFilter(i, 'received')).length,
    burned: items.filter((i) => matchesQuickFilter(i, 'burned')).length,
    archived: items.filter((i) => matchesQuickFilter(i, 'archived')).length,
  };
}

export function matchesExchangeSearch(item: ExchangeItemRow, searchTerm: string): boolean {
  if (!searchTerm.trim()) return true;
  const q = searchTerm.toLowerCase();
  return (
    item.name.toLowerCase().includes(q) ||
    item.recipient.toLowerCase().includes(q) ||
    item.company.toLowerCase().includes(q) ||
    item.ticketId.toLowerCase().includes(q)
  );
}

export type ExchangeTableFilter = 'all' | 'secrets' | 'uploads' | 'active' | 'burned' | 'expired';
export type ExchangeTableTab =
  | 'active_links'
  | 'active_dropzones'
  | 'recent_uploads'
  | 'requests'
  | 'expiring_soon';

export function applyLegacyTableFilters(
  item: ExchangeItemRow,
  tableFilter: ExchangeTableFilter,
  tableTab: ExchangeTableTab,
): boolean {
  if (tableFilter === 'secrets' && item.type !== 'secret') return false;
  if (tableFilter === 'uploads' && item.type !== 'request') return false;
  if (tableFilter === 'active' && item.status !== 'Active') return false;
  if (tableFilter === 'burned' && item.status !== 'Burned') return false;
  if (tableFilter === 'expired' && item.status !== 'Expired') return false;

  if (tableTab === 'active_links' && (item.type !== 'secret' || item.status !== 'Active')) return false;
  if (tableTab === 'active_dropzones' && (item.type !== 'request' || item.status !== 'Active')) return false;
  if (tableTab === 'recent_uploads' && item.status !== 'Uploaded' && item.status !== 'Completed') return false;
  if (tableTab === 'requests' && item.type !== 'request') return false;
  if (tableTab === 'expiring_soon' && !isExchangeExpiringSoon(item)) return false;

  return true;
}

export function filterExchangeItems(
  items: ExchangeItemRow[],
  options: {
    searchTerm: string;
    quickFilter: ExchangeQuickFilter;
    tableFilter: ExchangeTableFilter;
    tableTab: ExchangeTableTab;
  },
): ExchangeItemRow[] {
  const { searchTerm, quickFilter, tableFilter, tableTab } = options;

  return items.filter((item) => {
    if (!matchesExchangeSearch(item, searchTerm)) return false;

    if (quickFilter) {
      return matchesQuickFilter(item, quickFilter);
    }

    return applyLegacyTableFilters(item, tableFilter, tableTab);
  });
}
