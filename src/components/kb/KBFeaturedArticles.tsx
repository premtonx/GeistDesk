import React from 'react';
import { Clock, Eye, Sparkles, ThumbsUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { formatArticleDate, getStatusBadgeClass, statusLabelKey, stripHtml } from './kb-utils';

export interface KBArticleItem {
  id: string;
  title: string;
  content?: string;
  category?: string;
  status?: string;
  owner?: string;
  views?: number;
  helpfulCount?: number;
  avgReadTime?: string;
  trustScore?: number;
  updatedAt?: { toDate?: () => Date };
}

interface KBFeaturedArticlesProps {
  articles: KBArticleItem[];
  onSelect: (article: KBArticleItem) => void;
  className?: string;
}

export function KBFeaturedArticles({ articles, onSelect, className }: KBFeaturedArticlesProps) {
  const { t } = useTranslation();

  if (articles.length === 0) return null;

  return (
    <section className={className}>
      <h2 className="text-sm font-semibold text-slate-900 mb-3">
        {t('kb.featuredTitle', 'Featured Articles')}
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {articles.map((art) => (
          <button
            key={art.id}
            type="button"
            onClick={() => onSelect(art)}
            className={cn(
              'text-left rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm',
              'hover:shadow-md hover:border-blue-200 transition-all group',
            )}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 line-clamp-2 leading-snug">
                {art.title}
              </h3>
              <span
                className={cn(
                  'shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  'bg-indigo-50 text-indigo-700 border border-indigo-100',
                )}
              >
                <Sparkles className="w-3 h-3" />
                {art.trustScore ?? 92}%
              </span>
            </div>
            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
              {stripHtml(art.content ?? '').slice(0, 140)}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-6 w-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600">
                  {art.owner?.charAt(0) ?? 'A'}
                </span>
                {art.owner ?? t('kb.unassignedOwner', 'Unassigned')}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatArticleDate(art) || t('kb.recentlyUpdated', 'Recently updated')}
              </span>
              <span>{art.avgReadTime ?? '3m'}</span>
              <span className="inline-flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {(art.views ?? 0).toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1">
                <ThumbsUp className="w-3 h-3 text-emerald-500" />
                {art.helpfulCount ?? 0}
              </span>
            </div>
            <span
              className={cn(
                'inline-flex mt-3 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border',
                getStatusBadgeClass(art.status),
              )}
            >
              {t(statusLabelKey(art.status), art.status ?? 'Draft')}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
