import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Bell, 
  User, 
  Users, 
  Layers, 
  Edit3, 
  Save, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  Variable, 
  ArrowLeft,
  ToggleLeft,
  ToggleRight,
  ShieldAlert,
  Bot
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../../components/ui/dropdown-menu';
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs';
import { notificationService, NotificationTemplate } from '../../services/notificationService';
import { toast } from 'sonner';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

export default function NotificationEnginePage() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [isAILoading, setIsAILoading] = useState(false);
  const [toneCheck, setToneCheck] = useState<any>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await notificationService.getTemplates();
      setTemplates(data);
    } catch (error) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await notificationService.updateTemplate(id, { enabled });
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, enabled } : t));
      toast.success(`Template ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const handleSave = async () => {
    if (!editingTemplate) return;
    try {
      await notificationService.updateTemplate(editingTemplate.id, editingTemplate);
      setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? editingTemplate : t));
      setEditingTemplate(null);
      setToneCheck(null);
      toast.success('Template persisted');
    } catch (error) {
      toast.error('Save failed');
    }
  };

  const handleAIDraft = async () => {
    if (!editingTemplate) return;
    setIsAILoading(true);
    try {
      const concept = prompt("Describe what this notification should say (e.g. 'A friendly welcome email for new enterprise customers')");
      if (!concept) {
        setIsAILoading(false);
        return;
      }

      const res = await axios.post('/api/notifications/ai-draft', {
        concept,
        variables: editingTemplate.placeholders,
        tone: 'Professional and premium'
      });

      setEditingTemplate({
        ...editingTemplate,
        subject: res.data.subject,
        body: res.data.body
      });
      toast.success('AI Draft generated');
    } catch (error) {
      toast.error('AI Drafting failed');
    } finally {
      setIsAILoading(false);
    }
  };

  const handleToneCheck = async () => {
    if (!editingTemplate) return;
    setIsAILoading(true);
    try {
      const res = await axios.post('/api/notifications/tone-check', {
        text: editingTemplate.body
      });
      setToneCheck(res.data);
      toast.info(`Tone Rating: ${res.data.rating}`);
    } catch (error) {
      toast.error('Tone check failed');
    } finally {
      setIsAILoading(false);
    }
  };

  const insertPlaceholder = (ph: string) => {
    if (!editingTemplate) return;
    const placeholder = `{{${ph}}}`;
    // Simple insertion at the end for now, could be improved with ref focus/selection
    setEditingTemplate({
      ...editingTemplate,
      body: editingTemplate.body + ' ' + placeholder
    });
  };

  const NotificationList = ({ category }: { category: string }) => (
    <div className="space-y-4">
      {templates.filter(t => t.category === category).map(template => (
        <Card key={template.id} className="rounded-3xl border-slate-200 hover:shadow-md transition-all overflow-hidden group">
          <div className="flex items-center justify-between p-6">
            <div className="flex gap-4 items-center">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                template.enabled ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-400"
              )}>
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  {template.name}
                  {!template.enabled && <Badge variant="secondary" className="bg-slate-100 text-slate-400 text-[9px] uppercase">Inactive</Badge>}
                </h4>
                <p className="text-sm text-slate-500">{template.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 pr-4 border-r border-slate-100">
                <Switch 
                  checked={template.enabled} 
                  onCheckedChange={(val) => handleToggle(template.id, val)} 
                />
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setEditingTemplate(template)}
                className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all"
              >
                <Edit3 className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[#fafafa]">
      <div className="p-8 max-w-5xl mx-auto pb-32">
        <AdminBreadcrumbs />

        <AnimatePresence mode="wait">
          {!editingTemplate ? (
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
                      <Mail className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Email Notifications</h1>
                  </div>
                  <p className="text-slate-500">Manage automated system triggers and templates.</p>
                </div>
              </div>

              <Tabs defaultValue="agent" className="w-full">
                <TabsList className="bg-white border border-slate-200 p-1 rounded-2xl mb-8">
                  <TabsTrigger value="agent" className="rounded-xl font-bold px-6 py-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                    <User className="w-4 h-4 mr-2" /> Agent Alerts
                  </TabsTrigger>
                  <TabsTrigger value="customer" className="rounded-xl font-bold px-6 py-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                    <Users className="w-4 h-4 mr-2" /> Customer Updates
                  </TabsTrigger>
                  {/* <TabsTrigger value="cc" className="rounded-xl font-bold px-6 py-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                    <Layers className="w-4 h-4 mr-2" /> CC Notifications
                  </TabsTrigger> */}
                  <TabsTrigger value="master" className="rounded-xl font-bold px-6 py-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                    <Layers className="w-4 h-4 mr-2" /> Master Templates
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="agent">
                  <NotificationList category="agent" />
                </TabsContent>
                <TabsContent value="customer">
                  <NotificationList category="customer" />
                </TabsContent>
                <TabsContent value="master" className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-slate-200">
                   <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                      <Layers className="w-8 h-8" />
                   </div>
                   <h3 className="font-bold text-slate-900">Master Brand Templates</h3>
                   <p className="text-sm text-slate-400 max-w-xs mx-auto mt-2">Global headers, footers and corporate signatures used across all alerts.</p>
                </TabsContent>
              </Tabs>
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
                  <Button variant="ghost" size="icon" onClick={() => setEditingTemplate(null)} className="rounded-xl">
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{editingTemplate.name}</h2>
                    <p className="text-sm text-slate-500">Editing automated trigger: {editingTemplate.trigger}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={handleAIDraft}
                    disabled={isAILoading}
                    className="rounded-xl font-bold border-indigo-100 bg-indigo-50/30 text-indigo-700 hover:bg-indigo-50"
                  >
                    {isAILoading ? <Bot className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    AI Craft
                  </Button>
                  <Button onClick={handleSave} className="rounded-xl font-bold shadow-lg shadow-primary/20 px-8">
                    <Save className="w-4 h-4 mr-2" /> Save Changes
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <Card className="rounded-[2rem] border-slate-200 overflow-hidden bg-white shadow-sm">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
                      <CardTitle className="text-lg font-bold">Template Content</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Subject Line</Label>
                        <Input 
                          value={editingTemplate.subject} 
                          onChange={(e) => setEditingTemplate({...editingTemplate, subject: e.target.value})}
                          placeholder="Email subject..."
                          className="rounded-xl border-slate-200 h-12 font-medium"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-1">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Body Text</Label>
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={handleToneCheck}
                              disabled={isAILoading}
                              className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50"
                            >
                              Check Tone
                            </Button>
                          </div>
                        </div>
                        <ReactQuill 
                          theme="snow"
                          value={editingTemplate.body} 
                          onChange={(content) => setEditingTemplate({...editingTemplate, body: content})}
                          className="rounded-2xl overflow-hidden border-slate-200"
                          modules={{
                            toolbar: [
                              [{ 'header': [1, 2, false] }],
                              ['bold', 'italic', 'underline'],
                              ['link', 'image'],
                              ['clean']
                            ],
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {toneCheck && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className={cn(
                        "p-6 rounded-3xl border flex gap-4",
                        toneCheck.rating === 'Good' ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                        toneCheck.rating === 'Good' ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                      )}>
                        {toneCheck.rating === 'Good' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">AI Tone Analysis: {toneCheck.rating}</h4>
                        <p className="text-sm text-slate-600 mt-1">{toneCheck.suggestion}</p>
                        <div className="flex gap-4 mt-3">
                           {toneCheck.isRobotic && <Badge variant="destructive" className="bg-amber-100 text-amber-700 border-none font-bold uppercase text-[8px]">Robotic Pattern Detected</Badge>}
                           {toneCheck.isUnfriendly && <Badge variant="destructive" className="bg-rose-100 text-rose-700 border-none font-bold uppercase text-[8px]">Unfriendly Tone</Badge>}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="space-y-6">
                  <Card className="rounded-[2.5rem] p-8 border-slate-200 shadow-sm bg-white">
                    <h3 className="text-sm font-black uppercase tracking-[0.1em] text-slate-400 mb-6 flex items-center gap-2">
                       <Variable className="w-4 h-4" /> Variable Picker
                    </h3>
                    <p className="text-xs text-slate-500 mb-6 leading-relaxed">Insert dynamic data from your database using double-curly brackets.</p>
                    
                    <div className="flex flex-wrap gap-2">
                      {editingTemplate.placeholders.map(ph => (
                        <Button 
                          key={ph} 
                          variant="outline" 
                          size="sm" 
                          onClick={() => insertPlaceholder(ph)}
                          className="rounded-full h-8 text-[11px] font-bold border-slate-100 hover:border-primary hover:text-primary transition-all bg-slate-50/50"
                        >
                          {ph}
                        </Button>
                      ))}
                    </div>

                    <div className="mt-10 p-5 bg-primary/5 rounded-2xl border border-primary/10">
                       <h4 className="text-[10px] font-black uppercase text-primary tracking-widest mb-2 flex items-center gap-2">
                          <ShieldAlert className="w-3 h-3" /> Note on Hydration
                       </h4>
                       <p className="text-[10px] text-slate-600 leading-normal">Variables are resolved in production during the dispatch phase. Ensure correct syntax before saving.</p>
                    </div>
                  </Card>

                  <Card className="rounded-[2.5rem] p-8 border-slate-200 shadow-sm bg-slate-900 text-white overflow-hidden relative">
                    <div className="absolute -right-4 -bottom-4 opacity-10">
                       <Mail className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                      <h3 className="font-bold text-lg mb-2">Live Preview</h3>
                      <p className="text-xs text-slate-400 mb-6">See how this message appears with sample data.</p>
                      
                      <div className="space-y-4">
                        <Button variant="outline" className="w-full rounded-xl border-slate-700 bg-transparent text-slate-300 font-bold hover:bg-slate-800">
                          Send Test to Me
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
