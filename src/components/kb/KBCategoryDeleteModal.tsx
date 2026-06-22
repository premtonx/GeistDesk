import React, { useState } from 'react';
import { AlertTriangle, Trash2, FolderInput } from 'lucide-react';
import { useTranslation } from '../../lib/context/I18nContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import type { KBCategoryRecord } from './kbCategoryUtils';

export type CategoryDeleteStrategy = 'reassign' | 'purge';

interface KBCategoryDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: KBCategoryRecord | null;
  articleCount: number;
  onConfirm: (strategy: CategoryDeleteStrategy) => void;
}

export function KBCategoryDeleteModal({
  open,
  onOpenChange,
  category,
  articleCount,
  onConfirm,
}: KBCategoryDeleteModalProps) {
  const { t } = useTranslation();
  const [strategy, setStrategy] = useState<CategoryDeleteStrategy>('reassign');

  if (!category) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            {t('kb.categoryDelete.title', 'Delete category?')}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {t(
              'kb.categoryDelete.description',
              'You are about to remove "{{name}}" which contains {{count}} articles. Choose how to handle the content.',
            )
              .replace('{{name}}', category.name)
              .replace('{{count}}', String(articleCount))}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <button
            type="button"
            onClick={() => setStrategy('reassign')}
            className={cn(
              'w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
              strategy === 'reassign'
                ? 'border-blue-300 bg-blue-50/50 ring-2 ring-blue-500/10'
                : 'border-slate-200 hover:border-slate-300',
            )}
          >
            <FolderInput className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {t('kb.categoryDelete.reassignTitle', 'Move to Uncategorized')}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('kb.categoryDelete.reassignDesc', 'Safely reassign all articles to the Uncategorized fallback bucket.')}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStrategy('purge')}
            className={cn(
              'w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
              strategy === 'purge'
                ? 'border-rose-300 bg-rose-50/50 ring-2 ring-rose-500/10'
                : 'border-slate-200 hover:border-slate-300',
            )}
          >
            <Trash2 className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {t('kb.categoryDelete.purgeTitle', 'Delete all articles')}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('kb.categoryDelete.purgeDesc', 'Permanently remove the category and every article inside it.')}
              </p>
            </div>
          </button>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            {t('actions.cancel', 'Cancel')}
          </Button>
          <Button
            variant="destructive"
            className="rounded-xl"
            onClick={() => {
              onConfirm(strategy);
              onOpenChange(false);
            }}
          >
            {strategy === 'purge'
              ? t('kb.categoryDelete.confirmPurge', 'Delete everything')
              : t('kb.categoryDelete.confirmReassign', 'Move & delete category')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
