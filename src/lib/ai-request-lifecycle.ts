import crypto from 'crypto';
import {
  DEFAULT_APPROVAL_WORKFLOW_GATES,
  DEFAULT_CONFIDENCE_THRESHOLDS,
  DEFAULT_MEMORY_POLICY,
  MODULE_FOR_FEATURE,
  type AiApprovalGateMode,
  type AiCritiqueLog,
  type AiDecisionEngineStep,
  type AiDecisionStepRecord,
  type AiExecutionContext,
  type AiExecutionResult,
  type AiExplainabilityEntry,
  type AiFeatureId,
  type AiOrchestratorConfig,
  type AiTicketExecutionStatus,
  isAiFeatureEnabled,
} from '../types/aiOrchestrator.js';
import { compileOrchestratorPolicy, requiresCloudDataAnonymization, validateCorporatePolicyRules } from './ai-orchestrator-policies.js';
import { isBudgetExceeded, isLocalFallbackForced } from './ai-budget.js';
import { createProductionModelExecutor } from './ai-lifecycle-executor.js';
import { buildLifecycleSystemInstruction, resolvePersonaForFeature } from './ai-system-prompt.js';
import { runSelfCritiqueLoop, type SelfCritiqueLoopResult } from './ai/self-critique-loop.js';
import {
  consumeRequestTokenMap,
  clearRequestTokenMap,
  peekRequestTokenMap,
  rehydrateResponseData,
  scrubSensitiveData,
  storeRequestTokenMap,
} from './ai-data-anonymization.js';
import {
  loadVaultFingerprintsForWorkspace,
  resolveWorkspaceNameForScrubbing,
} from './ai-vault-fingerprints.js';
import {
  enqueueApprovalRequest,
  enqueueHumanReview,
  getOrchestratorConfig,
  getUsageCostTotals,
  logAiUsage,
  saveExplainabilityLog,
} from './ai-orchestrator-store.js';
import {
  fingerprintPrompt,
  lookupAiResponseCache,
  persistAiResponseCache,
  shouldBypassAiCache,
} from './ai-response-cache.js';

export type AiModelExecutor = (input: {
  model: string;
  prompt: string;
  feature: AiFeatureId;
  workspaceId: string;
  systemInstruction?: string;
}) => Promise<{ output: string; confidence: number; costUsd?: number; promptTokens?: number; completionTokens?: number }>;

export interface AiLifecycleOptions {
  config?: AiOrchestratorConfig;
  executor?: AiModelExecutor;
  skipPersistence?: boolean;
  skipApprovalGate?: boolean;
  approvalAlreadyGranted?: boolean;
}

class AiLifecycleError extends Error {
  constructor(
    message: string,
    readonly step: AiDecisionEngineStep,
    readonly status: AiExecutionResult['status'] = 'failed',
  ) {
    super(message);
    this.name = 'AiLifecycleError';
  }
}

function recordStep(
  steps: AiDecisionStepRecord[],
  step: AiDecisionEngineStep,
  status: AiDecisionStepRecord['status'],
  detail?: string,
  startedAt?: number,
): void {
  steps.push({
    step,
    status,
    detail,
    durationMs: startedAt != null ? Date.now() - startedAt : undefined,
  });
}

function resolveApprovalGate(feature: AiFeatureId): AiApprovalGateMode {
  return DEFAULT_APPROVAL_WORKFLOW_GATES[feature] ?? 'automatic';
}

function resolveConfidenceThreshold(config: AiOrchestratorConfig, feature: AiFeatureId): number {
  return config.confidenceThresholds?.[feature] ?? DEFAULT_CONFIDENCE_THRESHOLDS[feature] ?? 0.8;
}

