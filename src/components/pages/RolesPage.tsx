import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  Plus, 
  Search, 
  Users, 
  ChevronRight, 
  Save, 
  Trash2, 
  AlertTriangle,
  Lock,
  Eye,
  Edit,
  Trash,
  Settings,
  Cpu,
  Fingerprint,
  Info,
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '../ui/dialog';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "../ui/dropdown-menu";
import { AdminBreadcrumbs } from '../AdminBreadcrumbs';
import { rbacService } from '../../services/rbacService';
import { userService } from '../../services/userService';
import { UserRole, User } from '../../types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { formatDistanceToNow } from 'date-fns';

const MODULES = [
  { id: 'tickets', name: 'Tickets', description: 'Access to support requests and threads.' },
  { id: 'customers', name: 'Customers', description: 'Directory of companies and contacts.' },
  { id: 'vault', name: 'Vault', description: 'Encrypted credential management.' },
  { id: 'insights', name: 'Sovereign Insights', description: 'Advanced reporting and AI analytics.' },
  { id: 'groups', name: 'Functional Teams', description: 'Group membership and routing.' },
  { id: 'workforce', name: 'Workforce', description: 'Agent induction and status management.' },
  { id: 'legal', name: 'Legal Guardrails', description: 'Compliance logs and system prompts.' }
];

const ACTIONS = [
  { id: 'view', name: 'View', icon: Eye },
  { id: 'create', name: 'Create', icon: Plus },
  { id: 'edit', name: 'Edit', icon: Edit },
  { id: 'delete', name: 'Delete', icon: Trash },
  { id: 'admin', name: 'Admin', icon: Settings }
];

const SPECIAL_PERMS = [
  { id: 'overridePIIShield', name: 'Override PII Shield', description: 'View raw data without redaction.', icon: Eye },
  { id: 'manageModelOrchestrator', name: 'Manage Model Orchestrator', description: 'Swap LLM backends and adjust heat.', icon: Cpu },
  { id: 'bypass2FA', name: 'Bypass 2FA (Emergency)', description: 'Override multi-factor for agents.', icon: Fingerprint },
  { id: 'aiGovernance', name: 'AI Governance Manager', description: 'Edit system prompts and forbidden lists.', icon: ShieldCheck }
];

