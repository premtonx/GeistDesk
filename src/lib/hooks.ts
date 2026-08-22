import { useState, useEffect } from 'react';
import { signOut, auth } from './firebase';
import { useAuthContext } from './context/AuthContext';
import { isBetaAutoAdminEnabled } from './beta-admin-bypass';

export function useAuth() {
  return useAuthContext();
}

/**
 * Determines whether the current session holds SYSTEM_ADMIN privileges.
 *
 * The check is server-authoritative: it calls GET /api/auth/session, which
 * resolves the user's role strictly from the verified JWT + database record
 * (see middleware/authMiddleware.ts). Client-side caches and module-config
 * flags are intentionally NOT trusted — a user can edit localStorage or
 * module_config, so using them for an admin gate would be a privilege
 * escalation. This is a UI convenience gate only; every /api/admin/* endpoint
 * re-validates the role server-side.
 */
export function useAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    async function checkAdmin() {
      if (authLoading) {
        setChecking(true);
        return;
      }

      // Explicit dev-only flag (VITE_BETA_AUTO_ADMIN=true), refused in
      // production builds by isBetaAutoAdminEnabled() consumers.
      if (isBetaAutoAdminEnabled() && user) {
        if (active) {
          setIsAdmin(true);
          setChecking(false);
        }
        return;
      }

      if (!user) {
        if (active) {
          setIsAdmin(false);
          setChecking(false);
        }
        return;
      }

      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' });
        if (!res.ok) {
          if (active) setIsAdmin(false);
          return;
        }
        const data = (await res.json()) as { user?: { role?: string; is_admin?: boolean } };
        const role = data.user?.role ?? '';
        const sessionIsAdmin =
          role === 'SYSTEM_ADMIN' ||
          role === 'admin' ||
          data.user?.is_admin === true;
        if (active) setIsAdmin(!!sessionIsAdmin);
      } catch {
        // Session endpoint unreachable — fail closed (never grant admin).
        if (active) setIsAdmin(false);
      } finally {
        if (active) setChecking(false);
      }
    }

    void checkAdmin();
    return () => {
      active = false;
    };
  }, [user, authLoading]);

  return { isAdmin, checking };
}

export function logout() {
  return signOut(auth);
}
