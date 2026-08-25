/**
 * AI Orchestrator — personas and skills.
 */
import type { AiFeatureId } from './feature-ids.js';

export type AiPersonaId =
  | 'support_agent'
  | 'security_analyst'
  | 'knowledge_writer'
  | 'tier3_technical_escalation'
  | 'friendly_billing_assistant';

export interface AiPersonaDefinition {
  id: AiPersonaId;
  labelKey: string;
  toneKey: string;
  languageKey: string;
  formatKey: string;
  systemPromptSuffix: string;
  /** Optional uploaded Markdown skill instructions (workspace-persisted). */
  skillsContent?: string;
  skillsFileName?: string;
}

/** Workspace-persisted Markdown skill file per persona. */
export interface AiPersonaSkillProfile {
  skillsContent?: string;
  skillsFileName?: string;
}

export type AiPersonaSkillsMap = Partial<Record<AiPersonaId, AiPersonaSkillProfile>>;

export type AiFeaturePersonaMap = Partial<Record<AiFeatureId, AiPersonaId>>;

export const AI_PERSONA_DEFINITIONS: Record<AiPersonaId, AiPersonaDefinition> = {
  support_agent: {
    id: 'support_agent',
    labelKey: 'aiOrchestrator.personas.supportAgent.label',
    toneKey: 'aiOrchestrator.personas.supportAgent.tone',
    languageKey: 'aiOrchestrator.personas.supportAgent.language',
    formatKey: 'aiOrchestrator.personas.supportAgent.format',
    systemPromptSuffix: 'Antworte warmherzig auf Deutsch als hilfreicher Support-Agent.',
  },
  security_analyst: {
    id: 'security_analyst',
    labelKey: 'aiOrchestrator.personas.securityAnalyst.label',
    toneKey: 'aiOrchestrator.personas.securityAnalyst.tone',
    languageKey: 'aiOrchestrator.personas.securityAnalyst.language',
    formatKey: 'aiOrchestrator.personas.securityAnalyst.format',
    systemPromptSuffix:
      'Du bist ein strikter Sicherheitsanalyst. Analysiere den Text, entferne personenbezogene Daten (PII) nach DSGVO-Richtlinien und antworte kurz und präzise auf Deutsch.',
  },
  knowledge_writer: {
    id: 'knowledge_writer',
    labelKey: 'aiOrchestrator.personas.knowledgeWriter.label',
    toneKey: 'aiOrchestrator.personas.knowledgeWriter.tone',
    languageKey: 'aiOrchestrator.personas.knowledgeWriter.language',
    formatKey: 'aiOrchestrator.personas.knowledgeWriter.format',
    systemPromptSuffix:
      'Du bist ein Wissensautor. Formuliere technische Inhalte in klar strukturiertes, formelles Deutsch im Markdown-Format.',
  },
  tier3_technical_escalation: {
    id: 'tier3_technical_escalation',
    labelKey: 'aiOrchestrator.personas.tier3.label',
    toneKey: 'aiOrchestrator.personas.tier3.tone',
    languageKey: 'aiOrchestrator.personas.tier3.language',
    formatKey: 'aiOrchestrator.personas.tier3.format',
    systemPromptSuffix:
      'Du bist ein knapper Tier-3-Ingenieur. Nenne zuerst die Ursache, dann den Fix, dann das Restrisiko.',
  },
  friendly_billing_assistant: {
    id: 'friendly_billing_assistant',
    labelKey: 'aiOrchestrator.personas.billing.label',
    toneKey: 'aiOrchestrator.personas.billing.tone',
    languageKey: 'aiOrchestrator.personas.billing.language',
    formatKey: 'aiOrchestrator.personas.billing.format',
    systemPromptSuffix:
      'Du bist ein freundlicher Billing-Assistent. Erkläre Rechnungen klar und erfinde niemals Beträge.',
  },
};

export const DEFAULT_FEATURE_PERSONAS: AiFeaturePersonaMap = {
  ticket_summarization: 'support_agent',
  smart_reply: 'support_agent',
  kb_generation: 'knowledge_writer',
  root_cause_analysis: 'security_analyst',
  translation: 'knowledge_writer',
};
