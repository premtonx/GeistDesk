import React from 'react';
import { Eye, PenLine, Trash2, FileText, Clock, MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  formatArticleDate,
  getStatusBadgeClass,
  statusLabelKey,
  stripHtml,
  categoryI18nKey,
  estimateReadTime,
  qualityBarClass,
  kbPanelClass,
  KB_RADIUS,
} from './kb-utils';
import { KB_LIST_GRID, KB_LIST_HEADER_CELL } from './kbListLayout';
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
    return <EmptyState onResetFilters={onResetFilters} />;
  }

  if (viewMode === 'table') {
    return (
      <TableView
        articles={articles}
        onSelect={onSelect}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {articles.map((art) => (
          <GridArticleCard
            key={art.id}
            art={art}
            onSelect={onSelect}
            onEdit={onEdit}
          />
        ))}
      </div>
    );
  }

  return (
    <ListView
      articles={articles}
      onSelect={onSelect}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}

function EmptyState({ onResetFilters }: { onResetFilters?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={cn(kbPanelClass(), 'p-12 text-center flex flex-col items-center justify-center space-y-4')}>
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
        <FileText className="w-6 h-6" />
      </div>
      <div>
        <h3 className="font-semibold text-slate-700 text-sm">{t('kb.noArticlesMatched', 'No articles matched in active criteria')}</h3>
        <p className="text-slate-400 text-xs mt-1">{t('kb.tryResetting', 'Try resetting the custom filters or matching another category.')}</p>
      </div>
      {onResetFilters ? (
        <Button className="bg-blue-600 hover:bg-blue-700 text-white h-9 text-xs rounded-lg" onClick={onResetFilters}>
          {t('kb.resetWorkspaceFilter', 'Reset Workspace Filter State')}
        </Button>
      ) : null}
    </div>
  );
}

function ListView({
  articles,
  onSelect,
  onEdit,
  onDelete,
}: {
  articles: KBArticleItem[];
  onSelect: (a: KBArticleItem) => void;
  onEdit: (a: KBArticleItem) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className={kbPanelClass()}>
      <div className={cn('hidden md:grid px-4 py-2 border-b border-slate-100 bg-slate-50/80', KB_LIST_GRID)}>
        <span className={KB_LIST_HEADER_CELL}>{t('kb.table.title', 'Title')}</span>
        <span className={KB_LIST_HEADER_CELL}>{t('kb.table.category', 'Category')}</span>
        <span className={KB_LIST_HEADER_CELL}>{t('kb.table.workflowStatus', 'Status')}</span>
        <span className={KB_LIST_HEADER_CELL}>{t('kb.table.metadataOwner', 'Owner')}</span>
        <span className={cn(KB_LIST_HEADER_CELL, 'text-right')}>{t('kb.table.views', 'Views')}</span>
      </div>
      <div className="divide-y divide-slate-100">
        {articles.map((art) => (
          <div
            key={art.id}
            onClick={() => onSelect(art)}
            className={cn(KB_LIST_GRID, 'px-4 py-2 hover:bg-slate-50/60 cursor-pointer group')}
          >
            <p className="text-xs font-semibold text-slate-900 truncate group-hover:text-blue-600">{art.title}</p>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 w-fit truncate">
              {t(categoryI18nKey(art.category ?? ''), art.category ?? '—')}
            </span>
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-lg border w-fit', getStatusBadgeClass(art.status))}>
              {t(statusLabelKey(art.status), art.status ?? 'Draft')}
            </span>
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <Avatar className="h-5 w-5 border border-slate-200 shrink-0">
                <AvatarFallback className="text-[8px] bg-slate-100 font-bold">{art.owner?.charAt(0) ?? '?'}</AvatarFallback>
              </Avatar>
              <span className="text-[11px] text-slate-600 truncate">{art.owner ?? '—'}</span>
            </span>
            <span className="text-[11px] font-medium tabular-nums text-slate-600 text-right">{art.views ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableView({
  articles,
  onSelect,
  onEdit,
  onDelete,
}: {
  articles: KBArticleItem[];
  onSelect: (a: KBArticleItem) => void;
  onEdit: (a: KBArticleItem) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className={kbPanelClass()}>
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
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                    {t(categoryI18nKey(art.category ?? ''), art.category ?? '—')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-lg border', getStatusBadgeClass(art.status))}>
                    {t(statusLabelKey(art.status), art.status ?? 'Draft')}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{art.owner ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400">{formatArticleDate(art)}</td>
                <td className="px-4 py-3 font-medium tabular-nums">{art.views ?? 0}</td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
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

function GridArticleCard({
  art,
  onSelect,
  onEdit,
}: {
  art: KBArticleItem;
  onSelect: (a: KBArticleItem) => void;
  onEdit: (a: KBArticleItem) => void;
}) {
  const { t } = useTranslation();
  const score = art.trustScore ?? 85;
  const readTime = estimateReadTime(art.content, art.avgReadTime);

  return (
    <div
      onClick={() => onSelect(art)}
      className={cn(
        'border border-slate-200/80 bg-white p-4 cursor-pointer group hover:border-blue-200 hover:shadow-md transition-all flex flex-col h-full rounded-2xl',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700">
          {t(categoryI18nKey(art.category ?? ''), art.category ?? '—')}
        </span>
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-lg border', getStatusBadgeClass(art.status))}>
          {t(statusLabelKey(art.status), art.status ?? 'Draft')}
        </span>
      </div>
      <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 line-clamp-2 leading-snug mb-1.5">
        {art.title}
      </h3>
      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed flex-1 mb-3">
        {stripHtml(art.content ?? '').slice(0, 100)}
      </p>
      <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-100 pt-3">
        <span className="inline-flex items-center gap-1.5">
          <Avatar className="h-5 w-5 border border-slate-200">
            <AvatarFallback className="text-[8px] font-bold">{art.owner?.charAt(0) ?? '?'}</AvatarFallback>
          </Avatar>
          {art.owner ?? '—'}
        </span>
        <span>{formatArticleDate(art)}</span>
        <span className="tabular-nums font-medium">{art.views ?? 0} {t('kb.viewsLabel', 'views')}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
        <Clock className="w-3 h-3" />
        {readTime}
        <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden ml-1">
          <div className={cn('h-full rounded-full', qualityBarClass(score))} style={{ width: `${score}%` }} />
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(art); }}
          className="p-1 rounded-md hover:bg-slate-100 opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
