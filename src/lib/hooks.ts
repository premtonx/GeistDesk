import { useState, useEffect } from 'react';
import {
  auth,
  db,
  onAuthStateChanged,
  getSessionToken,
  signOut,
  doc,
  getDoc,
  type User,
} from './firebase';
import { getModuleConfig } from './module-config';
import { userService } from '../services/userService';
import { applySessionAuthHeader } from './session-auth';
import { applyBetaAdminSession, isBetaAutoAdminEnabled } from './beta-admin-bypass';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    applySessionAuthHeader();

    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        const token = getSessionToken();
        if (!token) {
          console.warn('[useAuth] Authenticated user without session token; clearing stale session');
          signOut(auth);
          return;
        }
        applySessionAuthHeader();
        if (isBetaAutoAdminEnabled()) {
          applyBetaAdminSession(u);
        }
        userService.syncProfile(u);
      } else {
        applySessionAuthHeader();
      }
    });
  }, []);

  return { user, loading };
}

export function useAdmin() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      if (isBetaAutoAdminEnabled() && user) {
        setIsAdmin(true);
        setChecking(false);
        return;
      }

      // Priority 1: Check Local Debug Mode for testing
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
      try {
        // Admin status is derived strictly from the database role; there is no
        // hardcoded email bootstrap.
        const [adminSnap, userSnap] = await Promise.all([
          getDoc(doc(db, 'admins', user.uid)),
          getDoc(doc(db, 'users', user.uid))
        ]);

        const actsAsAdmin = 
          adminSnap.exists() || 
          (userSnap.exists() && (userSnap.data()?.is_admin === true || userSnap.data()?.role === 'admin'));

        setIsAdmin(!!actsAsAdmin);
      } catch (err) {
        setIsAdmin(false);
      } finally {
        setChecking(false);
      }
    }
    checkAdmin();
  }, [user]);

  return { isAdmin, checking };
}

export function logout() {
  return signOut(auth);
}
