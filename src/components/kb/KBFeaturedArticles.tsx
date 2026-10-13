import React from 'react';
import { Clock, Eye, Sparkles, ThumbsUp, CheckCircle2, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { formatArticleDate, stripHtml, categoryI18nKey } from './kb-utils';

export interface KBArticleItem {
  id: string;
  title: string;
  content?: string;
  category?: string;
  subCategory?: string;
  status?: string;
  owner?: string;
  views?: number;
  helpfulCount?: number;
  unhelpfulCount?: number;
  avgReadTime?: string;
  trustScore?: number;
  updatedAt?: { toDate?: () => Date };
}

const COVER_GRADIENTS = [
  'from-blue-500 via-indigo-500 to-violet-600',
  'from-emerald-400 via-teal-500 to-cyan-600',
  'from-orange-400 via-rose-500 to-pink-600',
  'from-violet-500 via-purple-500 to-fuchsia-600',
];

interface KBFeaturedArticlesProps {
  articles: KBArticleItem[];
  onSelect: (article: KBArticleItem) => void;
  onViewAll?: () => void;
  className?: string;
}

export function KBFeaturedArticles({ articles, onSelect, onViewAll, className }: KBFeaturedArticlesProps) {
  const { t } = useTranslation();

  if (articles.length === 0) return null;

  const helpfulPercent = (art: KBArticleItem) => {
    const total = (art.helpfulCount ?? 0) + (art.unhelpfulCount ?? 0);
    if (total === 0) return art.trustScore ?? 0;
    return Math.round(((art.helpfulCount ?? 0) / total) * 100);
  };

  return (
    <section className={className}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-900">
          {t('kb.featuredTitle', 'Featured Articles')}
        </h2>
        {onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-0.5"
          >
            {t('kb.viewAll', 'View all')}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {articles.slice(0, 3).map((art, idx) => (
          <button
            key={art.id}
            type="button"
            onClick={() => onSelect(art)}
            className={cn(
              'text-left rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm',
              'hover:shadow-lg hover:border-blue-200 transition-all group flex flex-col h-full',
            )}
          >
            <div
              className={cn(
                'h-28 bg-gradient-to-br relative flex items-end p-4',
                COVER_GRADIENTS[idx % COVER_GRADIENTS.length],
              )}
            >
              <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-blue-700 shadow-sm">
                <Sparkles className="w-3 h-3" />
                {t('kb.featuredBadge', 'Featured')}
              </span>
            </div>
            <div className="p-5 flex flex-col flex-1">
              <span className="text-[10px] font-medium text-blue-600 mb-1">
                {t(categoryI18nKey(art.category ?? ''), art.category ?? '—')}
              </span>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 line-clamp-2 leading-snug mb-2">
                {art.title}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4 flex-1">
                {stripHtml(art.content ?? '').slice(0, 120)}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-6 w-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600">
                    {art.owner?.charAt(0) ?? 'A'}
                  </span>
                  {art.owner ?? t('kb.unassignedOwner', 'Unassigned')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {art.avgReadTime ?? '5 min read'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {(art.views ?? 0).toLocaleString()}
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold ml-auto">
                  <CheckCircle2 className="w-3 h-3" />
                  {helpfulPercent(art)}% {t('kb.helpful', 'helpful')}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                {t('kb.updatedAgo', 'Updated {{date}}').replace(
                  '{{date}}',
                  formatArticleDate(art) || t('kb.recentlyUpdated', 'Recently updated'),
                )}
              </p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
