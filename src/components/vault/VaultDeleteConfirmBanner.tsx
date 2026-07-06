import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useTranslation } from '../../lib/context/I18nContext';

export interface VaultDeleteConfirmBannerProps {
  vaultName: string;
  confirmText: string;
  onConfirmTextChange: (value: string) => void;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function VaultDeleteConfirmBanner({
  vaultName,
  confirmText,
  onConfirmTextChange,
  isDeleting,
  onConfirm,
  onCancel,
}: VaultDeleteConfirmBannerProps) {
  const { t } = useTranslation();
  const canConfirm = confirmText.trim() === vaultName.trim();

  return (
    <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-red-900">
            {t('vault.delete.warningTitle', 'Tresor endgültig löschen?')}
          </h4>
          <p className="text-xs text-red-800/90 mt-1 leading-relaxed">
            {t(
              'vault.delete.warningBody',
              'Diese Aktion kann nicht rückgängig gemacht werden. Alle Zugriffsregeln und Portfolio-Metadaten werden entfernt.',
            )}
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-red-700 pl-1">
          {t('vault.delete.typeName', 'Geben Sie den Tresornamen zur Bestätigung ein')}:{' '}
          <span className="font-black">{vaultName}</span>
        </label>
        <Input
          value={confirmText}
          onChange={(e) => onConfirmTextChange(e.target.value)}
          placeholder={vaultName}
          className="rounded-xl border-red-200 bg-white h-10"
          autoFocus
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!canConfirm || isDeleting}
          onClick={onConfirm}
          className="rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold h-9"
        >
          {isDeleting
            ? t('vault.delete.deleting', 'Löschen…')
            : t('vault.delete.confirm', 'Tresor unwiderruflich löschen')}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} className="rounded-xl text-xs font-bold">
          {t('actions.cancel', 'Abbrechen')}
        </Button>
      </div>
    </div>
  );
}
