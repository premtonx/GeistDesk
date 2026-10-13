/**
 * 3-Tier Agentic Graph — Tier 1: Evaluator-Optimizer (Self-Critique) Loop.
 *
 * Replaces one-shot LLM draft generation with a stateful cyclic loop:
 *   Drafter Step  → produces a reply draft
 *   Critic Step   → scores factual_accuracy / policy_adherence / confidence_score
 *                   and returns actionable_critique when below threshold
 *   Loop          → while confidence < auto_dispatch_threshold and
 *                   iterations < max_critique_iterations, feed the critique
 *                   back into the drafter
 *
 * Every pass is recorded into an `AiCritiqueLog`. When the critic times out or
 * fails, the loop degrades gracefully: the latest unverified draft is returned
 * with a `null` confidence score (the UI renders it as "unverified" instead of
 * a fabricated number).
 */

import type { AiModelExecutor } from '../ai-request-lifecycle.js';
import type {
  AiCritiqueIteration,
  AiCritiqueLog,
  AiFeatureId,
  AiOrchestratorConfig,
  AiTicketExecutionStatus,
} from '../../types/ai-orchestrator';

export interface SelfCritiqueLoopInput {
  feature: AiFeatureId;
  prompt: string;
  workspaceId: string;
  systemInstruction?: string;
  /** Primary drafting model id. */
  drafterModel: string;
  /** Critic/evaluator model id (config.criticModel). */
  criticModel: string;
  config: AiOrchestratorConfig;
  executor: AiModelExecutor;
}

export interface SelfCritiqueLoopResult {
  /** Final accepted draft. */
  output: string;
  /** Overall confidence 0–1 (lifecycle scale); null when the critic failed. */
  confidence: number | null;
  /** 0–100 confidence for the ticket badge. */
  confidenceScore: number | null;
  executionStatus: AiTicketExecutionStatus;
  critiqueLog: AiCritiqueLog;
}

export const CRITIC_TIMEOUT_MS = 20_000;

interface CriticVerdict {
  factual_accuracy: number;
  policy_adherence: number;
  confidence_score: number;
  actionable_critique: string;
}

function buildDrafterPrompt(basePrompt: string, critique?: string): string {
  if (!critique) return basePrompt;
  return (
    `${basePrompt}\n\n` +
    `--- SELF-CORRECTION FEEDBACK FROM THE EVALUATOR ---\n` +
    `Your previous draft was reviewed and the critic found the following issues. ` +
    `Revise the draft to address every point while keeping the original customer intent:\n` +
    critique
  );
}

function buildCriticPrompt(draft: string): string {
  return (
    `You are the Evaluator/Critic in an agentic support system. Evaluate the following customer reply draft.\n\n` +
    `DRAFT:\n"""\n${draft}\n"""\n\n` +
    `Respond STRICTLY with a JSON object (no markdown fences, no commentary) with exactly these keys:\n` +
    `- "factual_accuracy": integer 0-100 — is the draft grounded in the provided ticket/KB data, with no hallucinations?\n` +
    `- "policy_adherence": integer 0-100 — does the draft respect privacy, security, and tone guardrails?\n` +
    `- "confidence_score": integer 0-100 — overall confidence that this draft is safe to send to the customer unattended.\n` +
    `- "actionable_critique": string — if confidence_score is below the auto-dispatch threshold, list specific, concrete corrections. ` +
    `If the draft is already excellent, return an empty string.`
  );
}

function parseCriticVerdict(raw: string): CriticVerdict | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '');
  try {
    const parsed = JSON.parse(cleaned) as Partial<CriticVerdict>;
    const clamp = (v: unknown, fallback: number): number => {
      const n = Math.round(Number(v));
      if (!Number.isFinite(n)) return fallback;
      return Math.min(100, Math.max(0, n));
    };
    return {
      factual_accuracy: clamp(parsed.factual_accuracy, 0),
      policy_adherence: clamp(parsed.policy_adherence, 0),
      confidence_score: clamp(parsed.confidence_score, 0),
      actionable_critique:
        typeof parsed.actionable_critique === 'string' ? parsed.actionable_critique.trim() : '',
    };
  } catch {
    return null;
  }
}

