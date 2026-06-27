import { type ReactNode } from 'react';
import { Sparkles, AlertTriangle, Database, Clock, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { exchangePanelClass } from './exchange-utils';

interface InsightCardProps {
  tone: 'critical' | 'warning' | 'info' | 'success';
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

export function ExchangeAiInsightsBanner({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <section
      className={cn(
        'rounded-2xl border border-violet-200/60 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 p-5 text-white shadow-md overflow-hidden relative',
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_55%)] pointer-events-none" />
      <div className="relative space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0 backdrop-blur-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-100">
              {t('exchange.aiInsights.badge', 'AI Security Insights')}
            </p>
            <h2 className="text-sm sm:text-base font-semibold mt-0.5">
              {t(
                'exchange.aiInsights.headline',
                'AI detected 2 potential risks and 4 optimization opportunities.',
              )}
            </h2>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
          <InsightCard
            tone="critical"
            count={2}
            title={t('exchange.aiInsights.criticalLogs', 'Critical log errors detected')}
            description={t('exchange.aiInsights.criticalLogsDesc', 'Azure socket pool timeouts in logs.zip')}
            icon={<AlertTriangle className="w-4 h-4" />}
          />
          <InsightCard
            tone="warning"
            count={3}
            title={t('exchange.aiInsights.sqlWarnings', 'SQL dump warnings')}
            description={t('exchange.aiInsights.sqlWarningsDesc', 'Missing index markers in backup.sql')}
            icon={<Database className="w-4 h-4" />}
          />
          <InsightCard
            tone="info"
            count={4}
            title={t('exchange.aiInsights.expiringCreds', 'Expiring credentials')}
            description={t('exchange.aiInsights.expiringCredsDesc', 'Rotate within 48 hours')}
            icon={<Clock className="w-4 h-4" />}
          />
          <InsightCard
            tone="success"
            count={0}
            title={t('exchange.aiInsights.malwareScan', 'Malware scan results')}
            description={t('exchange.aiInsights.malwareScanDesc', 'All uploads passed ICAP scan')}
            icon={<ShieldCheck className="w-4 h-4" />}
          />
        </div>
      </div>
    </section>
  );
}
