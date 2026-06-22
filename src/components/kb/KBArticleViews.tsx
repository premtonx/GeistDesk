import React from 'react';
import {
  Eye,
  PenLine,
  Trash2,
  ThumbsUp,
  Bookmark,
  FileText,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';
import {
  formatArticleDate,
  getStatusBadgeClass,
  statusLabelKey,
  stripHtml,
  categoryI18nKey,
} from './kb-utils';
import type { KBArticleViewMode } from './KBViewModeSelector';
import type { KBArticleItem } from './KBFeaturedArticles';

interface KBArticleViewsProps {
  articles: KBArticleItem[];
  viewMode: KBArticleViewMode;
  onSelect: (article: KBArticleItem) => void;
  onEdit: (article: KBArticleItem) => void;
  onDuplicate: (article: KBArticleItem) => void;
  onDelete: (id: string) => void;
  onResetFilters?: () => void;
}

export function KBArticleViews({
  articles,
  viewMode,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  onResetFilters,
}: KBArticleViewsProps) {
  const { t } = useTranslation();

  if (articles.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white p-12 text-center flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
          <FileText className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-700 text-sm">{t('kb.noArticlesMatched', 'No articles matched in active criteria')}</h3>
          <p className="text-slate-400 text-xs mt-1">{t('kb.tryResetting', 'Try resetting the custom filters or matching another category.')}</p>
        </div>
        {onResetFilters ? (
          <Button className="bg-blue-600 hover:bg-blue-700 text-white h-9 text-xs rounded-xl" onClick={onResetFilters}>
            {t('kb.resetWorkspaceFilter', 'Reset Workspace Filter State')}
          </Button>
        ) : null}
      </div>
    );
  }

  if (viewMode === 'table') {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                <th className="px-4 py-3">{t('kb.table.title', 'Title')}</th>
                <th className="px-4 py-3">{t('kb.table.category', 'Category')}</th>
                <th className="px-4 py-3">{t('kb.table.workflowStatus', 'Status')}</th>
                <th className="px-4 py-3">{t('kb.table.metadataOwner', 'Owner')}</th>
                <th className="px-4 py-3">{t('kb.table.updated', 'Updated')}</th>
                <th className="px-4 py-3">{t('kb.table.views', 'Views')}</th>
                <th className="px-4 py-3">{t('kb.table.likes', 'Likes')}</th>
                <th className="px-4 py-3 text-right">{t('kb.table.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {articles.map((art) => (
                <tr key={art.id} onClick={() => onSelect(art)} className="hover:bg-slate-50/50 cursor-pointer">
                  <td className="px-4 py-3 max-w-[240px]">
                    <p className="font-semibold text-slate-900 truncate">{art.title}</p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{stripHtml(art.content ?? '').slice(0, 60)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {t(categoryI18nKey(art.category ?? ''), art.category ?? '—')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', getStatusBadgeClass(art.status))}>
                      {t(statusLabelKey(art.status), art.status ?? 'Draft')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{art.owner ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{formatArticleDate(art)}</td>
                  <td className="px-4 py-3 font-medium tabular-nums">{art.views ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-slate-600">
                      <ThumbsUp className="w-3 h-3 text-emerald-500" />
                      {art.helpfulCount ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onSelect(art)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(art)}>
                        <PenLine className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => onDelete(art.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {articles.map((art) => (
          <ArticleCard key={art.id} art={art} compact onSelect={onSelect} onEdit={onEdit} onDuplicate={onDuplicate} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {articles.map((art) => (
        <ArticleCard key={art.id} art={art} onSelect={onSelect} onEdit={onEdit} onDuplicate={onDuplicate} />
      ))}
    </div>
  );
}

function ArticleCard({
  art,
  compact,
  onSelect,
  onEdit,
  onDuplicate,
}: {
  art: KBArticleItem;
  compact?: boolean;
  onSelect: (a: KBArticleItem) => void;
  onEdit: (a: KBArticleItem) => void;
  onDuplicate: (a: KBArticleItem) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      onClick={() => onSelect(art)}
      className={cn(
        'rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group',
        compact ? 'p-4 flex flex-col h-full' : 'p-5 flex flex-col sm:flex-row sm:items-center gap-4',
      )}
    >
      <div className={cn('min-w-0 flex-1', !compact && 'space-y-1')}>
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {t(categoryI18nKey(art.category ?? ''), art.category ?? '—')}
          </span>
          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', getStatusBadgeClass(art.status))}>
            {t(statusLabelKey(art.status), art.status ?? 'Draft')}
          </span>
        </div>
        <h3 className={cn('font-bold text-slate-900 group-hover:text-blue-600', compact ? 'text-sm line-clamp-2' : 'text-base')}>
          {art.title}
        </h3>
        <p className={cn('text-slate-500 leading-relaxed', compact ? 'text-[11px] line-clamp-2 mt-1' : 'text-xs line-clamp-1 mt-1')}>
          {stripHtml(art.content ?? '').slice(0, compact ? 90 : 160)}
        </p>
      </div>
      <div className={cn('flex items-center gap-3 text-[11px] text-slate-500 shrink-0', compact && 'mt-3 pt-3 border-t border-slate-100 justify-between')}>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-6 w-6 rounded-full bg-slate-100 text-[9px] font-bold flex items-center justify-center">
            {art.owner?.charAt(0) ?? 'A'}
          </span>
          <span className="truncate max-w-[80px]">{art.owner ?? '—'}</span>
        </span>
        <span>{formatArticleDate(art)}</span>
        <span className="tabular-nums">{(art.views ?? 0).toLocaleString()} {t('kb.viewsLabel', 'views')}</span>
        <span className="inline-flex items-center gap-0.5">
          <ThumbsUp className="w-3 h-3 text-emerald-500" />
          {art.helpfulCount ?? 0}
        </span>
        <div className="flex gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => onEdit(art)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-600">
            <PenLine className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => onDuplicate(art)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-emerald-600">
            <Bookmark className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
