import { useCallback, useEffect, useState } from 'react';
import {
  FolderPlus,
  Pencil,
  Settings,
  Trash2,
} from 'lucide-react';
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
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../../lib/utils';
import type { KBCategoryRecord } from './kbCategoryUtils';
import { mapDbCategoryToRecord } from './kbCategoryUtils';
import { KBCategoryDeleteModal, type CategoryDeleteStrategy } from './KBCategoryDeleteModal';
import { kbCategoryApi } from '../../services/kbDashboardApi';
import { toast } from 'sonner';

interface KBCategoryAdminPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: KBCategoryRecord[];
  articleCountByCategory: (categoryId: string) => number;
  onCategoriesChange: (categories: KBCategoryRecord[]) => void;
}

export function KBCategoryAdminPanel({
  open,
  onOpenChange,
  categories,
  articleCountByCategory,
  onCategoriesChange,
}: KBCategoryAdminPanelProps) {
  const { t } = useTranslation();
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<KBCategoryRecord | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setNewName('');
      setNewDesc('');
      setEditingId(null);
      setDeleteTarget(null);
    }
  }, [open]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const { category } = await kbCategoryApi.create({
        name: newName.trim(),
        desc: newDesc.trim(),
        order: categories.length + 1,
      });
      onCategoriesChange([
        ...categories,
        mapDbCategoryToRecord(category, categories.length + 1),
      ]);
      setNewName('');
      setNewDesc('');
      toast.success(t('kb.categoryAdd.success', 'Category registered successfully.'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create category.');
    } finally {
      setBusy(false);
    }
  }, [categories, newDesc, newName, onCategoriesChange, t]);

  const handleRename = useCallback(
    async (categoryId: string) => {
      if (!editingName.trim()) return;
      setBusy(true);
      try {
        const { category } = await kbCategoryApi.update(categoryId, { name: editingName.trim() });
        onCategoriesChange(
          categories.map((c) =>
            c.id === categoryId ? mapDbCategoryToRecord(category, c.order) : c,
          ),
        );
        setEditingId(null);
        toast.success(t('kb.categoryRename.success', 'Category renamed. Article references preserved.'));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to rename category.');
      } finally {
        setBusy(false);
      }
    },
    [categories, editingName, onCategoriesChange, t],
  );

  const handleDelete = useCallback(
    async (strategy: CategoryDeleteStrategy) => {
      if (!deleteTarget) return;
      setBusy(true);
      try {
        await kbCategoryApi.remove(deleteTarget.id, strategy);
        onCategoriesChange(categories.filter((c) => c.id !== deleteTarget.id));
        toast.success(
          strategy === 'reassign'
            ? t('kb.categoryDelete.reassignedToast', '{{count}} articles moved to Uncategorized.').replace(
                '{{count}}',
                String(articleCountByCategory(deleteTarget.id)),
              )
            : t('kb.categoryDelete.purgedToast', '{{count}} articles queued for deletion.').replace(
                '{{count}}',
                String(articleCountByCategory(deleteTarget.id)),
              ),
        );
        setDeleteTarget(null);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to delete category.');
      } finally {
        setBusy(false);
      }
    },
    [articleCountByCategory, categories, deleteTarget, onCategoriesChange, t],
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Settings className="w-4 h-4 text-slate-500" />
              {t('kb.categoryAdmin.title', 'Category Administration')}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              {t(
                'kb.categoryAdmin.description',
                'Manage knowledge base categories. Changes sync to the live database.',
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 py-4 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <FolderPlus className="w-3 h-3" />
                {t('kb.categoryAdd.title', 'Create category')}
              </p>
              <div className="space-y-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('kb.categoryAdd.namePlaceholder', 'Category name')}
                  className="h-9 rounded-lg text-sm"
                />
                <Input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={t('kb.categoryAdd.descPlaceholder', 'Short description (optional)')}
                  className="h-9 rounded-lg text-sm"
                />
                <Button
                  size="sm"
                  className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm"
                  disabled={busy || !newName.trim()}
                  onClick={() => void handleCreate()}
                >
                  {t('kb.categoryAdd.confirm', 'Create category')}
                </Button>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                {t('kb.categoryAdmin.existing', 'Existing categories')} ({categories.length})
              </p>
              <ScrollArea className="h-[240px] pr-2">
                <ul className="space-y-1.5">
                  {categories.map((cat) => {
                    const count = articleCountByCategory(cat.id);
                    const isEditing = editingId === cat.id;
                    return (
                      <li
                        key={cat.id}
                        className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white"
                      >
                        <cat.icon className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="h-8 text-sm rounded-lg"
                              autoFocus
                            />
                          ) : (
                            <>
                              <p className="text-sm font-medium text-slate-800 truncate">{cat.name}</p>
                              <p className="text-[10px] text-slate-400">
                                {count} {t('kb.articlesShort', 'articles')}
                              </p>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isEditing ? (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                disabled={busy}
                                onClick={() => void handleRename(cat.id)}
                              >
                                {t('actions.save', 'Save')}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => setEditingId(null)}
                              >
                                {t('actions.cancel', 'Cancel')}
                              </Button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className={cn(
                                  'p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors',
                                )}
                                onClick={() => {
                                  setEditingId(cat.id);
                                  setEditingName(cat.name);
                                }}
                                aria-label={t('kb.categoryRename.action', 'Rename category')}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                onClick={() => setDeleteTarget(cat)}
                                aria-label={t('kb.categoryDelete.action', 'Delete category')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter className="px-5 py-3 border-t bg-slate-50/50">
            <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
              {t('actions.close', 'Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <KBCategoryDeleteModal
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        category={deleteTarget}
        articleCount={deleteTarget ? articleCountByCategory(deleteTarget.id) : 0}
        onConfirm={(strategy) => void handleDelete(strategy)}
      />
    </>
  );
}
