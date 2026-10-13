import { getDocDirect, getDocsDirect, setDocDirect } from './postgres-backend.js';
import { listExchangeAuditLog } from './exchange-audit-log.js';

const VAULT_ITEMS = 'vault_items';
const VAULT_SECRETS = 'vault_item_secrets';
const ANALYTICS_CACHE = 'exchange_analytics_cache';
const MODULE_CONFIG = 'module_config';

const DROPZONE_VAULT_KIND = 'dropzone_upload_bucket';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface ExchangeSettings {
  defaultExpirationHours: number;
  globalDownloadLimit: number;
  storageWarningThresholdPercent: number;
  storageQuotaGb: number;
}

export const DEFAULT_EXCHANGE_SETTINGS: ExchangeSettings = {
  defaultExpirationHours: 48,
  globalDownloadLimit: 10,
  storageWarningThresholdPercent: 80,
  storageQuotaGb: 2048,
};

export interface MonthOverMonthTrend {
  percent: number;
  up: boolean;
}

export interface ExchangeDashboardStats {
  activeSecrets: number;
  activeDropzones: number;
  filesReceived: number;
  securityScore: number;
  trends: {
    activeSecrets: MonthOverMonthTrend;
    activeDropzones: MonthOverMonthTrend;
    filesReceived: MonthOverMonthTrend;
    securityScore: MonthOverMonthTrend;
  };
}

export interface ExchangeStorageBreakdown {
  totalBytes: number;
  secretsBytes: number;
  uploadsBytes: number;
  diagnosticsBytes: number;
  quotaBytes: number;
  usedPercent: number;
  warningThresholdPercent: number;
}

export interface ExchangeInsightCard {
  tone: 'critical' | 'warning' | 'info' | 'success';
  count: number;
  titleKey: string;
  defaultTitle: string;
  descriptionKey: string;
  defaultDescription: string;
}

export interface ExchangeAnalyticsCache {
  headlineKey: string;
  defaultHeadline: string;
  insights: ExchangeInsightCard[];
  generatedAt: string;
  expiresAt: string;
}

function isDropzoneItem(item: Record<string, unknown>): boolean {
  return item.type === 'request' || (item.metadata as Record<string, unknown> | undefined)?.vaultKind === DROPZONE_VAULT_KIND;
}

function isItemBurned(item: Record<string, unknown>): boolean {
  if (item.isBurned || item.is_active === false) return true;
  if (item.expiresAt && new Date(String(item.expiresAt)).getTime() < Date.now()) return true;
  const maxViews = typeof item.maxViews === 'number' ? item.maxViews : Number.POSITIVE_INFINITY;
  const viewCount = typeof item.viewCount === 'number' ? item.viewCount : 0;
  return Number.isFinite(maxViews) && viewCount >= maxViews;
}

function isItemActive(item: Record<string, unknown>): boolean {
  return !isItemBurned(item);
}