function assignModelForFeature(
  config: AiOrchestratorConfig,
  feature: AiFeatureId,
  compilation: ReturnType<typeof compileOrchestratorPolicy>,
): { model: string; reason: string } {
  const routedModel = config.featureRouting[feature];
  const compliantChain = compilation.providerPriority;

  if (compliantChain.includes(routedModel)) {
    return {
      model: routedModel,
      reason: `Feature routing "${feature}" mapped to "${routedModel}" within compliant provider chain.`,
    };
  }

  const fallback = compliantChain[0] ?? 'local-llama';
  return {
    model: fallback,
    reason: `Routed model "${routedModel}" excluded by residency/trust policy — failover to "${fallback}".`,
  };
}

function buildExplainabilityLog(entry: Omit<AiExplainabilityEntry, 'logLine'>): AiExplainabilityEntry {
  const policies = entry.policiesChecked.join(', ');
  const logLine =
    `[AI Explainability] request=${entry.requestId} feature=${entry.feature} ` +
    `model=${entry.modelChosen} reason="${entry.modelChoiceReason}" ` +
    `policies=[${policies}] cost=$${entry.costUsd.toFixed(4)} latency=${entry.latencyMs}ms`;
  return { ...entry, logLine };
}

function applyMemoryPolicyBindings(
  config: AiOrchestratorConfig,
  ctx: AiExecutionContext,
): { storeContext: boolean; detail: string } {
  const policy = config.memoryPolicy ?? DEFAULT_MEMORY_POLICY;

  if (ctx.ticketClosed && policy.purgeMemoryOnTicketClose) {
    return { storeContext: false, detail: 'Purge Memory Immediately on Ticket Close — context discarded.' };
  }

  if (ctx.customerScope === 'vip' && policy.doNotRememberVipData) {
    return { storeContext: false, detail: 'Do Not Remember VIP Data — session context not persisted.' };
  }

  if (policy.rememberContext30Days) {
    return { storeContext: true, detail: 'Remember Context 30 Days — context bound to 30-day retention window.' };
  }

  return { storeContext: false, detail: 'Memory persistence disabled by policy.' };
}

function rehydrateModelOutput(requestId: string, output: string): { text: string; replacements: number } {
  const tokenMap = peekRequestTokenMap(requestId);
  if (!tokenMap || Object.keys(tokenMap).length === 0) {
    return { text: output, replacements: 0 };
  }
  const { rehydratedText, replacements } = rehydrateResponseData(output, tokenMap);
  return { text: rehydratedText, replacements };
}

function finalizeRequestTokens(requestId: string): void {
  consumeRequestTokenMap(requestId);
  clearRequestTokenMap(requestId);
}

/** Default stub executor for dry-run / test pipelines (no external API calls). */
export const stubAiModelExecutor: AiModelExecutor = async ({ feature, prompt }) => {
  const confidenceByFeature: Partial<Record<AiFeatureId, number>> = {
    smart_reply: 0.92,
    kb_generation: 0.78,
    root_cause_analysis: 0.88,
  };
  return {
    output: `[stub:${feature}] ${prompt.slice(0, 120)}`,
    confidence: confidenceByFeature[feature] ?? 0.9,
    costUsd: 0.001,
    promptTokens: Math.ceil(prompt.length / 4),
    completionTokens: 80,
  };
};

/**
 * Central AI request lifecycle middleware.
 * Connects incoming prompts to Phase 1 security policies through a
 * step-by-step decision engine matrix.
 */
