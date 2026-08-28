import {
  AlertCircle, Angry, ArrowRight, BookOpen, CheckCircle2, ChevronDown, Frown, GitMerge,
  Info, Meh, MessageSquare, Search, SearchCheck, ShieldCheck, Smile, Sparkles,
  Trash2, UserPlus, Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn, safeString } from '../../lib/utils';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useTranslation } from '../../lib/context/I18nContext';
import { redactPII } from '../../lib/ai/pii-shield';
import { stripHtml } from '../kb/kb-utils';
import type { Ticket as TicketType, Message } from '../../types';

export interface TicketDialogsProps {
  pendingResolveStatus: string | null;
  setPendingResolveStatus: (v: string | null) => void;
  pendingResolveIncludeRag: boolean;
  setPendingResolveIncludeRag: (v: boolean) => void;
  confirmResolveStatusChange: () => void;
  hoveredTicketId: string | null;
  hoveredTicket: TicketType | null;
  peekOffset: { x: number; y: number };
  peekMessages: Message[];
  isMergeDialogOpen: boolean;
  setIsMergeDialogOpen: (v: boolean) => void;
  mergeSearchQuery: string;
  setMergeSearchQuery: (v: string) => void;
  mergeSearchSuggestions: TicketType[];
  handleMerge: (destinationId: string) => void;
  selectedTicketIds: string[];
  setSelectedTicketIds: (v: string[]) => void;
  handleBulkUpdate: (updates: Partial<TicketType>) => Promise<void>;
  user: { uid?: string; displayName?: string | null; email?: string | null } | null;
  isSentimentBreakdownOpen: boolean;
  setIsSentimentBreakdownOpen: (v: boolean) => void;
  sentimentTicketId: string | null;
  allTickets: TicketType[];
  isHandoffOpen: boolean;
  setIsHandoffOpen: (v: boolean) => void;
  isGeneratingHandoff: boolean;
  handoffSummary: { customerGoal: string; effortSoFar: string[] } | null;
  confirmHandoff: () => void;
  isKbConvertOpen: boolean;
  setIsKbConvertOpen: (v: boolean) => void;
  kbDraft: { title: string; content: string; tags: string[] } | null;
  setKbDraft: (draft: { title: string; content: string; tags: string[] } | null) => void;
  isKbDrafting: boolean;
  confirmKbConvert: () => void;
}

