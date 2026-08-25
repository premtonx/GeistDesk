/**
 * AI Orchestrator — routing/threshold/memory/prompt-library types.
 */
import type { AiFeatureId, AiPromptLibraryFeature } from './feature-ids.js';
import type {
  AiDecisionEngineStep,
} from './feature-ids.js';

/** Per-feature minimum confidence threshold (0–1 float). */
export type AiConfidenceThresholds = Record<AiFeatureId, number>;

/** Contextual memory lifecycle bindings for AI session data. */
export interface AiMemoryPolicy {
  rememberContext30Days: boolean;
  doNotRememberVipData: boolean;
  purgeMemoryOnTicketClose: boolean;
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
