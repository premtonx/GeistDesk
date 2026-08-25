/**
 * AI Orchestrator — core feature/module identity types.
 */

export type AiConfigScope = 'workspace' | 'global';

export type AiModuleId = 'tickets' | 'kb' | 'vault' | 'exchange';

export type AiBudgetExceededAction = 'local_fallback' | 'disable_non_critical';

export type AiFeatureId =
  | 'ticket_summarization'
  | 'sentiment_analysis'
  | 'smart_reply'
  | 'kb_generation'
  | 'escalation_analysis'
  | 'root_cause_analysis'
  | 'translation'
  | 'vault_insights';

export type AiOperatorLanguage = 'de' | 'en';

/** Approval gate modes for AI generation workflow intervention hooks. */
export type AiApprovalGateMode = 'automatic' | 'manager_approval' | 'engineer_approval';

/** Programmatic decision-engine pipeline steps for every AI request. */
export type AiDecisionEngineStep =
  | 'request_received'
  | 'detect_feature_context'
  | 'audit_department_customer_scope'
  | 'check_pii_shields'
  | 'match_data_residency_region'
  | 'evaluate_budget_capacity'
  | 'assign_compliant_model'
  | 'approval_gate'
  | 'cache_lookup'
  | 'execute'
  | 'cache_persist'
  | 'confidence_threshold_check'
  | 'memory_policy'
  | 'file_audit_log';

export type AiExecutionStatus =
  | 'completed'
  | 'pending_approval'
  | 'pending_review'
  | 'blocked'
  | 'failed';

export type AiCustomerScope = 'standard' | 'vip' | 'enterprise';

/** Per-ticket AI dispatch execution state — persisted on the ticket document. */
export type AiTicketExecutionStatus =
  | 'auto_dispatched'
  | 'high_confidence'
  | 'nuanced'
  | 'manual';

/** Core features managed in the version-controlled prompt library. */
export type AiPromptLibraryFeature =
  | 'ticket_summarization'
  | 'kb_generation'
  | 'root_cause_analysis'
  | 'translation';

export const FEATURE_LABELS: Record<AiFeatureId, string> = {
  ticket_summarization: 'Ticket Summarization',
  sentiment_analysis: 'Sentiment Analysis',
  smart_reply: 'Smart Reply',
  kb_generation: 'KB Generation',
  escalation_analysis: 'Escalation Analysis',
  root_cause_analysis: 'Root Cause Analysis',
  translation: 'Translation',
  vault_insights: 'Vault Insights',
};

export const MODULE_FOR_FEATURE: Record<AiFeatureId, AiModuleId> = {
  ticket_summarization: 'tickets',
  sentiment_analysis: 'tickets',
  smart_reply: 'tickets',
  kb_generation: 'kb',
  escalation_analysis: 'tickets',
  root_cause_analysis: 'tickets',
  translation: 'tickets',
  vault_insights: 'vault',
};

/** Feature-specific approval workflow gates (intervention hooks). */
export const DEFAULT_APPROVAL_WORKFLOW_GATES: Record<AiFeatureId, AiApprovalGateMode> = {
  ticket_summarization: 'automatic',
  sentiment_analysis: 'automatic',
  smart_reply: 'automatic',
  kb_generation: 'manager_approval',
  escalation_analysis: 'automatic',
  root_cause_analysis: 'engineer_approval',
  translation: 'automatic',
  vault_insights: 'automatic',
};

