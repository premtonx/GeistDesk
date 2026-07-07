export type KbArticleStatus = 'published' | 'draft' | 'review' | 'archived' | 'outdated' | 'other';

export interface KpiTrend {
  label: string;
  direction: 'up' | 'down' | 'neutral';
}

export interface KBDashboardMetrics {
  publishedCount: number;
  draftCount: number;
  reviewCount: number;
  healthScore: number;
  monthlyViews: number;
  missingTagsCount: number;
  outdatedCount: number;
  trends: {
    published: KpiTrend | null;
    drafts: KpiTrend | null;
    health: KpiTrend | null;
    views: KpiTrend | null;
  };
}

export interface KBGlobalSettings {
  healthScore?: number;
  previousHealthScore?: number;
  metricsSnapshots?: Record<string, { published?: number; drafts?: number; views?: number; health?: number }>;
  updatedAt?: string;
}

type ArticleLike = {
  status?: string;
  views?: number;
  tags?: string[];
  trustScore?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  owner?: string;
  author?: string;
  authorName?: string;
};

export function normalizeKbStatus(status?: string): KbArticleStatus {
  const raw = (status ?? '').toLowerCase().trim();
  if (raw === 'published') return 'published';
  if (raw === 'draft') return 'draft';
  if (raw === 'review' || raw === 'needs review' || raw === 'under revision') return 'review';
  if (raw === 'archived') return 'archived';
  if (raw === 'outdated') return 'outdated';
  return 'other';
}

export function isPublishedStatus(status?: string): boolean {
  return normalizeKbStatus(status) === 'published';
}

export function isDraftStatus(status?: string): boolean {
  return normalizeKbStatus(status) === 'draft';
}

export function isReviewStatus(status?: string): boolean {
  return normalizeKbStatus(status) === 'review';
}

export function isOutdatedStatus(status?: string): boolean {
  const n = normalizeKbStatus(status);
  return n === 'outdated' || n === 'archived';
}

export function parseArticleTimestamp(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'string') return new Date(value).getTime() || 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const date = (value as { toDate?: () => Date }).toDate?.();
    return date ? date.getTime() : 0;
  }
  if (typeof value === 'number') return value;
  return 0;
}

export function getArticleTimestamp(article: ArticleLike): number {
  return parseArticleTimestamp(article.updatedAt) || parseArticleTimestamp(article.createdAt);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthBoundaries(ref = new Date()) {
  const thisMonthStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const lastMonthStart = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  const lastMonthEnd = new Date(ref.getFullYear(), ref.getMonth(), 0, 23, 59, 59, 999);
  return { thisMonthStart, lastMonthStart, lastMonthEnd, now: ref };
}

function isBetween(ts: number, start: Date, end: Date): boolean {
  return ts >= start.getTime() && ts <= end.getTime();
}

export function formatMomTrend(current: number, previous: number): KpiTrend | null {
  if (current === 0 && previous === 0) return null;
  if (previous === 0) {
    return current > 0
      ? { label: `↑ ${current}`, direction: 'up' }
      : null;
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { label: '— 0%', direction: 'neutral' };
  if (pct > 0) return { label: `↑ ${pct}%`, direction: 'up' };
  return { label: `↓ ${Math.abs(pct)}%`, direction: 'down' };
}

export function computeHealthScore(articles: ArticleLike[]): number {
  const published = articles.filter((a) => isPublishedStatus(a.status));
  const pool = published.length > 0 ? published : articles;
  if (pool.length === 0) return 0;
  const sum = pool.reduce((acc, a) => acc + (Number(a.trustScore) || 0), 0);
  return Math.round(sum / pool.length);
}

export function computeDashboardMetrics(
  articles: ArticleLike[],
  settings?: KBGlobalSettings | null,
  refDate = new Date(),
): KBDashboardMetrics {
  const { thisMonthStart, lastMonthStart, lastMonthEnd } = monthBoundaries(refDate);

  const publishedCount = articles.filter((a) => isPublishedStatus(a.status)).length;
  const draftCount = articles.filter((a) => isDraftStatus(a.status)).length;
  const reviewCount = articles.filter((a) => isReviewStatus(a.status)).length;
  const outdatedCount = articles.filter((a) => isOutdatedStatus(a.status)).length;
  const missingTagsCount = articles.filter((a) => !a.tags || a.tags.length === 0).length;
  const monthlyViews = articles.reduce((sum, a) => sum + (Number(a.views) || 0), 0);

  const computedHealth = computeHealthScore(articles);
  const healthScore =
    typeof settings?.healthScore === 'number' ? Math.round(settings.healthScore) : computedHealth;

  const publishedThisMonth = articles.filter(
    (a) => isPublishedStatus(a.status) && isBetween(getArticleTimestamp(a), thisMonthStart, refDate),
  ).length;
  const publishedLastMonth = articles.filter(
    (a) => isPublishedStatus(a.status) && isBetween(getArticleTimestamp(a), lastMonthStart, lastMonthEnd),
  ).length;

  const draftsThisMonth = articles.filter(
    (a) => isDraftStatus(a.status) && isBetween(getArticleTimestamp(a), thisMonthStart, refDate),
  ).length;
  const draftsLastMonth = articles.filter(
    (a) => isDraftStatus(a.status) && isBetween(getArticleTimestamp(a), lastMonthStart, lastMonthEnd),
  ).length;

  const viewsThisMonth = articles
    .filter((a) => isBetween(getArticleTimestamp(a), thisMonthStart, refDate))
    .reduce((sum, a) => sum + (Number(a.views) || 0), 0);
  const viewsLastMonth = articles
    .filter((a) => isBetween(getArticleTimestamp(a), lastMonthStart, lastMonthEnd))
    .reduce((sum, a) => sum + (Number(a.views) || 0), 0);

  const snapshotKey = monthKey(lastMonthStart);
  const snapshot = settings?.metricsSnapshots?.[snapshotKey];
  const previousHealth =
    typeof settings?.previousHealthScore === 'number'
      ? settings.previousHealthScore
      : typeof snapshot?.health === 'number'
        ? snapshot.health
        : computeHealthScore(
            articles.filter((a) => getArticleTimestamp(a) <= lastMonthEnd.getTime()),
          );

  return {
    publishedCount,
    draftCount,
    reviewCount,
    healthScore,
    monthlyViews,
    missingTagsCount,
    outdatedCount,
    trends: {
      published: formatMomTrend(publishedThisMonth, publishedLastMonth),
      drafts: formatMomTrend(draftsThisMonth, draftsLastMonth),
      health: formatMomTrend(healthScore, previousHealth),
      views: formatMomTrend(viewsThisMonth, viewsLastMonth),
    },
  };
}

export function resolveArticleAuthorName(article: ArticleLike): string {
  return article.owner || article.authorName || article.author || 'Unknown';
}