export async function runAiRequestLifecycle(
  ctx: AiExecutionContext,
  options: AiLifecycleOptions = {},
): Promise<AiExecutionResult> {
  const requestId = crypto.randomUUID();
  const workspaceId = ctx.workspaceId ?? 'default';
  const steps: AiDecisionStepRecord[] = [];
  const executionStarted = Date.now();
  let assignedModel = '';
  let modelChoiceReason = '';
  const policiesChecked: string[] = [];
  let redactedPrompt = ctx.prompt;
  let config: AiOrchestratorConfig;
  let policyCompilation: ReturnType<typeof compileOrchestratorPolicy> | undefined;

  try {
    recordStep(steps, 'request_received', 'passed', `requestId=${requestId}`);

    // 1. Detect Feature Context
    let t = Date.now();
    const module = MODULE_FOR_FEATURE[ctx.feature];
    if (!ctx.feature || !module) {
      throw new AiLifecycleError('Unknown AI feature context.', 'detect_feature_context', 'blocked');
    }
    recordStep(steps, 'detect_feature_context', 'passed', `feature=${ctx.feature} module=${module}`, t);

    config = options.config ?? (await getOrchestratorConfig(workspaceId));

    // 2. Audit Department / Customer Scope
    t = Date.now();
    if (!isAiFeatureEnabled(ctx.feature, config)) {
      throw new AiLifecycleError('Feature disabled by kill switch.', 'audit_department_customer_scope', 'blocked');
    }
    const scopeDetail = [
      ctx.departmentId ? `dept=${ctx.departmentId}` : null,
      ctx.customerId ? `customer=${ctx.customerId}` : null,
      ctx.customerScope ? `scope=${ctx.customerScope}` : null,
    ]
      .filter(Boolean)
      .join(' ');
    policiesChecked.push('kill_switch', 'feature_scope');
    recordStep(
      steps,
      'audit_department_customer_scope',
      'passed',
      scopeDetail || 'standard workspace scope',
      t,
    );

    // 3. Check PII Shields + cloud egress anonymization
    t = Date.now();
    policyCompilation = compileOrchestratorPolicy(config);
    const projectedModel = assignModelForFeature(config, ctx.feature, policyCompilation).model;
    const cloudAnonymizationRequired = requiresCloudDataAnonymization(config, projectedModel);

    if (config.piiEnabled) {
      const { PIIShield } = await import('../../pii-shield.js');
      const shield = await PIIShield.redact(ctx.prompt);
      redactedPrompt = shield.cleanText;
      policiesChecked.push('pii_shield');
      if (shield.counts) {
        void import('./sanitization-stats.js')
          .then(({ recordSanitizationCounts }) => recordSanitizationCounts(shield.counts))
          .catch(() => undefined);
      }

      if (cloudAnonymizationRequired) {
        const [vaultFingerprints, workspaceName] = await Promise.all([
          loadVaultFingerprintsForWorkspace(workspaceId, options.skipPersistence),
          resolveWorkspaceNameForScrubbing(workspaceId, ctx.metadata, options.skipPersistence),
        ]);
        const vaultFromMetadata = Array.isArray(ctx.metadata?.vaultFingerprints)
          ? (ctx.metadata?.vaultFingerprints as string[])
          : [];
        const scrub = scrubSensitiveData(redactedPrompt, {
          workspaceName,
          vaultFingerprints: [...vaultFromMetadata, ...vaultFingerprints],
        });
        redactedPrompt = scrub.scrubbedText;
        if (scrub.tokenCount > 0) {
          storeRequestTokenMap(requestId, scrub.tokenMap);
          policiesChecked.push('cloud_data_anonymization');
        }
        recordStep(
          steps,
          'check_pii_shields',
          'passed',
          scrub.wasScrubbed || shield.wasScrubbed
            ? `PII shield + cloud token map (${scrub.tokenCount} reversible placeholders)`
            : 'PII shield active — no sensitive fingerprints detected',
          t,
        );
      } else {
        policiesChecked.push('local_route_no_cloud_scrub');
        recordStep(
          steps,
          'check_pii_shields',
          'passed',
          shield.wasScrubbed
            ? 'PII patterns redacted locally (local/firewalled route — token map skipped)'
            : 'Local route — reversible cloud scrub skipped',
          t,
        );
      }
    } else {
      policiesChecked.push('pii_shield_disabled');
      recordStep(steps, 'check_pii_shields', 'skipped', 'PII shield disabled in config', t);
    }

    // 4. Match Data Residency Region
    t = Date.now();
    const compilation = policyCompilation;
    policiesChecked.push('data_residency', 'trust_level', 'corporate_policies');

    if (compilation.providerPriority.length === 0) {
      recordStep(steps, 'match_data_residency_region', 'blocked', 'No compliant providers after residency compilation', t);
      throw new AiLifecycleError('No compliant model endpoints available for this residency policy.', 'match_data_residency_region', 'blocked');
    }

    const corporateValidation = validateCorporatePolicyRules(config);
    if (!corporateValidation.valid) {
      recordStep(
        steps,
        'match_data_residency_region',
        'blocked',
        corporateValidation.violations.map((v) => v.message).join('; '),
        t,
      );
      throw new AiLifecycleError(corporateValidation.violations[0]?.message ?? 'Corporate policy violation.', 'match_data_residency_region', 'blocked');
    }

    recordStep(
      steps,
      'match_data_residency_region',
      'passed',
      `regions=[${config.dataResidencyPolicy.allowedRegions.join(',')}] euLock=${config.dataResidencyPolicy.customerDataNeverLeavesEU} chain=[${compilation.providerPriority.join(',')}]`,
      t,
    );

    // 5. Evaluate Budget Capacity
    t = Date.now();
    const costs = options.skipPersistence ? { today: 0, month: 0 } : await getUsageCostTotals(workspaceId);
    const budgetExceeded = isBudgetExceeded(config, costs);
    const forceLocalFallback = isLocalFallbackForced(config, costs);
    if (budgetExceeded) {
      policiesChecked.push('budget_exceeded');
      if (config.budgetExceededAction === 'disable_non_critical' && ctx.feature !== 'smart_reply') {
        throw new AiLifecycleError('Daily/monthly AI budget exceeded.', 'evaluate_budget_capacity', 'blocked');
      }
      const budgetDetail = forceLocalFallback
        ? 'Budget exceeded — local fallback enforced'
        : `${config.budgetExceededAction} — proceeding with constraints`;
      recordStep(steps, 'evaluate_budget_capacity', 'passed', budgetDetail, t);
    } else {
      policiesChecked.push('budget_ok');
      recordStep(steps, 'evaluate_budget_capacity', 'passed', `today=$${costs.today.toFixed(2)} month=$${costs.month.toFixed(2)}`, t);
    }

    // 6. Assign Compliant Model
    t = Date.now();
    const modelAssignment = assignModelForFeature(config, ctx.feature, compilation);
    if (forceLocalFallback && budgetExceeded) {
      assignedModel = 'local-llama';
      modelChoiceReason = 'Daily budget exceeded — local fallback model enforced';
    } else {
      assignedModel = modelAssignment.model;
      modelChoiceReason = modelAssignment.reason;
    }
    policiesChecked.push('feature_routing', 'provider_compilation');
    recordStep(steps, 'assign_compliant_model', 'passed', `model=${assignedModel}`, t);

    // 7. Approval Workflow Gates
    t = Date.now();
    const gate = resolveApprovalGate(ctx.feature);
    if (!options.skipApprovalGate && !options.approvalAlreadyGranted && gate !== 'automatic') {
      const approvalRole = gate === 'manager_approval' ? 'manager' : 'engineer';
      let approvalQueueId: string | undefined;

      if (!options.skipPersistence) {
        approvalQueueId = await enqueueApprovalRequest({
          workspaceId,
          requestId,
          feature: ctx.feature,
          approvalRole,
          prompt: redactedPrompt,
          requestedBy: ctx.userEmail ?? ctx.userId,
          metadata: ctx.metadata,
        });
      }

      recordStep(
        steps,
        'approval_gate',
        'pending',
        `${gate} — queued for ${approvalRole} approval`,
        t,
      );

      return {
        requestId,
        status: 'pending_approval',
        feature: ctx.feature,
        module,
        assignedModel,
        approvalQueueId,
        steps,
        redactedPrompt,
      };
    }

    recordStep(steps, 'approval_gate', 'passed', gate === 'automatic' ? 'Automatic — no hold' : 'Pre-approved', t);

    // 8. Entity JSONB cache lookup — before LLM execution
    t = Date.now();
    const promptFingerprint = fingerprintPrompt(redactedPrompt);
    const bypassCache = shouldBypassAiCache(ctx);

    if (!bypassCache) {
      const cached = await lookupAiResponseCache(ctx, promptFingerprint, options.skipPersistence);
      if (cached?.output?.trim()) {
        assignedModel = cached.assignedModel;
        modelChoiceReason = 'CACHE_HIT — entity JSONB payload reused; LLM execution bypassed';
        policiesChecked.push('cache_hit');
        recordStep(steps, 'cache_lookup', 'passed', 'CACHE_HIT — served from entity JSONB cache', t);

        const output = cached.output;
        const confidence = cached.confidence;
        const threshold = resolveConfidenceThreshold(config, ctx.feature);

        if (confidence < threshold) {
          let reviewPoolId: string | undefined;
          if (!options.skipPersistence) {
            reviewPoolId = await enqueueHumanReview({
              workspaceId,
              requestId,
              feature: ctx.feature,
              confidence,
              threshold,
              outputText: output,
            });
          }
          recordStep(
            steps,
            'confidence_threshold_check',
            'pending',
            `Cached confidence ${(confidence * 100).toFixed(1)}% < threshold ${(threshold * 100).toFixed(1)}%`,
            Date.now(),
          );

          const latencyMs = Date.now() - executionStarted;
          const explainability = buildExplainabilityLog({
            requestId,
            feature: ctx.feature,
            modelChosen: assignedModel,
            modelChoiceReason,
            policiesChecked,
            costUsd: 0,
            latencyMs,
          });
          if (!options.skipPersistence) {
            await saveExplainabilityLog({ workspaceId, ...explainability });
          }

          return {
            requestId,
            status: 'pending_review',
            feature: ctx.feature,
            module,
            output,
            confidence,
            assignedModel,
            reviewPoolId,
            steps,
            explainability,
            redactedPrompt,
            fromCache: true,
          };
        }

        recordStep(
          steps,
          'confidence_threshold_check',
          'passed',
          `Cached confidence ${(confidence * 100).toFixed(1)}% >= threshold ${(threshold * 100).toFixed(1)}%`,
          Date.now(),
        );

        const memoryResult = applyMemoryPolicyBindings(config, ctx);
        policiesChecked.push('memory_policy');
        recordStep(
          steps,
          'memory_policy',
          memoryResult.storeContext ? 'passed' : 'skipped',
          memoryResult.detail,
          Date.now(),
        );

        const latencyMs = Date.now() - executionStarted;
        const explainability = buildExplainabilityLog({
          requestId,
          feature: ctx.feature,
          modelChosen: assignedModel,
          modelChoiceReason,
          policiesChecked,
          costUsd: 0,
          latencyMs,
        });

        if (!options.skipPersistence) {
          await saveExplainabilityLog({ workspaceId, ...explainability });
        }

        recordStep(steps, 'file_audit_log', 'passed', `${explainability.logLine} CACHE_HIT`, Date.now());

        return {
          requestId,
          status: 'completed',
          feature: ctx.feature,
          module,
          output,
          confidence,
          assignedModel,
          steps,
          explainability,
          redactedPrompt,
          fromCache: true,
          ticketExecutionStatus: 'high_confidence' as const,
        };
      }

      recordStep(steps, 'cache_lookup', 'skipped', 'No cached payload for entity/feature', t);
    } else {
      recordStep(
        steps,
        'cache_lookup',
        'skipped',
        bypassCache ? 'forceRefresh/skipCache — cache bypassed' : 'cache bypassed',
        t,
      );
    }

    // 9. Execute — merge persona skills + operator locale into systemInstruction
    t = Date.now();
    const personaId = resolvePersonaForFeature(config, ctx.feature);
    const systemInstruction = buildLifecycleSystemInstruction(config, ctx.feature, ctx.operatorLanguage);
    const skillProfile = config.personaSkills?.[personaId];
    policiesChecked.push('persona_system_prompt', 'operator_language');
    if (skillProfile?.skillsContent?.trim()) {
      policiesChecked.push('persona_skill_file');
    }

    const executor = options.executor ?? createProductionModelExecutor(workspaceId);
    let output: string;
    let confidence: number;
    let costUsd = 0;
    let critiqueLog: AiCritiqueLog | undefined;
    let ticketExecutionStatus: AiTicketExecutionStatus | undefined;

    try {
      // 3-Tier Agentic Graph — Tier 1: evaluator-optimizer self-critique loop.
      // Smart replies route through the drafter↔critic loop; all other features
      // keep the one-shot execution path.
      const useCritiqueLoop =
        ctx.feature === 'smart_reply' &&
        (config.enableSelfCritiqueLoop ?? true) &&
        !options.skipPersistence;

      if (useCritiqueLoop) {
        const loopResult: SelfCritiqueLoopResult = await runSelfCritiqueLoop({
          feature: ctx.feature,
          prompt: redactedPrompt,
          workspaceId,
          systemInstruction,
          drafterModel: assignedModel,
          criticModel: config.criticModel ?? 'deepseek-reasoner',
          config,
          executor,
        });

        output = loopResult.output;
        // Strict fallback: critic failure → null confidence, never fabricated.
        confidence = loopResult.confidence ?? 0.1;
        critiqueLog = loopResult.critiqueLog;
        ticketExecutionStatus = loopResult.executionStatus;
        costUsd = 0; // accounted per underlying executor call below
        recordStep(
          steps,
          'execute',
          'passed',
          `critique_loop iterations=${loopResult.critiqueLog.iterations.length} ` +
            `confidence=${loopResult.confidenceScore === null ? 'null (critic failed)' : loopResult.confidenceScore} ` +
            `exit=${loopResult.critiqueLog.exitReason} persona=${personaId}`,
          t,
        );
      } else {
        const execResult = await executor({
          model: assignedModel,
          prompt: redactedPrompt,
          feature: ctx.feature,
          workspaceId,
          systemInstruction,
        });
        output = execResult.output;
        confidence = execResult.confidence;
        costUsd = execResult.costUsd ?? 0;
        ticketExecutionStatus = 'manual';
        recordStep(
          steps,
          'execute',
          'passed',
          `confidence=${confidence.toFixed(3)} persona=${personaId} lang=${ctx.operatorLanguage ?? 'en'}`,
          t,
        );
      }

      const rehydrated = rehydrateModelOutput(requestId, output);
      output = rehydrated.text;
      if (rehydrated.replacements > 0) {
        policiesChecked.push('response_rehydration');
      }

      if (!options.skipPersistence) {
        await logAiUsage({
          workspaceId,
          module,
          feature: ctx.feature,
          model: assignedModel,
          latencyMs: Date.now() - executionStarted,
          promptTokens: Math.ceil(redactedPrompt.length / 4),
          completionTokens: Math.ceil(output.length / 4),
          costUsd,
          success: true,
        });
      }

      const vipNoPersist =
        ctx.customerScope === 'vip' && (config.memoryPolicy?.doNotRememberVipData ?? false);
      await persistAiResponseCache(
        ctx,
        {
          output,
          confidence,
          assignedModel,
          promptFingerprint,
        },
        {
          skipPersistence: options.skipPersistence,
          skipWriteForVip: vipNoPersist,
        },
      );
      recordStep(
        steps,
        'cache_persist',
        vipNoPersist ? 'skipped' : 'passed',
        vipNoPersist
          ? 'VIP memory policy — cache write skipped'
          : 'Entity JSONB aiPayloadCache updated',
        Date.now(),
      );
    } catch (execErr: unknown) {
      const msg = execErr instanceof Error ? execErr.message : String(execErr);
      recordStep(steps, 'execute', 'blocked', msg, t);
      throw new AiLifecycleError(`Model execution failed: ${msg}`, 'execute', 'failed');
    }

    // 9. Confidence Threshold Check
    t = Date.now();
    const threshold = resolveConfidenceThreshold(config, ctx.feature);
    if (confidence < threshold) {
      let reviewPoolId: string | undefined;
      if (!options.skipPersistence) {
        reviewPoolId = await enqueueHumanReview({
          workspaceId,
          requestId,
          feature: ctx.feature,
          confidence,
          threshold,
          outputText: output,
        });
      }
      recordStep(
        steps,
        'confidence_threshold_check',
        'pending',
        `confidence ${(confidence * 100).toFixed(1)}% < threshold ${(threshold * 100).toFixed(1)}% — routed to human review pool`,
        t,
      );

      const latencyMs = Date.now() - executionStarted;
      const explainability = buildExplainabilityLog({
        requestId,
        feature: ctx.feature,
        modelChosen: assignedModel,
        modelChoiceReason,
        policiesChecked,
        costUsd,
        latencyMs,
      });

      if (!options.skipPersistence) {
        await saveExplainabilityLog({ workspaceId, ...explainability });
      }

      return {
        requestId,
        status: 'pending_review',
        feature: ctx.feature,
        module,
        output,
        confidence,
        assignedModel,
        reviewPoolId,
        steps,
        explainability,
        redactedPrompt,
        critiqueLog,
        ticketExecutionStatus,
      };
    }

    recordStep(
      steps,
      'confidence_threshold_check',
      'passed',
      `confidence ${(confidence * 100).toFixed(1)}% >= threshold ${(threshold * 100).toFixed(1)}%`,
      t,
    );

    // 10. Memory Policy Bindings
    t = Date.now();
    const memoryResult = applyMemoryPolicyBindings(config, ctx);
    policiesChecked.push('memory_policy');
    recordStep(steps, 'memory_policy', memoryResult.storeContext ? 'passed' : 'skipped', memoryResult.detail, t);

    // 11. File Audit / Explainability Log
    t = Date.now();
    const latencyMs = Date.now() - executionStarted;
    const explainability = buildExplainabilityLog({
      requestId,
      feature: ctx.feature,
      modelChosen: assignedModel,
      modelChoiceReason,
      policiesChecked,
      costUsd,
      latencyMs,
    });

    if (!options.skipPersistence) {
      await saveExplainabilityLog({ workspaceId, ...explainability });
    }

    recordStep(steps, 'file_audit_log', 'passed', explainability.logLine, t);

    return {
      requestId,
      status: 'completed',
      feature: ctx.feature,
      module,
      output,
      confidence,
      assignedModel,
      steps,
      explainability,
      redactedPrompt,
      critiqueLog,
      ticketExecutionStatus,
    };
  } catch (err: unknown) {
    if (err instanceof AiLifecycleError) {
      return {
        requestId,
        status: err.status,
        feature: ctx.feature,
        module: MODULE_FOR_FEATURE[ctx.feature],
        assignedModel: assignedModel || undefined,
        steps,
        error: err.message,
        redactedPrompt,
      };
    }

    const msg = err instanceof Error ? err.message : String(err);
    recordStep(steps, 'execute', 'blocked', msg);
    return {
      requestId,
      status: 'failed',
      feature: ctx.feature,
      module: MODULE_FOR_FEATURE[ctx.feature],
      steps,
      error: msg,
      redactedPrompt,
    };
  } finally {
    finalizeRequestTokens(requestId);
  }
}

/** Resume an approved request through execution (skips approval gate). */
export async function resumeApprovedAiRequest(
  ctx: AiExecutionContext,
  options: AiLifecycleOptions = {},
): Promise<AiExecutionResult> {
  return runAiRequestLifecycle(ctx, { ...options, approvalAlreadyGranted: true });
}

export { AI_DECISION_ENGINE_FLOW } from '../types/aiOrchestrator.js';
