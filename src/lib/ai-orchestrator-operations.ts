import {
  LOCAL_PROVIDER_IDS,
  MODULE_FOR_FEATURE,
  type AiGovernanceGraphData,
  type AiGovernanceNode,
  type AiOperationsDashboard,
  type AiOrchestratorConfig,
  type AiQualityMetrics,
  type AiWorkflowStep,
} from '../types/ai-orchestrator';
import { compileOrchestratorPolicy } from './ai-orchestrator-policies.js';
import { getOrchestratorConfig, getUsageCostTotals } from './ai-orchestrator-store.js';
import { queryDb } from './postgres-backend.js';

const USD_TO_EUR = 0.93;

function isLocalModel(modelId: string): boolean {
  return LOCAL_PROVIDER_IDS.has(modelId) || modelId.includes('local');
}

function moduleRestriction(config: AiOrchestratorConfig, module: 'tickets' | 'vault' | 'exchange'): string {
  const features = Object.entries(MODULE_FOR_FEATURE)
    .filter(([, mod]) => mod === module || (module === 'tickets' && mod === 'kb'))
    .map(([f]) => f as keyof typeof config.featureRouting);

  const models = features.map((f) => config.featureRouting[f]);
  const allLocal = models.every((m) => isLocalModel(m));
  if (module === 'vault' && config.corporatePolicies.vaultAnalysisMustStayLocal) return 'local_only';
  if (allLocal) return 'local_only';
  if (config.trustLevel >= 4) return 'cloud_allowed';
  return 'balanced';
}

function restrictionLabel(restriction: string): string {
  if (restriction === 'local_only') return 'Local Only';
  if (restriction === 'cloud_allowed') return 'Cloud Allowed';
  return 'Balanced Routing';
}

function buildGovernanceGraph(config: AiOrchestratorConfig): AiGovernanceGraphData {
  const compilation = compileOrchestratorPolicy(config);
  const safetyLayers: string[] = [];
  if (config.piiEnabled) safetyLayers.push('PII Shield');
  if (config.auditEnabled) safetyLayers.push('Audit Logs');
  if (config.contentFilteringEnabled) safetyLayers.push('Content Filter');

  const ticketsRestriction = moduleRestriction(config, 'tickets');
  const vaultRestriction = moduleRestriction(config, 'vault');
  const exchangeRestriction = moduleRestriction(config, 'exchange');

  const ticketsApprovals = ['smart_reply:automatic', 'root_cause:engineer'];
  const vaultApprovals = ['vault_insights:automatic'];
  const exchangeApprovals = ['translation:automatic'];

  const nodes: AiGovernanceNode[] = [
    {
      id: 'governance_root',
      labelKey: 'aiOrchestrator.commandCenter.governance.nodes.root',
      type: 'root',
      restrictions: [`Trust Level ${config.trustLevel}★`],
      safetyLayers: safetyLayers.slice(0, 2),
      approvalGates: [],
      detail: {
        routingRules: compilation.providerPriority.map((p) => `Failover chain: ${p}`),
        promptSummaries: ['Workspace-wide governance policy root'],
        costProfile: `Daily ceiling €${config.dailyBudgetEur}`,
        models: compilation.providerPriority,
      },
    },
    {
      id: 'workspace_policy',
      labelKey: 'aiOrchestrator.commandCenter.governance.nodes.policy',
      type: 'policy',
      parentId: 'governance_root',
      restrictions: config.dataResidencyPolicy.customerDataNeverLeavesEU ? ['EU Data Lock'] : ['Global Routing'],
      safetyLayers,
      approvalGates: [],
      detail: {
        routingRules: [
          `Residency: ${config.dataResidencyPolicy.allowedRegions.join(', ')}`,
          `Budget action: ${config.budgetExceededAction}`,
        ],
        promptSummaries: ['Corporate policy matrix enforced'],
        costProfile: `$${config.dailyBudgetUsd}/day USD · €${config.dailyBudgetEur}/day EUR`,
        models: compilation.providerPriority,
      },
    },
    {
      id: 'module_tickets',
      labelKey: 'aiOrchestrator.commandCenter.governance.nodes.tickets',
      type: 'module',
      parentId: 'workspace_policy',
      restrictions: [restrictionLabel(ticketsRestriction)],
      safetyLayers: config.piiEnabled ? ['PII Shield'] : [],
      approvalGates: ticketsApprovals,
      detail: {
        routingRules: [
          `Summarization → ${config.featureRouting.ticket_summarization}`,
          `Smart Reply → ${config.featureRouting.smart_reply}`,
          `Sentiment → ${config.featureRouting.sentiment_analysis}`,
        ],
        promptSummaries: ['Ticket Summary', 'Smart Reply', 'Root Cause'],
        costProfile: 'Primary consumption module',
        models: [
          config.featureRouting.ticket_summarization,
          config.featureRouting.smart_reply,
          config.featureRouting.sentiment_analysis,
        ],
      },
    },
    {
      id: 'module_vault',
      labelKey: 'aiOrchestrator.commandCenter.governance.nodes.vault',
      type: 'module',
      parentId: 'workspace_policy',
      restrictions: [restrictionLabel(vaultRestriction)],
      safetyLayers: ['PII Shield', 'Audit Logs'],
      approvalGates: vaultApprovals,
      detail: {
        routingRules: [`Vault Insights → ${config.featureRouting.vault_insights}`],
        promptSummaries: ['Vault security analysis prompt'],
        costProfile: config.corporatePolicies.vaultAnalysisMustStayLocal ? 'Local-only (free)' : 'Cloud-capable',
        models: [config.featureRouting.vault_insights],
      },
    },
    {
      id: 'module_exchange',
      labelKey: 'aiOrchestrator.commandCenter.governance.nodes.exchange',
      type: 'module',
      parentId: 'workspace_policy',
      restrictions: [restrictionLabel(exchangeRestriction)],
      safetyLayers: config.auditEnabled ? ['Audit Logs'] : [],
      approvalGates: exchangeApprovals,
      detail: {
        routingRules: [`Translation → ${config.featureRouting.translation}`],
        promptSummaries: ['Translation prompt template'],
        costProfile: 'Low-volume secure exchange',
        models: [config.featureRouting.translation],
      },
    },
  ];

  return { nodes };
}

