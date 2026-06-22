import React from 'react';
import { Trash2, X } from 'lucide-react';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface KBBulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  onBulkDelete: () => void;
  className?: string;
}

export function KBBulkActionBar({ selectedCount, onClear, onBulkDelete, className }: KBBulkActionBarProps) {
  const { t } = useTranslation();

  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl',
        'bg-slate-900 text-white shadow-lg animate-in slide-in-from-top-2 duration-200',
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onClear}
          className="p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
          aria-label={t('kb.bulk.clearSelection', 'Clear selection')}
        >
          <X className="w-4 h-4" />
        </button>
        <span className="text-xs font-semibold truncate">
          {t('kb.bulk.itemsSelected', '{{count}} items selected').replace('{{count}}', String(selectedCount))}
        </span>
      </div>
      <Button
        size="sm"
        variant="destructive"
        className="h-8 rounded-lg text-xs font-semibold gap-1.5 shrink-0 bg-rose-600 hover:bg-rose-700"
        onClick={onBulkDelete}
      >
        <Trash2 className="w-3.5 h-3.5" />
        {t('kb.bulk.deleteSelected', 'Bulk Delete')}
      </Button>
    </div>
  );
}
