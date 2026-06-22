import type { ExchangeItemRow } from './exchange-utils';

export type ExchangeLifecycleStatus =
  | 'Active'
  | 'Expired'
  | 'Burned'
  | 'Uploaded'
  | 'Completed'
  | 'Viewed'
  | 'Pending';

const TERMINAL_STATUSES = new Set<string>(['Burned', 'Uploaded', 'Completed', 'Pending']);

export function resolveExchangeStatus(
  item: Pick<ExchangeItemRow, 'status' | 'expiresAt' | 'views'>,
): ExchangeLifecycleStatus {
  if (item.status === 'Burned') {
    return 'Burned';
  }

  if (item.expiresAt && item.expiresAt.getTime() <= Date.now()) {
    return 'Expired';
  }

  if (item.status === 'Expired') {
    return 'Expired';
  }

  if (TERMINAL_STATUSES.has(item.status)) {
    return item.status as ExchangeLifecycleStatus;
  }

  if (item.views > 0 && item.status === 'Active') {
    return 'Viewed';
  }

  return 'Active';
}

export function formatExchangeExpiration(
  item: Pick<ExchangeItemRow, 'expires' | 'expiresAt'>,
  status: ExchangeLifecycleStatus,
): string {
  if (status === 'Expired') {
    return '__expired__';
  }

  if (item.expiresAt) {
    const ms = item.expiresAt.getTime() - Date.now();
    if (ms <= 0) {
      return '__expired__';
    }
    const hours = Math.ceil(ms / (60 * 60 * 1000));
    if (hours <= 48) {
      return `in ${hours}h`;
    }
    const days = Math.ceil(hours / 24);
    return `in ${days}d`;
  }

  return item.expires;
}

export function normalizeExchangeItemRow(row: ExchangeItemRow): ExchangeItemRow {
  const status = resolveExchangeStatus(row);
  const expires = formatExchangeExpiration(row, status);
  return { ...row, status, expires };
}

export function isExchangeActiveStatus(status: string): boolean {
  return status === 'Active' || status === 'Viewed' || status === 'Uploaded' || status === 'Completed';
}

export function getExchangeStatusLabelKey(status: string): string {
  switch (status) {
    case 'Active':
      return 'exchange.status.active';
    case 'Burned':
      return 'exchange.status.burned';
    case 'Expired':
      return 'exchange.status.expired';
    case 'Viewed':
      return 'exchange.status.viewed';
    case 'Uploaded':
      return 'exchange.status.uploaded';
    case 'Completed':
      return 'exchange.status.completed';
    case 'Pending':
      return 'exchange.status.pending';
    default:
      return 'exchange.status.pending';
  }
}

export function getExchangeStatusDefaultLabel(status: string): string {
  switch (status) {
    case 'Active':
      return 'Active';
    case 'Burned':
      return 'Burned';
    case 'Expired':
      return 'Expired';
    case 'Viewed':
      return 'Viewed';
    case 'Uploaded':
      return 'Uploaded';
    case 'Completed':
      return 'Completed';
    case 'Pending':
      return 'Pending';
    default:
      return 'Pending';
  }
}

export function formatExchangeExpirationDisplay(
  expires: string,
  t: (key: string, defaultValue: string) => string,
): string {
  if (expires === '__expired__') {
    return t('exchange.status.expired', 'Expired');
  }
  return expires;
}

export function isDemoExchangeId(id: string): boolean {
  return id.startsWith('seed-expiring-') || id.startsWith('upload-mock');
}

export function buildExchangeSecureUrl(id: string): string {
  if (typeof window === 'undefined') {
    return `/v/${id}`;
  }
  return `${window.location.origin}/v/${id}`;
}
