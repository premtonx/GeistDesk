import crypto from 'crypto';
import { queryDb } from './postgres-backend.js';
import {
  DEFAULT_PROMPT_BODIES,
  PROMPT_LIBRARY_FEATURES,
  shouldMigratePromptToGermanBaseline,
  type AiPromptLibraryFeature,
  type AiPromptTemplate,
  type AiPromptVersion,
} from '../types/ai-orchestrator';

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

async function ensureTemplate(workspaceId: string, feature: AiPromptLibraryFeature): Promise<AiPromptTemplate> {
  const existing = await queryDb(
    'SELECT * FROM ai_prompt_templates WHERE workspace_id = $1 AND feature = $2 LIMIT 1',
    [workspaceId, feature],
  );
  if (existing.rows[0]) {
    const row = existing.rows[0];
    const body = String(row.body);
    const germanBody = DEFAULT_PROMPT_BODIES[feature];

    if (shouldMigratePromptToGermanBaseline(body, feature) && body.trim() !== germanBody.trim()) {
      const nextVersion = Number(row.current_version ?? 1) + 1;
      await queryDb(
        `UPDATE ai_prompt_templates
         SET body = $1, current_version = $2, updated_by = 'system', updated_at = NOW()
         WHERE id = $3`,
        [germanBody, nextVersion, row.id],
      );
      await queryDb(
        `INSERT INTO ai_prompt_versions (template_id, feature, version_number, body, change_note, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [row.id, feature, nextVersion, germanBody, 'Deutsche Baseline-Lokalisierung', 'system'],
      );
      return {
        id: String(row.id),
        workspaceId: String(row.workspace_id),
        feature: row.feature as AiPromptLibraryFeature,
        name: String(row.name),
        currentVersion: nextVersion,
        body: germanBody,
        updatedAt: new Date().toISOString(),
        updatedBy: 'system',
      };
    }

    return {
      id: String(row.id),
      workspaceId: String(row.workspace_id),
      feature: row.feature as AiPromptLibraryFeature,
      name: String(row.name),
      currentVersion: Number(row.current_version ?? 1),
      body,
      updatedAt: new Date(row.updated_at).toISOString(),
      updatedBy: row.updated_by ? String(row.updated_by) : undefined,
    };
  }

  const body = DEFAULT_PROMPT_BODIES[feature];
  const res = await queryDb(
    `INSERT INTO ai_prompt_templates (workspace_id, feature, name, current_version, body, updated_by, updated_at)
     VALUES ($1, $2, $3, 1, $4, 'system', NOW())
     RETURNING *`,
    [workspaceId, feature, feature.replace(/_/g, ' '), body],
  );
  const row = res.rows[0];
  await queryDb(
    `INSERT INTO ai_prompt_versions (template_id, feature, version_number, body, change_note, created_by)
     VALUES ($1, $2, 1, $3, 'Initial template', 'system')`,
    [row.id, feature, body],
  );
  return {
    id: String(row.id),
    workspaceId,
    feature,
    name: String(row.name),
    currentVersion: 1,
    body,
    updatedAt: new Date(row.updated_at).toISOString(),
    updatedBy: 'system',
  };
}

export async function listPromptTemplates(workspaceId = 'default'): Promise<AiPromptTemplate[]> {
  await Promise.all(PROMPT_LIBRARY_FEATURES.map((f) => ensureTemplate(workspaceId, f)));
  const res = await queryDb(
    'SELECT * FROM ai_prompt_templates WHERE workspace_id = $1 ORDER BY feature ASC',
    [workspaceId],
  );
  return res.rows.map((row) => ({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    feature: row.feature as AiPromptLibraryFeature,
    name: String(row.name),
    currentVersion: Number(row.current_version ?? 1),
    body: String(row.body),
    updatedAt: new Date(row.updated_at).toISOString(),
    updatedBy: row.updated_by ? String(row.updated_by) : undefined,
  }));
}

export async function listPromptVersions(
  feature: AiPromptLibraryFeature,
  workspaceId = 'default',
): Promise<AiPromptVersion[]> {
  const template = await ensureTemplate(workspaceId, feature);
  const res = await queryDb(
    `SELECT id, template_id, feature, version_number, body, change_note, created_by, created_at
     FROM ai_prompt_versions
     WHERE template_id = $1
     ORDER BY version_number DESC`,
    [template.id],
  );
  return res.rows.map((row) => ({
    id: String(row.id),
    templateId: String(row.template_id),
    feature: row.feature as AiPromptLibraryFeature,
    versionNumber: Number(row.version_number),
    body: String(row.body),
    createdBy: row.created_by ? String(row.created_by) : undefined,
    createdAt: new Date(row.created_at).toISOString(),
    changeNote: row.change_note ? String(row.change_note) : undefined,
  }));
}

export async function savePromptVersion(
  feature: AiPromptLibraryFeature,
  body: string,
  updatedBy: string,
  workspaceId = 'default',
  changeNote?: string,
): Promise<AiPromptTemplate> {
  const template = await ensureTemplate(workspaceId, feature);
  const nextVersion = template.currentVersion + 1;

  await queryDb(
    `INSERT INTO ai_prompt_versions (template_id, feature, version_number, body, change_note, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [template.id, feature, nextVersion, body, changeNote ?? `Version ${nextVersion}`, updatedBy],
  );

  await queryDb(
    `UPDATE ai_prompt_templates
     SET body = $1, current_version = $2, updated_by = $3, updated_at = NOW()
     WHERE id = $4`,
    [body, nextVersion, updatedBy, template.id],
  );

  return (await listPromptTemplates(workspaceId)).find((t) => t.feature === feature)!;
}

export async function rollbackPromptVersion(
  feature: AiPromptLibraryFeature,
  versionId: string,
  restoredBy: string,
  workspaceId = 'default',
): Promise<AiPromptTemplate> {
  const template = await ensureTemplate(workspaceId, feature);
  const versionRes = await queryDb(
    'SELECT body, version_number FROM ai_prompt_versions WHERE id = $1 AND template_id = $2',
    [versionId, template.id],
  );
  if (!versionRes.rows[0]) throw new Error('Prompt version not found');

  const body = String(versionRes.rows[0].body);
  const rolledFrom = Number(versionRes.rows[0].version_number);
  const nextVersion = template.currentVersion + 1;

  await queryDb(
    `INSERT INTO ai_prompt_versions (template_id, feature, version_number, body, change_note, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [template.id, feature, nextVersion, body, `Rollback to v${rolledFrom}`, restoredBy],
  );

  await queryDb(
    `UPDATE ai_prompt_templates
     SET body = $1, current_version = $2, updated_by = $3, updated_at = NOW()
     WHERE id = $4`,
    [body, nextVersion, restoredBy, template.id],
  );

  return (await listPromptTemplates(workspaceId)).find((t) => t.feature === feature)!;
}
