/**
 * Shared helpers for CLIENT_ADMIN / SYSTEM_ADMIN portal team management.
 */

import { randomBytes } from 'crypto';
import {
  addDocDirect,
  getDocDirect,
  getDocsDirect,
  setDocDirect,
  updateDocDirect,
} from '../postgres-backend.js';
import { hashPassword } from '../crypto.js';
import { CLIENT_PORTAL_ROLE_SEEDS, isClientPortalRole } from './roles.js';
import { getOrganization } from './organizations.js';

export const CLIENT_TEAM_ROLES = ['CLIENT_ADMIN', 'CLIENT_SUPPORTER', 'CLIENT_USER'] as const;
export type ClientTeamRole = (typeof CLIENT_TEAM_ROLES)[number];

export interface TeamMemberView {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
  organizationId: string | null;
}

export function isClientTeamRole(role: string | null | undefined): role is ClientTeamRole {
  return CLIENT_TEAM_ROLES.includes(String(role || '').trim() as ClientTeamRole);
}

export function userOrganizationId(user: Record<string, unknown> | null | undefined): string | null {
  if (!user) return null;
  const raw =
    (typeof user.organizationId === 'string' && user.organizationId.trim()) ||
    (typeof user.organization_id === 'string' && user.organization_id.trim()) ||
    '';
  return raw || null;
}

export function toTeamMemberView(user: Record<string, unknown> & { id: string }): TeamMemberView {
  return {
    id: user.id,
    name: String(user.name || ''),
    email: String(user.email || ''),
    role: String(user.role || 'CLIENT_USER'),
    isActive: user.isDeactivated !== true,
    lastLoginAt:
      (typeof user.lastActiveAt === 'string' && user.lastActiveAt) ||
      (typeof user.lastLoginAt === 'string' && user.lastLoginAt) ||
      null,
    createdAt: typeof user.createdAt === 'string' ? user.createdAt : null,
    organizationId: userOrganizationId(user),
  };
}

export async function listOrganizationUsers(organizationId: string): Promise<TeamMemberView[]> {
  const users = await getDocsDirect('users', []);
  return users
    .filter((u) => userOrganizationId(u) === organizationId)
    .map((u) => toTeamMemberView(u as any))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export async function countActiveClientAdmins(
  organizationId: string,
  exceptUserId?: string,
): Promise<number> {
  const members = await listOrganizationUsers(organizationId);
  return members.filter(
    (m) =>
      m.role === 'CLIENT_ADMIN' &&
      m.isActive &&
      (!exceptUserId || m.id !== exceptUserId),
  ).length;
}

export async function ensureClientRoleDoc(role: ClientTeamRole): Promise<string> {
  const seed = CLIENT_PORTAL_ROLE_SEEDS.find((r) => r.name === role)!;
  await setDocDirect('roles', seed.id, {
    ...seed,
    updatedAt: new Date().toISOString(),
  });
  return seed.id;
}

export function buildSetupToken(): { token: string; expiresAt: string } {
  return {
    token: `act-${randomBytes(24).toString('hex')}`,
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  };
}

export function buildSetupLink(token: string): string {
  const base =
    (process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.BASE_URL || '').replace(
      /\/$/,
      '',
    ) || '';
  if (!base) return `/login?setup=${encodeURIComponent(token)}`;
  return `${base}/login?setup=${encodeURIComponent(token)}`;
}

/** Best-effort invite / reset email. Never throws. */
export async function sendPortalTeamEmail(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const endpoint = (process.env.MAIL_DISPATCH_URL || '').trim();
  if (!endpoint) {
    return { sent: false, reason: 'MAIL_DISPATCH_URL not configured' };
  }
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: params.to,
        subject: params.subject,
        body: params.body,
        from: process.env.MAIL_FROM_ADDRESS || process.env.SMTP_FROM || undefined,
        autoSubmitted: 'no',
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { sent: false, reason: `dispatch ${res.status}: ${detail.slice(0, 160)}` };
    }
    return { sent: true };
  } catch (err: any) {
    return { sent: false, reason: err?.message || 'dispatch failed' };
  }
}

