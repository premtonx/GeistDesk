import { type FormEvent, type KeyboardEvent } from 'react';
import {
  Lock,
  Unlock,
  Key as KeyIcon,
  Globe,
  Shield,
  Database,
  Terminal,
  Monitor,
  Cloud,
  FileCode,
  ArrowRight,
  Upload,
  Copy,
  Check,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Eye,
  EyeOff,
  File,
  Tag,
  ExternalLink,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import type { VaultEntryDraft } from './vaultEntryTypes';

export interface VaultEntryCreateWorkspaceProps {
  newEntry: Partial<VaultEntryDraft>;
  setNewEntry: React.Dispatch<React.SetStateAction<Partial<VaultEntryDraft>>>;
  wizardStep: 1 | 2 | 3 | 4;
  setWizardStep: React.Dispatch<React.SetStateAction<1 | 2 | 3 | 4>>;
  rawPassword: string;
  setRawPassword: React.Dispatch<React.SetStateAction<string>>;
  tagInput: string;
  setTagInput: React.Dispatch<React.SetStateAction<string>>;
  handleAddNewTag: (e: KeyboardEvent) => void;
  handleRemoveExistingTag: (idx: number) => void;
  revealPassword: boolean;
  setRevealPassword: React.Dispatch<React.SetStateAction<boolean>>;
  genLength: number;
  setGenLength: React.Dispatch<React.SetStateAction<number>>;
  genUpper: boolean;
  setGenUpper: React.Dispatch<React.SetStateAction<boolean>>;
  genLower: boolean;
  setGenLower: React.Dispatch<React.SetStateAction<boolean>>;
  genNumbers: boolean;
  setGenNumbers: React.Dispatch<React.SetStateAction<boolean>>;
  genSymbols: boolean;
  setGenSymbols: React.Dispatch<React.SetStateAction<boolean>>;
  genExclude: string;
  setGenExclude: React.Dispatch<React.SetStateAction<string>>;
  showGenOptions: boolean;
  setShowGenOptions: React.Dispatch<React.SetStateAction<boolean>>;
  draggingFile: boolean;
  setDraggingFile: React.Dispatch<React.SetStateAction<boolean>>;
  handleGeneratePasswordSubmit: () => void;
  getPasswordStrengthScore: (pass: string) => { score: number; text: string; color: string };
  isSaving: boolean;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
  onSaveDraft: () => void;
  className?: string;
}

export function VaultEntryCreateWorkspace({
  newEntry,
  setNewEntry,
  wizardStep,
  setWizardStep,
  rawPassword,
  setRawPassword,
  tagInput,
  setTagInput,
  handleAddNewTag,
  handleRemoveExistingTag,
  revealPassword,
  setRevealPassword,
  genLength,
  setGenLength,
  genUpper,
  setGenUpper,
  genLower,
  setGenLower,
  genNumbers,
  setGenNumbers,
  genSymbols,
  setGenSymbols,
  genExclude,
  setGenExclude,
  showGenOptions,
  setShowGenOptions,
  draggingFile,
  setDraggingFile,
  handleGeneratePasswordSubmit,
  getPasswordStrengthScore,
  isSaving,
  onSubmit,
  onClose,
  onSaveDraft,
  className,
}: VaultEntryCreateWorkspaceProps) {
  return (
    <div className={cn('flex flex-col flex-1 min-h-0 h-full bg-[#F8F9FB]', className)}>
<form onSubmit={onSubmit} className="flex flex-col h-full w-full">
  
  {/* Modal Body: Sidebar + Main Content Grid */}
  <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden min-h-0">
    
    {/* 1. Left Sidebar Navigation & Status (width: 320px on md+) */}
    <div className="w-full md:w-[320px] bg-white border-b md:border-b-0 md:border-r border-[#E5E7EB] flex flex-col p-6 overflow-y-auto md:shrink-0 space-y-6">
      <div>
        <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none">Create New Vault Entry</h3>
        <p className="text-[11px] text-slate-500 font-medium mt-1.5 leading-relaxed">
          Securely capture and store sensitive corporate infrastructure access details.
        </p>
      </div>

      {/* Vertical Navigation Steps */}
      <div id="wizard-navigation" className="space-y-1 py-2">
        {[
          { id: 1, label: 'Asset Details', sub: 'Basic label and class info' },
          { id: 2, label: 'Access Credentials', sub: 'ID, raw secrets & TOTP code' },
          { id: 3, label: 'Advanced Settings', sub: 'Policies, tags & asset links' },
          { id: 4, label: 'Review & Publish', sub: 'Validate configuration options' }
        ].map((step) => {
          const isActive = wizardStep === step.id;
          const isCompleted = wizardStep > step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setWizardStep(step.id as any)}
              className={cn(
                "w-full text-left p-3 rounded-xl flex items-start gap-3 transition-all",
                isActive 
                  ? "bg-blue-50/50 border border-blue-100 text-[#1A73E8]" 
                  : "hover:bg-slate-50 text-slate-600 border border-transparent"
              )}
            >
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5",
                isActive 
                  ? "bg-[#1A73E8] text-white" 
                  : isCompleted 
                    ? "bg-green-100 text-green-700" 
                    : "bg-slate-100 text-slate-500"
              )}>
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : step.id}
              </div>
              <div className="truncate">
                <span className={cn("text-xs font-bold block", isActive ? "text-[#1A73E8]" : "text-slate-800")}>
                  {step.label}
                </span>
                <span className="text-[9px] text-slate-400 font-medium tracking-wide block">
                  {step.sub}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Zero-Knowledge Privacy Card */}
      <div className="bg-gradient-to-br from-blue-50/40 to-indigo-50/30 border border-blue-100/60 p-4 rounded-2xl space-y-2">
        <div className="flex items-center gap-2 text-[#1A73E8]">
          <Shield className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-wider">Zero-Knowledge Security</span>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Credentials are key-derived using <strong>Argon2</strong> and locally encrypted in client memory with <strong>AES-256</strong> prior to backup sync.
        </p>
        <div className="text-[9px] text-[#1a73e8] font-bold hover:underline cursor-pointer flex items-center gap-1">
          Learn encryption mechanism <ArrowRight className="w-2.5 h-2.5" />
        </div>
      </div>

      {/* Real-time Document Live Preview Card */}
      <div className="bg-[#F8F9FA] border border-[#DADCE0] p-4 rounded-2xl space-y-3 shadow-xs">
        <span className="text-[9px] font-black text-[#5F6368] uppercase tracking-widest block">
          Record Live Preview
        </span>
        
        <div className="space-y-2 text-[11px] leading-none">
          <div className="flex justify-between pb-1.5 border-b border-dashed border-slate-200">
            <span className="text-slate-400 font-medium">Category</span>
            <span className="font-bold text-slate-700 capitalize flex items-center gap-1">
              {newEntry.type || 'Web'}
            </span>
          </div>

          <div className="flex justify-between pb-1.5 border-b border-dashed border-slate-200">
            <span className="text-slate-400 font-medium">Vault</span>
            <span className="font-bold text-slate-700">
              {newEntry.vaultId === 'local' ? 'Personal Local Vault' : 
               newEntry.vaultId === 'team' ? 'Team Shared Vault' :
               newEntry.vaultId === 'department' ? 'Department Vault' : 'Emergency Vault'}
            </span>
          </div>

          <div className="flex justify-between pb-1.5 border-b border-dashed border-slate-200">
            <span className="text-slate-400 font-medium">Encryption Status</span>
            <span className="font-bold text-[#137333] bg-green-50 px-1.5 py-0.5 rounded text-[9px]">
              AES-256 Enabled
            </span>
          </div>

          <div className="flex justify-between pb-1.5 border-b border-dashed border-slate-200">
            <span className="text-slate-400 font-medium">Visibility Scope</span>
            <span className="font-bold text-slate-700 capitalize">
              {newEntry.visibility || 'Private'}
            </span>
          </div>

          <div className="flex justify-between pb-1.5 border-b border-dashed border-slate-200">
            <span className="text-slate-400 font-medium">Company Context</span>
            <span className="font-bold text-[#1A73E8]">
              {newEntry.linkedCompany || 'Unset'}
            </span>
          </div>

          <div className="flex justify-between pb-1.5 border-b border-dashed border-slate-200">
            <span className="text-slate-400 font-medium">Asset Name</span>
            <span className="font-bold text-slate-700 truncate max-w-[120px]" title={newEntry.label}>
              {newEntry.label || 'e.g. AWS Console'}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400 font-medium">Owner Assigned</span>
            <span className="font-bold text-slate-700 truncate max-w-[120px]">
              {newEntry.owner || 'You'}
            </span>
          </div>
        </div>
      </div>
    </div>

    {/* 2. Main Tabbed Layout Panel */}
    <div className="flex-1 bg-white overflow-y-auto p-8 flex flex-col justify-between">
      <div>
        
        {/* Step Header */}
        {wizardStep === 1 && (
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1A73E8] flex items-center justify-center font-black text-sm">
                1
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800 leading-snug">Asset Details</h4>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Select the class classification and declare friendly identifiers for infrastructure.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-black text-[#1A73E8] bg-blue-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
              Step 1 of 4
            </span>
          </div>
        )}

        {wizardStep === 2 && (
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-sm">
                2
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800 leading-snug">Access Credentials</h4>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Capture identifiers and secure credentials. Leverage built-in enterprise generation parameters.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
              Step 2 of 4
            </span>
          </div>
        )}

        {wizardStep === 3 && (
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-black text-sm">
                3
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800 leading-snug">Advanced Settings</h4>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Enforce access controls, policy timers, linkages, and document classification markers.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-black text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
              Step 3 of 4
            </span>
          </div>
        )}

        {wizardStep === 4 && (
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black text-sm">
                4
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800 leading-snug">Review & Publish Secure Entry</h4>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Review policies and local verification parameters before sealing raw payload in IndexedDB.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
              Final Review
            </span>
          </div>
        )}

        {/* -------------------- STEP 1 CONTAINER -------------------- */}
        {wizardStep === 1 && (
          <div className="space-y-6">
            {/* Grid Category Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                Asset Category Model Selection <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { slug: 'web', name: 'Web Login', desc: 'Secure connection logs to web interfaces & SaaS pipelines.', icon: Globe },
                  { slug: 'rdp', name: 'RDP Session', desc: 'Remote desktop systems console access.', icon: Monitor },
                  { slug: 'vpn', name: 'VPN Access', desc: 'Sovereign security tunnel points & clients.', icon: Shield },
                  { slug: 'ssh', name: 'SSH Node', desc: 'Command line network core servers & nodes.', icon: Terminal },
                  { slug: 'db', name: 'Database', desc: 'Relational or NoSQL active datastores & servers.', icon: Database },
                  { slug: 'api', name: 'API Key', desc: 'Integration tokens, payment terminals & API keys.', icon: KeyIcon },
                  { slug: 'cert', name: 'Certificate', desc: 'TLS/SSL domain identities & root key strings.', icon: FileCode },
                  { slug: 'note', name: 'Secure Note', desc: 'Disaster recovery manuals & critical parameters.', icon: FileCode },
                  { slug: 'cloud', name: 'Cloud Account', desc: 'AWS consoles, GCP clouds & Azure directories.', icon: Cloud }
                ].map((cat) => {
                  const IconComp = cat.icon;
                  const isSelected = newEntry.type === cat.slug;
                  return (
                    <button
                      key={cat.slug}
                      type="button"
                      onClick={() => setNewEntry({ ...newEntry, type: cat.slug })}
                      className={cn(
                        "text-left p-3.5 rounded-2xl border transition-all flex gap-3 h-24 items-start select-none",
                        isSelected 
                          ? "border-[#1A73E8] bg-blue-50/20 shadow-xs ring-1 ring-[#1A73E8]"
                          : "border-[#DADCE0] hover:border-slate-300 bg-white"
                      )}
                    >
                      <div className={cn(
                        "p-2 rounded-xl mt-0.5",
                        isSelected ? "bg-blue-100/50 text-[#1A73E8]" : "bg-slate-50 text-slate-400"
                      )}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-black text-slate-800 block">{cat.name}</span>
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-0.5 line-clamp-2">
                          {cat.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Name Label & Endpoint URL */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                  Asset Friendly Name <span className="text-red-500">*</span>
                </label>
                <Input 
                  placeholder="e.g. AWS Production Console" 
                  value={newEntry.label || ''}
                  onChange={(e) => setNewEntry({ ...newEntry, label: e.target.value })}
                  className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                  Host Target / Endpoint URL
                </label>
                <Input 
                  placeholder="e.g. console.aws.amazon.com or 10.0.1.200" 
                  value={newEntry.host || ''}
                  onChange={(e) => setNewEntry({ ...newEntry, host: e.target.value })}
                  className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm"
                />
              </div>
            </div>

            {/* Internal Notes Description Area */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                Internal Documentation & Instructions
              </label>
              <Textarea 
                placeholder="Provide detailed instructions, restore recovery guidelines or administration context notes..."
                value={newEntry.notes || ''}
                onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                className="bg-white border-[#DADCE0] rounded-xl text-sm h-20 resize-none"
              />
            </div>

            {/* Vault Assignation & Visibility level */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                  Assign to Secure Vault Partition
                </label>
                <Select 
                  value={newEntry.vaultId} 
                  onValueChange={(val) => setNewEntry({ ...newEntry, vaultId: val })}
                >
                  <SelectTrigger className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm">
                    <SelectValue placeholder="Personal Local Vault" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Personal Local Vault (Standard)</SelectItem>
                    <SelectItem value="team">Team Shared Vault (Joint Ops)</SelectItem>
                    <SelectItem value="department">Department Vault (Scoped)</SelectItem>
                    <SelectItem value="emergency">Emergency Vault (Breakglass)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                  Access Visibility Level
                </label>
                <Select 
                  value={newEntry.visibility || 'private'} 
                  onValueChange={(val) => setNewEntry({ ...newEntry, visibility: val })}
                >
                  <SelectTrigger className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private (Only You)</SelectItem>
                    <SelectItem value="shared">Shared (Designated Peers)</SelectItem>
                    <SelectItem value="department_vis">Department Scoped (SysAdmins)</SelectItem>
                    <SelectItem value="organization">Organization (Full MSP / SOC Access)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- STEP 2 CONTAINER -------------------- */}
        {wizardStep === 2 && (
          <div className="space-y-6">
            <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              Provide at least one shareable field: username, password, host, notes, or TOTP secret.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                  Username / System Principal Access Identifier
                </label>
                <Input 
                  placeholder="e.g. root, administrator, ec2-user" 
                  value={newEntry.username || ''}
                  onChange={(e) => setNewEntry({ ...newEntry, username: e.target.value })}
                  className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm"
                />
              </div>

              {/* Password with Strength Indicator */}
              <div className="space-y-1">
                <div className="flex justify-between items-center pr-1">
                  <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                    Sovereign Secret Password / Key Token
                  </label>
                  {rawPassword && (
                    <div className={cn(
                      "text-[10px] font-black uppercase px-2 py-0.5 rounded-full border",
                      getPasswordStrengthScore(rawPassword).color
                    )}>
                      Strength: {getPasswordStrengthScore(rawPassword).text}
                    </div>
                  )}
                </div>
                
                <div className="relative">
                  <Input 
                    type={revealPassword ? "text" : "password"}
                    placeholder="Type or click Generate" 
                    value={rawPassword}
                    onChange={(e) => setRawPassword(e.target.value)}
                    className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm pr-20"
                  />
                  <div className="absolute right-1.5 top-1 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setRevealPassword(!revealPassword)}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                      title="Toggle Visibility"
                    >
                      {revealPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (rawPassword) {
                          navigator.clipboard.writeText(rawPassword);
                          toast.success("Password copied to clipboard");
                        } else {
                          toast.error("Generate a password first");
                        }
                      }}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                      title="Copy Secret"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Built-in Enterprise Password Generator Panel */}
            <div className="border border-[#DADCE0] rounded-2xl bg-[#F8F9FA] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowGenOptions(!showGenOptions)}
                  className="flex items-center gap-2 text-xs font-black text-slate-700 hover:text-[#1A73E8] focus:outline-none"
                >
                  <Sliders className="w-4 h-4 text-[#1A73E8]" />
                  {showGenOptions ? 'Hide Password Generator Parameters' : 'Deploy Password Generator Parameters'}
                </button>
                
                <Button 
                  type="button"
                  onClick={handleGeneratePasswordSubmit}
                  className="bg-[#1A73E8] hover:bg-blue-700 text-white rounded-full text-xs font-bold px-4 h-8 select-none"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  Generate & Apply
                </Button>
              </div>

              {showGenOptions && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-slate-200">
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-slate-600">Password Length:</span>
                      <span className="font-black text-[#1A73E8]">{genLength}</span>
                    </div>
                    <input 
                      type="range" 
                      min="8" 
                      max="64" 
                      value={genLength}
                      onChange={(e) => setGenLength(Number(e.target.value))}
                      className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1A73E8]"
                    />
                    <div className="flex gap-2 justify-between">
                      <button type="button" onClick={() => setGenLength(12)} className="text-[10px] font-bold text-slate-400 hover:text-slate-700 bg-white border px-2 py-0.5 rounded">12 Chars</button>
                      <button type="button" onClick={() => setGenLength(16)} className="text-[10px] font-bold text-slate-400 hover:text-slate-700 bg-white border px-2 py-0.5 rounded">16 Chars</button>
                      <button type="button" onClick={() => setGenLength(24)} className="text-[10px] font-bold text-slate-400 hover:text-slate-700 bg-white border px-2 py-0.5 rounded">24 Chars</button>
                      <button type="button" onClick={() => setGenLength(32)} className="text-[10px] font-bold text-slate-400 hover:text-slate-700 bg-white border px-2 py-0.5 rounded">32 Chars</button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wide">Included Set</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-600 select-none">
                        <input type="checkbox" checked={genUpper} onChange={(e) => setGenUpper(e.target.checked)} className="rounded text-[#1A73E8]" />
                        A-Z (Uppercase)
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-600 select-none">
                        <input type="checkbox" checked={genLower} onChange={(e) => setGenLower(e.target.checked)} className="rounded text-[#1A73E8]" />
                        a-z (Lowercase)
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-600 select-none">
                        <input type="checkbox" checked={genNumbers} onChange={(e) => setGenNumbers(e.target.checked)} className="rounded text-[#1A73E8]" />
                        0-9 (Numbers)
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-600 select-none">
                        <input type="checkbox" checked={genSymbols} onChange={(e) => setGenSymbols(e.target.checked)} className="rounded text-[#1A73E8]" />
                        !@#$%^ (Symbols)
                      </label>
                    </div>
                    <div className="pt-2">
                      <label className="text-[9px] font-bold text-slate-400 block uppercase">Exclude Characters</label>
                      <Input 
                        placeholder="e.g. l, O, 1, 0" 
                        value={genExclude}
                        onChange={(e) => setGenExclude(e.target.value)}
                        className="h-7 bg-white text-xs rounded-lg mt-1"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* MFA Authentication TOTP Token Seeding Area */}
            <div className="border border-slate-100 rounded-2xl p-5 space-y-4 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wide block">
                Multi-Factor Authentication (MFA) Seeding Setup
              </span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                    MFA TOTP Key Token Secret
                  </label>
                  <Input 
                    placeholder="e.g. JBSWY3DPEHPK3PXP or secret string" 
                    value={newEntry.totpSecret || ''}
                    onChange={(e) => setNewEntry({ ...newEntry, totpSecret: e.target.value })}
                    className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                    Backup Emergency Recovery Keys
                  </label>
                  <Input 
                    placeholder="e.g. 5532-1246-8801 or single emergency tokens" 
                    value={newEntry.backupCodes || ''}
                    onChange={(e) => setNewEntry({ ...newEntry, backupCodes: e.target.value })}
                    className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                  MFA Authenticator Configurations Note
                </label>
                <Input 
                  placeholder="e.g. Google Authenticator key, required every 24 hours, backups in locked filing room." 
                  value={newEntry.authenticatorNotes || ''}
                  onChange={(e) => setNewEntry({ ...newEntry, authenticatorNotes: e.target.value })}
                  className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* -------------------- STEP 3 CONTAINER -------------------- */}
        {wizardStep === 3 && (
          <div className="space-y-6">
            
            {/* Asset Assignment & Ownership Segment */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1 block">
                <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">Principal Owner</label>
                <Input 
                  value={newEntry.owner || 'You'}
                  onChange={(e) => setNewEntry({ ...newEntry, owner: e.target.value })}
                  className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm"
                />
              </div>
              <div className="space-y-1 block">
                <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">Responsible Operations Team</label>
                <Input 
                  value={newEntry.team || 'Platform Ops'}
                  onChange={(e) => setNewEntry({ ...newEntry, team: e.target.value })}
                  className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm"
                />
              </div>
              <div className="space-y-1 block">
                <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">Department Scope</label>
                <Input 
                  value={newEntry.department || 'Infrastructure'}
                  onChange={(e) => setNewEntry({ ...newEntry, department: e.target.value })}
                  className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm"
                />
              </div>
            </div>

            {/* Asset Linking & Infrastructure Relations */}
            <div className="border border-slate-100 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center gap-2 text-slate-700 font-bold text-xs">
                <ExternalLink className="w-4 h-4 text-purple-500" />
                <span>Enterprise Infrastructure Relationship Mapping</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">Link corporate client company</label>
                  <Select 
                    value={newEntry.linkedCompany || 'Acme Global'} 
                    onValueChange={(val) => setNewEntry({ ...newEntry, linkedCompany: val })}
                  >
                    <SelectTrigger className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Acme Global">Acme Global Enterprise</SelectItem>
                      <SelectItem value="Cyberdyne">Cyberdyne Systems</SelectItem>
                      <SelectItem value="FinStream">FinStream Financials</SelectItem>
                      <SelectItem value="None">None (Internal Infrastructure)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">Link infrastructure node</label>
                  <Select 
                    value={newEntry.linkedAsset || 'Server Cluster'} 
                    onValueChange={(val) => setNewEntry({ ...newEntry, linkedAsset: val })}
                  >
                    <SelectTrigger className="bg-[#ffffff] border-[#DADCE0] rounded-xl h-10 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Firewall">Cisco Core Firewall Appliance</SelectItem>
                      <SelectItem value="Database">Postgres Master Storage cluster</SelectItem>
                      <SelectItem value="Server">Edge Virtual Machine Node</SelectItem>
                      <SelectItem value="VPN Gateway">Frankfurt tunnel concentrator</SelectItem>
                      <SelectItem value="AWS Environment">AWS Production VPC cluster</SelectItem>
                      <SelectItem value="Server Cluster">Sovereign Cluster Server Segment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">Link administrative task ticket</label>
                  <Select 
                    value={newEntry.linkedTicket || 'Ticket #442'} 
                    onValueChange={(val) => setNewEntry({ ...newEntry, linkedTicket: val })}
                  >
                    <SelectTrigger className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ticket #442">Ticket #442 - Deploy AWS Gateway</SelectItem>
                      <SelectItem value="Ticket #518">Ticket #518 - Firewall Configuration Audit</SelectItem>
                      <SelectItem value="Ticket #901">Ticket #901 - Database Principal Access Roll</SelectItem>
                      <SelectItem value="None">Unlinked (Ad-Hoc Asset)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Expiration and Rotation Schedules / Policies */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">Sovereign Password Lifespan Policy</label>
                <Select 
                  value={newEntry.expirationPolicy || 'Never'} 
                  onValueChange={(val) => setNewEntry({ ...newEntry, expirationPolicy: val })}
                >
                  <SelectTrigger className="bg-[#ffffff] border-[#DADCE0] rounded-xl h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Never">Never Expire (Static credential)</SelectItem>
                    <SelectItem value="30">Expire in 30 Days</SelectItem>
                    <SelectItem value="60">Expire in 60 Days</SelectItem>
                    <SelectItem value="90">Expire in 90 Days</SelectItem>
                    <SelectItem value="180">Expire in 180 Days</SelectItem>
                    <SelectItem value="Custom">Custom Audit policy override</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">Scheduled Rotation Frequency</label>
                <Select 
                  value={newEntry.rotationPolicy || 'Manual'} 
                  onValueChange={(val) => setNewEntry({ ...newEntry, rotationPolicy: val })}
                >
                  <SelectTrigger className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Manual">Manual Rotation (Triggered by administrator)</SelectItem>
                    <SelectItem value="Auto">Automatic Rotation sequence enabled</SelectItem>
                    <SelectItem value="30">Rotate every 30 Days</SelectItem>
                    <SelectItem value="60">Rotate every 60 Days</SelectItem>
                    <SelectItem value="90">Rotate every 90 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tags Section */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                Security Tags classification
              </label>
              <div className="flex flex-wrap gap-1.5 p-3.5 border border-[#DADCE0] bg-white rounded-2xl min-h-[50px] items-center">
                {newEntry.tags?.map((tag, idx) => (
                  <Badge key={idx} className="bg-blue-50 text-slate-700 hover:bg-blue-100/50 flex items-center gap-1.5 py-1 px-2.5 rounded-full border border-blue-200">
                    <Tag className="w-3 h-3 text-[#1A73E8]" />
                    {tag}
                    <button type="button" onClick={() => handleRemoveExistingTag(idx)} className="text-slate-400 hover:text-red-500 font-black text-xs">×</button>
                  </Badge>
                ))}
                <input 
                  placeholder="Type tag and press Enter" 
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddNewTag}
                  className="bg-transparent border-none outline-none text-xs min-w-0 flex-1 text-slate-800 placeholder-slate-400 font-medium"
                />
              </div>
              <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400 select-none">
                <span className="font-bold">Quick add tags:</span>
                {['Production', 'VPN', 'AWS', 'Critical', 'Finance', 'Linux', 'Shared'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      if (!newEntry.tags?.includes(t)) {
                        setNewEntry({ ...newEntry, tags: [...(newEntry.tags || []), t] });
                      }
                    }}
                    className="text-[10px] bg-slate-50 border px-2 py-0.5 rounded-lg font-semibold hover:bg-slate-100 text-slate-600 transition-colors"
                  >
                    + {t}
                  </button>
                ))}
              </div>
            </div>

            {/* File Attachments Section */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                Hardware Configurations / Profile Attachments
              </label>
              
              <div
                onDragOver={(e) => { e.preventDefault(); setDraggingFile(true); }}
                onDragLeave={() => setDraggingFile(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDraggingFile(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const files = Array.from(e.dataTransfer.files).map(f => ({
                      name: f.name,
                      size: (f.size / 1024).toFixed(1) + ' KB',
                      type: f.type || 'application/octet-stream'
                    }));
                    setNewEntry({
                      ...newEntry,
                      attachments: [...(newEntry.attachments || []), ...files]
                    });
                    toast.success("Security profile assets attached!");
                  }
                }}
                className={cn(
                  "cursor-pointer border-2 border-dashed rounded-2xl p-6 text-center select-none flex flex-col items-center justify-center space-y-2 transition-all",
                  draggingFile 
                    ? "border-[#1A73E8] bg-blue-100/10 text-[#1A73E8]"
                    : "border-[#DADCE0] hover:border-slate-300 hover:bg-slate-50 text-slate-400"
                )}
              >
                <input 
                  type="file" 
                  id="vault-wizard-file" 
                  className="hidden" 
                  multiple 
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      const files = Array.from(e.target.files).map(f => ({
                        name: f.name,
                        size: (f.size / 1024).toFixed(1) + ' KB',
                        type: f.type || 'application/octet-stream'
                      }));
                      setNewEntry({
                        ...newEntry,
                        attachments: [...(newEntry.attachments || []), ...files]
                      });
                      toast.success("Security profile assets attached!");
                    }
                  }}
                />
                <label htmlFor="vault-wizard-file" className="cursor-pointer w-full flex flex-col items-center">
                  <Upload className="w-6 h-6 text-slate-400" />
                  <span className="text-xs font-bold text-slate-700 block mt-2">
                    Drag and drop configuration profiles or select locally
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium block mt-1">
                    Supports Configuration profiles, CA Key files, VPN Certs, TLS bundles up to 50MB. See zero-knowledge encryption guarantees.
                  </span>
                </label>
              </div>

              {/* List of attachments */}
              {newEntry.attachments && newEntry.attachments.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {newEntry.attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 border rounded-xl text-xs font-semibold">
                      <div className="flex items-center gap-2 truncate text-slate-700">
                        <FileCode className="w-4 h-4 text-slate-500" />
                        <span className="truncate" title={file.name}>{file.name}</span>
                        <span className="text-[10px] text-slate-400">({file.size})</span>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => {
                          const list = [...(newEntry.attachments || [])];
                          list.splice(idx, 1);
                          setNewEntry({ ...newEntry, attachments: list });
                          toast.success("Attachment unlinked.");
                        }}
                        className="text-slate-400 hover:text-red-500 font-bold px-1 text-sm mr-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Advanced Security Configuration Guards Checkboxes */}
            <div className="space-y-3 pt-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wide block">
                Hardened Cryptographic Security Policies & Guards
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-relaxed">
                {[
                  { key: 'burnAfterRead', title: 'Burn After Read', sub: 'Destruct and expire from central storage instantly after first decryptions sequence.' },
                  { key: 'requireApproval', title: 'Require Manager Approval', sub: 'Access requests must be verified by delegated Operations supervisor before client key extraction.' },
                  { key: 'jitAccess', title: 'JIT 1-Hour Escalated Access', sub: 'Grant ephemeral, time-gated decryption permissions only during authorized support tickets active times.' },
                  { key: 'requireMfa', title: 'Require step-up MFA verification Challenge', sub: 'Assert hardware keys or security token challenge check prior to reveals.' },
                  { key: 'disableExport', title: 'Block Bulk Export sequence', sub: 'Exclude this credential block from global workspace database backups or JSON extractions.' },
                  { key: 'disableCopy', title: 'Block Copy-to-Clipboard actions', sub: 'Force interactive manual type-in from launcher drawer or console views, blocking clipboard hooks.' }
                ].map((pol) => (
                  <label key={pol.key} className="flex items-start gap-3 p-3.5 bg-white border hover:border-slate-300 rounded-[16px] cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={!!(newEntry.securitySettings as any)?.[pol.key]} 
                      onChange={(e) => {
                        setNewEntry({
                          ...newEntry,
                          securitySettings: {
                            ...(newEntry.securitySettings || {}),
                            [pol.key]: e.target.checked
                          }
                        });
                      }}
                      className="rounded text-[#1A73E8] mt-0.5 focus:ring-offset-0 focus:ring-0" 
                    />
                    <div className="min-w-0">
                      <span className="font-bold text-slate-700 block text-xs leading-none mb-1">{pol.title}</span>
                      <span className="text-[10px] text-slate-400 font-medium leading-normal block">{pol.sub}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* -------------------- STEP 4 CONTAINER -------------------- */}
        {wizardStep === 4 && (
          <div className="space-y-6">
            <div className="text-center p-6 bg-slate-50 border border-slate-100 rounded-3xl space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h5 className="text-sm font-black text-slate-800">Secrets Deployment Schema Ready</h5>
              <p className="text-xs text-slate-500 font-medium max-w-lg mx-auto">
                Verify the record properties below. Once published, your password is encrypted in memory inside this sandbox context before sync write operations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Summary Block 1 */}
              <div className="border rounded-2xl p-5 space-y-3 bg-white">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wide block border-b pb-1.5 border-dashed">
                  Core Characteristics
                </span>

                <div className="grid grid-cols-2 gap-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">Category Class:</span>
                    <span className="font-bold text-slate-800 flex items-center gap-1 capitalize">
                      {newEntry.type}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">Friendly Asset Label:</span>
                    <span className="font-bold text-[#1A73E8] truncate block" title={newEntry.label}>
                      {newEntry.label || 'Unset name'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">Username Principal:</span>
                    <span className="font-bold text-slate-800 block truncate" title={newEntry.username}>
                      {newEntry.username?.trim() || '— (password-only entry)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">Destination Host IP:</span>
                    <span className="font-bold text-slate-700 block truncate" title={newEntry.host}>
                      {newEntry.host || '127.0.0.1 (Unset)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Summary Block 2 */}
              <div className="border rounded-2xl p-5 space-y-3 bg-white">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wide block border-b pb-1.5 border-dashed">
                  Governance & Linking
                </span>

                <div className="grid grid-cols-2 gap-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">Owner principal:</span>
                    <span className="font-bold text-slate-800">{newEntry.owner}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">Linked Company:</span>
                    <span className="font-bold text-[#1A73E8]">{newEntry.linkedCompany}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">Linked Infra Item:</span>
                    <span className="font-bold text-slate-700">{newEntry.linkedAsset}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">Responsible Team:</span>
                    <span className="font-bold text-slate-700">{newEntry.team}</span>
                  </div>
                </div>
              </div>

              {/* Summary Block 3 */}
              <div className="border rounded-2xl p-5 space-y-3 bg-white">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wide block border-b pb-1.5 border-dashed">
                  Policy Schedules
                </span>

                <div className="grid grid-cols-2 gap-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">Sovereign Lifespan:</span>
                    <span className="font-bold text-slate-800">{newEntry.expirationPolicy === 'Never' ? 'Static (Never)' : `Expire ${newEntry.expirationPolicy} days`}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">Scheduled Rotation:</span>
                    <span className="font-bold text-slate-800">{newEntry.rotationPolicy === 'Manual' ? 'Manual trigger' : `Schedule ${newEntry.rotationPolicy} days`}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">Compliance Tag classification:</span>
                    <div className="flex gap-1 flex-wrap mt-0.5">
                      {newEntry.tags?.map((t, idx) => (
                        <span key={idx} className="bg-slate-50 text-slate-600 border text-[9px] font-black px-1.5 py-0.2 rounded">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">MFA token Key seeded:</span>
                    <span className="font-bold text-slate-700">
                      {newEntry.totpSecret ? 'Yes (MFA Configured)' : 'No MFA Setup'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Summary Block 4 */}
              <div className="border rounded-2xl p-5 space-y-3 bg-white">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wide block border-b pb-1.5 border-dashed">
                  Hardened Security Policies Enforced
                </span>

                <div className="flex flex-wrap gap-1">
                  {newEntry.securitySettings && Object.entries(newEntry.securitySettings).some(([_, v]) => v) ? (
                    Object.entries(newEntry.securitySettings)
                      .filter(([_, v]) => v)
                      .map(([k]) => {
                        const titles: Record<string, string> = {
                          burnAfterRead: 'Burn On Read',
                          requireApproval: 'Approval Required',
                          jitAccess: 'Ephemeral JIT',
                          requireMfa: 'Step-up MFA',
                          disableExport: 'No Exports',
                          disableCopy: 'No copy'
                        };
                        return (
                          <span key={k} className="bg-rose-50 text-rose-700 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-rose-200 uppercase/60">
                            🛡️ {titles[k] || k}
                          </span>
                        );
                      })
                  ) : (
                    <span className="text-slate-400 text-xs font-semibold block">None configured. Standard database protections apply.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Action buttons row */}
      <div className="bg-white border-t border-[#F1F3F4] pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-8">
        {/* Left: Cancel and Draft option */}
        <div className="flex items-center gap-2">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={() => {
              onClose();
              setWizardStep(1);
            }}
            className="rounded-full text-xs font-bold text-[#5F6368] h-10 px-5 border"
          >
            Cancel
          </Button>
          <Button 
            type="button"
            variant="ghost" 
            onClick={() => {
              onSaveDraft();
              setWizardStep(1);
            }}
            className="rounded-full text-xs font-bold text-slate-400 hover:text-slate-700 h-10 px-5"
          >
            Save Temporary Draft
          </Button>
        </div>

        {/* Centered safety telemetry readout */}
        <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-slate-400 font-bold select-none">
          <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
          <span>All credentials encrypted locally</span>
        </div>

        {/* Right: Steps controls */}
        <div className="flex items-center gap-2 justify-end">
          {wizardStep > 1 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setWizardStep((wizardStep - 1) as any)}
              className="rounded-full text-xs font-bold text-[#1A73E8] hover:bg-blue-50 h-10 px-5 border border-blue-200"
            >
              Back
            </Button>
          )}

          {wizardStep < 4 ? (
            <Button
              type="button"
              onClick={() => {
                // Basic validation before changing steps
                if (wizardStep === 1) {
                  if (!newEntry.label) {
                    toast.error("Please provide an Asset Friendly Name before proceeding.");
                    return;
                  }
                } else if (wizardStep === 2) {
                  const hasShareableField = Boolean(
                    newEntry.username?.trim() ||
                      rawPassword.trim() ||
                      newEntry.host?.trim() ||
                      newEntry.notes?.trim() ||
                      newEntry.totpSecret?.trim(),
                  );
                  if (!hasShareableField) {
                    toast.error('Provide at least a username, password, host, notes, or TOTP secret.');
                    return;
                  }
                }
                setWizardStep((wizardStep + 1) as any);
              }}
              className="bg-[#1A73E8] hover:bg-blue-700 text-white rounded-full font-bold text-xs h-10 px-6 shadow-sm flex items-center gap-2"
            >
              Continue
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button 
              type="submit" 
              disabled={isSaving}
              className="bg-[#34A853] hover:bg-[#2c8d46] text-white rounded-full font-bold text-xs h-10 px-8 shadow-sm flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Encrypting & Sealing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Create Secure Vault Entry
                </>
              )}
            </Button>
          )}
        </div>
      </div>

    </div>
  </div>

</form>
    </div>
  );
}
