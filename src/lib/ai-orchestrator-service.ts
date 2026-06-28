import { queryDb } from './postgres-backend.js';
import {
  getOrchestratorConfig,
  getProviderSecret,
  getUsageCostTotals,
  listProviderSecretStatus,
} from './ai-orchestrator-store.js';
import type {
  AiFeatureId,
  AiFeatureUsageStat,
  AiModuleId,
  AiModuleUsage,
  AiOrchestratorConfig,
  AiOrchestratorHealth,
  AiOrchestratorTestResult,
  AiProviderHealth,
  AiUsageAnalytics,
  DetectedLocalModel,
} from '../types/aiOrchestrator.js';
import { FEATURE_LABELS as FEATURE_LABELS_CONST } from '../types/aiOrchestrator.js';
import { isBudgetExceeded } from './ai-budget.js';
import {
  runAiRequestLifecycle,
  type AiLifecycleOptions,
} from './ai-request-lifecycle.js';
import { createProductionModelExecutor } from './ai-lifecycle-executor.js';
import type { AiExecutionContext, AiExecutionResult } from '../types/aiOrchestrator.js';

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'GPT-5',
  anthropic: 'Claude Sonnet',
  google: 'Gemini',
  azure_openai: 'Azure OpenAI',
  local: 'Local Llama',
  'gpt-5': 'GPT-5',
  claude: 'Claude Sonnet',
  'gemini-flash': 'Gemini Flash',
  'local-llama': 'Local Llama',
  custom_gateway: 'Custom Gateway',
};

export { isBudgetExceeded } from './ai-budget.js';

/** Production AI execution — routes through lifecycle middleware with live model executor. */
export async function executeAiFeatureRequest(
  ctx: AiExecutionContext,
  options: AiLifecycleOptions = {},
): Promise<AiExecutionResult> {
  const workspaceId = ctx.workspaceId ?? 'default';
  return runAiRequestLifecycle(ctx, {
    ...options,
    executor: options.executor ?? createProductionModelExecutor(workspaceId),
  });
}

/** Returns model output for completed/review-pending requests; throws on blocked/failed. */
export function requireLifecycleOutput(result: AiExecutionResult): string {
  if (result.status === 'blocked' || result.status === 'failed') {
    throw new Error(result.error ?? `AI request ${result.status}`);
  }
  if (result.status === 'pending_approval') {
    throw new Error('AI generation requires approval before it can be delivered.');
  }
  if (!result.output?.trim()) {
    throw new Error('AI execution returned empty output.');
  }
  return result.output;
}

async function pingLocalEndpoint(url: string, apiKey?: string | null): Promise<{ ok: boolean; latencyMs: number; message?: string }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const base = url.replace(/\/v1\/?$/, '').replace(/\/$/, '');
    const res = await fetch(`${base}/`, {
      signal: controller.signal,
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    });
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - start;
    if (res.status >= 200 && res.status < 500) return { ok: true, latencyMs };
    return { ok: false, latencyMs, message: `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - start, message: e.message || String(e) };
  }
}

async function pingGoogle(apiKey: string): Promise<{ ok: boolean; latencyMs: number; message?: string }> {
  const start = Date.now();
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'ping',
      config: { maxOutputTokens: 1 },
    });
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - start, message: e.message || String(e) };
  }
}

async function pingOpenAI(apiKey: string): Promise<{ ok: boolean; latencyMs: number; message?: string }> {
  const start = Date.now();
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const latencyMs = Date.now() - start;
    return res.ok ? { ok: true, latencyMs } : { ok: false, latencyMs, message: `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - start, message: e.message || String(e) };
  }
}

