/**
 * SQL-backed Client Organizations (Kunden) for the MSP co-managed portal.
 * Distinct from CRM `companies` documents — organizations are portal tenants.
 */

import { randomUUID } from 'crypto';
import { queryDb } from '../postgres-backend.js';

export interface OrganizationRecord {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  is_active: boolean;
  settings: Record<string, unknown>;
  /** Optional Entra ID (Microsoft 365) tenant GUID for client SSO. */
  m365_tenant_id: string | null;
  /** When true, users from m365_tenant_id may sign in via Microsoft SSO. */
  sso_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationInput {
  name: string;
  slug?: string | null;
  domain?: string | null;
  is_active?: boolean;
  settings?: Record<string, unknown>;
  m365_tenant_id?: string | null;
  sso_enabled?: boolean;
}

function slugify(input: string): string {
  return (
    String(input || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || `org-${randomUUID().slice(0, 8)}`
  );
}

function mapRow(row: any): OrganizationRecord {
  const settings =
    row.settings == null
      ? {}
      : typeof row.settings === 'string'
        ? (JSON.parse(row.settings) as Record<string, unknown>)
        : (row.settings as Record<string, unknown>);

  // Prefer dedicated columns; fall back to settings JSON for older rows.
  const settingsTenant =
    typeof settings.m365_tenant_id === 'string'
      ? settings.m365_tenant_id
      : typeof settings.m365TenantId === 'string'
        ? settings.m365TenantId
        : null;
  const settingsSso =
    typeof settings.sso_enabled === 'boolean'
      ? settings.sso_enabled
      : typeof settings.ssoEnabled === 'boolean'
        ? settings.ssoEnabled
        : false;

  return {
    id: String(row.id),
    name: String(row.name || ''),
    slug: String(row.slug || ''),
    domain: row.domain == null || row.domain === '' ? null : String(row.domain),
    is_active: row.is_active !== false && row.is_active !== 'f',
    settings: settings || {},
    m365_tenant_id:
      row.m365_tenant_id == null || row.m365_tenant_id === ''
        ? settingsTenant
        : String(row.m365_tenant_id),
    sso_enabled:
      row.sso_enabled === true || row.sso_enabled === 't' || settingsSso === true,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : '',
  };
}

export async function listOrganizations(opts?: {
  includeInactive?: boolean;
}): Promise<OrganizationRecord[]> {
  const sql = opts?.includeInactive
    ? `SELECT * FROM organizations ORDER BY name ASC`
    : `SELECT * FROM organizations WHERE is_active = TRUE ORDER BY name ASC`;
  const res = await queryDb(sql);
  return res.rows.map(mapRow);
}

export async function getOrganization(id: string): Promise<OrganizationRecord | null> {
  const res = await queryDb(`SELECT * FROM organizations WHERE id = $1 LIMIT 1`, [id]);
  if (!res.rowCount) return null;
  return mapRow(res.rows[0]);
}

export async function getOrganizationBySlug(slug: string): Promise<OrganizationRecord | null> {
  const res = await queryDb(`SELECT * FROM organizations WHERE slug = $1 LIMIT 1`, [
    slugify(slug),
  ]);
  if (!res.rowCount) return null;
  return mapRow(res.rows[0]);
}

/** Resolve an SSO-enabled organization by Entra tenant GUID. */
export async function getOrganizationByM365TenantId(
  tenantId: string,
): Promise<OrganizationRecord | null> {
  const tid = String(tenantId || '').trim().toLowerCase();
  if (!tid) return null;
  const res = await queryDb(
    `SELECT * FROM organizations
      WHERE sso_enabled = TRUE
        AND LOWER(TRIM(m365_tenant_id)) = $1
        AND is_active = TRUE
      LIMIT 1`,
    [tid],
  );
  if (res.rowCount) return mapRow(res.rows[0]);

  // Fallback: settings JSON (pre-column deployments)
  const all = await listOrganizations({ includeInactive: false });
  return (
    all.find(
      (o) =>
        o.sso_enabled &&
        o.m365_tenant_id &&
        o.m365_tenant_id.trim().toLowerCase() === tid,
    ) || null
  );
}

export async function createOrganization(input: OrganizationInput): Promise<OrganizationRecord> {
  const id = randomUUID();
  const name = String(input.name || '').trim();
  if (!name) throw new Error('Organization name is required.');
  const slug = slugify(input.slug || name);
  const domain = input.domain ? String(input.domain).trim().toLowerCase() : null;
  const settings = input.settings && typeof input.settings === 'object' ? input.settings : {};
  const isActive = input.is_active !== false;
  const m365TenantId = input.m365_tenant_id
    ? String(input.m365_tenant_id).trim()
    : null;
  const ssoEnabled = Boolean(input.sso_enabled);

  const res = await queryDb(
    `INSERT INTO organizations (id, name, slug, domain, is_active, settings, m365_tenant_id, sso_enabled)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
     RETURNING *`,
    [id, name, slug, domain, isActive, JSON.stringify(settings), m365TenantId, ssoEnabled],
  );
  return mapRow(res.rows[0]);
}

export async function updateOrganization(
  id: string,
  input: Partial<OrganizationInput>,
): Promise<OrganizationRecord | null> {
  const existing = await getOrganization(id);
  if (!existing) return null;

  const name = input.name !== undefined ? String(input.name).trim() : existing.name;
  if (!name) throw new Error('Organization name is required.');
  const slug =
    input.slug !== undefined ? slugify(input.slug || name) : existing.slug;
  const domain =
    input.domain !== undefined
      ? input.domain
        ? String(input.domain).trim().toLowerCase()
        : null
      : existing.domain;
  const isActive =
    input.is_active !== undefined ? Boolean(input.is_active) : existing.is_active;
  const settings =
    input.settings !== undefined && typeof input.settings === 'object'
      ? input.settings
      : existing.settings;
  const m365TenantId =
    input.m365_tenant_id !== undefined
      ? input.m365_tenant_id
        ? String(input.m365_tenant_id).trim()
        : null
      : existing.m365_tenant_id;
  const ssoEnabled =
    input.sso_enabled !== undefined ? Boolean(input.sso_enabled) : existing.sso_enabled;

  const res = await queryDb(
    `UPDATE organizations
        SET name = $2,
            slug = $3,
            domain = $4,
            is_active = $5,
            settings = $6::jsonb,
            m365_tenant_id = $7,
            sso_enabled = $8,
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [id, name, slug, domain, isActive, JSON.stringify(settings), m365TenantId, ssoEnabled],
  );
  if (!res.rowCount) return null;
  return mapRow(res.rows[0]);
}

export async function updateOrganizationSsoSettings(
  id: string,
  input: { m365_tenant_id?: string | null; sso_enabled?: boolean },
): Promise<OrganizationRecord | null> {
  return updateOrganization(id, {
    m365_tenant_id: input.m365_tenant_id,
    sso_enabled: input.sso_enabled,
  });
}
