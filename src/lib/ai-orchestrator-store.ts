import crypto from 'crypto';
import { queryDb } from './postgres-backend.js';
import {
  DEFAULT_CONFIDENCE_THRESHOLDS,
  DEFAULT_CORPORATE_POLICIES,
  DEFAULT_DATA_RESIDENCY_POLICY,
  DEFAULT_FEATURE_ROUTING,
  DEFAULT_KILL_SWITCH,
  DEFAULT_MEMORY_POLICY,
  DEFAULT_FEATURE_PERSONAS,
  DEFAULT_ORCHESTRATOR_CONFIG,
  DEFAULT_PROVIDER_PRIORITY,
  type AiApprovalQueueEntry,
  type AiConfidenceThresholds,
  type AiCorporatePolicies,
  type AiDataResidencyPolicy,
  type AiExplainabilityEntry,
  type AiFeatureId,
  type AiFeaturePersonaMap,
  type AiPersonaSkillsMap,
  type AiFeatureRouting,
  type AiHumanReviewEntry,
  type AiKillSwitch,
  type AiMemoryPolicy,
  type AiOrchestratorAuditEntry,
  type AiOrchestratorConfig,
  type AiOrchestratorVersion,
  type AiTrustLevel,
} from '../types/aiOrchestrator.js';
import { mergeCorporatePolicies, mergeDataResidencyPolicy } from './ai-orchestrator-policies.js';

const SECRET_KEY = process.env.AI_SECRETS_KEY || process.env.JWT_SECRET;
if (!SECRET_KEY) {
  throw new Error(
    '[AI Secrets] AI_SECRETS_KEY or JWT_SECRET is required to encrypt provider credentials at rest.',
  );
}

