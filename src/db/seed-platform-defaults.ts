/**
 * Idempotent seeding of workspace platform defaults into PostgreSQL.
 * Invoked from src/db/seed.ts after users/tickets are upserted.
 */

import type pg from 'pg';
import {
  buildDefaultModuleConfigSeed,
  buildDefaultPersonaSkills,
  buildDefaultPromptTemplates,
} from '../data/platform-defaults.js';
import { purgeSeededVaultFolders } from '../lib/vault-demo-purge.js';

async function batchUpsert(
  client: pg.PoolClient,
  collection: string,
  rows: Array<{ id: string; [key: string]: unknown }>,
): Promise<number> {
  if (rows.length === 0) return 0;

  const valueClauses: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  for (const row of rows) {
    const { id, ...rest } = row;
    valueClauses.push(`($${p++}, $${p++}, $${p++})`);
    params.push(collection, id, rest);
  }

  const sql = `
    INSERT INTO geistdesk_documents (collection, id, data)
    VALUES ${valueClauses.join(', ')}
    ON CONFLICT (collection, id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = NOW()
  `;
  await client.query(sql, params);
  return rows.length;
}

export async function seedModuleConfig(client: pg.PoolClient): Promise<boolean> {
  const existing = await client.query(
    `SELECT data FROM geistdesk_documents WHERE collection = 'module_config' AND id = 'global' LIMIT 1`,
  );
  const now = new Date().toISOString();

  if (existing.rowCount && existing.rowCount > 0) {
    const data = existing.rows[0]?.data;
    const parsed =
      data == null
        ? {}
        : typeof data === 'string'
          ? (JSON.parse(data) as Record<string, unknown>)
          : (data as Record<string, unknown>);
    // Never flip a completed wizard back to false. Only stamp the default
    // when the flag is missing so fresh/legacy seed rows stay uninitialized.
    if (parsed.is_initialized === true && parsed.initializedBy !== 'legacy-migration') {
      return false;
    }
    if (parsed.is_initialized === false) return false;
    await client.query(
      `UPDATE geistdesk_documents
          SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{is_initialized}', 'false'::jsonb, true),
              updated_at = NOW()
        WHERE collection = 'module_config' AND id = 'global'`,
    );
    return true;
  }

  await batchUpsert(client, 'module_config', [
    {
      id: 'global',
      ...buildDefaultModuleConfigSeed(),
      createdAt: now,
      updatedAt: now,
    },
  ]);
  return true;
}

/** Production boots must not invent vault folders. Delete leftover seed rows. */
export async function seedVaultFolders(client: pg.PoolClient): Promise<number> {
  return purgeSeededVaultFolders((sql, params) => client.query(sql, params ?? []));
}

export async function seedPromptTemplates(client: pg.PoolClient): Promise<number> {
  let inserted = 0;
  for (const tpl of buildDefaultPromptTemplates()) {
    const existing = await client.query(
      `SELECT id FROM ai_prompt_templates WHERE workspace_id = 'default' AND feature = $1 LIMIT 1`,
      [tpl.feature],
    );
    if (existing.rowCount && existing.rowCount > 0) continue;

    const res = await client.query(
      `INSERT INTO ai_prompt_templates (workspace_id, feature, name, current_version, body, updated_by, updated_at)
       VALUES ('default', $1, $2, 1, $3, 'system', NOW())
       RETURNING id`,
      [tpl.feature, tpl.name, tpl.body],
    );
    const templateId = res.rows[0]?.id;
    if (templateId) {
      await client.query(
        `INSERT INTO ai_prompt_versions (template_id, feature, version_number, body, change_note, created_by)
         VALUES ($1, $2, 1, $3, 'Deutsche Baseline-Lokalisierung', 'system')`,
        [templateId, tpl.feature, tpl.body],
      );
      inserted += 1;
    }
  }
  return inserted;
}

export async function seedOrchestratorPersonaSkills(client: pg.PoolClient): Promise<boolean> {
  const personaSkills = buildDefaultPersonaSkills();
  const existing = await client.query(
    `SELECT persona_skills_json FROM ai_orchestrator_config WHERE workspace_id = 'default' LIMIT 1`,
  );

  if (!existing.rowCount || existing.rowCount === 0) {
    await client.query(
      `INSERT INTO ai_orchestrator_config (workspace_id, persona_skills_json, created_by, updated_by, updated_at)
       VALUES ('default', $1::jsonb, 'system', 'system', NOW())
       ON CONFLICT (workspace_id) DO NOTHING`,
      [JSON.stringify(personaSkills)],
    );
    return true;
  }

  const current = existing.rows[0]?.persona_skills_json;
  const parsed =
    current == null
      ? {}
      : typeof current === 'string'
        ? (JSON.parse(current) as Record<string, unknown>)
        : (current as Record<string, unknown>);

  const hasAnySkill = Object.values(parsed).some(
    (skill) => skill && typeof skill === 'object' && String((skill as { skillsContent?: string }).skillsContent || '').trim(),
  );
  if (hasAnySkill) return false;

  await client.query(
    `UPDATE ai_orchestrator_config
     SET persona_skills_json = $1::jsonb, updated_by = 'system', updated_at = NOW()
     WHERE workspace_id = 'default'`,
    [JSON.stringify(personaSkills)],
  );
  return true;
}

export async function seedAllPlatformDefaults(client: pg.PoolClient): Promise<{
  moduleConfig: boolean;
  vaultFolders: number;
  promptTemplates: number;
  personaSkills: boolean;
}> {
  const moduleConfig = await seedModuleConfig(client);
  const vaultFolders = await seedVaultFolders(client);
  const promptTemplates = await seedPromptTemplates(client);
  const personaSkills = await seedOrchestratorPersonaSkills(client);
  return { moduleConfig, vaultFolders, promptTemplates, personaSkills };
}
