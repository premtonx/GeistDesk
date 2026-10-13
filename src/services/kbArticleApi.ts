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

/** Hard ceiling for summary generation — unreachable AI providers must not leave the UI spinning. */
export const KB_SUMMARY_TIMEOUT_MS = 15_000;

async function kbFetchWithTimeout<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), KB_SUMMARY_TIMEOUT_MS);
  try {
    return await kbFetch<T>(path, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('AI summary request timed out after 15s.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
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
    kbFetchWithTimeout<{ aiSummary: string; cached: boolean }>(
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
      index_in_rag?: boolean;
    },
  ) =>
    kbFetch<{ article: Record<string, unknown> }>(
      `/api/kb/articles/${encodeURIComponent(articleId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(fields),
      },
    ),

  setIndexInRag: (articleId: string, indexInRag: boolean) =>
    kbFetch<{ article: Record<string, unknown> }>(
      `/api/kb/articles/${encodeURIComponent(articleId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ index_in_rag: indexInRag }),
      },
    ),
};
