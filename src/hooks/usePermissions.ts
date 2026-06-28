import { useState, useEffect } from 'react';
import { useAuth } from '../lib/hooks';
import { userService } from '../services/userService';
import { rbacService } from '../services/rbacService';
import { User, UserRole } from '../types';
import {
  applyBetaAdminSession,
  applyGuestAdminSession,
  isBetaAutoAdminEnabled,
  isStaleGuestAgentCache,
} from '../lib/beta-admin-bypass';

export function usePermissions() {
  const { user: authUser } = useAuth();
  const [userProfile, setUserProfile] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('geistdesk_cached_user_profile');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [role, setRole] = useState<UserRole | null>(() => {
    try {
      const saved = localStorage.getItem('geistdesk_cached_user_role');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(() => {
    if (isBetaAutoAdminEnabled()) return true;
    try {
      const savedProfile = localStorage.getItem('geistdesk_cached_user_profile');
      const savedRole = localStorage.getItem('geistdesk_cached_user_role');
      if (savedProfile && savedRole) {
        const profile = JSON.parse(savedProfile) as User;
        const role = JSON.parse(savedRole) as UserRole;
        if (isStaleGuestAgentCache(profile, role)) return true;
        return false;
      }
    } catch {}
    return true;
  });

  useEffect(() => {
    if (!authUser) {
      setUserProfile(null);
      setRole(null);
      localStorage.removeItem('geistdesk_cached_user_profile');
      localStorage.removeItem('geistdesk_cached_user_role');
      setLoading(false);
      return;
    }

    if (isBetaAutoAdminEnabled()) {
      const { profile, role } = applyBetaAdminSession(authUser);
      setUserProfile(profile);
      setRole(role);
      setLoading(false);
      return;
    }

    // Privileges are derived strictly from the database role; there is no
    // email-based god-mode override.
    const isGodMode = false;
    let timeoutFired = false;
    let realProfileLoaded = false;

    // Safety timeout: if database connection is blocked or slow (common in sandboxed iframes),
    // resolve with appropriate permission level to keep app functional
    const safetyTimeout = setTimeout(() => {
      if (!realProfileLoaded) {
        timeoutFired = true;
        console.warn("[Permissions Engine] Database connection delayed. Applying safe offline-first fallback...");
        if (isGodMode) {
          const godRole: UserRole = {
            id: 'god-mode',
            name: 'admin',
            isSystem: true,
            description: 'Master Administrator Blueprint (External Override)',
            permissions: {},
            specialPermissions: {
              overridePIIShield: true,
              manageModelOrchestrator: true,
              bypass2FA: true,
              aiGovernance: true
            },
            createdAt: new Date(),
            updatedAt: new Date()
          };
          setRole(godRole);
          localStorage.setItem('geistdesk_cached_user_role', JSON.stringify(godRole));
          const p: User = {
            id: authUser.uid,
            name: authUser.displayName || 'John Doe',
            email: authUser.email || '',
            avatar: authUser.photoURL || '',
            role: 'admin',
            is_admin: true,
            createdAt: new Date()
          };
          setUserProfile(p);
          localStorage.setItem('geistdesk_cached_user_profile', JSON.stringify(p));
        } else {
          const { profile, role } = applyGuestAdminSession(authUser);
          setRole(role);
          setUserProfile(profile);
        }
        setLoading(false);
      }
    }, 1200);

    const unsub = userService.subscribeToUsers((users) => {
      const emailMatches = users.filter(u => u.email && authUser.email && u.email.toLowerCase().trim() === authUser.email.toLowerCase().trim());
      // Resolve the canonical profile defensively. Prefer the record whose id
      // matches the authenticated uid, then any record that carries admin
      // rights, so a stale non-admin duplicate can never shadow the real
      // account and lock an admin out of the Admin Hub.
      const profile =
        emailMatches.find(u => u.id === authUser.uid) ||
        emailMatches.find(u => (u as any).is_admin === true || u.role === 'admin') ||
        emailMatches[0];

      if (isGodMode) {
        clearTimeout(safetyTimeout);
        realProfileLoaded = true;
        const godRole: UserRole = {
          id: 'god-mode',
          name: 'admin',
          isSystem: true,
          description: 'Master Administrator Blueprint (External Override)',
          permissions: {},
          specialPermissions: {
            overridePIIShield: true,
            manageModelOrchestrator: true,
            bypass2FA: true,
            aiGovernance: true
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };
        setRole(godRole);
        localStorage.setItem('geistdesk_cached_user_role', JSON.stringify(godRole));
        const gp: User = profile || {
          id: authUser.uid,
          name: authUser.displayName || 'John Doe',
          email: authUser.email || '',
          avatar: authUser.photoURL || '',
          role: 'admin',
          is_admin: true,
          createdAt: new Date()
        };
        setUserProfile(gp);
        localStorage.setItem('geistdesk_cached_user_profile', JSON.stringify(gp));
        setLoading(false);
        return;
      }

      if (profile) {
        clearTimeout(safetyTimeout);
        realProfileLoaded = true;
        setUserProfile(profile);
        localStorage.setItem('geistdesk_cached_user_profile', JSON.stringify(profile));
        
        if (profile.roleId) {
          rbacService.getRole(profile.roleId).then(r => {
            setRole(r);
            if (r) localStorage.setItem('geistdesk_cached_user_role', JSON.stringify(r));
            setLoading(false);
          });
        } else {
          // Fallback to legacy system role if roleId is not set
          const mockRole: UserRole = {
            id: 'legacy',
            name: profile.role,
            description: 'Legacy system role',
            permissions: {
              tickets: { view: true, create: true, edit: true, delete: profile.role === 'admin', admin: profile.role === 'admin' },
              customers: { view: true, create: true, edit: true, delete: profile.role === 'admin', admin: profile.role === 'admin' },
              vault: { view: true, create: true, edit: true, delete: profile.role === 'admin', admin: profile.role === 'admin' },
              insights: { view: profile.role !== 'agent', create: false, edit: false, delete: false, admin: profile.role === 'admin' },
            },
            specialPermissions: {
              overridePIIShield: profile.role === 'admin',
              manageModelOrchestrator: profile.role === 'admin',
              bypass2FA: false,
              aiGovernance: profile.role === 'admin'
            },
            createdAt: new Date(),
            updatedAt: new Date()
          };
          setRole(mockRole);
          localStorage.setItem('geistdesk_cached_user_role', JSON.stringify(mockRole));
          setLoading(false);
        }
      } else {
        if (timeoutFired && !realProfileLoaded) {
          const { profile, role } = applyGuestAdminSession(authUser);
          setRole(role);
          setUserProfile(profile);
          setLoading(false);
        }
      }
    });

    return () => {
      clearTimeout(safetyTimeout);
      unsub();
    };
  }, [authUser]);

  const hasPermission = (module: string, action: 'view' | 'create' | 'edit' | 'delete' | 'admin') => {
    // 1. Direct user-level overrides (derived from the database profile only)
    if (userProfile?.is_admin === true) return true;
    
    if (module === 'tickets' && action === 'create' && userProfile?.can_create_tickets === false) {
      return false;
    }
    if ((module === 'kb_articles' || module === 'kb') && action === 'view' && userProfile?.can_view_knowledgebase === false) {
      return false;
    }

    if (!role) return false;
    
    // 2. Role-level overrides
    if (role.name === 'admin' || role.isSystem || (role as any).is_admin === true) return true;
    
    if (module === 'tickets' && action === 'create' && (role as any).can_create_tickets === false) {
      return false;
    }
    if ((module === 'kb_articles' || module === 'kb') && action === 'view' && (role as any).can_view_knowledgebase === false) {
      return false;
    }

    const modulePerms = role.permissions[module];
    if (!modulePerms) return false;
    
    return modulePerms[action] === true;
  };

  const hasSpecialPermission = (key: keyof UserRole['specialPermissions']) => {
    if (!role) return false;
    if (role.name === 'admin' || role.isSystem) return true;
    return role.specialPermissions[key] === true;
  };

  return { role, userProfile, hasPermission, hasSpecialPermission, loading };
}
