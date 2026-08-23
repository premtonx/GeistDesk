import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { Shield, Lock, Eye, EyeOff, AlertTriangle, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs';
import { useTranslation } from '../../lib/context/I18nContext';
import { toast } from 'sonner';
import axios from 'axios';
import {
  DEFAULT_ORCHESTRATOR_CONFIG,
  DEFAULT_REDACTION_RULES,
  type AiOrchestratorConfig,
  type RedactionRule,
} from '../../types/aiOrchestrator';
import { persistOrchestratorPatch } from '../../lib/persistOrchestratorPatch';

export default function PIIShieldPage() {
  const { language } = useTranslation();
  const isDe = language !== 'en'; // Default to German unless strictly English
  const [enabled, setEnabled] = useState(true);
  const [redactionRules, setRedactionRules] = useState<RedactionRule[]>(DEFAULT_REDACTION_RULES.map((r) => ({ ...r })));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/api/admin/orchestrator/config');
      const config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...(res.data as Partial<AiOrchestratorConfig>) };
      setEnabled(config.piiEnabled !== false);
      setRedactionRules((config.redactionRules ?? []).length > 0 ? config.redactionRules : DEFAULT_REDACTION_RULES.map((r) => ({ ...r })));
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : String(err);
      toast.error(
        isDe
          ? `PII-Schutzeinstellungen konnten nicht geladen werden: ${message}`
          : `Could not load PII Shield settings: ${message}`,
      );
    } finally {
      setLoading(false);
    }
  }, [isDe]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggleShield = async (val: boolean) => {
    setEnabled(val);
    setSaving(true);
    try {
      await persistOrchestratorPatch({ piiEnabled: val });
      toast.success(
        isDe
          ? `PII-Schutzschild ${val ? 'aktiviert' : 'deaktiviert'} und gespeichert`
          : `PII Shield ${val ? 'activated' : 'deactivated'} and saved`,
      );
    } catch (err: unknown) {
      setEnabled(!val);
      const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : String(err);
      toast.error(
        isDe ? `Speichern fehlgeschlagen: ${message}` : `Save failed: ${message}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRule = async (ruleId: string, checked: boolean) => {
    const next = redactionRules.map((r) => (r.id === ruleId ? { ...r, enabled: checked } : r));
    setRedactionRules(next);
    setToggling(ruleId);
    try {
      await persistOrchestratorPatch({ redactionRules: next });
      const rule = next.find((r) => r.id === ruleId);
      toast.success(
        isDe
          ? `${rule?.name ?? ruleId} wurde ${checked ? 'eingeschaltet' : 'ausgeschaltet'}`
          : `${rule?.name ?? ruleId} was ${checked ? 'enabled' : 'disabled'}`,
      );
    } catch (err: unknown) {
      setRedactionRules(redactionRules);
      const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : String(err);
      toast.error(
        isDe ? `Speichern fehlgeschlagen: ${message}` : `Save failed: ${message}`,
      );
    } finally {
      setToggling(null);
    }
  };

  const handleAddRule = (e: FormEvent) => {
    e.preventDefault();
    toast.info(
      isDe
        ? 'Eigene Regeln erfordern Enterprise-Schreibrechte. Die Standard-Regeln sind gespeichert.'
        : 'Custom rules require Enterprise write access. The standard rules are persisted.',
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#fafafa]">
      <div className="p-8 max-w-4xl mx-auto pb-20">
        <AdminBreadcrumbs />

        <div className="flex items-center justify-between mb-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-6 h-6 text-emerald-500" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {isDe ? 'PII-Schutzschild' : 'PII Shield'}
              </h1>
            </div>
            <p className="text-slate-500">
              {isDe
                ? 'Einstellungen werden in der Orchestrator-Konfiguration gespeichert.'
                : 'Settings are persisted to the orchestrator configuration.'}
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
               {isDe ? 'Schutz-Status' : 'Shield Status'}
             </span>
             {saving ? (
               <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
             ) : (
               <Switch checked={enabled} onCheckedChange={(val) => void handleToggleShield(val)} />
             )}
          </div>
        </div>

        <div className="space-y-6">
          <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">{isDe ? 'Filterlogik' : 'Redaction Logic'}</CardTitle>
                  <CardDescription>
                    {isDe
                      ? 'Gespeichert in redactionRules der Orchestrator-Konfiguration.'
                      : 'Persisted to the orchestrator config redactionRules.'}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-none font-bold">
                  {loading ? (isDe ? 'Lade …' : 'Loading …') : isDe ? 'Gespeichert' : 'Persisted'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y divide-slate-100">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs font-bold uppercase tracking-widest">
                        {isDe ? 'Lade Regeln …' : 'Loading rules …'}
                      </span>
                    </div>
                  ) : (
                    redactionRules.map((rule) => (
                      <div key={rule.id} className="flex items-center justify-between p-6 hover:bg-slate-50 transition-colors">
                        <div className="flex gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                            {rule.enabled ? <EyeOff className="w-5 h-5 text-emerald-500" /> : <Eye className="w-5 h-5" />}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900">{rule.name}</span>
                            <span className="text-xs text-slate-500">{rule.description}</span>
                          </div>
                        </div>
                        {toggling === rule.id ? (
                          <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                        ) : (
                          <Switch checked={rule.enabled} onCheckedChange={(checked) => void handleToggleRule(rule.id, checked)} />
                        )}
                      </div>
                    ))
                  )}
               </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-bold">{isDe ? 'Eigene Regex-Muster' : 'Custom Regex Patterns'}</CardTitle>
              <CardDescription>
                {isDe
                  ? 'Benutzerdefinierte Regeln werden über die Enterprise-API bereitgestellt.'
                  : 'Custom rules are provisioned through the Enterprise API.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAddRule} className="flex gap-3">
                <Input placeholder={isDe ? 'Muster-Name (z.B. AWS Keys)' : 'Pattern Name (e.g. AWS Keys)'} className="rounded-xl" />
                <Input placeholder={isDe ? 'Regex-Muster' : 'Regex Pattern'} className="rounded-xl flex-1 font-mono text-xs" />
                <Button type="submit" className="rounded-xl font-bold px-6">{isDe ? 'Regel hinzufügen' : 'Add Rule'}</Button>
              </form>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                <div className="flex items-center justify-center gap-2 text-slate-400 py-4">
                   <AlertTriangle className="w-4 h-4" />
                   <span className="text-xs font-bold uppercase tracking-widest text-[10px]">
                     {isDe
                       ? 'Keine benutzerdefinierten Regeln angewendet'
                       : 'No custom rules applied'}
                   </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="bg-emerald-950 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-lg border border-emerald-900">
             <div className="absolute top-0 right-0 p-8 opacity-10">
                <Lock className="w-24 h-24" />
             </div>
             <div className="relative z-10 max-w-md">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                    {isDe ? 'KONFIGURATION' : 'Configuration'}
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-2">{isDe ? 'Souveräne Datenspeicherung' : 'Sovereign Data Storage'}</h3>
                <p className="text-emerald-100/70 text-sm leading-relaxed mb-6">
                  {isDe
                    ? 'Die PII-Schutzeinstellungen werden in der zentralen Orchestrator-Konfiguration gespeichert und bei jedem KI-Aufruf angewendet.'
                    : 'PII protection settings are stored in the central orchestrator configuration and applied on every AI call.'}
                </p>
                <Button
                  onClick={() => toast.info(isDe ? 'Einstellungen sind gespeichert.' : 'Settings are persisted.')}
                  variant="outline"
                  className="rounded-xl border-emerald-700 bg-transparent text-white hover:bg-emerald-800 hover:text-white font-bold"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {isDe ? 'Redaktionsregeln anzeigen' : 'View Redaction Rules'}
                </Button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
