import { useCallback, useMemo } from 'react';
import type { Company, Ticket as TicketType, VaultItem } from '../../types';
import type { ExchangeItemRow, ExchangeQuickFilter } from './exchange-utils';
import {
  computeQuickFilterCounts,
  filterExchangeItems,
  resolveExpiresAt,
  type ExchangeTableFilter,
  type ExchangeTableTab,
} from './exchange-filter-utils';
import { buildExpiringSoonSeedItems, type ExchangeItemRowSeed } from './exchange-template-utils';
import { normalizeExchangeItemRow } from './exchange-status-utils';
import { formatUploadLimitLabel, hasDropzoneUploadedPayload } from '../../lib/vault-dropzone-utils';

export interface UseExchangeFiltersParams {
  history: VaultItem[];
  mockUploads: ExchangeItemRowSeed[];
  seedExpiringItems?: ExchangeItemRowSeed[];
  tickets: TicketType[];
  companies: Company[];
  searchTerm: string;
  quickFilter: ExchangeQuickFilter;
  tableFilter: ExchangeTableFilter;
  tableTab: ExchangeTableTab;
}

function formatVaultHistoryItem(
  item: VaultItem,
  tickets: TicketType[],
  companies: Company[],
): ExchangeItemRow {
  const isReq = item.type === 'request';
  const name = isReq
    ? item.metadata?.requestName || `Dropzone Diagnostic #${item.id.substring(0, 4)}`
    : `Secure ${item.metadata?.secretType || 'Secret'} Payload`;

  const relatedTicketObj = tickets.find((t) => t.id === item.metadata?.relatedTicketId);
  const relatedCompanyObj = companies.find((c) => c.id === item.metadata?.relatedCompanyId);
  const expiresAt = resolveExpiresAt(item.expiresAt);

  const hasUpload = hasDropzoneUploadedPayload(item);

  const baseRow: ExchangeItemRow = {
    id: item.id,
    name,
    recipient: item.metadata?.targetRecipient || 'john.doe@client.com',
    company: relatedCompanyObj?.name || 'External Customer',
    ticketId: relatedTicketObj?.subject ? `TKT-${item.metadata?.relatedTicketId?.substring(0, 4)}` : 'N/A',
    status: item.isBurned ? 'Burned' : hasUpload ? 'Uploaded' : 'Active',
    expires: item.isBurned
      ? '__expired__'
      : expiresAt
        ? expiresAt.toLocaleDateString()
        : 'Once Read',
    expiresAt: item.isBurned ? null : expiresAt,
    views: item.viewCount ?? (item.isBurned ? 1 : 0),
    type: item.type,
    size: isReq
      ? hasUpload && item.metadata?.filename
        ? item.metadata.filename
        : item.metadata?.maxSizeMb
          ? item.metadata.maxSizeMb >= 1024
            ? `${item.metadata.maxSizeMb / 1024} GB Limit`
            : `${item.metadata.maxSizeMb} MB Limit`
          : formatUploadLimitLabel(item.metadata?.uploadLimit ?? '2GB')
      : undefined,
    createdAt: item.createdAt?.toDate ? item.createdAt.toDate() : new Date(),
  };

  return normalizeExchangeItemRow(baseRow);
}

function seedToRow(seed: ExchangeItemRowSeed): ExchangeItemRow {
  return normalizeExchangeItemRow({
    id: seed.id,
    name: seed.name,
    recipient: seed.recipient,
    company: seed.company,
    ticketId: seed.ticketId,
    status: seed.status,
    expires: seed.expires,
    expiresAt: seed.expiresAt ?? null,
    views: seed.views,
    type: seed.type,
    size: seed.size,
    createdAt: seed.createdAt,
  });
}

export function useExchangeFilters({
  history,
  mockUploads,
  seedExpiringItems = buildExpiringSoonSeedItems(),
  tickets,
  companies,
  searchTerm,
  quickFilter,
  tableFilter,
  tableTab,
}: UseExchangeFiltersParams) {
  const allExchangeItems = useMemo(() => {
    const formattedHistory = history.map((item) => formatVaultHistoryItem(item, tickets, companies));
    const mockRows = mockUploads.map(seedToRow);
    const expiringRows = seedExpiringItems.map(seedToRow);
    return [...formattedHistory, ...mockRows, ...expiringRows];
  }, [history, mockUploads, seedExpiringItems, tickets, companies]);

  const exchangeSidebarCounts = useMemo(
    () => computeQuickFilterCounts(allExchangeItems),
    [allExchangeItems],
  );

  const filteredExchangeItems = useMemo(
    () =>
      filterExchangeItems(allExchangeItems, {
        searchTerm,
        quickFilter,
        tableFilter,
        tableTab,
      }),
    [allExchangeItems, searchTerm, quickFilter, tableFilter, tableTab],
  );

  return {
    allExchangeItems,
    filteredExchangeItems,
    exchangeSidebarCounts,
  };
}

export function useQuickFilterHandler(options: {
  quickFilter: ExchangeQuickFilter;
  setQuickFilter: (value: ExchangeQuickFilter) => void;
  setExchangeNav: (nav: import('./exchange-utils').ExchangeNavId) => void;
  setActiveTab: (tab: 'dashboard' | 'secrets' | 'dropzones' | 'analysis' | 'templates') => void;
  setTableFilter: (filter: ExchangeTableFilter) => void;
  setTableTab: (tab: ExchangeTableTab) => void;
}) {
  const {
    quickFilter,
    setQuickFilter,
    setExchangeNav,
    setActiveTab,
    setTableFilter,
    setTableTab,
  } = options;

  return useCallback(
    (filter: ExchangeQuickFilter) => {
      const nextFilter = filter && filter === quickFilter ? null : filter;
      setQuickFilter(nextFilter);

      if (!nextFilter) {
        return;
      }

      setExchangeNav('overview');
      setActiveTab('dashboard');
      setTableFilter('all');
      setTableTab('requests');
    },
    [quickFilter, setQuickFilter, setExchangeNav, setActiveTab, setTableFilter, setTableTab],
  );
}
