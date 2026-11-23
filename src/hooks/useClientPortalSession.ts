import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/hooks';
import { usePermissions } from './usePermissions';
import {
  isClientPortalRole,
  type ClientPortalRole,
} from '../lib/client-portal/roles';

export interface ClientPortalSession {
  id: string;
  name: string;
  email: string;
  role: ClientPortalRole;
  organizationId: string;
}

/**
 * Resolves whether the signed-in user is a Kunden-Portal (CLIENT_*) account.
 * Prefers GET /api/auth/session (server-computed role + organizationId).
 */
export function useClientPortalSession() {
  const { user, loading: authLoading } = useAuth();
  const { userProfile, role, loading: permLoading } = usePermissions();
  const [session, setSession] = useState<ClientPortalSession | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      if (authLoading) {
        setChecking(true);
        return;
      }
      if (!user) {
        if (active) {
          setSession(null);
          setChecking(false);
        }
        return;
      }

      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' });
        if (!res.ok) {
          if (active) {
            setSession(null);
            setChecking(false);
          }
          return;
        }
        const data = (await res.json()) as {
          user?: {
            id?: string;
            name?: string;
            email?: string;
            role?: string;
            organizationId?: string | null;
            organization_id?: string | null;
          };
        };
        const rawRole = String(data.user?.role || '').trim();
        const organizationId = String(
          data.user?.organizationId || data.user?.organization_id || '',
        ).trim();

        if (active) {
          if (isClientPortalRole(rawRole) && organizationId) {
            setSession({
              id: String(data.user?.id || user.uid),
              name: String(data.user?.name || user.displayName || ''),
              email: String(data.user?.email || user.email || ''),
              role: rawRole,
              organizationId,
            });
          } else {
            // Fallback to cached profile while session shape is incomplete.
            const profileRole = String(userProfile?.role || role?.name || '').trim();
            const profileOrg = String(
              userProfile?.organizationId || userProfile?.organization_id || '',
            ).trim();
            if (isClientPortalRole(profileRole) && profileOrg) {
              setSession({
                id: String(userProfile?.id || user.uid),
                name: String(userProfile?.name || ''),
                email: String(userProfile?.email || user.email || ''),
                role: profileRole,
                organizationId: profileOrg,
              });
            } else {
              setSession(null);
            }
          }
        }
      } catch {
        if (active) setSession(null);
      } finally {
        if (active) setChecking(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [user, authLoading, userProfile, role]);

  const isClient = Boolean(session);
  const isClientAdmin = session?.role === 'CLIENT_ADMIN';
  const isOrgWide = session?.role === 'CLIENT_ADMIN' || session?.role === 'CLIENT_SUPPORTER';

  return useMemo(
    () => ({
      session,
      isClient,
      isClientAdmin,
      isOrgWide,
      loading: authLoading || permLoading || checking,
    }),
    [session, isClient, isClientAdmin, isOrgWide, authLoading, permLoading, checking],
  );
}
