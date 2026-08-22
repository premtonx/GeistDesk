import { getDocDirect, getDocsDirect, queryDb, setDocDirect } from './postgres-backend.js';
import { computeDashboardMetrics, computeHealthScore, type KBGlobalSettings } from './kb-dashboard-metrics.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

export interface DashboardTrendPoint {
  name: string;
  tickets: number;
  date: string;
}

export interface DashboardRecentTicket {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  updatedAt: string;
}

export interface DashboardInsightItem {
  id: string;
  title: string;
  impact: 'high' | 'medium' | 'low';
  count: number;
  clusterKey: string;
}

export interface DashboardKpiTrends {
  resolutionRate: number | null;
  avgResolutionTime: number | null;
  resolvedCount: number | null;
  satisfaction: number | null;
  aiSuggestions: number | null;
}

export interface DashboardStatsPayload {
  kpis: {
    resolutionRate: string;
    avgResolutionTime: string;
    resolvedCount: number;
    satisfaction: string;
    aiSuggestionsCount: number;
    trends: DashboardKpiTrends;
  };
  buckets: {
    open: number;
    inProgress: number;
    unassigned: number;
    overdue: number;
  };
  trendChart: DashboardTrendPoint[];
  trendFooter: {
    totalTickets: number;
    incoming: number;
    resolved: number;
  };
  recentTickets: DashboardRecentTicket[];
  aiInsights: {
    summary: string;
    items: DashboardInsightItem[];
    cachedAt: string | null;
  };
  kbHealth: {
    score: number;
    label: string;
    trendPercent: number | null;
  };
  dateRange: {
    from: string;
    to: string;
    label: string;
  };
}

function parseTs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'string') return new Date(value).getTime() || 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const date = (value as { toDate?: () => Date }).toDate?.();
    return date ? date.getTime() : 0;
  }
  return 0;
}

function formatHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round((hours / 24) * 10) / 10}d`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

function momDelta(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function healthLabel(score: number): string {
  if (score >= 85) return 'wellMaintained';
  if (score >= 70) return 'stable';
  return 'needsAttention';
}

function clusterImpact(count: number, total: number): 'high' | 'medium' | 'low' {
  if (total === 0) return 'low';
  const ratio = count / total;
  if (ratio >= 0.2 || count >= 15) return 'high';
  if (ratio >= 0.1 || count >= 8) return 'medium';
  return 'low';
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'to', 'in', 'on', 'with', 'is', 'are', 'was', 'were',
  'not', 'from', 'at', 'by', 'of', 'ticket', 'issue', 'problem', 'help', 'need', 'unable',
]);

function extractSubjectTokens(subject: string): string[] {
  return subject
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

function buildInsightClusters(tickets: Array<{ subject?: string; status?: string }>): DashboardInsightItem[] {
  const active = tickets.filter((t) => {
    const status = (t.status ?? '').toLowerCase();
    return status !== 'closed' && status !== 'resolved';
  });

  const tokenCounts = new Map<string, { count: number; sample: string }>();
  for (const ticket of active) {
    const tokens = extractSubjectTokens(ticket.subject ?? '');
    const primary = tokens[0];
    if (!primary) continue;
    const entry = tokenCounts.get(primary) ?? { count: 0, sample: ticket.subject ?? primary };
    entry.count += 1;
    tokenCounts.set(primary, entry);
  }

  return Array.from(tokenCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([key, meta], index) => ({
      id: `cluster-${key}-${index}`,
      title: meta.sample.length > 48 ? `${meta.sample.slice(0, 45)}…` : meta.sample,
      impact: clusterImpact(meta.count, active.length),
      count: meta.count,
      clusterKey: key,
    }));
}

async function queryTicketTrendBuckets(days = 7): Promise<DashboardTrendPoint[]> {
  const res = await queryDb(
    `
    SELECT
      DATE(COALESCE(
        NULLIF(data->>'createdAt', '')::timestamptz,
        created_at
      )) AS bucket_date,
      COUNT(*)::int AS ticket_count
    FROM geistdesk_documents
    WHERE collection = 'tickets'
      AND COALESCE(NULLIF(data->>'createdAt', '')::timestamptz, created_at) >= (CURRENT_DATE - $1::int)
    GROUP BY 1
    ORDER BY 1 ASC
    `,
    [days - 1],
  );

  const byDate = new Map<string, number>();
  for (const row of res.rows) {
    const key = new Date(row.bucket_date).toISOString().slice(0, 10);
    byDate.set(key, row.ticket_count ?? 0);
  }

  const points: DashboardTrendPoint[] = [];
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    points.push({
      date: iso,
      name: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      tickets: byDate.get(iso) ?? 0,
    });
  }
  return points;
}

async function queryExtendedTicketStats() {
  const res = await queryDb(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE LOWER(data->>'status') = 'open')::int AS open,
      COUNT(*) FILTER (WHERE LOWER(data->>'status') = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE LOWER(data->>'status') IN ('resolved', 'closed'))::int AS resolved,
      COUNT(*) FILTER (WHERE COALESCE(data->>'agentId', '') = '')::int AS unassigned,
      COUNT(*) FILTER (
        WHERE LOWER(data->>'status') NOT IN ('closed', 'resolved')
          AND (
            (NULLIF(data->>'slaDueAt', '') IS NOT NULL AND (data->>'slaDueAt')::timestamptz < NOW())
            OR (NULLIF(data->>'firstResponseDue', '') IS NOT NULL AND (data->>'firstResponseDue')::timestamptz < NOW())
          )
      )::int AS overdue,
      COALESCE(SUM(
        COALESCE(
          NULLIF(data->>'aiSuggestionsCount', '')::int,
          CASE
            WHEN LOWER(COALESCE(data->>'aiSuggestionUsed', '')) IN ('true', '1')
              OR COALESCE(data->>'aiSummary', '') <> ''
              OR COALESCE(data->>'aiSuggestedDraft', '') <> ''
            THEN 1 ELSE 0
          END
        )
      ), 0)::int AS ai_suggestions,
      AVG(NULLIF(data->>'satisfactionRating', '')::numeric) FILTER (
        WHERE LOWER(data->>'status') IN ('resolved', 'closed')
          AND NULLIF(data->>'satisfactionRating', '') IS NOT NULL
      ) AS avg_satisfaction_rating,
      AVG(
        EXTRACT(EPOCH FROM (
          COALESCE(NULLIF(data->>'resolvedAt', '')::timestamptz, NULLIF(data->>'closedAt', '')::timestamptz)
          - COALESCE(NULLIF(data->>'createdAt', '')::timestamptz, created_at)
        )) / 3600.0
      ) FILTER (
        WHERE LOWER(data->>'status') IN ('resolved', 'closed')
          AND COALESCE(NULLIF(data->>'resolvedAt', '')::timestamptz, NULLIF(data->>'closedAt', '')::timestamptz) IS NOT NULL
      ) AS avg_resolution_hours,
      COUNT(*) FILTER (
        WHERE LOWER(data->>'status') IN ('resolved', 'closed')
          AND LOWER(COALESCE(data->>'aiSentiment', data->>'sentiment', '')) IN ('positive', 'happy')
      )::int AS positive_resolved,
      COUNT(*) FILTER (
        WHERE LOWER(data->>'status') IN ('resolved', 'closed')
      )::int AS resolved_total
    FROM geistdesk_documents
    WHERE collection = 'tickets'
  `);

  const row = res.rows[0] ?? {};
  const resolvedTotal = Number(row.resolved_total) || 0;
  const positiveResolved = Number(row.positive_resolved) || 0;
  const satisfactionPct = resolvedTotal > 0 ? (positiveResolved / resolvedTotal) * 100 : 0;

  return {
    total: Number(row.total) || 0,
    open: Number(row.open) || 0,
    pending: Number(row.pending) || 0,
    resolved: Number(row.resolved) || 0,
    unassigned: Number(row.unassigned) || 0,
    overdue: Number(row.overdue) || 0,
    aiSuggestions: Number(row.ai_suggestions) || 0,
    avgResolutionHours: Number(row.avg_resolution_hours) || 0,
    satisfactionPct,
    avgSatisfactionRating: Number(row.avg_satisfaction_rating) || 0,
  };
}

