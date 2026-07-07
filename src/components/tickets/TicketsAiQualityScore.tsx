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

  if (collapsed) {
    return (
      <div className={cn('flex justify-center py-2', className)} title={`${score}/100`}>
        <div className="h-8 w-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
          <span className="text-[9px] font-bold text-emerald-700">{loading ? '…' : score}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('p-3 rounded-xl border border-slate-200/80 bg-white shadow-sm', className)}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 truncate">
            {t('tickets.aiQualityScore', 'AI Quality Score')}
          </span>
        </div>
        <span className="text-sm font-bold text-slate-900 tabular-nums shrink-0">
          {loading ? '…' : `${score}/100`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all"
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <p className="text-[10px] font-semibold text-emerald-600 mt-1.5">{loading ? '…' : label}</p>
    </div>
  );
}