function deriveKey(): Buffer {
  return crypto.scryptSync(SECRET_KEY, 'geistdesk-ai-secrets', 32);
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function parseJson<T>(val: unknown, fallback: T): T {
  if (val == null) return fallback;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return val as T;
}

function parseKillSwitch(row: Record<string, unknown>): AiKillSwitch {
  const raw = parseJson<Partial<AiKillSwitch>>(row.kill_switch_json, {});
  return { ...DEFAULT_KILL_SWITCH, ...raw };
}

function parseTrustLevel(val: unknown): AiTrustLevel {
  const n = Number(val ?? 3);
  if (n >= 1 && n <= 5) return n as AiTrustLevel;
  return 3;
}

function parseCorporatePolicies(row: Record<string, unknown>): AiCorporatePolicies {
  const raw = parseJson<Partial<AiCorporatePolicies>>(row.corporate_policies_json, {});
  return mergeCorporatePolicies(raw);
}

function parseDataResidencyPolicy(row: Record<string, unknown>): AiDataResidencyPolicy {
  const raw = parseJson<Partial<AiDataResidencyPolicy>>(row.data_residency_policy_json, {});
  return mergeDataResidencyPolicy(raw);
}

function parseConfidenceThresholds(row: Record<string, unknown>): AiConfidenceThresholds {
  const raw = parseJson<Partial<AiConfidenceThresholds>>(row.confidence_thresholds_json, {});
  return { ...DEFAULT_CONFIDENCE_THRESHOLDS, ...raw };
}

function parseMemoryPolicy(row: Record<string, unknown>): AiMemoryPolicy {
  const raw = parseJson<Partial<AiMemoryPolicy>>(row.memory_policy_json, {});
  return { ...DEFAULT_MEMORY_POLICY, ...raw };
}

function parseFeaturePersonas(row: Record<string, unknown>): AiFeaturePersonaMap {
  const raw = parseJson<Partial<AiFeaturePersonaMap>>(row.feature_personas_json, {});
  return { ...DEFAULT_FEATURE_PERSONAS, ...raw };
}

function parsePersonaSkills(row: Record<string, unknown>): AiPersonaSkillsMap {
  return parseJson<AiPersonaSkillsMap>(row.persona_skills_json, {});
}

function rowToConfig(row: Record<string, unknown>): AiOrchestratorConfig {
  const routing = parseJson(row.feature_routing_json, DEFAULT_FEATURE_ROUTING);
  const fallbacks = parseJson<string[]>(row.fallback_models, DEFAULT_ORCHESTRATOR_CONFIG.fallbackModels);
  const priority = parseJson<string[]>(row.provider_priority, DEFAULT_PROVIDER_PRIORITY);
  const scope = String(row.scope ?? 'workspace');
  const normalizedScope = scope === 'personal' ? 'workspace' : (scope as AiOrchestratorConfig['scope']);

  return {
    workspaceId: String(row.workspace_id ?? 'default'),
    scope: normalizedScope,
    primaryModel: String(row.primary_model ?? DEFAULT_ORCHESTRATOR_CONFIG.primaryModel),
    reasoningModel: String(row.reasoning_model ?? DEFAULT_ORCHESTRATOR_CONFIG.reasoningModel),
    triageModel: String(row.triage_model ?? DEFAULT_ORCHESTRATOR_CONFIG.triageModel),
    modelMode: row.model_mode === 'simple' ? 'simple' : 'advanced',
    providerPriority: Array.isArray(priority) && priority.length ? priority : DEFAULT_PROVIDER_PRIORITY,
    fallbackModels: Array.isArray(fallbacks) ? fallbacks : DEFAULT_ORCHESTRATOR_CONFIG.fallbackModels,
    featureRouting: { ...DEFAULT_FEATURE_ROUTING, ...(routing as AiFeatureRouting) },
    endpointUrl: String(row.endpoint_url ?? DEFAULT_ORCHESTRATOR_CONFIG.endpointUrl),
    piiEnabled: row.pii_enabled !== false,
    autoEscalationEnabled: row.auto_escalation_enabled !== false,
    auditEnabled: row.audit_enabled !== false,
    configLocked: row.config_locked === true,
    reasoningLevel: (row.reasoning_level as AiOrchestratorConfig['reasoningLevel']) ?? 'balanced',
    contentFilteringEnabled: row.content_filtering_enabled !== false,
    promptLoggingEnabled: row.prompt_logging_enabled === true,
    dataResidency: String(row.data_residency ?? 'eu'),
    corporatePolicies: parseCorporatePolicies(row),
    trustLevel: parseTrustLevel(row.trust_level),
    dataResidencyPolicy: parseDataResidencyPolicy(row),
    confidenceThresholds: parseConfidenceThresholds(row),
    memoryPolicy: parseMemoryPolicy(row),
    featurePersonas: parseFeaturePersonas(row),
    personaSkills: parsePersonaSkills(row),
    killSwitch: parseKillSwitch(row),
    dailyBudgetUsd: Number(row.daily_budget_usd ?? DEFAULT_ORCHESTRATOR_CONFIG.dailyBudgetUsd),
    monthlyBudgetUsd: Number(row.monthly_budget_usd ?? DEFAULT_ORCHESTRATOR_CONFIG.monthlyBudgetUsd),
    dailyBudgetEur: Number(row.daily_budget_eur ?? DEFAULT_ORCHESTRATOR_CONFIG.dailyBudgetEur),
    budgetExceededAction:
      (row.budget_exceeded_action as AiOrchestratorConfig['budgetExceededAction']) ??
      DEFAULT_ORCHESTRATOR_CONFIG.budgetExceededAction,
    configVersion: Number(row.config_version ?? 1),
    updatedBy: row.updated_by ? String(row.updated_by) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at as string).toISOString() : undefined,
  };
}

async function fetchConfigRow(workspaceId: string): Promise<AiOrchestratorConfig | null> {
  const res = await queryDb(
    'SELECT * FROM ai_orchestrator_config WHERE workspace_id = $1 LIMIT 1',
    [workspaceId],
  );
  return res.rows[0] ? rowToConfig(res.rows[0]) : null;
}

export async function getOrchestratorConfig(workspaceId = 'default'): Promise<AiOrchestratorConfig> {
  const existing = await fetchConfigRow(workspaceId);
  if (existing) return existing;

  const defaults = { ...DEFAULT_ORCHESTRATOR_CONFIG, workspaceId };
  await insertOrchestratorConfig(defaults, 'system');
  return (await fetchConfigRow(workspaceId)) ?? defaults;
}