function buildWorkflowSteps(config: AiOrchestratorConfig): AiWorkflowStep[] {
  const ks = config.killSwitch;
  const enabled = !ks.master && !ks.summaries;
  return [
    { id: 'ticket_created', labelKey: 'aiOrchestrator.commandCenter.workflow.ticketCreated', icon: 'ticket', active: true },
    { id: 'summarize', labelKey: 'aiOrchestrator.commandCenter.workflow.summarize', feature: 'ticket_summarization', icon: 'summarize', active: enabled },
    { id: 'sentiment', labelKey: 'aiOrchestrator.commandCenter.workflow.sentiment', feature: 'sentiment_analysis', icon: 'sentiment', active: enabled && !ks.sentiment },
    { id: 'find_kb', labelKey: 'aiOrchestrator.commandCenter.workflow.findKb', feature: 'kb_generation', icon: 'kb', active: enabled && !ks.kbGeneration },
    { id: 'suggest_reply', labelKey: 'aiOrchestrator.commandCenter.workflow.suggestReply', feature: 'smart_reply', icon: 'reply', active: enabled && !ks.smartReply },
    { id: 'sla_risk', labelKey: 'aiOrchestrator.commandCenter.workflow.slaRisk', feature: 'escalation_analysis', icon: 'sla', active: config.autoEscalationEnabled },
    { id: 'notify_team', labelKey: 'aiOrchestrator.commandCenter.workflow.notifyTeam', icon: 'notify', active: config.autoEscalationEnabled },
  ];
}

