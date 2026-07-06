import type { User, UserRole } from '../types';

/** Beta-stage auto-admin — disabled by default; set VITE_BETA_AUTO_ADMIN=true to enable. */
export function isBetaAutoAdminEnabled(): boolean {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return env?.VITE_BETA_AUTO_ADMIN === 'true';
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

/** Offline / timeout guest session — only when demo mode is explicitly enabled. */
export function buildGuestAdminProfile(authUser: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}): User {
  return {
    id: authUser.uid,
    name: authUser.displayName || 'Guest Administrator',
    email: authUser.email || '',
    avatar: authUser.photoURL || '',
    role: 'admin',
    is_admin: true,
    createdAt: new Date(),
  };
}

export function buildGuestAdminRole(): UserRole {
  return {
    id: 'guest-admin',
    name: 'admin',
    isSystem: true,
    description: 'Guest administrator offline fallback',
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

export function applyGuestAdminSession(authUser: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}) {
  if (!isBetaAutoAdminEnabled()) {
    return null;
  }
  const profile = buildGuestAdminProfile(authUser);
  const role = buildGuestAdminRole();
  persistBetaAdminSession(profile, role);
  return { profile, role };
}

/** Stale agent-only guest cache from a prior session must not block admin routes. */
export function isStaleGuestAgentCache(profile: User | null, role: UserRole | null): boolean {
  if (!profile || !role) return false;
  if (profile.is_admin === true || profile.role === 'admin') return false;
  if (role.name === 'admin' || role.isSystem) return false;
  const guestName = profile.name?.toLowerCase().includes('guest') ?? false;
  const legacyGuestRole = role.id === 'legacy' && role.name === 'agent';
  return guestName || legacyGuestRole;
}

/** Single source of truth for admin route and nav visibility checks. */
export function isSystemAdminSession(
  isAdmin: boolean,
  userProfile: User | null | undefined,
  role: UserRole | null | undefined,
): boolean {
  return (
    isAdmin ||
    userProfile?.role === 'admin' ||
    userProfile?.is_admin === true ||
    role?.name === 'admin' ||
    role?.isSystem === true
  );
}
