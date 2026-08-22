import { getDocDirect, updateDocDirect } from './postgres-backend.js';
import { toLegacyAiConfig, type AiOrchestratorConfig } from '../types/aiOrchestrator.js';

/** Keep module_config.ai aligned with workspace orchestrator settings. */
export async function syncLegacyModuleAiFromOrchestrator(config: AiOrchestratorConfig): Promise<void> {
  const existing = await getDocDirect('module_config', 'global');
  if (!existing) return;

  const legacy = toLegacyAiConfig(config);
  const previous = existing.ai && typeof existing.ai === 'object' ? existing.ai : {};

  await updateDocDirect('module_config', 'global', {
    ai: {
      ...previous,
      sentimentModel: legacy.sentimentModel,
      deepThinkingModel: legacy.deepThinkingModel,
      localEndpoint: legacy.localEndpoint,
      customSentimentModelName: legacy.customSentimentModelName,
      customThinkingModelName: legacy.customThinkingModelName,
    },
    updatedAt: new Date().toISOString(),
  });
}
