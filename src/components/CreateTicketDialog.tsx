import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { ticketService } from '../services/ticketService';
import { useAuth } from '../lib/hooks';
import { toast } from 'sonner';
import { logAudit } from '../services/auditService';
import { RichTextEditor } from './RichTextEditor';
import { 
  Plus, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  History, 
  Building2, 
  Laptop, 
  Clock,
  Info,
  AlertCircle,
  FileText,
  Mail,
  User,
  Users,
  Flag,
  HelpCircle,
  Settings,
  PenSquare,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { customerService } from '../services/customerService';
import { Company, Contact } from '../types';
import { useTranslation } from '../lib/context/I18nContext';
import { useWorkspace } from '../lib/context/WorkspaceContext';

interface CreateTicketDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateTicketDialog({ isOpen, onClose }: CreateTicketDialogProps) {
  const { t, language } = useTranslation();
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isInternalNotesOpen, setIsInternalNotesOpen] = useState(false);
  const [isAdditionalDetailsOpen, setIsAdditionalDetailsOpen] = useState(true);
  const [tagInput, setTagInput] = useState('');
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    internalNotes: '',
    priority: 'medium',
    status: 'open',
    group: 'support',
    type: 'question',
    customerName: '',
    customerId: '', // Legacy back-compat
    contactId: '',
    companyId: '',
    product: 'GeistDeskTech',
    tags: ['billing', 'new customer'] as string[],
    assignee: 'unassigned',
    ticketKind: 'support' as 'support' | 'bug',
    slaTier: '',
    accountHealth: '',
    affectedVersion: '',
    environment: '',
    stepsToReproduce: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    const kind = workspace === 'developer' ? 'bug' : 'support';
    setFormData((prev) => ({
      ...prev,
      ticketKind: kind,
      group: kind === 'bug' ? 'engineering' : 'support',
      type: kind === 'bug' ? 'problem' : 'question',
    }));
  }, [isOpen, workspace]);

  useEffect(() => {
    return customerService.subscribeToCompanies(setCompanies);
  }, []);

  useEffect(() => {
    if (formData.companyId) {
      return customerService.subscribeToContacts(formData.companyId, setContacts);
    } else {
      setContacts([]);
    }
  }, [formData.companyId]);

  const [aiMeta, setAiMeta] = useState({ sentiment: 'Neutral', language: 'English', suggestedTags: [] as string[] });

  // AI Analysis Mock
  useEffect(() => {
    const text = (formData.subject + ' ' + formData.description).toLowerCase();
    
    // Sentiment
    let sentiment = 'Neutral';
    if (text.includes('urgent') || text.includes('not working') || text.includes('broken') || text.includes('error')) sentiment = 'Negative';
    else if (text.includes('thanks') || text.includes('happy') || text.includes('awesome')) sentiment = 'Positive';
    
    // Language
    let language = 'English';
    if (text.includes('hola') || text.includes('gracias')) language = 'Spanish';
    if (text.includes('bonjour') || text.includes('merci')) language = 'French';

    // Suggested Tags
    const suggested: string[] = [];
    if (text.includes('payment') || text.includes('bill') || text.includes('refund')) suggested.push('billing');
    if (text.includes('login') || text.includes('password') || text.includes('auth')) suggested.push('security');

    setAiMeta({ sentiment, language, suggestedTags: suggested });
  }, [formData.description, formData.subject]);

  const slaInfo = useMemo(() => {
    const now = new Date();
    const resolutionHours = {
      low: 48,
      medium: 24,
      high: 4,
      urgent: 1
    }[formData.priority as 'low' | 'medium' | 'high' | 'urgent'] || 24;
    
    const target = new Date(now.getTime() + resolutionHours * 60 * 60 * 1000);
    return {
      date: target.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      hours: resolutionHours
    };
  }, [formData.priority]);

  const handleAddTag = (tag: string) => {
    const cleanTag = tag.trim().replace(/^#/, '');
    if (cleanTag && !formData.tags.includes(cleanTag)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, cleanTag] }));
    }
    setTagInput('');
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tagToRemove) }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.subject || !formData.description) {
      toast.error(t('dialog.subjectAndDescRequired', 'Subject and Description are required.'));
      return;
    }
    
    setLoading(true);
    try {
      await ticketService.createTicket({
        ...formData,
        team: formData.ticketKind === 'bug' ? 'engineering' : 'support',
        ticketKind: formData.ticketKind,
        type: formData.ticketKind === 'bug' ? 'problem' : formData.type,
        devStatus: formData.ticketKind === 'bug' ? 'backlog' : undefined,
        tags: formData.ticketKind === 'bug'
          ? [...new Set([...formData.tags, 'bug'])]
          : formData.tags,
        creatorId: user.uid,
        sentiment: aiMeta.sentiment.toLowerCase(),
        language: aiMeta.language,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      logAudit({ 
        module: 'tickets',
        action: 'CREATE_TICKET', 
        details: { 
          subject: formData.subject,
          description: "Created new ticket via creation screen"
        }
      });

      toast.success(t('dialog.ticketCreatedSuccess', 'Ticket created successfully'));
      onClose();
    } catch (error) {
      toast.error(t('dialog.failedToCreateTicket', 'Failed to create ticket.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full h-full max-w-full max-h-screen sm:max-w-[1100px] sm:max-h-[95vh] rounded-none sm:rounded-xl flex flex-col p-0 overflow-hidden bg-[#F8F9FB] border-none shadow-2xl">
        {/* Header */}
        <div className="px-4 sm:px-8 py-4 sm:py-5 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b bg-white">
          <div className="flex items-center gap-3 sm:gap-5">
             <div className="w-10 h-10 sm:w-11 sm:h-11 bg-blue-50 rounded-xl flex items-center justify-center shadow-sm border border-blue-100 shrink-0">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
             </div>
             <div>
                <h2 className="text-base sm:text-[20px] font-bold text-[#1F2937] tracking-tight">{t('dialog.createNewTicket', 'Create New Ticket')}</h2>
                <p className="hidden md:block text-[13px] text-slate-500 font-medium">{t('dialog.draftingNewSupport', 'Drafting a new support interaction for internal or external routing.')}</p>
             </div>
          </div>
          <div className="flex items-center justify-end gap-2.5 sm:gap-4 shrink-0">
             <Button variant="outline" className="text-[12px] sm:text-[13px] font-semibold text-blue-600 border-blue-100 hover:bg-blue-50/50 rounded-lg px-4 sm:px-6 h-9 sm:h-10">{t('dialog.saveDraft', 'Save draft')}</Button>
             <Button onClick={handleSubmit} disabled={loading} className="text-[12px] sm:text-[13px] font-bold bg-[#3B82F6] hover:bg-blue-600 text-white rounded-lg px-4 sm:px-7 h-9 sm:h-10 shadow-lg shadow-blue-500/20">{t('dialog.publishTicket', 'Publish ticket')}</Button>
             <button onClick={onClose} className="p-1.5 sm:p-2 rounded-full hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
             </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden">
          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8 scrollbar-none custom-scroll">
            
            {/* Section 1: What is this about? */}
             <div className="bg-white border border-slate-200/60 rounded-[20px] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[13px] font-bold text-blue-600 shadow-sm border border-blue-100/50">1</div>
                    <h3 className="text-[15px] font-bold text-[#374151]">{t('dialog.whatIsThisAbout', 'What is this about?')}</h3>
                </div>
                
                <div className="space-y-7">
                    <div className="space-y-2.5">
                        <Label className="text-[12px] font-bold text-slate-600 ml-1">{t('dialog.subject', 'Subject')}</Label>
                        <Input 
                            value={formData.subject}
                            onChange={(e) => setFormData({...formData, subject: e.target.value})}
                            placeholder={t('dialog.subjectPlaceholder', 'Summarize the core request...')}
                            className="w-full h-12 border-slate-200 bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 placeholder:text-slate-300 transition-all rounded-xl text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-2.5">
                            <Label className="text-[12px] font-bold text-slate-600 ml-1">{t('dialog.company', 'Company')}</Label>
                            <Select 
                              value={formData.companyId} 
                              onValueChange={(val) => {
                                const company = companies.find(c => c.id === val);
                                setFormData({ ...formData, companyId: val, contactId: '', customerName: '', customerId: '' });
                              }}
                            >
                                <SelectTrigger className="w-full h-12 border-slate-200 bg-white rounded-xl text-sm placeholder:text-slate-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-400">
                                   <div className="flex items-center gap-2">
                                      <Building2 className="w-4 h-4 text-slate-300" />
                                      <SelectValue placeholder={t('dialog.selectOrg', 'Select organization...')} />
                                   </div>
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                   {companies.map(c => (
                                     <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                   ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2.5">
                            <Label className="text-[12px] font-bold text-slate-600 ml-1">{t('dialog.contactEmployee', 'Contact Employee')}</Label>
                            <Select 
                              value={formData.contactId} 
                              onValueChange={(val) => {
                                const contact = contacts.find(c => c.id === val);
                                if (contact) {
                                  setFormData({ ...formData, contactId: val, customerName: contact.name, customerId: contact.email });
                                }
                              }}
                              disabled={!formData.companyId}
                            >
                                <SelectTrigger className="w-full h-12 border-slate-200 bg-white rounded-xl text-sm placeholder:text-slate-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-400">
                                   <div className="flex items-center gap-2">
                                      <User className="w-4 h-4 text-slate-300" />
                                      <SelectValue placeholder={formData.companyId ? t('dialog.selectEmployee', 'Select employee...') : t('dialog.selectCompanyFirst', 'Select company first')} />
                                   </div>
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                   {contacts.map(c => (
                                     <SelectItem key={c.id} value={c.id}>{c.name} ({c.email})</SelectItem>
                                   ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 2: Describe the request */}
            <div className="bg-white border border-slate-200/60 rounded-[20px] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[13px] font-bold text-blue-600 shadow-sm border border-blue-100/50">2</div>
                    <h3 className="text-[15px] font-bold text-[#374151]">{t('dialog.describeRequest', 'Describe the request')}</h3>
                </div>

                <div className="space-y-4">
                    <div className="relative group rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-inner-sm">
                        <div className="absolute right-6 top-4 z-10 flex gap-2">
                             <div className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 shadow-sm">
                                <span className="text-[11px] font-bold text-slate-500">{aiMeta.sentiment} sentiment</span>
                             </div>
                             <div className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-slate-100 shadow-sm transition-colors">
                                <span className="text-[11px] font-bold text-slate-500">{aiMeta.language}</span>
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                             </div>
                        </div>
                        <RichTextEditor 
                            value={formData.description}
                            onChange={(v) => setFormData({...formData, description: v})}
                            placeholder={t('dialog.descriptionPlaceholder', 'Add details, context, steps tried, expected outcome, etc.')}
                            className="border-none shadow-none focus-within:ring-0 min-h-[220px]"
                        />
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium italic ml-1">{t('dialog.descriptionTip', 'Tip: Include relevant details to help us resolve this faster.')}</p>
                </div>
            </div>

            {/* Section 3: Additional details */}
            <div className="bg-white border border-slate-200/60 rounded-[20px] p-8 shadow-sm">
                <button 
                  type="button"
                  onClick={() => setIsAdditionalDetailsOpen(!isAdditionalDetailsOpen)}
                  className="w-full flex items-center justify-between"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[13px] font-bold text-blue-600 shadow-sm border border-blue-100/50">3</div>
                        <h3 className="text-[15px] font-bold text-[#374151]">{t('dialog.additionalDetails', 'Additional details')}</h3>
                    </div>
                    <motion.div animate={{ rotate: isAdditionalDetailsOpen ? 0 : 180 }} transition={{ duration: 0.2 }}>
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                    </motion.div>
                </button>

                <AnimatePresence initial={false}>
                    {isAdditionalDetailsOpen && (
                        <motion.div
                             initial={{ height: 0, opacity: 0, marginTop: 0 }}
                             animate={{ height: 'auto', opacity: 1, marginTop: 32 }}
                             exit={{ height: 0, opacity: 0, marginTop: 0 }}
                             className="overflow-hidden"
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2.5">
                                    <Label className="text-[12px] font-bold text-slate-600 ml-1 uppercase tracking-wider">{t('dialog.productLine', 'Product line')}</Label>
                                    <Select value={formData.product} onValueChange={(v) => setFormData({...formData, product: v})}>
                                        <SelectTrigger className="w-full h-12 border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="GeistDeskTech">GeistDeskTech</SelectItem>
                                            <SelectItem value="GeistDeskMobile">GeistDeskMobile</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2.5">
                                    <Label className="text-[12px] font-bold text-slate-600 ml-1 uppercase tracking-wider">{t('dialog.ticketKind', 'Ticket kind')}</Label>
                                    <Select
                                      value={formData.ticketKind}
                                      onValueChange={(v) => setFormData({
                                        ...formData,
                                        ticketKind: v as 'support' | 'bug',
                                        group: v === 'bug' ? 'engineering' : 'support',
                                        type: v === 'bug' ? 'problem' : 'question',
                                      })}
                                    >
                                        <SelectTrigger className="w-full h-12 border-slate-200 rounded-xl text-sm bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="support">{t('tickets.kind.support', 'Support')}</SelectItem>
                                            <SelectItem value="bug">{t('tickets.kind.bug', 'Bug')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {formData.ticketKind === 'support' ? (
                                  <>
                                    <div className="space-y-2.5">
                                      <Label className="text-[12px] font-bold text-slate-600 ml-1">{t('tickets.fields.slaTier', 'SLA Tier')}</Label>
                                      <Input className="h-11 rounded-xl" value={formData.slaTier} onChange={(e) => setFormData({ ...formData, slaTier: e.target.value })} />
                                    </div>
                                    <div className="space-y-2.5">
                                      <Label className="text-[12px] font-bold text-slate-600 ml-1">{t('tickets.fields.accountHealth', 'Account Health')}</Label>
                                      <Input className="h-11 rounded-xl" value={formData.accountHealth} onChange={(e) => setFormData({ ...formData, accountHealth: e.target.value })} />
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="space-y-2.5">
                                      <Label className="text-[12px] font-bold text-slate-600 ml-1">{t('tickets.fields.affectedVersion', 'Affected Version / Build')}</Label>
                                      <Input className="h-11 rounded-xl" value={formData.affectedVersion} onChange={(e) => setFormData({ ...formData, affectedVersion: e.target.value })} />
                                    </div>
                                    <div className="space-y-2.5">
                                      <Label className="text-[12px] font-bold text-slate-600 ml-1">{t('tickets.fields.environment', 'Environment')}</Label>
                                      <Input className="h-11 rounded-xl" value={formData.environment} onChange={(e) => setFormData({ ...formData, environment: e.target.value })} />
                                    </div>
                                    <div className="space-y-2.5 sm:col-span-2">
                                      <Label className="text-[12px] font-bold text-slate-600 ml-1">{t('tickets.fields.stepsToReproduce', 'Steps to Reproduce')}</Label>
                                      <Textarea className="min-h-[96px] rounded-xl" value={formData.stepsToReproduce} onChange={(e) => setFormData({ ...formData, stepsToReproduce: e.target.value })} />
                                    </div>
                                  </>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Internal Notes */}
            <div className="bg-white border border-slate-200/60 rounded-[20px] p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                        <PenSquare className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                        <h3 className="text-[15px] font-bold text-[#374151]">{t('dialog.internalNotes', 'Internal notes')} <span className="text-slate-400 font-normal ml-1">({t('dialog.optional', 'optional')})</span></h3>
                        <p className="text-[11px] text-slate-400 font-medium">{t('dialog.internalNotesDesc', 'Notes are private and not visible to the customer.')}</p>
                    </div>
                </div>
                <Textarea 
                  value={formData.internalNotes}
                  onChange={(e) => setFormData({...formData, internalNotes: e.target.value})}
                  className="min-h-[100px] border-none shadow-none p-0 focus-visible:ring-0 text-sm placeholder:text-slate-300 bg-white"
                  placeholder={t('dialog.internalNotesPlaceholder', 'Start typing private agent notes...')}
                />
            </div>
          </div>

          {/* Sidebar Area: Ticket Settings */}
          <div className="w-full lg:w-[340px] bg-white border-t lg:border-t-0 lg:border-l p-4 sm:p-8 space-y-9 shrink-0 lg:overflow-y-auto custom-scroll">
            <div className="flex items-center gap-3 text-[#4B5563] mb-2">
                <Settings className="w-4.5 h-4.5" />
                <h3 className="text-[15px] font-bold">{t('dialog.ticketSettings', 'Ticket settings')}</h3>
            </div>

            <div className="space-y-6">
                <div className="space-y-2.5">
                    <Label className="text-[12px] font-bold text-slate-500">{t('common.status', 'Status')}</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                        <SelectTrigger className="w-full h-11 border-slate-100 rounded-xl bg-[#F9FAFB] hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                                <span className="capitalize text-sm font-semibold text-[#374151]">{t('tickets.' + formData.status, formData.status)}</span>
                            </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="open">{t('tickets.open', 'Open')}</SelectItem>
                            <SelectItem value="pending">{t('tickets.pending', 'Pending')}</SelectItem>
                            <SelectItem value="on_hold">{t('tickets.items.team_on_hold', 'On Hold')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2.5">
                    <Label className="text-[12px] font-bold text-slate-500">{t('common.priority', 'Priority')}</Label>
                    <Select value={formData.priority} onValueChange={(v) => setFormData({...formData, priority: v})}>
                        <SelectTrigger className="w-full h-11 border-slate-100 rounded-xl bg-[#F9FAFB] hover:bg-slate-50 transition-colors">
                             <div className="flex items-center gap-3">
                                <Flag className="w-4 h-4 text-rose-500" />
                                <span className="capitalize text-sm font-semibold text-[#374151]">{t('tickets.priority' + formData.priority.charAt(0).toUpperCase() + formData.priority.slice(1), formData.priority)}</span>
                            </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="low">{t('tickets.priorityLow', 'Low')}</SelectItem>
                            <SelectItem value="medium">{t('tickets.priorityMedium', 'Medium')}</SelectItem>
                            <SelectItem value="high">{t('tickets.priorityHigh', 'High')}</SelectItem>
                            <SelectItem value="urgent">{t('tickets.priorityUrgent', 'Urgent')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2.5">
                    <Label className="text-[12px] font-bold text-slate-500">{t('dialog.group', 'Group')}</Label>
                    <Select value={formData.group} onValueChange={(v) => setFormData({...formData, group: v})}>
                        <SelectTrigger className="w-full h-11 border-slate-100 rounded-xl bg-[#F9FAFB] hover:bg-slate-50 transition-colors">
                             <div className="flex items-center gap-3">
                                <Users className="w-4 h-4 text-slate-400" />
                                <span className="capitalize text-sm font-semibold text-[#374151]">{formData.group}</span>
                            </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="support">{t('dialog.groupSupport', 'Support')}</SelectItem>
                            <SelectItem value="billing">{t('dialog.groupBilling', 'Billing')}</SelectItem>
                            <SelectItem value="technical">{t('dialog.groupTechnical', 'Technical')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2.5">
                    <Label className="text-[12px] font-bold text-slate-500">{t('dialog.type', 'Type')}</Label>
                    <Select value={formData.type} onValueChange={(v) => setFormData({...formData, type: v})}>
                        <SelectTrigger className="w-full h-11 border-slate-100 rounded-xl bg-[#F9FAFB] hover:bg-slate-50 transition-colors">
                             <div className="flex items-center gap-3">
                                <HelpCircle className="w-4.5 h-4.5 text-slate-400" />
                                <span className="capitalize text-sm font-semibold text-[#374151]">{formData.type.replace('_', ' ')}</span>
                            </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="question">{t('dialog.typeQuestion', 'Question')}</SelectItem>
                            <SelectItem value="bug">{t('dialog.typeBug', 'Bug')}</SelectItem>
                            <SelectItem value="feature_request">{t('dialog.typeFeatureRequest', 'Feature Request')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2.5">
                    <Label className="text-[12px] font-bold text-slate-500">{t('dialog.assignee', 'Assignee')}</Label>
                    <Select value={formData.assignee} onValueChange={(v) => setFormData({...formData, assignee: v})}>
                        <SelectTrigger className="w-full h-11 border-slate-100 rounded-xl bg-[#F9FAFB] hover:bg-slate-50 transition-colors">
                             <div className="flex items-center gap-3">
                                <User className="w-4.5 h-4.5 text-slate-400" />
                                <span className="capitalize text-sm font-semibold text-[#374151]">{formData.assignee === 'unassigned' ? t('dialog.unassigned', 'Unassigned') : t('dialog.assignToMe', 'Assign to me')}</span>
                            </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="unassigned">{t('dialog.unassigned', 'Unassigned')}</SelectItem>
                            <SelectItem value={user?.uid || 'me'}>{t('dialog.assignToMe', 'Assign to me')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-5 pt-4">
                <div className="flex items-center justify-between">
                    <Label className="text-[12px] font-bold text-slate-500">{t('dialog.tags', 'Tags')}</Label>
                    <button type="button" className="text-[12px] font-bold text-blue-600 hover:underline">{t('dialog.suggested', 'Suggested')}</button>
                </div>
                <div className="relative">
                    <Input 
                        placeholder="Add tags..." 
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag(tagInput))}
                        className="w-full h-10 border-slate-100 pr-10 text-xs rounded-xl bg-[#F9FAFB]"
                    />
                    <Plus className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 cursor-pointer hover:scale-110 transition-transform" onClick={() => handleAddTag(tagInput)} />
                </div>
                <div className="flex flex-wrap gap-2.5">
                    {formData.tags.map(tag => (
                        <div key={tag} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50/80 text-blue-600 rounded-lg text-[11px] font-bold border border-blue-100 shadow-sm">
                            {tag}
                            <X className="w-3 h-3 cursor-pointer hover:text-rose-500 transition-colors" onClick={() => removeTag(tag)} />
                        </div>
                    ))}
                    {aiMeta.suggestedTags.map(tag => (
                        !formData.tags.includes(tag) && (
                            <div key={tag} onClick={() => handleAddTag(tag)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-400 rounded-lg text-[11px] font-bold border border-slate-100 cursor-pointer opacity-70 hover:opacity-100 transition-all border-dashed">
                                {tag}
                                <Plus className="w-3 h-3" />
                            </div>
                        )
                    ))}
                </div>
            </div>

            {/* Estimated SLA Box */}
            <div className="p-5 border border-slate-200/60 rounded-2xl space-y-5 bg-white shadow-sm">
                <div className="flex items-center gap-2.5 mb-1">
                    <Clock className="w-4.5 h-4.5 text-slate-400" />
                    <h4 className="text-[12px] font-bold text-slate-700">{t('dialog.estimatedSla', 'Estimated SLA')}</h4>
                </div>
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-[12px]">
                        <span className="text-slate-400 font-medium">{t('dialog.targetResolution', 'Target resolution')}</span>
                        <span className="text-[#374151] font-bold">{slaInfo.date}</span>
                    </div>
                    <div className="flex items-center justify-between text-[12px]">
                        <span className="text-slate-400 font-medium">{t('dialog.resolutionWindow', 'Resolution window')}</span>
                        <span className="text-[#374151] font-bold">{t('dialog.within', 'Within')} {slaInfo.hours}h</span>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                    <Info className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                        {t('dialog.slaBasedOnPriorityPre', 'Based on')} {t('tickets.priority' + formData.priority.charAt(0).toUpperCase() + formData.priority.slice(1), formData.priority)} {t('dialog.slaBasedOnPriorityPost', 'priority calculation.')}
                    </p>
                </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-8 py-5 shrink-0 flex items-center justify-between border-t bg-white">
           <div className="flex items-center gap-3 text-[12px] font-medium text-slate-400">
                <span>{t('dialog.press', 'Press')}</span>
                <div className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 shadow-inner-sm">Ctrl</div>
                <span className="text-slate-300 text-lg">+</span>
                <div className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 shadow-inner-sm">Enter</div>
                <span className="ml-1">{t('dialog.toSaveAndPublish', 'to save and publish')}</span>
           </div>
           <div className="flex items-center gap-5">
              <Button variant="ghost" onClick={onClose} className="text-[13px] font-semibold text-[#4B5563] hover:bg-slate-50 px-6 rounded-lg">{t('dialog.discardDraft', 'Discard draft')}</Button>
              <Button onClick={handleSubmit} disabled={loading} className="text-[13px] font-bold bg-[#3B82F6] hover:bg-blue-600 text-white rounded-lg px-9 h-11 shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98]">{t('dialog.publishTicket', 'Publish ticket')}</Button>
           </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

