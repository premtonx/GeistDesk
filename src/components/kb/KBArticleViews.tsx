import React, { useMemo, useState } from 'react';
import {
  Eye,
  PenLine,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileText,
  Clock,
  Sparkles,
} from 'lucide-react';
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
  buildCategoryTree,
  estimateReadTime,
  qualityBarClass,
  kbPanelClass,
  KB_RADIUS,
} from './kb-utils';
import type { KBArticleViewMode } from './KBViewModeSelector';
import type { KBArticleItem } from './KBFeaturedArticles';
import type { KBCategoryItem } from './KBCategoryGrid';
import { KBFeaturedArticles } from './KBFeaturedArticles';

interface KBArticleViewsProps {
  articles: KBArticleItem[];
  viewMode: KBArticleViewMode;
  categories?: KBCategoryItem[];
  selectedCategory?: string;
  onCategorySelect?: (name: string) => void;
  featuredArticles?: KBArticleItem[];
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
  selectedCategory = 'All',
  onCategorySelect,
  featuredArticles = [],
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  onResetFilters,
}: KBArticleViewsProps) {
  const { t } = useTranslation();

  if (articles.length === 0 && viewMode !== 'wiki') {
    return <EmptyState onResetFilters={onResetFilters} />;
  }

  if (viewMode === 'wiki') {
    return (
      <WikiHubView
        categories={categories}
        articles={articles}
        featuredArticles={featuredArticles}
        selectedCategory={selectedCategory}
        onCategorySelect={onCategorySelect}
        onSelect={onSelect}
      />
    );
  }

  if (viewMode === 'tree') {
    return (
      <TreeDirectoryView
        articles={articles}
        onSelect={onSelect}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {articles.map((art) => (
          <GridArticleCard
            key={art.id}
            art={art}
            onSelect={onSelect}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
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
      <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_110px_90px_100px_80px_60px] gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/80 text-[10px] uppercase font-semibold tracking-wider text-slate-400">
        <span>{t('kb.table.title', 'Title')}</span>
        <span>{t('kb.table.category', 'Category')}</span>
        <span>{t('kb.table.workflowStatus', 'Status')}</span>
        <span>{t('kb.table.metadataOwner', 'Owner')}</span>
        <span>{t('kb.table.updated', 'Updated')}</span>
        <span className="text-right">{t('kb.table.views', 'Views')}</span>
      </div>
      <div className="divide-y divide-slate-100">
        {articles.map((art) => (
          <div
            key={art.id}
            onClick={() => onSelect(art)}
            className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_110px_90px_100px_80px_60px] gap-2 px-3 py-2 hover:bg-slate-50/60 cursor-pointer items-center group"
          >
            <div className="min-w-0 flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-900 truncate group-hover:text-blue-600">{art.title}</p>
              <div className="md:hidden flex gap-1 ml-auto shrink-0" onClick={(e) => e.stopPropagation()}>
                <RowActions art={art} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} />
              </div>
            </div>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 w-fit truncate max-w-full">
              {t(categoryI18nKey(art.category ?? ''), art.category ?? '—')}
            </span>
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-lg border w-fit', getStatusBadgeClass(art.status))}>
              {t(statusLabelKey(art.status), art.status ?? 'Draft')}
            </span>
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <Avatar className="h-5 w-5 border border-slate-200 shrink-0">
                <AvatarFallback className="text-[8px] bg-slate-100 text-slate-600 font-bold">
                  {art.owner?.charAt(0) ?? '?'}
                </AvatarFallback>
              </Avatar>
              <span className="text-[11px] text-slate-600 truncate hidden sm:inline">{art.owner ?? '—'}</span>
            </span>
            <span className="text-[11px] text-slate-400">{formatArticleDate(art)}</span>
            <div className="flex items-center justify-between md:justify-end gap-1">
              <span className="text-[11px] font-medium tabular-nums text-slate-600">{art.views ?? 0}</span>
              <div className="hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                <RowActions art={art} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RowActions({
  art,
  onSelect,
  onEdit,
  onDelete,
}: {
  art: KBArticleItem;
  onSelect: (a: KBArticleItem) => void;
  onEdit: (a: KBArticleItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex gap-0.5">
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onSelect(art)}>
        <Eye className="w-3 h-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(art)}>
        <PenLine className="w-3 h-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-500" onClick={() => onDelete(art.id)}>
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}

function TreeDirectoryView({
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
  const tree = useMemo(() => buildCategoryTree(articles), [articles]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(tree.map((n) => n.id)));
  const [activeNode, setActiveNode] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!activeNode) return articles;
    if (activeNode.includes('::')) {
      const [cat, sub] = activeNode.split('::');
      return articles.filter((a) => a.category === cat && (a.subCategory ?? 'General') === sub);
    }
    return articles.filter((a) => a.category === activeNode);
  }, [articles, activeNode]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={cn('flex flex-col lg:flex-row gap-3 min-h-[320px]', KB_RADIUS)}>
      <aside className={cn('lg:w-56 shrink-0 border border-slate-200/80 bg-white p-2', KB_RADIUS)}>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-1.5">
          {t('kb.structure', 'Knowledge Structure')}
        </p>
        <button
          type="button"
          onClick={() => setActiveNode(null)}
          className={cn(
            'w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium mb-1',
            activeNode === null ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50',
          )}
        >
          {t('kb.tabAll', 'All')} ({articles.length})
        </button>
        {tree.map((node) => {
          const isOpen = expanded.has(node.id);
          return (
            <div key={node.id}>
              <button
                type="button"
                onClick={() => {
                  toggle(node.id);
                  setActiveNode(node.id);
                }}
                className={cn(
                  'w-full flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium',
                  activeNode === node.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50',
                )}
              >
                {isOpen ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                <span className="truncate flex-1 text-left">{t(categoryI18nKey(node.label), node.label)}</span>
                <span className="text-slate-400 tabular-nums">{node.count}</span>
              </button>
              {isOpen && node.children?.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => setActiveNode(child.id)}
                  className={cn(
                    'w-full flex items-center gap-1 pl-6 pr-2 py-1 rounded-lg text-[11px]',
                    activeNode === child.id ? 'bg-blue-50/80 text-blue-700 font-medium' : 'text-slate-500 hover:bg-slate-50',
                  )}
                >
                  <span className="truncate flex-1 text-left">{child.label}</span>
                  <span className="text-slate-400 tabular-nums">{child.count}</span>
                </button>
              ))}
            </div>
          );
        })}
      </aside>
      <div className="flex-1 min-w-0">
        <ListView articles={filtered} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
}

function GridArticleCard({
  art,
  onSelect,
  onEdit,
  onDuplicate,
}: {
  art: KBArticleItem;
  onSelect: (a: KBArticleItem) => void;
  onEdit: (a: KBArticleItem) => void;
  onDuplicate: (a: KBArticleItem) => void;
}) {
  const { t } = useTranslation();
  const score = art.trustScore ?? 85;
  const readTime = estimateReadTime(art.content, art.avgReadTime);

  return (
    <div
      onClick={() => onSelect(art)}
      className={cn(
        'border border-slate-200/80 bg-white p-4 cursor-pointer group hover:border-blue-200 hover:shadow-sm transition-all flex flex-col h-full',
        KB_RADIUS,
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-lg border', getStatusBadgeClass(art.status))}>
          {t(statusLabelKey(art.status), art.status ?? 'Draft')}
        </span>
        <span className="text-[10px] text-slate-400 inline-flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {readTime}
        </span>
      </div>
      <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 line-clamp-2 leading-snug mb-1.5">
        {art.title}
      </h3>
      <p className="text-[11px] text-slate-500 line-clamp-3 leading-relaxed flex-1">
        {stripHtml(art.content ?? '').slice(0, 120)}
      </p>
      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            {t('kb.aiQualityScore', 'AI Quality Score')}
          </span>
          <span className="font-semibold text-slate-700 tabular-nums">{score}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', qualityBarClass(score))} style={{ width: `${score}%` }} />
        </div>
      </div>
      <div className="flex gap-1 mt-2 justify-end" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => onEdit(art)} className="p-1 rounded-md hover:bg-slate-100 text-slate-400">
          <PenLine className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => onDuplicate(art)} className="p-1 rounded-md hover:bg-slate-100 text-slate-400">
          <Eye className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function WikiHubView({
  categories,
  articles,
  featuredArticles,
  selectedCategory,
  onCategorySelect,
  onSelect,
}: {
  categories: KBCategoryItem[];
  articles: KBArticleItem[];
  featuredArticles: KBArticleItem[];
  selectedCategory?: string;
  onCategorySelect?: (name: string) => void;
  onSelect: (a: KBArticleItem) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          {t('kb.categoriesTitle', 'Categories')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {categories.map((cat) => {
            const count = articles.filter((a) => a.category === cat.name).length;
            const active = selectedCategory === cat.name;
            const Icon = cat.icon;
            return (
              <button
                key={cat.name}
                type="button"
                onClick={() => onCategorySelect?.(cat.name)}
                className={cn(
                  'text-left border p-4 transition-all',
                  KB_RADIUS,
                  active
                    ? 'border-blue-300 bg-blue-50/40 ring-1 ring-blue-500/20'
                    : 'border-slate-200/80 bg-white hover:border-slate-300',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{t(categoryI18nKey(cat.name), cat.name)}</p>
                    <p className="text-[11px] text-slate-500">{t('kb.articleCount', '{{count}} articles').replace('{{count}}', String(count))}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
      {featuredArticles.length > 0 ? (
        <KBFeaturedArticles articles={featuredArticles} onSelect={onSelect} />
      ) : null}
    </div>
  );
}