async function insertOrchestratorConfig(config: AiOrchestratorConfig, updatedBy: string): Promise<void> {
  await queryDb(
    `INSERT INTO ai_orchestrator_config (
      workspace_id, scope, primary_model, reasoning_model, triage_model, model_mode,
      fallback_models, provider_priority, feature_routing_json, endpoint_url,
      pii_enabled, auto_escalation_enabled, audit_enabled, config_locked,
      reasoning_level, content_filtering_enabled, prompt_logging_enabled,
      data_residency, corporate_policies_json, trust_level, data_residency_policy_json,
      confidence_thresholds_json, memory_policy_json, feature_personas_json,
      persona_skills_json,
      kill_switch_json, daily_budget_usd, monthly_budget_usd, daily_budget_eur,
      budget_exceeded_action, config_version, created_by, updated_by, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,NOW()
    )
    ON CONFLICT (workspace_id) DO NOTHING`,
    configInsertParams(config, updatedBy),
  );
}

function configInsertParams(config: AiOrchestratorConfig, updatedBy: string): unknown[] {
  return [
    config.workspaceId,
    config.scope,
    config.primaryModel,
    config.reasoningModel,
    config.triageModel,
    config.modelMode,
    JSON.stringify(config.fallbackModels),
    JSON.stringify(config.providerPriority),
    JSON.stringify(config.featureRouting),
    config.endpointUrl,
    config.piiEnabled,
    config.autoEscalationEnabled,
    config.auditEnabled,
    config.configLocked,
    config.reasoningLevel,
    config.contentFilteringEnabled,
    config.promptLoggingEnabled,
    config.dataResidency,
    JSON.stringify(config.corporatePolicies),
    config.trustLevel,
    JSON.stringify(config.dataResidencyPolicy),
    JSON.stringify(config.confidenceThresholds),
    JSON.stringify(config.memoryPolicy),
    JSON.stringify(config.featurePersonas),
    JSON.stringify(config.personaSkills ?? {}),
    JSON.stringify(config.killSwitch),
    config.dailyBudgetUsd,
    config.monthlyBudgetUsd,
    config.dailyBudgetEur,
    config.budgetExceededAction,
    config.configVersion,
    updatedBy,
    updatedBy,
  ];
}

function omitUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}

