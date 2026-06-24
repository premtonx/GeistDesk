import { getDocsDirect } from './postgres-backend.js';
import {
  getOrchestratorConfig,
  getProviderSecret,
  listProviderSecretStatus,
} from './ai-orchestrator-store.js';
import type {
  AiOrchestratorConfig,
  AiOrchestratorHealth,
  AiOrchestratorTestResult,
  AiProviderHealth,
} from '../types/aiOrchestrator.js';

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'GPT-5',
  anthropic: 'Claude',
  google: 'Gemini',
  azure_openai: 'Azure OpenAI',
  local: 'Local Llama',
  custom_gateway: 'Custom Gateway',
};

async function pingLocalEndpoint(url: string, apiKey?: string | null): Promise<{ ok: boolean; latencyMs: number; message?: string }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url.replace(/\/$/, ''), {
      signal: controller.signal,
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    });
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - start;
    if (res.status >= 200 && res.status < 500) {
      return { ok: true, latencyMs };
    }
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

export async function fetchAiCostMetrics(): Promise<{
  totalRequests: number;
  totalRedactions: number;
  averageLatency: number;
  costTodayUsd: number;
  costMonthUsd: number;
  avgCostPerTicketUsd: number;
  topConsumerFeature: string;
}> {
  try {
    const logs = await getDocsDirect('ai_audit_logs', []);
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayLogs = logs.filter((log: any) => log.createdAt && new Date(log.createdAt) >= midnight);
    const monthLogs = logs.filter((log: any) => log.createdAt && new Date(log.createdAt) >= monthStart);

    const estimateCost = (log: any) => {
      const prompt = log.promptTokens || 200;
      const completion = log.completionTokens || 80;
      return (prompt * 0.0000015) + (completion * 0.000006);
    };

    const costTodayUsd = todayLogs.reduce((s: number, l: any) => s + estimateCost(l), 0);
    const costMonthUsd = monthLogs.reduce((s: number, l: any) => s + estimateCost(l), 0);
    const totalRedactions = todayLogs.reduce((s: number, l: any) => s + (l.redactionsCount || 0), 0);
    const sumLatency = todayLogs.reduce((s: number, l: any) => s + (l.latency || 0), 0);
    const averageLatency = todayLogs.length > 0 ? Math.round(sumLatency / todayLogs.length) : 0;

    const featureCounts: Record<string, number> = {};
    for (const log of todayLogs) {
      const feature = log.feature || log.model || 'unknown';
      featureCounts[feature] = (featureCounts[feature] || 0) + 1;
    }
    const topConsumerFeature =
      Object.entries(featureCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'smart_reply';

    const ticketLogs = todayLogs.filter((l: any) => l.ticketId);
    const avgCostPerTicketUsd =
      ticketLogs.length > 0 ? costTodayUsd / new Set(ticketLogs.map((l: any) => l.ticketId)).size : 0;

    return {
      totalRequests: todayLogs.length,
      totalRedactions,
      averageLatency,
      costTodayUsd: Math.round(costTodayUsd * 100) / 100,
      costMonthUsd: Math.round(costMonthUsd * 100) / 100,
      avgCostPerTicketUsd: Math.round(avgCostPerTicketUsd * 10000) / 10000,
      topConsumerFeature,
    };
  } catch {
    return {
      totalRequests: 0,
      totalRedactions: 0,
      averageLatency: 0,
      costTodayUsd: 0,
      costMonthUsd: 0,
      avgCostPerTicketUsd: 0,
      topConsumerFeature: 'smart_reply',
    };
  }
}

export async function buildProviderHealth(
  workspaceId = 'default',
  config?: AiOrchestratorConfig,
): Promise<AiProviderHealth[]> {
  const cfg = config ?? (await getOrchestratorConfig(workspaceId));
  const secretStatus = await listProviderSecretStatus(workspaceId);
  const metrics = await fetchAiCostMetrics();
  const providers: AiProviderHealth[] = [];

  const googleKey =
    (await getProviderSecret('google', workspaceId)) ||
    process.env.GEMINI_API_KEY ||
    null;
  if (!googleKey && !secretStatus.google) {
    providers.push({
      provider: 'google',
      label: PROVIDER_LABELS.google,
      status: 'missing_key',
      message: 'API key not configured',
      requestsToday: metrics.totalRequests,
    });
  } else if (googleKey) {
    const ping = await pingGoogle(googleKey);
    providers.push({
      provider: 'google',
      label: PROVIDER_LABELS.google,
      status: ping.ok ? 'online' : 'offline',
      latencyMs: ping.latencyMs,
      lastSuccessAt: ping.ok ? new Date().toISOString() : undefined,
      requestsToday: metrics.totalRequests,
      message: ping.message,
    });
  }

  const openaiKey = await getProviderSecret('openai', workspaceId);
  if (!openaiKey) {
    providers.push({
      provider: 'openai',
      label: PROVIDER_LABELS.openai,
      status: 'missing_key',
      message: 'API key not configured',
    });
  } else {
    const ping = await pingOpenAI(openaiKey);
    providers.push({
      provider: 'openai',
      label: PROVIDER_LABELS.openai,
      status: ping.ok ? 'online' : 'offline',
      latencyMs: ping.latencyMs,
      lastSuccessAt: ping.ok ? new Date().toISOString() : undefined,
      message: ping.message,
    });
  }

  const anthropicKey = await getProviderSecret('anthropic', workspaceId);
  if (!anthropicKey) {
    providers.push({
      provider: 'anthropic',
      label: PROVIDER_LABELS.anthropic,
      status: 'missing_key',
      message: 'API key not configured',
    });
  } else {
    const ping = await pingAnthropic(anthropicKey);
    providers.push({
      provider: 'anthropic',
      label: PROVIDER_LABELS.anthropic,
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
    label: PROVIDER_LABELS.local,
    status: localPing.ok ? 'online' : 'degraded',
    latencyMs: localPing.latencyMs,
    lastSuccessAt: localPing.ok ? new Date().toISOString() : undefined,
    message: localPing.message,
  });

  return providers;
}

export async function getOrchestratorHealth(workspaceId = 'default'): Promise<AiOrchestratorHealth> {
  const config = await getOrchestratorConfig(workspaceId);
  const providers = await buildProviderHealth(workspaceId, config);
  const metrics = await fetchAiCostMetrics();
  const anyOnline = providers.some((p) => p.status === 'online');
  const anyDegraded = providers.some((p) => p.status === 'degraded' || p.status === 'offline');

  return {
    status: anyOnline ? (anyDegraded ? 'degraded' : 'online') : 'offline',
    primaryModel: config.primaryModel,
    providers,
    metrics,
  };
}

export async function testOrchestratorConfiguration(workspaceId = 'default'): Promise<AiOrchestratorTestResult[]> {
  const providers = await buildProviderHealth(workspaceId);
  return providers.map((p) => ({
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
