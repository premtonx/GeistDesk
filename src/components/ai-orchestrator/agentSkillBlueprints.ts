import type { AiPersonaId } from '../../types/aiOrchestrator';

export interface AgentSkillBlueprint {
  id: string;
  personaId: AiPersonaId;
  labelKey: string;
  defaultLabel: string;
  descriptionKey: string;
  defaultDescription: string;
}

const SUPPORT_AGENT_MANIFEST = {
  schemaVersion: '1.0',
  agent: 'support_agent',
  displayName: 'Support Agent — Customer Empathy & Translation',
  systemInstructions: {
    role: 'Empathetic multilingual support specialist for GeistDesk ticket workflows.',
    tone: 'Warm, patient, and solution-oriented. Mirror the customer language when safe.',
    primaryLanguage: 'de',
    fallbackLanguages: ['en'],
  },
  capabilities: {
    ticketSummarization: {
      enabled: true,
      maxTokens: 512,
      guardrails: [
        'Never invent ticket facts not present in the thread.',
        'Redact internal agent notes marked [INTERNAL].',
        'Preserve SLA timestamps and priority labels verbatim.',
      ],
    },
    translation: {
      enabled: true,
      secureHooks: ['pii-shield-pre', 'audit-log-post'],
      allowedPairs: ['de↔en', 'de↔fr'],
      blockOnHighRiskPii: true,
    },
    smartReply: {
      enabled: true,
      empathyMarkers: ['acknowledge frustration', 'confirm next step', 'offer escalation path'],
    },
  },
  runtimeBoundaries: {
    maxOutputTokens: 1200,
    refuseMedicalOrLegalAdvice: true,
    escalateOnAbuseKeywords: true,
  },
  tools: {
    allowed: ['ticket_context_reader', 'kb_snippet_search', 'secure_translator'],
    denied: ['vault_secret_export', 'admin_config_write'],
  },
} as const;

const SECURITY_ANALYST_MANIFEST = {
  schemaVersion: '1.0',
  agent: 'security_analyst',
  displayName: 'Security Analyst — Strict Auditing & PII Redaction',
  systemInstructions: {
    role: 'Zero-trust security analyst for incident triage, vault insights, and escalation review.',
    tone: 'Concise, evidence-based, no speculation beyond supplied artifacts.',
    primaryLanguage: 'en',
  },
  operationalBoundaries: {
    trustModel: 'zero-trust',
    assumeCompromise: true,
    requireCitationForClaims: true,
    maxSpeculationSentences: 0,
  },
  piiRedaction: {
    enabled: true,
    scanInputs: true,
    scanOutputs: true,
    patterns: ['email', 'phone', 'iban', 'api_key', 'jwt', 'ipv4', 'national_id'],
    onDetection: 'mask_and_flag',
  },
  cryptographicProvenance: {
    verifyTokenFingerprints: true,
    requireHybridKemMetadata: true,
    flagUnknownKeyIds: 'critical',
  },
  escalationRules: {
    flagRiskScoreAbove: 0.72,
    autoEscalateOn: ['credential_exposure', 'privilege_escalation', 'data_exfiltration_hint'],
    notifyChannels: ['security_queue', 'audit_trail'],
  },
  tools: {
    allowed: ['vault_insights_reader', 'audit_log_query', 'risk_score_evaluator'],
    denied: ['smart_reply_draft', 'customer_facing_send'],
  },
} as const;

const KNOWLEDGE_WRITER_MANIFEST = {
  schemaVersion: '1.0',
  agent: 'knowledge_writer',
  displayName: 'Knowledge Writer — Formal Documentation Formatting',
  systemInstructions: {
    role: 'Technical knowledge author converting engineering artifacts into publishable KB articles.',
    tone: 'Formal, precise, and structured for ITSM knowledge consumers.',
    primaryLanguage: 'en',
    outputFormat: 'markdown',
  },
  ingestion: {
    sources: ['root_cause_analysis', 'engineering_transcripts', 'incident_timelines'],
    normalizeAcronyms: true,
    preserveCodeBlocks: true,
  },
  markdownStructure: {
    requiredSections: ['Summary', 'Impact', 'Root Cause', 'Resolution', 'Prevention'],
    headingStyle: 'atx',
    tableOfContents: true,
    maxHeadingDepth: 3,
  },
  terminologyFilters: {
    enforceGlossary: true,
    bannedInformalPhrases: ['kind of', 'maybe', 'stuff', 'things'],
    preferredTerms: {
      incident: 'Incident',
      root_cause: 'Root Cause',
      workaround: 'Temporary Workaround',
    },
  },
  qualityGates: {
    minSectionWordCount: 40,
    requireActionablePrevention: true,
    humanReviewBelowConfidence: 0.85,
  },
  tools: {
    allowed: ['kb_draft_writer', 'rca_parser', 'terminology_linter'],
    denied: ['ticket_status_change', 'vault_secret_read'],
  },
} as const;

function toManifestJson(manifest: object): string {
  return JSON.stringify(manifest, null, 2);
}

export const AGENT_SKILL_BLUEPRINTS: AgentSkillBlueprint[] = [
  {
    id: 'support_empathy_translation',
    personaId: 'support_agent',
    labelKey: 'aiOrchestrator.personas.blueprints.support.label',
    defaultLabel: 'Support · Empathy & Translation',
    descriptionKey: 'aiOrchestrator.personas.blueprints.support.description',
    defaultDescription: 'Multi-language empathy, summarization guardrails, secure translation hooks.',
  },
  {
    id: 'security_audit_pii',
    personaId: 'security_analyst',
    labelKey: 'aiOrchestrator.personas.blueprints.security.label',
    defaultLabel: 'Security · Audit & PII',
    descriptionKey: 'aiOrchestrator.personas.blueprints.security.description',
    defaultDescription: 'Zero-trust boundaries, PII scanning, token provenance, escalation flags.',
  },
  {
    id: 'knowledge_formal_docs',
    personaId: 'knowledge_writer',
    labelKey: 'aiOrchestrator.personas.blueprints.knowledge.label',
    defaultLabel: 'Knowledge · Formal Docs',
    descriptionKey: 'aiOrchestrator.personas.blueprints.knowledge.description',
    defaultDescription: 'RCA ingestion, structured Markdown articles, terminology enforcement.',
  },
];

export const AGENT_SKILL_BLUEPRINT_MANIFESTS: Record<string, string> = {
  support_empathy_translation: toManifestJson(SUPPORT_AGENT_MANIFEST),
  security_audit_pii: toManifestJson(SECURITY_ANALYST_MANIFEST),
  knowledge_formal_docs: toManifestJson(KNOWLEDGE_WRITER_MANIFEST),
};

export function getBlueprintManifest(blueprintId: string): string | undefined {
  return AGENT_SKILL_BLUEPRINT_MANIFESTS[blueprintId];
}

export function getBlueprintForPersona(personaId: AiPersonaId): AgentSkillBlueprint | undefined {
  return AGENT_SKILL_BLUEPRINTS.find((bp) => bp.personaId === personaId);
}
