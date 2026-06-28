export type AiConfigScope = 'workspace' | 'global';

export type AiModuleId = 'tickets' | 'kb' | 'vault' | 'exchange';

export type AiFeatureId =
  | 'ticket_summarization'
  | 'sentiment_analysis'
  | 'smart_reply'
  | 'kb_generation'
  | 'escalation_analysis'
  | 'root_cause_analysis'
  | 'translation'
  | 'vault_insights';

export type AiBudgetExceededAction = 'local_fallback' | 'disable_non_critical';

/** Corporate boolean policy rule keys enforced globally by workspace admins. */
export type AiCorporatePolicyRuleKey =
  | 'customerPiiNeverLeavesWorkspace'
  | 'vaultAnalysisMustStayLocal'
  | 'rootCauseAnalysisRequiresAuditLogging'
  | 'promptLoggingRequiresExplicitConsent'
  | 'cloudFallbackRequiresApproval';

/** Admin-configurable boolean rule matrix (corporate defaults). */
export interface AiCorporatePolicies {
  customerPiiNeverLeavesWorkspace: boolean;
  vaultAnalysisMustStayLocal: boolean;
  rootCauseAnalysisRequiresAuditLogging: boolean;
  promptLoggingRequiresExplicitConsent: boolean;
  cloudFallbackRequiresApproval: boolean;
}

/** Execution trust level (1–5 stars). */
export type AiTrustLevel = 1 | 2 | 3 | 4 | 5;

export interface AiTrustLevelDefinition {
  stars: AiTrustLevel;
  label: string;
  description: string;
  localOnly: boolean;
  requiresHumanApproval: boolean;
  mandatoryAuditLogging: boolean;
  /** Cloud model IDs permitted at this trust tier; empty = local only. */
  allowedCloudProviders: string[];
}

/** Allowed data residency regions for cloud model routing. */
export type AiDataResidencyRegion = 'Germany' | 'EU' | 'USA' | 'Asia';

export interface AiDataResidencyPolicy {
  /** Region vector — only endpoints in these regions may be compiled into runs. */
  allowedRegions: AiDataResidencyRegion[];
  /** When true, non-EU cloud model endpoints are excluded during compilation. */
  customerDataNeverLeavesEU: boolean;
}

export interface AiPolicyValidationResult {
  valid: boolean;
  violations: Array<{ rule: AiCorporatePolicyRuleKey; message: string }>;
}

export interface AiRiskScoreFactor {
  id: string;
  label: string;
  impact: number;
}

export interface AiRiskScoreAssessment {
  score: number;
  level: 'low' | 'moderate' | 'elevated' | 'critical';
  factors: AiRiskScoreFactor[];
  recommendations: string[];
}

export interface AiPolicyCompilationResult {
  providerPriority: string[];
  excludedProviders: string[];
  enforcedAuditLogging: boolean;
  requiresHumanApproval: boolean;
  violations: string[];
}

export interface AiKillSwitch {
  master: boolean;
  smartReply: boolean;
  summaries: boolean;
  kbGeneration: boolean;
  sentiment: boolean;
}

export interface AiFeatureRouting {
  ticket_summarization: string;
  sentiment_analysis: string;
  smart_reply: string;
  kb_generation: string;
  escalation_analysis: string;
  root_cause_analysis: string;
  translation: string;
  vault_insights: string;
}

export interface AiOrchestratorConfig {
  workspaceId: string;
  scope: AiConfigScope;
  primaryModel: string;
  reasoningModel: string;
  triageModel: string;
  /** Ordered failover chain — runtime follows exact order */
  providerPriority: string[];
  fallbackModels: string[];
  featureRouting: AiFeatureRouting;
  endpointUrl: string;
  piiEnabled: boolean;
  autoEscalationEnabled: boolean;
  auditEnabled: boolean;
  configLocked: boolean;
  reasoningLevel: 'fast' | 'balanced' | 'deep';
  contentFilteringEnabled: boolean;
  promptLoggingEnabled: boolean;
  /** Legacy residency hint (kept for backward compatibility). */
  dataResidency: string;
  /** Corporate boolean policy rule matrix. */
  corporatePolicies: AiCorporatePolicies;
  /** Execution trust tier (1–5 stars). */
  trustLevel: AiTrustLevel;
  /** Structured data residency router configuration. */
  dataResidencyPolicy: AiDataResidencyPolicy;
  killSwitch: AiKillSwitch;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  budgetExceededAction: AiBudgetExceededAction;
  configVersion: number;
  updatedBy?: string;
  updatedAt?: string;
}

export interface AiOrchestratorVersion {
  id: string;
  versionNumber: number;
  createdBy?: string;
  createdAt: string;
  config: AiOrchestratorConfig;
}

export interface AiProviderHealth {
  provider: string;
  label: string;
  status: 'online' | 'offline' | 'degraded' | 'missing_key';
  latencyMs?: number;
  lastSuccessAt?: string;
  requestsToday?: number;
  message?: string;
}

