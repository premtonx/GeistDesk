import { type ReactNode } from 'react';
import { BookOpen, FilePen, HeartPulse, Eye, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import type { KpiTrend } from '../../lib/kb-dashboard-metrics';

interface KpiCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  trend?: KpiTrend | null;
  accent: string;
  iconBg: string;
}

function trendClass(direction: KpiTrend['direction']): string {
  if (direction === 'up') return 'text-emerald-600';
  if (direction === 'down') return 'text-rose-600';
  return 'text-slate-500';
}

function TrendIcon({ direction }: { direction: KpiTrend['direction'] }) {
  if (direction === 'down') return <TrendingDown className="w-3 h-3" />;
  if (direction === 'neutral') return <Minus className="w-3 h-3" />;
  return <TrendingUp className="w-3 h-3" />;
}

function KpiCard({ icon, label, value, trend, accent, iconBg }: KpiCardProps) {
  const { t } = useTranslation();
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none', accent)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight">{value}</p>
          <p className="text-xs font-medium text-slate-500 mt-1">{label}</p>
          {trend ? (
            <p className={cn('inline-flex items-center gap-1 text-[11px] font-semibold mt-2', trendClass(trend.direction))}>
              <TrendIcon direction={trend.direction} />
              {trend.label} {t('kb.kpi.vsLastMonth', 'vs last month')}
            </p>
          ) : null}
        </div>
        <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm', iconBg)}>
          {icon}
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
  trends?: {
    published?: KpiTrend | null;
    drafts?: KpiTrend | null;
    health?: KpiTrend | null;
    views?: KpiTrend | null;
  };
  className?: string;
}

export function KBKpiCards({
  publishedCount,
  draftCount,
  healthScore,
  monthlyViews,
  trends,
  className,
}: KBKpiCardsProps) {
  const { t } = useTranslation();

  return (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      <KpiCard
        icon={<BookOpen className="w-5 h-5 text-blue-600" />}
        label={t('kb.kpi.publishedArticles', 'Published Articles')}
        value={publishedCount}
        trend={trends?.published}
        accent="from-blue-50/80 to-white"
        iconBg="bg-blue-50 text-blue-600"
      />
      <KpiCard
        icon={<FilePen className="w-5 h-5 text-orange-600" />}
        label={t('kb.kpi.draftArticles', 'Draft Articles')}
        value={draftCount}
        trend={trends?.drafts}
        accent="from-orange-50/80 to-white"
        iconBg="bg-orange-50 text-orange-600"
      />
      <KpiCard
        icon={<HeartPulse className="w-5 h-5 text-emerald-600" />}
        label={t('kb.kpi.healthScore', 'Knowledge Health')}
        value={`${healthScore}%`}
        trend={trends?.health}
        accent="from-emerald-50/80 to-white"
        iconBg="bg-emerald-50 text-emerald-600"
      />
      <KpiCard
        icon={<Eye className="w-5 h-5 text-violet-600" />}
        label={t('kb.kpi.monthlyViews', 'Monthly Views')}
        value={monthlyViews.toLocaleString()}
        trend={trends?.views}
        accent="from-violet-50/80 to-white"
        iconBg="bg-violet-50 text-violet-600"
      />
    </div>
  );
}
