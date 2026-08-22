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

/** Approval gate modes for AI generation workflow intervention hooks. */
export type AiApprovalGateMode = 'automatic' | 'manager_approval' | 'engineer_approval';

/** Per-feature minimum confidence threshold (0–1 float). */
export type AiConfidenceThresholds = Record<AiFeatureId, number>;

/** Contextual memory lifecycle bindings for AI session data. */
export interface AiMemoryPolicy {
  rememberContext30Days: boolean;
  doNotRememberVipData: boolean;
  purgeMemoryOnTicketClose: boolean;
}

/** Programmatic decision-engine pipeline steps for every AI request. */
export type AiDecisionEngineStep =
  | 'request_received'
  | 'detect_feature_context'
  | 'audit_department_customer_scope'
  | 'check_pii_shields'
  | 'match_data_residency_region'
  | 'evaluate_budget_capacity'
  | 'assign_compliant_model'
  | 'approval_gate'
  | 'cache_lookup'
  | 'execute'
  | 'cache_persist'
  | 'confidence_threshold_check'
  | 'memory_policy'
  | 'file_audit_log';

export type AiExecutionStatus =
  | 'completed'
  | 'pending_approval'
  | 'pending_review'
  | 'blocked'
  | 'failed';

export type AiCustomerScope = 'standard' | 'vip' | 'enterprise';

export type AiOperatorLanguage = 'de' | 'en';

export interface AiExecutionContext {
  workspaceId?: string;
  feature: AiFeatureId;
  prompt: string;
  userId?: string;
  userEmail?: string;
  departmentId?: string;
  customerId?: string;
  customerScope?: AiCustomerScope;
  ticketId?: string;
  ticketClosed?: boolean;
  /** Active UI locale of the operator initiating the request (de/en). */
  operatorLanguage?: AiOperatorLanguage;
  metadata?: Record<string, unknown>;
  /** When true, bypass entity JSONB cache and force a fresh LLM execution. */
  forceRefresh?: boolean;
  /** Alias for forceRefresh — skips cache read before model execution. */
  skipCache?: boolean;
}

export interface AiDecisionStepRecord {
  step: AiDecisionEngineStep;
  status: 'passed' | 'blocked' | 'skipped' | 'pending';
  detail?: string;
  durationMs?: number;
}

export interface AiExplainabilityEntry {
  requestId: string;
  feature: AiFeatureId;
  modelChosen: string;
  modelChoiceReason: string;
  policiesChecked: string[];
  costUsd: number;
  latencyMs: number;
  logLine: string;
}

export interface AiExecutionResult {
  requestId: string;
  status: AiExecutionStatus;
  feature: AiFeatureId;
  module: AiModuleId;
  output?: string;
  confidence?: number;
  assignedModel?: string;
  approvalQueueId?: string;
  reviewPoolId?: string;
  steps: AiDecisionStepRecord[];
  explainability?: AiExplainabilityEntry;
  error?: string;
  redactedPrompt?: string;
  /** True when output was served from entity JSONB cache (no LLM call). */
  fromCache?: boolean;
}