export interface AiModuleUsage {
  module: AiModuleId;
  requestsToday: number;
  requestsMonth: number;
  successRate: number;
  failureRate: number;
  averageLatency: number;
  averageCost: number;
}

export interface AiFeatureUsageStat {
  feature: AiFeatureId;
  featureLabel: string;
  model: string;
  requestCount: number;
  lastUsedAt?: string;
}

export interface AiUsageAnalytics {
  requestsToday: number;
  requestsMonth: number;
  successRate: number;
  failureRate: number;
  averageLatency: number;
  averageCost: number;
  byModule: AiModuleUsage[];
  byFeature: AiFeatureUsageStat[];
}

export interface AiOrchestratorHealth {
  status: 'healthy' | 'degraded' | 'offline';
  label: string;
  primaryModel?: string;
  providers: AiProviderHealth[];
  killSwitchActive: boolean;
  budgetExceeded: boolean;
  metrics: {
    totalRequests: number;
    totalRedactions: number;
    averageLatency: number;
    costTodayUsd: number;
    costMonthUsd: number;
    avgCostPerTicketUsd: number;
    topConsumerFeature: string;
  };
  usage: AiUsageAnalytics;
}

export interface AiOrchestratorTestResult {
  provider: string;
  label: string;
  success: boolean;
  message: string;
  latencyMs?: number;
}

export interface AiOrchestratorAuditEntry {
  id: string;
  userEmail?: string;
  action: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
}

export interface DetectedLocalModel {
  id: string;
  name: string;
  provider: 'ollama' | 'openai_compat' | 'lmstudio' | 'vllm';
  size?: string;
}

export const AI_CORPORATE_POLICY_RULES: Record<
  AiCorporatePolicyRuleKey,
  { label: string; description: string }
> = {
  customerPiiNeverLeavesWorkspace: {
    label: 'Customer PII never leaves Workspace',
    description: 'Blocks cloud routing when PII redaction is disabled or data may egress.',
  },
  vaultAnalysisMustStayLocal: {
    label: 'Vault Analysis must stay 100% Local',
    description: 'Forces vault_insights routing to local LLM endpoints only.',
  },
  rootCauseAnalysisRequiresAuditLogging: {
    label: 'Root Cause Analysis requires Audit Logging',
    description: 'Requires audit trail before root_cause_analysis may execute.',
  },
  promptLoggingRequiresExplicitConsent: {
    label: 'Prompt logging requires explicit consent',
    description: 'Prompt logging may only be enabled with corporate consent flag.',
  },
  cloudFallbackRequiresApproval: {
    label: 'Cloud fallback requires approval',
    description: 'Failover to cloud providers requires human approval at elevated trust tiers.',
  },
};

export const DEFAULT_CORPORATE_POLICIES: AiCorporatePolicies = {
  customerPiiNeverLeavesWorkspace: true,
  vaultAnalysisMustStayLocal: false,
  rootCauseAnalysisRequiresAuditLogging: true,
  promptLoggingRequiresExplicitConsent: true,
  cloudFallbackRequiresApproval: false,
};

export const AI_TRUST_LEVEL_DEFINITIONS: Record<AiTrustLevel, AiTrustLevelDefinition> = {
  5: {
    stars: 5,
    label: 'Critical Infrastructure',
    description: 'Local LLMs only, mandatory human approval, explicit audit logging.',
    localOnly: true,
    requiresHumanApproval: true,
    mandatoryAuditLogging: true,
    allowedCloudProviders: [],
  },
  4: {
    stars: 4,
    label: 'Business Operations',
    description: 'Balanced cloud architectures (GPT-5, Claude, Gemini) with audit logging.',
    localOnly: false,
    requiresHumanApproval: false,
    mandatoryAuditLogging: true,
    allowedCloudProviders: ['gpt-5', 'claude', 'gemini-flash', 'gemini-pro'],
  },
  3: {
    stars: 3,
    label: 'Standard Operations',
    description: 'Default enterprise parameters with standard cloud failover.',
    localOnly: false,
    requiresHumanApproval: false,
    mandatoryAuditLogging: false,
    allowedCloudProviders: ['gpt-5', 'claude', 'gemini-flash', 'gemini-pro', 'local-llama'],
  },
  2: {
    stars: 2,
    label: 'Documentation / Experimental',
    description: 'Relaxed routing for non-production documentation and experiments.',
    localOnly: false,
    requiresHumanApproval: false,
    mandatoryAuditLogging: false,
    allowedCloudProviders: ['gpt-5', 'claude', 'gemini-flash', 'gemini-pro', 'local-llama'],
  },
  1: {
    stars: 1,
    label: 'Sandbox',
    description: 'Unrestricted sandbox tier for internal testing only.',
    localOnly: false,
    requiresHumanApproval: false,
    mandatoryAuditLogging: false,
    allowedCloudProviders: ['gpt-5', 'claude', 'gemini-flash', 'gemini-pro', 'local-llama'],
  },
};

export const AI_DATA_RESIDENCY_REGIONS: AiDataResidencyRegion[] = ['Germany', 'EU', 'USA', 'Asia'];

