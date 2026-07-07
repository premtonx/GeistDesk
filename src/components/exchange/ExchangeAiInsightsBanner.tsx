import { type ReactNode } from 'react';
import { Sparkles, AlertTriangle, Database, Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';
import type { ExchangeAnalyticsCache, ExchangeInsightCard } from '../../services/exchangeApi';

interface InsightCardProps {
  tone: ExchangeInsightCard['tone'];
  title: string;
  description: string;
  count?: number;
  icon: ReactNode;
}

function InsightCard({ tone, title, description, count, icon }: InsightCardProps) {
  const toneClass = {
    critical: 'bg-rose-50 border-rose-100 text-rose-700',
    warning: 'bg-amber-50 border-amber-100 text-amber-700',
    info: 'bg-blue-50 border-blue-100 text-blue-700',
    success: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  }[tone];

  return (
    <div className={cn('rounded-xl border p-3 flex items-start gap-3 min-w-[200px] shrink-0', toneClass)}>
      <div className="h-9 w-9 rounded-lg bg-white/70 flex items-center justify-center shrink-0 shadow-sm">
        {icon}
      </div>
      <div className="min-w-0">
        {count !== undefined ? (
          <p className="text-lg font-bold tabular-nums leading-none">{count}</p>
        ) : null}
        <p className="text-xs font-semibold mt-0.5">{title}</p>
        <p className="text-[10px] opacity-80 mt-0.5 leading-snug">{description}</p>
      </div>
    </div>
  );
}

function insightIcon(tone: ExchangeInsightCard['tone']) {
  switch (tone) {
    case 'critical':
      return <AlertTriangle className="w-4 h-4" />;
    case 'warning':
      return <Database className="w-4 h-4" />;
    case 'info':
      return <Clock className="w-4 h-4" />;
    default:
      return <ShieldCheck className="w-4 h-4" />;
  }
}

interface ExchangeAiInsightsBannerProps {
  analytics: ExchangeAnalyticsCache | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  className?: string;
}

export function ExchangeAiInsightsBanner({
  analytics,
  onRefresh,
  refreshing = false,
  className,
}: ExchangeAiInsightsBannerProps) {
  const { t } = useTranslation();
  const insights = analytics?.insights ?? [];

  return (
    <section
      className={cn(
        'rounded-2xl border border-violet-200/60 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 p-5 text-white shadow-md overflow-hidden relative',
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_55%)] pointer-events-none" />
      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0 backdrop-blur-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-100">
                {t('exchange.aiInsights.badge', 'KI-Sicherheitseinblicke')}
              </p>
              <h2 className="text-sm sm:text-base font-semibold mt-0.5">
                {analytics
                  ? t(analytics.headlineKey, analytics.defaultHeadline)
                  : t('exchange.aiInsights.loading', 'Analysiere gespeicherte Exchange-Daten…')}
              </h2>
              {analytics?.generatedAt ? (
                <p className="text-[10px] text-violet-100/80 mt-1">
                  {t('exchange.aiInsights.cachedAt', 'Cache')}: {new Date(analytics.generatedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          </div>
          {onRefresh ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shrink-0 bg-white/15 text-white border-white/20 hover:bg-white/25"
              disabled={refreshing}
              onClick={onRefresh}
            >
              <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', refreshing && 'animate-spin')} />
              {t('exchange.aiInsights.refresh', 'Aktualisieren')}
            </Button>
          ) : null}
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
          {insights.length > 0 ? (
            insights.map((card) => (
              <InsightCard
                key={card.titleKey}
                tone={card.tone}
                count={card.count}
                title={t(card.titleKey, card.defaultTitle)}
                description={t(card.descriptionKey, card.defaultDescription)}
                icon={insightIcon(card.tone)}
              />
            ))
          ) : (
            <p className="text-xs text-violet-100/90">{t('exchange.aiInsights.empty', 'Noch keine Analysedaten vorhanden.')}</p>
          )}
        </div>
      </div>
    </section>
  );
}
