import { useRef, useState } from 'react';
import { Upload, FileText, Database, Key } from 'lucide-react';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import type { VaultImportFormat } from '../../lib/vault-import-processor';

export type VaultImportFormatOption = VaultImportFormat;

interface VaultImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (file: File, format: VaultImportFormatOption) => Promise<void>;
  isImporting?: boolean;
}

const FORMAT_OPTIONS: { id: VaultImportFormatOption; labelKey: string; defaultLabel: string; accept: string; icon: typeof Upload }[] = [
  { id: 'keepass-xml', labelKey: 'vault.import.keepassXml', defaultLabel: 'KeePass XML (.xml)', accept: '.xml', icon: FileText },
  { id: 'keepass-csv', labelKey: 'vault.import.keepassCsv', defaultLabel: 'KeePass CSV (.csv)', accept: '.csv', icon: Database },
  { id: '1password-json', labelKey: 'vault.import.onePassword', defaultLabel: '1Password JSON (.json)', accept: '.json', icon: Key },
  { id: 'vaultwarden-csv', labelKey: 'vault.import.vaultwarden', defaultLabel: 'Vaultwarden CSV (.csv)', accept: '.csv', icon: Upload },
];

export function VaultImportDialog({ open, onOpenChange, onImport, isImporting }: VaultImportDialogProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFormat, setSelectedFormat] = useState<VaultImportFormatOption>('keepass-xml');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const activeOption = FORMAT_OPTIONS.find((f) => f.id === selectedFormat)!;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    await onImport(selectedFile, selectedFormat);
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = '';
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t('vault.import.title', 'Import Credentials')}</DialogTitle>
          <DialogDescription>
            {t('vault.import.description', 'Import from KeePass, 1Password, or Vaultwarden exports into the active vault.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {t('vault.import.selectFormat', 'Select format')}
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {FORMAT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedFormat(opt.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left text-xs font-medium transition-colors ${
                  selectedFormat === opt.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <opt.icon className="w-4 h-4 shrink-0" />
                {t(opt.labelKey, opt.defaultLabel)}
              </button>
            ))}
          </div>

          <div className="pt-2">
            <input
              ref={fileRef}
              type="file"
              accept={activeOption.accept}
              onChange={handleFileChange}
              className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {selectedFile ? (
              <p className="text-[11px] text-slate-500 mt-1.5">
                {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isImporting}>
            {t('actions.cancel', 'Cancel')}
          </Button>
          <Button type="button" onClick={handleImport} disabled={!selectedFile || isImporting}>
            {isImporting ? t('vault.import.processing', 'Processing...') : t('vault.import.importButton', 'Import')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
