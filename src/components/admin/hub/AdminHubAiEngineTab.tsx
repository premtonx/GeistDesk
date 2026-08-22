import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cloud, Cpu, Radio, Sparkles } from 'lucide-react';
import { Button } from '../../ui/button';
import { useWorkspaceModuleConfig } from '../../../hooks/useWorkspaceModuleConfig';
import { useTranslation } from '../../../lib/context/I18nContext';
import { AdminHubSectionGrid } from './AdminHubSectionGrid';
import { categoriesForTab } from './adminHubConfig';
import type { AdminHubTelemetry } from './adminHubTelemetry';

interface AdminHubAiEngineTabProps {
  telemetry: AdminHubTelemetry;
}

export function AdminHubAiEngineTab({ telemetry }: AdminHubAiEngineTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { config } = useWorkspaceModuleConfig({ admin: true });
  const localEndpoint = config.ai.localEndpoint?.trim() || t('admin.hubAi.endpointUnset', 'Not configured');
  const cloudModel = config.ai.deepThinkingModel || 'gemini-pro';
  const localModel = config.ai.customSentimentModelName || 'gemma';

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
          </div>
          <Button className="rounded-xl font-bold" onClick={() => navigate('/admin/ai')}>
            {t('admin.hubAi.openOrchestrator', 'Open AI Orchestrator')}
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <EngineTile
            icon={<Sparkles className="w-4 h-4 text-indigo-500" />}
            label={t('admin.hubAi.sentiment', 'Sentiment / Flash')}
            value={config.ai.sentimentModel || 'gemini-flash'}
          />
          <EngineTile
            icon={<Cloud className="w-4 h-4 text-blue-500" />}
            label={t('admin.hubAi.cloud', 'Cloud thinking')}
            value={cloudModel}
          />
          <EngineTile
            icon={<Cpu className="w-4 h-4 text-emerald-500" />}
            label={t('admin.hubAi.ollama', 'Ollama / local endpoint')}
            value={`${localModel} · ${localEndpoint}`}
          />
          <EngineTile
            icon={<Radio className="w-4 h-4 text-amber-500" />}
            label={t('admin.hubAi.latency', 'Gateway latency')}
            value={`${telemetry.latencyMs} ms`}
          />
        </div>
      </div>
      <AdminHubSectionGrid categories={categoriesForTab('ai-engine')} />
    </div>
  );
}

function EngineTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex items-center gap-2 text-slate-400 mb-2">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-sm font-bold text-slate-900 break-all">{value}</div>
    </div>
  );
}
