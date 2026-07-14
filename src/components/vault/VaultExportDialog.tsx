import { useState, type FormEvent } from 'react';
import { Download, Eye, EyeOff, LockKeyhole, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { useTranslation } from '../../lib/context/I18nContext';
import { cn } from '../../lib/utils';
import {
  buildVaultExportPayload,
  downloadLocalTextFile,
  scrubPasswordMap,
  toExportItems,
  VAULT_EXPORT_FORMATS,
  type VaultExportFormat,
} from '../../lib/credential-vault-export';
import type { VaultCredential } from '../../lib/credential-vault-sync';
import { logAudit } from '../../services/auditService';

interface VaultExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  vaultName: string;
  credentials: VaultCredential[];
  decryptPassword: (cred: VaultCredential) => Promise<string | null>;
  /** Re-verify against the in-memory master key from unlock (optional safety check). */
  verifyMasterPassword: (password: string) => Promise<boolean>;
}

export function VaultExportDialog({
  open,
  onOpenChange,
  userId,
  vaultName,
  credentials,
  decryptPassword,
  verifyMasterPassword,
}: VaultExportDialogProps) {
  const { t, language } = useTranslation();
  const activeLang = language === 'de' || language === 'en' ? language : 'de';
  const [format, setFormat] = useState<VaultExportFormat>('chrome-csv');
  const [masterPassword, setMasterPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const exportableCount = credentials.filter(
    (c) => !c.deleted && !c.securitySettings?.disableExport,
  ).length;

  const resetLocalState = () => {
    setMasterPassword('');
    setShowPassword(false);
    setIsExporting(false);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) resetLocalState();
    onOpenChange(nextOpen);
  };

  const handleExport = async (e: FormEvent) => {
    e.preventDefault();
    if (!masterPassword.trim()) {
      toast.error(
        t('vault.export.passwordRequired', 'Please re-enter your master password to export.'),
      );
      return;
    }
    if (exportableCount === 0) {
      toast.error(t('vault.export.noItems', 'No exportable vault items found.'));
      return;
    }

    setIsExporting(true);
    const passwordMap = new Map<string, string>();
    try {
      const verified = await verifyMasterPassword(masterPassword);
      if (!verified) {
        throw new Error(
          t('vault.export.badPassword', 'Master password verification failed.'),
        );
      }
      // userId retained for audit context only — password never leaves the browser.
      void userId;

      for (const cred of credentials) {
        if (cred.deleted || cred.securitySettings?.disableExport || !cred.id) continue;
        const plain = await decryptPassword(cred);
        if (plain == null) {
          throw new Error(
            t(
              'vault.export.decryptFailed',
              'Failed to decrypt one or more items. Verify your vault key and try again.',
            ),
          );
        }
        passwordMap.set(String(cred.id), plain);
      }

      const items = toExportItems(credentials, passwordMap);
      const { content, filename, mimeType } = buildVaultExportPayload(format, items);
      downloadLocalTextFile(filename, content, mimeType);

      logAudit({
        module: 'credentials',
        action: 'vault_export_local',
        details: {
          format,
          itemCount: items.length,
          vaultName,
          destination: 'client_download_only',
        },
      });

      toast.success(
        t(
          'vault.export.success',
          'Vault data exported locally. Plaintext never left this browser.',
        ),
      );
      handleClose(false);
    } catch (err: any) {
      toast.error(
        err?.message ||
          t('vault.export.failed', 'Export failed. Master password may be incorrect.'),
      );
    } finally {
      scrubPasswordMap(passwordMap);
      setMasterPassword('');
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px] rounded-2xl border-slate-200 p-0 overflow-hidden bg-white">
        <form onSubmit={handleExport}>
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-slate-100">
            <DialogTitle className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Download className="w-4.5 h-4.5 text-blue-600" />
              {t('vault.export.title', 'Export Vault Data')}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium">
              {t(
                'vault.export.description',
                'Decrypt personal vault items in local browser memory and download an industry-standard file. Nothing is uploaded.',
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5 space-y-5">
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-3.5 py-3 flex gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900/90 font-medium leading-relaxed">
                {t(
                  'vault.export.zeroFootprint',
                  'Zero storage footprint: decrypted passwords stream only to your download folder and are never written to server cache or logs.',
                )}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {t('vault.export.format', 'Export format')}
              </p>
              <div className="space-y-2">
                {VAULT_EXPORT_FORMATS.map((option) => {
                  const selected = format === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setFormat(option.id)}
                      className={cn(
                        'w-full text-left rounded-xl border px-3.5 py-3 transition-colors',
                        selected
                          ? 'border-blue-500 bg-blue-50/60 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                      )}
                    >
                      <p className="text-xs font-bold text-slate-900">
                        {activeLang === 'de' ? option.labelDe : option.labelEn}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                        {activeLang === 'de' ? option.descriptionDe : option.descriptionEn}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="vault-export-mp"
                className="text-[10px] font-black uppercase tracking-widest text-slate-500 pl-0.5"
              >
                {t('vault.export.reverify', 'Re-verify master password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <LockKeyhole className="w-4 h-4" />
                </div>
                <Input
                  id="vault-export-mp"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  disabled={isExporting}
                  placeholder={t('vault.masterPasswordPlaceholder', 'Enter master password...')}
                  className="pl-10 pr-10 h-11 rounded-xl bg-slate-50 border-slate-200 text-xs font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 font-medium pl-0.5">
                {t('vault.export.itemCount', '{{count}} items from “{{vault}}”')
                  .replace('{{count}}', String(exportableCount))
                  .replace('{{vault}}', vaultName)}
              </p>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 bg-slate-50 border-t border-slate-100 gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl text-xs"
              disabled={isExporting}
              onClick={() => handleClose(false)}
            >
              {t('actions.cancel', 'Cancel')}
            </Button>
            <Button type="submit" className="rounded-xl text-xs gap-1.5" disabled={isExporting}>
              <Download className="w-3.5 h-3.5" />
              {isExporting
                ? t('vault.export.downloading', 'Preparing local download…')
                : t('vault.export.confirm', 'Download export')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
