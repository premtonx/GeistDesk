import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User, signOut, getSessionToken } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getModuleConfig } from './module-config';
import { userService } from '../services/userService';
import axios from 'axios';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        // Authenticate downstream requests with the signed session token only.
        const token = getSessionToken();
        if (token) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        userService.syncProfile(u);
      } else {
        delete axios.defaults.headers.common['Authorization'];
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
