/**
 * AI Orchestrator — provider / trust / residency / policy types and constants.
 */

export type AiCostScale = '$' | '$$' | '$$$' | '$$$$';

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

export interface DetectedLocalModel {
  id: string;
  name: string;
  provider: 'ollama' | 'openai_compat' | 'lmstudio' | 'vllm';
  size?: string;
}

export interface AiProviderBenchmarkRow {
  provider: string;
  label: string;
  latencyMs: number | null;
  costScale: AiCostScale;
  qualityRating: number;
  connectionReliability: number;
  status: import('./health.js').AiProviderHealth['status'];
}

export interface AiPlaygroundRunResult {
  model: string;
  label: string;
  output: string;
  latencyMs: number;
  confidence: number;
  success: boolean;
  error?: string;
}

export const AI_CORPORATE_POLICY_RULES: Record<
  AiCorporatePolicyRuleKey,
  { label: string; description: string }
> = {
  customerPiiNeverLeavesWorkspace: {
    label: 'Customer PII never leaves Workspace',
    description:
      'Blocks cloud routing when PII redaction is disabled. When enabled, public cloud egress uses reversible {{GD_TOKEN_*}} anonymization at lifecycle Step 4.',
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
  'qwen-36b': ['Germany', 'EU'],
};

export const LOCAL_PROVIDER_IDS = new Set(['local-llama', 'local', 'qwen-36b']);

export const PLAYGROUND_MODEL_OPTIONS = [
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'claude', label: 'Claude Sonnet' },
  { value: 'gemini-flash', label: 'Gemini Flash' },
  { value: 'local-llama', label: 'Local Llama' },
] as const;

export const ORCHESTRATOR_MODEL_OPTIONS = [
  { value: 'gemini-flash', label: 'Gemini Flash' },
  { value: 'gemini-pro', label: 'Gemini Pro' },
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'claude', label: 'Claude' },
  { value: 'local-llama', label: 'Local Llama' },
  { value: 'qwen-36b', label: 'Qwen 36B (Local)' },
] as const;

/** Models eligible for the critic/evaluator role in the self-critique loop. */
export const CRITIC_MODEL_OPTIONS = [
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
  { value: 'claude', label: 'Claude Sonnet' },
  { value: 'gemini-pro', label: 'Gemini Pro' },
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'local-llama', label: 'Local Llama' },
] as const;
