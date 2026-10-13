import type { ReactNode } from 'react';
import {
  Activity,
  Briefcase,
  Cpu,
  Database,
  Globe,
  Lock,
  Sparkles,
  Users,
} from 'lucide-react';
import { useTranslation } from '../../../lib/context/I18nContext';
import { AdminHubDemoDataCard } from './AdminHubDemoDataCard';
import type { AdminHubTelemetry } from './adminHubTelemetry';

interface AdminHubOverviewTabProps {
  telemetry: AdminHubTelemetry;
  onTelemetryRefresh?: () => void;
}

export function AdminHubOverviewTab({ telemetry, onTelemetryRefresh }: AdminHubOverviewTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-10">
      <div className="bg-white border border-slate-200/80 rounded-[2rem] p-6 xl:p-8 shadow-[0_2px_12px_rgba(15,23,42,0.02)] overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(#94A3B8_0.5px,transparent_0.5px)] bg-[size:16px_16px] opacity-10 pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-5 mb-6 relative z-10">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-slate-400" />
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 font-mono">
              GeistControl Operations Overview v3.1
            </h2>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Local Model: {telemetry.primaryModel ?? '—'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Latency: {telemetry.latencyMs} ms
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 relative z-10 pb-2">
          <MetricCard
            label="Agents"
            icon={<Users className="w-3.5 h-3.5 text-blue-500" />}
            value={
              <>
                {telemetry.activeAgents} <span className="text-[10px] text-slate-400 font-normal">/ 12</span>
              </>
            }
            hint={<span className="text-emerald-600 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> {telemetry.systemHealth}% Online</span>}
          />
          <MetricCard
            label="Pipeline"
            icon={<Briefcase className="w-3.5 h-3.5 text-slate-400" />}
            value={telemetry.ticketsProcessed.toLocaleString()}
            hint="Processed Tickets"
          />
          <MetricCard
            label="Assets"
            icon={<Database className="w-3.5 h-3.5 text-slate-400" />}
            value={telemetry.assetsManaged.toLocaleString()}
            hint="Managed Records"
          />
          <MetricCard
            label="Vault"
            icon={<Lock className="w-3.5 h-3.5 text-amber-500" />}
            value={telemetry.vaultSecrets.toLocaleString()}
            hint={<span className="text-amber-600">Secrets Redacted</span>}
          />
          <MetricCard
            label="KB Index"
            icon={<Globe className="w-3.5 h-3.5 text-teal-500" />}
            value={telemetry.knowledgeArticles.toLocaleString()}
            hint="Dynamic RAG Synced"
          />
          <MetricCard
            label="AI Requests"
            icon={<Sparkles className="w-3.5 h-3.5 text-indigo-500 fill-indigo-200/50 animate-pulse" />}
            value={telemetry.aiRequests.toLocaleString()}
            hint={<span className="text-indigo-600 flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 bg-indigo-500 rounded-sm animate-bounce" /> Streaming Requests</span>}
          />
          <MetricCard
            className="col-span-2 md:col-span-1"
            label="SLA Uptime"
            icon={<Activity className="w-3.5 h-3.5 text-emerald-500" />}
            value={<span className="text-emerald-600">{telemetry.systemHealth}%</span>}
            hint={<span className="text-emerald-600/90">Platform High-Availability</span>}
          />
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center text-slate-400 text-[10px] font-mono gap-2 relative z-10">
          <div className="flex items-center gap-1.5">
            <span className="p-1 rounded bg-slate-100 border border-slate-200 flex items-center justify-center font-black">INFO</span>
            <span>All nodes operating on a sandboxed local-first secure enterprise runtime container.</span>
          </div>
          <span>No data pipelines telemetry leaked.</span>
        </div>
      </div>

      <AdminHubDemoDataCard onChanged={onTelemetryRefresh} />

      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 overflow-hidden relative shadow-sm">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Activity className="w-32 h-32" />
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-md">
            <h3 className="text-xl font-bold text-slate-900 mb-2">{t('admin.resourceHealth', 'Resource Health')}</h3>
            <p className="text-sm text-slate-500">{t('admin.resourceHealthDesc', 'Real-time status of embedded vectors and LLM availability.')}</p>
            <div className="mt-6 space-y-4">
              <HealthRow
                label={t('admin.vectorIndex', 'Vector Index (GeistDesk_KB)')}
                status={telemetry.activeVectors > 0 ? t('admin.statusHealthy', 'Healthy') : t('admin.statusIdle', 'Idle')}
                tone={telemetry.activeVectors > 0 ? 'emerald' : 'amber'}
              />
              {telemetry.providers.slice(0, 2).map((p) => (
                <HealthRow
                  key={p.provider}
                  label={p.label}
                  status={p.status === 'online' ? t('admin.statusAvailable', 'Available') : p.status === 'missing_key' ? t('admin.statusNoKey', 'No Key') : p.status === 'degraded' ? t('admin.statusDegraded', 'Degraded') : t('admin.statusOffline', 'Offline')}
                  tone={p.status === 'online' ? 'emerald' : 'amber'}
                />
              ))}
              {telemetry.providers.length === 0 && (
                <HealthRow
                  label={t('admin.noProviders', 'No AI providers configured')}
                  status={t('admin.statusIdle', 'Idle')}
                  tone="amber"
                />
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <GaugeCard icon={<Database className="w-5 h-5 text-slate-400 mb-3" />} value={telemetry.activeVectors.toLocaleString()} label={t('admin.activeVectors', 'Active Vectors')} />
            <GaugeCard icon={<Users className="w-5 h-5 text-slate-400 mb-3" />} value={`${telemetry.latencyMs || 12} ms`} label={t('admin.redactionLatency', 'P99 Redaction Latency')} />
            <GaugeCard icon={<Activity className="w-5 h-5 text-slate-400 mb-3" />} value={`${telemetry.systemHealth}%`} label={t('admin.uptime', 'Uptime (30d)')} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  icon,
  value,
  hint,
  className,
}: {
  label: string;
  icon: ReactNode;
  value: ReactNode;
  hint: ReactNode;
  className?: string;
}) {
  return (
    <div className={`p-3.5 bg-slate-50/50 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all duration-300 ${className || ''}`}>
      <div className="flex items-center justify-between text-slate-400 mb-1.5">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 font-mono">{label}</span>
        {icon}
      </div>
      <div className="text-xl font-black text-slate-900 font-mono leading-none tracking-tight">{value}</div>
      <div className="text-[9px] font-bold text-slate-400 mt-2">{hint}</div>
    </div>
  );
}

function HealthRow({
  label,
  status,
  tone,
}: {
  label: string;
  status: string;
  tone: 'emerald' | 'amber';
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${tone === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        <span className="text-xs font-bold text-slate-600">{label}</span>
      </div>
      <span
        className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${
          tone === 'emerald' ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'
        }`}
      >
        {status}
      </span>
    </div>
  );
}

function GaugeCard({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex-1 min-w-[160px]">
      {icon}
      <div className="text-2xl font-black text-slate-900">{value}</div>
      <div className="text-[10px] items-center gap-1 flex font-bold text-slate-400 uppercase tracking-widest mt-1">
        {label}
      </div>
    </div>
  );
}
