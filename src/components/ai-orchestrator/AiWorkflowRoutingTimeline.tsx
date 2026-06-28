import {
  Bell,
  BookOpen,
  Clock,
  MessageSquare,
  Sparkles,
  Ticket,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { useTranslation } from '../../lib/context/I18nContext';
import type { AiWorkflowStep } from '../../types/aiOrchestrator';

const STEP_ICONS: Record<AiWorkflowStep['icon'], typeof Ticket> = {
  ticket: Ticket,
  summarize: Sparkles,
  sentiment: TrendingUp,
  kb: BookOpen,
  reply: MessageSquare,
  sla: Clock,
  notify: Bell,
};

interface AiWorkflowRoutingTimelineProps {
  steps: AiWorkflowStep[];
}

export function AiWorkflowRoutingTimeline({ steps }: AiWorkflowRoutingTimelineProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6 overflow-x-auto">
      <div className="flex flex-col md:flex-row md:items-start gap-0 min-w-[640px] md:min-w-0">
        {steps.map((step, index) => {
          const Icon = STEP_ICONS[step.icon];
          const isLast = index === steps.length - 1;
          return (
            <div key={step.id} className="flex md:flex-col items-stretch md:items-center flex-1 min-w-0">
              <div className="flex md:flex-col items-center gap-3 md:gap-2 flex-1 py-3 md:py-0">
                <div
                  className={`relative z-10 flex items-center justify-center w-11 h-11 rounded-2xl border-2 shrink-0 transition-colors ${
                    step.active
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
                      : 'bg-slate-100 border-slate-200 text-slate-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="md:text-center min-w-0 flex-1 md:flex-none md:max-w-[120px]">
                  <p className={`text-xs font-bold leading-tight ${step.active ? 'text-slate-900' : 'text-slate-400'}`}>
                    {t(step.labelKey, step.id.replace(/_/g, ' '))}
                  </p>
                  {step.feature && (
                    <Badge variant="outline" className="mt-1 text-[8px] h-4 hidden md:inline-flex">
                      {step.feature.replace(/_/g, ' ')}
                    </Badge>
                  )}
                </div>
              </div>
              {!isLast && (
                <>
                  <div className="hidden md:block flex-1 h-0.5 bg-gradient-to-r from-indigo-300 to-indigo-100 mt-[22px] mx-1 min-w-[12px]" />
                  <div className="md:hidden w-0.5 h-8 bg-indigo-200 ml-[21px]" />
                </>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground mt-4 text-center md:text-left">
        {t('aiOrchestrator.commandCenter.workflow.caption', 'Sequential automation pipeline triggered on ticket creation')}
      </p>
    </div>
  );
}