export async function createOrInviteTeamMember(params: {
  organizationId: string;
  name: string;
  email: string;
  role: ClientTeamRole;
  invitedBy: string;
}): Promise<{
  member: TeamMemberView;
  setupToken: string;
  setupLink: string;
  temporaryPassword: string;
  emailSent: boolean;
  emailReason?: string;
  created: boolean;
}> {
  const org = await getOrganization(params.organizationId);
  if (!org || !org.is_active) {
    throw Object.assign(new Error('Organization is inactive or missing.'), { status: 400 });
  }

  const roleId = await ensureClientRoleDoc(params.role);
  const email = params.email.toLowerCase().trim();
  const existing = await getDocsDirect('users', [
    { type: 'where', field: 'email', op: '==', value: email },
  ]);

  const { token, expiresAt } = buildSetupToken();
  const temporaryPassword = randomBytes(12).toString('base64url');
  const passwordHash = await hashPassword(temporaryPassword);
  const setupLink = buildSetupLink(token);
  const now = new Date().toISOString();

  let userId: string;
  let created = false;

  if (existing.length > 0) {
    const user = existing[0];
    const existingOrg = userOrganizationId(user);
    if (existingOrg && existingOrg !== params.organizationId) {
      throw Object.assign(new Error('User already belongs to another organization.'), {
        status: 409,
      });
    }
    if (user.role && !isClientPortalRole(user.role) && user.role !== 'customer') {
      throw Object.assign(
        new Error('Cannot convert a Hubcom staff account into a client member.'),
        { status: 409 },
      );
    }
    await updateDocDirect('users', user.id, {
      name: params.name,
      role: params.role,
      roleId,
      organizationId: params.organizationId,
      organization_id: params.organizationId,
      is_admin: false,
      isDeactivated: false,
      can_create_tickets: true,
      can_view_knowledgebase: params.role !== 'CLIENT_USER',
      authMethod: user.authMethod || 'password',
      password: passwordHash,
      activationToken: token,
      activationTokenExpires: expiresAt,
      invitedBy: params.invitedBy,
      updatedAt: now,
    });
    userId = user.id;
  } else {
    const createdDoc = await addDocDirect('users', {
      name: params.name,
      email,
      role: params.role,
      roleId,
      organizationId: params.organizationId,
      organization_id: params.organizationId,
      is_admin: false,
      isDeactivated: false,
      can_create_tickets: true,
      can_view_knowledgebase: params.role !== 'CLIENT_USER',
      authMethod: 'password',
      password: passwordHash,
      activationToken: token,
      activationTokenExpires: expiresAt,
      invitedBy: params.invitedBy,
      createdAt: now,
      updatedAt: now,
    });
    userId = createdDoc.id;
    created = true;
  }

  const mail = await sendPortalTeamEmail({
    to: email,
    subject: `Einladung zum Hubcom Kunden-Portal (${org.name})`,
    body: [
      `Hallo ${params.name},`,
      '',
      `Sie wurden zum Kunden-Portal von ${org.name} eingeladen.`,
      `Rolle: ${params.role}`,
      '',
      `Einrichtungslink (48 Stunden gültig):`,
      setupLink,
      '',
      `Temporäres Passwort: ${temporaryPassword}`,
      '',
      'Bitte melden Sie sich an und ändern Sie Ihr Passwort.',
    ].join('\n'),
  });

  const memberDoc = await getDocDirect('users', userId);
  return {
    member: toTeamMemberView({ id: userId, ...(memberDoc || {}) }),
    setupToken: token,
    setupLink,
    temporaryPassword,
    emailSent: mail.sent,
    emailReason: mail.reason,
    created,
  };
}

export async function resetTeamMemberPassword(params: {
  organizationId: string;
  userId: string;
  requestedBy: string;
}): Promise<{
  member: TeamMemberView;
  setupToken: string;
  setupLink: string;
  temporaryPassword: string;
  emailSent: boolean;
  emailReason?: string;
}> {
  const user = await getDocDirect('users', params.userId);
  if (!user) {
    throw Object.assign(new Error('User not found.'), { status: 404 });
  }
  if (userOrganizationId(user) !== params.organizationId) {
    throw Object.assign(new Error('User not found.'), { status: 404 });
  }
  if (!isClientPortalRole(user.role)) {
    throw Object.assign(new Error('Only client portal workers can be reset here.'), {
      status: 403,
    });
  }

  const { token, expiresAt } = buildSetupToken();
  const temporaryPassword = randomBytes(12).toString('base64url');
  const passwordHash = await hashPassword(temporaryPassword);
  const setupLink = buildSetupLink(token);
  const now = new Date().toISOString();

  await updateDocDirect('users', params.userId, {
    password: passwordHash,
    activationToken: token,
    activationTokenExpires: expiresAt,
    passwordResetBy: params.requestedBy,
    passwordResetAt: now,
    updatedAt: now,
  });

  const org = await getOrganization(params.organizationId);
  const mail = await sendPortalTeamEmail({
    to: String(user.email || ''),
    subject: `Passwort-Reset — Hubcom Kunden-Portal`,
    body: [
      `Hallo ${user.name || ''},`,
      '',
      `Für Ihr Konto bei ${org?.name || 'Ihrer Organisation'} wurde ein Passwort-Reset ausgelöst.`,
      '',
      `Einrichtungslink (48 Stunden gültig):`,
      setupLink,
      '',
      `Temporäres Passwort: ${temporaryPassword}`,
    ].join('\n'),
  });

  const refreshed = await getDocDirect('users', params.userId);
  return {
    member: toTeamMemberView({ id: params.userId, ...(refreshed || user) }),
    setupToken: token,
    setupLink,
    temporaryPassword,
    emailSent: mail.sent,
    emailReason: mail.reason,
  };
}