export const DEFAULT_DATA_RESIDENCY_POLICY: AiDataResidencyPolicy = {
  allowedRegions: ['Germany', 'EU'],
  customerDataNeverLeavesEU: true,
};

/** Maps orchestrator model IDs to residency regions for compilation filtering. */
export const PROVIDER_RESIDENCY_MAP: Record<string, AiDataResidencyRegion[]> = {
  'gpt-5': ['USA'],
  claude: ['USA'],
  'gemini-flash': ['USA', 'EU', 'Asia'],
  'gemini-pro': ['USA', 'EU', 'Asia'],
  'local-llama': ['Germany', 'EU'],
  local: ['Germany', 'EU'],
};

export const LOCAL_PROVIDER_IDS = new Set(['local-llama', 'local']);

export const DEFAULT_KILL_SWITCH: AiKillSwitch = {
  master: false,
  smartReply: false,
  summaries: false,
  kbGeneration: false,
  sentiment: false,
};

export const DEFAULT_PROVIDER_PRIORITY = ['gpt-5', 'claude', 'gemini-flash', 'local-llama'];

export const DEFAULT_FEATURE_ROUTING: AiFeatureRouting = {
  ticket_summarization: 'gemini-flash',
  sentiment_analysis: 'gemini-flash',
  smart_reply: 'gpt-5',
  kb_generation: 'gpt-5',
  escalation_analysis: 'claude',
  root_cause_analysis: 'gpt-5',
  translation: 'gpt-5',
  vault_insights: 'gpt-5',
};

export const FEATURE_LABELS: Record<AiFeatureId, string> = {
  ticket_summarization: 'Ticket Summarization',
  sentiment_analysis: 'Sentiment Analysis',
  smart_reply: 'Smart Reply',
  kb_generation: 'KB Generation',
  escalation_analysis: 'Escalation Analysis',
  root_cause_analysis: 'Root Cause Analysis',
  translation: 'Translation',
  vault_insights: 'Vault Insights',
};

export const MODULE_FOR_FEATURE: Record<AiFeatureId, AiModuleId> = {
  ticket_summarization: 'tickets',
  sentiment_analysis: 'tickets',
  smart_reply: 'tickets',
  kb_generation: 'kb',
  escalation_analysis: 'tickets',
  root_cause_analysis: 'tickets',
  translation: 'tickets',
  vault_insights: 'vault',
};

export const DEFAULT_ORCHESTRATOR_CONFIG: AiOrchestratorConfig = {
  workspaceId: 'default',
  scope: 'workspace',
  primaryModel: 'gemini-flash',
  reasoningModel: 'gemini-pro',
  triageModel: 'gemini-flash',
  providerPriority: DEFAULT_PROVIDER_PRIORITY,
  fallbackModels: ['claude', 'gpt-5', 'local-llama'],
  featureRouting: DEFAULT_FEATURE_ROUTING,
  endpointUrl: 'http://localhost:11434/v1',
  piiEnabled: true,
  autoEscalationEnabled: true,
  auditEnabled: true,
  configLocked: false,
  reasoningLevel: 'balanced',
  contentFilteringEnabled: true,
  promptLoggingEnabled: false,
  dataResidency: 'eu',
  corporatePolicies: DEFAULT_CORPORATE_POLICIES,
  trustLevel: 3,
  dataResidencyPolicy: DEFAULT_DATA_RESIDENCY_POLICY,
  killSwitch: DEFAULT_KILL_SWITCH,
  dailyBudgetUsd: 10,
  monthlyBudgetUsd: 300,
  budgetExceededAction: 'local_fallback',
  configVersion: 1,
};

export function isAiFeatureEnabled(feature: AiFeatureId, config: AiOrchestratorConfig): boolean {
  const ks = config.killSwitch;
  if (ks.master) return false;
  if (feature === 'smart_reply' && ks.smartReply) return false;
  if (feature === 'ticket_summarization' && ks.summaries) return false;
  if (feature === 'kb_generation' && ks.kbGeneration) return false;
  if (feature === 'sentiment_analysis' && ks.sentiment) return false;
  return true;
}

export function resolveFailoverModel(config: AiOrchestratorConfig, index = 0): string {
  const chain = config.providerPriority?.length
    ? config.providerPriority
    : [config.primaryModel, ...config.fallbackModels];
  return chain[index] ?? config.primaryModel;
}

/** Maps orchestrator config to legacy AIAdapter shape (no secrets). */
export function toLegacyAiConfig(config: AiOrchestratorConfig) {
  const primary = resolveFailoverModel(config, 0);
  return {
    sentimentModel: config.triageModel as 'gemini-flash',
    deepThinkingModel: config.reasoningModel as 'gemini-pro',
    summaryModel: 'sentiment' as const,
    localEndpoint: config.endpointUrl,
    apiKey: '',
    customSentimentModelName: config.triageModel,
    customThinkingModelName: config.reasoningModel,
    customApiKey: '',
    featureRouting: config.featureRouting,
    primaryModel: primary,
    providerPriority: config.providerPriority,
    piiEnabled: config.piiEnabled,
    killSwitch: config.killSwitch,
  };
}
