import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  Activity,
  CheckCircle2,
  Cloud,
  Cpu,
  Gauge,
  Info,
  Loader2,
  Play,
  RefreshCw,
  Server,
  Sparkles,
  Timer,
  XCircle,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Separator } from '../../ui/separator';
import { Badge } from '../../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';
import { useTranslation } from '../../../lib/context/I18nContext';
import { persistOrchestratorPatch } from '../../../lib/persistOrchestratorPatch';
import {
  fetchOrchestratorConfig,
  startOrchestratorConfigSync,
  subscribeOrchestratorConfig,
} from '../../../lib/aiOrchestratorClient';
import {
  DEFAULT_ORCHESTRATOR_CONFIG,
  ORCHESTRATOR_MODEL_OPTIONS,
  CRITIC_MODEL_OPTIONS,
  type AiFeatureRouting,
  type AiOrchestratorConfig,
  type AiOrchestratorHealth,
  type AiProviderHealth,
  type AiPlaygroundRunResult,
  type DetectedLocalModel,
} from '../../../types/ai-orchestrator';
import { cn } from '../../../lib/utils';
import { AdminHubSectionGrid } from './AdminHubSectionGrid';
import { categoriesForTab } from './adminHubConfig';
import type { AdminHubTelemetry } from './adminHubTelemetry';

interface AdminHubAiEngineTabProps {
  telemetry: AdminHubTelemetry;
}

const PROVIDER_SECRET_FIELDS = [
  { id: 'google', label: 'Google Gemini API Key' },
  { id: 'openai', label: 'OpenAI API Key' },
  { id: 'anthropic', label: 'Anthropic API Key' },
  { id: 'azure_openai', label: 'Azure OpenAI API Key' },
  { id: 'local', label: 'Local Gateway Token (Optional)' },
];

