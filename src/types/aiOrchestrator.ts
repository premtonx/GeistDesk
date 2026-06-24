export type AiConfigScope = 'personal' | 'workspace' | 'global';

export type AiProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'azure_openai'
  | 'local'
  | 'custom_gateway';

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
  dataResidency: string;
  updatedBy?: string;
  updatedAt?: string;
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

export interface AiOrchestratorHealth {
  status: 'online' | 'offline' | 'degraded';
  primaryModel?: string;
  providers: AiProviderHealth[];
  metrics: {
    totalRequests: number;
    totalRedactions: number;
    averageLatency: number;
    costTodayUsd: number;
    costMonthUsd: number;
    avgCostPerTicketUsd: number;
    topConsumerFeature: string;
  };
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

export const DEFAULT_ORCHESTRATOR_CONFIG: AiOrchestratorConfig = {
  workspaceId: 'default',
  scope: 'workspace',
  primaryModel: 'gemini-flash',
  reasoningModel: 'gemini-pro',
  triageModel: 'gemini-flash',
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
};

/** Maps orchestrator config to legacy AIAdapter shape (no secrets). */
export function toLegacyAiConfig(config: AiOrchestratorConfig) {
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
    primaryModel: config.primaryModel,
    piiEnabled: config.piiEnabled,
  };
}
