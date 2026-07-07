import type { KBCategoryDto } from './kbDashboardApi';

export interface KbUploadResponse {
  title: string;
  content: string;
  plainText: string;
  kind?: string;
  category: string;
  status: string;
  saved: boolean;
  articleId?: string;
}

export interface KbScrapeResponse {
  title: string;
  content: string;
  plainText: string;
  category: string;
  status: string;
  sourceUrl?: string;
  saved: boolean;
  articleId?: string;
}

async function ingestFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `KB ingestion failed (${res.status})`);
  }
  return data as T;
}

export const kbIngestionApi = {
  uploadFile: (file: File, options?: { category?: string; status?: 'draft' | 'published'; title?: string; save?: boolean }) => {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.category) formData.append('category', options.category);
    if (options?.status) formData.append('status', options.status);
    if (options?.title) formData.append('title', options.title);
    if (options?.save === false) formData.append('save', 'false');

    return ingestFetch<KbUploadResponse>('/api/kb/upload', {
      method: 'POST',
      body: formData,
    });
  },

  scrapeUrl: (url: string, options?: { category?: string; status?: 'draft' | 'published'; save?: boolean }) =>
    ingestFetch<KbScrapeResponse>('/api/kb/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        category: options?.category,
        status: options?.status ?? 'draft',
        save: options?.save !== false,
      }),
    }),

  parseFilePreview: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return ingestFetch<{ title: string; content: string; html: string; kind: string }>('/api/kb/parse-file', {
      method: 'POST',
      body: formData,
    });
  },
};

export type { KBCategoryDto };