const TASK_ROWS: Array<{
  id: keyof AiFeatureRouting;
  emoji: string;
  title: string;
  description: string;
  tooltip: string;
}> = [
  {
    id: 'smart_reply',
    emoji: '🎯',
    title: 'Primary Model',
    description: 'Chat & Ticket drafting',
    tooltip:
      'Handles customer-facing replies and draft suggestions. Use your most capable chat model for high-quality, on-brand responses.',
  },
  {
    id: 'sentiment_analysis',
    emoji: '⚡',
    title: 'Triage & Categorization',
    description: 'Fast tagging of inbound emails',
    tooltip:
      'Quickly tags priority, sentiment, and category for incoming emails. Prefer a low-latency model to keep triage instant.',
  },
  {
    id: 'escalation_analysis',
    emoji: '🔍',
    title: 'Sentiment & Escalation',
    description: 'Detects urgency and emotion',
    tooltip:
      'Analyzes customer tone to detect urgency or high emotion and triggers escalations. Needs strong emotional-intelligence capability.',
  },
  {
    id: 'root_cause_analysis',
    emoji: '🧠',
    title: 'Deep Reasoning',
    description: 'Complex multi-step diagnostic solver',
    tooltip:
      'Performs deep root-cause analysis on complex incidents. Requires strong multi-step reasoning — use your most advanced model.',
  },
  {
    id: 'ticket_summarization',
    emoji: '📝',
    title: 'Thread Summarization',
    description: 'Briefs for human agents',
    tooltip:
      'Generates concise TL;DR summaries of support threads so human agents get quick context before diving in.',
  },
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
        className="max-w-[300px] text-left leading-snug font-normal normal-case tracking-normal"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function AdminHubAiEngineTab({ telemetry }: AdminHubAiEngineTabProps) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AiOrchestratorConfig>(DEFAULT_ORCHESTRATOR_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [health, setHealth] = useState<AiOrchestratorHealth | null>(null);
  const [endpointDraft, setEndpointDraft] = useState('');
  const [detectedModels, setDetectedModels] = useState<DetectedLocalModel[]>([]);
  const [isDetectingModels, setIsDetectingModels] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; latencyMs?: number; message: string }>>({});
  const [testingTask, setTestingTask] = useState<keyof AiFeatureRouting | null>(null);
  const [testOutputs, setTestOutputs] = useState<Record<string, AiPlaygroundRunResult>>({});
  const [bulkRoutingModel, setBulkRoutingModel] = useState<string>(
    ORCHESTRATOR_MODEL_OPTIONS[0]?.value ?? 'gemini-flash',
  );
  const [simpleModel, setSimpleModel] = useState('gemini-flash');

  const loadHealth = useCallback(async () => {
    try {
      const res = await axios.get('/api/admin/orchestrator/health');
      setHealth(res.data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    startOrchestratorConfigSync();
    let alive = true;
    void axios
      .get('/api/admin/orchestrator/config')
      .then((res) => {
        if (!alive) return;
        const next = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...res.data };
        setConfig(next);
        setEndpointDraft(next.endpointUrl || '');
        setSimpleModel(next.featureRouting?.smart_reply ?? next.triageModel ?? 'gemini-flash');
        void fetchOrchestratorConfig(true);
      })
      .catch((err) => {
        console.warn('Orchestrator config unavailable', err);
        toast.error(t('admin.hubAi.loadError', 'Could not load workspace AI routing.'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    void loadHealth();
    const healthInterval = window.setInterval(loadHealth, 20_000);

    const unsubscribe = subscribeOrchestratorConfig((next) => {
      setConfig(next);
      setEndpointDraft(next.endpointUrl || '');
    });

    return () => {
      alive = false;
      unsubscribe();
      window.clearInterval(healthInterval);
    };
  }, [t, loadHealth]);

  const persistPatch = useCallback(
    async (patch: Partial<AiOrchestratorConfig>) => {
      if (config.configLocked) {
        toast.error(t('admin.hubAi.locked', 'Configuration is locked. Unlock it in the AI Orchestrator.'));
        return;
      }
      setSaving(true);
      setConfig((prev) => ({
        ...prev,
        ...patch,
        featureRouting: patch.featureRouting ?? prev.featureRouting,
      }));
      try {
        const saved = await persistOrchestratorPatch(patch);
        setConfig(saved);
        if (patch.endpointUrl !== undefined) setEndpointDraft(saved.endpointUrl || '');
        toast.success(t('aiOrchestrator.featureRouting.savedWorkspace', 'Saved to the workspace database.'));
      } catch (err: unknown) {
        const message = axios.isAxiosError(err)
          ? err.response?.data?.error || err.message
          : t('admin.hubAi.saveError', 'Could not save workspace AI routing.');
        toast.error(String(message));
        try {
          const res = await axios.get('/api/admin/orchestrator/config');
          const next = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...res.data };
          setConfig(next);
          setEndpointDraft(next.endpointUrl || '');
        } catch {
          /* keep optimistic state if reload fails */
        }
      } finally {
        setSaving(false);
      }
    },
    [config.configLocked, t],
  );

  useEffect(() => {
    if (loading) return;
    const trimmed = endpointDraft.trim();
    if (trimmed === (config.endpointUrl || '').trim()) return;
    const timer = window.setTimeout(() => {
      void persistPatch({ endpointUrl: trimmed });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [config.endpointUrl, endpointDraft, loading, persistPatch]);

  const persistRouting = (next: AiFeatureRouting) => {
    void persistPatch({ featureRouting: next });
  };

  const applySimpleModel = (value: string) => {
    setSimpleModel(value);
    const next = { ...config.featureRouting };
    for (const row of TASK_ROWS) next[row.id] = value;
    persistRouting(next);
  };

  const applyBulkRouting = () => {
    if (!bulkRoutingModel) return;
    const next = { ...config.featureRouting };
    for (const row of TASK_ROWS) next[row.id] = bulkRoutingModel;
    persistRouting(next);
    toast.success(t('aiOrchestrator.featureRouting.applyToAll', 'Routed model applied to all tasks.'));
  };

  const handleSaveSecrets = async () => {
    const nonEmpty = Object.fromEntries(Object.entries(secrets).filter(([, v]) => v.trim()));
    if (Object.keys(nonEmpty).length === 0) {
      toast.info('No new API keys to save.');
      return;
    }
    setSaving(true);
    try {
      await axios.post('/api/admin/orchestrator/config', { secrets: nonEmpty });
      setSecrets({});
      toast.success(t('admin.hubAi.secretsSaved', 'API keys saved and encrypted.'));
      void loadHealth();
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : 'Failed to save API keys.';
      toast.error(String(message));
    } finally {
      setSaving(false);
    }
  };

  const handleDetectModels = async () => {
    setIsDetectingModels(true);
    try {
      const res = await axios.get('/api/admin/orchestrator/models', {
        params: { endpoint: config.endpointUrl || undefined },
      });
      setDetectedModels(res.data.models || []);
      toast.success(t('admin.hubAi.modelsDetected', 'Local models detected:') + ` ${res.data.models?.length ?? 0}`);
    } catch {
      toast.error(t('admin.hubAi.modelsDetectError', 'Model detection failed. Check endpoint URL.'));
    } finally {
      setIsDetectingModels(false);
    }
  };

  const handleTestProvider = async (provider: string) => {
    setTestingProvider(provider);
    try {
      const res = await axios.post('/api/admin/orchestrator/test');
      const results = (res.data?.results ?? []) as Array<{ provider: string; label: string; success: boolean; latencyMs?: number; message: string }>;
      const match = results.find((r) => r.provider === provider);
      if (match) {
        setTestResults((prev) => ({ ...prev, [provider]: match }));
      } else {
        setTestResults((prev) => ({ ...prev, [provider]: { success: false, message: 'No result for this provider.' } }));
      }
      void loadHealth();
    } catch {
      setTestResults((prev) => ({ ...prev, [provider]: { success: false, message: 'Provider test failed.' } }));
    } finally {
      setTestingProvider(null);
    }
  };

  const handleTestPrompt = async (taskId: keyof AiFeatureRouting) => {
    const task = TASK_ROWS.find((row) => row.id === taskId);
    if (!task) return;
    setTestingTask(taskId);
    const model = config.featureRouting[taskId];
    try {
      const res = await axios.post('/api/admin/orchestrator/playground', {
        prompt: `You are the "${task.title}" engine. ${task.tooltip.replace(/\./g, ' ')} Produce a brief sample output for testing.`,
        models: [model],
      });
      const results = (res.data?.results ?? []) as AiPlaygroundRunResult[];
      if (results[0]) {
        setTestOutputs((prev) => ({ ...prev, [taskId]: results[0] }));
      }
    } catch {
      setTestOutputs((prev) => ({
        ...prev,
        [taskId]: { model, label: model, output: 'Test failed.', latencyMs: 0, confidence: 0, success: false },
      }));
    } finally {
      setTestingTask(null);
    }
  };

  const readOnly = config.configLocked;
  const isSimple = config.modelMode !== 'advanced';

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">
            {t('admin.hubAi.title', 'Kern-KI & Modelle')}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {t('admin.hubAi.subtitle', 'Active engine routing, local Ollama/OpenAI endpoints, and live latency.')}
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600 mt-2 inline-flex items-center gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {t('aiOrchestrator.featureRouting.workspaceScope', 'Workspace-wide · saved to the database')}
          </p>
        </div>
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
          <Activity className="w-3 h-3 mr-1" />
          {health?.status === 'healthy'
            ? 'AI Healthy'
            : health?.status === 'degraded'
              ? 'AI Degraded'
              : 'AI Offline'}
        </Badge>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <>
          {/* ============ CARD A: AI Providers & Endpoints ============ */}
          <div className="bg-white border border-slate-200/80 rounded-[2rem] p-6 xl:p-8 shadow-sm">
            <div className="flex items-start gap-3 mb-6">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
                  {t('admin.hubAi.providersTitle', 'AI Providers & Endpoints')}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('admin.hubAi.providersDesc', 'Configure and test Ollama / OpenAI / Custom endpoints with real-time ping and latency indicators.')}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label>{t('admin.hubAi.endpointLabel', 'Local / OpenAI-Compatible Endpoint')}</Label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    value={endpointDraft}
                    disabled={readOnly}
                    onChange={(event) => setEndpointDraft(event.target.value)}
                    placeholder={t('admin.hubAi.endpointUnset', 'Not configured')}
                    className="sm:flex-1 bg-white"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isDetectingModels || readOnly}
                    onClick={handleDetectModels}
                  >
                    {isDetectingModels ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    {t('admin.hubAi.detectModels', 'Detect Local Models')}
                  </Button>
                </div>
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

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  {t('admin.hubAi.providerKeys', 'Provider API Keys')}
                </p>
                <p className="text-[10px] text-muted-foreground mb-4">
                  {t('admin.hubAi.keysHint', 'Stored encrypted server-side. Keys are never persisted in the browser.')}
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {PROVIDER_SECRET_FIELDS.map(({ id, label }) => (
                    <div key={id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Cloud className="w-3.5 h-3.5 text-slate-400" />
                        <Label className="text-xs">{label}</Label>
                      </div>
                      <Input
                        type="password"
                        disabled={readOnly}
                        value={secrets[id] || ''}
                        onChange={(e) => setSecrets((s) => ({ ...s, [id]: e.target.value }))}
                        placeholder="Enter API key"
                      />
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  disabled={readOnly || saving}
                  onClick={handleSaveSecrets}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {t('admin.hubAi.saveKeys', 'Save API Keys')}
                </Button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t('admin.hubAi.providerHealth', 'Provider Health & Ping')}
                  </p>
                  <span className="text-[10px] font-mono text-slate-400">auto-refresh 20s</span>
                </div>
                <div className="space-y-2">
                  {(health?.providers ?? []).map((p) => {
                    const result = testResults[p.provider];
                    const testing = testingProvider === p.provider;
                    return (
                      <div key={p.provider} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white">
                        <div className="flex items-center gap-3">
                          {statusIcon(p.status)}
                          <div>
                            <p className="text-sm font-semibold">{p.label}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {p.status === 'online' && p.latencyMs != null && `${p.latencyMs}ms`}
                              {p.status === 'missing_key' && 'API Key Missing'}
                              {p.message && p.status !== 'online' && ` — ${p.message}`}
                            </p>
                            {result && (
                              <p className={cn('text-[10px] font-semibold', result.success ? 'text-emerald-600' : 'text-red-600')}>
                                Test: {result.success ? `OK ${result.latencyMs ?? ''}ms` : result.message}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {p.status === 'online' && (
                            <span className="inline-flex items-center gap-1 text-emerald-600 text-[10px] font-mono">
                              <Gauge className="w-3 h-3" />
                              {p.latencyMs}ms
                            </span>
                          )}
                          {p.lastSuccessAt && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {formatRelativeTime(p.lastSuccessAt)}
                            </span>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] px-2.5"
                            disabled={testing}
                            onClick={() => handleTestProvider(p.provider)}
                          >
                            {testing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                            Test
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {(health?.providers ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">No provider health data available.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ============ CARD B: Model Preset Mode ============ */}
          <div className="bg-white border border-indigo-200/60 rounded-[2rem] p-6 xl:p-8 shadow-sm">
            <div className="flex items-start gap-3 mb-6">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
                  {t('admin.hubAi.presetModeTitle', 'Model Preset Mode')}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('admin.hubAi.presetModeDesc', 'Simple Mode uses one global model for every task. Advanced Mode unlocks the per-task routing matrix below.')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <div>
                  <p className="text-sm font-bold">
                    {isSimple
                      ? t('admin.hubAi.simpleMode', 'Simple Mode')
                      : t('admin.hubAi.advancedMode', 'Advanced Task Routing')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isSimple
                      ? t('admin.hubAi.simpleModeDesc', 'One global model powers all AI tasks.')
                      : t('admin.hubAi.advancedModeDesc', 'Each task routes to its own tuned model.')}
                  </p>
                </div>
              </div>
              <Switch
                checked={!isSimple}
                disabled={readOnly}
                onCheckedChange={(checked) => void persistPatch({ modelMode: checked ? 'advanced' : 'simple' })}
              />
            </div>

            {isSimple && (
              <div className="mt-4 space-y-2">
                <Label>{t('admin.hubAi.globalModel', 'Global Model (all tasks)')}</Label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Select value={simpleModel} disabled={readOnly} onValueChange={applySimpleModel}>
                    <SelectTrigger className="sm:max-w-[240px] bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORCHESTRATOR_MODEL_OPTIONS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    disabled={testingTask === 'smart_reply' || readOnly}
                    onClick={() => handleTestPrompt('smart_reply')}
                  >
                    {testingTask === 'smart_reply' ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    {t('admin.hubAi.testPrompt', 'Test Prompt')}
                  </Button>
                </div>
                {testOutputs['smart_reply'] && (
                  <div
                    className={cn(
                      'rounded-xl border p-3 text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto',
                      testOutputs['smart_reply'].success
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : 'border-red-200 bg-red-50/40',
                    )}
                  >
                    <span className="inline-flex items-center gap-1 font-sans font-bold mb-1">
                      <Timer className="w-3 h-3" /> {testOutputs['smart_reply'].latencyMs}ms
                    </span>
                    <br />
                    {testOutputs['smart_reply'].success
                      ? testOutputs['smart_reply'].output
                      : testOutputs['smart_reply'].error || 'Test failed.'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ============ CARD C: Agentic Loops & Self-Correction ============ */}
          <div className="bg-white border border-teal-200/60 rounded-[2rem] p-6 xl:p-8 shadow-sm">
            <div className="flex items-start gap-3 mb-6">
              <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
                  {t('admin.hubAi.agenticLoopsTitle', 'Agentic Loops & Self-Correction')}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('admin.hubAi.agenticLoopsDesc', 'Evaluator-optimizer self-critique engine, human-diff feedback learning, and swarm outage detection.')}
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Self-Critique Engine toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-500" />
                  <div>
                    <p className="text-sm font-bold">
                      {t('admin.hubAi.selfCritiqueEngine', 'Self-Critique Engine')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('admin.hubAi.selfCritiqueEngineDesc', 'Run AI drafts through the evaluator-optimizer loop before they reach your inbox.')}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={config.enableSelfCritiqueLoop}
                  disabled={readOnly}
                  onCheckedChange={(checked) => void persistPatch({ enableSelfCritiqueLoop: checked })}
                />
              </div>

              {/* Max Iterations Slider */}
              <div className="p-3 rounded-xl border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {t('admin.hubAi.maxIterations', 'Max Self-Critique Iterations')}
                    </Label>
                  </div>
                  <Badge variant="outline" className="text-[11px] font-black text-teal-700 border-teal-200 bg-teal-50">
                    {config.maxCritiqueIterations}
                  </Badge>
                </div>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={1}
                  value={config.maxCritiqueIterations}
                  disabled={readOnly || !config.enableSelfCritiqueLoop}
                  onChange={(e) => void persistPatch({ maxCritiqueIterations: Number(e.target.value) })}
                  className="w-full accent-teal-600 disabled:opacity-40"
                  aria-label={t('admin.hubAi.maxIterations', 'Max Self-Critique Iterations')}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                  <span>1 · fastest</span>
                  <span>2 · balanced</span>
                  <span>3 · strictest</span>
                </div>
              </div>

              {/* Confidence Threshold Slider */}
              <div className="p-3 rounded-xl border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-3.5 h-3.5 text-slate-400" />
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {t('admin.hubAi.confidenceThreshold', 'Confidence Threshold (High vs Nuanced)')}
                    </Label>
                  </div>
                  <Badge variant="outline" className="text-[11px] font-black text-emerald-700 border-emerald-200 bg-emerald-50">
                    {config.autoDispatchThreshold}%
                  </Badge>
                </div>
                <input
                  type="range"
                  min={70}
                  max={99}
                  step={1}
                  value={config.autoDispatchThreshold}
                  disabled={readOnly || !config.enableSelfCritiqueLoop}
                  onChange={(e) => void persistPatch({ autoDispatchThreshold: Number(e.target.value) })}
                  className="w-full accent-emerald-600 disabled:opacity-40"
                  aria-label={t('admin.hubAi.confidenceThreshold', 'Confidence Threshold (High vs Nuanced)')}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                  <span>70% · lenient</span>
                  <span>85% · balanced</span>
                  <span>99% · strict</span>
                </div>
              </div>

              {/* Critic Model Dropdown */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-slate-400" />
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {t('admin.hubAi.criticModel', 'Critic Model')}
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                      {t('admin.hubAi.criticModelDesc', 'Evaluates drafts for factual accuracy, policy adherence and confidence.')}
                    </p>
                  </div>
                </div>
                <Select
                  value={config.criticModel}
                  disabled={readOnly || !config.enableSelfCritiqueLoop}
                  onValueChange={(value) => void persistPatch({ criticModel: String(value) })}
                >
                  <SelectTrigger className="sm:w-[240px] bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRITIC_MODEL_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Swarm Detector Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <div>
                    <p className="text-sm font-bold">
                      {t('admin.hubAi.swarmDetector', 'Swarm Detector')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('admin.hubAi.swarmDetectorDesc', 'Watch for 5+ similar unassigned tickets in 15 minutes and alert on potential outages.')}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={config.enableSwarmDetection}
                  disabled={readOnly}
                  onCheckedChange={(checked) => void persistPatch({ enableSwarmDetection: checked })}
                />
              </div>

              {/* Human Diff Learning Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-500" />
                  <div>
                    <p className="text-sm font-bold">
                      {t('admin.hubAi.humanDiffLearning', 'Human-Diff Feedback Learning')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('admin.hubAi.humanDiffLearningDesc', 'Log human edits to AI drafts (>10% change) for continuous prompt refinement.')}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={config.enableHumanDiffLearning}
                  disabled={readOnly}
                  onCheckedChange={(checked) => void persistPatch({ enableHumanDiffLearning: checked })}
                />
              </div>
            </div>
          </div>

          {/* ============ CARD D: Task Routing Matrix (Advanced only) ============ */}
          {!isSimple && (
            <div className="bg-white border border-purple-200/60 rounded-[2rem] p-6 xl:p-8 shadow-sm">
              <div className="flex items-start gap-3 mb-5">
                <div className="p-2 rounded-xl bg-violet-50 text-violet-600">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
                    {t('admin.hubAi.routingMatrixTitle', 'Task Routing Matrix')}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('admin.hubAi.routingMatrixDesc', 'Route each AI task to its own tuned model with explanatory tooltips and test prompts.')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-xl border border-slate-100 bg-slate-50/80 mb-4">
                <span className="text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0">
                  {t('aiOrchestrator.featureRouting.bulkRouter', 'Bulk Model Router')}
                </span>
                <Select value={bulkRoutingModel} disabled={readOnly} onValueChange={(v) => setBulkRoutingModel(String(v))}>
                  <SelectTrigger className="h-8 w-[min(100%,200px)] bg-white">
                    <SelectValue placeholder={t('aiOrchestrator.featureRouting.selectModel', 'Select model…')} />
                  </SelectTrigger>
                  <SelectContent>
                    {ORCHESTRATOR_MODEL_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
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

              <div className="space-y-3">
                {TASK_ROWS.map((task) => {
                  const output = testOutputs[task.id];
                  const testing = testingTask === task.id;
                  return (
                    <div key={task.id} className="p-4 rounded-xl border border-slate-100 bg-white">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-2 min-w-0 sm:w-56 shrink-0">
                          <span className="text-lg leading-none" aria-hidden>
                            {task.emoji}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{task.title}</p>
                            <p className="text-[10px] text-muted-foreground">{task.description}</p>
                          </div>
                          <FeatureInfoTooltip text={task.tooltip} />
                        </div>
                        <Select
                          value={config.featureRouting[task.id]}
                          disabled={readOnly}
                          onValueChange={(value) => persistRouting({ ...config.featureRouting, [task.id]: String(value) })}
                        >
                          <SelectTrigger className="h-8 sm:w-[200px] bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ORCHESTRATOR_MODEL_OPTIONS.map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="sm:ml-auto w-fit"
                          disabled={testing || readOnly}
                          onClick={() => handleTestPrompt(task.id)}
                        >
                          {testing ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-2" />
                              {t('admin.hubAi.testPrompt', 'Test Prompt')}
                            </>
                          )}
                        </Button>
                      </div>
                      {output && (
                        <div
                          className={cn(
                            'mt-3 rounded-lg border p-3 text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto',
                            output.success
                              ? 'border-emerald-200 bg-emerald-50/40'
                              : 'border-red-200 bg-red-50/40',
                          )}
                        >
                          <span className="inline-flex items-center gap-1 font-sans font-bold mb-1">
                            <Timer className="w-3 h-3" /> {output.latencyMs}ms
                          </span>
                          <br />
                          {output.success ? output.output : output.error || 'Test failed.'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <AdminHubSectionGrid categories={categoriesForTab('ai-engine')} />
    </div>
  );
}
