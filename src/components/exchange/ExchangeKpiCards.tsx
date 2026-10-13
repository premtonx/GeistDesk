import { type ReactNode } from 'react';
import { Lock, FolderUp, FileDown, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import type { MonthOverMonthTrend } from '../../services/exchangeApi';

interface KpiProps {
  label: string;
  value: string;
  trend: MonthOverMonthTrend;
  icon: ReactNode;
  accent: string;
  iconBg: string;
}

function KpiCard({ label, value, trend, icon, accent, iconBg }: KpiProps) {
  const { t } = useTranslation();
  const trendLabel = `${trend.up ? '+' : '-'}${trend.percent}%`;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-70 pointer-events-none', accent)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight">{value}</p>
          <p className="text-xs font-medium text-slate-500 mt-1">{label}</p>
          <p
            className={cn(
              'inline-flex items-center gap-1 text-[11px] font-semibold mt-2',
              trend.up ? 'text-emerald-600' : 'text-rose-600',
            )}
          >
            {trend.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trendLabel} {t('exchange.kpi.vsLastMonth', 'ggü. Vormonat')}
          </p>
        </div>
        <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm', iconBg)}>
          {icon}
        </div>
      </div>
    </div>
  );
}

interface ExchangeKpiCardsProps {
  activeSecrets: number;
  activeDropzones: number;
  filesReceived: number;
  securityScore: number;
  trends: {
    activeSecrets: MonthOverMonthTrend;
    activeDropzones: MonthOverMonthTrend;
    filesReceived: MonthOverMonthTrend;
    securityScore: MonthOverMonthTrend;
  };
  className?: string;
}

export function ExchangeKpiCards({
  activeSecrets,
  activeDropzones,
  filesReceived,
  securityScore,
  trends,
  className,
}: ExchangeKpiCardsProps) {
  const { t } = useTranslation();

  return (
    <div className={cn('grid grid-cols-2 xl:grid-cols-4 gap-4', className)}>
      <KpiCard
        label={t('exchange.kpi.activeSecrets', 'Aktive Geheimnisse gesamt')}
        value={String(activeSecrets)}
        trend={trends.activeSecrets}
        icon={<Lock className="w-5 h-5 text-blue-600" />}
        accent="from-blue-50/80 to-white"
        iconBg="bg-blue-50 text-blue-600"
      />
      <KpiCard
        label={t('exchange.kpi.activeDropzones', 'Aktive Dropzones')}
        value={String(activeDropzones)}
        trend={trends.activeDropzones}
        icon={<FolderUp className="w-5 h-5 text-violet-600" />}
        accent="from-violet-50/80 to-white"
        iconBg="bg-violet-50 text-violet-600"
      />
      <KpiCard
        label={t('exchange.kpi.filesReceived', 'Empfangene Dateien')}
        value={String(filesReceived)}
        trend={trends.filesReceived}
        icon={<FileDown className="w-5 h-5 text-emerald-600" />}
        accent="from-emerald-50/80 to-white"
        iconBg="bg-emerald-50 text-emerald-600"
      />
      <KpiCard
        label={t('exchange.kpi.securityScore', 'Sicherheitswert')}
        value={`${securityScore}%`}
        trend={trends.securityScore}
        icon={<ShieldCheck className="w-5 h-5 text-amber-600" />}
        accent="from-amber-50/80 to-white"
        iconBg="bg-amber-50 text-amber-600"
      />
    </div>
  );
}
