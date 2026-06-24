import { EventEmitter } from 'events';
import type { AiOrchestratorConfig } from '../types/aiOrchestrator.js';

export type OrchestratorEvent =
  | { type: 'config_updated'; workspaceId: string; config: AiOrchestratorConfig; version: number }
  | { type: 'health_changed'; workspaceId: string; status: string };

class OrchestratorEventBus extends EventEmitter {
  emitConfigUpdated(workspaceId: string, config: AiOrchestratorConfig, version: number) {
    this.emit('broadcast', { type: 'config_updated', workspaceId, config, version } satisfies OrchestratorEvent);
  }

  emitHealthChanged(workspaceId: string, status: string) {
    this.emit('broadcast', { type: 'health_changed', workspaceId, status } satisfies OrchestratorEvent);
  }
}

export const orchestratorEventBus = new OrchestratorEventBus();