export function TicketDialogs(props: TicketDialogsProps) {
  const { t } = useTranslation();
  const {
    pendingResolveStatus,
    setPendingResolveStatus,
    pendingResolveIncludeRag,
    setPendingResolveIncludeRag,
    confirmResolveStatusChange,
    hoveredTicketId,
    hoveredTicket,
    peekOffset,
    peekMessages,
    isMergeDialogOpen,
    setIsMergeDialogOpen,
    mergeSearchQuery,
    setMergeSearchQuery,
    mergeSearchSuggestions,
    handleMerge,
    selectedTicketIds,
    setSelectedTicketIds,
    handleBulkUpdate,
    user,
    isSentimentBreakdownOpen,
    setIsSentimentBreakdownOpen,
    sentimentTicketId,
    allTickets,
    isHandoffOpen,
    setIsHandoffOpen,
    isGeneratingHandoff,
    handoffSummary,
    confirmHandoff,
    isKbConvertOpen,
    setIsKbConvertOpen,
    kbDraft,
    setKbDraft,
    isKbDrafting,
    confirmKbConvert,
  } = props;

  return (
    <>
      {pendingResolveStatus && (
          <Dialog open onOpenChange={(open) => { if (!open) setPendingResolveStatus(null); }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  {pendingResolveStatus === 'resolved'
                    ? 'Ticket als gelöst markieren?'
                    : 'Ticket schließen?'}
                </DialogTitle>
                <DialogDescription>
                  Das Ticket wird als <b>{pendingResolveStatus}</b> gespeichert und der Kunde über den Abschluss informiert.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-between p-3 bg-violet-50 border border-violet-100 rounded-xl">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-violet-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                    🧠 Für KI-RAG indexieren
                  </span>
                  <span className="text-[10px] text-violet-600 mt-0.5">
                    Erstellt beim Lösen einen KI-Wissenseintrag aus dieser Lösung.
                  </span>
                </div>
                <Switch
                  checked={pendingResolveIncludeRag}
                  onCheckedChange={setPendingResolveIncludeRag}
                />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPendingResolveStatus(null)}>
                  Abbrechen
                </Button>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={confirmResolveStatusChange}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {pendingResolveStatus === 'resolved' ? 'Als gelöst markieren' : 'Schließen'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

      <AnimatePresence>
        {hoveredTicketId && hoveredTicket && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed z-[100] w-[400px] pointer-events-none"
            style={{ 
              left: Math.min(peekOffset.x + 20, window.innerWidth - 430), 
              top: Math.min(peekOffset.y, window.innerHeight - 500) 
            }}
          >
            <div className="bg-card rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-border overflow-hidden flex flex-col backdrop-blur-xl">
              <div className="p-4 border-b bg-muted flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('tickets.peekView', 'Peek View')}</span>
                 </div>
                 <Badge variant="outline" className="text-[9px] font-bold border-border text-muted-foreground">#{hoveredTicket.id.slice(0, 4)}</Badge>
              </div>
              
              <div className="p-5 space-y-4">
                 {/* Sentiment Indicator */}
                 <div className="flex items-center justify-between p-3 bg-muted rounded-xl border border-border">
                    <div className="flex items-center gap-2">
                       <Sparkles className="w-3.5 h-3.5 text-[#1A73E8]" />
                       <span className="text-[10px] font-bold text-[#5F6368] uppercase tracking-tight">{t('tickets.aiSentimentAnalysis', 'AI Sentiment Analysis')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-card border border-border">
                       {hoveredTicket.sentiment === 'angry' ? <Angry className="w-3 h-3 text-rose-500" /> :
                        hoveredTicket.sentiment === 'negative' ? <Frown className="w-3 h-3 text-orange-500" /> :
                        hoveredTicket.sentiment === 'positive' ? <Smile className="w-3 h-3 text-emerald-500" /> :
                        <Meh className="w-3 h-3 text-slate-400" />}
                       <span className={cn(
                          "text-[9px] font-bold uppercase",
                          hoveredTicket.sentiment === 'angry' ? "text-rose-600" :
                          hoveredTicket.sentiment === 'negative' ? "text-orange-600" :
                          hoveredTicket.sentiment === 'positive' ? "text-emerald-600" :
                          "text-slate-500"
                       )}>{hoveredTicket.sentiment || 'neutral'}</span>
                    </div>
                 </div>

                 {/* Internal Notes */}
                 {hoveredTicket.internalNotes ? (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                       <div className="flex items-center gap-1.5 mb-2">
                          <Info className="w-3.5 h-3.5 text-amber-600" />
                          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-tight">{t('tickets.internalNote', 'Internal Note')}</span>
                       </div>
                       <p className="text-xs text-amber-800 font-medium leading-relaxed italic">
                          "{hoveredTicket.internalNotes}"
                       </p>
                    </div>
                 ) : (
                    <div className="flex items-center gap-2 p-3 bg-[#F8F9FA] rounded-xl border border-[#DADCE0] border-dashed">
                       <Info className="w-3.5 h-3.5 text-[#BDC1C6]" />
                       <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight italic">{t('tickets.noInternalNotesYet', 'No internal notes yet')}</span>
                    </div>
                 )}

                 {/* Last Messages */}
                 <div className="space-y-3">
                    <div className="flex items-center gap-2">
                       <MessageSquare className="w-3.5 h-3.5 text-[#1A73E8]" />
                       <span className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest">{t('tickets.recentActivity', 'Recent Activity')}</span>
                    </div>
                    
                    <div className="space-y-3">
                       {peekMessages.length > 0 ? (
                          peekMessages.map((msg, i) => (
                             <div key={msg.id} className={cn(
                                "p-3 rounded-xl border transition-all",
                                i === 0 ? "bg-accent border-accent shadow-sm ml-4" : "bg-card border-border mr-4"
                             )}>
                                <div className="flex items-center justify-between mb-1">
                                   <span className="text-[10px] font-bold text-muted-foreground uppercase">{msg.senderName || msg.senderType}</span>
                                   <span className="text-[9px] text-[#9AA0A6]">{msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t('tickets.justNow', 'Gerade eben')}</span>
                                </div>
                                <p className="text-xs text-foreground line-clamp-3 leading-relaxed">
                                   {redactPII(stripHtml(msg.content))}
                                </p>
                             </div>
                          ))
                       ) : (
                          <p className="text-xs text-muted-foreground italic pl-6 py-4">Loading conversation thread...</p>
                       )}
                    </div>
                 </div>
              </div>
              
              <div className="px-5 py-3 bg-muted border-t border-border flex items-center gap-2">
                 <Zap className="w-3.5 h-3.5 text-primary" />
                 <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight italic">{t('tickets.pressToExpand', 'Klicken zum Erweitern für vollständigen Kontext')}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The Unifier: Merge Tickets Dialog */}
      <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
        <DialogContent className="sm:max-w-[500px] border-border bg-card">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100">
                <GitMerge className="w-5 h-5 text-indigo-600" />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">{t('tickets.merge.title', 'The Unifier')}</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground">
              {t('tickets.merge.desc', 'Select the original ticket to merge this current duplicate into.')}
              <br/>
              <span className="font-bold text-destructive">{t('tickets.merge.warning', 'Warning:')}</span> {t('tickets.merge.warningDesc', 'All messages from this ticket will be moved, and this ticket will be marked as merged.')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <label className="text-xs font-bold text-foreground uppercase tracking-widest px-1">{t('tickets.merge.searchLabel', 'Original Ticket Search')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder={t('tickets.merge.searchPlaceholder', 'Search by ID or Subject...')} 
                  className="pl-10 h-12 bg-muted/30 border-border rounded-xl"
                  value={mergeSearchQuery}
                  onChange={(e) => setMergeSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
               {mergeSearchSuggestions.length > 0 ? (
                 mergeSearchSuggestions.map((mergeTicket) => (
                   <button 
                     key={mergeTicket.id}
                     onClick={() => handleMerge(mergeTicket.id)}
                     className="w-full text-left p-4 rounded-xl border border-border bg-card hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group flex items-center justify-between"
                   >
                     <div className="flex flex-col gap-1 overflow-hidden">
                       <span className="text-xs font-black text-indigo-600 uppercase tracking-tighter">#{mergeTicket.id.slice(-5).toUpperCase()}</span>
                       <span className="text-sm font-bold text-foreground truncate">{safeString(mergeTicket.subject)}</span>
                       <div className="flex items-center gap-2 mt-1">
                          <Badge className="text-[9px] font-bold h-4 uppercase">{t(`tickets.status.${(mergeTicket.status || 'open').toLowerCase()}`, mergeTicket.status || 'Offen')}</Badge>
                          <span className="text-[10px] text-muted-foreground">{safeString(mergeTicket.customerName)}</span>
                       </div>
                     </div>
                     <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                   </button>
                 ))
               ) : mergeSearchQuery.trim() ? (
                 <div className="py-8 text-center text-muted-foreground space-y-2">
                    <SearchCheck className="w-8 h-8 mx-auto opacity-20" />
                    <p className="text-xs font-medium">{t('tickets.merge.notFound', 'Kein Original-Ticket für "{{query}}" gefunden').replace('{{query}}', mergeSearchQuery)}</p>
                 </div>
               ) : (
                 <div className="py-8 text-center text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border">
                    <Info className="w-8 h-8 mx-auto opacity-20 mb-2" />
                    <p className="text-xs font-medium">{t('tickets.merge.hint', 'Ticket-ID oder Betreff eingeben, um den Original-Thread zu finden.')}</p>
                 </div>
               )}
            </div>
          </div>

          <DialogFooter className="sm:justify-start">
            <Button 
              variant="ghost" 
              className="text-xs font-bold uppercase text-muted-foreground"
              onClick={() => setIsMergeDialogOpen(false)}
            >
              {t('actions.cancel', 'Cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      

      <Dialog open={isSentimentBreakdownOpen} onOpenChange={setIsSentimentBreakdownOpen}>
        <DialogContent className="max-w-md bg-card border-border shadow-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {t('tickets.sentiment.title', 'Sentiment Breakdown')}
            </DialogTitle>
            <DialogDescription>
              {t('tickets.sentiment.desc', "AI-powered analysis of the customer's emotional state throughout this ticket.")}
            </DialogDescription>
          </DialogHeader>
          
          {sentimentTicketId && (
            <div className="space-y-6 pt-4">
              {(() => {
                const ticket = allTickets.find(t => t.id === sentimentTicketId);
                if (!ticket) return null;
                
                return (
                  <>
                    <div className="flex items-center justify-between p-4 bg-muted rounded-2xl border border-border">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('tickets.sentiment.calculated', 'Calculated Sentiment')}</p>
                        <p className="text-xl font-black text-foreground capitalize">{ticket.sentiment || t('tickets.sentiment.neutral', 'Neutral')}</p>
                      </div>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center bg-card border border-border shadow-sm">
                        {ticket.sentiment === 'angry' && <Angry className="w-7 h-7 text-rose-500" />}
                        {ticket.sentiment === 'negative' && <Frown className="w-7 h-7 text-orange-500" />}
                        {ticket.sentiment === 'positive' && <Smile className="w-7 h-7 text-emerald-500" />}
                        {(!ticket.sentiment || ticket.sentiment === 'neutral') && <Meh className="w-7 h-7 text-slate-400" />}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-primary" />
                        {t('tickets.sentiment.analysisDetails', 'AI Analysis Details')}
                      </h4>
                      <div className="space-y-2">
                        {ticket.sentiment === 'angry' ? (
                          <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl">
                            <p className="text-sm text-foreground/80 leading-relaxed font-medium">
                              AI detected high frustration in this ticket based on multiple signal factors:
                            </p>
                            <ul className="mt-2 space-y-1.5 list-disc list-inside text-xs text-muted-foreground">
                              <li>Highly negative framing of problem description</li>
                              <li>Multiple exclamatory or capitalized phrases</li>
                              <li>History of similar unresolved issues</li>
                              <li>Urgency signals exceeding standard priority thresholds</li>
                            </ul>
                          </div>
                        ) : ticket.sentiment === 'negative' ? (
                          <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                            <p className="text-sm text-foreground/80 leading-relaxed font-medium">
                              AI detected negative undertones in this interaction:
                            </p>
                            <ul className="mt-2 space-y-1.5 list-disc list-inside text-xs text-muted-foreground">
                              <li>Polite but disappointed language markers</li>
                              <li>Expressions of repeated failure to solve the issue</li>
                              <li>Concerned regarding impact on their business workflow</li>
                            </ul>
                          </div>
                        ) : ticket.sentiment === 'positive' ? (
                          <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                            <p className="text-sm text-foreground/80 leading-relaxed font-medium">
                              Customer appears satisfied with the current progress:
                            </p>
                            <ul className="mt-2 space-y-1.5 list-disc list-inside text-xs text-muted-foreground">
                              <li>Gratitude markers detected ("Thanks", "Helpful")</li>
                              <li>Optimistic framing of the conversation</li>
                              <li>Calm and cooperative response patterns</li>
                            </ul>
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-500/5 border border-slate-500/20 rounded-xl">
                            <p className="text-sm text-foreground/80 leading-relaxed font-medium">
                              Sentiment remains neutral or transactional:
                            </p>
                            <ul className="mt-2 space-y-1.5 list-disc list-inside text-xs text-muted-foreground">
                              <li>Matter-of-fact communication style</li>
                              <li>Focus solely on technical requirements</li>
                              <li>No significant emotional markers detected</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-muted p-4 rounded-xl border border-border">
                       <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{t('tickets.sentiment.recommendedAction', 'Recommended Action')}</p>
                       <p className="text-xs text-foreground font-semibold">
                          {ticket.sentiment === 'angry' ? t('tickets.sentiment.actionAngry', 'Transfer to Senior Specialist immediately.') : 
                           ticket.sentiment === 'negative' ? t('tickets.sentiment.actionNegative', 'Address with extra empathy and offer a workaround.') :
                           t('tickets.sentiment.actionNeutral', 'Continue standard processing pipeline.')}
                       </p>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          
          <DialogFooter className="mt-6 border-t pt-4 bg-muted/30 px-6 -mx-6 -mb-6">
            <Button onClick={() => setIsSentimentBreakdownOpen(false)} className="rounded-full px-8 font-bold">
              {t('tickets.sentiment.dismiss', 'Dismiss Analysis')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Actions Toolbar */}
      <AnimatePresence>
        {selectedTicketIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-full px-6 py-3 shadow-2xl shadow-black/40"
          >
            <div className="flex items-center gap-3 pr-4 border-r border-gray-800">
              <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white">
                {selectedTicketIds.length}
              </div>
              <span className="text-xs font-bold text-white">{t('tickets.bulkFloat.ticketsSelected', 'Tickets ausgewählt')}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedTicketIds([])}
                className="h-7 text-[10px] uppercase font-bold text-gray-400 hover:text-white hover:bg-gray-800"
              >
                {t('tickets.bulkFloat.cancel', 'Abbrechen')}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="ghost" size="sm" className="h-9 px-4 rounded-full text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 gap-2">
                    {t('tickets.bulkFloat.status', 'Status')} <ChevronDown className="w-3 h-3" />
                  </Button>
                } />
                <DropdownMenuContent className="w-40">
                  {['open', 'pending', 'resolved', 'closed'].map(s => (
                    <DropdownMenuItem key={s} className="capitalize text-xs" onClick={() => handleBulkUpdate({ status: s as any })}>
                      {t(`tickets.status.${s}`, s)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="ghost" size="sm" className="h-9 px-4 rounded-full text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 gap-2">
                    {t('tickets.bulkFloat.priority', 'Priorität')} <ChevronDown className="w-3 h-3" />
                  </Button>
                } />
                <DropdownMenuContent className="w-40">
                  {['low', 'medium', 'high', 'urgent'].map(p => (
                    <DropdownMenuItem key={p} className="capitalize text-xs" onClick={() => handleBulkUpdate({ priority: p as any })}>
                      {t(`tickets.priority.${p}`, p)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="ghost" size="sm" className="h-9 px-4 rounded-full text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 gap-2">
                    {t('tickets.bulkFloat.assignAgent', 'Agent zuweisen')} <ChevronDown className="w-3 h-3" />
                  </Button>
                } />
                <DropdownMenuContent className="w-56">
                  <DropdownMenuItem className="text-xs font-semibold" onClick={() => handleBulkUpdate({ agentId: user?.uid, agentName: user?.email })}>
                    {t('tickets.bulkFloat.assignToMe', 'Mir zuweisen')}
                  </DropdownMenuItem>
                  <Separator className="my-1" />
                  {['Sarah Agent', 'Mike Lead', 'Dev Team'].map(a => (
                    <DropdownMenuItem key={a} className="text-xs" onClick={() => handleBulkUpdate({ agentName: a })}>
                      {a}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="w-px h-6 bg-gray-800 mx-2" />

              <Tooltip>
                <TooltipTrigger 
                  className="h-9 w-9 rounded-full text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center justify-center transition-colors cursor-pointer"
                  onClick={() => handleBulkUpdate({ status: 'deleted' })}
                >
                  <Trash2 className="w-4 h-4" />
                </TooltipTrigger>
                <TooltipContent>{t('tickets.bulkFloat.moveToTrash', 'In den Papierkorb verschieben')}</TooltipContent>
              </Tooltip>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GeistDesk Handoff Engine Modal */}
      <Dialog open={isHandoffOpen} onOpenChange={setIsHandoffOpen}>
        <DialogContent className="sm:max-w-[500px] bg-slate-50 border-amber-100 rounded-2xl overflow-hidden p-0 gap-0 shadow-2xl">
          <div className="bg-amber-50 p-6 border-b border-amber-100">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-amber-100 p-2 rounded-xl">
                  <UserPlus className="w-5 h-5 text-amber-600" />
                </div>
                <Badge variant="outline" className="bg-white border-amber-200 text-amber-700 text-[10px] font-black uppercase tracking-widest px-2 h-5">
                  GeistDesk Handoff Engine
                </Badge>
              </div>
              <DialogTitle className="text-xl font-bold text-slate-900">{t('tickets.handoff.title', 'High-Priority Transfer Briefing')}</DialogTitle>
              <DialogDescription className="text-slate-500 font-medium text-sm">
                {t('tickets.handoff.desc', 'AI is summarizing the context to ensure a smooth transition for the next agent.')}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-6">
            {isGeneratingHandoff ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                  <div className="h-12 w-12 border-4 border-amber-100 border-t-amber-500 rounded-full animate-spin" />
                  <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-amber-500 animate-pulse" />
                </div>
                <p className="text-xs font-black text-amber-600 uppercase tracking-widest animate-pulse">{t('tickets.handoff.analyzing', 'Analysiere Thread-Logik...')}</p>
              </div>
            ) : handoffSummary ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-slate-400" />
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-tighter">{t('tickets.handoff.customerWants', 'What the customer wants')}</label>
                  </div>
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm italic text-sm text-slate-700 leading-relaxed font-medium">
                    "{handoffSummary.customerGoal}"
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-tighter">{t('tickets.handoff.effortInvested', 'Effort Invested So Far')}</label>
                  </div>
                  <div className="space-y-2">
                    {handoffSummary.effortSoFar.map((effort, i) => (
                      <div key={i} className="flex gap-3 items-start group">
                        <div className="mt-1 h-5 w-5 bg-white border border-slate-200 rounded-lg flex items-center justify-center shrink-0 group-hover:border-amber-300 transition-colors">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        </div>
                        <span className="text-xs text-slate-600 font-medium leading-normal pt-0.5">{effort}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-100/50 p-3 rounded-lg flex items-center gap-3 border border-amber-200">
                   <ShieldCheck className="w-4 h-4 text-amber-600" />
                   <p className="text-[10px] font-bold text-amber-800 leading-tight">
                     {t('tickets.handoff.goldenNote', 'Mit der Bestätigung wird dieses Briefing automatisch als')} <span className="font-black text-amber-950 uppercase">Golden Note</span> {t('tickets.handoff.goldenNoteFor', 'für den nächsten Agenten angeheftet.')}
                   </p>
                </div>
              </motion.div>
            ) : (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-medium text-center">
                {t('tickets.handoff.failed', 'Briefing konnte nicht erstellt werden. Sie können die Übergabe trotzdem bestätigen.')}
              </div>
            )}
          </div>

          <DialogFooter className="p-6 pt-2 bg-slate-50/50 border-t border-slate-100 gap-2">
            <Button variant="ghost" onClick={() => setIsHandoffOpen(false)} className="rounded-xl font-bold text-xs h-10 px-6">
              {t('tickets.handoff.cancelTransfer', 'Übergabe abbrechen')}
            </Button>
            <Button 
                onClick={confirmHandoff}
                disabled={isGeneratingHandoff}
                className="bg-slate-900 text-white hover:bg-black rounded-xl font-black text-xs h-10 px-6 shadow-lg shadow-slate-200"
            >
              {t('tickets.handoff.confirmTransfer', 'Übergabe bestätigen')} <ArrowRight className="w-3.5 h-3.5 ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* In Wissensdatenbank übernehmen — KB conversion dialog */}
      <Dialog open={isKbConvertOpen} onOpenChange={setIsKbConvertOpen}>
        <DialogContent className="sm:max-w-[640px] bg-card border-border shadow-2xl overflow-hidden">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100">
                <BookOpen className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <Badge variant="outline" className="bg-white border-indigo-200 text-indigo-700 text-[10px] font-black uppercase tracking-widest px-2 h-5 mb-1.5">
                  {t('tickets.kbConvert.badge', 'Wissensdatenbank / RAG')}
                </Badge>
                <DialogTitle className="text-xl font-bold text-foreground">
                  {t('tickets.kbConvert.title', 'In Wissensdatenbank übernehmen')}
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-sm text-muted-foreground">
              {t('tickets.kbConvert.desc', 'Ticket-Inhalt wird als neuer Wissensartikel für die Vektor-Indexierung vorbereitet.')}
            </DialogDescription>
          </DialogHeader>

          {isKbDrafting ? (
            <div className="py-14 flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="h-12 w-12 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
                <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 animate-pulse" />
              </div>
              <p className="text-xs font-black text-indigo-600 uppercase tracking-widest animate-pulse">
                {t('tickets.kbConvert.extracting', 'Lösung wird extrahiert…')}
              </p>
            </div>
          ) : kbDraft ? (
            <div className="space-y-5 py-2">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest px-1">
                  {t('tickets.kbConvert.titleLabel', 'Artikeltitel')}
                </label>
                <Input
                  value={kbDraft.title}
                  onChange={(e) => setKbDraft({ ...kbDraft, title: e.target.value })}
                  className="h-11 bg-muted/30 border-border rounded-xl font-semibold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest px-1">
                  {t('tickets.kbConvert.contentLabel', 'Artikelinhalt')}
                </label>
                <Textarea
                  value={kbDraft.content}
                  onChange={(e) => setKbDraft({ ...kbDraft, content: e.target.value })}
                  rows={12}
                  className="bg-muted/30 border-border rounded-xl font-medium leading-relaxed text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest px-1">
                  {t('tickets.kbConvert.tagsLabel', 'Tags')}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {kbDraft.tags.map((tag) => (
                    <Badge
                      key={tag}
                      className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold h-5 gap-1 cursor-pointer hover:bg-indigo-100"
                      onClick={() => setKbDraft({ ...kbDraft, tags: kbDraft.tags.filter(t => t !== tag) })}
                    >
                      {tag} <span className="text-indigo-400 font-black">×</span>
                    </Badge>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  {t('tickets.kbConvert.tagsHint', 'Tags stammen aus dem Ticket – klicken Sie auf einen Tag, um ihn zu entfernen.')}
                </p>
              </div>

              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                <p className="text-[10.5px] text-indigo-800 font-semibold leading-relaxed">
                  {t('tickets.kbConvert.ragHint', 'Beim Speichern wird der Artikel automatisch für die RAG-Indexierung (pgvector) eingereiht und ist über KI-Antworten abrufbar.')}
                </p>
              </div>
            </div>
          ) : (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
              <Sparkles className="w-8 h-8 text-indigo-400 opacity-40" />
              <p className="text-sm text-muted-foreground font-medium max-w-sm">
                {t('tickets.kbConvert.noDraft', 'Kein Entwurf verfügbar. Bitte die KI-Extraktion erneut starten.')}
              </p>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsKbConvertOpen(false);
                setKbDraft(null);
              }}
              disabled={isKbDrafting}
              className="rounded-xl font-bold text-xs h-10 px-6 border-border"
            >
              {t('actions.cancel', 'Abbrechen')}
            </Button>
            <Button
              onClick={confirmKbConvert}
              disabled={isKbDrafting || !kbDraft || !kbDraft.title.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs h-10 px-6 shadow-lg shadow-indigo-200"
            >
              <BookOpen className="w-3.5 h-3.5 mr-1.5" />
              {t('tickets.kbConvert.save', 'Als KB-Artikel speichern')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