export interface AiApprovalQueueEntry {
  id: string;
  requestId: string;
  workspaceId: string;
  feature: AiFeatureId;
  approvalRole: 'manager' | 'engineer';
  status: 'pending' | 'approved' | 'rejected';
  requestedBy?: string;
  approvedBy?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface AiHumanReviewEntry {
  id: string;
  requestId: string;
  workspaceId: string;
  feature: AiFeatureId;
  confidence: number;
  threshold: number;
  outputText?: string;
  status: 'pending' | 'reviewed' | 'dismissed';
  createdAt: string;
}

/** Core features managed in the version-controlled prompt library. */
export type AiPromptLibraryFeature =
  | 'ticket_summarization'
  | 'kb_generation'
  | 'root_cause_analysis'
  | 'translation';

export interface AiPromptTemplate {
  id: string;
  workspaceId: string;
  feature: AiPromptLibraryFeature;
  name: string;
  currentVersion: number;
  body: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface AiPromptVersion {
  id: string;
  templateId: string;
  feature: AiPromptLibraryFeature;
  versionNumber: number;
  body: string;
  createdBy?: string;
  createdAt: string;
  changeNote?: string;
}

export type AiPersonaId =
  | 'support_agent'
  | 'security_analyst'
  | 'knowledge_writer'
  | 'tier3_technical_escalation'
  | 'friendly_billing_assistant';

export interface AiPersonaDefinition {
  id: AiPersonaId;
  labelKey: string;
  toneKey: string;
  languageKey: string;
  formatKey: string;
  systemPromptSuffix: string;
  /** Optional uploaded Markdown skill instructions (workspace-persisted). */
  skillsContent?: string;
  skillsFileName?: string;
}

/** Workspace-persisted Markdown skill file per persona. */
export interface AiPersonaSkillProfile {
  skillsContent?: string;
  skillsFileName?: string;
}

export type AiPersonaSkillsMap = Partial<Record<AiPersonaId, AiPersonaSkillProfile>>;

export type AiFeaturePersonaMap = Partial<Record<AiFeatureId, AiPersonaId>>;

export type AiCostScale = '$' | '$$' | '$$$' | '$$$$';

export interface AiProviderBenchmarkRow {
  provider: string;
  label: string;
  latencyMs: number | null;
  costScale: AiCostScale;
  qualityRating: number;
  connectionReliability: number;
  status: AiProviderHealth['status'];
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

export type AiGovernanceNodeType = 'root' | 'policy' | 'module' | 'layer';

export interface AiGovernanceNodeDetail {
  routingRules: string[];
  promptSummaries: string[];
  costProfile: string;
  models: string[];
}

export interface AiGovernanceNode {
  id: string;
  labelKey: string;
  type: AiGovernanceNodeType;
  parentId?: string;
  restrictions: string[];
  safetyLayers: string[];
  approvalGates: string[];
  detail: AiGovernanceNodeDetail;
}

export interface AiGovernanceGraphData {
  nodes: AiGovernanceNode[];
}

export interface AiWorkflowStep {
  id: string;
  labelKey: string;
  feature?: AiFeatureId;
  icon: 'ticket' | 'summarize' | 'sentiment' | 'kb' | 'reply' | 'sla' | 'notify';
  active: boolean;
}

export interface AiBudgetComplianceState {
  dailyCeilingEur: number;
  spentTodayEur: number;
  spentTodayUsd: number;
  percentUsed: number;
  exceeded: boolean;
  localFallbackActive: boolean;
  alertLevel: 'ok' | 'warning' | 'critical';
  alertMessageKey: string;
}

export interface AiQualityMetrics {
  customerAcceptanceRate: number;
  rejectedSuggestions: number;
  hallucinationFlags: number;
  pendingReview: number;
  totalAiOutputs: number;
  lastUpdated: string;
}

export interface AiOperationsDashboard {
  governance: AiGovernanceGraphData;
  workflow: AiWorkflowStep[];
  budget: AiBudgetComplianceState;
  quality: AiQualityMetrics;
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
  /** Minimum confidence thresholds per feature (0–1). */
  confidenceThresholds: AiConfidenceThresholds;
  /** Contextual memory lifecycle bindings. */
  memoryPolicy: AiMemoryPolicy;
  /** Persona assignments per AI feature row. */
  featurePersonas: AiFeaturePersonaMap;
  /** Uploaded Markdown skill files keyed by persona id. */
  personaSkills: AiPersonaSkillsMap;
  killSwitch: AiKillSwitch;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  /** Daily spend ceiling in EUR for EU budget compliance fallback. */
  dailyBudgetEur: number;
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
};

export const LOCAL_PROVIDER_IDS = new Set(['local-llama', 'local']);

/** Step-by-step decision engine flow chart for every incoming AI prompt. */
export const AI_DECISION_ENGINE_FLOW: Array<{ step: AiDecisionEngineStep; label: string }> = [
  { step: 'request_received', label: 'Request' },
  { step: 'detect_feature_context', label: 'Detect Feature Context' },
  { step: 'audit_department_customer_scope', label: 'Audit Department/Customer Scope' },
  { step: 'check_pii_shields', label: 'Check PII Shields' },
  { step: 'match_data_residency_region', label: 'Match Data Residency Region' },
  { step: 'evaluate_budget_capacity', label: 'Evaluate Budget Capacity' },
  { step: 'assign_compliant_model', label: 'Assign Compliant Model' },
  { step: 'approval_gate', label: 'Approval Workflow Gate' },
  { step: 'cache_lookup', label: 'Entity JSONB Cache Lookup' },
  { step: 'execute', label: 'Execute' },
  { step: 'cache_persist', label: 'Persist Cache Payload' },
  { step: 'confidence_threshold_check', label: 'Confidence Threshold Check' },
  { step: 'memory_policy', label: 'Memory & Explainability Policies' },
  { step: 'file_audit_log', label: 'File Audit Log' },
];

/** Feature-specific approval workflow gates (intervention hooks). */
export const DEFAULT_APPROVAL_WORKFLOW_GATES: Record<AiFeatureId, AiApprovalGateMode> = {
  ticket_summarization: 'automatic',
  sentiment_analysis: 'automatic',
  smart_reply: 'automatic',
  kb_generation: 'manager_approval',
  escalation_analysis: 'automatic',
  root_cause_analysis: 'engineer_approval',
  translation: 'automatic',
  vault_insights: 'automatic',
};

export const DEFAULT_CONFIDENCE_THRESHOLDS: AiConfidenceThresholds = {
  ticket_summarization: 0.75,
  sentiment_analysis: 0.7,
  smart_reply: 0.85,
  kb_generation: 0.8,
  escalation_analysis: 0.85,
  root_cause_analysis: 0.9,
  translation: 0.8,
  vault_insights: 0.85,
};

export const DEFAULT_MEMORY_POLICY: AiMemoryPolicy = {
  rememberContext30Days: true,
  doNotRememberVipData: true,
  purgeMemoryOnTicketClose: true,
};

export const PROMPT_LIBRARY_FEATURES: AiPromptLibraryFeature[] = [
  'ticket_summarization',
  'kb_generation',
  'root_cause_analysis',
  'translation',
];

export const DEFAULT_PROMPT_BODIES: Record<AiPromptLibraryFeature, string> = {
  ticket_summarization:
    'Du bist ein Assistent für den Supportbetrieb. Fasse den folgenden Ticket-Verlauf wie folgt zusammen:\n- Aktueller Status\n- Hauptanliegen des Kunden\n- Ergriffene Maßnahmen\n- Empfohlener nächster Schritt\n\nHalte die Zusammenfassung unter 150 Wörtern.',
  kb_generation:
    'Du bist ein technischer Redakteur. Wandle die Support-Lösung unten in einen Wissensdatenbank-Artikel um mit:\n- Titel\n- Problembeschreibung\n- Lösungsschritte\n- Präventionstipps\n\nVerwende klares Markdown-Format und formuliere auf Deutsch.',
  root_cause_analysis:
    'Du bist ein Senior-SRE. Führe eine Root-Cause-Analyse der Vorfalldaten durch:\n- Zeitachse der Ereignisse\n- Wahrscheinliche Ursache\n- Mitwirkende Faktoren\n- Empfehlungen zur Behebung\n\nAntworte präzise und strukturiert auf Deutsch.',
  translation:
    'Übersetze den folgenden Support-Inhalt präzise ins Deutsche. Bewahre Fachbegriffe und Tonalität. Gib ausschließlich die Übersetzung aus.',
};

/** Legacy English seed bodies — used to auto-migrate untouched default templates to German. */
export const LEGACY_ENGLISH_PROMPT_BODIES: Record<AiPromptLibraryFeature, string> = {
  ticket_summarization:
    'You are a support operations assistant. Summarize the ticket thread below into:\n- Current status\n- Key customer concern\n- Actions taken\n- Recommended next step\n\nKeep the summary under 150 words.',
  kb_generation:
    'You are a technical writer. Convert the support resolution below into a knowledge base article with:\n- Title\n- Problem description\n- Resolution steps\n- Prevention tips\n\nUse clear Markdown formatting.',
  root_cause_analysis:
    'You are a senior SRE. Perform root cause analysis on the incident data below:\n- Timeline of events\n- Probable root cause\n- Contributing factors\n- Remediation recommendations',
  translation:
    'Translate the following support content accurately. Preserve technical terms and tone. Output only the translation.',
};

export function shouldMigratePromptToGermanBaseline(
  body: string,
  feature: AiPromptLibraryFeature,
): boolean {
  const trimmed = body.trim();
  if (!trimmed) return true;
  if (trimmed === LEGACY_ENGLISH_PROMPT_BODIES[feature].trim()) return true;
  if (trimmed.startsWith('You are a support operations assistant')) return true;
  if (trimmed.startsWith('You are a technical writer. Convert the support resolution')) return true;
  if (trimmed.startsWith('You are a senior SRE')) return true;
  if (trimmed.startsWith('Translate the following support content accurately')) return true;
  return false;
}

export const AI_PERSONA_DEFINITIONS: Record<AiPersonaId, AiPersonaDefinition> = {
  support_agent: {
    id: 'support_agent',
    labelKey: 'aiOrchestrator.personas.supportAgent.label',
    toneKey: 'aiOrchestrator.personas.supportAgent.tone',
    languageKey: 'aiOrchestrator.personas.supportAgent.language',
    formatKey: 'aiOrchestrator.personas.supportAgent.format',
    systemPromptSuffix: 'Antworte warmherzig auf Deutsch als hilfreicher Support-Agent.',
  },
  security_analyst: {
    id: 'security_analyst',
    labelKey: 'aiOrchestrator.personas.securityAnalyst.label',
    toneKey: 'aiOrchestrator.personas.securityAnalyst.tone',
    languageKey: 'aiOrchestrator.personas.securityAnalyst.language',
    formatKey: 'aiOrchestrator.personas.securityAnalyst.format',
    systemPromptSuffix:
      'Du bist ein strikter Sicherheitsanalyst. Analysiere den Text, entferne personenbezogene Daten (PII) nach DSGVO-Richtlinien und antworte kurz und präzise auf Deutsch.',
  },
  knowledge_writer: {
    id: 'knowledge_writer',
    labelKey: 'aiOrchestrator.personas.knowledgeWriter.label',
    toneKey: 'aiOrchestrator.personas.knowledgeWriter.tone',
    languageKey: 'aiOrchestrator.personas.knowledgeWriter.language',
    formatKey: 'aiOrchestrator.personas.knowledgeWriter.format',
    systemPromptSuffix:
      'Du bist ein Wissensautor. Formuliere technische Inhalte in klar strukturiertes, formelles Deutsch im Markdown-Format.',
  },
  tier3_technical_escalation: {
    id: 'tier3_technical_escalation',
    labelKey: 'aiOrchestrator.personas.tier3.label',
    toneKey: 'aiOrchestrator.personas.tier3.tone',
    languageKey: 'aiOrchestrator.personas.tier3.language',
    formatKey: 'aiOrchestrator.personas.tier3.format',
    systemPromptSuffix:
      'Du bist ein knapper Tier-3-Ingenieur. Nenne zuerst die Ursache, dann den Fix, dann das Restrisiko.',
  },
  friendly_billing_assistant: {
    id: 'friendly_billing_assistant',
    labelKey: 'aiOrchestrator.personas.billing.label',
    toneKey: 'aiOrchestrator.personas.billing.tone',
    languageKey: 'aiOrchestrator.personas.billing.language',
    formatKey: 'aiOrchestrator.personas.billing.format',
    systemPromptSuffix:
      'Du bist ein freundlicher Billing-Assistent. Erkläre Rechnungen klar und erfinde niemals Beträge.',
  },
};

export const DEFAULT_FEATURE_PERSONAS: AiFeaturePersonaMap = {
  ticket_summarization: 'support_agent',
  smart_reply: 'support_agent',
  kb_generation: 'knowledge_writer',
  root_cause_analysis: 'security_analyst',
  translation: 'knowledge_writer',
};

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

export const FEATURE_ROUTING_KEYS: Array<keyof AiFeatureRouting> = [
  'ticket_summarization',
  'sentiment_analysis',
  'smart_reply',
  'kb_generation',
  'escalation_analysis',
  'root_cause_analysis',
  'translation',
  'vault_insights',
];

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
  // Filled from OLLAMA_ENDPOINT / VITE_OLLAMA_ENDPOINT or Admin KI settings — never hardcode localhost in pilots.
  endpointUrl: '',
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
  confidenceThresholds: DEFAULT_CONFIDENCE_THRESHOLDS,
  memoryPolicy: DEFAULT_MEMORY_POLICY,
  featurePersonas: DEFAULT_FEATURE_PERSONAS,
  personaSkills: {},
  killSwitch: DEFAULT_KILL_SWITCH,
  dailyBudgetUsd: 10,
  monthlyBudgetUsd: 300,
  dailyBudgetEur: 50,
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

/** Redacted orchestrator view for non-admin authenticated clients. */
export function toPublicOrchestratorConfig(config: AiOrchestratorConfig): Partial<AiOrchestratorConfig> {
  return {
    workspaceId: config.workspaceId,
    scope: config.scope,
    primaryModel: config.primaryModel,
    reasoningModel: config.reasoningModel,
    triageModel: config.triageModel,
    providerPriority: config.providerPriority,
    fallbackModels: config.fallbackModels,
    featureRouting: config.featureRouting,
    endpointUrl: config.endpointUrl,
    piiEnabled: config.piiEnabled,
    autoEscalationEnabled: config.autoEscalationEnabled,
    reasoningLevel: config.reasoningLevel,
    contentFilteringEnabled: config.contentFilteringEnabled,
    featurePersonas: config.featurePersonas,
    killSwitch: config.killSwitch,
    configVersion: config.configVersion,
    updatedAt: config.updatedAt,
  };
}
