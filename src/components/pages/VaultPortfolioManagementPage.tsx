import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Search, Shield, Trash2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { ModuleToolbarSelect } from '../../components/ui/module-page';
import { ScrollArea } from '../../components/ui/scroll-area';
import { useTranslation } from '../../lib/context/I18nContext';
import {
  credentialVaultService,
  VAULT_SCOPE_LABELS,
  type VaultPortfolio,
  type VaultPortfolioAssignment,
  type VaultPortfolioRole,
  type VaultAuthorityScope,
} from '../../lib/vault-service';
import { userService } from '../../services/userService';
import type { User } from '../../types';

const ROLES: VaultPortfolioRole[] = ['Besitzer', 'Admin', 'Bearbeiter', 'Betrachter'];
const SCOPES: VaultAuthorityScope[] = ['personal', 'department', 'team', 'global'];

export default function VaultPortfolioManagementPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [portfolios, setPortfolios] = useState<VaultPortfolio[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<VaultPortfolioRole>('Bearbeiter');

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formEmoji, setFormEmoji] = useState('🔒');
  const [formScope, setFormScope] = useState<VaultAuthorityScope>('personal');
  const [formAssignments, setFormAssignments] = useState<VaultPortfolioAssignment[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [portfolioRes, agentList] = await Promise.all([
        credentialVaultService.listPortfolios(),
        userService.getAgents(),
      ]);
      setPortfolios(portfolioRes.portfolios);
      setUsers(agentList);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load vault portfolios');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return users.slice(0, 12);
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q),
    );
  }, [users, userSearch]);

  const handleAddAssignment = () => {
    if (!selectedUserId) {
      toast.error(t('vault.portfolio.selectUser', 'Select a user first'));
      return;
    }
    const user = users.find((u) => u.id === selectedUserId);
    if (!user) return;
    if (formAssignments.some((a) => a.userId === selectedUserId)) {
      toast.error(t('vault.portfolio.userAlreadyAssigned', 'User already assigned'));
      return;
    }
    setFormAssignments((prev) => [
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

  const handleRemoveAssignment = (userId: string) => {
    setFormAssignments((prev) => prev.filter((a) => a.userId !== userId));
  };

  const handleCreatePortfolio = async () => {
    if (!formName.trim()) {
      toast.error(t('vault.portfolio.nameRequired', 'Portfolio name is required'));
      return;
    }
    setIsSaving(true);
    try {
      const { portfolio } = await credentialVaultService.createPortfolio({
        name: formName.trim(),
        description: formDescription.trim(),
        emoji: formEmoji,
        scope: formScope,
        assignments: formAssignments,
      });
      setPortfolios((prev) => [portfolio, ...prev]);
      setFormName('');
      setFormDescription('');
      setFormEmoji('🔒');
      setFormScope('personal');
      setFormAssignments([]);
      toast.success(t('vault.portfolio.created', 'Vault portfolio created'));
    } catch (err: any) {
      toast.error(err.message || 'Failed to create portfolio');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePortfolio = async (id: string) => {
    try {
      await credentialVaultService.deletePortfolio(id);
      setPortfolios((prev) => prev.filter((p) => p.id !== id));
      toast.success(t('vault.portfolio.deleted', 'Portfolio deleted'));
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete portfolio');
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#FAFBFC]">
      <div className="px-6 py-4 border-b border-slate-200/80 bg-white shrink-0">
        <AdminBreadcrumbs />
        <div className="flex items-center justify-between mt-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              {t('vault.portfolio.title', 'Vault-Portfoliomanagement')}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('vault.portfolio.subtitle', 'Create independent KeePass-style vault instances and assign RBAC roles.')}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/admin')} className="gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('admin.backToHub', 'Back to Hub')}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-7xl mx-auto">
          <Card className="rounded-2xl border-slate-200/80">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                {t('vault.portfolio.createTitle', 'Create Vault Portfolio')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('vault.portfolio.createDesc', 'Each portfolio acts as an independent encrypted vault database.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-[auto_1fr] gap-3">
                <Input
                  value={formEmoji}
                  onChange={(e) => setFormEmoji(e.target.value)}
                  className="w-14 text-center rounded-xl"
                  maxLength={4}
                  aria-label={t('vault.portfolio.emoji', 'Emoji')}
                />
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t('vault.portfolio.namePlaceholder', 'e.g. Infrastructure Secrets')}
                  className="rounded-xl"
                />
              </div>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t('vault.portfolio.descPlaceholder', 'Portfolio description and compliance notes...')}
                className="rounded-xl min-h-[72px] text-sm"
              />
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {t('vault.portfolio.clearanceTier', 'Clearance tier')}
                </label>
                <ModuleToolbarSelect
                  value={formScope}
                  onChange={(v) => setFormScope(v as VaultAuthorityScope)}
                  className="mt-1 w-full"
                >
                  {SCOPES.map((s) => (
                    <option key={s} value={s}>
                      {VAULT_SCOPE_LABELS[s].emoji} {t(VAULT_SCOPE_LABELS[s].key, VAULT_SCOPE_LABELS[s].defaultLabel)}
                    </option>
                  ))}
                </ModuleToolbarSelect>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Users className="w-3 h-3" />
                  {t('vault.portfolio.assignUsers', 'Assign users')}
                </p>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder={t('vault.portfolio.searchUsers', 'Search system users...')}
                    className="pl-9 rounded-xl text-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedUserId(u.id)}
                      className={`text-[11px] px-2 py-1 rounded-lg border transition-colors ${
                        selectedUserId === u.id
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {u.name || u.email}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <ModuleToolbarSelect
                    value={selectedRole}
                    onChange={(v) => setSelectedRole(v as VaultPortfolioRole)}
                    className="flex-1"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </ModuleToolbarSelect>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddAssignment}>
                    {t('vault.portfolio.addUser', 'Add')}
                  </Button>
                </div>
                {formAssignments.length > 0 ? (
                  <div className="space-y-1.5">
                    {formAssignments.map((a) => (
                      <div key={a.userId} className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="font-medium text-slate-700">{a.userName || a.userEmail}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{a.role}</Badge>
                          <button type="button" onClick={() => handleRemoveAssignment(a.userId)} className="text-slate-400 hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <Button type="button" onClick={handleCreatePortfolio} disabled={isSaving} className="w-full rounded-xl">
                {isSaving ? t('vault.portfolio.creating', 'Creating...') : t('vault.portfolio.createButton', 'Create Portfolio')}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200/80">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" />
                {t('vault.portfolio.existingTitle', 'Active Portfolios')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('vault.portfolio.existingDesc', 'Portfolios visible to users based on their assignments.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-xs text-slate-400 animate-pulse">{t('common.loading', 'Loading...')}</p>
              ) : portfolios.length === 0 ? (
                <p className="text-xs text-slate-400">{t('vault.portfolio.empty', 'No portfolios created yet.')}</p>
              ) : (
                <div className="space-y-3">
                  {portfolios.map((p) => (
                    <div key={p.id} className="p-4 rounded-xl border border-slate-200/80 bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                            <span>{p.emoji || '🔒'}</span>
                            {p.name}
                          </p>
                          {p.description ? (
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{p.description}</p>
                          ) : null}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <Badge variant="outline" className="text-[10px]">
                              {t(VAULT_SCOPE_LABELS[p.scope].key, VAULT_SCOPE_LABELS[p.scope].defaultLabel)}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {(p.assignments || []).length} {t('vault.portfolio.members', 'members')}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                          onClick={() => handleDeletePortfolio(p.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      {(p.assignments || []).length > 0 ? (
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                          {p.assignments.map((a) => (
                            <div key={a.userId} className="flex items-center justify-between text-[11px] text-slate-600">
                              <span>{a.userName || a.userEmail || a.userId}</span>
                              <span className="font-semibold text-slate-500">{a.role}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
