import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { toast } from 'sonner';
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
import { useTranslation } from '../../lib/context/I18nContext';
import { exchangeApi, type ExchangeSettings } from '../../services/exchangeApi';
import { useAdmin } from '../../lib/hooks';

interface ExchangeSettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExchangeSettingsPanel({ open, onOpenChange }: ExchangeSettingsPanelProps) {
  const { t } = useTranslation();
  const { isAdmin } = useAdmin();
  const [settings, setSettings] = useState<ExchangeSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void exchangeApi.getSettings().then(setSettings).catch(() => {
      toast.error(t('exchange.settings.loadFailed', 'Einstellungen konnten nicht geladen werden.'));
    });
  }, [open, t]);

  const handleSave = async () => {
    if (!settings || !isAdmin) return;
    setSaving(true);
    try {
      const saved = await exchangeApi.saveSettings(settings);
      setSettings(saved);
      toast.success(t('exchange.settings.saved', 'GeistExchange-Einstellungen gespeichert.'));
      onOpenChange(false);
    } catch {
      toast.error(t('exchange.settings.saveFailed', 'Speichern fehlgeschlagen.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-500" />
            {t('exchange.settings.title', 'GeistExchange Einstellungen')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'exchange.settings.description',
              'Standard-Ablaufzeiten, globale Download-Limits und Speicherwarnungen für den Workspace.',
            )}
          </DialogDescription>
        </DialogHeader>

        {settings ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="defaultExpirationHours">
                {t('exchange.settings.defaultExpiration', 'Standard-Ablaufzeit (Stunden)')}
              </Label>
              <Input
                id="defaultExpirationHours"
                type="number"
                min={1}
                disabled={!isAdmin}
                value={settings.defaultExpirationHours}
                onChange={(e) =>
                  setSettings({ ...settings, defaultExpirationHours: Number(e.target.value) || 48 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="globalDownloadLimit">
                {t('exchange.settings.globalDownloadLimit', 'Globales Download-Limit pro Link')}
              </Label>
              <Input
                id="globalDownloadLimit"
                type="number"
                min={1}
                disabled={!isAdmin}
                value={settings.globalDownloadLimit}
                onChange={(e) =>
                  setSettings({ ...settings, globalDownloadLimit: Number(e.target.value) || 10 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storageWarningThresholdPercent">
                {t('exchange.settings.storageWarning', 'Speicherwarnung ab (%)')}
              </Label>
              <Input
                id="storageWarningThresholdPercent"
                type="number"
                min={1}
                max={100}
                disabled={!isAdmin}
                value={settings.storageWarningThresholdPercent}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    storageWarningThresholdPercent: Number(e.target.value) || 80,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storageQuotaGb">{t('exchange.settings.storageQuota', 'Speicherkontingent (GB)')}</Label>
              <Input
                id="storageQuotaGb"
                type="number"
                min={1}
                disabled={!isAdmin}
                value={settings.storageQuotaGb}
                onChange={(e) => setSettings({ ...settings, storageQuotaGb: Number(e.target.value) || 2048 })}
              />
            </div>
            {!isAdmin ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                {t('exchange.settings.readOnly', 'Nur System-Administratoren können diese Werte ändern.')}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-6 text-center">{t('exchange.settings.loading', 'Lade Einstellungen…')}</p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('actions.cancel', 'Abbrechen')}
          </Button>
          {isAdmin ? (
            <Button type="button" disabled={!settings || saving} onClick={() => void handleSave()}>
              {saving ? t('actions.saving', 'Speichern…') : t('actions.save', 'Speichern')}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
