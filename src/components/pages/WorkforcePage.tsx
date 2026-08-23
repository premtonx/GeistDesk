import { useEffect, useState, type FormEvent } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Shield, 
  Mail, 
  CheckCircle2, 
  XSquare,
  RefreshCw,
  Globe,
  Lock,
  Building,
  Key,
  ShieldCheck,
  Check,
  Power,
  Trash2,
  AlertTriangle,
  ChevronRight,
  Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '../ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { AdminBreadcrumbs } from '../AdminBreadcrumbs';
import { userService } from '../../services/userService';
import { agentService } from '../../services/agentService';
import { User } from '../../types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useWorkspaceModuleConfig } from '../../hooks/useWorkspaceModuleConfig';
import { PersonalVaultResetButton, usePersonalVaultReset } from '../admin/UserManagementPanel';
import axios from 'axios';

export default function WorkforcePage() {
  const { config, persist } = useWorkspaceModuleConfig({ admin: true });
  const [agents, setAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [authFilter, setAuthFilter] = useState('all');
  
  // SSO Constraints State
  const ssoDomains = config.ssoDomains;
  const [newSsoDomain, setNewSsoDomain] = useState('');

  // Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteModalTab, setInviteModalTab] = useState<'local' | 'sso'>('local');
  
  // New User Form State
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'agent',
    password: '',
  });

  const { openResetDialog, resetDialog } = usePersonalVaultReset();

  // Load agents
  useEffect(() => {
    const unsubscribe = userService.subscribeToUsers((data) => {
      setAgents(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Save SSO domain constraint
  const handleAddSsoDomain = async () => {
    const clean = newSsoDomain.trim().toLowerCase();
    if (!clean) return;
    if (ssoDomains.includes(clean)) {
      toast.error('This SSO domain constraint is already registered');
      return;
    }
    const updated = [...ssoDomains, clean];
    const saved = await persist({ ...config, ssoDomains: updated });
    if (saved) {
      setNewSsoDomain('');
      toast.success(`Access constraint added: Expected SSO logins restricted to @${clean}`);
    }
  };

  const handleRemoveSsoDomain = async (index: number) => {
    const updated = ssoDomains.filter((_, i) => i !== index);
    const saved = await persist({ ...config, ssoDomains: updated });
    if (saved) {
      toast.success('SSO domain restriction removed');
    }
  };

  // Switch role dynamically
  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      if (userId === 'root-admin-user' || userId === 'user-premtonxh') {
        toast.error('Sovereign administrative accounts are protected against modifications.');
        return;
      }
      await userService.updateUser(userId, { 
        role: newRole as any,
        is_admin: newRole === 'admin' 
      });
      toast.success('Operative security credentials shifted in real-time');
    } catch (err) {
      toast.error('Failed to change operative role');
    }
  };

  // Toggle deactivation status
  const handleToggleDeactivation = async (userId: string, currentStatus: boolean | undefined) => {
    try {
      if (userId === 'root-admin-user' || userId === 'user-premtonxh') {
        toast.error('Sovereign administrative accounts are protected against suspensions.');
        return;
      }
      const isDeactivated = !currentStatus;
      await agentService.toggleDeactivation(userId, isDeactivated);
      toast.success(isDeactivated ? 'Operative access successfully SUSPENDED.' : 'Operative access successfully RESTORED.');
    } catch (err) {
      toast.error('Failed to shift operative system status');
    }
  };

  // Onboard manual user
  const [onboarding, setOnboarding] = useState(false);

  const handleOnboardUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.name) {
      toast.error('Please complete Name and Email fields.');
      return;
    }

    const isSso = inviteModalTab === 'sso';
    if (!isSso && (!newUser.password || newUser.password.length < 8)) {
      toast.error('Local accounts require a password of at least 8 characters.');
      return;
    }

    setOnboarding(true);
    try {
      // All provisioning goes through the server-side, admin-gated endpoint so
      // the Express RBAC layer is enforced and the profile is created
      // atomically. The hardcoded fallback password was removed; a real
      // password is now required (and hashed server-side) for local accounts.
      const createRes = await axios.post('/api/admin/users/create-local', {
        name: newUser.name,
        email: newUser.email.toLowerCase().trim(),
        role: newUser.role,
        authMethod: isSso ? 'sso' : 'password',
      });
      const created = createRes.data?.user as { id: string } | undefined;
      if (!created?.id) {
        throw new Error(createRes.data?.message || 'No user id returned.');
      }

      if (!isSso && newUser.password) {
        await axios.post(`/api/admin/users/${created.id}/set-password`, {
          password: newUser.password,
        });
      }

      toast.success(
        isSso
          ? `${newUser.name} pre-approved as SSO account successfully!`
          : `${newUser.name} created as local account with a hashed password.`,
      );

      // Reset form
      setNewUser({ name: '', email: '', role: 'agent', password: '' });
      setIsInviteModalOpen(false);
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || err.response?.data?.message || err.message
        : err instanceof Error
          ? err.message
          : String(err);
      toast.error(message || 'Failed to onboard workforce user');
    } finally {
      setOnboarding(false);
    }
  };

  // Data Filtering
  const filteredUsers = agents.filter(user => {
    const matchesSearch = 
      (user.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (user.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    const isSsoType = user.authMethod === 'sso' || (user.email && (user.email.endsWith('.onmicrosoft.com') || ssoDomains.some(d => user.email.toLowerCase().endsWith(d))));
    const matchesAuth = authFilter === 'all' || 
      (authFilter === 'sso' && isSsoType) || 
      (authFilter === 'local' && !isSsoType);

    return matchesSearch && matchesRole && matchesAuth;
  });

  // Analytics Metrics calculations
  const totalCount = agents.length;
  const ssoCount = agents.filter(user => {
    const isSso = user.authMethod === 'sso' || (user.email && (user.email.endsWith('.onmicrosoft.com') || ssoDomains.some(d => user.email.toLowerCase().endsWith(d))));
    return isSso;
  }).length;
  const localCount = totalCount - ssoCount;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-xs font-black uppercase text-slate-400 tracking-wider">Loading secure profiles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 custom-scrollbar min-h-screen">
      {resetDialog}
      <div className="p-8 max-w-7xl mx-auto space-y-8 pb-32">
        
        {/* Breadcrumb pathing */}
        <AdminBreadcrumbs />

        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-105 flex items-center justify-center text-indigo-600 shadow-sm">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Nexus Workforce Hub</h1>
                <p className="text-slate-500 text-sm">Pre-provision security attributes, assign structural roles, and control sign-on methods.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={() => {
                setNewUser({ name: '', email: '', role: 'agent', password: '' });
                setIsInviteModalOpen(true);
              }} 
              className="rounded-2xl font-black px-6 shadow-md shadow-indigo-100 bg-indigo-600 text-white hover:bg-indigo-700 h-12 transition-all"
            >
              <UserPlus className="w-4 h-4 mr-2" /> Invite / Pre-Provision
            </Button>
          </div>
        </div>

        {/* Real-time metrics overview header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-[2rem] border-slate-250 bg-white shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Total System Users</p>
                <h3 className="text-4xl font-extrabold text-slate-900 mt-2">{totalCount}</h3>
                <p className="text-[11px] text-slate-500 mt-1">Sovereign cloud workspace directory</p>
              </div>
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100">
                <Users className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-slate-250 bg-white shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-blue-500">SSO Enterprise Users</p>
                <h3 className="text-4xl font-extrabold text-blue-600 mt-2">{ssoCount}</h3>
                <p className="text-[11px] text-slate-500 mt-1">Verified with Microsoft Entra ID</p>
              </div>
              <div className="w-14 h-14 bg-blue-50/50 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-100">
                <Globe className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-slate-250 bg-white shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-fuchsia-500">Local Accounts</p>
                <h3 className="text-4xl font-extrabold text-fuchsia-600 mt-2">{localCount}</h3>
                <p className="text-[11px] text-slate-500 mt-1">Credential credentials repository</p>
              </div>
              <div className="w-14 h-14 bg-fuchsia-50/50 rounded-2xl flex items-center justify-center text-fuchsia-500 border border-fuchsia-100">
                <Lock className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Directory Search & Filters */}
        <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            {/* Search Input */}
            <div className="relative flex-1 w-full group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <Input 
                placeholder="Search operatives by user name or corporate email..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-12 rounded-2xl border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white transition-all font-medium text-slate-800 focus-visible:ring-indigo-500"
              />
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Role filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Role:</span>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-xs font-semibold text-slate-700 w-[140px] focus:ring-indigo-500">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 shadow-xl bg-white">
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">System Admin</SelectItem>
                    <SelectItem value="team_lead">Team Lead</SelectItem>
                    <SelectItem value="agent">Support Agent</SelectItem>
                    <SelectItem value="customer">Customer Portal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Authentication Type filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Auth:</span>
                <Select value={authFilter} onValueChange={setAuthFilter}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-xs font-semibold text-slate-700 w-[140px] focus:ring-indigo-500">
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 shadow-xl bg-white">
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="sso">SSO (Microsoft)</SelectItem>
                    <SelectItem value="local">Local Signed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm text-slate-700">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-250">
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">User Profile / Contacts</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Auth Method</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">System Role Constraint</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Account status</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400 text-right">GeistVault</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400 text-right">Protection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <AnimatePresence mode="popLayout">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-12 text-slate-400">
                        <Users className="w-10 h-10 mx-auto text-slate-300 stroke-1 mb-2" />
                        <p className="text-sm font-semibold">No operatives map the chosen criteria.</p>
                        <p className="text-xs text-slate-400 mt-1">Try broadening your search guidelines.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const isSsoType = user.authMethod === 'sso' || (user.email && (user.email.endsWith('.onmicrosoft.com') || ssoDomains.some(d => user.email.toLowerCase().endsWith(d))));
                      const currentStatus = !user.isDeactivated;
                      const isSovereign = user.id === 'root-admin-user' || user.id === 'user-premtonxh' || user.email === 'premtonxh@gmail.com';

                      return (
                        <tr key={user.id} className="hover:bg-slate-50/50 transition-all border-b border-slate-100">
                          {/* Name / Email row */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {user.avatar ? (
                                <img 
                                  src={user.avatar} 
                                  alt={user.name} 
                                  className="w-10 h-10 rounded-2xl border border-slate-200 object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-105 flex items-center justify-center font-bold text-indigo-600 text-sm">
                                  {user.name ? user.name.slice(0, 2).toUpperCase() : 'GD'}
                                </div>
                              )}
                              <div>
                                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                                  {user.name || 'Anonymous Operating Agent'}
                                  {isSovereign && (
                                    <Badge className="bg-slate-900 text-white rounded-[6px] text-[8px] tracking-wide font-black uppercase py-0.5 px-1 bg-gradient-to-r from-indigo-700 to-indigo-900 border-none">
                                      Root Admin
                                    </Badge>
                                  )}
                                </h4>
                                <span className="text-xs text-slate-400 font-medium">{user.email}</span>
                              </div>
                            </div>
                          </td>

                          {/* Authentication Source row */}
                          <td className="px-6 py-4">
                            {isSsoType ? (
                              <Badge className="bg-blue-50 text-blue-700 border border-blue-150 rounded-xl px-2.5 py-1 text-xs font-bold hover:bg-blue-50 gap-1 shadow-sm">
                                <Globe className="w-3.5 h-3.5 mr-0.5 inline" /> Microsoft Entra SSO
                              </Badge>
                            ) : (
                              <Badge className="bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-150 rounded-xl px-2.5 py-1 text-xs font-bold hover:bg-fuchsia-50 gap-1 shadow-sm">
                                <Lock className="w-3.5 h-3.5 mr-0.5 inline" /> Local Credentials
                              </Badge>
                            )}
                          </td>

                          {/* Role selector row */}
                          <td className="px-6 py-4">
                            <Select 
                              disabled={isSovereign}
                              value={user.role || 'agent'} 
                              onValueChange={(val) => handleChangeRole(user.id, val)}
                            >
                              <SelectTrigger className="h-9 rounded-xl border-slate-200 bg-white font-semibold text-xs text-slate-700 w-[130px] shadow-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-slate-200 shadow-xl bg-white text-slate-700">
                                <SelectItem value="admin">System Admin</SelectItem>
                                <SelectItem value="team_lead">Team Lead</SelectItem>
                                <SelectItem value="agent">Support Agent</SelectItem>
                                <SelectItem value="customer">Customer Portal</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>

                          {/* Account status row */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {/* Native Toggle Widget */}
                              <Switch 
                                disabled={isSovereign}
                                checked={currentStatus}
                                onCheckedChange={() => handleToggleDeactivation(user.id, user.isDeactivated)}
                                className="data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-slate-300"
                              />
                              <span className={`text-xs font-bold uppercase tracking-wider ${currentStatus ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {currentStatus ? 'Active' : 'Suspended'}
                              </span>
                            </div>
                          </td>

                          {/* GeistVault personal reset — structural wipe only; zero-knowledge */}
                          <td className="px-6 py-4 text-right">
                            {!isSovereign ? (
                              <PersonalVaultResetButton
                                user={{ id: user.id, name: user.name, email: user.email }}
                                onClick={openResetDialog}
                              />
                            ) : (
                              <span className="text-[10px] font-bold text-slate-300 uppercase">—</span>
                            )}
                          </td>

                          {/* Security Level Tag */}
                          <td className="px-6 py-4 text-right">
                            {isSovereign ? (
                              <span className="text-xs font-black text-rose-500 uppercase tracking-widest inline-flex items-center gap-1 bg-rose-50 border border-rose-100 rounded-xl px-2.5 py-1.5 shadow-sm">
                                <ShieldCheck className="w-3.5 h-3.5 text-rose-500" /> SVR LOCKED
                              </span>
                            ) : (
                              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest inline-flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1.5">
                                Mutable Operative
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>

        {/* Dynamic Allowed SSO Domains Section (Access constraints) */}
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-rose-50 pb-4">
            <div className="w-10 h-10 bg-indigo-50 border border-indigo-105 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Enterprise SSO Domain Authorization Limits</h3>
              <p className="text-slate-500 text-xs">Define verified domains pre-authorized for the SSO pathway. All requests from unmatched domains will receive strict boundary auditing.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Input 
              placeholder="e.g. acme-workspace.org"
              value={newSsoDomain}
              onChange={(e) => setNewSsoDomain(e.target.value)}
              className="max-w-md h-12 rounded-2xl border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white transition-all font-medium focus-visible:ring-indigo-500"
            />
            <Button 
              onClick={handleAddSsoDomain}
              className="bg-indigo-600 text-white rounded-2xl font-black shadow-md hover:bg-indigo-700 h-12 px-6"
            >
              Add Domain Constraint
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {ssoDomains.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No domain limits configured. Default wildcard settings let matching providers resolve sign-ons.</p>
            ) : (
              ssoDomains.map((domain, i) => (
                <div key={domain} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-bold px-3.5 py-2 rounded-2xl border border-indigo-100/50 shadow-sm animate-fade-in">
                  <Globe className="w-3.5 h-3.5 text-indigo-500" />
                  <span>@{domain}</span>
                  <button 
                    onClick={() => handleRemoveSsoDomain(i)}
                    className="text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100/70 p-0.5 rounded-full transition-colors ml-1"
                    title="Remove domain configuration constraint"
                  >
                    <XSquare className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Invite/Create User Dialog overlay */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden border-none rounded-[2rem] shadow-2xl bg-white text-slate-800">
          <DialogHeader className="p-8 pb-4 bg-slate-50 border-b border-slate-200">
            <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2.5">
              <UserPlus className="w-6 h-6 text-indigo-600" /> Pre-Onboard Operative
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs mt-1">
              Select your authorization pathway to configuration limits for either traditional local logins or Azure AD Single Sign-On (SSO).
            </DialogDescription>
          </DialogHeader>

          <div className="p-8 space-y-6">
            {/* Swappable toggle tags between Local and SSO */}
            <div className="grid grid-cols-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setInviteModalTab('local')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black uppercase text-xs transition-all ${inviteModalTab === 'local' ? 'bg-white text-indigo-600 shadow-md border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <Lock className="w-4 h-4" /> Local account
              </button>
              <button
                type="button"
                onClick={() => setInviteModalTab('sso')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black uppercase text-xs transition-all ${inviteModalTab === 'sso' ? 'bg-white text-indigo-600 shadow-md border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <Globe className="w-4 h-4" /> SSO pre-approve
              </button>
            </div>

            <form onSubmit={handleOnboardUser} className="space-y-4">
              {/* Common operative name */}
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-400">FullName</Label>
                <Input 
                  required
                  placeholder="e.g. Alexis Martinez"
                  value={newUser.name}
                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all font-medium focus-visible:ring-indigo-500"
                />
              </div>

              {/* Common operating email */}
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Corporate Email Address</Label>
                <Input 
                  required
                  type="email"
                  placeholder={inviteModalTab === 'sso' ? "alexis@microsoft.onmicrosoft.com" : "alexis@geistdesk.com"}
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all font-medium focus-visible:ring-indigo-500"
                />
                {inviteModalTab === 'sso' && (
                  <div className="flex items-start gap-2 bg-indigo-50/60 p-3 rounded-xl border border-indigo-100/50 mt-1">
                    <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-indigo-700 leading-normal font-semibold">
                      Pre-approving this email ensures that when Alexis logs in via Entra ID (SSO), they bypass sandbox limits and seamlessly land with pre-assigned permissions.
                    </p>
                  </div>
                )}
              </div>

              {/* Swappable parameters */}
              {inviteModalTab === 'local' ? (
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Pre-assigned Secure Password</Label>
                  <Input
                    required
                    type="password"
                    minLength={8}
                    placeholder="Minimum 8 characters"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all font-medium focus-visible:ring-indigo-500"
                  />
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">MINIMUM: 8 characters. The password is hashed server-side with Argon2id.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-400">SSO Directory Domain Requirement</Label>
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-xs text-slate-500 font-semibold select-none">
                    <Shield className="w-4 h-4 text-indigo-500" />
                    <span>Requires a matching Entra ID tenant token response matching the domain limits above.</span>
                  </div>
                </div>
              )}

              {/* System level designation */}
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-400">System Role Designation</Label>
                <Select value={newUser.role} onValueChange={(val: any) => setNewUser({...newUser, role: val})}>
                  <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-slate-50/50 font-bold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 shadow-xl bg-white text-slate-700">
                    <SelectItem value="admin">System Admin</SelectItem>
                    <SelectItem value="team_lead">Team Lead</SelectItem>
                    <SelectItem value="agent">Support Agent</SelectItem>
                    <SelectItem value="customer">Customer Portal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-4 border-t border-slate-100 flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsInviteModalOpen(false)}
                  className="rounded-xl font-bold border-slate-200 bg-white"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={onboarding}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl px-6 min-w-[120px]"
                >
                  {onboarding ? 'Provisioning…' : 'Confirm Provisioning'}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
