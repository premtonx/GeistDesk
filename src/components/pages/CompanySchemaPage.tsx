import { createElement, useEffect, useState } from 'react';
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
  Briefcase,
  Wand2,
  Save,
  Rocket,
  RefreshCw
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

const INDUSTRY_PRESETS: Record<string, Partial<CustomField>[]> = {
  'IT Support': [
    { type: 'dropdown', label: 'SLA Level', internalName: 'sla_level', options: ['Bronze', 'Silver', 'Gold', 'Platinum'], required: true },
    { type: 'text', label: 'Remote Access Tool', internalName: 'remote_tool', placeholder: 'e.g. AnyDesk, TeamViewer' },
    { type: 'number', label: 'Server Count', internalName: 'server_count' },
    { type: 'text', label: 'Primary OS', internalName: 'primary_os' }
  ],
  'Healthcare': [
    { type: 'text', label: 'Facility Type', internalName: 'facility_type' },
    { type: 'checkbox', label: 'HIPAA Compliant', internalName: 'hipaa_compliant' },
    { type: 'date', label: 'Last Security Audit', internalName: 'last_audit' },
    { type: 'text', label: 'EMR System', internalName: 'emr_system' }
  ],
  'Real Estate': [
    { type: 'dropdown', label: 'Portfolio Type', internalName: 'portfolio_type', options: ['Residential', 'Commercial', 'Industrial'] },
    { type: 'number', label: 'Units Under Managed', internalName: 'managed_units' },
    { type: 'url', label: 'Property Portal', internalName: 'portal_url' }
  ]
};

