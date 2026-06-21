import React, { useState, useEffect } from 'react';
import { 
  Type, 
  AlignLeft, 
  ChevronDown, 
  CheckSquare, 
  Calendar, 
  Phone, 
  Hash, 
  Link as LinkIcon, 
  Plus, 
  GripVertical, 
  Settings, 
  Trash2, 
  Eye, 
  EyeOff, 
  Lock, 
  Check, 
  X,
  Sparkles,
  Info,
  Database,
  ArrowLeft,
  User,
  Wand2,
  Save,
  Rocket,
  RefreshCw,
  Tags,
  Building2,
  AtSign
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '../../components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs';
import { schemaService, CustomField } from '../../services/schemaService';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { cn } from '../../lib/utils';

const FIELD_TYPES = [
  { type: 'text', label: 'Single Line Text', icon: Type },
  { type: 'paragraph', label: 'Multi-line Text', icon: AlignLeft },
  { type: 'dropdown', label: 'Dropdown Select', icon: ChevronDown },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { type: 'date', label: 'Date Picker', icon: Calendar },
  { type: 'phone', label: 'Phone Number', icon: Phone },
  { type: 'number', label: 'Numeric Value', icon: Hash },
  { type: 'url', label: 'Website/URL', icon: LinkIcon },
];

const CONTACT_PRESETS: Record<string, Partial<CustomField>[]> = {
  'Tech/SaaS': [
    { type: 'text', label: 'Job Role', internalName: 'job_role', placeholder: 'e.g. Developer, Product Manager' },
    { type: 'dropdown', label: 'Seniority', internalName: 'seniority', options: ['Junior', 'Mid', 'Senior', 'Staff', 'Director', 'VP'] },
    { type: 'text', label: 'Preferred Language', internalName: 'lang_pref', placeholder: 'e.g. EN, DE, FR' },
    { type: 'checkbox', label: 'Beta Tester', internalName: 'is_beta_tester' }
  ],
  'Executive/Sales': [
    { type: 'dropdown', label: 'Decision Power', internalName: 'decision_power', options: ['Influencer', 'Economic Buyer', 'Decision Maker', 'Gatekeeper'] },
    { type: 'text', label: 'Hobby/Interest', internalName: 'hobbies', placeholder: 'e.g. Golf, Sailing, Chess' },
    { type: 'dropdown', label: 'Preferred Tool', internalName: 'fav_tool', options: ['Slack', 'Email', 'Teams', 'Phone'] }
  ],
  'Customer Support': [
    { type: 'text', label: 'Skill Set', internalName: 'skill_set' },
    { type: 'dropdown', label: 'Support Tier', internalName: 'support_tier', options: ['Tier 1', 'Tier 2', 'Tier 3'] },
    { type: 'number', label: 'Certificates Count', internalName: 'cert_count' }
  ]
};

const SYSTEM_FIELDS: CustomField[] = [
  { id: 'sys_name', label: 'Full Name', internalName: 'name', type: 'text', required: true, order: -4, visibility: 'agent', unique: false, system: true },
  { id: 'sys_email', label: 'Email Address', internalName: 'email', type: 'text', required: true, order: -3, visibility: 'agent', unique: true, system: true },
  { id: 'sys_company', label: 'Company', internalName: 'company', type: 'text', required: true, order: -2, visibility: 'agent', unique: false, system: true },
  { id: 'sys_tags', label: 'Tags', internalName: 'tags', type: 'text', required: false, order: -1, visibility: 'agent', unique: false, system: true },
];

export default function ContactSchemaPage() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [showPresetDialog, setShowPresetDialog] = useState(false);

  useEffect(() => {
    loadSchema();
  }, []);

  const loadSchema = async () => {
    try {
      const data = await schemaService.getContactSchema();
      // Ensure system fields are present if it's the first time
      let merged = [...data];
      SYSTEM_FIELDS.forEach(sys => {
        if (!merged.find(f => f.id === sys.id)) {
          merged.push(sys);
        }
      });
      setFields(merged.sort((a, b) => a.order - b.order));
    } catch (error) {
      toast.error('Failed to load schema');
    } finally {
      setLoading(false);
    }
  };

  const handleAddField = (typeInfo: any) => {
    const newField: CustomField = {
      id: Math.random().toString(36).substr(2, 9),
      type: typeInfo.type,
      label: `New ${typeInfo.label}`,
      internalName: `field_${Date.now()}`,
      required: false,
      visibility: 'agent',
      unique: false,
      order: fields.length,
      options: typeInfo.type === 'dropdown' ? ['Option 1', 'Option 2'] : undefined
    };
    setFields([...fields, newField]);
    setEditingField(newField);
  };

  const handleOnDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(fields);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedItems = items.map((item: CustomField, index: number) => ({
      ...item,
      order: index
    }));

    setFields(updatedItems);
  };

  const handleSaveField = () => {
    if (!editingField) return;
    setFields(prev => prev.map(f => f.id === editingField.id ? editingField : f));
    setEditingField(null);
  };

  const handleDeleteField = (id: string) => {
    const field = fields.find(f => f.id === id);
    if (field?.system) {
      toast.error('System fields cannot be deleted');
      return;
    }
    setFields(prev => prev.filter(f => f.id !== id));
    toast.success('Field removed');
  };

  const handleSaveSchema = async () => {
    try {
      await schemaService.saveContactSchema(fields);
      toast.success('Contact schema persisted globally');
    } catch (error) {
      toast.error('Failed to save schema');
    }
  };

  const applyPreset = (industry: string) => {
    const preset = CONTACT_PRESETS[industry];
    const newFields = preset.map((p, idx) => ({
      ...p,
      id: Math.random().toString(36).substr(2, 9),
      visibility: 'agent',
      required: p.required || false,
      unique: false,
      order: fields.length + idx
    })) as CustomField[];
    
    setFields([...fields, ...newFields]);
    setShowPresetDialog(false);
    toast.success(`${industry} power pack applied!`);
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-[#fafafa]">
       <RefreshCw className="w-8 h-8 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar">
      <div className="p-8 max-w-6xl mx-auto space-y-8 pb-32">
        <AdminBreadcrumbs />
        
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                  <User className="w-6 h-6" />
               </div>
               <h1 className="text-2xl font-black text-[#202124] tracking-tight uppercase">Contact Schema Architect</h1>
            </div>
            <p className="text-sm text-slate-500 ml-13">Configure custom profile fields for individuals. These fields enhance AI context for automated replies.</p>
          </div>
          <div className="flex gap-3">
             <Button 
                variant="outline" 
                onClick={() => setShowPresetDialog(true)}
                className="rounded-xl font-bold border-indigo-100 bg-indigo-50/30 text-indigo-700 hover:bg-indigo-50"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Contact Profile Packs
             </Button>
             <Button onClick={handleSaveSchema} className="rounded-xl font-bold px-8 shadow-lg shadow-primary/20 bg-primary text-white">
                <Save className="w-4 h-4 mr-2" /> Save Schema
             </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Palette */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="rounded-[2.5rem] border-slate-200 overflow-hidden bg-white shadow-sm">
               <CardHeader className="p-6 bg-slate-50/50 border-b border-slate-100">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Custom Toolset</h3>
               </CardHeader>
               <div className="p-4 space-y-2">
                  {FIELD_TYPES.map((field) => (
                    <button
                      key={field.type}
                      onClick={() => handleAddField(field)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary/5 hover:text-primary transition-all text-xs font-bold text-slate-600 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary">
                        <field.icon className="w-4 h-4" />
                      </div>
                      {field.label}
                      <Plus className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  ))}
               </div>
            </Card>

            <div className="p-6 bg-indigo-900 rounded-[2.5rem] text-white space-y-4">
               <div className="flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-indigo-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Contextual DNA</span>
               </div>
               <p className="text-xs text-indigo-200 leading-relaxed">
                  GeistDesk AI ingests these specific attributes to determine tone. For example, knowing a contact is "Seniority: VP" or " decidido: decision_maker" adjusts politeness levels.
               </p>
               <div className="p-3 bg-white/5 rounded-xl border border-white/10 italic text-[10px] text-indigo-100">
                  "AI Prompt: Adjust reply for ${fields.length > 0 ? fields[0].label : 'Contact'} status..."
               </div>
            </div>
          </div>

          {/* Main Canvas */}
          <div className="lg:col-span-3">
             <Card className="rounded-[2.5rem] border-slate-200 min-h-[600px] bg-white shadow-sm">
                <CardHeader className="p-8 border-b border-slate-50">
                   <CardTitle className="text-lg font-bold">Contact Attribute Blueprint</CardTitle>
                   <CardDescription>System fields are fixed but reorderable. Add custom fields below them.</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <DragDropContext onDragEnd={handleOnDragEnd}>
                    <Droppable droppableId="contact-schema-fields">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                          {fields.map((field, index) => (
                            // @ts-ignore
                            <Draggable key={field.id} draggableId={field.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={cn(
                                    "group flex items-center gap-4 p-4 rounded-2xl border transition-all",
                                    snapshot.isDragging ? "bg-white shadow-xl ring-2 ring-primary border-primary z-50" : "bg-slate-50/50 border-slate-100 hover:border-slate-200 hover:bg-white",
                                    field.system && "opacity-80"
                                  )}
                                >
                                  <div {...provided.dragHandleProps} className="text-slate-300 cursor-grab active:cursor-grabbing hover:text-slate-400">
                                    <GripVertical className="w-5 h-5" />
                                  </div>
                                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm">
                                    {field.system ? (
                                      field.id === 'sys_name' ? <User className="w-5 h-5" /> :
                                      field.id === 'sys_email' ? <AtSign className="w-5 h-5" /> :
                                      field.id === 'sys_company' ? <Building2 className="w-5 h-5" /> :
                                      <Tags className="w-5 h-5" />
                                    ) : (
                                      FIELD_TYPES.find(t => t.type === field.type)?.icon && 
                                      React.createElement(FIELD_TYPES.find(t => t.type === field.type)!.icon, { className: "w-5 h-5" })
                                    )}
                                  </div>
                                  <div className="flex-1 text-sm">
                                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                      {field.label}
                                      {field.required && <span className="text-rose-500">*</span>}
                                      {field.system && <Badge className="bg-slate-100 text-slate-500 border-none text-[8px] uppercase px-1.5 h-4">System</Badge>}
                                      {field.visibility === 'admin' && <Lock className="w-3 h-3 text-slate-400" />}
                                    </h4>
                                    <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{field.internalName}</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                     <div className="flex gap-1">
                                        {field.unique && <Badge className="bg-blue-50 text-blue-600 border-blue-100 text-[8px] uppercase">Unique</Badge>}
                                     </div>
                                     <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => setEditingField(field)} 
                                      className="rounded-xl hover:bg-primary/10 hover:text-primary"
                                      disabled={field.system}
                                     >
                                        <Settings className="w-4 h-4" />
                                     </Button>
                                     <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => handleDeleteField(field.id)} 
                                      className="rounded-xl hover:bg-rose-50 hover:text-rose-600"
                                      disabled={field.system}
                                     >
                                        <Trash2 className="w-4 h-4" />
                                     </Button>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </CardContent>
             </Card>
          </div>
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!editingField} onOpenChange={(open) => !open && setEditingField(null)}>
          <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-[2rem]">
            <DialogHeader className="p-8 pb-4">
                <DialogTitle className="text-xl font-bold">Field Configuration</DialogTitle>
                <DialogDescription>Customize behavior and visibility settings.</DialogDescription>
            </DialogHeader>
            <div className="p-8 pt-4 space-y-6">
                <div className="space-y-4">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Friendly Label</Label>
                      <Input 
                        value={editingField?.label || ''} 
                        onChange={(e) => setEditingField(prev => prev ? {...prev, label: e.target.value} : null)}
                        className="rounded-xl border-slate-200" 
                      />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Internal Key (Database)</Label>
                      <Input 
                        value={editingField?.internalName || ''} 
                        onChange={(e) => setEditingField(prev => prev ? {...prev, internalName: e.target.value} : null)}
                        className="rounded-xl border-slate-200 font-mono text-xs" 
                      />
                   </div>
                   
                   {editingField?.type === 'dropdown' && (
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Options (Comma separated)</Label>
                        <Input 
                          value={editingField?.options?.join(', ') || ''} 
                          onChange={(e) => setEditingField(prev => prev ? {...prev, options: e.target.value.split(',').map(s => s.trim())} : null)}
                          placeholder="Option 1, Option 2, Option 3"
                          className="rounded-xl border-slate-200" 
                        />
                     </div>
                   )}

                   <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <div>
                        <p className="text-sm font-bold text-slate-900">Mandatory Entry</p>
                        <p className="text-[10px] text-slate-500">Block save if field is empty.</p>
                      </div>
                      <Switch 
                        checked={!!editingField?.required} 
                        onCheckedChange={(val) => setEditingField(prev => prev ? {...prev, required: val} : null)}
                      />
                   </div>

                   <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <div>
                        <p className="text-sm font-bold text-slate-900">Agent Visibility</p>
                        <p className="text-[10px] text-slate-500">Hide from regular support agents.</p>
                      </div>
                      <Switch 
                        checked={editingField?.visibility === 'admin'} 
                        onCheckedChange={(val) => setEditingField(prev => prev ? {...prev, visibility: val ? 'admin' : 'agent'} : null)}
                      />
                   </div>

                   <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <div>
                        <p className="text-sm font-bold text-slate-900">Unique Constraint</p>
                        <p className="text-[10px] text-slate-500">Ensure values are not duplicated.</p>
                      </div>
                      <Switch 
                        checked={!!editingField?.unique} 
                        onCheckedChange={(val) => setEditingField(prev => prev ? {...prev, unique: val} : null)}
                      />
                   </div>
                </div>
            </div>
            <DialogFooter className="p-8 bg-slate-50/50 border-t border-slate-100">
                <Button onClick={handleSaveField} className="w-full rounded-xl font-bold bg-primary text-white h-12">Update Attribute</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Presets Dialog */}
        <Dialog open={showPresetDialog} onOpenChange={setShowPresetDialog}>
          <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-[2.5rem]">
             <div className="p-10 text-center">
                <div className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                   <Sparkles className="w-10 h-10 text-primary" />
                </div>
                <DialogTitle className="text-2xl font-black text-slate-900 mb-2">Profile Intel Packs</DialogTitle>
                <DialogDescription className="text-slate-500 mb-8">
                   Select a focus to pre-configure standard attributes for your contacts.
                </DialogDescription>
                
                <div className="space-y-3">
                   {Object.keys(CONTACT_PRESETS).map(industry => (
                     <button
                        key={industry}
                        onClick={() => applyPreset(industry)}
                        className="w-full p-4 flex items-center justify-between bg-white border border-slate-200 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all group"
                     >
                        <div className="flex items-center gap-4">
                           <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-primary shadow-sm transition-all">
                              <User className="w-5 h-5" />
                           </div>
                           <span className="font-bold text-slate-900">{industry}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-black uppercase border-primary/20 text-primary px-3">Inject Pack</Badge>
                     </button>
                   ))}
                </div>
             </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
