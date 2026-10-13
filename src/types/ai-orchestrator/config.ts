/**
 * AI Orchestrator — orchestration configuration types, defaults, and model
 * resolution helpers.
 */
import type { AiFeatureId } from './feature-ids.js';
import type {
  AiConfigScope,
  AiBudgetExceededAction,
} from './feature-ids.js';
import type {
  AiConfidenceThresholds,
  AiMemoryPolicy,
} from './routing.js';
import type {
  AiCorporatePolicies,
  AiDataResidencyPolicy,
  AiTrustLevel,
} from './providers.js';
import type {
  AiPersonaId,
  AiPersonaSkillsMap,
} from './personas.js';
import {
  DEFAULT_CORPORATE_POLICIES,
  DEFAULT_DATA_RESIDENCY_POLICY,
  LOCAL_PROVIDER_IDS,
} from './providers.js';
import {
  DEFAULT_CONFIDENCE_THRESHOLDS,
  DEFAULT_MEMORY_POLICY,
} from './routing.js';
import { DEFAULT_FEATURE_PERSONAS } from './personas.js';

/** A single PII redaction rule pattern applied before LLM egress. */
export interface RedactionRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  pattern?: string;
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
  /** Routing granularity: 'simple' = one global model for all tasks, 'advanced' = per-task routing matrix. */
  modelMode: 'simple' | 'advanced';
  /** Ordered failover chain — runtime follows exact order */
  providerPriority: string[];
  fallbackModels: string[];
  featureRouting: AiFeatureRouting;
  endpointUrl: string;
  piiEnabled: boolean;
  /** PII redaction rule set — toggles are persisted per workspace. */
  redactionRules: RedactionRule[];
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
  featurePersonas: Partial<Record<AiFeatureId, AiPersonaId>>;
  /** Uploaded Markdown skill files keyed by persona id. */
  personaSkills: AiPersonaSkillsMap;
  /** Agentic loop: evaluator-optimizer self-critique engine. */
  enableSelfCritiqueLoop: boolean;
  /** Maximum drafter↔critic iterations (1–3). */
  maxCritiqueIterations: number;
  /** Draft is "high confidence" (auto-dispatchable) at ≥ this score (70–99). */
  autoDispatchThreshold: number;
  /** Model id used for the critic/evaluator role. */
  criticModel: string;
  /** Background swarm/outage cluster detector. */
  enableSwarmDetection: boolean;
  /** Persist human-vs-AI edit diffs for continuous prompt refinement. */
  enableHumanDiffLearning: boolean;
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

export function featureRoutingForModel(model: string): AiFeatureRouting {
  return FEATURE_ROUTING_KEYS.reduce((acc, key) => {
    acc[key] = model;
    return acc;
  }, {} as AiFeatureRouting);
}

/** Default PII redaction rule set shipped with a fresh workspace. */
export const DEFAULT_REDACTION_RULES: RedactionRule[] = [
  {
    id: 'email',
    name: 'Email Addresses',
    description: 'Detects and masks personal and corporate email patterns.',
    enabled: true,
  },
  {
    id: 'phone',
    name: 'Phone Numbers',
    description: 'International and local phone number formats.',
    enabled: true,
  },
  {
    id: 'cc',
    name: 'Credit Card (PCI)',
    description: 'Luhn-validated 13-16 digit card numbers.',
    enabled: true,
  },
  {
    id: 'address',
    name: 'Physical Addresses',
    description: 'Street addresses, zip codes, and city names.',
    enabled: false,
  },
  {
    id: 'ssn',
    name: 'Sensitive IDs (SSN/VAT)',
    description: 'Government-issued identification numbers.',
    enabled: true,
  },
];

export const DEFAULT_ORCHESTRATOR_CONFIG: AiOrchestratorConfig = {
  workspaceId: 'default',
  scope: 'workspace',
  primaryModel: 'gemini-flash',
  reasoningModel: 'gemini-pro',
  triageModel: 'gemini-flash',
  modelMode: 'advanced',
  providerPriority: DEFAULT_PROVIDER_PRIORITY,
  fallbackModels: ['claude', 'gpt-5', 'local-llama'],
  featureRouting: DEFAULT_FEATURE_ROUTING,
  // Filled from OLLAMA_ENDPOINT / VITE_OLLAMA_ENDPOINT or Admin KI settings — never hardcode localhost in pilots.
  endpointUrl: '',
  piiEnabled: true,
  redactionRules: DEFAULT_REDACTION_RULES,
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
  enableSelfCritiqueLoop: true,
  maxCritiqueIterations: 2,
  autoDispatchThreshold: 95,
  criticModel: 'deepseek-reasoner',
  enableSwarmDetection: true,
  enableHumanDiffLearning: true,
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

/** Task → routing key mapping for the unified model getters. */
export const TASK_ROUTING_KEYS = {
  primary: 'smart_reply',
  triage: 'sentiment_analysis',
  sentiment: 'sentiment_analysis',
  deepReasoning: 'root_cause_analysis',
  summarization: 'ticket_summarization',
} as const;

/**
 * Unified model resolution — all backend model getters read from this single
 * configuration schema (AiOrchestratorConfig), never from scattered legacy fields.
 */
export function getModelForTask(config: AiOrchestratorConfig, task: keyof typeof TASK_ROUTING_KEYS): string {
  const key = TASK_ROUTING_KEYS[task];
  const routed = config.featureRouting[key];
  if (routed) return routed;
  if (task === 'triage' || task === 'sentiment') return config.triageModel;
  if (task === 'deepReasoning') return config.reasoningModel;
  if (task === 'summarization') return config.triageModel;
  return config.primaryModel;
}

/** Primary model for chat & ticket drafting (smart_reply routing). */
export function getPrimaryModel(config: AiOrchestratorConfig): string {
  return getModelForTask(config, 'primary');
}

/** Triage & categorization model (sentiment_analysis routing). */
export function getTriageModel(config: AiOrchestratorConfig): string {
  return getModelForTask(config, 'triage');
}

/** Sentiment & escalation analysis model. */
export function getSentimentModel(config: AiOrchestratorConfig): string {
  return getModelForTask(config, 'sentiment');
}

/** Deep reasoning / root-cause analysis model. */
export function getDeepReasoningModel(config: AiOrchestratorConfig): string {
  return getModelForTask(config, 'deepReasoning');
}

/** Thread summarization model. */
export function getSummaryModel(config: AiOrchestratorConfig): string {
  return getModelForTask(config, 'summarization');
}

/** Maps orchestrator config to legacy AIAdapter shape (no secrets). */
export function toLegacyAiConfig(config: AiOrchestratorConfig) {
  const primary = resolveFailoverModel(config, 0);
  const routedSentiment = getSentimentModel(config);
  const routedThinking = getDeepReasoningModel(config);
  return {
    sentimentModel: LOCAL_PROVIDER_IDS.has(routedSentiment) ? 'local-llama' : 'gemini-flash',
    deepThinkingModel: LOCAL_PROVIDER_IDS.has(routedThinking) ? 'qwen-36b' : 'gemini-pro',
    summaryModel: 'sentiment' as const,
    localEndpoint: config.endpointUrl,
    apiKey: '',
    customSentimentModelName: routedSentiment,
    customThinkingModelName: routedThinking,
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
    modelMode: config.modelMode,
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