async function pingAnthropic(apiKey: string): Promise<{ ok: boolean; latencyMs: number; message?: string }> {
  const start = Date.now();
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });
    const latencyMs = Date.now() - start;
    return res.ok || res.status === 400 ? { ok: true, latencyMs } : { ok: false, latencyMs, message: `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - start, message: e.message || String(e) };
  }
}

export async function detectLocalModels(
  endpointUrl: string,
  apiKey?: string | null,
): Promise<DetectedLocalModel[]> {
  const base = endpointUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '');
  const headers: Record<string, string> = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  const models: DetectedLocalModel[] = [];

  try {
    const ollamaRes = await fetch(`${base}/api/tags`, { headers, signal: AbortSignal.timeout(4000) });
    if (ollamaRes.ok) {
      const data = await ollamaRes.json();
      for (const m of data.models ?? []) {
        models.push({
          id: m.name || m.model,
          name: m.name || m.model,
          provider: 'ollama',
          size: m.size ? `${Math.round(m.size / 1e9)}GB` : undefined,
        });
      }
      if (models.length) return models;
    }
  } catch {
    /* try openai compat next */
  }

  try {
    const modelsUrl = endpointUrl.endsWith('/v1') ? `${endpointUrl}/models` : `${base}/v1/models`;
    const res = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      const list = data.data ?? data.models ?? [];
      for (const m of list) {
        const id = m.id || m.name;
        if (!id) continue;
        models.push({
          id,
          name: id,
          provider: base.includes('1234') ? 'lmstudio' : 'openai_compat',
        });
      }
    }
  } catch {
    /* no models */
  }

  return models;
}

async function fetchUsageAnalytics(workspaceId: string): Promise<AiUsageAnalytics> {
  const todayRes = await queryDb(
    `SELECT module, feature, model,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE success = true)::int AS successes,
            AVG(latency_ms)::float AS avg_latency,
            AVG(cost_usd)::float AS avg_cost,
            MAX(created_at) AS last_used
     FROM ai_usage_log
     WHERE workspace_id = $1 AND created_at >= date_trunc('day', NOW())
     GROUP BY module, feature, model`,
    [workspaceId],
  );

  const monthRes = await queryDb(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE success = true)::int AS successes,
       AVG(latency_ms)::float AS avg_latency,
       AVG(cost_usd)::float AS avg_cost
     FROM ai_usage_log
     WHERE workspace_id = $1 AND created_at >= date_trunc('month', NOW())`,
    [workspaceId],
  );

  const moduleRes = await queryDb(
    `SELECT module,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW()))::int AS today,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW()))::int AS month,
            COUNT(*) FILTER (WHERE success = true)::float / NULLIF(COUNT(*), 0) AS success_rate,
            AVG(latency_ms)::float AS avg_latency,
            AVG(cost_usd)::float AS avg_cost
     FROM ai_usage_log
     WHERE workspace_id = $1 AND created_at >= date_trunc('month', NOW())
     GROUP BY module`,
    [workspaceId],
  );

  const monthRow = monthRes.rows[0];
  const requestsMonth = Number(monthRow?.total ?? 0);
  const monthSuccesses = Number(monthRow?.successes ?? 0);
  const requestsToday = todayRes.rows.reduce((s, r) => s + Number(r.total), 0);
  const todaySuccesses = todayRes.rows.reduce((s, r) => s + Number(r.successes), 0);

  const byModule: AiModuleUsage[] = (['tickets', 'kb', 'vault', 'exchange'] as AiModuleId[]).map((mod) => {
    const row = moduleRes.rows.find((r) => r.module === mod);
    const total = Number(row?.month ?? 0);
    const rate = Number(row?.success_rate ?? 1);
    return {
      module: mod,
      requestsToday: Number(row?.today ?? 0),
      requestsMonth: total,
      successRate: Math.round(rate * 1000) / 10,
      failureRate: Math.round((1 - rate) * 1000) / 10,
      averageLatency: Math.round(Number(row?.avg_latency ?? 0)),
      averageCost: Math.round(Number(row?.avg_cost ?? 0) * 10000) / 10000,
    };
  });

  const byFeature: AiFeatureUsageStat[] = todayRes.rows.map((row) => ({
    feature: row.feature as AiFeatureId,
    featureLabel: FEATURE_LABELS_CONST[row.feature as AiFeatureId] ?? String(row.feature),
    model: String(row.model),
    requestCount: Number(row.total),
    lastUsedAt: row.last_used ? new Date(row.last_used).toISOString() : undefined,
  }));

  byFeature.sort((a, b) => b.requestCount - a.requestCount);

  const successRate = requestsToday > 0 ? (todaySuccesses / requestsToday) * 100 : 100;
  const monthRate = requestsMonth > 0 ? (monthSuccesses / requestsMonth) * 100 : 100;

  return {
    requestsToday,
    requestsMonth,
    successRate: Math.round(successRate * 10) / 10,
    failureRate: Math.round((100 - successRate) * 10) / 10,
    averageLatency: Math.round(Number(monthRow?.avg_latency ?? 0)),
    averageCost: Math.round(Number(monthRow?.avg_cost ?? 0) * 10000) / 10000,
    byModule,
    byFeature,
  };
}

