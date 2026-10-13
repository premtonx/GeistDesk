import type { AiOrchestratorConfig } from '../types/ai-orchestrator';

const USD_TO_EUR = 0.93;

export function isBudgetExceeded(config: AiOrchestratorConfig, costs: { today: number; month: number }): boolean {
  const eurSpend = costs.today * USD_TO_EUR;
  const eurCeiling = config.dailyBudgetEur ?? 50;
  return (
    costs.today >= config.dailyBudgetUsd ||
    costs.month >= config.monthlyBudgetUsd ||
    eurSpend >= eurCeiling
  );
}

export function isLocalFallbackForced(config: AiOrchestratorConfig, costs: { today: number; month: number }): boolean {
  return isBudgetExceeded(config, costs) && config.budgetExceededAction === 'local_fallback';
}
