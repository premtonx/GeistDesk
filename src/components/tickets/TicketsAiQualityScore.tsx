import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';

interface TicketsAiQualityScoreProps {
  score?: number;
  collapsed?: boolean;
  className?: string;
}

export function TicketsAiQualityScore({ score = 92, collapsed, className }: TicketsAiQualityScoreProps) {
  const { t } = useTranslation();
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
          <span className="text-[9px] font-bold text-emerald-700">{score}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('mx-2 mb-2 p-3 rounded-xl border border-slate-200/80 bg-white shadow-sm', className)}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 truncate">
            {t('tickets.aiQualityScore', 'AI Quality Score')}
          </span>
        </div>
        <span className="text-sm font-bold text-slate-900 tabular-nums shrink-0">{score}/100</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${score}%` }} />
      </div>
      <p className="text-[10px] font-semibold text-emerald-600 mt-1.5">{label}</p>
    </div>
  );
}
