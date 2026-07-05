import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Globe, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { FlagIcon } from '../ui/FlagIcon';
import { useTranslation } from '../../lib/context/I18nContext';
import {
  getModuleConfig,
  saveModuleConfig,
  type ModuleConfig,
  type PolyglotLanguage,
} from '../../lib/module-config';
import {
  DEFAULT_SUPPORTED_LANGUAGES,
  ISO_LANGUAGE_PRESETS,
  getActiveSupportedLanguages,
  normalizeIsoCode,
  resolveLanguagePreset,
} from '../../lib/polyglot-bridge';
import { cn } from '../../lib/utils';

const ISO_PRESET_OPTIONS = Object.entries(ISO_LANGUAGE_PRESETS);

export function PolyglotBridgeConfigPanel() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<ModuleConfig>(() => getModuleConfig());
  const [isoInput, setIsoInput] = useState('it');
  const [displayName, setDisplayName] = useState('');
  const [flagCode, setFlagCode] = useState('it');

  useEffect(() => {
    const sync = () => setConfig(getModuleConfig());
    window.addEventListener('module-config-changed', sync);
    return () => window.removeEventListener('module-config-changed', sync);
  }, []);

  useEffect(() => {
    const preset = resolveLanguagePreset(isoInput);
    setDisplayName(preset.lang);
    setFlagCode(preset.flagCode);
  }, [isoInput]);

  const persist = useCallback((next: ModuleConfig) => {
    setConfig(next);
    saveModuleConfig(next);
  }, []);

  const handleIsoChange = (iso: string) => {
    const normalized = normalizeIsoCode(iso);
    setIsoInput(normalized);
    const preset = resolveLanguagePreset(normalized);
    setDisplayName(preset.lang);
    setFlagCode(preset.flagCode);
  };

  const handleAddLanguage = () => {
    const isoCode = normalizeIsoCode(isoInput);
    if (!isoCode) {
      toast.error(t('adminHub.polyglot.invalidIso', 'Enter a valid ISO language code.'));
      return;
    }

    if (config.languages.some((l) => l.isoCode === isoCode)) {
      toast.error(t('adminHub.polyglot.duplicate', 'This language is already provisioned.'));
      return;
    }

    const preset = resolveLanguagePreset(isoCode);
    const entry: PolyglotLanguage = {
      lang: displayName.trim() || preset.lang,
      isoCode,
      flagCode: flagCode.trim() || preset.flagCode,
      enabled: true,
    };

    persist({
      ...config,
      polyglotEnabled: true,
      languages: [...config.languages, entry],
    });

    toast.success(t('adminHub.polyglot.added', 'Language added to Polyglot Bridge.'));
  };

  const handleRemoveLanguage = (isoCode: string) => {
    const remaining = config.languages.filter((l) => l.isoCode !== isoCode);
    if (remaining.length === 0) {
      toast.error(t('adminHub.polyglot.minOne', 'At least one language must remain active.'));
      return;
    }
    if (!remaining.some((l) => l.enabled)) {
      remaining[0] = { ...remaining[0], enabled: true };
    }
    persist({ ...config, languages: remaining });
    toast.success(t('adminHub.polyglot.removed', 'Language removed.'));
  };

  const toggleLanguageEnabled = (isoCode: string) => {
    const nextLanguages = config.languages.map((l) =>
      l.isoCode === isoCode ? { ...l, enabled: !l.enabled } : l,
    );
    if (config.polyglotEnabled && nextLanguages.every((l) => !l.enabled)) {
      toast.error(t('adminHub.polyglot.minOneActive', 'At least one language must stay active.'));
      return;
    }
    persist({ ...config, languages: nextLanguages });
  };

  const resetToDefaults = () => {
    persist({ ...config, languages: DEFAULT_SUPPORTED_LANGUAGES.map((l) => ({ ...l })) });
    toast.success(t('adminHub.polyglot.reset', 'Restored default language roster.'));
  };

  const activeLanguages = getActiveSupportedLanguages(config.languages);

  return (
    <Card className="mb-10 rounded-[2rem] border-slate-200/80 shadow-sm overflow-hidden">
      <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 to-violet-50/40">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-600" />
              {t('adminHub.polyglot.title', '🌐 Polyglot Bridge Konfiguration')}
            </CardTitle>
            <CardDescription className="mt-1">
              {t(
                'adminHub.polyglot.description',
                'Provision active header flags and agent translation targets workspace-wide. Changes sync instantly to all operator sessions.',
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="polyglot-enabled" className="text-xs font-semibold text-slate-600">
              {t('adminHub.polyglot.enabled', 'Bridge Active')}
            </Label>
            <Switch
              id="polyglot-enabled"
              checked={config.polyglotEnabled}
              onCheckedChange={(enabled) => persist({ ...config, polyglotEnabled: enabled })}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        <div>
          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {t('adminHub.polyglot.headerPreview', 'Header Flag Preview')}
          </Label>
          <div className="mt-2 flex flex-wrap gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50/70">
            {activeLanguages.map((lang) => (
              <div
                key={lang.isoCode}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm"
              >
                <FlagIcon code={lang.flagCode} className="w-5 h-3.5" title={lang.lang} />
                <span className="text-[11px] font-semibold text-slate-700">{lang.lang}</span>
                <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">
                  {lang.isoCode}
                </Badge>
              </div>
            ))}
            {activeLanguages.length === 0 && (
              <span className="text-xs text-muted-foreground">
                {t('adminHub.polyglot.noActive', 'No active languages configured.')}
              </span>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>{t('adminHub.polyglot.isoCode', 'ISO Language Code')}</Label>
            <Select value={isoInput} onValueChange={handleIsoChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ISO_PRESET_OPTIONS.map(([iso, preset]) => (
                  <SelectItem key={iso} value={iso}>
                    {iso.toUpperCase()} — {preset.lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={isoInput}
              onChange={(e) => handleIsoChange(e.target.value)}
              placeholder="it"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('adminHub.polyglot.displayName', 'Display Name')}</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('adminHub.polyglot.displayPlaceholder', 'Italian')}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('adminHub.polyglot.flagCode', 'Flag Icon Code')}</Label>
            <Input
              value={flagCode}
              onChange={(e) => setFlagCode(normalizeIsoCode(e.target.value))}
              placeholder="it"
              className="font-mono text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handleAddLanguage} className="gap-1.5">
            <Plus className="w-4 h-4" />
            {t('adminHub.polyglot.addLanguage', 'Sprache hinzufügen / Save')}
          </Button>
          <Button type="button" variant="outline" onClick={resetToDefaults}>
            {t('adminHub.polyglot.resetDefaults', 'Restore Defaults')}
          </Button>
        </div>

        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3 font-semibold text-slate-600">{t('adminHub.polyglot.tableLanguage', 'Language')}</th>
                <th className="text-left p-3 font-semibold text-slate-600">ISO</th>
                <th className="text-left p-3 font-semibold text-slate-600">{t('adminHub.polyglot.tableFlag', 'Flag')}</th>
                <th className="text-left p-3 font-semibold text-slate-600">{t('adminHub.polyglot.tableActive', 'Active')}</th>
                <th className="text-right p-3 font-semibold text-slate-600">{t('adminHub.polyglot.tableActions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {config.languages.map((lang) => (
                <tr key={lang.isoCode} className="border-t border-slate-100">
                  <td className="p-3 font-medium">{lang.lang}</td>
                  <td className="p-3 font-mono text-xs">{lang.isoCode}</td>
                  <td className="p-3">
                    <FlagIcon code={lang.flagCode} className="w-6 h-4" title={lang.lang} />
                  </td>
                  <td className="p-3">
                    <Switch
                      checked={lang.enabled}
                      onCheckedChange={() => toggleLanguageEnabled(lang.isoCode)}
                    />
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className={cn('text-red-600 hover:text-red-700 hover:bg-red-50')}
                      onClick={() => handleRemoveLanguage(lang.isoCode)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
