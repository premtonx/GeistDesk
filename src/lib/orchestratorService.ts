import axios from 'axios';
import type { AiOrchestratorConfig, AiPersonaId, AiPersonaSkillProfile } from '../types/aiOrchestrator';

/** Persists persona skill scripts to the workspace orchestrator config (global for all team profiles). */
export async function updateAgentSkills(
  agentId: AiPersonaId,
  skillData: AiPersonaSkillProfile,
  workspaceId = 'default',
): Promise<{ skill: AiPersonaSkillProfile; config: AiOrchestratorConfig }> {
  const res = await axios.put(`/api/admin/orchestrator/agent-skills/${agentId}`, {
    ...skillData,
    workspaceId,
  });
  return {
    skill: res.data.skill as AiPersonaSkillProfile,
    config: res.data.config as AiOrchestratorConfig,
  };
}
