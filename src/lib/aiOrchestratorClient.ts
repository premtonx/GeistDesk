import axios from 'axios';
import type { AiOrchestratorConfig } from '../types/aiOrchestrator';
import { DEFAULT_ORCHESTRATOR_CONFIG, toLegacyAiConfig } from '../types/aiOrchestrator';
import type { AIConfig } from './module-config';

let cachedConfig: AiOrchestratorConfig | null = null;
let cachedLegacy: AIConfig | null = null;
let lastFetchedAt = 0;
const POLL_MS = 30_000;
const listeners = new Set<(config: AiOrchestratorConfig) => void>();
let pollTimer: ReturnType<typeof setInterval> | null = null;

function notify(config: AiOrchestratorConfig) {
  for (const cb of listeners) cb(config);
}

function legacyFromConfig(config: AiOrchestratorConfig): AIConfig {
  return toLegacyAiConfig(config) as AIConfig;
}

export function getCachedOrchestratorConfig(): AiOrchestratorConfig {
  return cachedConfig ?? DEFAULT_ORCHESTRATOR_CONFIG;
}

/** Synchronous legacy shape for AIAdapter and services — uses last fetched workspace config. */
export function getCachedLegacyAiConfig(): AIConfig {
  if (cachedLegacy) return cachedLegacy;
  return legacyFromConfig(DEFAULT_ORCHESTRATOR_CONFIG);
}

export async function fetchOrchestratorConfig(force = false): Promise<AiOrchestratorConfig> {
  const now = Date.now();
  if (!force && cachedConfig && now - lastFetchedAt < POLL_MS) {
    return cachedConfig;
  }
  try {
    const res = await axios.get('/api/ai/config');
    cachedConfig = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...res.data };
    cachedLegacy = legacyFromConfig(cachedConfig);
    lastFetchedAt = now;
    notify(cachedConfig);
    return cachedConfig;
  } catch {
    return cachedConfig ?? DEFAULT_ORCHESTRATOR_CONFIG;
  }
}

export function subscribeOrchestratorConfig(cb: (config: AiOrchestratorConfig) => void): () => void {
  listeners.add(cb);
  if (cachedConfig) cb(cachedConfig);
  return () => listeners.delete(cb);
}

export function startOrchestratorConfigPolling(): void {
  if (pollTimer) return;
  void fetchOrchestratorConfig(true);
  pollTimer = setInterval(() => void fetchOrchestratorConfig(true), POLL_MS);
}

export function stopOrchestratorConfigPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
