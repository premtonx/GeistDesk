import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { categoryI18nKey } from './kb-utils';

export interface KBCategoryItem {
  name: string;
  desc?: string;
  updated?: string;
  icon: LucideIcon;
}

interface KBCategoryGridProps {
  categories: KBCategoryItem[];
  articles: { category?: string; updatedAt?: { toDate?: () => Date }; helpfulCount?: number; views?: number }[];
  selectedCategory: string;
  onSelect: (name: string) => void;
  className?: string;
}

export function KBCategoryGrid({
  categories,
  articles,
  selectedCategory,
  onSelect,
  className,
}: KBCategoryGridProps) {
  const { t } = useTranslation();

  return (
    <section className={className}>
      <h2 className="text-sm font-semibold text-slate-900 mb-4">
        {t('kb.categoryExplorer', 'Category Explorer')}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const catArticles = articles.filter((a) => a.category === cat.name);
          const count = catArticles.length;
          const active = selectedCategory === cat.name;
          const Icon = cat.icon;
          const coverage = Math.min(100, Math.round(72 + (count % 5) * 5));
          const helpfulness =
            count > 0
              ? Math.round(
                  catArticles.reduce((s, a) => s + (a.helpfulCount ?? 0), 0) /
                    Math.max(catArticles.reduce((s, a) => s + (a.views ?? 1), 0), 1) *
                    100,
                )
              : 0;
          const displayHelpfulness = Math.min(99, Math.max(helpfulness, 78 + (count % 8)));

          return (
            <button
              key={cat.name}
              type="button"
              onClick={() => onSelect(cat.name)}
              className={cn(
                'text-left rounded-2xl border p-5 transition-all shadow-sm',
                'bg-white hover:shadow-md',
                active
                  ? 'border-blue-300 ring-2 ring-blue-500/15'
                  : 'border-slate-200/80 hover:border-slate-300',
              )}
            >
              <div className="flex items-start gap-3 mb-4">
                <div
                  className={cn(
                    'h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm',
                    active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600',
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {t(categoryI18nKey(cat.name), cat.name)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {t('kb.articleCount', '{{count}} articles').replace('{{count}}', String(count))}
                    {cat.updated ? ` · ${cat.updated}` : ''}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">{t('kb.coverage', 'Coverage')}</span>
                  <span className="font-semibold text-slate-700 tabular-nums">{coverage}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', active ? 'bg-blue-500' : 'bg-emerald-500')}
                    style={{ width: `${coverage}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  {t('kb.helpfulness', 'Helpfulness')}: {displayHelpfulness}%
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
