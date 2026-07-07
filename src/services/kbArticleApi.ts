import type {
  KBArticleAlert,
  KBArticleHistoryEntry,
  KBArticleInfrastructureTrust,
  KBArticleTranslation,
} from '../types';

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

export const kbArticleApi = {
  incrementView: (articleId: string) =>
    kbFetch<{ views: number }>(`/api/kb/articles/${encodeURIComponent(articleId)}/view`, {
      method: 'POST',
    }),

  getHistory: (articleId: string) =>
    kbFetch<{ history: KBArticleHistoryEntry[] }>(
      `/api/kb/articles/${encodeURIComponent(articleId)}/history`,
    ),

  recordHistory: (
    articleId: string,
    payload: { changeSummary: string; snapshotTitle?: string; authorName?: string },
  ) =>
    kbFetch<{ entry: KBArticleHistoryEntry }>(
      `/api/kb/articles/${encodeURIComponent(articleId)}/history`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  getOrGenerateSummary: (articleId: string, options?: { forceRefresh?: boolean }) =>
    kbFetch<{ aiSummary: string; cached: boolean }>(
      `/api/kb/articles/${encodeURIComponent(articleId)}/summary`,
      {
        method: 'POST',
        body: JSON.stringify({ forceRefresh: Boolean(options?.forceRefresh) }),
      },
    ),

  saveTranslation: (
    articleId: string,
    language: string,
    translation: KBArticleTranslation,
  ) =>
    kbFetch<{ translations: Record<string, KBArticleTranslation> }>(
      `/api/kb/articles/${encodeURIComponent(articleId)}/translations`,
      {
        method: 'PATCH',
        body: JSON.stringify({ language, translation }),
      },
    ),

  updateArticleFields: (
    articleId: string,
    fields: {
      content?: string;
      title?: string;
      alerts?: KBArticleAlert[];
      infrastructureTrust?: KBArticleInfrastructureTrust;
      aiSummary?: string;
    },
  ) =>
    kbFetch<{ article: Record<string, unknown> }>(
      `/api/kb/articles/${encodeURIComponent(articleId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(fields),
      },
    ),
};
