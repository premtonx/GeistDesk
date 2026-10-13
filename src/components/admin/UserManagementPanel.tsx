import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { fetchAdminUsers, resetUserPersonalVault, type AdminUserRecord } from '../../services/adminUsersApi';

export const PERSONAL_VAULT_RESET_CONFIRM_MESSAGE =
  'Möchten Sie den PERSÖNLICHEN Tresor für diesen Benutzer wirklich unwiderruflich löschen? Alle aktuell darin verschlüsselten Passwörter gehen für immer verloren. Vom Admin zugewiesene Firmen- oder Abteilungs-Vaults bleiben unverändert erhalten.';

export interface PersonalVaultResetTarget {
  id: string;
  name?: string;
  email?: string;
}

export function usePersonalVaultReset(onSuccess?: () => void) {
  const [resetTarget, setResetTarget] = useState<PersonalVaultResetTarget | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const openResetDialog = useCallback((target: PersonalVaultResetTarget) => {
    setResetTarget(target);
  }, []);

  const closeResetDialog = useCallback(() => {
    if (!isResetting) setResetTarget(null);
  }, [isResetting]);

  const confirmReset = useCallback(async () => {
    if (!resetTarget) return;
    setIsResetting(true);
    try {
      const result = await resetUserPersonalVault(resetTarget.id);
      toast.success(result.message || 'Persönlicher Tresor wurde strukturell gelöscht.');
      setResetTarget(null);
      onSuccess?.();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? String((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Zurücksetzen fehlgeschlagen.')
          : err instanceof Error
            ? err.message
            : 'Zurücksetzen fehlgeschlagen.';
      toast.error(message);
    } finally {
      setIsResetting(false);
    }
  }, [resetTarget, onSuccess]);

  const dialog = (
    <Dialog open={Boolean(resetTarget)} onOpenChange={(open) => !open && closeResetDialog()}>
      <DialogContent className="max-w-lg rounded-2xl border-red-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            Persönlichen Tresor unwiderruflich löschen
          </DialogTitle>
          <DialogDescription className="text-slate-700 text-sm leading-relaxed pt-2">
            {PERSONAL_VAULT_RESET_CONFIRM_MESSAGE}
          </DialogDescription>
        </DialogHeader>
        {resetTarget ? (
          <p className="text-xs text-slate-500 px-1">
            Betroffener Benutzer:{' '}
            <span className="font-semibold text-slate-700">{resetTarget.name || 'Unbenannt'}</span>
            {resetTarget.email ? ` (${resetTarget.email})` : ''}
          </p>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" disabled={isResetting} onClick={closeResetDialog}>
            Abbrechen
          </Button>
          <Button type="button" variant="destructive" disabled={isResetting} onClick={() => void confirmReset()}>
            {isResetting ? 'Wird gelöscht…' : 'Unwiderruflich löschen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { openResetDialog, resetDialog: dialog, isResetting };
}

export function PersonalVaultResetButton({
  user,
  disabled,
  onClick,
}: {
  user: PersonalVaultResetTarget;
  disabled?: boolean;
  onClick: (user: PersonalVaultResetTarget) => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      className="text-amber-700 border-amber-200 hover:bg-amber-50 hover:text-amber-800 font-semibold text-[11px] h-8"
      onClick={() => onClick(user)}
    >
      ⚠️ Persönlichen Tresor löschen
    </Button>
  );
}

interface UserManagementPanelProps {
  className?: string;
}

export function UserManagementPanel({ className }: UserManagementPanelProps) {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminUsers(1, 100);
      setUsers(data.users);
    } catch (err) {
      console.error('Failed to load admin users', err);
      toast.error('Benutzerliste konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  const { openResetDialog, resetDialog } = usePersonalVaultReset(loadUsers);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Benutzer werden geladen…
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {resetDialog}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Benutzer</th>
              <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Rolle</th>
              <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Persönlicher Tresor</th>
              <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-400">
                  Keine Benutzer gefunden.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{user.name || 'Unbenannt'}</div>
                    <div className="text-xs text-slate-400">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 capitalize">{user.role}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {user.personalVaultInitialized ? 'Initialisiert' : 'Nicht initialisiert'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <PersonalVaultResetButton
                      user={{ id: user.id, name: user.name, email: user.email }}
                      onClick={openResetDialog}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
