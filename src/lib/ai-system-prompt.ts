import {
  AI_PERSONA_DEFINITIONS,
  DEFAULT_FEATURE_PERSONAS,
  type AiFeatureId,
  type AiOperatorLanguage,
  type AiOrchestratorConfig,
  type AiPersonaId,
} from '../types/ai-orchestrator';

export function buildOperatorLanguageBlock(lang: AiOperatorLanguage): string {
  if (lang === 'de') {
    return (
      'IMPORTANT: The current operator interface context language is GERMAN. ' +
      'You must strictly read all incoming metadata variables, evaluate instructions, ' +
      'and format your analytical payload outputs completely in German, maintaining structural tone properties.'
    );
  }
  return (
    'IMPORTANT: The current operator interface context language is ENGLISH. ' +
    'You must strictly read all incoming metadata variables, evaluate instructions, ' +
    'and format your analytical payload outputs completely in English, maintaining structural tone properties.'
  );
}

export function resolvePersonaForFeature(
  config: AiOrchestratorConfig,
  feature: AiFeatureId,
): AiPersonaId {
  return config.featurePersonas?.[feature] ?? DEFAULT_FEATURE_PERSONAS[feature] ?? 'support_agent';
}

/** Composes persona suffix, operator locale block, and optional Markdown skill file for model systemInstruction. */
export function buildLifecycleSystemInstruction(
  config: AiOrchestratorConfig,
  feature: AiFeatureId,
  operatorLanguage?: AiOperatorLanguage,
): string {
  const parts: string[] = [];
  const lang = operatorLanguage ?? 'de';
  parts.push(buildOperatorLanguageBlock(lang));

  const personaId = resolvePersonaForFeature(config, feature);
  const persona = AI_PERSONA_DEFINITIONS[personaId];
  if (persona.systemPromptSuffix) {
    parts.push(persona.systemPromptSuffix);
  }

  const skills = config.personaSkills?.[personaId];
  if (skills?.skillsContent?.trim()) {
    parts.push('--- Persona Skill Instructions ---');
    if (skills.skillsFileName) {
      parts.push(`Source: ${skills.skillsFileName}`);
    }
    parts.push(skills.skillsContent.trim());
  }

  return parts.join('\n\n');
}