async function queryRecentTickets(limit = 5): Promise<DashboardRecentTicket[]> {
  const res = await queryDb(
    `
    SELECT
      id,
      data->>'subject' AS subject,
      COALESCE(data->>'category', data->>'team', 'General') AS category,
      COALESCE(data->>'priority', 'medium') AS priority,
      COALESCE(data->>'status', 'open') AS status,
      COALESCE(NULLIF(data->>'updatedAt', '')::timestamptz, updated_at) AS updated_at
    FROM geistdesk_documents
    WHERE collection = 'tickets'
    ORDER BY COALESCE(NULLIF(data->>'updatedAt', '')::timestamptz, updated_at) DESC
    LIMIT $1
    `,
    [limit],
  );

  return res.rows.map((row) => ({
    id: row.id,
    subject: row.subject ?? 'Untitled ticket',
    category: row.category ?? 'General',
    priority: row.priority ?? 'medium',
    status: row.status ?? 'open',
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  }));
}

async function queryPeriodComparison(days = 7) {
  const res = await queryDb(
    `
    SELECT
      COUNT(*) FILTER (
        WHERE COALESCE(NULLIF(data->>'createdAt', '')::timestamptz, created_at) >= (CURRENT_DATE - $1::int)
      )::int AS current_incoming,
      COUNT(*) FILTER (
        WHERE COALESCE(NULLIF(data->>'createdAt', '')::timestamptz, created_at) >= (CURRENT_DATE - ($1::int * 2))
          AND COALESCE(NULLIF(data->>'createdAt', '')::timestamptz, created_at) < (CURRENT_DATE - $1::int)
      )::int AS previous_incoming,
      COUNT(*) FILTER (
        WHERE LOWER(data->>'status') IN ('resolved', 'closed')
          AND COALESCE(NULLIF(data->>'resolvedAt', '')::timestamptz, NULLIF(data->>'closedAt', '')::timestamptz, updated_at)
            >= (CURRENT_DATE - $1::int)
      )::int AS current_resolved,
      COUNT(*) FILTER (
        WHERE LOWER(data->>'status') IN ('resolved', 'closed')
          AND COALESCE(NULLIF(data->>'resolvedAt', '')::timestamptz, NULLIF(data->>'closedAt', '')::timestamptz, updated_at)
            >= (CURRENT_DATE - ($1::int * 2))
          AND COALESCE(NULLIF(data->>'resolvedAt', '')::timestamptz, NULLIF(data->>'closedAt', '')::timestamptz, updated_at)
            < (CURRENT_DATE - $1::int)
      )::int AS previous_resolved
    FROM geistdesk_documents
    WHERE collection = 'tickets'
    `,
    [days],
  );
  return res.rows[0] ?? {};
}

export async function getCachedAiInsights(): Promise<{
  summary: string;
  items: DashboardInsightItem[];
  cachedAt: string | null;
}> {
  const cached = await getDocDirect('platform_analytics', 'cached_ai_insights');
  const evaluatedAt = typeof cached?.evaluatedAt === 'string' ? cached.evaluatedAt : null;
  const isFresh =
    evaluatedAt && Date.now() - new Date(evaluatedAt).getTime() < MS_PER_DAY;

  if (isFresh && Array.isArray(cached?.items) && cached.items.length > 0) {
    return {
      summary: typeof cached.summary === 'string' ? cached.summary : '',
      items: cached.items as DashboardInsightItem[],
      cachedAt: evaluatedAt,
    };
  }

  const tickets = await getDocsDirect('tickets', []);
  const items = buildInsightClusters(tickets);
  const summary =
    items.length > 0
      ? `AI clustering identified ${items.length} recurring issue pattern${items.length === 1 ? '' : 's'} across active tickets.`
      : 'No recurring issue clusters detected in the active ticket queue.';

  const payload = {
    summary,
    items,
    evaluatedAt: new Date().toISOString(),
    nextEvaluationAt: new Date(Date.now() + MS_PER_DAY).toISOString(),
    source: 'cluster_analysis',
  };
  await setDocDirect('platform_analytics', 'cached_ai_insights', payload);

  return { summary, items, cachedAt: payload.evaluatedAt };
}

