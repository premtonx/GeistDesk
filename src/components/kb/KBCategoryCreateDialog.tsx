import { useEffect, useState } from 'react';
import { FolderPlus } from 'lucide-react';
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
import { kbCategoryApi } from '../../services/kbDashboardApi';
import { mapDbCategoryToRecord, type KBCategoryRecord } from './kbCategoryUtils';
import { toast } from 'sonner';

interface KBCategoryCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: KBCategoryRecord[];
  onCategoriesChange: (categories: KBCategoryRecord[]) => void;
}

export function KBCategoryCreateDialog({
  open,
  onOpenChange,
  categories,
  onCategoriesChange,
}: KBCategoryCreateDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setName('');
      setDesc('');
    }
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { category } = await kbCategoryApi.create({
        name: name.trim(),
        desc: desc.trim(),
        order: categories.length + 1,
      });
      onCategoriesChange([...categories, mapDbCategoryToRecord(category, categories.length + 1)]);
      toast.success(t('kb.categoryAdd.success', 'Category registered successfully.'));
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create category.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FolderPlus className="w-4 h-4 text-indigo-600" />
            {t('kb.categoryAdd.title', 'Create category')}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {t(
              'kb.categoryAdd.description',
              'Extend your knowledge structure with a new folder visible to all authenticated workspace profiles.',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">
              {t('kb.categoryAdd.namePlaceholder', 'Category name')}
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('kb.categoryAdd.namePlaceholder', 'Category name')}
              className="h-10 rounded-xl"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">
              {t('kb.categoryAdd.descPlaceholder', 'Short description (optional)')}
            </Label>
            <Input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={t('kb.categoryAdd.descPlaceholder', 'Short description (optional)')}
              className="h-10 rounded-xl"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            {t('actions.cancel', 'Cancel')}
          </Button>
          <Button
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm"
            disabled={busy || !name.trim()}
            onClick={() => void handleCreate()}
          >
            {t('kb.categoryAdd.confirm', 'Create category')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