function itemCreatedAt(item: Record<string, unknown>): Date | null {
  if (!item.createdAt) return null;
  const parsed = new Date(String(item.createdAt));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function monthBounds(reference = new Date()) {
  const thisMonthStart = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const lastMonthStart = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  return { thisMonthStart, lastMonthStart };
}

function computeMonthOverMonthTrend(
  items: Record<string, unknown>[],
  predicate: (item: Record<string, unknown>) => boolean,
): MonthOverMonthTrend {
  const { thisMonthStart, lastMonthStart } = monthBounds();
  const inRange = (item: Record<string, unknown>, start: Date, end?: Date) => {
    const created = itemCreatedAt(item);
    if (!created) return false;
    if (end) return created >= start && created < end;
    return created >= start;
  };

  const thisMonth = items.filter((item) => predicate(item) && inRange(item, thisMonthStart)).length;
  const lastMonth = items.filter((item) => predicate(item) && inRange(item, lastMonthStart, thisMonthStart)).length;

  if (lastMonth === 0) {
    return { percent: thisMonth > 0 ? 100 : 0, up: thisMonth >= lastMonth };
  }

  const delta = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
  return { percent: Math.abs(delta), up: delta >= 0 };
}

function computeItemSecurityPoints(item: Record<string, unknown>): number {
  const metadata = (item.metadata ?? {}) as Record<string, unknown>;
  let points = 35;

  if (item.passphraseHash || metadata.passphraseEnabled) points += 15;
  if (item.expirationType === 'read' || item.expiresAt) points += 20;
  if (metadata.virusScan || metadata.malwareScan || metadata.antivirusScan) points += 15;
  if (metadata.ipRestrictionEnabled) points += 10;
  if (metadata.domainWhitelistEnabled) points += 5;
  if (Number(item.sharesCount) >= 3) points += 10;
  if (metadata.notifyOnView) points += 5;

  return Math.min(100, points);
}

function computeSecurityScore(items: Record<string, unknown>[]): number {
  const active = items.filter(isItemActive);
  if (active.length === 0) return 100;
  const total = active.reduce((sum, item) => sum + computeItemSecurityPoints(item), 0);
  return Math.round(total / active.length);
}

function hasUploadedPayload(item: Record<string, unknown>): boolean {
  const metadata = (item.metadata ?? {}) as Record<string, unknown>;
  return Boolean(metadata.filename || Number(metadata.uploadCount) > 0 || Number(metadata.size) > 0);
}

export async function getExchangeSettings(): Promise<ExchangeSettings> {
  const doc = await getDocDirect(MODULE_CONFIG, 'global');
  const settings = (doc?.exchangeSettings ?? {}) as Partial<ExchangeSettings>;
  return { ...DEFAULT_EXCHANGE_SETTINGS, ...settings };
}

export async function saveExchangeSettings(settings: Partial<ExchangeSettings>): Promise<ExchangeSettings> {
  const doc = (await getDocDirect(MODULE_CONFIG, 'global')) ?? {};
  const next = { ...DEFAULT_EXCHANGE_SETTINGS, ...(doc.exchangeSettings ?? {}), ...settings };
  await setDocDirect(MODULE_CONFIG, 'global', { ...doc, exchangeSettings: next });
  return next;
}

async function estimateSecretBytes(item: Record<string, unknown>): Promise<number> {
  const metadata = (item.metadata ?? {}) as Record<string, unknown>;
  if (typeof metadata.size === 'number' && metadata.size > 0) return metadata.size;

  if (!item.secretRef) return 4096;
  const secret = await getDocDirect(VAULT_SECRETS, String(item.secretRef));
  if (!secret) return 4096;

  const shares = Array.isArray(secret.encryptedShares) ? secret.encryptedShares : [];
  const content = secret.encryptedContent;
  let bytes = 0;
  for (const share of shares) {
    bytes += JSON.stringify(share).length;
  }
  if (content) bytes += JSON.stringify(content).length;
  return bytes || 4096;
}

export async function getUserVaultItems(userId: string): Promise<Record<string, unknown>[]> {
  return getDocsDirect(VAULT_ITEMS, [{ type: 'where', field: 'createdBy', op: '==', value: userId }]);
}

export async function getExchangeDashboardStats(userId: string): Promise<ExchangeDashboardStats> {
  const items = await getUserVaultItems(userId);
  const activeSecrets = items.filter((item) => item.type === 'secret' && isItemActive(item)).length;
  const activeDropzones = items.filter((item) => isDropzoneItem(item) && isItemActive(item)).length;
  const filesReceived = items.filter((item) => isDropzoneItem(item) && hasUploadedPayload(item)).length;
  const securityScore = computeSecurityScore(items);

  const securityScoresByMonth = (start: Date, end?: Date) => {
    const scoped = items.filter((item) => {
      const created = itemCreatedAt(item);
      if (!created) return false;
      if (end) return created >= start && created < end;
      return created >= start;
    });
    return computeSecurityScore(scoped);
  };

  const { thisMonthStart, lastMonthStart } = monthBounds();
  const thisMonthScore = securityScoresByMonth(thisMonthStart);
  const lastMonthScore = securityScoresByMonth(lastMonthStart, thisMonthStart);
  const scoreDelta = thisMonthScore - lastMonthScore;

  return {
    activeSecrets,
    activeDropzones,
    filesReceived,
    securityScore,
    trends: {
      activeSecrets: computeMonthOverMonthTrend(items, (item) => item.type === 'secret' && isItemActive(item)),
      activeDropzones: computeMonthOverMonthTrend(items, (item) => isDropzoneItem(item) && isItemActive(item)),
      filesReceived: computeMonthOverMonthTrend(items, (item) => isDropzoneItem(item) && hasUploadedPayload(item)),
      securityScore: {
        percent: Math.abs(scoreDelta),
        up: scoreDelta >= 0,
      },
    },
  };
}

export async function getExchangeStorageBreakdown(userId: string): Promise<ExchangeStorageBreakdown> {
  const [items, settings] = await Promise.all([getUserVaultItems(userId), getExchangeSettings()]);
  let secretsBytes = 0;
  let uploadsBytes = 0;
  let diagnosticsBytes = 0;

  for (const item of items) {
    const metadata = (item.metadata ?? {}) as Record<string, unknown>;
    const recordedSize = typeof metadata.size === 'number' ? metadata.size : 0;

    if (isDropzoneItem(item)) {
      if (hasUploadedPayload(item)) {
        uploadsBytes += recordedSize > 0 ? recordedSize : 1024 * 1024;
      } else {
        diagnosticsBytes += recordedSize > 0 ? recordedSize : 256 * 1024;
      }
      continue;
    }

    secretsBytes += recordedSize > 0 ? recordedSize : await estimateSecretBytes(item);
  }

  const totalBytes = secretsBytes + uploadsBytes + diagnosticsBytes;
  const quotaBytes = settings.storageQuotaGb * 1024 * 1024 * 1024;
  const usedPercent = quotaBytes > 0 ? Math.min(100, (totalBytes / quotaBytes) * 100) : 0;

  return {
    totalBytes,
    secretsBytes,
    uploadsBytes,
    diagnosticsBytes,
    quotaBytes,
    usedPercent,
    warningThresholdPercent: settings.storageWarningThresholdPercent,
  };
}

function buildInsightsFromItems(items: Record<string, unknown>[]): ExchangeInsightCard[] {
  const now = Date.now();
  const expiringSoon = items.filter((item) => {
    if (!isItemActive(item)) return false;
    if (!item.expiresAt) return false;
    const expiry = new Date(String(item.expiresAt)).getTime();
    return expiry > now && expiry - now <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const criticalLogs = items.filter((item) => {
    if (!isDropzoneItem(item) || !hasUploadedPayload(item)) return false;
    const metadata = (item.metadata ?? {}) as Record<string, unknown>;
    const filename = String(metadata.filename ?? metadata.requestName ?? '').toLowerCase();
    return filename.endsWith('.log') || filename.endsWith('.zip');
  }).length;

  const sqlWarnings = items.filter((item) => {
    if (!isDropzoneItem(item) || !hasUploadedPayload(item)) return false;
    const metadata = (item.metadata ?? {}) as Record<string, unknown>;
    const filename = String(metadata.filename ?? metadata.requestName ?? '').toLowerCase();
    return filename.endsWith('.sql') || filename.endsWith('.bak') || filename.endsWith('.dump');
  }).length;

  const scannedUploads = items.filter((item) => {
    if (!isDropzoneItem(item) || !hasUploadedPayload(item)) return false;
    const metadata = (item.metadata ?? {}) as Record<string, unknown>;
    return Boolean(metadata.virusScan || metadata.malwareScan || metadata.antivirusScan);
  }).length;

  const totalUploads = items.filter((item) => isDropzoneItem(item) && hasUploadedPayload(item)).length;
  const unscanned = Math.max(0, totalUploads - scannedUploads);

  return [
    {
      tone: criticalLogs > 0 ? 'critical' : 'success',
      count: criticalLogs,
      titleKey: 'exchange.aiInsights.criticalLogs',
      defaultTitle: 'Critical log errors detected',
      descriptionKey: 'exchange.aiInsights.criticalLogsDesc',
      defaultDescription: 'Review uploaded log archives for severe runtime errors.',
    },
    {
      tone: sqlWarnings > 0 ? 'warning' : 'success',
      count: sqlWarnings,
      titleKey: 'exchange.aiInsights.sqlWarnings',
      defaultTitle: 'SQL dump warnings',
      descriptionKey: 'exchange.aiInsights.sqlWarningsDesc',
      defaultDescription: 'Validate database dump integrity before restore.',
    },
    {
      tone: expiringSoon > 0 ? 'info' : 'success',
      count: expiringSoon,
      titleKey: 'exchange.aiInsights.expiringCreds',
      defaultTitle: 'Expiring credentials',
      descriptionKey: 'exchange.aiInsights.expiringCredsDesc',
      defaultDescription: 'Rotate or extend links expiring within 48 hours.',
    },
    {
      tone: unscanned > 0 ? 'warning' : 'success',
      count: unscanned,
      titleKey: 'exchange.aiInsights.malwareScan',
      defaultTitle: 'Malware scan results',
      descriptionKey: 'exchange.aiInsights.malwareScanDesc',
      defaultDescription: unscanned > 0 ? `${unscanned} upload(s) pending malware scan policy.` : 'All uploads passed ICAP scan',
    },
  ];
}

function buildAnalyticsCacheDoc(userId: string, items: Record<string, unknown>[]): ExchangeAnalyticsCache {
  const insights = buildInsightsFromItems(items);
  const riskCount = insights.filter((card) => card.tone === 'critical' || card.tone === 'warning').reduce((sum, card) => sum + card.count, 0);
  const opportunityCount = insights.filter((card) => card.tone === 'info').reduce((sum, card) => sum + card.count, 0);
  const generatedAt = new Date().toISOString();

  return {
    headlineKey: 'exchange.aiInsights.dynamicHeadline',
    defaultHeadline: `AI detected ${riskCount} potential risk(s) and ${opportunityCount} optimization opportunity(ies).`,
    insights,
    generatedAt,
    expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
  };
}

export async function getCachedExchangeAnalytics(userId: string, forceRefresh = false): Promise<ExchangeAnalyticsCache> {
  const cacheId = `analytics-${userId}`;
  const existing = await getDocDirect(ANALYTICS_CACHE, cacheId);
  const now = Date.now();

  if (!forceRefresh && existing?.expiresAt && new Date(String(existing.expiresAt)).getTime() > now) {
    return {
      headlineKey: existing.headlineKey,
      defaultHeadline: existing.defaultHeadline,
      insights: existing.insights ?? [],
      generatedAt: existing.generatedAt,
      expiresAt: existing.expiresAt,
    };
  }

  const items = await getUserVaultItems(userId);
  const cache = buildAnalyticsCacheDoc(userId, items);
  await setDocDirect(ANALYTICS_CACHE, cacheId, { userId, ...cache });
  return cache;
}

export async function getExchangeActivityFeed(userId: string, limit = 12) {
  return listExchangeAuditLog(userId, limit);
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(1) : value.toFixed(2)} ${units[unitIndex]}`;
}
