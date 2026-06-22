import React from 'react';
import {
  MessageSquare,
  Sparkles,
  FileWarning,
  BookX,
  ClipboardCheck,
  Lightbulb,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { formatArticleDate } from './kb-utils';

interface ActivityItem {
  id: string;
  title: string;
  meta: string;
  type: 'edited' | 'published' | 'comment' | 'ai';
}

interface KBActivitySidebarProps {
  recentActivity: ActivityItem[];
  missingDocs?: number;
  outdatedArticles?: number;
  reviewRequired?: number;
  aiOpportunities?: number;
  className?: string;
}

export function KBActivitySidebar({
  recentActivity,
  missingDocs = 4,
  outdatedArticles = 2,
  reviewRequired = 3,
  aiOpportunities = 5,
  className,
}: KBActivitySidebarProps) {
  const { t } = useTranslation();

  const healthItems = [
    {
      icon: BookX,
      label: t('kb.health.missingDocs', 'Missing documentation'),
      value: missingDocs,
      color: 'text-rose-600',
    },
    {
      icon: FileWarning,
      label: t('kb.health.outdated', 'Outdated articles'),
      value: outdatedArticles,
      color: 'text-orange-600',
    },
    {
      icon: ClipboardCheck,
      label: t('kb.health.reviewRequired', 'Review required'),
      value: reviewRequired,
      color: 'text-violet-600',
    },
    {
      icon: Lightbulb,
      label: t('kb.health.aiOpportunities', 'AI optimization opportunities'),
      value: aiOpportunities,
      color: 'text-blue-600',
    },
  ];

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
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          {t('kb.activity.title', 'Recent Activity')}
        </h3>
        <ul className="space-y-3">
          {recentActivity.slice(0, 6).map((item) => (
            <li key={item.id} className="flex items-start gap-2.5">
              <div className="mt-0.5 shrink-0">{typeIcon(item.type)}</div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-800 line-clamp-2">{item.title}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{item.meta}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          {t('kb.health.title', 'Knowledge Health')}
        </h3>
        <ul className="space-y-2.5">
          {healthItems.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-xs text-slate-600 min-w-0">
                <item.icon className={cn('w-3.5 h-3.5 shrink-0', item.color)} />
                <span className="truncate">{item.label}</span>
              </span>
              <span className={cn('text-sm font-bold tabular-nums shrink-0', item.color)}>{item.value}</span>
            </li>
          ))}
        </ul>
      </div>
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
  }[],
  t: (key: string, fallback?: string) => string,
): ActivityItem[] {
  const sorted = [...articles].sort((a, b) => {
    const aT = a.updatedAt?.toDate?.()?.getTime() ?? 0;
    const bT = b.updatedAt?.toDate?.()?.getTime() ?? 0;
    return bT - aT;
  });

  return sorted.slice(0, 8).map((art, idx) => ({
    id: art.id,
    title: art.title,
    meta:
      art.status === 'Published'
        ? t('kb.activity.published', 'Published · {{date}}').replace('{{date}}', formatArticleDate(art) || '—')
        : t('kb.activity.edited', 'Edited by {{owner}} · {{date}}')
            .replace('{{owner}}', art.owner ?? '—')
            .replace('{{date}}', formatArticleDate(art) || '—'),
    type: (idx % 4 === 0 ? 'ai' : art.status === 'Published' ? 'published' : 'edited') as ActivityItem['type'],
  }));
}
