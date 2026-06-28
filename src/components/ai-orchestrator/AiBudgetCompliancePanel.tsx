import { AlertTriangle, Cpu, Euro } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useTranslation } from '../../lib/context/I18nContext';
import type { AiBudgetComplianceState } from '../../types/aiOrchestrator';

interface AiBudgetCompliancePanelProps {
  budget: AiBudgetComplianceState;
  readOnly?: boolean;
  dailyBudgetEur: number;
  onDailyBudgetEurChange: (value: number) => void;
}

export function AiBudgetCompliancePanel({
  budget,
  readOnly,
  dailyBudgetEur,
  onDailyBudgetEurChange,
}: AiBudgetCompliancePanelProps) {
  const { t } = useTranslation();

  const barColor =
    budget.alertLevel === 'critical'
      ? 'bg-red-500'
      : budget.alertLevel === 'warning'
        ? 'bg-amber-500'
        : 'bg-emerald-500';

  return (
    <div className="space-y-4">
      {(budget.alertLevel === 'critical' || budget.localFallbackActive) && (
        <div className="flex items-start gap-3 p-4 rounded-xl border-2 border-red-200 bg-red-50 animate-pulse">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-900">
              {t('aiOrchestrator.commandCenter.budget.alertCriticalTitle', 'High-Priority Budget Alert')}
            </p>
            <p className="text-xs text-red-700 mt-1">
              {t(
                'aiOrchestrator.commandCenter.budget.alertCriticalBody',
                'Daily EUR ceiling exceeded — all subsequent AI traffic is routed to local free LLM infrastructure.',
              )}
            </p>
            {budget.localFallbackActive && (
              <Badge className="mt-2 bg-red-600 text-white border-0">
                <Cpu className="w-3 h-3 mr-1" />
                {t('aiOrchestrator.commandCenter.budget.localActive', 'Local Fallback Active')}
              </Badge>
            )}
          </div>
        </div>
      )}

      {budget.alertLevel === 'warning' && !budget.exceeded && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800 font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {t('aiOrchestrator.commandCenter.budget.alertWarningBody', 'Approaching daily EUR ceiling — review usage.')}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Euro className="w-3.5 h-3.5" />
            {t('aiOrchestrator.commandCenter.budget.dailyCeiling', 'Daily EUR Ceiling')}
          </Label>
          <Input
            type="number"
            min={1}
            disabled={readOnly}
            value={dailyBudgetEur}
            onChange={(e) => onDailyBudgetEurChange(Number(e.target.value))}
          />
          <p className="text-[10px] text-muted-foreground">
            {t('aiOrchestrator.commandCenter.budget.fallbackNote', 'Exceeding this triggers automatic local LLM routing.')}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{t('aiOrchestrator.commandCenter.budget.spentToday', 'Spent Today')}</span>
            <span className="font-mono font-bold">€{budget.spentTodayEur.toFixed(2)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${Math.min(100, budget.percentUsed)}%` }}
            />
          </div>
          <p className="text-[10px] text-right text-muted-foreground font-mono">
            {budget.percentUsed.toFixed(1)}% · ${budget.spentTodayUsd.toFixed(2)} USD
          </p>
        </div>
      </div>
    </div>
  );
}
