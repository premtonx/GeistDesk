/**
 * MSP Co-Managed Client Portal roles and helpers.
 * Hubcom staff roles remain unchanged; client roles are organization-scoped.
 */

export const CLIENT_ROLES = [
  'CLIENT_ADMIN',
  'CLIENT_SUPPORTER',
  'CLIENT_USER',
] as const;

export type ClientPortalRole = (typeof CLIENT_ROLES)[number];

/** Hubcom internal staff role codes commonly used for RBAC. */
export const HUBCOM_STAFF_ROLES = [
  'SYSTEM_ADMIN',
  'admin',
  'agent',
  'team_lead',
  'TEAM_LEAD',
  'AGENT',
] as const;

export function isClientPortalRole(role: string | null | undefined): role is ClientPortalRole {
  return CLIENT_ROLES.includes(String(role || '').trim() as ClientPortalRole);
}

export function isHubcomStaffRole(role: string | null | undefined): boolean {
  const r = String(role || '').trim();
  if (!r || isClientPortalRole(r)) return false;
  if (r === 'customer' || r === 'CLIENT') return false;
  return true;
}

export function isClientAdmin(role: string | null | undefined): boolean {
  return String(role || '').trim() === 'CLIENT_ADMIN';
}

export function isClientOrgWideTicketRole(role: string | null | undefined): boolean {
  const r = String(role || '').trim();
  return r === 'CLIENT_ADMIN' || r === 'CLIENT_SUPPORTER';
}

/** Seed documents for the roles collection (idempotent upsert by id). */
export const CLIENT_PORTAL_ROLE_SEEDS = [
  {
    id: 'role-client-admin',
    name: 'CLIENT_ADMIN',
    description:
      'Client organization administrator — manages workers, roles, settings, and all organization tickets.',
    isSystem: true,
    is_admin: false,
    can_create_tickets: true,
    can_view_knowledgebase: true,
    visibilityScope: 'all' as const,
    permissions: {
      tickets: { view: true, create: true, edit: true, delete: false, admin: true },
      customers: { view: true, create: false, edit: false, delete: false, admin: false },
      kb: { view: true, create: false, edit: false, delete: false, admin: false },
      rbac: { view: true, create: true, edit: true, delete: false, admin: false },
    },
    specialPermissions: {
      overridePIIShield: false,
      manageModelOrchestrator: false,
      bypass2FA: false,
      aiGovernance: false,
    },
  },
  {
    id: 'role-client-supporter',
    name: 'CLIENT_SUPPORTER',
    description:
      'Client support member — views, creates, replies, adds participants, and closes tickets within their organization.',
    isSystem: true,
    is_admin: false,
    can_create_tickets: true,
    can_view_knowledgebase: true,
    visibilityScope: 'all' as const,
    permissions: {
      tickets: { view: true, create: true, edit: true, delete: false, admin: false },
      customers: { view: true, create: false, edit: false, delete: false, admin: false },
      kb: { view: true, create: false, edit: false, delete: false, admin: false },
      rbac: { view: false, create: false, edit: false, delete: false, admin: false },
    },
    specialPermissions: {
      overridePIIShield: false,
      manageModelOrchestrator: false,
      bypass2FA: false,
      aiGovernance: false,
    },
  },
  {
    id: 'role-client-user',
    name: 'CLIENT_USER',
    description:
      'Client end user — creates tickets and only sees tickets they requested or were added to as a participant.',
    isSystem: true,
    is_admin: false,
    can_create_tickets: true,
    can_view_knowledgebase: false,
    visibilityScope: 'assigned' as const,
    permissions: {
      tickets: { view: true, create: true, edit: true, delete: false, admin: false },
      customers: { view: false, create: false, edit: false, delete: false, admin: false },
      kb: { view: false, create: false, edit: false, delete: false, admin: false },
      rbac: { view: false, create: false, edit: false, delete: false, admin: false },
    },
    specialPermissions: {
      overridePIIShield: false,
      manageModelOrchestrator: false,
      bypass2FA: false,
      aiGovernance: false,
    },
  },
] as const;
