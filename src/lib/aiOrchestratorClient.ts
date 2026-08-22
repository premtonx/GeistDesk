import axios from 'axios';
import type { AiOrchestratorConfig, AiOrchestratorHealth } from '../types/aiOrchestrator';
import { DEFAULT_ORCHESTRATOR_CONFIG, toLegacyAiConfig } from '../types/aiOrchestrator';
import type { AIConfig } from './module-config';

let cachedConfig: AiOrchestratorConfig | null = null;
let cachedLegacy: AIConfig | null = null;
let cachedHealth: AiOrchestratorHealth | null = null;
const configListeners = new Set<(config: AiOrchestratorConfig) => void>();
const healthListeners = new Set<(health: AiOrchestratorHealth) => void>();
let eventSource: EventSource | null = null;

function notifyConfig(config: AiOrchestratorConfig) {
  for (const cb of configListeners) cb(config);
}

function notifyHealth(health: AiOrchestratorHealth) {
  for (const cb of healthListeners) cb(health);
}

function legacyFromConfig(config: AiOrchestratorConfig): AIConfig {
  return toLegacyAiConfig(config) as AIConfig;
}

function applyConfig(data: Partial<AiOrchestratorConfig>) {
  cachedConfig = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...data };
  cachedLegacy = legacyFromConfig(cachedConfig);
  notifyConfig(cachedConfig);
}

export function hydrateOrchestratorConfig(data: Partial<AiOrchestratorConfig>): AiOrchestratorConfig {
  applyConfig(data);
  return cachedConfig!;
}

export function getCachedOrchestratorConfig(): AiOrchestratorConfig {
  return cachedConfig ?? DEFAULT_ORCHESTRATOR_CONFIG;
}

export function getCachedAiHealth(): AiOrchestratorHealth | null {
  return cachedHealth;
}

export function getCachedLegacyAiConfig(): AIConfig {
  if (cachedLegacy) return cachedLegacy;
  return legacyFromConfig(DEFAULT_ORCHESTRATOR_CONFIG);
}

export async function fetchOrchestratorConfig(force = false): Promise<AiOrchestratorConfig> {
  if (!force && cachedConfig) return cachedConfig;
  try {
    const res = await axios.get('/api/ai/config', { withCredentials: true });
    applyConfig(res.data);
    return cachedConfig!;
  } catch {
    return cachedConfig ?? DEFAULT_ORCHESTRATOR_CONFIG;
  }
}

export async function fetchAiStatus(): Promise<AiOrchestratorHealth | null> {
  try {
    const res = await axios.get('/api/ai/status', { withCredentials: true });
    cachedHealth = res.data;
    notifyHealth(cachedHealth!);
    return cachedHealth;
  } catch {
    return cachedHealth;
  }
}

export function subscribeOrchestratorConfig(cb: (config: AiOrchestratorConfig) => void): () => void {
  configListeners.add(cb);
  if (cachedConfig) cb(cachedConfig);
  return () => configListeners.delete(cb);
}

export function subscribeAiHealth(cb: (health: AiOrchestratorHealth) => void): () => void {
  healthListeners.add(cb);
  if (cachedHealth) cb(cachedHealth);
  return () => healthListeners.delete(cb);
}

export function startOrchestratorConfigSync(): void {
  void fetchOrchestratorConfig(true);
  void fetchAiStatus();

  if (eventSource) return;

  eventSource = new EventSource('/api/ai/events', { withCredentials: true } as EventSourceInit);

  eventSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === 'config_updated' && payload.config) {
        applyConfig(payload.config);
      }
      if (payload.type === 'health_changed' || payload.health) {
        cachedHealth = payload.health ?? cachedHealth;
        if (cachedHealth) notifyHealth(cachedHealth);
      }
    } catch {
      /* ignore malformed events */
    }
  };

  eventSource.onerror = () => {
    eventSource?.close();
    eventSource = null;
    setTimeout(() => startOrchestratorConfigSync(), 5000);
  };
}

/** @deprecated Use startOrchestratorConfigSync */
export function startOrchestratorConfigPolling(): void {
  startOrchestratorConfigSync();
}

export function stopOrchestratorConfigSync(): void {
  eventSource?.close();
  eventSource = null;
}

/** @deprecated Use stopOrchestratorConfigSync */
export function stopOrchestratorConfigPolling(): void {
  stopOrchestratorConfigSync();
}
