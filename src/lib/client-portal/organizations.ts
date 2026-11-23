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
  created_at: string;
  updated_at: string;
}

export interface OrganizationInput {
  name: string;
  slug?: string | null;
  domain?: string | null;
  is_active?: boolean;
  settings?: Record<string, unknown>;
}

function slugify(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `org-${randomUUID().slice(0, 8)}`;
}

function mapRow(row: any): OrganizationRecord {
  const settings =
    row.settings == null
      ? {}
      : typeof row.settings === 'string'
        ? (JSON.parse(row.settings) as Record<string, unknown>)
        : (row.settings as Record<string, unknown>);
  return {
    id: String(row.id),
    name: String(row.name || ''),
    slug: String(row.slug || ''),
    domain: row.domain == null || row.domain === '' ? null : String(row.domain),
    is_active: row.is_active !== false && row.is_active !== 'f',
    settings: settings || {},
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

export async function createOrganization(input: OrganizationInput): Promise<OrganizationRecord> {
  const id = randomUUID();
  const name = String(input.name || '').trim();
  if (!name) throw new Error('Organization name is required.');
  const slug = slugify(input.slug || name);
  const domain = input.domain ? String(input.domain).trim().toLowerCase() : null;
  const settings = input.settings && typeof input.settings === 'object' ? input.settings : {};
  const isActive = input.is_active !== false;

  const res = await queryDb(
    `INSERT INTO organizations (id, name, slug, domain, is_active, settings)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING *`,
    [id, name, slug, domain, isActive, JSON.stringify(settings)],
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

  const res = await queryDb(
    `UPDATE organizations
        SET name = $2,
            slug = $3,
            domain = $4,
            is_active = $5,
            settings = $6::jsonb,
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [id, name, slug, domain, isActive, JSON.stringify(settings)],
  );
  if (!res.rowCount) return null;
  return mapRow(res.rows[0]);
}
