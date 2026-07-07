import axios from 'axios';

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

export interface ExchangeAuditEntry {
  id?: string;
  userId: string;
  actorId: string;
  actorEmail?: string;
  action: string;
  itemId?: string;
  itemName?: string;
  message: string;
  createdAt: string;
}

export interface ExchangeSettings {
  defaultExpirationHours: number;
  globalDownloadLimit: number;
  storageWarningThresholdPercent: number;
  storageQuotaGb: number;
}

export const exchangeApi = {
  getDashboard: () => axios.get<ExchangeDashboardStats>('/api/exchange/dashboard').then((r) => r.data),
  getStorage: () => axios.get<ExchangeStorageBreakdown>('/api/exchange/storage').then((r) => r.data),
  getAnalytics: (refresh = false) =>
    axios
      .get<ExchangeAnalyticsCache>('/api/exchange/analytics', { params: refresh ? { refresh: 'true' } : undefined })
      .then((r) => r.data),
  refreshAnalytics: () => axios.post<ExchangeAnalyticsCache>('/api/exchange/analytics/refresh').then((r) => r.data),
  getAuditLog: (limit = 12) =>
    axios.get<{ entries: ExchangeAuditEntry[] }>('/api/exchange/audit-log', { params: { limit } }).then((r) => r.data),
  getSettings: () => axios.get<{ settings: ExchangeSettings }>('/api/exchange/settings').then((r) => r.data.settings),
  saveSettings: (settings: Partial<ExchangeSettings>) =>
    axios.patch<{ settings: ExchangeSettings }>('/api/exchange/settings', settings).then((r) => r.data.settings),
};

export function formatExchangeBytes(bytes: number): string {
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
