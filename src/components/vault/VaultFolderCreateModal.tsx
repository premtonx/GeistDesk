import { useEffect, useState, type FormEvent } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { cn } from '../../lib/utils';
import {
  VAULT_FOLDER_ICON_OPTIONS,
  getVaultFolderIcon,
  type VaultFolderIconId,
  type VaultFolderNode,
  flattenFolderOptions,
} from './vaultFolderTypes';

export interface VaultFolderCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultId: string;
  vaultLabel: string;
  folders: VaultFolderNode[];
  onCreate: (payload: {
    name: string;
    icon: VaultFolderIconId;
    parentId: string | null;
  }) => Promise<void> | void;
  initialParentId?: string | null;
}

export function VaultFolderCreateModal({
  open,
  onOpenChange,
  vaultId,
  vaultLabel,
  folders,
  onCreate,
  initialParentId = null,
}: VaultFolderCreateModalProps) {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string>('__root__');
  const [icon, setIcon] = useState<VaultFolderIconId>('folder');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setParentId(initialParentId ?? '__root__');
    setIcon('folder');
    setIsSaving(false);
  }, [open, initialParentId]);

  const parentOptions = flattenFolderOptions(folders, vaultId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setIsSaving(true);
    try {
      await onCreate({
        name: trimmed,
        icon,
        parentId: parentId === '__root__' ? null : parentId,
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl border-slate-200">
        <DialogHeader>
          <DialogTitle>Ordner erstellen</DialogTitle>
          <DialogDescription>
            Organisieren Sie Zugangsdaten in {vaultLabel} mit verschachtelten Unterordnern.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pl-1">
              Ordnername
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Produktion, VPN-Zugänge, Kunden A"
              className="rounded-xl h-10"
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pl-1">
              Übergeordneter Ordner
            </label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger className="rounded-xl h-10">
                <SelectValue placeholder="Keine / Root" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__root__">Keine / Root</SelectItem>
                {parentOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {'\u00A0'.repeat(option.depth * 2)}
                    {option.depth > 0 ? '↳ ' : ''}
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pl-1">
              Ordner-Symbol
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {VAULT_FOLDER_ICON_OPTIONS.map((option) => {
                const Icon = getVaultFolderIcon(option.id);
                const selected = icon === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setIcon(option.id)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-xl border p-2.5 transition-all',
                      selected
                        ? 'border-[#1A73E8] bg-blue-50 text-[#1A73E8] ring-1 ring-[#1A73E8]'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50',
                    )}
                    title={option.label}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[9px] font-semibold truncate w-full text-center">
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="rounded-xl bg-[#1A73E8] hover:bg-blue-700"
            >
              {isSaving ? 'Speichern…' : 'Ordner anlegen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