/** Step-by-step decision engine flow chart for every incoming AI prompt. */
export const AI_DECISION_ENGINE_FLOW: Array<{ step: AiDecisionEngineStep; label: string }> = [
  { step: 'request_received', label: 'Request' },
  { step: 'detect_feature_context', label: 'Detect Feature Context' },
  { step: 'audit_department_customer_scope', label: 'Audit Department/Customer Scope' },
  { step: 'check_pii_shields', label: 'Check PII Shields' },
  { step: 'match_data_residency_region', label: 'Match Data Residency Region' },
  { step: 'evaluate_budget_capacity', label: 'Evaluate Budget Capacity' },
  { step: 'assign_compliant_model', label: 'Assign Compliant Model' },
  { step: 'approval_gate', label: 'Approval Workflow Gate' },
  { step: 'cache_lookup', label: 'Entity JSONB Cache Lookup' },
  { step: 'execute', label: 'Execute' },
  { step: 'cache_persist', label: 'Persist Cache Payload' },
  { step: 'confidence_threshold_check', label: 'Confidence Threshold Check' },
  { step: 'memory_policy', label: 'Memory & Explainability Policies' },
  { step: 'file_audit_log', label: 'File Audit Log' },
];

export const PROMPT_LIBRARY_FEATURES: AiPromptLibraryFeature[] = [
  'ticket_summarization',
  'kb_generation',
  'root_cause_analysis',
  'translation',
];

export const DEFAULT_PROMPT_BODIES: Record<AiPromptLibraryFeature, string> = {
  ticket_summarization:
    'Du bist ein Assistent für den Supportbetrieb. Fasse den folgenden Ticket-Verlauf wie folgt zusammen:\n- Aktueller Status\n- Hauptanliegen des Kunden\n- Ergriffene Maßnahmen\n- Empfohlener nächster Schritt\n\nHalte die Zusammenfassung unter 150 Wörtern.',
  kb_generation:
    'Du bist ein technischer Redakteur. Wandle die Support-Lösung unten in einen Wissensdatenbank-Artikel um mit:\n- Titel\n- Problembeschreibung\n- Lösungsschritte\n- Präventionstipps\n\nVerwende klares Markdown-Format und formuliere auf Deutsch.',
  root_cause_analysis:
    'Du bist ein Senior-SRE. Führe eine Root-Cause-Analyse der Vorfalldaten durch:\n- Zeitachse der Ereignisse\n- Wahrscheinliche Ursache\n- Mitwirkende Faktoren\n- Empfehlungen zur Behebung\n\nAntworte präzise und strukturiert auf Deutsch.',
  translation:
    'Übersetze den folgenden Support-Inhalt präzise ins Deutsche. Bewahre Fachbegriffe und Tonalität. Gib ausschließlich die Übersetzung aus.',
};

/** Legacy English seed bodies — used to auto-migrate untouched default templates to German. */
export const LEGACY_ENGLISH_PROMPT_BODIES: Record<AiPromptLibraryFeature, string> = {
  ticket_summarization:
    'You are a support operations assistant. Summarize the ticket thread below into:\n- Current status\n- Key customer concern\n- Actions taken\n- Recommended next step\n\nKeep the summary under 150 words.',
  kb_generation:
    'You are a technical writer. Convert the support resolution below into a knowledge base article with:\n- Title\n- Problem description\n- Resolution steps\n- Prevention tips\n\nUse clear Markdown formatting.',
  root_cause_analysis:
    'You are a senior SRE. Perform root cause analysis on the incident data below:\n- Timeline of events\n- Probable root cause\n- Contributing factors\n- Remediation recommendations',
  translation:
    'Translate the following support content accurately. Preserve technical terms and tone. Output only the translation.',
};

export function shouldMigratePromptToGermanBaseline(
  body: string,
  feature: AiPromptLibraryFeature,
): boolean {
  const trimmed = body.trim();
  if (!trimmed) return true;
  if (trimmed === LEGACY_ENGLISH_PROMPT_BODIES[feature].trim()) return true;
  if (trimmed.startsWith('You are a support operations assistant')) return true;
  if (trimmed.startsWith('You are a technical writer. Convert the support resolution')) return true;
  if (trimmed.startsWith('You are a senior SRE')) return true;
  if (trimmed.startsWith('Translate the following support content accurately')) return true;
  return false;
}
