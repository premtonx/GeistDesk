import { useCallback, useEffect, useState, type ElementType } from 'react';
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
  Power,
  RotateCcw,
  Ban,
  Loader2,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { AdminBreadcrumbs } from '../AdminBreadcrumbs';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useTranslation } from '../../lib/context/I18nContext';
import {
  DEFAULT_ORCHESTRATOR_CONFIG,
  type AiFeatureRouting,
  type AiOrchestratorAuditEntry,
  type AiOrchestratorConfig,
  type AiOrchestratorHealth,
  type AiOrchestratorTestResult,
  type AiOrchestratorVersion,
  type AiProviderHealth,
  type DetectedLocalModel,
} from '../../types/aiOrchestrator';
import {
  fetchOrchestratorConfig,
  startOrchestratorConfigSync,
  subscribeOrchestratorConfig,
} from '../../lib/aiOrchestratorClient';
import { ProviderPriorityList } from '../ai-orchestrator/ProviderPriorityList';
import { AiOrchestratorWorkbench } from '../ai-orchestrator/AiOrchestratorWorkbench';

const MODEL_OPTIONS = [
  { value: 'gemini-flash', label: 'Gemini Flash' },
  { value: 'gemini-pro', label: 'Gemini Pro' },
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'claude', label: 'Claude' },
  { value: 'local-llama', label: 'Local Llama' },
  { value: 'qwen-36b', label: 'Qwen 36B (Local)' },
];

const FEATURE_ROUTING_KEYS: Array<keyof AiFeatureRouting> = [
  'ticket_summarization',
  'sentiment_analysis',
  'smart_reply',
  'kb_generation',
  'escalation_analysis',
  'root_cause_analysis',
  'translation',
  'vault_insights',
];

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

