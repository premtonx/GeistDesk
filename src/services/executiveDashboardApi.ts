import type { DashboardStatsPayload } from '../lib/dashboard-stats-service';

async function dashboardFetch<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Dashboard API failed (${res.status})`);
  }
  return data as T;
}

export const executiveDashboardApi = {
  getStats: () => dashboardFetch<DashboardStatsPayload>('/api/dashboard/stats'),

  getTicketQualityScore: () =>
    dashboardFetch<{
      score: number;
      label: string;
      evaluatedAt: string;
      source: string;
      cached: boolean;
    }>('/api/dashboard/quality-score'),
};

export type { DashboardStatsPayload };
