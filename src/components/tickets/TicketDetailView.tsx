import { useState, type Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';
import {
  BookOpen, ChevronDown, ChevronLeft, GitMerge, MessageSquare,
  MoreHorizontal, RefreshCw, SlidersHorizontal, Sparkles, StickyNote, Ticket, Ban,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getInitials, safeString } from '../../lib/utils';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
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
import { DynamicSentimentGlyph } from '../ticket-details/DynamicSentimentGlyph';
import { useTranslation } from '../../lib/context/I18nContext';
import { formatTicketCode } from '../../lib/ticketMerge';
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

  const [composerTab, setComposerTab] = useState<'reply' | 'note'>('reply');

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

  const canMerge = Boolean(onOpenMerge) && selectedTicket.status !== 'merged';
  const ticketRef = selectedTicket.customId
    ? `#${String(selectedTicket.customId).replace(/^#/, '')}`
    : formatTicketCode(selectedTicket);

  const openInternalNoteComposer = () => {
    setActiveDetailTab('conversation');
    setIsComposerExpanded(true);
    setComposerTab('note');
    setTimeout(() => {
      const noteEl =
        document.getElementById('composer-internal-note-input') ||
        document.getElementById('quick-internal-note-input') ||
        document.getElementById('email-reply-composer');
      if (noteEl) {
        noteEl.scrollIntoView({ behavior: 'smooth' });
        if ('focus' in noteEl) (noteEl as HTMLElement).focus();
      }
    }, 100);
    toast.info(t('tickets.detail.switchedToComposer', 'Switched to conversation notes composer.'));
  };

  const runAiSync = () => {
    toast.promise(Promise.resolve(updateSummary(true)), {
      loading: t(
        'tickets.detail.aiSyncLoading',
        'Synchronisiere KI-Erkenntnisse mit dem neuesten E-Mail-Verlauf...',
      ),
      success: t('tickets.detail.aiSyncSuccess', 'KI-Erkenntnisse erfolgreich aktualisiert!'),
      error: t('tickets.detail.aiSyncError', 'Synchronisierung der KI-Erkenntnisse fehlgeschlagen.'),
    });
  };

  const actionBtnClass =
    'box-border inline-flex h-8 min-h-8 max-h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium leading-none shrink-0 transition-colors';
  const actionBtnPrimary = `${actionBtnClass} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-70 shadow-none`;
  const actionBtnOutline = `${actionBtnClass} border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 shadow-none`;
  const actionBtnIcon = `${actionBtnOutline} w-8 px-0`;

  return (
    <>
                    <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-slate-50">
                      {/* 1. Compact header: title + actions; badges live in the subtitle row */}
                    <div className="flex flex-col gap-1.5 w-full min-w-0 px-4 md:px-6 pt-3 md:pt-4 pb-3 border-b border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900 shrink-0">
                      <SwarmOutageBanner ticketId={selectedTicket.id} />

                      <div className="flex w-full min-w-0 items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={closeFullTicketView}
                            aria-label={t('tickets.detail.backToList', 'Back to tickets')}
                            title={t('tickets.detail.backToList', 'Back to tickets')}
                            className="flex items-center justify-center h-8 w-8 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors select-none shrink-0 mt-0.5"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-snug dark:text-slate-50 min-w-0 break-words">
                              {safeString(selectedTicket.subject)}
                            </h2>
                            <div className="flex items-center gap-1.5 mt-1 min-w-0 flex-wrap leading-none">
                              <span className="inline-flex h-5 items-center px-2 text-[11px] font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 shrink-0 capitalize">
                                {t(`tickets.status.${(selectedTicket.status || 'open').toLowerCase()}`, selectedTicket.status || 'Offen')}
                              </span>
                              <span className="inline-flex h-5 items-center px-2 text-[11px] font-medium rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 shrink-0 capitalize">
                                {t(`tickets.priority.${(selectedTicket.priority || 'medium').toLowerCase()}`, selectedTicket.priority || 'Mittel')}
                              </span>
                              <span className="inline-flex h-5 items-center text-[11px] font-medium tracking-normal text-slate-500 min-w-0">
                                {safeString(selectedTicket.company, 'Enterprise Corp')} &bull; {safeString(selectedTicket.customerName, 'PremtonXhafa')} &bull;{' '}
                                <span className="font-mono tabular-nums text-slate-600 font-semibold">{ticketRef}</span>
                              </span>
                              <DynamicSentimentGlyph sentiment={selectedTicket.sentiment} />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 h-8">
                          <button
                            type="button"
                            onClick={runAiSync}
                            disabled={isAiDrafting}
                            className={actionBtnPrimary}
                          >
                            {isAiDrafting ? (
                              <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span>{t('tickets.detail.aiSync', 'KI-Sync')}</span>
                          </button>
                          {onConvertToKB && (
                            <button
                              type="button"
                              onClick={onConvertToKB}
                              disabled={isKbDrafting}
                              className={actionBtnOutline}
                            >
                              {isKbDrafting
                                ? <RefreshCw className="w-3.5 h-3.5 shrink-0 text-indigo-500 animate-spin" />
                                : <BookOpen className="w-3.5 h-3.5 shrink-0 text-indigo-500" />}
                              <span>{isKbDrafting
                                ? t('tickets.detail.extracting', 'Extracting...')
                                : t('tickets.detail.convertToKbShort', 'In KB')}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={openInternalNoteComposer}
                            className={actionBtnOutline}
                          >
                            <StickyNote className="w-3.5 h-3.5 shrink-0" />
                            <span>{t('tickets.noteBtnShort', 'Notiz')}</span>
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <button
                                  type="button"
                                  className={actionBtnIcon}
                                  aria-label={t('tickets.detail.more', 'More')}
                                />
                              }
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 rounded-xl p-1">
                              {canMerge && (
                                <DropdownMenuItem
                                  className="rounded-lg text-xs font-semibold py-2 cursor-pointer"
                                  onClick={onOpenMerge}
                                >
                                  <GitMerge className="w-3.5 h-3.5 text-indigo-600" />
                                  {t('tickets.merge.button', 'Zusammenführen')}
                                </DropdownMenuItem>
                              )}
                              {selectedTicket.status !== 'spam' && (
                                <DropdownMenuItem
                                  className="rounded-lg text-xs font-semibold py-2 cursor-pointer text-rose-700"
                                  onClick={() => document.getElementById('ticket-header-spam-trigger')?.click()}
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  {t('tickets.spam.button', 'Als Spam markieren')}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="rounded-lg text-xs font-semibold py-2 cursor-pointer lg:hidden"
                                onClick={() => setIsMobilePropertiesOpen((prev) => !prev)}
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                                {isMobilePropertiesOpen
                                  ? t('tickets.detail.closeProps', 'Close properties')
                                  : t('tickets.detail.properties', 'Properties')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <TicketDetailsSpamAction
                            hideTrigger
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
                        </div>
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
                              "h-full px-4 text-xs border-b-2 transition-all shrink-0 flex items-center gap-2 relative",
                              activeDetailTab === tab.id 
                                ? "border-blue-600 text-blue-600 font-semibold" 
                                : "border-transparent text-slate-500 font-medium hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300"
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
                  <ScrollArea className="flex-1 min-h-0 px-6 py-4">
                      <div className="w-full space-y-4 pb-12">
                        
                        {activeDetailTab === 'conversation' && (
                          <div className="space-y-4">
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
                                setComposerTab('reply');
                                setTimeout(() => {
                                  const replyComposer = document.getElementById('email-reply-composer');
                                  if (replyComposer) replyComposer.scrollIntoView({ behavior: 'smooth' });
                                }, 100);
                              }}
                              onQuoteClick={(text) => {
                                setReplyText(prev => prev ? `${prev}<blockquote>${text}</blockquote><br/>` : `<blockquote>${text}</blockquote><br/>`);
                                setIsComposerExpanded(true);
                                setComposerTab('reply');
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
    
                            {/* 4. Professional email-style response composer */}
                            <div className="relative">
                                <div className="flex items-center gap-1 px-1">
                                  <button
                                    type="button"
                                    onClick={() => setComposerTab('reply')}
                                    className={cn(
                                      'h-8 px-3 text-xs border-b-2 transition-colors',
                                      composerTab === 'reply'
                                        ? 'border-blue-600 text-blue-600 font-semibold'
                                        : 'border-transparent text-slate-500 font-medium hover:text-slate-800',
                                    )}
                                  >
                                    {t('tickets.composer.publicReply', 'Öffentliche Antwort')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setComposerTab('note')}
                                    className={cn(
                                      'h-8 px-3 text-xs border-b-2 transition-colors',
                                      composerTab === 'note'
                                        ? 'border-blue-600 text-blue-600 font-semibold'
                                        : 'border-transparent text-slate-500 font-medium hover:text-slate-800',
                                    )}
                                  >
                                    {t('tickets.composer.internalNote', 'Interne Notiz')}
                                  </button>
                                </div>
                                {composerTab === 'note' ? (
                                  <div className="bg-card border border-border rounded-2xl shadow-md p-4 space-y-3">
                                    <textarea
                                      id="composer-internal-note-input"
                                      rows={5}
                                      value={newAgentComment}
                                      onChange={(e) => setNewAgentComment(e.target.value)}
                                      placeholder={t('tickets.notes.typeNotePlaceholder', 'Type an internal note to notify workforce, share state...')}
                                      className="w-full min-h-[120px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    <div className="flex justify-end">
                                      <Button
                                        size="sm"
                                        className="h-8 text-xs font-semibold"
                                        disabled={!newAgentComment.trim() || !user}
                                        onClick={async () => {
                                          if (!newAgentComment.trim() || !user) return;
                                          try {
                                            await ticketService.addAgentComment(selectedTicket.id, {
                                              content: newAgentComment.trim(),
                                              agentId: user.uid,
                                              agentName: user.displayName || user.email || 'Agent',
                                            });
                                            setNewAgentComment('');
                                            const updatedTicket = await ticketService.getTicket(selectedTicket.id);
                                            if (updatedTicket) {
                                              setAllTickets((prev) => prev.map((row) => (row.id === selectedTicket.id ? updatedTicket : row)));
                                            }
                                            toast.success(t('tickets.notes.noteLogged', 'Internal note logged.'));
                                          } catch {
                                            toast.error(t('tickets.notes.noteFailed', 'Failed to log internal note.'));
                                          }
                                        }}
                                      >
                                        {t('tickets.notes.logNote', 'Notiz speichern')}
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
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
                                )}
                              </div>
    
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
                              className={cn('lg:hidden', isMobilePropertiesOpen && 'hidden')}
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
                    className="lg:hidden absolute inset-0 z-20 bg-black/40 backdrop-blur-[1px]"
                    aria-hidden="true"
                  />
                )}
    </>
  );
}