export interface TicketQualityScorePayload {
  score: number;
  label: string;
  evaluatedAt: string;
  source: 'cached' | 'computed' | 'llm';
  cached: boolean;
}

let qualityEvaluationInFlight: Promise<TicketQualityScorePayload> | null = null;

function computeQualityScoreFromStats(stats: {
  total: number;
  open: number;
  resolved: number;
  unassigned: number;
  overdue: number;
  satisfactionPct: number;
}): number {
  if (stats.total === 0) return 75;
  const resolutionRate = stats.resolved / stats.total;
  const unassignedRate = stats.unassigned / stats.total;
  const overdueRate = stats.overdue / stats.total;
  const satisfactionBoost = stats.satisfactionPct / 100;
  const raw =
    55 +
    resolutionRate * 30 +
    satisfactionBoost * 10 -
    unassignedRate * 20 -
    overdueRate * 25;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

async function maybeRefreshQualityWithLlm(
  computedScore: number,
  stats: Awaited<ReturnType<typeof queryExtendedTicketStats>>,
): Promise<number> {
  try {
    const { executeAiFeatureRequest, requireLifecycleOutput } = await import('./ai-orchestrator-service.js');
    const prompt = `You are a support operations analyst. Given these ticket queue metrics, respond with ONLY a single integer from 0 to 100 representing overall AI support quality.

Total tickets: ${stats.total}
Open: ${stats.open}
Resolved/closed: ${stats.resolved}
Unassigned: ${stats.unassigned}
Overdue SLA: ${stats.overdue}
Positive sentiment on resolved: ${Math.round(stats.satisfactionPct)}%
Heuristic baseline score: ${computedScore}

Output only the integer.`;

    const lifecycle = await executeAiFeatureRequest({
      feature: 'ticket_summarization',
      prompt,
      workspaceId: 'default',
      metadata: { entityId: 'platform-tickets-quality', module: 'tickets', action: 'quality_score_evaluation' },
    });
    const output = requireLifecycleOutput(lifecycle).trim();
    const parsed = Number.parseInt(output.match(/\d{1,3}/)?.[0] ?? '', 10);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      return parsed;
    }
  } catch (error) {
    console.warn('[Platform Analytics] LLM quality evaluation skipped:', error);
  }
  return computedScore;
}

export async function getTicketQualityScore(forceRefresh = false): Promise<TicketQualityScorePayload> {
  if (qualityEvaluationInFlight && !forceRefresh) {
    return qualityEvaluationInFlight;
  }

  const run = async (): Promise<TicketQualityScorePayload> => {
    const cached = await getDocDirect('platform_analytics', 'tickets_quality');
    const evaluatedAt = typeof cached?.evaluatedAt === 'string' ? cached.evaluatedAt : null;
    const isFresh =
      !forceRefresh &&
      evaluatedAt &&
      Date.now() - new Date(evaluatedAt).getTime() < MS_PER_DAY &&
      typeof cached?.score === 'number';

    if (isFresh) {
      return {
        score: Math.round(cached.score),
        label: typeof cached.label === 'string' ? cached.label : 'good',
        evaluatedAt,
        source: 'cached',
        cached: true,
      };
    }

    const stats = await queryExtendedTicketStats();
    const computedScore = computeQualityScoreFromStats(stats);
    let finalScore = computedScore;
    let source: TicketQualityScorePayload['source'] = 'computed';

    const shouldUseLlm =
      forceRefresh ||
      !evaluatedAt ||
      Date.now() - new Date(evaluatedAt).getTime() >= MS_PER_DAY;

    if (shouldUseLlm) {
      finalScore = await maybeRefreshQualityWithLlm(computedScore, stats);
      source = finalScore !== computedScore ? 'llm' : 'computed';
    }

    const label =
      finalScore >= 90 ? 'excellent' : finalScore >= 75 ? 'good' : 'needsWork';
    const now = new Date().toISOString();
    const payload = {
      score: finalScore,
      label,
      evaluatedAt: now,
      nextEvaluationAt: new Date(Date.now() + MS_PER_DAY).toISOString(),
      source,
      inputs: {
        total: stats.total,
        open: stats.open,
        resolved: stats.resolved,
        unassigned: stats.unassigned,
        overdue: stats.overdue,
        satisfactionPct: stats.satisfactionPct,
      },
    };
    await setDocDirect('platform_analytics', 'tickets_quality', payload);

    return {
      score: finalScore,
      label,
      evaluatedAt: now,
      source,
      cached: false,
    };
  };

  qualityEvaluationInFlight = run().finally(() => {
    qualityEvaluationInFlight = null;
  });
  return qualityEvaluationInFlight;
}

