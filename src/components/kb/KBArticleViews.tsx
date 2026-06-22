import React from 'react';
import { Eye, PenLine, Trash2, FileText, Clock, MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
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
} from './kb-utils';
import { KB_LIST_GRID, KB_LIST_HEADER_CELL } from './kbListLayout';
import type { KBArticleViewMode } from './KBViewModeSelector';
import type { KBArticleItem } from './KBFeaturedArticles';
import type { KBCategoryRecord } from './kbCategoryUtils';
import { getCategoryDisplayName } from './kbCategoryUtils';

interface KBArticleViewsProps {
  articles: KBArticleItem[];
  viewMode: KBArticleViewMode;
  categories?: KBCategoryRecord[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onSelect: (article: KBArticleItem) => void;
  onEdit: (article: KBArticleItem) => void;
  onDuplicate: (article: KBArticleItem) => void;
  onDelete: (id: string) => void;
  onResetFilters?: () => void;
}

export function KBArticleViews({
  articles,
  viewMode,
  categories = [],
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  onResetFilters,
}: KBArticleViewsProps) {
  const { t } = useTranslation();
  const allSelected = articles.length > 0 && articles.every((a) => selectedIds.has(a.id));

  if (articles.length === 0) {
    return <EmptyState onResetFilters={onResetFilters} />;
  }

  if (viewMode === 'table') {
    return (
      <TableView
        articles={articles}
        categories={categories}
        selectedIds={selectedIds}
        allSelected={allSelected}
        onToggleSelect={onToggleSelect}
        onToggleSelectAll={onToggleSelectAll}
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
            categories={categories}
            selected={selectedIds.has(art.id)}
            onToggleSelect={() => onToggleSelect(art.id)}
            onSelect={onSelect}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    );
  }

  return (
    <ListView
      articles={articles}
      categories={categories}
      selectedIds={selectedIds}
      allSelected={allSelected}
      onToggleSelect={onToggleSelect}
      onToggleSelectAll={onToggleSelectAll}
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

function CategoryLabel({
  art,
  categories,
}: {
  art: KBArticleItem;
  categories: KBCategoryRecord[];
}) {
  const { t } = useTranslation();
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 w-fit truncate">
      {getCategoryDisplayName(art.category, categories, t, categoryI18nKey)}
    </span>
  );
}

function ListView({
  articles,
  categories,
  selectedIds,
  allSelected,
  onToggleSelect,
  onToggleSelectAll,
  onSelect,
  onEdit,
  onDelete,
}: {
  articles: KBArticleItem[];
  categories: KBCategoryRecord[];
  selectedIds: Set<string>;
  allSelected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onSelect: (a: KBArticleItem) => void;
  onEdit: (a: KBArticleItem) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className={kbPanelClass()}>
      <div className={cn('hidden md:grid px-4 py-2 border-b border-slate-100 bg-slate-50/80 items-center', KB_LIST_GRID, '[grid-template-columns:2rem_1fr_repeat(4,minmax(0,1fr))]')}>
        <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} aria-label={t('kb.bulk.selectAll', 'Select all')} />
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
            className={cn(
              'grid px-4 py-2 hover:bg-slate-50/60 cursor-pointer group items-center',
              KB_LIST_GRID,
              '[grid-template-columns:2rem_1fr_repeat(4,minmax(0,1fr))]',
              selectedIds.has(art.id) && 'bg-blue-50/40',
            )}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selectedIds.has(art.id)}
                onCheckedChange={() => onToggleSelect(art.id)}
                aria-label={t('kb.bulk.selectItem', 'Select article')}
              />
            </div>
            <p
              className="text-xs font-semibold text-slate-900 truncate group-hover:text-blue-600"
              onClick={() => onSelect(art)}
            >
              {art.title}
            </p>
            <CategoryLabel art={art} categories={categories} />
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
  categories,
  selectedIds,
  allSelected,
  onToggleSelect,
  onToggleSelectAll,
  onSelect,
  onEdit,
  onDelete,
}: {
  articles: KBArticleItem[];
  categories: KBCategoryRecord[];
  selectedIds: Set<string>;
  allSelected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
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
              <th className="px-4 py-3 w-10">
                <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} aria-label={t('kb.bulk.selectAll', 'Select all')} />
              </th>
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
              <tr
                key={art.id}
                onClick={() => onSelect(art)}
                className={cn('hover:bg-slate-50/50 cursor-pointer', selectedIds.has(art.id) && 'bg-blue-50/40')}
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(art.id)}
                    onCheckedChange={() => onToggleSelect(art.id)}
                    aria-label={t('kb.bulk.selectItem', 'Select article')}
                  />
                </td>
                <td className="px-4 py-3 max-w-[240px]">
                  <p className="font-semibold text-slate-900 truncate">{art.title}</p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{stripHtml(art.content ?? '').slice(0, 60)}</p>
                </td>
                <td className="px-4 py-3">
                  <CategoryLabel art={art} categories={categories} />
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
  categories,
  selected,
  onToggleSelect,
  onSelect,
  onEdit,
  onDelete,
}: {
  art: KBArticleItem;
  categories: KBCategoryRecord[];
  selected: boolean;
  onToggleSelect: () => void;
  onSelect: (a: KBArticleItem) => void;
  onEdit: (a: KBArticleItem) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const score = art.trustScore ?? 85;
  const readTime = estimateReadTime(art.content, art.avgReadTime);

  return (
    <div
      className={cn(
        'border border-slate-200/80 bg-white p-4 cursor-pointer group hover:border-blue-200 hover:shadow-md transition-all flex flex-col h-full rounded-xl relative',
        selected && 'border-blue-300 ring-2 ring-blue-500/15 bg-blue-50/20',
      )}
    >
      <div
        className="absolute top-3 left-3 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label={t('kb.bulk.selectItem', 'Select article')} />
      </div>
      <div onClick={() => onSelect(art)} className="flex flex-col h-full pl-6">
        <div className="flex items-start justify-between gap-2 mb-2">
          <CategoryLabel art={art} categories={categories} />
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
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(art.id); }}
            className="p-1 rounded-md hover:bg-rose-50 text-rose-500 opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
