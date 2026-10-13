import {
  PLAYGROUND_MODEL_OPTIONS,
  type AiCostScale,
  type AiPlaygroundRunResult,
  type AiProviderBenchmarkRow,
} from '../types/ai-orchestrator';
import { buildProviderHealth, getOrchestratorHealth } from './ai-orchestrator-service.js';
import { getOrchestratorConfig } from './ai-orchestrator-store.js';
import { runAiRequestLifecycle } from './ai-request-lifecycle.js';
import { createProductionModelExecutor } from './ai-lifecycle-executor.js';

const MODEL_LABELS: Record<string, string> = Object.fromEntries(
  PLAYGROUND_MODEL_OPTIONS.map((m) => [m.value, m.label]),
);

const COST_SCALE_MAP: Record<string, AiCostScale> = {
  'local-llama': '$',
  local: '$',
  'gemini-flash': '$$',
  'gemini-pro': '$$',
  claude: '$$$',
  'gpt-5': '$$$$',
  openai: '$$$$',
  anthropic: '$$$',
  google: '$$',
};

const BASE_QUALITY: Record<string, number> = {
  'gpt-5': 94,
  claude: 92,
  'gemini-flash': 88,
  'gemini-pro': 90,
  'local-llama': 78,
};

function reliabilityFromStatus(status: string): number {
  if (status === 'online') return 99;
  if (status === 'degraded') return 72;
  if (status === 'missing_key') return 0;
  return 35;
}

export async function getProviderBenchmarkGrid(workspaceId = 'default'): Promise<AiProviderBenchmarkRow[]> {
  const [config, health] = await Promise.all([
    getOrchestratorConfig(workspaceId),
    getOrchestratorHealth(workspaceId),
  ]);
  const providers = await buildProviderHealth(workspaceId, config);
  const usageByModel = new Map<string, number>();
  for (const f of health.usage.byFeature) {
    usageByModel.set(f.model, f.requestCount);
  }

  const seen = new Set<string>();
  const rows: AiProviderBenchmarkRow[] = [];

  for (const provider of providers) {
    if (seen.has(provider.provider)) continue;
    seen.add(provider.provider);

    const successBoost = health.usage.successRate >= 90 ? 3 : health.usage.successRate >= 75 ? 0 : -5;
    rows.push({
      provider: provider.provider,
      label: provider.label,
      latencyMs: provider.latencyMs ?? null,
      costScale: COST_SCALE_MAP[provider.provider] ?? '$$',
      qualityRating: Math.min(100, Math.max(0, (BASE_QUALITY[provider.provider] ?? 80) + successBoost)),
      connectionReliability: reliabilityFromStatus(provider.status),
      status: provider.status,
    });
  }

  for (const modelId of config.providerPriority ?? []) {
    if (seen.has(modelId)) continue;
    seen.add(modelId);
    rows.push({
      provider: modelId,
      label: MODEL_LABELS[modelId] ?? modelId,
      latencyMs: null,
      costScale: COST_SCALE_MAP[modelId] ?? '$$',
      qualityRating: BASE_QUALITY[modelId] ?? 80,
      connectionReliability: 0,
      status: 'offline',
    });
  }

  return rows;
}

export async function runPlaygroundComparison(input: {
  prompt: string;
  models: string[];
  workspaceId?: string;
}): Promise<AiPlaygroundRunResult[]> {
  const workspaceId = input.workspaceId ?? 'default';
  const models = input.models.filter((m) => MODEL_LABELS[m] || PLAYGROUND_MODEL_OPTIONS.some((o) => o.value === m));

  const results = await Promise.all(
    models.map(async (model): Promise<AiPlaygroundRunResult> => {
      const label = MODEL_LABELS[model] ?? model;
      const start = Date.now();
      try {
        const prodExec = createProductionModelExecutor(workspaceId);
        const lifecycle = await runAiRequestLifecycle(
          {
            workspaceId,
            feature: 'smart_reply',
            prompt: input.prompt,
            metadata: { playground: true, targetModel: model },
          },
          {
            skipPersistence: true,
            skipApprovalGate: true,
            executor: ({ prompt: p, feature, workspaceId: wsId }) =>
              prodExec({ model, prompt: p, feature, workspaceId: wsId }),
          },
        );

        return {
          model,
          label,
          output: lifecycle.output ?? lifecycle.error ?? '',
          latencyMs: Date.now() - start,
          confidence: lifecycle.confidence ?? 0,
          success: lifecycle.status === 'completed' || lifecycle.status === 'pending_review',
          error: lifecycle.error,
        };
      } catch (err: unknown) {
        return {
          model,
          label,
          output: '',
          latencyMs: Date.now() - start,
          confidence: 0,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  return results;
}