export async function upsertOrchestratorConfig(
  config: Partial<AiOrchestratorConfig> & { workspaceId?: string },
  updatedBy: string,
  options?: { skipVersion?: boolean },
): Promise<AiOrchestratorConfig> {
  const workspaceId = config.workspaceId ?? 'default';
  const existing = await getOrchestratorConfig(workspaceId);
  const nextVersion = options?.skipVersion ? existing.configVersion : existing.configVersion + 1;
  const incoming = omitUndefined({ ...config, workspaceId: undefined }) as Partial<AiOrchestratorConfig>;
  const merged: AiOrchestratorConfig = {
    ...existing,
    ...incoming,
    workspaceId,
    configVersion: nextVersion,
    providerPriority: incoming.providerPriority ?? existing.providerPriority,
    featureRouting: incoming.featureRouting
      ? { ...DEFAULT_FEATURE_ROUTING, ...existing.featureRouting, ...incoming.featureRouting }
      : existing.featureRouting,
    corporatePolicies: incoming.corporatePolicies
      ? { ...existing.corporatePolicies, ...incoming.corporatePolicies }
      : existing.corporatePolicies,
    dataResidencyPolicy: incoming.dataResidencyPolicy
      ? { ...existing.dataResidencyPolicy, ...incoming.dataResidencyPolicy }
      : existing.dataResidencyPolicy,
    confidenceThresholds: incoming.confidenceThresholds
      ? { ...existing.confidenceThresholds, ...incoming.confidenceThresholds }
      : existing.confidenceThresholds,
    memoryPolicy: incoming.memoryPolicy
      ? { ...existing.memoryPolicy, ...incoming.memoryPolicy }
      : existing.memoryPolicy,
    featurePersonas: incoming.featurePersonas
      ? { ...existing.featurePersonas, ...incoming.featurePersonas }
      : existing.featurePersonas,
    personaSkills: incoming.personaSkills
      ? { ...existing.personaSkills, ...incoming.personaSkills }
      : existing.personaSkills,
    killSwitch: incoming.killSwitch ? { ...existing.killSwitch, ...incoming.killSwitch } : existing.killSwitch,
  };

  if (merged.providerPriority.length > 0) {
    merged.primaryModel = merged.providerPriority[0];
    merged.fallbackModels = merged.providerPriority.slice(1);
  }

  await queryDb(
    `INSERT INTO ai_orchestrator_config (
      workspace_id, scope, primary_model, reasoning_model, triage_model, model_mode,
      fallback_models, provider_priority, feature_routing_json, endpoint_url,
      pii_enabled, auto_escalation_enabled, audit_enabled, config_locked,
      reasoning_level, content_filtering_enabled, prompt_logging_enabled,
      data_residency, corporate_policies_json, trust_level, data_residency_policy_json,
      confidence_thresholds_json, memory_policy_json, feature_personas_json,
      persona_skills_json,
      kill_switch_json, daily_budget_usd, monthly_budget_usd, daily_budget_eur,
      budget_exceeded_action, config_version, created_by, updated_by, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,NOW()
    )
    ON CONFLICT (workspace_id) DO UPDATE SET
      scope = EXCLUDED.scope,
      primary_model = EXCLUDED.primary_model,
      reasoning_model = EXCLUDED.reasoning_model,
      triage_model = EXCLUDED.triage_model,
      model_mode = EXCLUDED.model_mode,
      fallback_models = EXCLUDED.fallback_models,
      provider_priority = EXCLUDED.provider_priority,
      feature_routing_json = EXCLUDED.feature_routing_json,
      endpoint_url = EXCLUDED.endpoint_url,
      pii_enabled = EXCLUDED.pii_enabled,
      auto_escalation_enabled = EXCLUDED.auto_escalation_enabled,
      audit_enabled = EXCLUDED.audit_enabled,
      config_locked = EXCLUDED.config_locked,
      reasoning_level = EXCLUDED.reasoning_level,
      content_filtering_enabled = EXCLUDED.content_filtering_enabled,
      prompt_logging_enabled = EXCLUDED.prompt_logging_enabled,
      data_residency = EXCLUDED.data_residency,
      corporate_policies_json = EXCLUDED.corporate_policies_json,
      trust_level = EXCLUDED.trust_level,
      data_residency_policy_json = EXCLUDED.data_residency_policy_json,
      confidence_thresholds_json = EXCLUDED.confidence_thresholds_json,
      memory_policy_json = EXCLUDED.memory_policy_json,
      feature_personas_json = EXCLUDED.feature_personas_json,
      persona_skills_json = EXCLUDED.persona_skills_json,
      kill_switch_json = EXCLUDED.kill_switch_json,
      daily_budget_usd = EXCLUDED.daily_budget_usd,
      monthly_budget_usd = EXCLUDED.monthly_budget_usd,
      daily_budget_eur = EXCLUDED.daily_budget_eur,
      budget_exceeded_action = EXCLUDED.budget_exceeded_action,
      config_version = EXCLUDED.config_version,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()`,
    configInsertParams(merged, updatedBy),
  );

  if (!options?.skipVersion) {
    await saveConfigVersion(workspaceId, merged, updatedBy);
  }

  return getOrchestratorConfig(workspaceId);
}

export async function saveConfigVersion(
  workspaceId: string,
  config: AiOrchestratorConfig,
  createdBy: string,
): Promise<void> {
  await queryDb(
    `INSERT INTO ai_orchestrator_versions (workspace_id, version_number, config_json, created_by)
     VALUES ($1, $2, $3, $4)`,
    [workspaceId, config.configVersion, JSON.stringify(config), createdBy],
  );
}

export async function listConfigVersions(
  workspaceId = 'default',
  limit = 20,
): Promise<AiOrchestratorVersion[]> {
  const res = await queryDb(
    `SELECT id, version_number, config_json, created_by, created_at
     FROM ai_orchestrator_versions
     WHERE workspace_id = $1
     ORDER BY version_number DESC
     LIMIT $2`,
    [workspaceId, limit],
  );
  return res.rows.map((row) => ({
    id: String(row.id),
    versionNumber: Number(row.version_number),
    createdBy: row.created_by ? String(row.created_by) : undefined,
    createdAt: new Date(row.created_at).toISOString(),
    config: parseJson<AiOrchestratorConfig>(row.config_json, DEFAULT_ORCHESTRATOR_CONFIG),
  }));
}