export default function RolesPage() {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRole, setEditingRole] = useState<Partial<UserRole> | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);

  useEffect(() => {
    const unsubRoles = rbacService.subscribeToRoles((data) => {
      setRoles(data);
    });

    const unsubUsers = userService.subscribeToUsers((data) => {
      setUsers(data);
      setLoading(false);
    });

    return () => {
      unsubRoles();
      unsubUsers();
    };
  }, []);

  const getUserCountForRole = (roleId: string) => {
    return users.filter(u => u.roleId === roleId || (u.roleId === undefined && u.role === roles.find(r => r.id === roleId)?.name)).length;
  };

  const handleSaveRole = async () => {
    if (!editingRole?.name) {
      toast.error('Role name is required');
      return;
    }

    try {
      if (editingRole.id) {
        await rbacService.updateRole(editingRole.id, editingRole);
        toast.success('Role updated successfully');
      } else {
        await rbacService.createRole(editingRole);
        toast.success('Role created successfully');
      }
      setIsRoleDialogOpen(false);
      setEditingRole(null);
    } catch (error) {
      toast.error('Failed to save role');
    }
  };

  const togglePermission = (moduleId: string, actionId: string) => {
    if (!editingRole) return;
    
    const currentPermissions = { ...(editingRole.permissions || {}) };
    const modulePerms = { ...(currentPermissions[moduleId] || { view: false, create: false, edit: false, delete: false, admin: false }) };
    
    // Type casting because we know the actionId is a key of the permission object
    (modulePerms as any)[actionId] = !(modulePerms as any)[actionId];
    currentPermissions[moduleId] = modulePerms as any;
    
    setEditingRole({ ...editingRole, permissions: currentPermissions });
  };

  const toggleSpecialPermission = (key: string) => {
    if (!editingRole) return;
    const currentSpecial = { ...(editingRole.specialPermissions || { overridePIIShield: false, manageModelOrchestrator: false, bypass2FA: false, aiGovernance: false }) };
    (currentSpecial as any)[key] = !(currentSpecial as any)[key];
    setEditingRole({ ...editingRole, specialPermissions: currentSpecial as any });
  };

  const startNewRole = () => {
    const freshPermissions: any = {};
    MODULES.forEach(m => {
      freshPermissions[m.id] = { view: false, create: false, edit: false, delete: false, admin: false };
    });

    setEditingRole({
      name: '',
      description: '',
      permissions: freshPermissions,
      specialPermissions: {
        overridePIIShield: false,
        manageModelOrchestrator: false,
        bypass2FA: false,
        aiGovernance: false
      }
    });
    setIsRoleDialogOpen(true);
  };

  const filteredRoles = roles.filter(role => 
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar pb-32">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <AdminBreadcrumbs />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
               <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-600/20">
                  <ShieldCheck className="w-6 h-6" />
               </div>
               <h1 className="text-3xl font-black text-[#202124] tracking-tight uppercase">RBAC Command</h1>
            </div>
            <p className="text-sm text-slate-500 ml-15">Custom role architecture and granular permission mapping.</p>
          </div>
          <Button onClick={startNewRole} className="rounded-xl font-bold px-6 shadow-lg shadow-indigo-600/20 bg-indigo-600 text-white h-12">
            <Plus className="w-4 h-4 mr-2" /> Define New Role
          </Button>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
          <Input 
            placeholder="Search roles by title or blueprint..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 h-14 rounded-2xl border-slate-200 bg-white shadow-sm focus-visible:ring-indigo-500 font-medium"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {filteredRoles.map(role => (
             <Card 
               key={role.id} 
               className={cn(
                 "rounded-[2.5rem] border-slate-200 bg-white transition-all hover:shadow-xl hover:-translate-y-1 cursor-pointer overflow-hidden group",
                 role.isSystem ? "border-indigo-100" : ""
               )}
               onClick={() => {
                 setEditingRole(role);
                 setIsRoleDialogOpen(true);
               }}
             >
                <div className="p-8 space-y-6">
                   <div className="flex items-start justify-between">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Shield className="w-7 h-7" />
                      </div>
                      {role.isSystem && (
                        <Badge className="bg-indigo-50 text-indigo-600 border-none font-black text-[10px] uppercase">System Locked</Badge>
                      )}
                   </div>

                   <div className="space-y-2">
                      <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase group-hover:text-indigo-600 transition-colors">{role.name}</h3>
                      <p className="text-sm text-slate-500 line-clamp-2 min-h-[2.5rem] leading-relaxed italic">"{role.description || 'No description provided for this blueprint.'}"</p>
                   </div>

                   <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                      <div className="flex items-center gap-4">
                         <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Operatives</span>
                            <div className="flex items-center gap-2">
                               <Users className="w-3.5 h-3.5 text-indigo-500" />
                               <span className="text-sm font-black text-slate-700">{getUserCountForRole(role.id)}</span>
                            </div>
                         </div>
                         <div className="w-px h-6 bg-slate-100" />
                         <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Grants</span>
                            <div className="flex items-center gap-2">
                               <Lock className="w-3.5 h-3.5 text-amber-500" />
                               <span className="text-sm font-black text-slate-700">
                                  {Object.values(role.permissions).reduce((acc: number, p: any) => acc + Object.values(p).filter(v => v === true).length, 0)}
                               </span>
                            </div>
                         </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                   </div>
                </div>
             </Card>
           ))}
        </div>

        {/* Role Builder Dialog */}
        <Dialog open={isRoleDialogOpen} onOpenChange={(open) => {
          if (!open) setEditingRole(null);
          setIsRoleDialogOpen(open);
        }}>
          <DialogContent className="max-w-5xl p-0 overflow-hidden border-none rounded-[3rem] shadow-2xl h-[90vh]">
             <div className="flex flex-col h-full">
                <div className="bg-slate-900 p-10 text-white flex items-center justify-between">
                   <div className="space-y-1">
                      <h2 className="text-4xl font-black tracking-tighter uppercase">Role Architect</h2>
                      <p className="text-slate-400 text-sm font-medium tracking-wide">Design granular permissions for the {editingRole?.name || 'new'} operative tier.</p>
                   </div>
                   <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center text-white shadow-2xl shadow-indigo-600/40 border border-white/10">
                      <ShieldCheck className="w-10 h-10" />
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto p-10 space-y-12 bg-white custom-scrollbar">
                   {/* identity */}
                   <section className="space-y-6">
                      <div className="flex items-center gap-3">
                         <div className="w-1.5 h-5 bg-indigo-600 rounded-full" />
                         <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Core Identity</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div className="space-y-3">
                            <Label className="text-sm font-bold text-slate-700">Role Designation</Label>
                            <Input 
                              placeholder="e.g. Senior Security Agent"
                              value={editingRole?.name || ''}
                              onChange={(e) => setEditingRole({...editingRole!, name: e.target.value})}
                              className="h-14 rounded-2xl border-slate-200 bg-slate-50 font-bold focus:bg-white transition-all text-lg"
                            />
                         </div>
                         <div className="space-y-3">
                            <Label className="text-sm font-bold text-slate-700">Lifecycle Description</Label>
                            <Input 
                              placeholder="Define the scope and responsibilities of this role..."
                              value={editingRole?.description || ''}
                              onChange={(e) => setEditingRole({...editingRole!, description: e.target.value})}
                              className="h-14 rounded-2xl border-slate-200 bg-slate-50 font-medium focus:bg-white transition-all"
                            />
                         </div>
                      </div>
                   </section>

                   {/* Permission Grid */}
                   <section className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                         <div className="flex items-center gap-3">
                            <div className="w-1.5 h-5 bg-indigo-600 rounded-full" />
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Permission Matrix</h3>
                         </div>
                         <div className="hidden sm:flex gap-4">
                            {ACTIONS.map(action => (
                              <div key={action.id} className="flex items-center gap-2">
                                <action.icon className="w-3 h-3 text-slate-400" />
                                <span className="text-[10px] font-black uppercase text-slate-500">{action.name}</span>
                              </div>
                            ))}
                         </div>
                      </div>

                      <div className="rounded-[2.5rem] border border-slate-100 bg-slate-50/50 overflow-hidden divide-y divide-slate-100">
                         {MODULES.map(module => (
                           <div key={module.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-8 hover:bg-white transition-colors group/row">
                              <div className="flex-1 min-w-0">
                                 <h4 className="font-black text-slate-900 uppercase tracking-tighter text-lg">{module.name}</h4>
                                 <p className="text-xs text-slate-500 font-medium italic">"{module.description}"</p>
                              </div>
                              <div className="flex flex-wrap gap-3 sm:gap-6">
                                 {ACTIONS.map(action => {
                                   const isGranted = editingRole?.permissions?.[module.id]?.[action.id as keyof typeof editingRole.permissions[string]] || false;
                                   return (
                                     <button 
                                       key={action.id}
                                       onClick={() => togglePermission(module.id, action.id)}
                                       className={cn(
                                         "w-12 h-12 rounded-2xl flex items-center justify-center transition-all group/cell relative",
                                         isGranted ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-white border border-slate-200 text-slate-300 hover:border-indigo-600 hover:text-indigo-600"
                                       )}
                                     >
                                        <div className="relative z-10">
                                          {isGranted ? <CheckCircle2 className="w-6 h-6" /> : <action.icon className="w-5 h-5" />}
                                        </div>
                                        {isGranted && (
                                          <motion.div 
                                            layoutId={`active-${module.id}-${action.id}`}
                                            className="absolute inset-0 rounded-2xl bg-emerald-500"
                                            initial={false}
                                          />
                                        )}
                                     </button>
                                   );
                                 })}
                              </div>
                           </div>
                         ))}
                      </div>
                   </section>

                   {/* Special Overrides */}
                   <section className="space-y-6">
                      <div className="flex items-center gap-3">
                         <div className="w-1.5 h-5 bg-indigo-600 rounded-full" />
                         <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Tactical Overrides</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {SPECIAL_PERMS.map(perm => (
                           <div 
                             key={perm.id} 
                             className={cn(
                               "p-6 rounded-[2rem] border-2 transition-all flex items-center gap-6 cursor-pointer",
                               editingRole?.specialPermissions?.[perm.id as keyof typeof editingRole.specialPermissions] 
                                 ? "bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-600/20" 
                                 : "bg-slate-50 border-slate-100 text-slate-600 hover:border-slate-200"
                             )}
                             onClick={() => toggleSpecialPermission(perm.id)}
                           >
                              <div className={cn(
                                "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
                                editingRole?.specialPermissions?.[perm.id as keyof typeof editingRole.specialPermissions] ? "bg-white/10" : "bg-white text-slate-400"
                              )}>
                                 <perm.icon className="w-7 h-7" />
                              </div>
                              <div className="flex-1 space-y-1">
                                 <div className="flex items-center justify-between">
                                    <h4 className="font-black uppercase tracking-tight">{perm.name}</h4>
                                    <Switch 
                                      checked={editingRole?.specialPermissions?.[perm.id as keyof typeof editingRole.specialPermissions] || false}
                                      onCheckedChange={() => toggleSpecialPermission(perm.id)}
                                      className="data-[state=checked]:bg-white data-[state=checked]:text-indigo-600"
                                    />
                                 </div>
                                 <p className={cn("text-xs leading-relaxed", editingRole?.specialPermissions?.[perm.id as keyof typeof editingRole.specialPermissions] ? "text-indigo-100" : "text-slate-500")}>
                                    {perm.description}
                                 </p>
                              </div>
                           </div>
                         ))}
                      </div>
                   </section>
                </div>

                <DialogFooter className="p-4 sm:p-10 pt-0 bg-white border-t border-slate-50">
                   <div className="flex flex-col sm:flex-row w-full gap-3 sm:gap-4">
                      {editingRole?.id && !editingRole.isSystem && (
                        <Button 
                          variant="ghost" 
                          className="h-14 sm:h-16 rounded-2xl px-8 font-black text-rose-600 bg-rose-50 hover:bg-rose-100"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this blueprint? This action is irreversible.')) {
                              rbacService.deleteRole(editingRole.id!);
                              setIsRoleDialogOpen(false);
                            }
                          }}
                        >
                          <Trash2 className="w-5 h-5 mr-2" /> Decommission
                        </Button>
                      )}
                      <div className="hidden sm:block flex-1" />
                      <Button 
                        variant="ghost" 
                        onClick={() => setIsRoleDialogOpen(false)}
                        className="h-14 sm:h-16 rounded-2xl px-10 font-bold text-slate-500"
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSaveRole}
                        disabled={editingRole?.isSystem}
                        className="h-14 sm:h-16 rounded-2xl px-12 bg-indigo-600 text-white font-black text-lg sm:text-xl shadow-2xl shadow-indigo-600/30 w-full sm:w-auto sm:min-w-[200px]"
                      >
                        <Save className="w-6 h-6 mr-3" /> Save Architecture
                      </Button>
                   </div>
                </DialogFooter>
             </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
