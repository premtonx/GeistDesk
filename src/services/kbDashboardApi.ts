import type { KBDashboardMetrics, KBGlobalSettings } from '../lib/kb-dashboard-metrics';

export interface KBCategoryDto {
  id: string;
  name: string;
  desc?: string;
  owner?: string;
  subCategory?: string;
  iconName?: string;
  order?: number;
  updatedAt?: string;
  createdAt?: string;
}

async function kbFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `KB API failed (${res.status})`);
  }
  return data as T;
}

export const kbDashboardApi = {
  getStats: () =>
    kbFetch<{ metrics: KBDashboardMetrics; settings: KBGlobalSettings; articleCount: number }>(
      '/api/kb/dashboard/stats',
    ),

  getGlobalSettings: () =>
    kbFetch<{ settings: KBGlobalSettings }>('/api/kb/dashboard/settings/global'),

  updateGlobalSettings: (patch: Partial<KBGlobalSettings>) =>
    kbFetch<{ settings: KBGlobalSettings }>('/api/kb/dashboard/settings/global', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
};

export const kbCategoryApi = {
  list: () => kbFetch<{ categories: KBCategoryDto[] }>('/api/kb/categories'),

  create: (payload: {
    name: string;
    desc?: string;
    owner?: string;
    subCategory?: string;
    iconName?: string;
    order?: number;
  }) =>
    kbFetch<{ category: KBCategoryDto }>('/api/kb/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (
    id: string,
    payload: Partial<{
      name: string;
      desc: string;
      owner: string;
      subCategory: string;
      iconName: string;
      order: number;
    }>,
  ) =>
    kbFetch<{ category: KBCategoryDto }>(`/api/kb/categories/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  remove: (id: string, strategy: 'reassign' | 'purge' = 'reassign') =>
    kbFetch<{ success: boolean; strategy: string; affectedCount: number }>(
      `/api/kb/categories/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        body: JSON.stringify({ strategy }),
      },
    ),
};