export async function restoreConfigVersion(
  workspaceId: string,
  versionId: string,
  restoredBy: string,
): Promise<AiOrchestratorConfig> {
  const res = await queryDb(
    'SELECT config_json FROM ai_orchestrator_versions WHERE id = $1 AND workspace_id = $2',
    [versionId, workspaceId],
  );
  if (!res.rows[0]) throw new Error('Version not found');
  const snapshot = parseJson<AiOrchestratorConfig>(res.rows[0].config_json, DEFAULT_ORCHESTRATOR_CONFIG);
  await appendOrchestratorAudit({
    workspaceId,
    userEmail: restoredBy,
    action: `Restored configuration version ${snapshot.configVersion}`,
    fieldName: 'configVersion',
    newValue: String(snapshot.configVersion),
  });
  return upsertOrchestratorConfig({ ...snapshot, workspaceId }, restoredBy);
}

export async function logAiUsage(entry: {
  workspaceId?: string;
  module: string;
  feature: string;
  model: string;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  success?: boolean;
}): Promise<void> {
  await queryDb(
    `INSERT INTO ai_usage_log
     (workspace_id, module, feature, model, latency_ms, prompt_tokens, completion_tokens, cost_usd, success)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      entry.workspaceId ?? 'default',
      entry.module,
      entry.feature,
      entry.model,
      entry.latencyMs ?? 0,
      entry.promptTokens ?? 0,
      entry.completionTokens ?? 0,
      entry.costUsd ?? 0,
      entry.success !== false,
    ],
  );
}

export async function getUsageCostTotals(workspaceId = 'default'): Promise<{ today: number; month: number }> {
  const res = await queryDb(
    `SELECT
       COALESCE(SUM(CASE WHEN created_at >= date_trunc('day', NOW()) THEN cost_usd ELSE 0 END), 0) AS today,
       COALESCE(SUM(CASE WHEN created_at >= date_trunc('month', NOW()) THEN cost_usd ELSE 0 END), 0) AS month
     FROM ai_usage_log WHERE workspace_id = $1`,
    [workspaceId],
  );
  return {
    today: Number(res.rows[0]?.today ?? 0),
    month: Number(res.rows[0]?.month ?? 0),
  };
}

export async function setProviderSecret(
  provider: string,
  secret: string,
  updatedBy: string,
  workspaceId = 'default',
): Promise<void> {
  const encrypted = encryptSecret(secret);
  await queryDb(
    `INSERT INTO ai_orchestrator_secrets (workspace_id, provider, secret_encrypted, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (workspace_id, provider) DO UPDATE SET
       secret_encrypted = EXCLUDED.secret_encrypted,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [workspaceId, provider, encrypted, updatedBy],
  );
}

export async function getProviderSecret(
  provider: string,
  workspaceId = 'default',
): Promise<string | null> {
  const res = await queryDb(
    'SELECT secret_encrypted FROM ai_orchestrator_secrets WHERE workspace_id = $1 AND provider = $2',
    [workspaceId, provider],
  );
  if (!res.rows[0]?.secret_encrypted) return null;
  try {
    return decryptSecret(res.rows[0].secret_encrypted);
  } catch {
    return null;
  }
}

export async function listProviderSecretStatus(workspaceId = 'default'): Promise<Record<string, boolean>> {
  const res = await queryDb(
    'SELECT provider FROM ai_orchestrator_secrets WHERE workspace_id = $1',
    [workspaceId],
  );
  const map: Record<string, boolean> = {};
  for (const row of res.rows) {
    map[String(row.provider)] = true;
  }
  return map;
}

export async function appendOrchestratorAudit(entry: {
  workspaceId?: string;
  userId?: string;
  userEmail?: string;
  action: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
}): Promise<void> {
  await queryDb(
    `INSERT INTO ai_orchestrator_audit
     (workspace_id, user_id, user_email, action, field_name, old_value, new_value)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      entry.workspaceId ?? 'default',
      entry.userId ?? null,
      entry.userEmail ?? null,
      entry.action,
      entry.fieldName ?? null,
      entry.oldValue ?? null,
      entry.newValue ?? null,
    ],
  );
}

export async function getOrchestratorAudit(
  workspaceId = 'default',
  limit = 50,
): Promise<AiOrchestratorAuditEntry[]> {
  const res = await queryDb(
    `SELECT id, user_email, action, field_name, old_value, new_value, created_at
     FROM ai_orchestrator_audit
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [workspaceId, limit],
  );
  return res.rows.map((row) => ({
    id: String(row.id),
    userEmail: row.user_email ? String(row.user_email) : undefined,
    action: String(row.action),
    fieldName: row.field_name ? String(row.field_name) : undefined,
    oldValue: row.old_value ? String(row.old_value) : undefined,
    newValue: row.new_value ? String(row.new_value) : undefined,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function enqueueApprovalRequest(entry: {
  workspaceId?: string;
  requestId: string;
  feature: AiFeatureId;
  approvalRole: 'manager' | 'engineer';
  prompt: string;
  requestedBy?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const promptHash = crypto.createHash('sha256').update(entry.prompt).digest('hex');
  const res = await queryDb(
    `INSERT INTO ai_approval_queue
     (workspace_id, request_id, feature, approval_role, prompt_hash, payload_json, requested_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id`,
    [
      entry.workspaceId ?? 'default',
      entry.requestId,
      entry.feature,
      entry.approvalRole,
      promptHash,
      JSON.stringify({ prompt: entry.prompt, metadata: entry.metadata ?? {} }),
      entry.requestedBy ?? null,
    ],
  );
  return String(res.rows[0].id);
}

export async function listPendingApprovals(
  workspaceId = 'default',
  limit = 50,
): Promise<AiApprovalQueueEntry[]> {
  const res = await queryDb(
    `SELECT id, request_id, workspace_id, feature, approval_role, status, requested_by, approved_by, created_at, resolved_at
     FROM ai_approval_queue
     WHERE workspace_id = $1 AND status = 'pending'
     ORDER BY created_at ASC
     LIMIT $2`,
    [workspaceId, limit],
  );
  return res.rows.map((row) => ({
    id: String(row.id),
    requestId: String(row.request_id),
    workspaceId: String(row.workspace_id),
    feature: row.feature as AiFeatureId,
    approvalRole: row.approval_role as 'manager' | 'engineer',
    status: row.status as AiApprovalQueueEntry['status'],
    requestedBy: row.requested_by ? String(row.requested_by) : undefined,
    approvedBy: row.approved_by ? String(row.approved_by) : undefined,
    createdAt: new Date(row.created_at).toISOString(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : undefined,
  }));
}

export async function resolveApprovalRequest(
  approvalId: string,
  decision: 'approved' | 'rejected',
  approvedBy: string,
  workspaceId = 'default',
): Promise<AiApprovalQueueEntry | null> {
  const res = await queryDb(
    `UPDATE ai_approval_queue
     SET status = $1, approved_by = $2, resolved_at = NOW()
     WHERE id = $3 AND workspace_id = $4
     RETURNING id, request_id, workspace_id, feature, approval_role, status, requested_by, approved_by, created_at, resolved_at`,
    [decision, approvedBy, approvalId, workspaceId],
  );
  if (!res.rows[0]) return null;
  const row = res.rows[0];
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    workspaceId: String(row.workspace_id),
    feature: row.feature as AiFeatureId,
    approvalRole: row.approval_role as 'manager' | 'engineer',
    status: row.status as AiApprovalQueueEntry['status'],
    requestedBy: row.requested_by ? String(row.requested_by) : undefined,
    approvedBy: row.approved_by ? String(row.approved_by) : undefined,
    createdAt: new Date(row.created_at).toISOString(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : undefined,
  };
}

export async function getApprovalEntry(
  approvalId: string,
  workspaceId = 'default',
): Promise<AiApprovalQueueEntry | null> {
  const res = await queryDb(
    `SELECT id, request_id, workspace_id, feature, approval_role, status, requested_by, approved_by, created_at, resolved_at
     FROM ai_approval_queue
     WHERE id = $1 AND workspace_id = $2`,
    [approvalId, workspaceId],
  );
  if (!res.rows[0]) return null;
  const row = res.rows[0];
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    workspaceId: String(row.workspace_id),
    feature: row.feature as AiFeatureId,
    approvalRole: row.approval_role as 'manager' | 'engineer',
    status: row.status as AiApprovalQueueEntry['status'],
    requestedBy: row.requested_by ? String(row.requested_by) : undefined,
    approvedBy: row.approved_by ? String(row.approved_by) : undefined,
    createdAt: new Date(row.created_at).toISOString(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : undefined,
  };
}

export async function getApprovalPayload(
  approvalId: string,
  workspaceId = 'default',
): Promise<{ prompt: string; metadata: Record<string, unknown> } | null> {
  const res = await queryDb(
    'SELECT payload_json FROM ai_approval_queue WHERE id = $1 AND workspace_id = $2',
    [approvalId, workspaceId],
  );
  if (!res.rows[0]?.payload_json) return null;
  const payload = parseJson<{ prompt?: string; metadata?: Record<string, unknown> }>(res.rows[0].payload_json, {});
  return { prompt: payload.prompt ?? '', metadata: payload.metadata ?? {} };
}

export async function enqueueHumanReview(entry: {
  workspaceId?: string;
  requestId: string;
  feature: AiFeatureId;
  confidence: number;
  threshold: number;
  outputText?: string;
}): Promise<string> {
  const res = await queryDb(
    `INSERT INTO ai_human_review_pool
     (workspace_id, request_id, feature, confidence, threshold, output_text)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id`,
    [
      entry.workspaceId ?? 'default',
      entry.requestId,
      entry.feature,
      entry.confidence,
      entry.threshold,
      entry.outputText ?? null,
    ],
  );
  return String(res.rows[0].id);
}

export async function listHumanReviewPool(
  workspaceId = 'default',
  limit = 50,
): Promise<AiHumanReviewEntry[]> {
  const res = await queryDb(
    `SELECT id, request_id, workspace_id, feature, confidence, threshold, output_text, status, created_at
     FROM ai_human_review_pool
     WHERE workspace_id = $1 AND status = 'pending'
     ORDER BY created_at ASC
     LIMIT $2`,
    [workspaceId, limit],
  );
  return res.rows.map((row) => ({
    id: String(row.id),
    requestId: String(row.request_id),
    workspaceId: String(row.workspace_id),
    feature: row.feature as AiFeatureId,
    confidence: Number(row.confidence),
    threshold: Number(row.threshold),
    outputText: row.output_text ? String(row.output_text) : undefined,
    status: row.status as AiHumanReviewEntry['status'],
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function saveExplainabilityLog(entry: {
  workspaceId?: string;
  requestId: string;
  feature: AiFeatureId;
  modelChosen: string;
  modelChoiceReason: string;
  policiesChecked: string[];
  costUsd: number;
  latencyMs: number;
  logLine: string;
}): Promise<void> {
  await queryDb(
    `INSERT INTO ai_explainability_log
     (workspace_id, request_id, feature, model_chosen, model_choice_reason, policies_checked, cost_usd, latency_ms, log_line)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      entry.workspaceId ?? 'default',
      entry.requestId,
      entry.feature,
      entry.modelChosen,
      entry.modelChoiceReason,
      JSON.stringify(entry.policiesChecked),
      entry.costUsd,
      entry.latencyMs,
      entry.logLine,
    ],
  );
  console.info(entry.logLine);
}

export async function listExplainabilityLogs(
  workspaceId = 'default',
  limit = 50,
): Promise<Array<AiExplainabilityEntry & { id: string; createdAt: string }>> {
  const res = await queryDb(
    `SELECT id, request_id, feature, model_chosen, model_choice_reason, policies_checked, cost_usd, latency_ms, log_line, created_at
     FROM ai_explainability_log
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [workspaceId, limit],
  );
  return res.rows.map((row) => ({
    id: String(row.id),
    requestId: String(row.request_id),
    feature: row.feature as AiFeatureId,
    modelChosen: String(row.model_chosen ?? ''),
    modelChoiceReason: String(row.model_choice_reason ?? ''),
    policiesChecked: parseJson<string[]>(row.policies_checked, []),
    costUsd: Number(row.cost_usd ?? 0),
    latencyMs: Number(row.latency_ms ?? 0),
    logLine: String(row.log_line ?? ''),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}
