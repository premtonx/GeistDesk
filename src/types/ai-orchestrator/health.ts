/**
 * AI Orchestrator — health / usage / audit types.
 */
import type { AiFeatureId, AiModuleId } from './feature-ids.js';

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
