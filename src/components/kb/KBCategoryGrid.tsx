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
  articles: { category?: string; updatedAt?: { toDate?: () => Date } }[];
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
      <h2 className="text-sm font-semibold text-slate-900 mb-3">
        {t('kb.categoriesTitle', 'Categories')}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {categories.map((cat) => {
          const count = articles.filter((a) => a.category === cat.name).length;
          const active = selectedCategory === cat.name;
          const Icon = cat.icon;
          const progress = Math.min(100, Math.round((count / Math.max(count + 2, 5)) * 100));

          return (
            <button
              key={cat.name}
              type="button"
              onClick={() => onSelect(cat.name)}
              className={cn(
                'text-left rounded-2xl border p-4 transition-all',
                'bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md',
                active
                  ? 'border-blue-300 ring-2 ring-blue-500/20 bg-blue-50/30'
                  : 'border-slate-200/80 hover:border-slate-300',
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
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
              <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', active ? 'bg-blue-500' : 'bg-slate-300')}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
