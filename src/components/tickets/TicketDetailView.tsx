import type { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';
import {
  BookOpen, ChevronDown, ChevronLeft, GitMerge, Mail, MessageSquare,
  RefreshCw, SlidersHorizontal, Sparkles, Ticket,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getInitials, safeString } from '../../lib/utils';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { AiSummaryCard } from '../ticket-details/AiSummaryCard';
import { ConversationTimeline } from '../ticket-details/ConversationTimeline';
import { EmailComposer } from '../ticket-details/EmailComposer';
import { TicketKindFieldsCard } from '../ticket-details/TicketKindFieldsCard';
import { SmartContextPanel } from '../ticket-details/SmartContextPanel';
import { CustomerTabContent } from '../ticket-details/CustomerTabContent';
import { TimelineTabContent } from '../ticket-details/TimelineTabContent';
import { AiInsightsTabContent } from '../ticket-details/AiInsightsTabContent';
import { AssetsTabContent } from '../ticket-details/AssetsTabContent';
import { RelatedTicketsTabContent } from '../ticket-details/RelatedTicketsTabContent';
import { TasksTabContent } from '../ticket-details/TasksTabContent';
import { SwarmOutageBanner } from '../tickets/SwarmOutageBanner';
import { TicketDetailsSpamAction } from '../pages/TicketDetailsPage';
import { useTranslation } from '../../lib/context/I18nContext';
import type { Ticket as TicketType, Message, Contact, Company, TicketChecklistItem } from '../../types';
import type { CustomField } from '../../services/schemaService';
import type { AIAdapter } from '../../lib/ai/provider-adapter';
import type { LegalValidationResult } from '../../services/legalService';
import type { AiComposerMeta } from '../ticket-details/EmailComposer';
import type { SuggestedLink } from '../../services/neuralLinkService';

export interface TicketDetailViewProps {
  selectedTicket: TicketType;
  ticketContact: Contact | null;
  ticketCompany: Company | null;
  contactSchema: CustomField[];
  messages: Message[];
  allTickets: TicketType[];
  activeDetailTab: string;
  setActiveDetailTab: (tab: string) => void;
  isAiReady: boolean;
  isAiDrafting: boolean;
  isTranslating: boolean;
  translatedTicket: { subject: string; description: string } | null;
  aiSummary: string;
  aiSources: { paragraph: string; articleTitle: string; articleId?: string }[];
  suggestedNeuralLinks: SuggestedLink[];
  isFindingNeuralLinks: boolean;
  linkInput: string;
  setLinkInput: (v: string) => void;
  isComposerExpanded: boolean;
  setIsComposerExpanded: (v: boolean) => void;
  replyText: string;
  setReplyText: (v: string | ((prev: string) => string)) => void;
  newAgentComment: string;
  setNewAgentComment: (v: string) => void;
  areNotesExpanded: boolean;
  setAreNotesExpanded: (v: boolean) => void;
  user: { uid?: string; displayName?: string | null; email?: string | null } | null;
  ticketService: {
    updateTicket: (id: string, data: Partial<TicketType>) => Promise<{ success: boolean; ticket?: TicketType }> | void;
    addAgentComment: (id: string, comment: { content: string; agentId?: string; agentName?: string }) => Promise<void> | void;
    getTicket: (id: string) => Promise<TicketType | null>;
  };
  setAllTickets: Dispatch<SetStateAction<TicketType[]>>;
  setSelectedTicketId: (id: string | null) => void;
  updateSummary: (force?: boolean) => Promise<void> | void;
  handleChecklistUpdated: (checklist: TicketChecklistItem[]) => void;
  handleInlineUpdate: (id: string, data: Partial<TicketType>) => void;
  findNeuralLinks: () => void;
  linkTicket: (ticketId: string) => void;
  unlinkTicket: (ticketId: string) => void;
  generateAiReply: () => void;
  handleSendReply: () => void;
  acceptGhostDraft: () => void;
  ghostDraft: string | null;
  isGhostDrafting: boolean;
  legalViolation: LegalValidationResult | null;
  setLegalViolation: (v: LegalValidationResult | null) => void;
  isValidatingLegal: boolean;
  aiDraftMeta: AiComposerMeta | null;
  ai: AIAdapter;
  translationMood: string;
  closeFullTicketView: () => void;
  isMobilePropertiesOpen: boolean;
  setIsMobilePropertiesOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  onConvertToKB?: () => void;
  isKbDrafting?: boolean;
  onOpenMerge?: () => void;
}

export function TicketDetailView(props: TicketDetailViewProps) {
  const { t } = useTranslation();
  const {
    selectedTicket,
    ticketContact,
    ticketCompany,
    contactSchema,
    messages,
    allTickets,
    activeDetailTab,
    setActiveDetailTab,
    isAiReady,
    isAiDrafting,
    isTranslating,
    translatedTicket,
    aiSummary,
    aiSources,
    suggestedNeuralLinks,
    isFindingNeuralLinks,
    linkInput,
    setLinkInput,
    isComposerExpanded,
    setIsComposerExpanded,
    replyText,
    setReplyText,
    newAgentComment,
    setNewAgentComment,
    areNotesExpanded,
    setAreNotesExpanded,
    user,
    ticketService,
    setAllTickets,
    setSelectedTicketId,
    updateSummary,
    handleChecklistUpdated,
    handleInlineUpdate,
    findNeuralLinks,
    linkTicket,
    unlinkTicket,
    generateAiReply,
    handleSendReply,
    acceptGhostDraft,
    ghostDraft,
    isGhostDrafting,
    legalViolation,
    setLegalViolation,
    isValidatingLegal,
    aiDraftMeta,
    ai,
    translationMood,
    closeFullTicketView,
    isMobilePropertiesOpen,
    setIsMobilePropertiesOpen,
    onConvertToKB,
    isKbDrafting,
    onOpenMerge,
  } = props;

  // Defensive guard: never crash the ticket workspace when the selected
  // ticket is temporarily unavailable (e.g. removed from the master list
  // after an assignment in a filtered view). Render an empty state instead.
  if (!selectedTicket) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-slate-900 min-h-0">
        <Ticket className="w-10 h-10 text-muted-foreground opacity-40" />
        <h2 className="text-xl font-bold mt-4 text-foreground">
          {t('tickets.detail.notFound', 'Ticket nicht gefunden')}
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          {t('tickets.detail.notFoundDesc', 'Das Ticket ist nicht mehr in der aktuellen Ansicht. Bitte zurück zur Liste und ein anderes Ticket wählen.')}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-6"
          onClick={closeFullTicketView}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          {t('tickets.detail.backToList', 'Back to tickets')}
        </Button>
      </div>
    );
  }

  return (
    <>
                    <div className="flex-1 flex flex-col min-h-0 min-w-0">
                      {/* 1. Header component */}
                    <div className="px-4 md:px-6 pt-4 md:pt-5 pb-3 border-b border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900 shrink-0">
                      {/* 3-Tier Agentic Graph — Tier 3 swarm outage banner */}
                      <SwarmOutageBanner ticketId={selectedTicket.id} />
                      <button 
                        type="button"
                        onClick={closeFullTicketView}
                        className="flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-extrabold text-xs cursor-pointer mb-2 transition-colors select-none group"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 text-slate-450 group-hover:text-slate-650 transition-colors" /> {t('tickets.detail.backToList', 'Back to tickets')}
                      </button>
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <div className="flex items-center gap-2 md:gap-3 overflow-hidden min-w-0 flex-1">
                          <h2 className="text-xl font-extrabold text-slate-950 dark:text-slate-50 truncate tracking-tight">{safeString(selectedTicket.subject)}</h2>
                          <span className="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300 px-3 py-1 rounded-md text-[11px] font-extrabold select-none shrink-0 capitalize">
                            {t(`tickets.status.${(selectedTicket.status || 'open').toLowerCase()}`, selectedTicket.status || 'Offen')}
                          </span>
                          <span className="bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-350 px-3 py-1 rounded-md text-[11px] font-extrabold select-none shrink-0 capitalize">
                            {t(`tickets.priority.${(selectedTicket.priority || 'medium').toLowerCase()}`, selectedTicket.priority || 'Mittel')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <TicketDetailsSpamAction
                            ticket={selectedTicket}
                            contactEmail={ticketContact?.email}
                            onMarked={() => {
                              setAllTickets((prev) =>
                                prev.map((ticket) =>
                                  ticket.id === selectedTicket.id
                                    ? { ...ticket, status: 'spam' as const }
                                    : ticket,
                                ),
                              );
                              setSelectedTicketId(null);
                            }}
                          />
                          {onOpenMerge && selectedTicket.status !== 'merged' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={onOpenMerge}
                              className="h-9 px-3 rounded-lg border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                            >
                              <GitMerge className="w-3.5 h-3.5" />
                              <span>{t('tickets.merge.button', 'Zusammenführen')}</span>
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setActiveDetailTab('conversation');
                              setIsComposerExpanded(true);
                              setTimeout(() => {
                                const noteEl = document.getElementById('quick-internal-note-input') || document.getElementById('email-reply-composer');
                                if (noteEl) noteEl.scrollIntoView({ behavior: 'smooth' });
                              }, 100);
                              toast.info(t('tickets.detail.switchedToComposer', 'Switched to conversation notes composer.'));
                            }}
                            className="h-9 px-3 rounded-lg border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
                          >
                            {t('tickets.noteBtn', 'Internal Note')}
                          </Button>
                          {onConvertToKB && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={onConvertToKB}
                              disabled={isKbDrafting}
                              className="h-9 px-3 rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                            >
                              {isKbDrafting
                                ? <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                                : <BookOpen className="w-3.5 h-3.5 text-indigo-500" />}
                              <span>{isKbDrafting
                                ? t('tickets.detail.extracting', 'Extracting...')
                                : t('tickets.detail.convertToKb', 'In KB übernehmen')}</span>
                            </Button>
                          )}
                          <Button 
                            onClick={async () => {
                              toast.promise(
                                Promise.resolve(updateSummary(true)),
                                {
                                  loading: t('tickets.detail.aiSyncLoading', 'Synchronisiere KI-Erkenntnisse mit dem neuesten E-Mail-Verlauf...'),
                                  success: t('tickets.detail.aiSyncSuccess', 'KI-Erkenntnisse erfolgreich aktualisiert!'),
                                  error: t('tickets.detail.aiSyncError', 'Synchronisierung der KI-Erkenntnisse fehlgeschlagen.')
                                }
                              );
                            }}
                            disabled={isAiDrafting}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 text-white font-extrabold text-xs h-9 px-3 rounded-lg flex items-center gap-1.5 transition-all shadow-sm select-none"
                          >
                            {isAiDrafting ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5" />
                            )}
                            <span>{t('tickets.detail.aiSync', 'AI Sync')}</span>
                          </Button>
    
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setIsMobilePropertiesOpen(prev => !prev)}
                            className="xl:hidden h-9 px-3 rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                            <span>{isMobilePropertiesOpen ? t('tickets.detail.closeProps', 'Close properties') : t('tickets.detail.properties', 'Properties')}</span>
                          </Button>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 font-bold mt-1 tracking-wide uppercase select-none">
                        {safeString(selectedTicket.company, 'Enterprise Corp')} &bull; {safeString(selectedTicket.customerName, 'PremtonXhafa')}
                      </div>
                    </div>
    
                    {/* 2. Horizontal Tabs Menu Bar */}
                    <div className="px-6 border-b border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900 shrink-0 flex items-center justify-between h-[48px] select-none">
                      <div className="flex items-center gap-1 h-full overflow-x-auto custom-scrollbar">
                        {([
                          { id: 'conversation', labelKey: 'overview' },
                          { id: 'customer', labelKey: 'customer' },
                          { id: 'timeline', labelKey: 'timeline' },
                          { id: 'ai_insights', labelKey: 'aiInsights' },
                          { id: 'assets', labelKey: 'assets' },
                          { id: 'related_tickets', labelKey: 'neuralLinks' },
                          { id: 'tasks', labelKey: 'tasks' }
                        ] as const).map(tab => (
                          <button
                            key={tab.id}
                            className={cn(
                              "h-full px-4 text-xs font-extrabold border-b-2 transition-all shrink-0 hover:text-slate-800 flex items-center gap-2 relative",
                              activeDetailTab === tab.id 
                                ? "border-blue-600 text-blue-600" 
                                : "border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                            )}
                            onClick={() => {
                              setActiveDetailTab(tab.id);
                            }}
                          >
                            {t(`tickets.tabs.${tab.labelKey}`, tab.labelKey)}
                          </button>
                        ))}
                      </div>
                    </div>
    
    
                  {/* Thread Content */}
                  <ScrollArea className="flex-1 px-8 py-6 min-h-0">
                      <div className="max-w-4xl mx-auto space-y-6 pb-12">
                        
                        {activeDetailTab === 'conversation' && (
                          <div className="space-y-6">
                            {/* 1. Collapsible gradient AI summary card */}
                            <AiSummaryCard 
                              ticket={selectedTicket}
                              aiSummary={aiSummary}
                              isAiReady={isAiReady}
                              onRefreshSummary={() => updateSummary(true)}
                              isAiDrafting={isAiDrafting}
                              onChecklistUpdated={handleChecklistUpdated}
                              onAdoptProposedSolution={(text) => setReplyText(text)}
                            />
    
                            {/* 2. Foldable/Collapsible Agent Notes Section */}
                            <div className="bg-amber-50/15 dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-900/20 rounded-2xl overflow-hidden shadow-sm transition-all hover:bg-amber-50/25 dark:hover:bg-amber-950/15">
                              <button 
                                onClick={() => setAreNotesExpanded(!areNotesExpanded)}
                                className="w-full flex items-center justify-between p-4 focus:outline-none"
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center border border-amber-200 dark:border-amber-900 text-amber-805 dark:text-amber-200 shrink-0 shadow-sm">
                                    <MessageSquare className="w-4 h-4" />
                                  </div>
                                  <div className="text-left">
                                    <h3 className="text-xs font-bold text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
                                      <span>{t('tickets.notes.workspaceNotes', 'Internal Agent Workspace Notes')}</span>
                                      <Badge className="bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100 border-none text-[8.5px] font-black tracking-tight px-1.5 h-4.5 rounded-full shadow-sm">
                                        {(selectedTicket.agentComments || []).length}
                                      </Badge>
                                    </h3>
                                    <p className="text-[10px] text-amber-800/80 dark:text-amber-300/85 mt-0.5">
                                      {areNotesExpanded
                                        ? t('tickets.notes.collapseNotes', 'Collapse notes panel')
                                        : t('tickets.notes.expandNotesDesc', 'Expand to read notes and log internal coordination')}
                                    </p>
                                  </div>
                                </div>
                                <ChevronDown className={cn(
                                  "w-4 h-4 text-amber-700/80 dark:text-amber-400 transition-transform duration-200", 
                                  areNotesExpanded && "rotate-180"
                                )} />
                              </button>
    
                              {areNotesExpanded && (
                                <div className="px-4 pb-4 pt-1 space-y-4 border-t border-amber-200/30 dark:border-amber-900/30">
                                  {/* Notes list */}
                                  {(selectedTicket.agentComments || []).length === 0 ? (
                                    <p className="text-[11px] text-amber-800/60 dark:text-amber-400/70 italic py-2 text-center">{t('tickets.notes.noNotesYet', 'No internal agent notes logged yet.')}</p>
                                  ) : (
                                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                      {(selectedTicket.agentComments || []).map((comment: any) => (
                                        <div 
                                          key={comment.id} 
                                          className="p-3 bg-amber-50/90 dark:bg-slate-900 border border-amber-200/50 dark:border-slate-800 rounded-xl shadow-sm text-slate-900 dark:text-slate-100 flex items-start gap-3"
                                        >
                                          <div className="w-6.5 h-6.5 rounded-full bg-amber-100/80 dark:bg-slate-800 border border-amber-200 dark:border-slate-700 text-amber-800/80 dark:text-slate-200 flex items-center justify-center shrink-0 text-[10px] font-black uppercase">
                                            {comment.agentName ? getInitials(comment.agentName) : 'AG'}
                                          </div>
                                          <div className="flex-1 min-w-0 space-y-0.5">
                                            <div className="flex items-center justify-between">
                                              <span className="font-bold text-[11px] text-amber-950 dark:text-amber-100">{safeString(comment.agentName)}</span>
                                              <span className="text-[9px] text-amber-800/60 dark:text-slate-400 font-medium">
                                                {comment.createdAt ? new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                                              </span>
                                            </div>
                                            <p className="text-[11px] text-amber-950 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
    
                                  {/* Form to add note */}
                                  <div className="p-3 bg-white dark:bg-slate-900 border border-amber-200/40 dark:border-slate-800 rounded-xl flex gap-2 items-center">
                                    <input 
                                      id="quick-internal-note-input"
                                      type="text" 
                                      placeholder={t('tickets.notes.typeNotePlaceholder', 'Type an internal note to notify workforce, share state...')} 
                                      className="flex-1 bg-transparent border-none text-[11px] text-slate-850 dark:text-slate-200 focus:outline-none focus:ring-0 placeholder:text-slate-400"
                                      value={newAgentComment}
                                      onChange={(e) => setNewAgentComment(e.target.value)}
                                      onKeyDown={async (e) => {
                                        if (e.key === 'Enter' && newAgentComment.trim()) {
                                          if (!user) return;
                                          try {
                                            await ticketService.addAgentComment(selectedTicket.id, {
                                              content: newAgentComment.trim(),
                                              agentId: user.uid,
                                              agentName: user.displayName || user.email || 'Agent'
                                            });
                                            setNewAgentComment("");
                                            // Reload comments
                                            const updatedTicket = await ticketService.getTicket(selectedTicket.id);
                                            if (updatedTicket) {
                                              setAllTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));
                                            }
                                  toast.success(t('tickets.notes.noteLogged', 'Internal note logged.'));
                                } catch (err) {
                                  toast.error(t('tickets.notes.noteFailed', 'Failed to log internal note.'));
                                }
                                        }
                                      }}
                                    />
                                    <Button 
                                      size="sm" 
                                      className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-100 dark:hover:bg-amber-850 text-amber-900 border-none font-bold text-[10px] h-7 px-3 rounded-lg shadow-sm font-sans"
                                      onClick={async () => {
                                        if (!newAgentComment.trim() || !user) return;
                                        try {
                                          await ticketService.addAgentComment(selectedTicket.id, {
                                            content: newAgentComment.trim(),
                                            agentId: user.uid,
                                            agentName: user.displayName || user.email || 'Agent'
                                          });
                                          setNewAgentComment("");
                                          // Reload comments
                                          const updatedTicket = await ticketService.getTicket(selectedTicket.id);
                                          if (updatedTicket) {
                                            setAllTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));
                                          }
                                          toast.success(t('tickets.notes.noteLogged', 'Internal note logged.'));
                                        } catch (err) {
                                          toast.error(t('tickets.notes.noteFailed', 'Failed to log internal note.'));
                                        }
                                      }}
                                    >
                                      {t('tickets.notes.postNoteBtn', 'Post Note')}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
    
                            {/* 3. Modernized chronological message & notes feed */}
                            <ConversationTimeline 
                              ticket={selectedTicket}
                              messages={messages}
                              agentComments={selectedTicket.agentComments || []}
                              onReplyClick={() => {
                                setIsComposerExpanded(true);
                                setTimeout(() => {
                                  const replyComposer = document.getElementById('email-reply-composer');
                                  if (replyComposer) replyComposer.scrollIntoView({ behavior: 'smooth' });
                                }, 100);
                              }}
                              onQuoteClick={(text) => {
                                setReplyText(prev => prev ? `${prev}<blockquote>${text}</blockquote><br/>` : `<blockquote>${text}</blockquote><br/>`);
                                setIsComposerExpanded(true);
                                setTimeout(() => {
                                  const replyComposer = document.getElementById('email-reply-composer');
                                  if (replyComposer) replyComposer.scrollIntoView({ behavior: 'smooth' });
                                }, 100);
                              }}
                              onInternalNoteAction={() => {
                                setAreNotesExpanded(true);
                                setTimeout(() => {
                                  const quickNoteInput = document.getElementById('quick-internal-note-input');
                                  if (quickNoteInput) quickNoteInput.focus();
                                }, 100);
                              }}
                              onAddAgentComment={async (text) => {
                                if (!user) return;
                                try {
                                  await ticketService.addAgentComment(selectedTicket.id, {
                                    content: text,
                                    agentId: user.uid,
                                    agentName: user.displayName || user.email || 'Agent'
                                  });
                                  // Reload agent comments by grabbing latest ticket info
                                  const updatedTicket = await ticketService.getTicket(selectedTicket.id);
                                  if (updatedTicket) {
                                    setAllTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));
                                  }
                                  toast.success(t('tickets.notes.noteLogged', 'Internal note logged.'));
                                } catch (e) {
                                  toast.error(t('tickets.notes.noteFailed', 'Failed to log internal note.'));
                                }
                              }}
                              isTranslating={isTranslating}
                              translatedTicket={translatedTicket}
                            />
    
                            {/* 4. Professional email-style response composer (Foldable/collapsed by default) */}
                            {isComposerExpanded ? (
                              <div className="relative">
                                <EmailComposer 
                                  ticket={selectedTicket}
                                  value={replyText}
                                  onChange={setReplyText}
                                  isDrafting={isAiDrafting || isGhostDrafting}
                                  ghostDraft={ghostDraft}
                                  onAcceptGhostDraft={acceptGhostDraft}
                                  onSend={handleSendReply}
                                  onDiscard={() => {
                                    setReplyText("");
                                    setLegalViolation(null);
                                    setIsComposerExpanded(false);
                                  }}
                                  isAiReady={isAiReady}
                                  isAiDrafting={isAiDrafting}
                                  onDraftWithAI={generateAiReply}
                                  onImproveWriting={async () => {
                                    if (!isAiReady || !replyText) return;
                                    try {
                                      const polished = await ai.improveTone(replyText, 'Professional');
                                      setReplyText(polished);
                                      toast.success(t('tickets.detail.tonePolishApplied', 'Ton-Abgleich mit KI angewendet.'));
                                    } catch (e) {
                                      toast.error(t('tickets.detail.tonePolishFailed', 'Verbesserung des Schreibstils fehlgeschlagen.'));
                                    }
                                  }}
                                  onTranslate={async () => {
                                    if (!isAiReady || !replyText) return;
                                    try {
                                      const translated = await ai.translate(replyText, 'German', translationMood);
                                      setReplyText(translated);
                                      toast.success(t('tickets.detail.translatedToClientLang', 'Entwurf in die Kundensprache übersetzt.'));
                                    } catch (e) {
                                      toast.error(t('tickets.detail.translationAssistFailed', 'Übersetzungshilfe fehlgeschlagen.'));
                                    }
                                  }}
                                  onSummarize={updateSummary}
                                  legalViolation={legalViolation}
                                  isValidatingLegal={isValidatingLegal}
                                  aiDraftMeta={aiDraftMeta}
                                  autoDispatchThreshold={95}
                                  isAutoDispatched={selectedTicket?.aiAutoDispatched === true}
                                />
                                <div className="mt-2 flex justify-end">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-xs text-muted-foreground font-semibold hover:text-foreground h-8"
                                    onClick={() => setIsComposerExpanded(false)}
                                  >
                                    {t('tickets.composer.collapseResponseEditor', 'Collapse Response Editor')}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="p-4 bg-muted/40 border border-dashed border-border rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-900">
                                    <Mail className="w-4 h-4" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{t('tickets.composer.noActiveDraft', 'No active response draft')}</span>
                                    <span className="text-[10px] text-muted-foreground">{t('tickets.composer.clickReplyDesc', 'Click reply on any message or details header to write a message to the client.')}</span>
                                  </div>
                                </div>
                                <Button 
                                  size="sm" 
                                  className="bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs h-8 px-3 rounded-lg shadow-sm"
                                  onClick={() => setIsComposerExpanded(true)}
                                >
                                  {t('tickets.composer.expandResponseForm', 'Expand Response Form')}
                                </Button>
                              </div>
                            )}
    
                            {/* 5. Bento Grid horizontal context cards at the end */}
                            <TicketKindFieldsCard
                              ticket={selectedTicket}
                              onUpdate={(data) => handleInlineUpdate(selectedTicket.id, data)}
                            />
                            <SmartContextPanel 
                              ticket={selectedTicket}
                              contact={ticketContact}
                              company={ticketCompany}
                              allTickets={allTickets}
                            />
                          </div>
                        )}
    
                        {activeDetailTab === 'customer' && (
                          <CustomerTabContent 
                            ticket={selectedTicket}
                            contact={ticketContact}
                            company={ticketCompany}
                            contactSchema={contactSchema}
                            allTickets={allTickets}
                          />
                        )}
    
                        {activeDetailTab === 'timeline' && (
                          <TimelineTabContent 
                            ticket={selectedTicket}
                            messages={messages}
                            agentComments={selectedTicket.agentComments || []}
                          />
                        )}
    
                        {activeDetailTab === 'ai_insights' && (
                          <AiInsightsTabContent 
                            ticket={selectedTicket}
                            aiSummary={aiSummary}
                            aiSources={aiSources}
                            isAiReady={isAiReady}
                          />
                        )}
    
                        {activeDetailTab === 'assets' && (
                          <AssetsTabContent ticket={selectedTicket} />
                        )}
    
                        {activeDetailTab === 'related_tickets' && (
                          <RelatedTicketsTabContent 
                            ticket={selectedTicket}
                            suggestedNeuralLinks={suggestedNeuralLinks}
                            isFindingNeuralLinks={isFindingNeuralLinks}
                            onFindNeuralLinks={findNeuralLinks}
                            onLinkTicket={linkTicket}
                            onUnlinkTicket={unlinkTicket}
                            linkInput={linkInput}
                            onChangeLinkInput={setLinkInput}
                          />
                        )}
    
                        {activeDetailTab === 'tasks' && (
                          <TasksTabContent
                            ticket={selectedTicket}
                            onChecklistUpdated={handleChecklistUpdated}
                          />
                        )}
    
                      </div>
                  </ScrollArea>
                </div> {/* End of message column */}
                {/* Mobile drawer backdrop (tap to dismiss); never shown on desktop. */}
                {isMobilePropertiesOpen && (
                  <div
                    onClick={() => setIsMobilePropertiesOpen(false)}
                    className="xl:hidden absolute inset-0 z-20 bg-black/40 backdrop-blur-[1px]"
                    aria-hidden="true"
                  />
                )}
    </>
  );
}
