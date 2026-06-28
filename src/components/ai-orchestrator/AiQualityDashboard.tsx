import { AlertOctagon, CheckCircle2, ThumbsDown, TrendingUp } from 'lucide-react';
import { useTranslation } from '../../lib/context/I18nContext';
import type { AiQualityMetrics } from '../../types/aiOrchestrator';

interface AiQualityDashboardProps {
  quality: AiQualityMetrics;
}

export function AiQualityDashboard({ quality }: AiQualityDashboardProps) {
  const { t } = useTranslation();

  const cards = [
    {
      id: 'acceptance',
      icon: CheckCircle2,
      label: t('aiOrchestrator.commandCenter.quality.acceptance', 'Customer Acceptance Rate'),
      value: `${quality.customerAcceptanceRate.toFixed(1)}%`,
      accent: 'text-emerald-600 bg-emerald-50 border-emerald-100',
      iconColor: 'text-emerald-500',
    },
    {
      id: 'rejected',
      icon: ThumbsDown,
      label: t('aiOrchestrator.commandCenter.quality.rejected', 'Rejected Suggestions'),
      value: quality.rejectedSuggestions.toLocaleString(),
      accent: 'text-amber-700 bg-amber-50 border-amber-100',
      iconColor: 'text-amber-500',
    },
    {
      id: 'hallucination',
      icon: AlertOctagon,
      label: t('aiOrchestrator.commandCenter.quality.hallucination', 'Hallucination Flags'),
      value: quality.hallucinationFlags.toLocaleString(),
      accent: 'text-red-700 bg-red-50 border-red-100',
      iconColor: 'text-red-500',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((card) => (
          <div key={card.id} className={`rounded-2xl border p-4 ${card.accent}`}>
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.iconColor}`} />
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{card.label}</p>
            </div>
            <p className="text-2xl font-black font-mono">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-3">
          <TrendingUp className="w-4 h-4 text-indigo-500" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('aiOrchestrator.commandCenter.quality.pendingReview', 'Pending Review')}
            </p>
            <p className="text-lg font-bold font-mono">{quality.pendingReview}</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-slate-500" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('aiOrchestrator.commandCenter.quality.totalOutputs', 'AI Outputs Today')}
            </p>
            <p className="text-lg font-bold font-mono">{quality.totalAiOutputs}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
