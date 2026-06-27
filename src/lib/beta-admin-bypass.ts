import type { User, UserRole } from '../types';

/** Beta-stage auto-admin: enabled unless explicitly disabled via env. */
export function isBetaAutoAdminEnabled(): boolean {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  if (env?.VITE_BETA_AUTO_ADMIN === 'false') {
    return false;
  }
  return true;
}

export function buildBetaAdminRole(): UserRole {
  return {
    id: 'beta-admin',
    name: 'admin',
    isSystem: true,
    description: 'Beta master administrator auto-override',
    permissions: {},
    specialPermissions: {
      overridePIIShield: true,
      manageModelOrchestrator: true,
      bypass2FA: true,
      aiGovernance: true,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function buildBetaAdminProfile(authUser: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}): User {
  return {
    id: authUser.uid,
    name: authUser.displayName || authUser.email?.split('@')[0] || 'Beta Admin',
    email: authUser.email || '',
    avatar: authUser.photoURL || '',
    role: 'admin',
    is_admin: true,
    createdAt: new Date(),
  };
}

export function persistBetaAdminSession(profile: User, role: UserRole) {
  try {
    localStorage.setItem('geistdesk_cached_user_profile', JSON.stringify(profile));
    localStorage.setItem('geistdesk_cached_user_role', JSON.stringify(role));
  } catch {
    /* ignore storage errors */
  }
}

export function applyBetaAdminSession(authUser: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}) {
  const profile = buildBetaAdminProfile(authUser);
  const role = buildBetaAdminRole();
  persistBetaAdminSession(profile, role);
  return { profile, role };
}
