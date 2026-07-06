import type { AiPersonaId } from '../../types/aiOrchestrator';

export interface AgentSkillBlueprint {
  id: string;
  personaId: AiPersonaId;
  labelKey: string;
  defaultLabel: string;
  descriptionKey: string;
  defaultDescription: string;
}

import { AGENT_SKILL_BLUEPRINT_MANIFESTS } from '../../data/agent-skill-manifests';

export const AGENT_SKILL_BLUEPRINTS: AgentSkillBlueprint[] = [
  {
    id: 'support_empathy_translation',
    personaId: 'support_agent',
    labelKey: 'aiOrchestrator.personas.blueprints.support.label',
    defaultLabel: 'Support · Empathie & Übersetzung',
    descriptionKey: 'aiOrchestrator.personas.blueprints.support.description',
    defaultDescription: 'Mehrsprachige Empathie, Zusammenfassungs-Leitplanken, sichere Übersetzungs-Hooks.',
  },
  {
    id: 'security_audit_pii',
    personaId: 'security_analyst',
    labelKey: 'aiOrchestrator.personas.blueprints.security.label',
    defaultLabel: 'Sicherheit · Audit & PII',
    descriptionKey: 'aiOrchestrator.personas.blueprints.security.description',
    defaultDescription: 'Zero-Trust-Grenzen, PII-Scanning nach DSGVO, Token-Herkunft, Eskalations-Flags.',
  },
  {
    id: 'knowledge_formal_docs',
    personaId: 'knowledge_writer',
    labelKey: 'aiOrchestrator.personas.blueprints.knowledge.label',
    defaultLabel: 'Wissen · Formale Docs',
    descriptionKey: 'aiOrchestrator.personas.blueprints.knowledge.description',
    defaultDescription: 'RCA-Ingestion, strukturierte Markdown-Artikel auf Deutsch, Terminologie-Filter.',
  },
];

export { AGENT_SKILL_BLUEPRINT_MANIFESTS };

export function getBlueprintManifest(blueprintId: string): string | undefined {
  return AGENT_SKILL_BLUEPRINT_MANIFESTS[blueprintId];
}

export function getBlueprintForPersona(personaId: AiPersonaId): AgentSkillBlueprint | undefined {
  return AGENT_SKILL_BLUEPRINTS.find((bp) => bp.personaId === personaId);
}
