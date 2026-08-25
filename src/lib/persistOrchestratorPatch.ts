import axios from 'axios';
import type { AiOrchestratorConfig } from '../types/ai-orchestrator';
import { hydrateOrchestratorConfig } from './aiOrchestratorClient';

export async function persistOrchestratorPatch(
  patch: Partial<AiOrchestratorConfig>,
): Promise<AiOrchestratorConfig> {
  const res = await axios.post('/api/admin/orchestrator/config', patch);
  const saved = (res.data?.config ?? res.data) as AiOrchestratorConfig;
  return hydrateOrchestratorConfig(saved);
}
