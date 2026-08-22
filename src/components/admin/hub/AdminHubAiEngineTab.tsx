import { useCallback, useEffect, useState, type ReactNode } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Cloud, Cpu, Loader2, Radio, Sparkles, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { useTranslation } from '../../../lib/context/I18nContext';
import { persistOrchestratorPatch } from '../../../lib/persistOrchestratorPatch';
import {
  fetchOrchestratorConfig,
  startOrchestratorConfigSync,
  subscribeOrchestratorConfig,
} from '../../../lib/aiOrchestratorClient';
import {
  DEFAULT_ORCHESTRATOR_CONFIG,
  FEATURE_ROUTING_KEYS,
  ORCHESTRATOR_MODEL_OPTIONS,
  type AiFeatureRouting,
  type AiOrchestratorConfig,
} from '../../../types/aiOrchestrator';
import { AdminHubSectionGrid } from './AdminHubSectionGrid';
import { categoriesForTab } from './adminHubConfig';
import { FeatureRoutingMatrix } from '../../ai-orchestrator/FeatureRoutingMatrix';
import type { AdminHubTelemetry } from './adminHubTelemetry';

interface AdminHubAiEngineTabProps {
  telemetry: AdminHubTelemetry;
}

export function AdminHubAiEngineTab({ telemetry }: AdminHubAiEngineTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [config, setConfig] = useState<AiOrchestratorConfig>(DEFAULT_ORCHESTRATOR_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [endpointDraft, setEndpointDraft] = useState('');
  const [bulkRoutingModel, setBulkRoutingModel] = useState<string>(
    ORCHESTRATOR_MODEL_OPTIONS[0]?.value ?? 'gemini-flash',
  );

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
        void fetchOrchestratorConfig(true);
      })
      .catch((err) => {
        console.warn('Orchestrator config unavailable', err);
        toast.error(t('admin.hubAi.loadError', 'Could not load workspace AI routing.'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    const unsubscribe = subscribeOrchestratorConfig((next) => {
      setConfig(next);
      setEndpointDraft(next.endpointUrl || '');
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [t]);

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

  const applyBulkRouting = () => {
    if (!bulkRoutingModel) return;
    const next = FEATURE_ROUTING_KEYS.reduce(
      (acc, key) => ({ ...acc, [key]: bulkRoutingModel }),
      { ...config.featureRouting },
    );
    void persistPatch({ featureRouting: next });
  };

  const readOnly = config.configLocked;

  return (
    <div className="space-y-10">
      <div className="bg-white border border-slate-200/80 rounded-[2rem] p-6 xl:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
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
          <Button className="rounded-xl font-bold" onClick={() => navigate('/admin/ai')}>
            {t('admin.hubAi.openOrchestrator', 'Open AI Orchestrator')}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <EngineSelect
              icon={<Sparkles className="w-4 h-4 text-indigo-500" />}
              label={t('admin.hubAi.sentiment', 'Sentiment / Flash')}
              value={config.triageModel}
              disabled={readOnly}
              onChange={(value) => void persistPatch({ triageModel: value })}
            />
            <EngineSelect
              icon={<Cloud className="w-4 h-4 text-blue-500" />}
              label={t('admin.hubAi.cloud', 'Cloud thinking')}
              value={config.reasoningModel}
              disabled={readOnly}
              onChange={(value) => void persistPatch({ reasoningModel: value })}
            />
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Cpu className="w-4 h-4 text-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {t('admin.hubAi.ollama', 'Ollama / local endpoint')}
                </span>
              </div>
              <Input
                value={endpointDraft}
                disabled={readOnly}
                onChange={(event) => setEndpointDraft(event.target.value)}
                placeholder={t('admin.hubAi.endpointUnset', 'Not configured')}
                className="bg-white h-9 text-sm font-semibold"
              />
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Radio className="w-4 h-4 text-amber-500" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {t('admin.hubAi.latency', 'Gateway latency')}
                </span>
              </div>
              <div className="text-sm font-bold text-slate-900">{telemetry.latencyMs} ms</div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200/80 rounded-[2rem] p-6 xl:p-8 shadow-sm">
        <div className="flex items-start gap-3 mb-5">
          <div className="p-2 rounded-xl bg-violet-50 text-violet-600">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
              {t('aiOrchestrator.featureRouting.title', 'Feature Routing')}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t(
                'aiOrchestrator.featureRouting.description',
                'Visual routing matrix for all GeistDesk AI features',
              )}
            </p>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <FeatureRoutingMatrix
            routing={config.featureRouting}
            disabled={readOnly}
            bulkModel={bulkRoutingModel}
            onBulkModelChange={setBulkRoutingModel}
            onRoutingChange={persistRouting}
            onApplyAll={applyBulkRouting}
          />
        )}
      </div>

      <AdminHubSectionGrid categories={categoriesForTab('ai-engine')} />
    </div>
  );
}

function EngineSelect({
  icon,
  label,
  value,
  disabled,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex items-center gap-2 text-slate-400 mb-2">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <Select value={value} disabled={disabled} onValueChange={(next) => onChange(String(next))}>
        <SelectTrigger className="w-full bg-white h-9 font-semibold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ORCHESTRATOR_MODEL_OPTIONS.map((model) => (
            <SelectItem key={model.value} value={model.value}>
              {model.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
