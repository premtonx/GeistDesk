import {
  MessageSquare,
  Sparkles,
  FileWarning,
  ClipboardCheck,
  Lightbulb,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { formatArticleDate } from './kb-utils';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { isPublishedStatus, resolveArticleAuthorName } from '../../lib/kb-dashboard-metrics';

interface ActivityItem {
  id: string;
  title: string;
  meta: string;
  type: 'edited' | 'published' | 'comment' | 'ai';
}

interface Contributor {
  name: string;
  count: number;
  initial: string;
}

interface KBActivitySidebarProps {
  recentActivity: ActivityItem[];
  healthScore: number;
  reviewCount: number;
  missingTagsCount: number;
  outdatedCount: number;
  aiRecommendations?: number;
  contributors: Contributor[];
  className?: string;
}

export function KBActivitySidebar({
  recentActivity,
  healthScore,
  reviewCount,
  missingTagsCount,
  outdatedCount,
  aiRecommendations = 0,
  contributors,
  className,
}: KBActivitySidebarProps) {
  const { t } = useTranslation();

  const insights = [
    {
      icon: AlertCircle,
      text: t('kb.insights.reviewNeeded', '{{count}} articles need review').replace('{{count}}', String(reviewCount)),
      color: 'text-violet-700 bg-violet-50 border-violet-100',
      visible: reviewCount > 0,
    },
    {
      icon: Tag,
      text: t('kb.insights.missingTags', '{{count}} articles missing tags').replace('{{count}}', String(missingTagsCount)),
      color: 'text-orange-700 bg-orange-50 border-orange-100',
      visible: missingTagsCount > 0,
    },
    {
      icon: FileWarning,
      text: t('kb.insights.outdatedSops', '{{count}} outdated SOPs').replace('{{count}}', String(outdatedCount)),
      color: 'text-slate-700 bg-slate-50 border-slate-200',
      visible: outdatedCount > 0,
    },
    {
      icon: Lightbulb,
      text: t('kb.insights.aiRecommendations', '{{count}} AI recommendations').replace('{{count}}', String(aiRecommendations)),
      color: 'text-blue-700 bg-blue-50 border-blue-100',
      visible: aiRecommendations > 0,
    },
  ].filter((item) => item.visible);

  const typeIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'published':
        return <Sparkles className="w-3.5 h-3.5 text-emerald-500" />;
      case 'comment':
        return <MessageSquare className="w-3.5 h-3.5 text-blue-500" />;
      case 'ai':
        return <Lightbulb className="w-3.5 h-3.5 text-indigo-500" />;
      default:
        return <ClipboardCheck className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <aside className={cn('space-y-4', className)}>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            {t('kb.aiInsightsTitle', 'AI Knowledge Insights')}
          </h3>
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
            {t('kb.beta', 'Beta')}
          </span>
        </div>
        {insights.length > 0 ? (
          <ul className="space-y-2">
            {insights.map((item) => (
              <li
                key={item.text}
                className={cn(
                  'flex items-center gap-2 text-[11px] font-medium px-2.5 py-2 rounded-xl border',
                  item.color,
                )}
              >
                <item.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="line-clamp-2">{item.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {t(
              'kb.insights.empty',
              'Keine KI-Empfehlungen — Verfassen Sie Artikel, um Analysen zu generieren',
            )}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          {t('kb.activity.title', 'Recent Activity')}
        </h3>
        {recentActivity.length === 0 ? (
          <p className="text-[11px] text-slate-400">{t('kb.activity.empty', 'Noch keine Aktivität')}</p>
        ) : (
          <ul className="space-y-3">
            {recentActivity.slice(0, 5).map((item) => (
              <li key={item.id} className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0">{typeIcon(item.type)}</div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-800 line-clamp-2">{item.title}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{item.meta}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {contributors.length > 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            {t('kb.topContributors', 'Top Contributors')}
          </h3>
          <ul className="space-y-2.5">
            {contributors.slice(0, 5).map((c) => (
              <li key={c.name} className="flex items-center gap-2.5">
                <Avatar className="h-7 w-7 border border-slate-200">
                  <AvatarFallback className="text-[10px] font-bold bg-slate-100">{c.initial}</AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-slate-700 flex-1 truncate">{c.name}</span>
                <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                  {c.count} {t('kb.articlesShort', 'articles')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {recentActivity.length > 0 || contributors.length > 0 ? (
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          {t('kb.health.title', 'Knowledge Health Score')}
        </h3>
        <p className="text-3xl font-bold text-emerald-700 tabular-nums">{healthScore}%</p>
        <div className="mt-2 h-2 rounded-full bg-emerald-100 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${healthScore}%` }} />
        </div>
      </div>
      ) : null}
    </aside>
  );
}

export function buildRecentActivity(
  articles: {
    id: string;
    title: string;
    status?: string;
    updatedAt?: { toDate?: () => Date };
    owner?: string;
    author?: string;
    authorName?: string;
  }[],
  t: (key: string, fallback?: string) => string,
): ActivityItem[] {
  const sorted = [...articles].sort((a, b) => {
    const aT =
      a.updatedAt?.toDate?.()?.getTime() ??
      (typeof a.updatedAt === 'string' ? new Date(a.updatedAt).getTime() : 0);
    const bT =
      b.updatedAt?.toDate?.()?.getTime() ??
      (typeof b.updatedAt === 'string' ? new Date(b.updatedAt).getTime() : 0);
    return bT - aT;
  });

  return sorted.slice(0, 5).map((art) => ({
    id: art.id,
    title: art.title,
    meta: isPublishedStatus(art.status)
      ? t('kb.activity.published', 'Published · {{date}}').replace('{{date}}', formatArticleDate(art) || '—')
      : t('kb.activity.edited', 'Edited by {{owner}} · {{date}}')
          .replace('{{owner}}', resolveArticleAuthorName(art))
          .replace('{{date}}', formatArticleDate(art) || '—'),
    type: isPublishedStatus(art.status) ? 'published' : 'edited',
  }));
}

export function buildTopContributors(
  articles: { owner?: string; author?: string; authorName?: string }[],
): Contributor[] {
  const counts = new Map<string, number>();
  for (const a of articles) {
    const name = resolveArticleAuthorName(a);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({
      name,
      count,
      initial: name.charAt(0).toUpperCase(),
    }));
}
