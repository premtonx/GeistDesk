import { useCallback, useEffect, useState } from 'react';
import {
  exchangeApi,
  type ExchangeAnalyticsCache,
  type ExchangeAuditEntry,
  type ExchangeDashboardStats,
  type ExchangeStorageBreakdown,
} from '../../services/exchangeApi';

const REFRESH_MS = 30_000;

export function useExchangeLiveData() {
  const [dashboard, setDashboard] = useState<ExchangeDashboardStats | null>(null);
  const [storage, setStorage] = useState<ExchangeStorageBreakdown | null>(null);
  const [analytics, setAnalytics] = useState<ExchangeAnalyticsCache | null>(null);
  const [auditLog, setAuditLog] = useState<ExchangeAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingAnalytics, setRefreshingAnalytics] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [dashboardRes, storageRes, analyticsRes, auditRes] = await Promise.all([
        exchangeApi.getDashboard(),
        exchangeApi.getStorage(),
        exchangeApi.getAnalytics(),
        exchangeApi.getAuditLog(12),
      ]);
      setDashboard(dashboardRes);
      setStorage(storageRes);
      setAnalytics(analyticsRes);
      setAuditLog(auditRes.entries);
    } catch (err) {
      console.warn('[useExchangeLiveData] Failed to load exchange metrics', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAnalytics = useCallback(async () => {
    setRefreshingAnalytics(true);
    try {
      const next = await exchangeApi.refreshAnalytics();
      setAnalytics(next);
    } catch (err) {
      console.warn('[useExchangeLiveData] Analytics refresh failed', err);
    } finally {
      setRefreshingAnalytics(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
    const interval = setInterval(() => void loadAll(), REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadAll]);

  return {
    dashboard,
    storage,
    analytics,
    auditLog,
    loading,
    refreshingAnalytics,
    reload: loadAll,
    refreshAnalytics,
  };
}