export async function buildProviderHealth(
  workspaceId = 'default',
  config?: AiOrchestratorConfig,
): Promise<AiProviderHealth[]> {
  const cfg = config ?? (await getOrchestratorConfig(workspaceId));
  const providers: AiProviderHealth[] = [];

  const googleKey =
    (await getProviderSecret('google', workspaceId)) || process.env.GEMINI_API_KEY || null;
  if (!googleKey) {
    providers.push({ provider: 'google', label: 'Gemini Flash', status: 'missing_key', message: 'API key not configured' });
  } else {
    const ping = await pingGoogle(googleKey);
    providers.push({
      provider: 'google',
      label: 'Gemini Flash',
      status: ping.ok ? 'online' : 'offline',
      latencyMs: ping.latencyMs,
      lastSuccessAt: ping.ok ? new Date().toISOString() : undefined,
      message: ping.message,
    });
  }

  const openaiKey = await getProviderSecret('openai', workspaceId);
  if (!openaiKey) {
    providers.push({ provider: 'openai', label: 'GPT-5', status: 'missing_key', message: 'API key not configured' });
  } else {
    const ping = await pingOpenAI(openaiKey);
    providers.push({
      provider: 'openai',
      label: 'GPT-5',
      status: ping.ok ? 'online' : 'offline',
      latencyMs: ping.latencyMs,
      lastSuccessAt: ping.ok ? new Date().toISOString() : undefined,
      message: ping.message,
    });
  }

  const anthropicKey = await getProviderSecret('anthropic', workspaceId);
  if (!anthropicKey) {
    providers.push({ provider: 'anthropic', label: 'Claude Sonnet', status: 'missing_key', message: 'API key not configured' });
  } else {
    const ping = await pingAnthropic(anthropicKey);
    providers.push({
      provider: 'anthropic',
      label: 'Claude Sonnet',
      status: ping.ok ? 'online' : 'offline',
      latencyMs: ping.latencyMs,
      lastSuccessAt: ping.ok ? new Date().toISOString() : undefined,
      message: ping.message,
    });
  }

  const localKey = await getProviderSecret('local', workspaceId);
  const localPing = await pingLocalEndpoint(cfg.endpointUrl, localKey);
  providers.push({
    provider: 'local',
    label: 'Local Llama',
    status: localPing.ok ? 'online' : 'degraded',
    latencyMs: localPing.latencyMs,
    lastSuccessAt: localPing.ok ? new Date().toISOString() : undefined,
    message: localPing.message,
  });

  for (const modelId of cfg.providerPriority ?? []) {
    if (providers.some((p) => p.provider === modelId)) continue;
    providers.push({
      provider: modelId,
      label: PROVIDER_LABELS[modelId] ?? modelId,
      status: 'offline',
      message: 'Not probed',
    });
  }

  return providers;
}

export async function getOrchestratorHealth(workspaceId = 'default'): Promise<AiOrchestratorHealth> {
  const config = await getOrchestratorConfig(workspaceId);
  const providers = await buildProviderHealth(workspaceId, config);
  const usage = await fetchUsageAnalytics(workspaceId);
  const costs = await getUsageCostTotals(workspaceId);
  const budgetExceeded = isBudgetExceeded(config, costs);

  const priorityOnline = (config.providerPriority ?? []).some((model) => {
    const p = providers.find((pr) => pr.provider === model || pr.label.toLowerCase().includes(model));
    return p?.status === 'online';
  });
  const anyOnline = providers.some((p) => p.status === 'online') || priorityOnline;
  const anyDegraded = providers.some((p) => p.status === 'degraded' || p.status === 'offline' || p.status === 'missing_key');
  const killSwitchActive = config.killSwitch.master;

  let status: AiOrchestratorHealth['status'] = 'offline';
  let label = 'AI Offline';
  if (killSwitchActive) {
    status = 'offline';
    label = 'AI Disabled';
  } else if (anyOnline && !anyDegraded) {
    status = 'healthy';
    label = 'AI Healthy';
  } else if (anyOnline) {
    status = 'degraded';
    label = 'AI Degraded';
  }

  const topFeature = usage.byFeature[0]?.feature ?? 'smart_reply';

  return {
    status,
    label,
    primaryModel: config.providerPriority[0] ?? config.primaryModel,
    providers,
    killSwitchActive,
    budgetExceeded,
    metrics: {
      totalRequests: usage.requestsToday,
      totalRedactions: 0,
      averageLatency: usage.averageLatency,
      costTodayUsd: Math.round(costs.today * 100) / 100,
      costMonthUsd: Math.round(costs.month * 100) / 100,
      avgCostPerTicketUsd: usage.averageCost,
      topConsumerFeature: topFeature,
    },
    usage,
  };
}

export async function testOrchestratorConfiguration(workspaceId = 'default'): Promise<AiOrchestratorTestResult[]> {
  const providers = await buildProviderHealth(workspaceId);
  return providers
    .filter((p) => p.status !== 'offline' || p.message !== 'Not probed')
    .map((p) => ({
      provider: p.provider,
      label: p.label,
      success: p.status === 'online',
      message:
        p.status === 'missing_key'
          ? 'Authentication Failed — API key missing'
          : p.status === 'online'
            ? 'Connected'
            : p.message || 'Connection failed',
      latencyMs: p.latencyMs,
    }));
}

export async function logAiUsageFromServer(entry: {
  workspaceId?: string;
  module: AiModuleId;
  feature: AiFeatureId;
  model: string;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  success?: boolean;
}): Promise<void> {
  const cost =
    (entry.promptTokens ?? 200) * 0.0000015 + (entry.completionTokens ?? 80) * 0.000006;
  const { logAiUsage } = await import('./ai-orchestrator-store.js');
  await logAiUsage({
    workspaceId: entry.workspaceId,
    module: entry.module,
    feature: entry.feature,
    model: entry.model,
    latencyMs: entry.latencyMs,
    promptTokens: entry.promptTokens,
    completionTokens: entry.completionTokens,
    costUsd: cost,
    success: entry.success,
  });
}