function estimateDrafterConfidence(output: string): number {
  if (!output.trim()) return 0;
  // Heuristic baseline only — the critic is authoritative when available.
  const len = output.trim().length;
  if (len > 600) return 86;
  if (len > 120) return 90;
  return 78;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Critic timed out after ${ms}ms`)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Runs the evaluator-optimizer loop for a single smart-reply draft.
 *
 * Strict error contract: any critic failure (timeout, HTTP error, unparseable
 * JSON) returns the latest unverified draft with `confidence: null` and
 * `executionStatus: 'nuanced'` — never a fabricated confidence score.
 */
export async function runSelfCritiqueLoop(
  input: SelfCritiqueLoopInput,
): Promise<SelfCritiqueLoopResult> {
  const {
    feature,
    prompt,
    workspaceId,
    systemInstruction,
    drafterModel,
    criticModel,
    config,
    executor,
  } = input;

  const enabled = config.enableSelfCritiqueLoop !== false;
  const maxIterations = Math.min(3, Math.max(1, config.maxCritiqueIterations ?? 2));
  const threshold = Math.min(99, Math.max(70, config.autoDispatchThreshold ?? 95));
  const iterations: AiCritiqueIteration[] = [];

  let currentDraft = '';
  let finalConfidence: number | null = null;
  let exitReason: AiCritiqueLog['exitReason'] = 'critique_disabled';

  const runDrafter = async (critique?: string): Promise<string> => {
    const exec = await executor({
      model: drafterModel,
      prompt: buildDrafterPrompt(prompt, critique),
      feature,
      workspaceId,
      systemInstruction,
    });
    return exec.output;
  };

  try {
    currentDraft = await runDrafter();
  } catch (err: unknown) {
    // Drafter failure is fatal for the request — rethrow so the lifecycle
    // reports a failed execution instead of silently sending nothing.
    throw err;
  }

  if (!enabled) {
    const confidence = estimateDrafterConfidence(currentDraft);
    return {
      output: currentDraft,
      confidence: confidence / 100,
      confidenceScore: confidence,
      executionStatus: confidence >= threshold ? 'high_confidence' : 'nuanced',
      critiqueLog: {
        enabled: false,
        iterations: [],
        finalConfidence: confidence,
        finalDraft: currentDraft,
        exitReason: 'critique_disabled',
        updatedAt: new Date().toISOString(),
      },
    };
  }

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let verdict: CriticVerdict | null = null;
    let criticError = false;

    try {
      const raw = await withTimeout(
        executor({
          model: criticModel,
          prompt: buildCriticPrompt(currentDraft),
          feature,
          workspaceId,
          systemInstruction:
            (systemInstruction ?? '') +
            '\n\nYou are acting as the Evaluator/Critic. Output ONLY the requested JSON verdict.',
        }),
        CRITIC_TIMEOUT_MS,
      );
      verdict = parseCriticVerdict(raw.output);
      if (!verdict) {
        criticError = true;
      }
    } catch (err: unknown) {
      criticError = true;
      console.warn(
        '[Self-Critique] Critic failed (iteration ' +
          `${iteration + 1}): ` +
          (err instanceof Error ? err.message : String(err)),
      );
    }

    iterations.push({
      iteration,
      draft: currentDraft,
      critique: verdict
        ? {
            factual_accuracy: verdict.factual_accuracy,
            policy_adherence: verdict.policy_adherence,
            confidence_score: verdict.confidence_score,
            actionable_critique: verdict.actionable_critique,
          }
        : {
            factual_accuracy: 0,
            policy_adherence: 0,
            confidence_score: 0,
            actionable_critique: '',
          },
      criticError,
      drafterModel,
      criticModel,
      createdAt: new Date().toISOString(),
    });

    if (criticError) {
      finalConfidence = null;
      exitReason = 'critic_failed';
      break;
    }

    const score = verdict!.confidence_score;
    finalConfidence = score;

    if (score >= threshold) {
      exitReason = 'threshold_met';
      break;
    }

    const lastIteration = iteration === maxIterations - 1;
    if (lastIteration) {
      exitReason = 'max_iterations';
      break;
    }

    // Feed the actionable critique back into the drafter for another pass.
    currentDraft = await runDrafter(verdict!.actionable_critique);
  }

  const executionStatus: AiTicketExecutionStatus =
    finalConfidence === null
      ? 'nuanced'
      : finalConfidence >= threshold
        ? 'high_confidence'
        : 'nuanced';

  const critiqueLog: AiCritiqueLog = {
    enabled: true,
    iterations,
    finalConfidence,
    finalDraft: currentDraft,
    exitReason,
    updatedAt: new Date().toISOString(),
  };

  return {
    output: currentDraft,
    confidence: finalConfidence === null ? null : finalConfidence / 100,
    confidenceScore: finalConfidence,
    executionStatus,
    critiqueLog,
  };
}
