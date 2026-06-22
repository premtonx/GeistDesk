import React from 'react';
import {
  Sparkles,
  Mic,
  SlidersHorizontal,
  Plus,
  FolderPlus,
  Upload,
  Wand2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';

interface KBSearchSectionProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onNewArticle: () => void;
  onNewCategory: () => void;
  onImportDocs: () => void;
  onAiGenerate: () => void;
  onAdvancedFilters?: () => void;
  showFilters?: boolean;
  className?: string;
}

export function KBSearchSection({
  searchQuery,
  onSearchChange,
  onNewArticle,
  onNewCategory,
  onImportDocs,
  onAiGenerate,
  onAdvancedFilters,
  showFilters,
  className,
}: KBSearchSectionProps) {
  const { t } = useTranslation();

  const quickActions = [
    { key: 'newArticle', label: t('kb.actions.newArticle', 'New Article'), icon: Plus, onClick: onNewArticle, primary: true },
    { key: 'newCategory', label: t('kb.actions.newCategory', 'New Category'), icon: FolderPlus, onClick: onNewCategory },
    { key: 'importDocs', label: t('kb.actions.importDocs', 'Import Docs'), icon: Upload, onClick: onImportDocs },
    { key: 'aiGenerate', label: t('kb.actions.aiGenerate', 'AI Generate Article'), icon: Wand2, onClick: onAiGenerate },
  ];

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
          <Sparkles className="w-4 h-4 text-blue-500" />
        </div>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('kb.aiSearchPlaceholder', 'Ask Geist AI or search documentation...')}
          className={cn(
            'w-full h-12 pl-11 pr-36 rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-sm',
            'text-sm text-slate-800 placeholder:text-slate-400 shadow-sm',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all',
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          <kbd className="hidden sm:inline-flex h-6 items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-400">
            ⌘K
          </kbd>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50"
            aria-label={t('kb.voiceSearch', 'Voice search')}
          >
            <Mic className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onAdvancedFilters}
            className={cn(
              'h-8 w-8 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50',
              showFilters && 'bg-blue-50 text-blue-600',
            )}
            aria-label={t('kb.advancedFilters', 'Advanced filters')}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {quickActions.map((action) => (
          <Button
            key={action.key}
            type="button"
            variant={action.primary ? 'default' : 'outline'}
            size="sm"
            onClick={action.onClick}
            className={cn(
              'h-9 rounded-xl text-xs font-semibold gap-1.5',
              action.primary
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                : 'border-slate-200/80 text-slate-700 hover:bg-slate-50',
            )}
          >
            <action.icon className="w-3.5 h-3.5" />
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
