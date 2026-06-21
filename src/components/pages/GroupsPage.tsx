import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  MoreHorizontal, 
  Edit3, 
  Trash2, 
  LayoutGrid, 
  ArrowLeft,
  Clock,
  UserPlus,
  UserMinus,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Calendar,
  Save,
  ShieldCheck,
  Star
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../../components/ui/dropdown-menu';
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs';
import { groupService } from '../../services/groupService';
import { userService } from '../../services/userService';
import { Group, User, GroupMember } from '../../types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Partial<Group> | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [agentSearchQuery, setAgentSearchQuery] = useState('');

  useEffect(() => {
    loadData();
    const unsubGroups = groupService.subscribeToGroups(setGroups);
    return () => unsubGroups();
  }, []);

  const loadData = async () => {
    try {
      const agentList = await userService.getAgents();
      setAgents(agentList);
    } catch (error) {
      toast.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (editingGroup?.id) {
      const unsubMembers = groupService.subscribeToMembers(editingGroup.id, setGroupMembers);
      return () => unsubMembers();
    } else {
      setGroupMembers([]);
    }
  }, [editingGroup?.id]);

  const filteredGroups = useMemo(() => {
    return groups.filter(g => 
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [groups, searchQuery]);

  const filteredAgents = useMemo(() => {
    return agents.filter(a => 
      a.name.toLowerCase().includes(agentSearchQuery.toLowerCase()) ||
      a.email.toLowerCase().includes(agentSearchQuery.toLowerCase())
    );
  }, [agents, agentSearchQuery]);

  const handleCreateGroup = () => {
    setEditingGroup({
      name: '',
      description: '',
      isDefault: false
    });
    setIsEditing(true);
  };

  const handleEditGroup = (group: Group) => {
    setEditingGroup(group);
    setIsEditing(true);
  };

  const handleSaveGroup = async () => {
    if (!editingGroup?.name) {
      toast.error("Group name is required");
      return;
    }

    try {
      if (editingGroup.id) {
        await groupService.updateGroup(editingGroup.id, editingGroup);
        toast.success("Group updated");
      } else {
        const id = await groupService.createGroup(editingGroup as any);
        setEditingGroup(prev => ({ ...prev, id }));
        toast.success("Group created");
      }
      // Keep in editing mode to allow member assignment if just created
    } catch (error) {
      toast.error("Failed to save group");
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm("Are you sure? This will delete the group and remove all member associations.")) return;
    try {
      await groupService.deleteGroup(id);
      toast.success("Group deleted");
      if (editingGroup?.id === id) {
        setIsEditing(false);
        setEditingGroup(null);
      }
    } catch (error) {
      toast.error("Delete failed");
    }
  };

  const toggleMember = async (userId: string) => {
    if (!editingGroup?.id) {
      toast.error("Save the group first before assigning members");
      return;
    }

    const isMember = groupMembers.some(m => m.userId === userId);
    try {
      if (isMember) {
        await groupService.removeMember(editingGroup.id, userId);
      } else {
        await groupService.addMember(editingGroup.id, userId);
      }
    } catch (error) {
      toast.error("Update failed");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#fafafa]">
      <div className="p-8 max-w-6xl mx-auto pb-32">
        <AdminBreadcrumbs />

        <AnimatePresence mode="wait">
          {!isEditing ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="flex items-center justify-between mb-10">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <Users className="w-6 h-6" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">Functional Teams</h1>
                  </div>
                  <p className="text-slate-500 text-lg">Manage groups and primary routing targets.</p>
                </div>
                <Button onClick={handleCreateGroup} className="rounded-2xl h-12 px-6 font-bold shadow-lg shadow-primary/20">
                  <Plus className="w-5 h-5 mr-2" /> Create Group
                </Button>
              </div>

              <div className="relative mb-8">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input 
                  placeholder="Search groups by name or description..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-14 rounded-2xl bg-white border-slate-200 shadow-sm text-lg"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredGroups.map(group => (
                  <Card key={group.id} className="rounded-3xl border-slate-200 hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden" onClick={() => handleEditGroup(group)}>
                    {group.isDefault && (
                      <div className="absolute top-0 right-0 p-3">
                        <Badge className="bg-primary/10 text-primary border-none font-bold uppercase text-[9px] tracking-wider">
                          <Star className="w-3 h-3 mr-1 fill-primary" /> Default Group
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xl font-bold text-slate-900 group-hover:text-primary transition-colors">{group.name}</CardTitle>
                      <CardDescription className="line-clamp-2 min-h-[40px]">{group.description || 'No description provided.'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2">
                             {[1, 2, 3].map(i => (
                               <div key={i} className="w-7 h-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                  {i}
                               </div>
                             ))}
                          </div>
                          <span className="text-xs font-bold text-slate-500 ml-1">Team Members</span>
                        </div>
                        <div className="text-right">
                           <DropdownMenu>
                             <DropdownMenuTrigger 
                               render={
                                 <Button variant="ghost" size="icon" className="rounded-xl" onClick={(e) => e.stopPropagation()}>
                                   <MoreHorizontal className="w-5 h-5" />
                                 </Button>
                               }
                             />
                             <DropdownMenuContent align="end" className="rounded-xl border-slate-200">
                               <DropdownMenuItem onClick={() => handleEditGroup(group)}>
                                 <Edit3 className="w-4 h-4 mr-2" /> Edit Group
                               </DropdownMenuItem>
                               <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={() => handleDeleteGroup(group.id)}>
                                 <Trash2 className="w-4 h-4 mr-2" /> Delete Group
                               </DropdownMenuItem>
                             </DropdownMenuContent>
                           </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {filteredGroups.length === 0 && (
                  <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                      <Users className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">No groups found</h3>
                    <p className="text-slate-500 mt-1">Try a different search or create a new team.</p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="editor"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)} className="rounded-xl">
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">{editingGroup?.id ? 'Edit Team' : 'New Team Integration'}</h2>
                    <p className="text-sm text-slate-500">Configure routing properties and agent membership.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setIsEditing(false)} className="rounded-xl font-bold px-6">
                    Cancel
                  </Button>
                  <Button onClick={handleSaveGroup} className="rounded-xl font-bold px-8 shadow-lg shadow-primary/20">
                    <Save className="w-5 h-5 mr-2" /> {editingGroup?.id ? 'Update Group' : 'Initialize Group'}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <Card className="rounded-[2.5rem] border-slate-200 overflow-hidden shadow-sm">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
                       <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg font-bold">Group Identity</CardTitle>
                            <CardDescription>Core details used for internal identification.</CardDescription>
                          </div>
                          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100">
                             <Label htmlFor="is-default" className="text-xs font-bold text-slate-600">Default Group</Label>
                             <Switch 
                               id="is-default"
                               checked={!!editingGroup?.isDefault} 
                               onCheckedChange={(val) => setEditingGroup(prev => ({ ...prev!, isDefault: val }))}
                             />
                          </div>
                       </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Group Name</Label>
                        <Input 
                          value={editingGroup?.name || ''} 
                          onChange={(e) => setEditingGroup(prev => ({ ...prev!, name: e.target.value }))}
                          placeholder="e.g. Technical Support Tier 2"
                          className="rounded-xl border-slate-200 h-14 text-lg font-medium"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Description</Label>
                        <Textarea 
                          value={editingGroup?.description || ''} 
                          onChange={(e) => setEditingGroup(prev => ({ ...prev!, description: e.target.value }))}
                          placeholder="What tickets should be routed to this team?"
                          className="rounded-xl border-slate-200 min-h-[120px] py-4 text-slate-600"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[2.5rem] border-slate-200 overflow-hidden shadow-sm">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8 flex flex-row items-center justify-between">
                       <div>
                          <CardTitle className="text-lg font-bold">Member Assignment</CardTitle>
                          <CardDescription>Select which agents belong to this functional team.</CardDescription>
                       </div>
                       <Badge variant="outline" className="rounded-full bg-white font-bold h-7 px-3 border-slate-200">
                          {groupMembers.length} Selected
                       </Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="p-6 border-b border-slate-100">
                         <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input 
                               placeholder="Search agents by name or email..." 
                               value={agentSearchQuery}
                               onChange={(e) => setAgentSearchQuery(e.target.value)}
                               className="pl-10 h-12 rounded-xl bg-slate-50 border-none ring-0 focus-visible:ring-1 focus-visible:ring-primary"
                            />
                         </div>
                      </div>
                      <ScrollArea className="h-[400px]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100">
                           {filteredAgents.map(agent => {
                             const isMember = groupMembers.some(m => m.userId === agent.id);
                             return (
                               <div 
                                 key={agent.id} 
                                 className={cn(
                                   "p-4 bg-white flex items-center justify-between transition-all hover:bg-slate-50",
                                   isMember ? "bg-primary/5 hover:bg-primary/10" : "bg-white"
                                 )}
                               >
                                 <div className="flex items-center gap-3">
                                   <Avatar className="h-10 w-10 border border-slate-100">
                                     <AvatarImage src={agent.avatar} />
                                     <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                       {agent.name.charAt(0)}
                                     </AvatarFallback>
                                   </Avatar>
                                   <div className="flex flex-col">
                                     <span className="text-sm font-bold text-slate-900">{agent.name}</span>
                                     <span className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">{agent.role}</span>
                                   </div>
                                 </div>
                                 <Button 
                                   variant={isMember ? "ghost" : "outline"}
                                   size="sm"
                                   onClick={() => toggleMember(agent.id)}
                                   className={cn(
                                     "rounded-lg font-bold h-9 px-4 text-xs",
                                     isMember ? "text-rose-600 hover:text-rose-700 hover:bg-rose-50" : "text-primary border-primary/20 hover:border-primary hover:bg-primary/5"
                                   )}
                                 >
                                   {isMember ? (
                                     <> <UserMinus className="w-3.5 h-3.5 mr-2" /> Remove</>
                                   ) : (
                                     <> <UserPlus className="w-3.5 h-3.5 mr-2" /> Assign</>
                                   )}
                                 </Button>
                               </div>
                             );
                           })}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-8">
                  <Card className="rounded-[2.5rem] p-8 border-slate-200 shadow-sm bg-white">
                    <h3 className="text-sm font-black uppercase tracking-[0.1em] text-slate-400 mb-6 flex items-center gap-2">
                       <Clock className="w-5 h-5" /> Availability & SLA
                    </h3>
                    
                    <div className="space-y-6">
                       <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                             <Label className="text-sm font-bold">Business Hours</Label>
                             <p className="text-[10px] text-slate-500">Link a specific calendar to this group.</p>
                          </div>
                          <Switch />
                       </div>
                       
                       <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex items-center gap-2 text-slate-400 mb-2">
                             <Calendar className="w-4 h-4" />
                             <span className="text-[10px] font-black uppercase tracking-widest">Schedule Reference</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed font-medium">Currently using "Global Support Hours" (Mon-Fri, 9am-6pm CEST).</p>
                       </div>

                       <div className="space-y-4 pt-4 border-t border-slate-100 text-slate-900 group">
                          <div className="flex items-center gap-2">
                             <ShieldCheck className="w-4 h-4 text-emerald-500" />
                             <span className="text-xs font-bold">Auto-Redaction Enabled</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <CheckCircle2 className="w-4 h-4 text-primary" />
                             <span className="text-xs font-bold">Load-Balanced Assignment</span>
                          </div>
                       </div>
                    </div>
                  </Card>

                  <Card className="rounded-[2.5rem] p-8 border-slate-200 shadow-sm bg-slate-900 text-white overflow-hidden relative">
                    <div className="absolute -right-4 -bottom-4 opacity-10">
                       <Users className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                      <h3 className="font-bold text-lg mb-2">Routing Intelligence</h3>
                      <p className="text-xs text-slate-400 mb-6">How tickets reach this group.</p>
                      
                      <div className="space-y-3">
                         <div className="flex items-center gap-2 text-xs font-medium bg-slate-800/50 p-2 rounded-xl border border-slate-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            Direct Assignment (@mentions)
                         </div>
                         <div className="flex items-center gap-2 text-xs font-medium bg-slate-800/50 p-2 rounded-xl border border-slate-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            Topic: Billing & Invoicing
                         </div>
                         <div className="flex items-center gap-2 text-xs font-medium bg-slate-800/50 p-2 rounded-xl border border-slate-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            Email Channel: billing@geistdesk.com
                         </div>
                      </div>

                      <div className="mt-8 pt-8 border-t border-slate-800">
                         <Button variant="outline" className="w-full rounded-xl border-slate-700 bg-transparent text-slate-300 font-bold hover:bg-slate-800">
                            Configure Routing Rules
                         </Button>
                      </div>
                    </div>
                  </Card>

                  {editingGroup?.id && (
                    <Button 
                      variant="ghost" 
                      onClick={() => handleDeleteGroup(editingGroup.id!)}
                      className="w-full rounded-2xl h-14 text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold"
                    >
                      <Trash2 className="w-5 h-5 mr-2" /> Delete Functional Team
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