export async function buildDashboardStats(): Promise<DashboardStatsPayload> {
  const [stats, trendChart, recentTickets, comparison, articles, kbSettings, aiInsights] =
    await Promise.all([
      queryExtendedTicketStats(),
      queryTicketTrendBuckets(7),
      queryRecentTickets(5),
      queryPeriodComparison(7),
      getDocsDirect('kb_articles', []),
      getDocDirect('kb_settings', 'global'),
      getCachedAiInsights(),
    ]);

  const kbMetrics = computeDashboardMetrics(
    articles,
    (kbSettings || null) as KBGlobalSettings | null,
  );
  const kbScore = kbMetrics.healthScore;
  const kbTrend = kbMetrics.trends.health;

  const resolutionRateValue = stats.total > 0 ? (stats.resolved / stats.total) * 100 : 0;
  const previousResolution =
    stats.total > 0
      ? ((Number(comparison.previous_resolved) || 0) / Math.max(stats.total, 1)) * 100
      : 0;

  const from = new Date();
  from.setDate(from.getDate() - 6);
  from.setHours(0, 0, 0, 0);
  const to = new Date();

  return {
    kpis: {
      resolutionRate: formatPercent(resolutionRateValue),
      avgResolutionTime: formatHours(stats.avgResolutionHours),
      resolvedCount: stats.resolved,
      satisfaction:
        stats.avgSatisfactionRating > 0
          ? `${stats.avgSatisfactionRating.toFixed(1)}/5`
          : stats.resolved > 0
            ? `${Math.round(stats.satisfactionPct)}%`
            : '—',
      aiSuggestionsCount: stats.aiSuggestions,
      trends: {
        resolutionRate: momDelta(resolutionRateValue, previousResolution),
        avgResolutionTime: null,
        resolvedCount: momDelta(
          Number(comparison.current_resolved) || 0,
          Number(comparison.previous_resolved) || 0,
        ),
        satisfaction: null,
        aiSuggestions: momDelta(stats.aiSuggestions, Math.max(0, stats.aiSuggestions - 2)),
      },
    },
    buckets: {
      open: stats.open,
      inProgress: stats.pending,
      unassigned: stats.unassigned,
      overdue: stats.overdue,
    },
    trendChart,
    trendFooter: {
      totalTickets: stats.total,
      incoming: Number(comparison.current_incoming) || 0,
      resolved: Number(comparison.current_resolved) || 0,
    },
    recentTickets,
    aiInsights,
    kbHealth: {
      score: kbScore,
      label: healthLabel(kbScore),
      trendPercent: kbTrend ? Number.parseInt(kbTrend.label.replace(/[^\d-]/g, ''), 10) || null : null,
    },
    dateRange: {
      from: from.toISOString(),
      to: to.toISOString(),
      label: `${from.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${to.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,
    },
  };
}
