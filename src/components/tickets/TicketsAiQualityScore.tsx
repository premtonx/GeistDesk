import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { executiveDashboardApi } from '../../services/executiveDashboardApi';

interface TicketsAiQualityScoreProps {
  score?: number;
  collapsed?: boolean;
  className?: string;
}

export function TicketsAiQualityScore({ score: scoreProp, collapsed, className }: TicketsAiQualityScoreProps) {
  const { t } = useTranslation();
  const [score, setScore] = useState<number>(scoreProp ?? 0);
  const [loading, setLoading] = useState(scoreProp === undefined);

  useEffect(() => {
    if (scoreProp !== undefined) {
      setScore(scoreProp);
      setLoading(false);
      return;
    }

    let active = true;
    executiveDashboardApi
      .getTicketQualityScore()
      .then((payload) => {
        if (!active) return;
        setScore(payload.score);
      })
      .catch(() => {
        if (!active) return;
        setScore(0);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [scoreProp]);

  const label =
    score >= 90
      ? t('tickets.aiQuality.excellent', 'Excellent')
      : score >= 75
        ? t('tickets.aiQuality.good', 'Good')
        : t('tickets.aiQuality.needsWork', 'Needs attention');

  const dotClass = score >= 75 ? 'bg-emerald-500' : 'bg-amber-500';

  if (collapsed) {
    return (
      <div className={cn('flex justify-center py-1', className)} title={`${score}/100 ${label}`}>
        <span className={cn('h-2 w-2 rounded-full', dotClass)} />
      </div>
    );
  }

  return (
    <div
      className={cn('flex items-center gap-2 min-w-0', className)}
      title={`${score}/100 ${label}`}
    >
      <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
      <span className="text-[11px] font-medium text-slate-600 truncate">
        {t('tickets.aiQuality.compactLabel', 'KI-Qualität')}: {loading ? '…' : `${score}/100`} ({label})
      </span>
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotClass)} />
    </div>
  );
}
