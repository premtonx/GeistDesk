import crypto from 'crypto';
import { queryDb } from './postgres-backend.js';
import {
  DEFAULT_FEATURE_ROUTING,
  DEFAULT_ORCHESTRATOR_CONFIG,
  type AiFeatureRouting,
  type AiOrchestratorAuditEntry,
  type AiOrchestratorConfig,
} from '../types/aiOrchestrator.js';

const SECRET_KEY = process.env.AI_SECRETS_KEY || process.env.JWT_SECRET || 'geistdesk-dev-secrets-key';

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

function rowToConfig(row: Record<string, unknown>): AiOrchestratorConfig {
  const routing =
    typeof row.feature_routing_json === 'string'
      ? JSON.parse(row.feature_routing_json)
      : row.feature_routing_json;
  const fallbacks =
    typeof row.fallback_models === 'string'
      ? JSON.parse(row.fallback_models)
      : row.fallback_models;

  return {
    workspaceId: String(row.workspace_id ?? 'default'),
    scope: (row.scope as AiOrchestratorConfig['scope']) ?? 'workspace',
    primaryModel: String(row.primary_model ?? DEFAULT_ORCHESTRATOR_CONFIG.primaryModel),
    reasoningModel: String(row.reasoning_model ?? DEFAULT_ORCHESTRATOR_CONFIG.reasoningModel),
    triageModel: String(row.triage_model ?? DEFAULT_ORCHESTRATOR_CONFIG.triageModel),
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

async function insertOrchestratorConfig(
  config: AiOrchestratorConfig,
  updatedBy: string,
): Promise<void> {
  await queryDb(
    `INSERT INTO ai_orchestrator_config (
      workspace_id, scope, primary_model, reasoning_model, triage_model,
      fallback_models, feature_routing_json, endpoint_url,
      pii_enabled, auto_escalation_enabled, audit_enabled, config_locked,
      reasoning_level, content_filtering_enabled, prompt_logging_enabled,
      data_residency, created_by, updated_by, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW()
    )
    ON CONFLICT (workspace_id) DO NOTHING`,
    [
      config.workspaceId,
      config.scope,
      config.primaryModel,
      config.reasoningModel,
      config.triageModel,
      JSON.stringify(config.fallbackModels),
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
      updatedBy,
      updatedBy,
    ],
  );
}

export async function upsertOrchestratorConfig(
  config: Partial<AiOrchestratorConfig> & { workspaceId?: string },
  updatedBy: string,
): Promise<AiOrchestratorConfig> {
  const workspaceId = config.workspaceId ?? 'default';
  const existing = await getOrchestratorConfig(workspaceId);
  const merged: AiOrchestratorConfig = { ...existing, ...config, workspaceId };

  await queryDb(
    `INSERT INTO ai_orchestrator_config (
      workspace_id, scope, primary_model, reasoning_model, triage_model,
      fallback_models, feature_routing_json, endpoint_url,
      pii_enabled, auto_escalation_enabled, audit_enabled, config_locked,
      reasoning_level, content_filtering_enabled, prompt_logging_enabled,
      data_residency, created_by, updated_by, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW()
    )
    ON CONFLICT (workspace_id) DO UPDATE SET
      scope = EXCLUDED.scope,
      primary_model = EXCLUDED.primary_model,
      reasoning_model = EXCLUDED.reasoning_model,
      triage_model = EXCLUDED.triage_model,
      fallback_models = EXCLUDED.fallback_models,
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
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()`,
    [
      workspaceId,
      merged.scope,
      merged.primaryModel,
      merged.reasoningModel,
      merged.triageModel,
      JSON.stringify(merged.fallbackModels),
      JSON.stringify(merged.featureRouting),
      merged.endpointUrl,
      merged.piiEnabled,
      merged.autoEscalationEnabled,
      merged.auditEnabled,
      merged.configLocked,
      merged.reasoningLevel,
      merged.contentFilteringEnabled,
      merged.promptLoggingEnabled,
      merged.dataResidency,
      updatedBy,
      updatedBy,
    ],
  );

  return getOrchestratorConfig(workspaceId);
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
