import type { ExchangeItemRow, ExchangeQuickFilter } from './exchange-utils';
import { isExchangeActiveStatus, resolveExchangeStatus } from './exchange-status-utils';

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
  const status = resolveExchangeStatus(item);
  if (status === 'Expired' || status === 'Burned') return false;
  if (status !== 'Active' && status !== 'Viewed') return false;
  if (item.expiresAt) {
    const expiryMs = item.expiresAt.getTime();
    const now = Date.now();
    return expiryMs > now && expiryMs - now <= EXPIRING_SOON_WINDOW_MS;
  }
  if (item.expires === 'Once Read' || item.expires === '__expired__') return false;
  return /\b(expires in|in \d+h|in \d+d|\d+h|\d+d)\b/i.test(item.expires);
}

export function matchesQuickFilter(item: ExchangeItemRow, filter: ExchangeQuickFilter): boolean {
  if (!filter) return true;
  switch (filter) {
    case 'active':
      return isExchangeActiveStatus(resolveExchangeStatus(item));
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
  const query = searchTerm.toLowerCase().trim();
  if (!query) return true;

  const includes = (value: string | undefined | null) =>
    Boolean(value?.toLowerCase().includes(query));

  const matchTitle = includes(item.name);
  const matchRecipient = includes(item.recipient);
  const matchCompany = includes(item.company);
  const matchTicketLabel = includes(item.ticketId);
  const matchRelatedTicketId = includes(item.relatedTicketId);
  const matchRelatedTicketSubject = includes(item.relatedTicketSubject);
  const matchDescription = includes(item.description);
  const matchSizeOrFilename = includes(item.size);
  const matchUploadedFilename = includes(item.uploadedFilename);
  const matchStatus = includes(item.status);
  const matchType = includes(item.type);

  const matchFiles =
    item.uploadedFilenames?.some((fileName) => includes(fileName)) ?? false;

  const matchAllowedTypes =
    item.allowedTypes?.some((type) => type.toLowerCase().includes(query)) ?? false;

  const matchRecipientEmails =
    item.recipientEmails?.some((email) => includes(email)) ?? false;

  return (
    matchTitle ||
    matchRecipient ||
    matchCompany ||
    matchTicketLabel ||
    matchRelatedTicketId ||
    matchRelatedTicketSubject ||
    matchDescription ||
    matchSizeOrFilename ||
    matchUploadedFilename ||
    matchStatus ||
    matchType ||
    matchFiles ||
    matchAllowedTypes ||
    matchRecipientEmails
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
  const resolvedStatus = resolveExchangeStatus(item);

  if (tableFilter === 'secrets' && item.type !== 'secret') return false;
  if (tableFilter === 'uploads' && item.type !== 'request') return false;
  if (tableFilter === 'active' && !isExchangeActiveStatus(resolvedStatus)) return false;
  if (tableFilter === 'burned' && resolvedStatus !== 'Burned') return false;
  if (tableFilter === 'expired' && resolvedStatus !== 'Expired') return false;

  const typeLockedByDropdown = tableFilter === 'secrets' || tableFilter === 'uploads';

  if (tableTab === 'active_links') {
    if (item.type !== 'secret' || !isExchangeActiveStatus(resolvedStatus)) return false;
  } else if (tableTab === 'active_dropzones') {
    if (item.type !== 'request' || !isExchangeActiveStatus(resolvedStatus)) return false;
  } else if (tableTab === 'recent_uploads') {
    if (resolvedStatus !== 'Uploaded' && resolvedStatus !== 'Completed') return false;
  } else if (tableTab === 'requests' && !typeLockedByDropdown && tableFilter !== 'all') {
    if (item.type !== 'request') return false;
  } else if (tableTab === 'expiring_soon') {
    if (!isExchangeExpiringSoon(item)) return false;
  }

  if (typeLockedByDropdown && tableFilter === 'uploads' && tableTab === 'active_dropzones') {
    if (!isExchangeActiveStatus(resolvedStatus)) return false;
  }

  if (typeLockedByDropdown && tableFilter === 'secrets' && tableTab === 'active_links') {
    if (!isExchangeActiveStatus(resolvedStatus)) return false;
  }

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
    if (quickFilter) {
      if (!matchesQuickFilter(item, quickFilter)) return false;
    } else if (!applyLegacyTableFilters(item, tableFilter, tableTab)) {
      return false;
    }

    return matchesExchangeSearch(item, searchTerm);
  });
}
