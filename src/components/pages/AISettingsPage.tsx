import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Cpu,
  Sparkles,
  Zap,
  Cloud,
  Globe,
  ShieldCheck,
  BrainCircuit,
  Activity,
  Lock,
  DollarSign,
  History,
  Radio,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { AdminBreadcrumbs } from '../AdminBreadcrumbs';
import {
  DEFAULT_ORCHESTRATOR_CONFIG,
  type AiFeatureRouting,
  type AiOrchestratorAuditEntry,
  type AiOrchestratorConfig,
  type AiOrchestratorHealth,
  type AiOrchestratorTestResult,
  type AiProviderHealth,
} from '../../types/aiOrchestrator';
import { fetchOrchestratorConfig } from '../../lib/aiOrchestratorClient';

const MODEL_OPTIONS = [
  { value: 'gemini-flash', label: 'Gemini Flash' },
  { value: 'gemini-pro', label: 'Gemini Pro' },
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'claude', label: 'Claude' },
  { value: 'local-llama', label: 'Local Llama' },
  { value: 'qwen-36b', label: 'Qwen 36B (Local)' },
];

const FEATURE_ROUTING_LABELS: Record<keyof AiFeatureRouting, string> = {
  ticket_summarization: 'Ticket Summarization',
  sentiment_analysis: 'Sentiment Analysis',
  smart_reply: 'Smart Reply',
  kb_generation: 'KB Generation',
  escalation_analysis: 'Escalation Analysis',
  root_cause_analysis: 'Root Cause Analysis',
  translation: 'Translation',
  vault_insights: 'Vault Insights',
};

const PROVIDER_SECRET_FIELDS = [
  { id: 'google', label: 'Google Gemini API Key' },
  { id: 'openai', label: 'OpenAI API Key' },
  { id: 'anthropic', label: 'Anthropic API Key' },
  { id: 'azure_openai', label: 'Azure OpenAI API Key' },
  { id: 'local', label: 'Local Gateway Token (Optional)' },
];

