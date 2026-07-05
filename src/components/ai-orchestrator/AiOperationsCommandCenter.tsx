import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { LayoutDashboard, Loader2, Network, Route, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { useTranslation } from '../../lib/context/I18nContext';
import type { AiOperationsDashboard, AiOrchestratorConfig } from '../../types/aiOrchestrator';
import { AiGovernanceGraph } from './AiGovernanceGraph';
import { AiWorkflowRoutingTimeline } from './AiWorkflowRoutingTimeline';
import { AiBudgetCompliancePanel } from './AiBudgetCompliancePanel';
import { AiQualityDashboard } from './AiQualityDashboard';

interface AiOperationsCommandCenterProps {
  config: AiOrchestratorConfig;
  readOnly?: boolean;
  onBudgetEurChange: (eur: number) => void;
}

export function AiOperationsCommandCenter({
  config,
  readOnly,
  onBudgetEurChange,
}: AiOperationsCommandCenterProps) {
  const { t } = useTranslation();
  const [dashboard, setDashboard] = useState<AiOperationsDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await axios.get('/api/admin/orchestrator/operations-dashboard');
      setDashboard(res.data);
    } catch {
      setDashboard(null);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(true), 45_000);
    return () => clearInterval(interval);
  }, [load, config.configVersion, config.dailyBudgetEur]);

  if (isLoading && !dashboard) {
    return (
      <Card className="rounded-2xl border-slate-200">
        <CardContent className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl shadow-sm border-slate-900/10 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <LayoutDashboard className="w-5 h-5 text-indigo-300" />
            {t('aiOrchestrator.commandCenter.title', 'AI Operations Command Center')}
          </CardTitle>
          <CardDescription className="text-slate-300">
            {t(
              'aiOrchestrator.commandCenter.subtitle',
              'Governance visualization, workflow routing, budget compliance, and quality intelligence.',
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <Card className="xl:col-span-8 rounded-2xl shadow-sm border-indigo-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Network className="w-4 h-4 text-indigo-600" />
              {t('aiOrchestrator.commandCenter.governance.title', 'AI Governance Graph')}
            </CardTitle>
            <CardDescription>
              {t('aiOrchestrator.commandCenter.governance.description', 'Interactive workspace policy tree — click any node for details')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AiGovernanceGraph data={dashboard.governance} />
          </CardContent>
        </Card>

        <div className="xl:col-span-4 flex flex-col gap-6 min-w-0">
          <Card className="rounded-2xl shadow-sm flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                {t('aiOrchestrator.commandCenter.quality.title', 'AI Quality Dashboard')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AiQualityDashboard quality={dashboard.quality} />
            </CardContent>
          </Card>
        </div>

        <Card className="xl:col-span-12 rounded-2xl shadow-sm border-violet-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Route className="w-4 h-4 text-violet-600" />
              {t('aiOrchestrator.commandCenter.workflow.title', 'AI Workflow Routing Engine')}
            </CardTitle>
            <CardDescription>
              {t('aiOrchestrator.commandCenter.workflow.description', 'Incident-triggered sequential automation timeline')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AiWorkflowRoutingTimeline steps={dashboard.workflow} />
          </CardContent>
        </Card>

        <Card className="xl:col-span-12 rounded-2xl shadow-sm border-amber-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t('aiOrchestrator.commandCenter.budget.title', 'Budget Compliance & Fallback Policy')}
            </CardTitle>
            <CardDescription>
              {t('aiOrchestrator.commandCenter.budget.description', 'EUR ceiling with automatic local LLM failover')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AiBudgetCompliancePanel
              budget={dashboard.budget}
              readOnly={readOnly}
              dailyBudgetEur={config.dailyBudgetEur}
              onDailyBudgetEurChange={onBudgetEurChange}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
