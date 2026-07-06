import { useEffect, useMemo, useState } from 'react';
import { X, Users, Trash2, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { ModuleToolbarSelect } from '../ui/module-page';
import { useTranslation } from '../../lib/context/I18nContext';
import { cn } from '../../lib/utils';
import type {
  AccessibleVaultPortfolio,
  VaultPortfolioAssignment,
  VaultPortfolioRole,
} from '../../lib/vault-service';
import type { User } from '../../types';

const ASSIGNABLE_ROLES: VaultPortfolioRole[] = ['Betrachter', 'Bearbeiter', 'Admin'];

export interface VaultShareAccessPanelProps {
  portfolio: AccessibleVaultPortfolio;
  users: User[];
  isSaving: boolean;
  onSaveAssignments: (assignments: VaultPortfolioAssignment[]) => Promise<void>;
  onClose: () => void;
  onRequestDelete: () => void;
}

export function VaultShareAccessPanel({
  portfolio,
  users,
  isSaving,
  onSaveAssignments,
  onClose,
  onRequestDelete,
}: VaultShareAccessPanelProps) {
  const { t } = useTranslation();
  const [assignments, setAssignments] = useState<VaultPortfolioAssignment[]>(portfolio.assignments || []);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<VaultPortfolioRole>('Bearbeiter');

  useEffect(() => {
    setAssignments(portfolio.assignments || []);
  }, [portfolio]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    const pool = users.filter((u) => u.id !== portfolio.createdBy);
    if (!q) return pool.slice(0, 12);
    return pool.filter(
      (u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q),
    );
  }, [users, userSearch, portfolio.createdBy]);

  const handleAddMember = () => {
    if (!selectedUserId) return;
    const user = users.find((u) => u.id === selectedUserId);
    if (!user) return;
    if (assignments.some((a) => a.userId === selectedUserId)) return;
    setAssignments((prev) => [
      ...prev,
      {
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        role: selectedRole,
      },
    ]);
    setSelectedUserId('');
  };

  const handleRoleChange = (userId: string, role: VaultPortfolioRole) => {
    setAssignments((prev) => prev.map((a) => (a.userId === userId ? { ...a, role } : a)));
  };

  const handleRemove = (userId: string) => {
    setAssignments((prev) => prev.filter((a) => a.userId !== userId));
  };

  const roleLabel = (role: VaultPortfolioRole) => {
    switch (role) {
      case 'Betrachter':
        return t('vault.share.roleViewer', 'Betrachter / Read-Only');
      case 'Bearbeiter':
        return t('vault.share.roleEditor', 'Bearbeiter / Editor');
      case 'Admin':
        return t('vault.share.roleAdmin', 'Admin');
      case 'Besitzer':
        return t('vault.share.roleOwner', 'Mitbesitzer / Co-Owner');
      default:
        return role;
    }
  };

  return (
    <div className="rounded-2xl border border-violet-200/80 bg-white overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-violet-100 bg-violet-50/40 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-violet-700 mb-1">
            <Users className="w-4 h-4 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {t('vault.share.title', 'Tresor-Zugriff verwalten')}
            </span>
          </div>
          <h3 className="text-sm font-bold text-slate-900 truncate">
            {portfolio.emoji} {portfolio.name}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/80"
          aria-label={t('actions.close', 'Close')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
          <Input
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder={t('vault.share.searchUsers', 'Teammitglied suchen…')}
            className="rounded-xl h-9 text-sm"
          />
          <ModuleToolbarSelect
            value={selectedUserId}
            onChange={setSelectedUserId}
            aria-label={t('vault.share.selectUser', 'Benutzer auswählen')}
            className="min-w-[160px]"
          >
            <option value="">{t('vault.share.selectUser', 'Benutzer auswählen')}</option>
            {filteredUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </ModuleToolbarSelect>
          <div className="flex gap-2">
            <ModuleToolbarSelect
              value={selectedRole}
              onChange={(v) => setSelectedRole(v as VaultPortfolioRole)}
              aria-label={t('vault.share.selectRole', 'Rolle')}
              className="min-w-[140px]"
            >
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </ModuleToolbarSelect>
            <Button
              type="button"
              size="sm"
              onClick={handleAddMember}
              disabled={!selectedUserId}
              className="rounded-xl h-9 gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('actions.add', 'Hinzufügen')}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {assignments.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">
              {t('vault.share.noMembers', 'Noch keine geteilten Zugriffe.')}
            </p>
          ) : (
            assignments.map((assignment) => (
              <div
                key={assignment.userId}
                className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50"
              >
                <div className="flex-1 min-w-[120px]">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {assignment.userName || assignment.userEmail || assignment.userId}
                  </p>
                  {assignment.userEmail ? (
                    <p className="text-[10px] text-slate-400 truncate">{assignment.userEmail}</p>
                  ) : null}
                </div>
                {assignment.role === 'Besitzer' ? (
                  <Badge variant="outline" className="text-[10px]">
                    {roleLabel('Besitzer')}
                  </Badge>
                ) : (
                  <>
                    <ModuleToolbarSelect
                      value={assignment.role}
                      onChange={(v) => handleRoleChange(assignment.userId, v as VaultPortfolioRole)}
                      aria-label={t('vault.share.selectRole', 'Rolle')}
                      className="min-w-[130px] text-xs"
                    >
                      {ASSIGNABLE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </ModuleToolbarSelect>
                    <button
                      type="button"
                      onClick={() => handleRemove(assignment.userId)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                      aria-label={t('actions.remove', 'Entfernen')}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <Button
            type="button"
            onClick={() => onSaveAssignments(assignments)}
            disabled={isSaving}
            className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold h-9"
          >
            {isSaving ? t('actions.saving', 'Speichern…') : t('vault.share.save', 'Zugriff speichern')}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl text-xs">
            {t('actions.cancel', 'Abbrechen')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onRequestDelete}
            className={cn(
              'rounded-xl text-xs font-bold ml-auto border-red-200 text-red-600 hover:bg-red-50',
            )}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            🗑️ {t('vault.delete.button', 'Tresor löschen')}
          </Button>
        </div>
      </div>
    </div>
  );
}
