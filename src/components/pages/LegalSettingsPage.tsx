import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { getModuleConfig, saveModuleConfig, ModuleConfig } from '../../lib/module-config';
import { toast } from 'sonner';
import { ShieldAlert, BookOpen, Save, History, Lock, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';

import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs';

import { usePermissions } from '../../hooks/usePermissions';

export default function LegalSettingsPage() {
  const { hasSpecialPermission } = usePermissions();
  const [config, setConfig] = useState<ModuleConfig>(getModuleConfig());
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = hasSpecialPermission('aiGovernance');

  const handleSave = () => {
    if (!canEdit) {
      toast.error("You lack the AI Governance Grant required to commit these changes.");
      return;
    }
    setIsSaving(true);
    saveModuleConfig(config);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Legal Guardrails synchronized across all AI nodes.");
    }, 800);
  };

  return (
    <div className="flex-1 overflow-y-auto min-h-0 bg-[#fafafa] custom-scrollbar">
      <div className="p-8 max-w-4xl mx-auto space-y-8 pb-20">
        <AdminBreadcrumbs />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#202124] tracking-tight uppercase">GeistDesk Legal Guardrail</h1>
            <p className="text-sm text-[#5F6368] font-medium">Define algorithmic boundaries and forbidden legal/financial responses.</p>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !canEdit}
            className="rounded-xl bg-[#202124] text-white hover:bg-black font-bold h-11 px-6 gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Syncing..." : "Commit Changes"}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Card className={cn("shadow-sm border-[#DADCE0] rounded-3xl overflow-hidden", !canEdit && "opacity-75 relative")}>
            {!canEdit && (
              <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-10 flex items-center justify-center pointer-events-none">
                 <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-200 flex items-center gap-3">
                    <Lock className="w-5 h-5 text-amber-600" />
                    <span className="text-sm font-bold text-slate-900">AI Governance Manager Authorization Required</span>
                 </div>
              </div>
            )}
            <CardHeader className="bg-white border-b border-[#F1F3F4] px-8 py-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-100 text-amber-600">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">Company Policy & Guardrails</CardTitle>
                  <CardDescription className="text-xs">The AI Interceptor will block any response that violates these rules.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase text-[#5F6368] tracking-widest leading-none">Internal Compliance Charter & System Prompt</Label>
                    <Badge variant="outline" className="text-[9px] border-emerald-200 text-emerald-700">Authoritative Node</Badge>
                  </div>
                  <Textarea 
                    value={config.legalPolicy}
                    onChange={(e) => setConfig({ ...config, legalPolicy: e.target.value })}
                    disabled={!canEdit}
                    placeholder="Enter the primary system prompt and compliance rules..."
                    className="min-h-[300px] rounded-2xl border-[#DADCE0] bg-[#F1F3F4]/30 focus:bg-white transition-all font-mono text-sm leading-relaxed p-6 shadow-inner"
                  />
                </div>

                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase text-[#5F6368] tracking-widest leading-none">Forbidden Response Lexicon</Label>
                  <Textarea 
                    value={config.forbiddenText || ''}
                    onChange={(e) => setConfig({ ...config, forbiddenText: e.target.value })}
                    disabled={!canEdit}
                    placeholder="Comma separated list of terms the AI can NEVER use (e.g. 'Guarantee', 'Legal Contract', 'Financial Advice')"
                    className="min-h-[120px] rounded-2xl border-[#DADCE0] bg-[#F1F3F4]/30 focus:bg-white transition-all font-mono text-sm leading-relaxed p-6"
                  />
                  <p className="text-[10px] text-rose-600 font-bold italic uppercase tracking-tight flex items-center gap-2">
                    <Trash2 className="w-3 h-3" /> Hardware-level blocking enabled for these terms.
                  </p>
                </div>
                
                <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-slate-50">
                  <div className="flex-1 p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
                    <span className="text-[10px] font-bold text-blue-700 uppercase flex items-center gap-2 mb-2">
                       <BookOpen className="w-3 h-3" /> Best Practice
                    </span>
                    <p className="text-[11px] text-blue-800 leading-normal">
                      Be explicit about forbidden phrases. Instead of "avoid legal advice", use "Refuse requests for legal interpretations of specific contracts."
                    </p>
                  </div>
                  <div className="flex-1 p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase flex items-center gap-2 mb-2">
                       <History className="w-3 h-3" /> Audit Integration
                    </span>
                    <p className="text-[11px] text-emerald-800 leading-normal">
                      Every violation detected by the model is logged to the Compliance Logs table with the full context for supervisor review.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
