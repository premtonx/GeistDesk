import { useState, useEffect } from 'react';
import {
  db,
  doc,
  getDoc,
} from './firebase';
import { getModuleConfig } from './module-config';
import { signOut, auth } from './firebase';
import { useAuthContext } from './context/AuthContext';
import { isBetaAutoAdminEnabled } from './beta-admin-bypass';

function readCachedAdminSession(): boolean {
  try {
    const savedProfile = localStorage.getItem('geistdesk_cached_user_profile');
    const savedRole = localStorage.getItem('geistdesk_cached_user_role');
    if (!savedProfile) return false;
    const profile = JSON.parse(savedProfile) as { is_admin?: boolean; role?: string };
    const role = savedRole ? JSON.parse(savedRole) as { name?: string; id?: string } : null;
    return (
      profile.is_admin === true ||
      profile.role === 'admin' ||
      role?.name === 'admin' ||
      role?.id === 'guest-admin' ||
      role?.id === 'beta-admin'
    );
  } catch {
    return false;
  }
}

function readCachedAdminSession(): boolean {
  try {
    const savedProfile = localStorage.getItem('geistdesk_cached_user_profile');
    const savedRole = localStorage.getItem('geistdesk_cached_user_role');
    if (!savedProfile) return false;
    const profile = JSON.parse(savedProfile) as { is_admin?: boolean; role?: string };
    const role = savedRole ? JSON.parse(savedRole) as { name?: string; id?: string } : null;
    return (
      profile.is_admin === true ||
      profile.role === 'admin' ||
      role?.name === 'admin' ||
      role?.id === 'guest-admin' ||
      role?.id === 'beta-admin'
    );
  } catch {
    return false;
  }
}

export function useAuth() {
  return useAuthContext();
}

export function useAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      if (authLoading) {
        setChecking(true);
        return;
      }

      if (isBetaAutoAdminEnabled() && user) {
        setIsAdmin(true);
        setChecking(false);
        return;
      }

      const config = getModuleConfig();
      if (config.debugAdminMode) {
        setIsAdmin(true);
        setChecking(false);
        return;
      }

      if (!user) {
        setIsAdmin(false);
        setChecking(false);
        return;
      }

      if (readCachedAdminSession()) {
        setIsAdmin(true);
        setChecking(false);
        return;
      }

      try {
        const [adminSnap, userSnap] = await Promise.all([
          getDoc(doc(db, 'admins', user.uid)),
          getDoc(doc(db, 'users', user.uid)),
        ]);

        const actsAsAdmin =
          adminSnap.exists() ||
          (userSnap.exists() && (userSnap.data()?.is_admin === true || userSnap.data()?.role === 'admin'));

        setIsAdmin(!!actsAsAdmin);
      } catch {
        setIsAdmin(false);
      } finally {
        setChecking(false);
      }
    }
    checkAdmin();
  }, [user, authLoading]);

  return { isAdmin, checking };
}

export function logout() {
  return signOut(auth);
}