function statusIcon(status: AiProviderHealth['status']) {
  if (status === 'online') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (status === 'missing_key') return <XCircle className="w-4 h-4 text-amber-500" />;
  if (status === 'degraded') return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  return <XCircle className="w-4 h-4 text-red-500" />;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="p-2 rounded-xl bg-slate-100">
        <Icon className="w-4 h-4 text-slate-700" />
      </div>
      <div>
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

export default function AISettingsPage() {
  const [config, setConfig] = useState<AiOrchestratorConfig>(DEFAULT_ORCHESTRATOR_CONFIG);
  const [secretStatus, setSecretStatus] = useState<Record<string, boolean>>({});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [health, setHealth] = useState<AiOrchestratorHealth | null>(null);
  const [audit, setAudit] = useState<AiOrchestratorAuditEntry[]>([]);
  const [testResults, setTestResults] = useState<AiOrchestratorTestResult[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<string>('');

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [configRes, healthRes, auditRes] = await Promise.all([
        axios.get('/api/admin/orchestrator/config'),
        axios.get('/api/admin/orchestrator/health'),
        axios.get('/api/admin/orchestrator/audit?limit=30'),
      ]);
      setConfig({ ...DEFAULT_ORCHESTRATOR_CONFIG, ...configRes.data });
      setSecretStatus(configRes.data.secretStatus || {});
      setHealth(healthRes.data);
      setAudit(auditRes.data.entries || []);
      setLastSyncAt(new Date().toISOString());
      void fetchOrchestratorConfig(true);
    } catch (err) {
      console.error('Failed to load orchestrator:', err);
      if (!silent) toast.error('Failed to load AI control plane.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
    const interval = setInterval(() => void loadAll(true), 30_000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const patchConfig = (patch: Partial<AiOrchestratorConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  const patchRouting = (key: keyof AiFeatureRouting, value: string) => {
    setConfig((prev) => ({
      ...prev,
      featureRouting: { ...prev.featureRouting, [key]: value },
    }));
  };

  const handleSave = async () => {
    if (config.configLocked) {
      toast.error('Configuration is locked. Unlock to save changes.');
      return;
    }
    setIsSaving(true);
    try {
      await axios.post('/api/admin/orchestrator/config', {
        ...config,
        secrets: Object.fromEntries(
          Object.entries(secrets).filter(([, v]) => v.trim()),
        ),
      });
      setSecrets({});
      toast.success('Workspace AI configuration synchronized.');
      await loadAll(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to save configuration.';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResults(null);
    try {
      const res = await axios.post('/api/admin/orchestrator/test', {});
      setTestResults(res.data.results || []);
    } catch {
      toast.error('Configuration test failed.');
    } finally {
      setIsTesting(false);
    }
  };

  const readOnly = config.configLocked;
  const metrics = health?.metrics;
  const systemStatus = health?.status ?? 'offline';

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0 bg-[#f4f6f9] custom-scrollbar">
      <div className="p-8 max-w-6xl mx-auto space-y-8 pb-24">
        <AdminBreadcrumbs />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Control Plane</h1>
            <p className="text-muted-foreground text-sm">
              Enterprise orchestrator — workspace-wide routing, governance, and compliance.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastSyncAt && (
              <span className="text-[10px] font-mono text-slate-400">
                Synced {formatRelativeTime(lastSyncAt)}
              </span>
            )}
            <Badge
              variant="outline"
              className={
                systemStatus === 'online'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : systemStatus === 'degraded'
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-red-200 bg-red-50 text-red-700'
              }
            >
              <Radio className="w-3 h-3 mr-1" />
              {systemStatus === 'online' ? 'Control Plane Live' : systemStatus === 'degraded' ? 'Degraded' : 'Offline'}
            </Badge>
          </div>
        </div>

        {/* AI Overview */}
        <Card className="border-slate-200/80 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-6">
            <SectionHeader icon={Sparkles} title="AI Overview" description="Workspace command summary" />
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { label: 'Primary Model', value: config.primaryModel },
                { label: 'Reasoning', value: config.reasoningModel },
                { label: 'Triage', value: config.triageModel },
                { label: 'Scope', value: config.scope },
                { label: 'Requests Today', value: metrics?.totalRequests?.toLocaleString() ?? '—' },
                { label: 'Avg Latency', value: metrics?.averageLatency ? `${metrics.averageLatency}ms` : '—' },
              ].map((item) => (
                <div key={item.label} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                  <p className="text-sm font-bold text-slate-900 mt-1 capitalize">{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Provider Health */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <SectionHeader icon={Activity} title="Provider Health" description="Connection state per AI provider" />
          </CardHeader>
          <CardContent className="space-y-2">
            {(health?.providers ?? []).map((p) => (
              <div
                key={p.provider}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white"
              >
                <div className="flex items-center gap-3">
                  {statusIcon(p.status)}
                  <div>
                    <p className="text-sm font-semibold">{p.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.status === 'online' && p.latencyMs != null && `${p.latencyMs}ms`}
                      {p.status === 'missing_key' && 'API Key Missing'}
                      {p.message && p.status !== 'online' && ` — ${p.message}`}
                    </p>
                  </div>
                </div>
                <div className="text-right text-[10px] text-slate-400 font-mono">
                  {p.requestsToday != null && <div>{p.requestsToday} req today</div>}
                  {p.lastSuccessAt && <div>Last OK {formatRelativeTime(p.lastSuccessAt)}</div>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Configuration Scope + Lock */}
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-6 space-y-4">
            <SectionHeader icon={Globe} title="Configuration Scope" />
            <div className="flex flex-wrap gap-4">
              {(['personal', 'workspace', 'global'] as const).map((scope) => (
                <label key={scope} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    checked={config.scope === scope}
                    disabled={readOnly}
                    onChange={() => patchConfig({ scope })}
                    className="accent-slate-900"
                  />
                  <span className="text-sm capitalize">{scope}</span>
                </label>
              ))}
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-500" />
                <div>
                  <p className="text-sm font-semibold">Lock AI Configuration</p>
                  <p className="text-xs text-muted-foreground">Only Super Admins can modify when locked</p>
                </div>
              </div>
              <Switch
                checked={config.configLocked}
                onCheckedChange={(v) => patchConfig({ configLocked: v })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Model Selection */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <SectionHeader icon={BrainCircuit} title="Model Selection" />
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            {[
              { key: 'primaryModel' as const, label: 'Primary Model' },
              { key: 'reasoningModel' as const, label: 'Reasoning Model' },
              { key: 'triageModel' as const, label: 'Triage / Sentiment Model' },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <Select
                  value={config[key]}
                  disabled={readOnly}
                  onValueChange={(v) => patchConfig({ [key]: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="md:col-span-3 space-y-2">
              <Label>Fallback Models (comma-separated priority)</Label>
              <Input
                disabled={readOnly}
                value={config.fallbackModels.join(', ')}
                onChange={(e) =>
                  patchConfig({
                    fallbackModels: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="claude, gpt-5, local-llama"
              />
            </div>
          </CardContent>
        </Card>

        {/* Feature Routing Matrix */}
        <Card className="rounded-2xl shadow-sm border-purple-100">
          <CardHeader>
            <SectionHeader icon={Zap} title="Feature Routing" description="Visual routing matrix for all GeistDesk AI features" />
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3 font-semibold text-slate-600">Feature</th>
                    <th className="text-left p-3 font-semibold text-slate-600">Routed Model</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(FEATURE_ROUTING_LABELS) as Array<keyof AiFeatureRouting>).map((key) => (
                    <tr key={key} className="border-t border-slate-100">
                      <td className="p-3 font-medium">{FEATURE_ROUTING_LABELS[key]}</td>
                      <td className="p-3">
                        <Select
                          value={config.featureRouting[key]}
                          disabled={readOnly}
                          onValueChange={(v) => patchRouting(key, v)}
                        >
                          <SelectTrigger className="h-8 max-w-[200px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MODEL_OPTIONS.map((m) => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Governance & Policies */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <SectionHeader icon={ShieldCheck} title="Governance & Policies" />
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            {[
              { key: 'piiEnabled' as const, label: 'PII Protection' },
              { key: 'autoEscalationEnabled' as const, label: 'Auto Escalation' },
              { key: 'auditEnabled' as const, label: 'Audit Logging' },
              { key: 'contentFilteringEnabled' as const, label: 'Content Filtering' },
              { key: 'promptLoggingEnabled' as const, label: 'Prompt Logging' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-xl border border-slate-100">
                <span className="text-sm font-medium">{label}</span>
                <Switch
                  checked={config[key]}
                  disabled={readOnly}
                  onCheckedChange={(v) => patchConfig({ [key]: v })}
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label>Reasoning Level</Label>
              <Select
                value={config.reasoningLevel}
                disabled={readOnly}
                onValueChange={(v: AiOrchestratorConfig['reasoningLevel']) => patchConfig({ reasoningLevel: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fast">Fast</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="deep">Deep</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Infrastructure */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="w-4 h-4" /> Infrastructure
            </CardTitle>
            <CardDescription>Ollama, LM Studio, vLLM, Azure OpenAI, and custom gateways</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Local / OpenAI-Compatible Endpoint</Label>
              <Input
                disabled={readOnly}
                value={config.endpointUrl}
                onChange={(e) => patchConfig({ endpointUrl: e.target.value })}
                placeholder="http://localhost:11434/v1"
              />
            </div>
            <Separator />
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Provider API Keys</p>
            <p className="text-[10px] text-muted-foreground -mt-4">
              Stored encrypted server-side. Keys are never persisted in the browser.
            </p>
            {PROVIDER_SECRET_FIELDS.map(({ id, label }) => (
              <div key={id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Cloud className="w-3.5 h-3.5 text-slate-400" />
                  <Label className="text-xs">{label}</Label>
                  {secretStatus[id] && (
                    <Badge variant="outline" className="text-[9px] h-5 border-emerald-200 text-emerald-700">
                      Configured
                    </Badge>
                  )}
                </div>
                <Input
                  type="password"
                  disabled={readOnly}
                  value={secrets[id] || ''}
                  onChange={(e) => setSecrets((s) => ({ ...s, [id]: e.target.value }))}
                  placeholder={secretStatus[id] ? '••••••••  (leave blank to keep)' : 'Enter API key'}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Security & Compliance */}
        <Card className="rounded-2xl shadow-sm border-emerald-100 bg-emerald-50/30">
          <CardHeader>
            <SectionHeader icon={ShieldCheck} title="Security & Compliance" />
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            {[
              { label: 'PII Shield', ok: config.piiEnabled },
              { label: 'Audit Logging', ok: config.auditEnabled },
              { label: 'Data Encrypted', ok: true },
              { label: 'Compliance Ready', ok: config.contentFilteringEnabled && config.piiEnabled },
            ].map(({ label, ok }) => (
              <div key={label} className="flex items-center gap-2 p-3 bg-white rounded-xl border border-emerald-100">
                {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-red-500" />}
                <span className="text-sm font-medium">{label}</span>
                <span className="ml-auto text-xs text-emerald-700 font-semibold">{ok ? 'Enabled' : 'Disabled'}</span>
              </div>
            ))}
            <div className="sm:col-span-2 space-y-2">
              <Label>Data Residency</Label>
              <Select
                value={config.dataResidency}
                disabled={readOnly}
                onValueChange={(v) => patchConfig({ dataResidency: v })}
              >
                <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="eu">EU</SelectItem>
                  <SelectItem value="us">US</SelectItem>
                  <SelectItem value="global">Global</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Cost Analytics */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <SectionHeader icon={DollarSign} title="Cost Analytics" />
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Today's Cost", value: `$${metrics?.costTodayUsd?.toFixed(2) ?? '0.00'}` },
              { label: 'Monthly Cost', value: `$${metrics?.costMonthUsd?.toFixed(2) ?? '0.00'}` },
              { label: 'Requests Today', value: metrics?.totalRequests ?? 0 },
              { label: 'Avg Cost / Ticket', value: `$${metrics?.avgCostPerTicketUsd?.toFixed(4) ?? '0.0000'}` },
            ].map((item) => (
              <div key={item.label} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                <p className="text-xl font-black text-slate-900 mt-1 font-mono">{item.value}</p>
              </div>
            ))}
            <div className="col-span-2 md:col-span-4 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
              <p className="text-xs text-indigo-700">
                Top Consumer: <strong className="capitalize">{metrics?.topConsumerFeature?.replace(/_/g, ' ') ?? '—'}</strong>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Audit Trail */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <SectionHeader icon={History} title="Audit Trail" />
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {audit.length === 0 && (
              <p className="text-sm text-muted-foreground">No configuration changes recorded yet.</p>
            )}
            {audit.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between p-3 rounded-xl border border-slate-100 text-sm">
                <div>
                  <p className="font-medium">{entry.userEmail || 'System'} — {entry.action}</p>
                  {entry.fieldName && entry.oldValue && entry.newValue && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                      {entry.fieldName}: {entry.oldValue} → {entry.newValue}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                  {formatRelativeTime(entry.createdAt)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Test + Save */}
        <div className="flex flex-col sm:flex-row gap-3 sticky bottom-4 bg-[#f4f6f9]/95 backdrop-blur p-4 rounded-2xl border border-slate-200 shadow-lg">
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-xl"
            onClick={handleTest}
            disabled={isTesting}
          >
            {isTesting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Test AI Configuration
          </Button>
          <Button
            className="flex-1 h-12 rounded-xl bg-slate-900 hover:bg-black"
            onClick={handleSave}
            disabled={isSaving || readOnly}
          >
            {isSaving ? 'Synchronizing…' : 'Save Workspace Configuration'}
          </Button>
        </div>

        {testResults && (
          <Card className="rounded-2xl border-blue-100">
            <CardHeader><CardTitle className="text-sm">Test Results</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {testResults.map((r) => (
                <div key={r.provider} className="flex items-center gap-2 text-sm">
                  {r.success ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                  <span className="font-medium">{r.label}</span>
                  <span className="text-muted-foreground">— {r.message}</span>
                  {r.latencyMs != null && <span className="ml-auto text-xs font-mono">{r.latencyMs}ms</span>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
