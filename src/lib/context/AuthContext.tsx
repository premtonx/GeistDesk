import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  auth,
  onAuthStateChanged,
  getSessionToken,
  signOut,
  type User,
} from '../firebase';
import { applySessionAuthHeader } from '../session-auth';
import { applyBetaAdminSession, isBetaAutoAdminEnabled } from '../beta-admin-bypass';
import { userService } from '../../services/userService';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    applySessionAuthHeader();

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
      if (nextUser) {
        const token = getSessionToken();
        if (!token) {
          console.warn('[AuthProvider] Authenticated user without session token; clearing stale session');
          signOut(auth);
          return;
        }
        applySessionAuthHeader();
        if (isBetaAutoAdminEnabled()) {
          applyBetaAdminSession(nextUser);
        }
        userService.syncProfile(nextUser);
      } else {
        applySessionAuthHeader();
      }
    });
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}
