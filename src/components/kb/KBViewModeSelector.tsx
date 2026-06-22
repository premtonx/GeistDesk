import React from 'react';
import { LayoutGrid, List, FolderTree, BookOpen } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';

export type KBArticleViewMode = 'list' | 'tree' | 'grid' | 'wiki';

interface KBViewModeSelectorProps {
  value: KBArticleViewMode;
  onChange: (mode: KBArticleViewMode) => void;
  className?: string;
}

const MODES: { id: KBArticleViewMode; icon: React.ReactNode; labelKey: string; defaultLabel: string }[] = [
  { id: 'list', icon: <List className="w-3.5 h-3.5" />, labelKey: 'kb.layout.list', defaultLabel: 'List' },
  { id: 'tree', icon: <FolderTree className="w-3.5 h-3.5" />, labelKey: 'kb.layout.tree', defaultLabel: 'Tree' },
  { id: 'grid', icon: <LayoutGrid className="w-3.5 h-3.5" />, labelKey: 'kb.layout.grid', defaultLabel: 'Grid' },
  { id: 'wiki', icon: <BookOpen className="w-3.5 h-3.5" />, labelKey: 'kb.layout.wiki', defaultLabel: 'Wiki' },
];

export function KBViewModeSelector({ value, onChange, className }: KBViewModeSelectorProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'inline-flex h-8 items-center rounded-lg border border-slate-200/80 bg-slate-50/80 p-0.5 shrink-0',
        className,
      )}
      role="group"
      aria-label={t('kb.views', 'Views')}
    >
      {MODES.map((mode) => {
        const active = value === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            title={t(mode.labelKey, mode.defaultLabel)}
            onClick={() => onChange(mode.id)}
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors',
              active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {mode.icon}
            <span className="hidden md:inline">{t(mode.labelKey, mode.defaultLabel)}</span>
          </button>
        );
      })}
    </div>
  );
}
