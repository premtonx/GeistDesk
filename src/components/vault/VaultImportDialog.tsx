import { useMemo, useRef, useState } from 'react';
import { Chrome, Database, FileText, Key, Upload } from 'lucide-react';
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
import {
  VAULT_IMPORT_FORMATS,
  type VaultImportFormatId,
} from '../../lib/vault-import-processor';

export type VaultImportFormatOption = Exclude<VaultImportFormatId, 'auto'>;

interface VaultImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (file: File, format: VaultImportFormatOption) => Promise<void>;
  isImporting?: boolean;
  vaultName?: string;
}

const FORMAT_ICONS: Record<VaultImportFormatOption, typeof Upload> = {
  'chrome-csv': Chrome,
  'bitwarden-json': Key,
  'keepass-csv': Database,
  'keepass-xml': FileText,
  'onepassword-json': Key,
  'vaultwarden-csv': Upload,
};

export function VaultImportDialog({
  open,
  onOpenChange,
  onImport,
  isImporting,
  vaultName,
}: VaultImportDialogProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFormat, setSelectedFormat] = useState<VaultImportFormatOption>('chrome-csv');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const activeOption = useMemo(
    () => VAULT_IMPORT_FORMATS.find((f) => f.id === selectedFormat) ?? VAULT_IMPORT_FORMATS[0],
    [selectedFormat],
  );

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
            {t(
              'vault.import.description',
              'Import from Chrome, Bitwarden, KeePass, 1Password, or Vaultwarden into {{vault}}. Parsing and encryption happen only in this browser.',
            ).replace('{{vault}}', vaultName || t('vault.vaults.active', 'the active vault'))}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {t('vault.import.selectFormat', 'Select format')}
          </p>
          <div className="grid grid-cols-1 gap-1.5 max-h-[280px] overflow-y-auto pr-0.5">
            {VAULT_IMPORT_FORMATS.map((opt) => {
              const Icon = FORMAT_ICONS[opt.id];
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setSelectedFormat(opt.id);
                    setSelectedFile(null);
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                  className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                    selectedFormat === opt.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold">{opt.label}</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5 leading-snug">
                      {opt.description}
                    </span>
                  </span>
                </button>
              );
            })}
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
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
              {t(
                'vault.import.privacyHint',
                'Plaintext never leaves this browser. Entries are encrypted with the active vault key before sync.',
              )}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isImporting}>
            {t('actions.cancel', 'Cancel')}
          </Button>
          <Button type="button" onClick={handleImport} disabled={!selectedFile || isImporting}>
            {isImporting
              ? t('vault.import.processing', 'Processing...')
              : t('vault.import.importButton', 'Import')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
