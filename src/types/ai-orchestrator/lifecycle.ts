/**
 * AI Orchestrator — execution lifecycle types (context, results, critique
 * loop, learning diffs, swarm clusters, approval/review queues).
 */
import type {
  AiFeatureId,
  AiModuleId,
  AiExecutionStatus,
  AiCustomerScope,
  AiTicketExecutionStatus,
  AiOperatorLanguage,
} from './feature-ids.js';
import type { AiDecisionStepRecord, AiExplainabilityEntry } from './routing.js';

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

/** One iteration of the evaluator-optimizer (self-critique) loop. */
export interface AiCritiqueIteration {
  /** 0-based iteration index; 0 = initial drafter pass. */
  iteration: number;
  /** Drafter output at this iteration (post-revision). */
  draft: string;
  /** Structured critic verdict for this pass. */
  critique: {
    factual_accuracy: number;
    policy_adherence: number;
    confidence_score: number;
    actionable_critique: string;
  };
  /** True when the critic call timed out / failed and confidence was left null. */
  criticError?: boolean;
  /** Model ids used (drafter / critic). */
  drafterModel?: string;
  criticModel?: string;
  createdAt: string;
}

/** Complete self-critique trace persisted as ai_critique_log on a ticket. */
export interface AiCritiqueLog {
  enabled: boolean;
  iterations: AiCritiqueIteration[];
  /** Final overall confidence (0–100); null when the critic failed/timed out. */
  finalConfidence: number | null;
  /** Final accepted draft after the loop terminated. */
  finalDraft: string;
  /** Why the loop stopped: threshold met, max iterations, or critic failure. */
  exitReason:
    | 'threshold_met'
    | 'max_iterations'
    | 'critic_failed'
    | 'critique_disabled';
  updatedAt: string;
}

/** Human-vs-AI edit diff captured for continuous system-prompt refinement. */
export interface AiDraftLearningDiff {
  id: string;
  ticketId: string;
  agentId: string;
  originalDraft: string;
  finalSentMessage: string;
  diffSummary: string;
  createdAt: string;
}

/** Swarm outage cluster — 5+ similar incoming tickets inside a short window. */
export interface AiIncidentCluster {
  id: string;
  clusterTitle: string;
  ticketCount: number;
  sampleTicketIds: string[];
  status: 'active' | 'resolved';
  createdAt: string;
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
  /** Evaluator-optimizer loop trace for ticket drafts. */
  critiqueLog?: AiCritiqueLog;
  /** Per-ticket dispatch state (auto_dispatched | high_confidence | nuanced | manual). */
  ticketExecutionStatus?: AiTicketExecutionStatus;
  /** Ticket AI state persisted alongside the draft. */
  ticketAiState?: {
    aiConfidenceScore: number | null;
    aiCritiqueLog: AiCritiqueLog;
    aiExecutionStatus: AiTicketExecutionStatus;
    aiDraftRaw: string;
  };
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

/** Governance graph node kinds shown in the operations dashboard. */
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