async function fetchQualityMetrics(workspaceId: string, usageSuccessRate: number): Promise<AiQualityMetrics> {
  const reviewRes = await queryDb(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
       COUNT(*) FILTER (WHERE status = 'reviewed')::int AS reviewed,
       COUNT(*) FILTER (WHERE status = 'dismissed')::int AS dismissed
     FROM ai_human_review_pool WHERE workspace_id = $1 AND created_at >= date_trunc('day', NOW())`,
    [workspaceId],
  );

  const approvalRes = await queryDb(
    `SELECT COUNT(*)::int AS rejected
     FROM ai_approval_queue
     WHERE workspace_id = $1 AND status = 'rejected' AND created_at >= date_trunc('day', NOW())`,
    [workspaceId],
  );

  const hallucRes = await queryDb(
    `SELECT COUNT(*)::int AS flags
     FROM ai_human_review_pool
     WHERE workspace_id = $1 AND confidence < threshold AND created_at >= date_trunc('day', NOW())`,
    [workspaceId],
  );

  const usageRes = await queryDb(
    `SELECT COUNT(*)::int AS total FROM ai_usage_log
     WHERE workspace_id = $1 AND created_at >= date_trunc('day', NOW())`,
    [workspaceId],
  );

  const row = reviewRes.rows[0] ?? {};
  const reviewed = Number(row.reviewed ?? 0);
  const dismissed = Number(row.dismissed ?? 0);
  const pending = Number(row.pending ?? 0);
  const totalReview = reviewed + dismissed + pending;
  const rejectedSuggestions = Number(approvalRes.rows[0]?.rejected ?? 0) + dismissed;
  const hallucinationFlags = Number(hallucRes.rows[0]?.flags ?? 0);
  const totalAiOutputs = Number(usageRes.rows[0]?.total ?? 0);

  const acceptanceFromReviews = totalReview > 0 ? (reviewed / totalReview) * 100 : usageSuccessRate;

  return {
    customerAcceptanceRate: Math.round(acceptanceFromReviews * 10) / 10,
    rejectedSuggestions,
    hallucinationFlags,
    pendingReview: pending,
    totalAiOutputs,
    lastUpdated: new Date().toISOString(),
  };
}

export function evaluateBudgetCompliance(
  config: AiOrchestratorConfig,
  costs: { today: number; month: number },
): AiOperationsDashboard['budget'] {
  const spentTodayUsd = costs.today;
  const spentTodayEur = Math.round(spentTodayUsd * USD_TO_EUR * 100) / 100;
  const ceiling = config.dailyBudgetEur ?? 50;
  const percentUsed = ceiling > 0 ? Math.min(100, (spentTodayEur / ceiling) * 100) : 0;
  const exceededUsd = spentTodayUsd >= config.dailyBudgetUsd || costs.month >= config.monthlyBudgetUsd;
  const exceededEur = spentTodayEur >= ceiling;
  const exceeded = exceededUsd || exceededEur;
  const localFallbackActive = exceeded && config.budgetExceededAction === 'local_fallback';

  let alertLevel: AiOperationsDashboard['budget']['alertLevel'] = 'ok';
  let alertMessageKey = 'aiOrchestrator.commandCenter.budget.alertOk';

  if (exceeded) {
    alertLevel = 'critical';
    alertMessageKey = 'aiOrchestrator.commandCenter.budget.alertCritical';
  } else if (percentUsed >= 80) {
    alertLevel = 'warning';
    alertMessageKey = 'aiOrchestrator.commandCenter.budget.alertWarning';
  }

  return {
    dailyCeilingEur: ceiling,
    spentTodayEur,
    spentTodayUsd,
    percentUsed: Math.round(percentUsed * 10) / 10,
    exceeded,
    localFallbackActive,
    alertLevel,
    alertMessageKey,
  };
}

export async function getOperationsDashboard(workspaceId = 'default'): Promise<AiOperationsDashboard> {
  const config = await getOrchestratorConfig(workspaceId);
  const costs = await getUsageCostTotals(workspaceId);

  const usageRes = await queryDb(
    `SELECT
       COUNT(*) FILTER (WHERE success = true)::float / NULLIF(COUNT(*), 0) * 100 AS success_rate
     FROM ai_usage_log WHERE workspace_id = $1 AND created_at >= date_trunc('day', NOW())`,
    [workspaceId],
  );
  const successRate = Number(usageRes.rows[0]?.success_rate ?? 95);

  const [quality] = await Promise.all([fetchQualityMetrics(workspaceId, successRate)]);

  return {
    governance: buildGovernanceGraph(config),
    workflow: buildWorkflowSteps(config),
    budget: evaluateBudgetCompliance(config, costs),
    quality,
  };
}

export { USD_TO_EUR };