export default function CompanySchemaPage() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [showPresetDialog, setShowPresetDialog] = useState(false);

  useEffect(() => {
    loadSchema();
  }, []);

  const loadSchema = async () => {
    try {
      const data = await schemaService.getCompanySchema();
      setFields(data.sort((a, b) => a.order - b.order));
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
    setFields(prev => prev.filter(f => f.id !== id));
    toast.success('Field removed');
  };

  const handleSaveSchema = async () => {
    try {
      await schemaService.saveCompanySchema(fields);
      toast.success('Company schema persisted globally');
    } catch (error) {
      toast.error('Failed to save schema');
    }
  };

  const applyPreset = (industry: string) => {
    const preset = INDUSTRY_PRESETS[industry];
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
               <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Database className="w-6 h-6" />
               </div>
               <h1 className="text-2xl font-black text-[#202124] tracking-tight uppercase">Company Schema Architect</h1>
            </div>
            <p className="text-sm text-slate-500 ml-13">Define global metadata for company accounts. Data is indexed by GeistDesk AI for smart context.</p>
          </div>
          <div className="flex gap-3">
             <Button 
                variant="outline" 
                onClick={() => setShowPresetDialog(true)}
                className="rounded-xl font-bold border-indigo-100 bg-indigo-50/30 text-indigo-700 hover:bg-indigo-50"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Industry Power Packs
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
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Field Palette</h3>
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

            <div className="p-6 bg-[#202124] rounded-[2.5rem] text-white space-y-4">
               <div className="flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">AI Moat</span>
               </div>
               <p className="text-xs text-slate-400 leading-relaxed">
                  Every custom field you add is automatically tokenized and injected into the GeistDesk context window during ticket drafting.
               </p>
               <div className="p-3 bg-white/5 rounded-xl border border-white/10 italic text-[10px] text-slate-300">
                  "GeistDesk: This customer has {fields.length > 0 ? fields[0].label : '...'} set to X, adjust tone accordingly."
               </div>
            </div>
          </div>

          {/* Main Canvas */}
          <div className="lg:col-span-3">
             <Card className="rounded-[2.5rem] border-slate-200 min-h-[600px] bg-white shadow-sm">
                <CardHeader className="p-8 border-b border-slate-50">
                   <CardTitle className="text-lg font-bold">Active Fields Portfolio</CardTitle>
                   <CardDescription>Drag and drop to reorder how they appear in the company profile.</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <DragDropContext onDragEnd={handleOnDragEnd}>
                    <Droppable droppableId="schema-fields">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                          {fields.length === 0 ? (
                            <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[2rem]">
                               <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                  <Rocket className="w-8 h-8" />
                               </div>
                               <h3 className="font-bold text-slate-900">Your canvas is empty</h3>
                               <p className="text-xs text-slate-400 mt-2">Start by dragging a field from the palette or pick a power pack.</p>
                            </div>
                          ) : (
                            fields.map((field, index) => (
                              // @ts-ignore
                              <Draggable key={field.id} draggableId={field.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={cn(
                                      "group flex items-center gap-4 p-4 rounded-2xl border transition-all",
                                      snapshot.isDragging ? "bg-white shadow-xl ring-2 ring-primary border-primary z-50" : "bg-slate-50/50 border-slate-100 hover:border-slate-200 hover:bg-white"
                                    )}
                                  >
                                    <div {...provided.dragHandleProps} className="text-slate-300 cursor-grab active:cursor-grabbing hover:text-slate-400">
                                      <GripVertical className="w-5 h-5" />
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm">
                                      {FIELD_TYPES.find(t => t.type === field.type)?.icon && 
                                        createElement(FIELD_TYPES.find(t => t.type === field.type)!.icon, { className: "w-5 h-5" })}
                                    </div>
                                    <div className="flex-1">
                                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                        {field.label}
                                        {field.required && <span className="text-rose-500">*</span>}
                                        {field.visibility === 'admin' && <Lock className="w-3 h-3 text-slate-400" />}
                                      </h4>
                                      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{field.internalName}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                       <div className="flex gap-1">
                                          {field.required && <Badge className="bg-rose-50 text-rose-600 border-rose-100 text-[8px] uppercase">Required</Badge>}
                                          {field.unique && <Badge className="bg-blue-50 text-blue-600 border-blue-100 text-[8px] uppercase">Unique</Badge>}
                                       </div>
                                       <Button variant="ghost" size="icon" onClick={() => setEditingField(field)} className="rounded-xl hover:bg-primary/10 hover:text-primary">
                                          <Settings className="w-4 h-4" />
                                       </Button>
                                       <Button variant="ghost" size="icon" onClick={() => handleDeleteField(field.id)} className="rounded-xl hover:bg-rose-50 hover:text-rose-600">
                                          <Trash2 className="w-4 h-4" />
                                       </Button>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))
                          )}
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
                        value={editingField?.label} 
                        onChange={(e) => setEditingField(prev => prev ? {...prev, label: e.target.value} : null)}
                        className="rounded-xl border-slate-200" 
                      />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Internal Key (Database)</Label>
                      <Input 
                        value={editingField?.internalName} 
                        onChange={(e) => setEditingField(prev => prev ? {...prev, internalName: e.target.value} : null)}
                        className="rounded-xl border-slate-200 font-mono text-xs" 
                      />
                   </div>
                   
                   {editingField?.type === 'dropdown' && (
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Options (Comma separated)</Label>
                        <Input 
                          value={editingField.options?.join(', ')} 
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
                        checked={editingField?.required} 
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
                        <p className="text-[10px] text-slate-500">Ensure values are not duplicated across accounts.</p>
                      </div>
                      <Switch 
                        checked={editingField?.unique} 
                        onCheckedChange={(val) => setEditingField(prev => prev ? {...prev, unique: val} : null)}
                      />
                   </div>
                </div>
            </div>
            <DialogFooter className="p-8 bg-slate-50/50 border-t border-slate-100">
                <Button onClick={handleSaveField} className="w-full rounded-xl font-bold bg-primary text-white h-12">Update Field Definition</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Presets Dialog */}
        <Dialog open={showPresetDialog} onOpenChange={setShowPresetDialog}>
          <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-[2.5rem]">
             <div className="p-10 text-center">
                <div className="w-20 h-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                   <Sparkles className="w-10 h-10 text-indigo-600" />
                </div>
                <DialogTitle className="text-2xl font-black text-slate-900 mb-2">Industry Power Packs</DialogTitle>
                <DialogDescription className="text-slate-500 mb-8">
                   Select your niche to pre-configure standard metadata fields for this workspace.
                </DialogDescription>
                
                <div className="space-y-3">
                   {Object.keys(INDUSTRY_PRESETS).map(industry => (
                     <button
                        key={industry}
                        onClick={() => applyPreset(industry)}
                        className="w-full p-4 flex items-center justify-between bg-white border border-slate-200 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50/30 transition-all group"
                     >
                        <div className="flex items-center gap-4">
                           <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-indigo-600 shadow-sm transition-all">
                              <Briefcase className="w-5 h-5" />
                           </div>
                           <span className="font-bold text-slate-900">{industry}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-black uppercase border-indigo-100 text-indigo-500 px-3">Apply Pack</Badge>
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
