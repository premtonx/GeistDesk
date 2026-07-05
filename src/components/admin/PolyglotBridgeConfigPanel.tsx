import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Globe, KeyRound, Plus, Trash2, Upload } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { FlagIcon } from '../ui/FlagIcon';
import { useTranslation } from '../../lib/context/I18nContext';
import {
  type ModuleConfig,
  type PolyglotLanguage,
} from '../../lib/module-config';
import { useWorkspaceModuleConfig } from '../../hooks/useWorkspaceModuleConfig';
import {
  DEFAULT_SUPPORTED_LANGUAGES,
  ISO_LANGUAGE_PRESETS,
  getActiveSupportedLanguages,
  inferLocaleFromFilename,
  mergeImportedDictionaryJson,
  normalizeIsoCode,
  resolveLanguagePreset,
} from '../../lib/polyglot-bridge';
import { cn } from '../../lib/utils';

const ISO_PRESET_OPTIONS = Object.entries(ISO_LANGUAGE_PRESETS);

interface PolyglotBridgeConfigPanelProps {
  className?: string;
}

export function PolyglotBridgeConfigPanel({ className }: PolyglotBridgeConfigPanelProps) {
  const { t } = useTranslation();
  const { config, persist: persistWorkspace } = useWorkspaceModuleConfig({ admin: true });
  const [isoInput, setIsoInput] = useState('it');
  const [displayName, setDisplayName] = useState('');
  const [flagCode, setFlagCode] = useState('it');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setApiKeyInput(config.polyglot.translationProviderKey);
  }, [config.polyglot.translationProviderKey]);

  useEffect(() => {
    const preset = resolveLanguagePreset(isoInput);
    setDisplayName(preset.lang);
    setFlagCode(preset.flagCode);
  }, [isoInput]);

  const persist = async (next: ModuleConfig): Promise<boolean> => {
    const saved = await persistWorkspace(next);
    if (!saved) {
      toast.error(
        t(
          'adminHub.polyglot.saveFailed',
          'Could not save workspace settings to the database. Please try again.',
        ),
      );
    }
    return saved;
  };

  const handleIsoChange = (iso: string) => {
    const normalized = normalizeIsoCode(iso);
    setIsoInput(normalized);
    const preset = resolveLanguagePreset(normalized);
    setDisplayName(preset.lang);
    setFlagCode(preset.flagCode);
  };

  const handleAddLanguage = async () => {
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

    const saved = await persist({
      ...config,
      polyglotEnabled: true,
      languages: [...config.languages, entry],
    });

    if (saved) {
      toast.success(t('adminHub.polyglot.added', 'Language added to Polyglot Bridge.'));
    }
  };

  const handleRemoveLanguage = async (isoCode: string) => {
    const remaining = config.languages.filter((l) => l.isoCode !== isoCode);
    if (remaining.length === 0) {
      toast.error(t('adminHub.polyglot.minOne', 'At least one language must remain active.'));
      return;
    }
    if (!remaining.some((l) => l.enabled)) {
      remaining[0] = { ...remaining[0], enabled: true };
    }
    const saved = await persist({ ...config, languages: remaining });
    if (saved) {
      toast.success(t('adminHub.polyglot.removed', 'Language removed.'));
    }
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

  const resetToDefaults = async () => {
    const saved = await persist({ ...config, languages: DEFAULT_SUPPORTED_LANGUAGES.map((l) => ({ ...l })) });
    if (saved) {
      toast.success(t('adminHub.polyglot.reset', 'Restored default language roster.'));
    }
  };

  const handleSaveApiKey = async () => {
    const saved = await persist({
      ...config,
      polyglot: {
        ...config.polyglot,
        translationProviderKey: apiKeyInput.trim(),
      },
    });
    if (saved) {
      toast.success(t('adminHub.polyglot.apiKeySaved', 'Translation provider credentials saved.'));
    }
  };

  const applyDictionaryFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.json')) {
      toast.error(t('adminHub.polyglot.jsonOnly', 'Only .json dictionary files are supported.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const localeHint = inferLocaleFromFilename(file.name);
        const merged = mergeImportedDictionaryJson(config.polyglot.customDictionary, parsed, localeHint);
        const entryCount = Object.keys(merged).length;
        const saved = await persist({
          ...config,
          polyglot: {
            ...config.polyglot,
            customDictionary: merged,
          },
        });
        if (saved) {
          toast.success(
            t('adminHub.polyglot.dictionaryImported', 'Dictionary imported ({{count}} phrase entries).').replace(
              '{{count}}',
              String(entryCount),
            ),
          );
        }
      } catch {
        toast.error(t('adminHub.polyglot.jsonParseError', 'Could not parse JSON dictionary file.'));
      }
    };
    reader.readAsText(file);
  };

  const activeLanguages = getActiveSupportedLanguages(config.languages);
  const dictionaryEntryCount = Object.keys(config.polyglot.customDictionary).length;

  return (
    <Card className={cn('rounded-[2rem] border-slate-200/80 shadow-sm overflow-hidden', className)}>
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

      <CardContent className="p-6">
        <Tabs defaultValue="languages">
          <TabsList className="mb-6">
            <TabsTrigger value="languages">
              {t('adminHub.polyglot.tabLanguages', 'Sprachen')}
            </TabsTrigger>
            <TabsTrigger value="credentials">
              {t('adminHub.polyglot.tabCredentials', '🔑 API-Schlüssel & Dateiverwaltung')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="languages" className="space-y-6 mt-0">
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
          </TabsContent>

          <TabsContent value="credentials" className="space-y-6 mt-0">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  {t('adminHub.polyglot.credentialsTitle', '🔑 API-Schlüssel & Dateiverwaltung')}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t(
                  'adminHub.polyglot.credentialsDesc',
                  'Configure low-cost machine translation credentials and import custom phrase dictionaries. Premium LLM tokens are never used for UI translation.',
                )}
              </p>

              <div className="space-y-2">
                <Label htmlFor="polyglot-api-key">
                  {t('adminHub.polyglot.apiKeyLabel', 'DeepL API-Schlüssel / Translation Provider Key')}
                </Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    id="polyglot-api-key"
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
                    className="font-mono text-xs"
                    autoComplete="off"
                  />
                  <div className="flex gap-2 shrink-0">
                    <Button type="button" variant="outline" onClick={() => setShowApiKey((v) => !v)}>
                      {showApiKey
                        ? t('adminHub.polyglot.hideKey', 'Hide')
                        : t('adminHub.polyglot.showKey', 'Show')}
                    </Button>
                    <Button type="button" onClick={handleSaveApiKey}>
                      {t('adminHub.polyglot.saveApiKey', 'Save Key')}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <Label htmlFor="polyglot-ai-fallback" className="text-sm font-bold text-slate-800">
                    {t('adminHub.polyglot.aiFallbackTitle', '🤖 KI-gestützte Übersetzung aktivieren')}
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t(
                      'adminHub.polyglot.aiFallbackDesc',
                      'Erlaubt dem System, komplexe Ticket-Kontexte mittels LLM-Orchestrator zu übersetzen, falls die statischen Wörterbücher oder maschinellen Übersetzer nicht ausreichen. Achtung: Verbraucht KI-Token.',
                    )}
                  </p>
                </div>
                <Switch
                  id="polyglot-ai-fallback"
                  checked={config.polyglot.allowAiFallback}
                  onCheckedChange={(allowAiFallback) =>
                    persist({
                      ...config,
                      polyglot: { ...config.polyglot, allowAiFallback },
                    })
                  }
                  className="shrink-0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>{t('adminHub.polyglot.dictionaryUpload', 'JSON-Sprachdatei importieren')}</Label>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {dictionaryEntryCount} {t('adminHub.polyglot.dictionaryEntries', 'entries')}
                </Badge>
              </div>
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) applyDictionaryFile(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer',
                  isDragging
                    ? 'border-indigo-400 bg-indigo-50/80'
                    : 'border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/40',
                )}
              >
                <Upload className="w-7 h-7 mx-auto mb-3 text-indigo-500" />
                <p className="text-sm font-semibold text-slate-700">
                  {t('adminHub.polyglot.dictionaryDropHint', 'JSON-Sprachdatei importieren')}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {t(
                    'adminHub.polyglot.dictionaryDropSubhint',
                    'Drop fr.json or nested phrase maps — parsed client-side and synced to the dictionary store.',
                  )}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) applyDictionaryFile(file);
                  e.target.value = '';
                }}
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