function SectionHeader({ icon: Icon, title, description }: { icon: ElementType; title: string; description?: string }) {
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

function FeatureInfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className="inline-flex shrink-0 items-center text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded-sm"
        aria-label={text}
      >
        <Info className="w-3.5 h-3.5" />
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[280px] text-left leading-snug font-normal normal-case tracking-normal"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export default function AISettingsPage() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AiOrchestratorConfig>(DEFAULT_ORCHESTRATOR_CONFIG);
  const [secretStatus, setSecretStatus] = useState<Record<string, boolean>>({});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [health, setHealth] = useState<AiOrchestratorHealth | null>(null);
  const [audit, setAudit] = useState<AiOrchestratorAuditEntry[]>([]);
  const [testResults, setTestResults] = useState<AiOrchestratorTestResult[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [versions, setVersions] = useState<AiOrchestratorVersion[]>([]);
  const [detectedModels, setDetectedModels] = useState<DetectedLocalModel[]>([]);
  const [isDetectingModels, setIsDetectingModels] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string>('');
  const [bulkRoutingModel, setBulkRoutingModel] = useState(MODEL_OPTIONS[0]?.value ?? 'gemini-flash');

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [configRes, healthRes, auditRes, versionsRes] = await Promise.all([
        axios.get('/api/admin/orchestrator/config'),
        axios.get('/api/admin/orchestrator/health'),
        axios.get('/api/admin/orchestrator/audit?limit=30'),
        axios.get('/api/admin/orchestrator/versions?limit=15'),
      ]);
      setConfig({ ...DEFAULT_ORCHESTRATOR_CONFIG, ...configRes.data });
      setSecretStatus(configRes.data.secretStatus || {});
      setHealth(healthRes.data);
      setAudit(auditRes.data.entries || []);
      setVersions(versionsRes.data.versions || []);
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
    startOrchestratorConfigSync();
    void loadAll();
    return subscribeOrchestratorConfig((cfg) => {
      setConfig(cfg);
      setLastSyncAt(new Date().toISOString());
    });
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

  const applyBulkRouting = () => {
    if (config.configLocked || !bulkRoutingModel) return;
    setConfig((prev) => ({
      ...prev,
      featureRouting: FEATURE_ROUTING_KEYS.reduce(
        (acc, key) => ({ ...acc, [key]: bulkRoutingModel }),
        { ...prev.featureRouting },
      ),
    }));
    toast.success(t('aiOrchestrator.featureRouting.bulkApplied', 'Routed model applied to all features.'));
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

  const handleRestoreVersion = async (versionId: string) => {
    setIsRestoring(true);
    try {
      await axios.post('/api/admin/orchestrator/restore', { versionId });
      toast.success('Configuration restored from snapshot.');
      await loadAll(true);
    } catch {
      toast.error('Failed to restore version.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDetectModels = async () => {
    setIsDetectingModels(true);
    try {
      const res = await axios.get('/api/admin/orchestrator/models', {
        params: { endpoint: config.endpointUrl },
      });
      setDetectedModels(res.data.models || []);
      toast.success(`Detected ${res.data.models?.length ?? 0} local models.`);
    } catch {
      toast.error('Model detection failed. Check endpoint URL.');
    } finally {
      setIsDetectingModels(false);
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
  const usage = health?.usage;
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
                systemStatus === 'healthy'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : systemStatus === 'degraded'
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-red-200 bg-red-50 text-red-700'
              }
            >
              <Radio className="w-3 h-3 mr-1" />
              {health?.label ?? (systemStatus === 'healthy' ? 'AI Healthy' : systemStatus === 'degraded' ? 'AI Degraded' : 'AI Offline')}
              {config.configVersion > 0 && (
                <span className="ml-1 opacity-60">v{config.configVersion}</span>
              )}
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

        <AiOrchestratorWorkbench
          config={config}
          readOnly={readOnly}
          onPersonasChange={(featurePersonas) => patchConfig({ featurePersonas })}
        />

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
              {(['workspace', 'global'] as const).map((scope) => (
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
                  {scope === 'global' && (
                    <span className="text-[10px] text-muted-foreground">(Super Admin only)</span>
                  )}
                </label>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">Default: Workspace — all admins share identical AI behavior.</p>
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

        {/* Provider Priority (Failover Order) */}
        <Card className="rounded-2xl shadow-sm border-indigo-100">
          <CardHeader>
            <SectionHeader
              icon={BrainCircuit}
              title="Provider Priority"
              description="Drag to reorder — runtime failover follows exact order"
            />
          </CardHeader>
          <CardContent>
            <ProviderPriorityList
              items={config.providerPriority}
              disabled={readOnly}
              onChange={(providerPriority) => patchConfig({ providerPriority })}
            />
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
          </CardContent>
        </Card>

        {/* Feature Routing Matrix */}
        <Card className="rounded-2xl shadow-sm border-purple-100">
          <CardHeader>
            <SectionHeader
              icon={Zap}
              title={t('aiOrchestrator.featureRouting.title', 'Feature Routing')}
              description={t('aiOrchestrator.featureRouting.description', 'Visual routing matrix for all GeistDesk AI features')}
            />
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border overflow-hidden bg-white">
              <div className="flex flex-wrap items-center gap-2.5 px-3 py-2.5 border-b border-slate-100 bg-slate-50/80">
                <span className="text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0">
                  {t('aiOrchestrator.featureRouting.bulkRouter', 'Bulk Model Router')}
                </span>
                <Select
                  value={bulkRoutingModel}
                  disabled={readOnly}
                  onValueChange={setBulkRoutingModel}
                >
                  <SelectTrigger className="h-8 w-[min(100%,200px)] bg-white">
                    <SelectValue placeholder={t('aiOrchestrator.featureRouting.selectModel', 'Select model…')} />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 shrink-0"
                  disabled={readOnly || !bulkRoutingModel}
                  onClick={applyBulkRouting}
                >
                  {t('aiOrchestrator.featureRouting.applyToAll', 'Apply to All')}
                </Button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3 font-semibold text-slate-600">
                      {t('aiOrchestrator.featureRouting.featureColumn', 'Feature')}
                    </th>
                    <th className="text-left p-3 font-semibold text-slate-600">
                      {t('aiOrchestrator.featureRouting.routedModelColumn', 'Routed Model')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_ROUTING_KEYS.map((key) => (
                    <tr key={key} className="border-t border-slate-100">
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate">
                            {t(`aiOrchestrator.features.${key}.label`, key.replace(/_/g, ' '))}
                          </span>
                          <FeatureInfoTooltip
                            text={t(
                              `aiOrchestrator.features.${key}.tooltip`,
                              'Configure which model handles this AI feature.',
                            )}
                          />
                        </div>
                      </td>
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

        {/* Emergency Kill Switch */}
        <Card className="rounded-2xl shadow-sm border-red-100 bg-red-50/20">
          <CardHeader>
            <SectionHeader icon={Ban} title="Emergency Kill Switch" description="Disable AI features during outages — platform remains operational" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl border border-red-200 bg-white">
              <div>
                <p className="text-sm font-bold text-red-800">Disable All AI Features</p>
                <p className="text-xs text-red-600">Master kill switch</p>
              </div>
              <Switch
                checked={config.killSwitch.master}
                disabled={readOnly}
                onCheckedChange={(v) => patchConfig({ killSwitch: { ...config.killSwitch, master: v } })}
              />
            </div>
            {[
              { key: 'smartReply' as const, label: 'Smart Reply' },
              { key: 'summaries' as const, label: 'Summaries' },
              { key: 'kbGeneration' as const, label: 'KB Generation' },
              { key: 'sentiment' as const, label: 'Sentiment Analysis' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white">
                <span className="text-sm">{label}</span>
                <Switch
                  checked={config.killSwitch[key]}
                  disabled={readOnly || config.killSwitch.master}
                  onCheckedChange={(v) => patchConfig({ killSwitch: { ...config.killSwitch, [key]: v } })}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Cost Protection */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <SectionHeader icon={Power} title="AI Cost Protection" description="Automatic fallback when budgets are exceeded" />
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Daily Budget (USD)</Label>
              <Input
                type="number"
                disabled={readOnly}
                value={config.dailyBudgetUsd}
                onChange={(e) => patchConfig({ dailyBudgetUsd: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Monthly Budget (USD)</Label>
              <Input
                type="number"
                disabled={readOnly}
                value={config.monthlyBudgetUsd}
                onChange={(e) => patchConfig({ monthlyBudgetUsd: Number(e.target.value) })}
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>When Budget Exceeded</Label>
              <Select
                value={config.budgetExceededAction}
                disabled={readOnly}
                onValueChange={(v: AiOrchestratorConfig['budgetExceededAction']) => patchConfig({ budgetExceededAction: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local_fallback">Fallback to Local Llama</SelectItem>
                  <SelectItem value="disable_non_critical">Disable Non-Critical Features</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {health?.budgetExceeded && (
              <div className="sm:col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-semibold">
                Budget threshold exceeded — {config.budgetExceededAction === 'local_fallback' ? 'routing to local fallback' : 'non-critical features disabled'}.
              </div>
            )}
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDetectingModels}
                onClick={handleDetectModels}
                className="mt-2"
              >
                {isDetectingModels ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Detect Local Models
              </Button>
              {detectedModels.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {detectedModels.map((m) => (
                    <Badge key={m.id} variant="outline" className="text-xs">
                      {m.name} ({m.provider})
                    </Badge>
                  ))}
                </div>
              )}
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

        {/* Module Usage Analytics */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <SectionHeader icon={Activity} title="AI Usage Analytics" description="Consumption by GeistDesk module" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Requests Today', value: usage?.requestsToday ?? 0 },
                { label: 'Requests Month', value: usage?.requestsMonth ?? 0 },
                { label: 'Success Rate', value: `${usage?.successRate ?? 100}%` },
                { label: 'Failure Rate', value: `${usage?.failureRate ?? 0}%` },
                { label: 'Avg Latency', value: `${usage?.averageLatency ?? 0}ms` },
                { label: 'Avg Cost', value: `$${usage?.averageCost?.toFixed(4) ?? '0.0000'}` },
              ].map((item) => (
                <div key={item.label} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-black uppercase text-slate-400">{item.label}</p>
                  <p className="text-lg font-black font-mono mt-1">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3">Module</th>
                    <th className="text-right p-3">Today</th>
                    <th className="text-right p-3">Month</th>
                    <th className="text-right p-3">Success</th>
                    <th className="text-right p-3">Avg Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {(usage?.byModule ?? []).map((m) => (
                    <tr key={m.module} className="border-t border-slate-100">
                      <td className="p-3 font-semibold capitalize">{m.module}</td>
                      <td className="p-3 text-right font-mono">{m.requestsToday}</td>
                      <td className="p-3 text-right font-mono">{m.requestsMonth}</td>
                      <td className="p-3 text-right">{m.successRate}%</td>
                      <td className="p-3 text-right font-mono">{m.averageLatency}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Prompt Audit (metadata only) */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <SectionHeader icon={Zap} title="Prompt Audit" description="Feature usage metadata — no user content stored" />
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3">Feature</th>
                    <th className="text-left p-3">Model</th>
                    <th className="text-right p-3">Request Count</th>
                    <th className="text-right p-3">Last Used</th>
                  </tr>
                </thead>
                <tbody>
                  {(usage?.byFeature ?? []).map((f) => (
                    <tr key={f.feature} className="border-t border-slate-100">
                      <td className="p-3 font-medium">{f.featureLabel}</td>
                      <td className="p-3 font-mono text-xs">{f.model}</td>
                      <td className="p-3 text-right font-mono">{f.requestCount.toLocaleString()}</td>
                      <td className="p-3 text-right text-xs text-muted-foreground">
                        {f.lastUsedAt ? formatRelativeTime(f.lastUsedAt) : '—'}
                      </td>
                    </tr>
                  ))}
                  {(usage?.byFeature ?? []).length === 0 && (
                    <tr><td colSpan={4} className="p-4 text-center text-muted-foreground text-sm">No usage recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Configuration Versions */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <SectionHeader icon={History} title="Configuration Versions" description="Rollback routing if production config breaks" />
          </CardHeader>
          <CardContent className="space-y-2 max-h-56 overflow-y-auto">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100">
                <div>
                  <p className="text-sm font-bold">Version {v.versionNumber}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {v.createdBy || 'System'} · {formatRelativeTime(v.createdAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isRestoring || readOnly}
                  onClick={() => handleRestoreVersion(v.id)}
                >
                  <RotateCcw className="w-3 h-3 mr-1" /> Restore
                </Button>
              </div>
            ))}
            {versions.length === 0 && (
              <p className="text-sm text-muted-foreground">Versions are created on each save.</p>
            )}
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
