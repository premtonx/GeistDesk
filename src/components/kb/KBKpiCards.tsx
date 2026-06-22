import React from 'react';
import { BookOpen, FilePen, HeartPulse, Eye, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: { value: string; up?: boolean };
  accent?: string;
}

function KpiCard({ icon, label, value, trend, accent = 'from-blue-500/10 to-indigo-500/5' }: KpiCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/60 bg-white/70 backdrop-blur-md p-4 shadow-sm',
        'hover:shadow-md transition-shadow',
      )}
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-80 pointer-events-none', accent)} />
      <div className="relative flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="h-9 w-9 rounded-xl bg-white/80 border border-slate-200/60 flex items-center justify-center text-blue-600 shadow-sm">
            {icon}
          </div>
          {trend ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full',
                trend.up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600',
              )}
            >
              {trend.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trend.value}
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

interface KBKpiCardsProps {
  publishedCount: number;
  draftCount: number;
  healthScore: number;
  monthlyViews: number;
  className?: string;
}

export function KBKpiCards({
  publishedCount,
  draftCount,
  healthScore,
  monthlyViews,
  className,
}: KBKpiCardsProps) {
  const { t } = useTranslation();

  return (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3', className)}>
      <KpiCard
        icon={<BookOpen className="w-4 h-4" />}
        label={t('kb.kpi.publishedArticles', 'Published Articles')}
        value={publishedCount}
        trend={{ value: '+8%', up: true }}
        accent="from-emerald-500/10 to-teal-500/5"
      />
      <KpiCard
        icon={<FilePen className="w-4 h-4" />}
        label={t('kb.kpi.draftArticles', 'Draft Articles')}
        value={draftCount}
        trend={{ value: '+2', up: true }}
        accent="from-orange-500/10 to-amber-500/5"
      />
      <KpiCard
        icon={<HeartPulse className="w-4 h-4" />}
        label={t('kb.kpi.healthScore', 'Knowledge Health Score')}
        value={`${healthScore}/100`}
        trend={{ value: '+4%', up: true }}
        accent="from-violet-500/10 to-purple-500/5"
      />
      <KpiCard
        icon={<Eye className="w-4 h-4" />}
        label={t('kb.kpi.monthlyViews', 'Monthly Views')}
        value={monthlyViews.toLocaleString()}
        trend={{ value: '+18%', up: true }}
        accent="from-blue-500/10 to-sky-500/5"
      />
    </div>
  );
}
