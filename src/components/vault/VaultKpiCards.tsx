import React from 'react';
import { Key, HeartPulse, Users, Shield, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: string;
  accent: string;
}

function KpiCard({ icon, label, value, trend, accent }: KpiCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/80 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-70 pointer-events-none', accent)} />
      <div className="relative flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="h-9 w-9 rounded-xl bg-white border border-slate-200/60 flex items-center justify-center text-blue-600 shadow-sm">
            {icon}
          </div>
          {trend ? (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              <TrendingUp className="w-3 h-3" />
              {trend}
            </span>
          ) : null}
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
          <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
        </div>
      </div>
    </div>
  );
}

interface VaultKpiCardsProps {
  totalAssets: number;
  healthScore: number;
  sharedSecrets: number;
  securityScore: number;
}

export function VaultKpiCards({ totalAssets, healthScore, sharedSecrets, securityScore }: VaultKpiCardsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        icon={<Key className="w-4 h-4" />}
        label={t('vault.kpi.totalAssets', 'Total Assets')}
        value={totalAssets}
        trend="+5"
        accent="from-blue-500/10 to-sky-500/5"
      />
      <KpiCard
        icon={<HeartPulse className="w-4 h-4" />}
        label={t('vault.kpi.vaultHealth', 'Vault Health')}
        value={`${healthScore}/100`}
        trend="+4%"
        accent="from-emerald-500/10 to-teal-500/5"
      />
      <KpiCard
        icon={<Users className="w-4 h-4" />}
        label={t('vault.kpi.sharedSecrets', 'Shared Secrets')}
        value={sharedSecrets}
        trend="+2"
        accent="from-violet-500/10 to-purple-500/5"
      />
      <KpiCard
        icon={<Shield className="w-4 h-4" />}
        label={t('vault.kpi.securityScore', 'Security Score')}
        value={`${securityScore}%`}
        trend="+12%"
        accent="from-indigo-500/10 to-blue-500/5"
      />
    </div>
  );
}
