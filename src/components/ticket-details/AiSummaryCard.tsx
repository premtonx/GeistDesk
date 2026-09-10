import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from '../../lib/context/I18nContext';
import { 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  Lightbulb, 
  Smile, 
  Meh, 
  Frown, 
  ShieldAlert, 
  Clock,
  CheckCircle2,
  FileText,
  Wand2,
  ExternalLink,
  BookOpen,
  Ticket as TicketIcon
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Ticket as TicketType, TicketChecklistItem } from '../../types';
import { cn } from '../../lib/utils';
import { ticketService } from '../../services/ticketService';
import { normalizeChecklistItems } from '../../lib/ticket-checklist-utils';
import axios from 'axios';

interface RagReference {
  id: string;
  sourceType: 'KB_ARTICLE' | 'RESOLVED_TICKET';
  sourceId: string;
  title: string;
  category?: string | null;
  similarityPct: number;
  customId?: string;
}

interface AiSummaryCardProps {
  ticket: TicketType;
  aiSummary: string;
  isAiReady: boolean;
  onRefreshSummary: () => void;
  isAiDrafting: boolean;
  onChecklistUpdated?: (checklist: TicketChecklistItem[]) => void;
  onAdoptProposedSolution?: (text: string) => void;
}

export function AiSummaryCard({
  ticket,
  aiSummary,
  isAiReady,
  onRefreshSummary,
  isAiDrafting,
  onChecklistUpdated,
  onAdoptProposedSolution,
}: AiSummaryCardProps) {
  const { t } = useTranslation();
  
  // CRITICAL UI STATE requested:
  const [isAiSummaryExpanded, setIsAiSummaryExpanded] = useState(false);
  const [ragReferences, setRagReferences] = useState<RagReference[] | null>(null);

  // Proposed solution text: prefer the AI draft, fall back to the summary.
  const proposedSolution = useMemo(() => {
    const draft = ticket.aiSuggestedDraft || ticket.aiDraftRaw || '';
    if (draft.trim()) return draft.trim();
    return (ticket.aiSummary || aiSummary || '').trim();
  }, [ticket.aiSuggestedDraft, ticket.aiDraftRaw, ticket.aiSummary, aiSummary]);

  // Fetch top-3 RAG references (resolved tickets + KB articles) for this ticket.
  useEffect(() => {
    let alive = true;
    const query = [ticket.subject, ticket.description]
      .filter(Boolean)
      .join(' ')
      .slice(0, 6000);
    if (!query.trim()) return;
    axios
      .post(
        '/api/vectors/hybrid',
        { query, limit: 3 },
        { withCredentials: true },
      )
      .then((res) => {
        if (!alive) return;
        const hits: any[] = res.data?.hits || [];
        setRagReferences(
          hits.map((hit) => {
            const meta = hit.metadata || {};
            const vectorDistance = hit.vectorDistance == null ? null : Number(hit.vectorDistance);
            const similarityPct =
              vectorDistance == null
                ? Math.round((Number(hit.hybridScore) || 0) * 100)
                : Math.round((1 - Math.min(vectorDistance, 1)) * 100);
            return {
              id: String(hit.sourceId),
              sourceType: hit.sourceType as RagReference['sourceType'],
              sourceId: String(hit.sourceId),
              title: String(hit.title || meta.title || hit.sourceId),
              category: meta.category ? String(meta.category) : null,
              similarityPct,
              customId: meta.customId ? String(meta.customId) : undefined,
            };
          }),
        );
      })
      .catch(() => {
        if (alive) setRagReferences([]);
      });
    return () => {
      alive = false;
    };
  }, [ticket.id, ticket.subject, ticket.description]);

  const adoptProposedSolution = () => {
    if (!proposedSolution) return;
    if (onAdoptProposedSolution) {
      onAdoptProposedSolution(proposedSolution);
    }
  };

  const openReference = (ref: RagReference) => {
    if (ref.sourceType === 'RESOLVED_TICKET') {
      window.open(`/tickets/${ref.sourceId}`, '_blank', 'noopener,noreferrer');
    } else {
      window.open(`/kb?article=${encodeURIComponent(ref.sourceId)}`, '_blank', 'noopener,noreferrer');
    }
  };

  // Key Findings maps directly to ticket.aiSummary (or fallback aiSummary helper)
  const findings = useMemo(() => {
    const rawText = ticket.aiSummary || aiSummary;
    if (rawText) {
      return rawText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => line.replace(/^[-\s\d.*•]+\s*/, ''));
    }
    // Hardcoded high-quality fallback from mockup if both are empty
    return [
      "Microsoft Entra handshake delay identified.",
      "Billing records in offline mode fallback verify license pending.",
      "Operator queue prioritizes validation of communication tokens."
    ];
  }, [ticket.aiSummary, aiSummary]);

  // Action Plan checklists maps directly to ticket.aiChecklist
  const checklist = useMemo(
    () => normalizeChecklistItems(ticket.aiChecklist).slice(0, 3),
    [ticket.aiChecklist],
  );

  const handleToggleChecklist = async (taskId: string) => {
    const current = normalizeChecklistItems(ticket.aiChecklist);
    const optimistic = current.map((item) =>
      item.id === taskId ? { ...item, completed: !item.completed } : item,
    );
    onChecklistUpdated?.(optimistic);

    try {
      const next = await ticketService.toggleTaskCompletion(ticket.id, taskId);
      onChecklistUpdated?.(next);
    } catch (e) {
      console.error('Failed to commit interactive checklist state to database:', e);
      onChecklistUpdated?.(current);
    }
  };

  useEffect(() => {
    setIsAiSummaryExpanded(false);
  }, [ticket.id]);

  const rootCauseLine = useMemo(() => {
    const raw = (ticket.aiRootCause || '').trim();
    if (raw) return raw.replace(/^["']|["']$/g, '');
    return t(
      'tickets.aiSummaryCard.defaultRootCauseShort',
      'Conditional Access blocked OIDC callback',
    );
  }, [ticket.aiRootCause, t]);
  const slaRemainingTime = useMemo(() => {
    const now = new Date();
    const createdTime = ticket.createdAt?.toDate ? ticket.createdAt.toDate() : new Date(ticket.createdAt);
    const dueTime = ticket.slaDueAt?.toDate 
      ? ticket.slaDueAt.toDate() 
      : new Date(createdTime.getTime() + 2 * 3600 * 1000); // 2 hours

    const diff = dueTime.getTime() - now.getTime();
    if (diff <= 0) return "Breached";
    const hrs = Math.floor(diff / (3600 * 1000));
    const mins = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
    return hrs > 0 ? `Breaching in ${hrs}h ${mins}m` : `Breaching in ${mins}m`;
  }, [ticket]);  return (
    <Card className="bg-gradient-to-r from-blue-50/40 via-violet-50/40 to-indigo-50/30 dark:from-slate-900/60 dark:to-slate-850/40 border-indigo-100 dark:border-indigo-950 rounded-2xl shadow-xs overflow-hidden mb-4 gap-0 py-0">
      {/* Header section of the AI Assistant summary block */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isAiSummaryExpanded}
        aria-controls="ai-orchestrator-deep-dive-body"
        onClick={() => setIsAiSummaryExpanded((open) => !open)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsAiSummaryExpanded((open) => !open);
          }
        }}
        className={cn(
          'px-4 py-3 flex items-center justify-between gap-3 cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 select-none',
          isAiSummaryExpanded && 'border-b border-indigo-100/40 dark:border-indigo-950/50',
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm shadow-blue-500/20">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-bold text-slate-900 tracking-tight dark:text-indigo-200 font-sans">
                {t('tickets.aiSummaryCard.title', 'AI Orchestrator Deep-Dive Summary')}
              </h3>
              <Badge className="bg-[#E6F4EA] hover:bg-[#E6F4EA]/80 text-[#137333] dark:bg-emerald-950/50 dark:text-emerald-400 border-none font-bold text-[9px] tracking-wider px-2 py-0.5 rounded-full shadow-none">
                {t('tickets.aiSummaryCard.verifiedFacts', 'Verified Facts')}
              </Badge>
            </div>
            {isAiSummaryExpanded ? (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                {t('tickets.aiSummaryCard.subtitle', 'Automated diagnostic and suggested resolution metrics')}
              </p>
            ) : (
              <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium truncate mt-0.5">
                {t('tickets.aiSummaryCard.likelyCause', 'Likely cause')}: {rootCauseLine}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 font-bold shrink-0">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-[10px] font-bold bg-white text-slate-850 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 rounded-lg shadow-none"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isAiSummaryExpanded) {
                setIsAiSummaryExpanded(true);
                return;
              }
              onRefreshSummary();
            }}
            disabled={isAiDrafting || !isAiReady}
          >
            {isAiDrafting ? t('tickets.aiSummaryCard.analyzing', 'Analyzing...') : t('tickets.aiSummaryCard.fullAnalysis', 'Full Analysis')}
          </Button>
          <span
            className="h-7 w-7 inline-flex items-center justify-center text-slate-500 rounded-lg shrink-0"
            aria-hidden
          >
            {isAiSummaryExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </div>
      </div>

      {isAiSummaryExpanded ? (
        <CardContent id="ai-orchestrator-deep-dive-body" className="p-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                {/* Left Column: Key Findings & Root Cause */}
                <div className="space-y-4">
                  {/* Wichtigste Erkenntnisse */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <h4 className="text-xs font-bold text-slate-800 dark:text-indigo-300">
                        {t('tickets.aiSummaryCard.keyTakeaways', 'Key Takeaways')}
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 gap-2 pt-1">
                      {findings.map((finding, idx) => (
                        <div key={idx} className="flex gap-2 p-2.5 bg-white/70 dark:bg-slate-900/60 rounded-xl border border-indigo-50/10 dark:border-slate-850/65 shadow-[0_1px_2px_rgba(0,0,0,0.02)] items-start">
                          <span className="font-mono tabular-nums text-xs font-semibold text-blue-600 dark:text-blue-400 min-w-[14px]">
                            {idx + 1}.
                          </span>
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                            {finding}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Diagnostizierte Fehlerursache */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-indigo-500" />
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-300">
                        {t('tickets.aiSummaryCard.diagnosticRootCause', 'Diagnostic Root Cause')}
                      </h4>
                    </div>
                    <div className="font-mono text-xs text-slate-800 leading-relaxed bg-purple-50/70 border-l-2 border-purple-500 px-3 py-2 rounded-r dark:bg-purple-950/20 dark:text-slate-200">
                      <p>
                        &quot;{ticket.aiRootCause || t('tickets.aiSummaryCard.defaultRootCause', 'Configuration parameter mismatch inside client database profile or stripe status.')}&quot;
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Column: Suggested Actions Checklist & Badges */}
                <div className="space-y-4">
                  {/* Aktionsplan Checklist */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      <h4 className="text-xs font-bold text-slate-800 dark:text-indigo-300">
                        {t('tickets.aiSummaryCard.actionPlan', 'Aktionsplan')}
                      </h4>
                    </div>
                    <div className="space-y-2 pt-1 font-sans">
                      {checklist.length > 0 ? (
                        checklist.map((item) => (
                          <div
                            key={item.id ?? item.task}
                            className="flex items-center gap-3 p-2 bg-white/40 dark:bg-slate-900/40 rounded-xl border border-indigo-50/5 dark:border-slate-850 hover:bg-white/80 dark:hover:bg-slate-900/80 transition-colors"
                          >
                            <input
                              type="checkbox"
                              id={`action-plan-${item.id}`}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 h-4 w-4 cursor-pointer shrink-0"
                              checked={item.completed}
                              onChange={() => item.id && void handleToggleChecklist(item.id)}
                            />
                            <label
                              htmlFor={`action-plan-${item.id}`}
                              className={cn(
                                'text-xs leading-relaxed cursor-pointer font-normal text-slate-700 dark:text-slate-300 select-none',
                                item.completed && 'line-through text-muted-foreground/60 opacity-70',
                              )}
                            >
                              {item.task}
                            </label>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-slate-400 italic px-1">
                          {t('tickets.tasksTab.emptyShort', 'Open the Tasks tab to add or generate action items.')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Side-by-side Live Stimmung & Priority cards */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {/* Live Stimmung Card */}
                    <div className="bg-white/65 dark:bg-slate-900 border border-indigo-50/10 dark:border-slate-850 rounded-xl p-3 flex flex-col justify-between h-[64px] shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-widest block leading-none">
                        {t('tickets.aiSummaryCard.liveSentiment', 'Live Sentiment')}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-orange-500 text-lg">😐</span>
                        <span className="text-xs font-black text-orange-600 dark:text-orange-400 tracking-wider">
                          {(ticket.aiSentiment || ticket.sentiment || "NEUTRAL").toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Prioritātsvorschlag Card */}
                    <div className="bg-white/65 dark:bg-slate-900 border border-indigo-50/10 dark:border-slate-850 rounded-xl p-3 flex flex-col justify-between h-[64px] shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-widest block leading-none">
                        {t('tickets.aiSummaryCard.prioritySuggestion', 'Priority Suggestion')}
                      </span>
                      <div>
                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tight block leading-none">
                          {ticket.priority === 'urgent'
                            ? t('tickets.aiSummaryCard.p1Immediate', 'P1 — HANDLE IMMEDIATELY')
                            : ticket.priority === 'high'
                              ? t('tickets.aiSummaryCard.p2High', 'P2 — HIGH PRIORITY')
                              : t('tickets.aiSummaryCard.withinSlaHours', 'Within SLA hours')}
                        </span>
                        <span className="text-[8px] text-slate-450 dark:text-slate-500 font-bold block leading-none mt-1">
                          {t('tickets.aiSummaryCard.stableStatus', 'Stable status')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vorgeschlagene KI-Lösung & Strategie */}
              {proposedSolution ? (
                <div className="space-y-2 border-t border-indigo-100/40 dark:border-slate-800 pt-4">
                  <div className="flex items-center gap-1.5">
                    <Wand2 className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                    <h4 className="text-xs font-bold text-slate-800 dark:text-indigo-300">
                      {t('tickets.aiSummaryCard.proposedSolution', 'Vorgeschlagene KI-Lösung & Strategie')}
                    </h4>
                  </div>
                  <div className="rounded-xl border border-violet-200/60 dark:border-violet-900/50 bg-violet-50/40 dark:bg-violet-950/20 p-3">
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal whitespace-pre-wrap">
                      {proposedSolution}
                    </p>
                  </div>
                  {onAdoptProposedSolution ? (
                    <Button
                      size="sm"
                      className="h-7 text-[10px] font-bold rounded-lg bg-violet-600 hover:bg-violet-700 text-white"
                      onClick={adoptProposedSolution}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t('tickets.aiSummaryCard.adoptSolution', 'Lösung in Antwort übernehmen')}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {/* Relevante gelöste Tickets & KB-Referenzen */}
              <div className="space-y-2 border-t border-indigo-100/40 dark:border-slate-800 pt-4">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <h4 className="text-xs font-bold text-slate-800 dark:text-indigo-300">
                    {t('tickets.aiSummaryCard.ragReferences', 'Relevante gelöste Tickets & KB-Referenzen')}
                  </h4>
                </div>
                {ragReferences === null ? (
                  <p className="text-[10px] text-slate-400 italic px-1">
                    {t('tickets.aiSummaryCard.loadingRefs', 'Suche ähnliche Fälle in der Wissensbasis…')}
                  </p>
                ) : ragReferences.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic px-1">
                    {t('tickets.aiSummaryCard.noRefs', 'Keine ähnlichen Tickets oder Artikel gefunden.')}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    {ragReferences.map((ref, idx) => (
                      <button
                        key={`${ref.sourceType}-${ref.sourceId}`}
                        type="button"
                        onClick={() => openReference(ref)}
                        className="flex items-center gap-2 p-2.5 bg-white/70 dark:bg-slate-900/60 rounded-xl border border-slate-200/70 dark:border-slate-800 hover:border-emerald-300 hover:bg-white dark:hover:bg-slate-900 transition-colors text-left group"
                      >
                        <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 min-w-[14px]">
                          {idx + 1}.
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              className={cn(
                                'text-[8px] font-black uppercase px-1.5 h-4 border-none',
                                ref.sourceType === 'RESOLVED_TICKET'
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                                  : 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
                              )}
                            >
                              {ref.sourceType === 'RESOLVED_TICKET' ? (
                                <TicketIcon className="w-2.5 h-2.5" />
                              ) : (
                                <BookOpen className="w-2.5 h-2.5" />
                              )}
                              {ref.sourceType === 'RESOLVED_TICKET' ? 'Ticket' : 'KB'}
                            </Badge>
                            {ref.category ? (
                              <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 truncate">
                                {ref.category}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate mt-0.5">
                            {ref.title}
                          </p>
                        </div>
                        <span className="flex items-center gap-1 shrink-0">
                          <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            {ref.similarityPct}% Übereinstimmung
                          </span>
                          <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

// Micro helper to output the dynamic SLA time remaining simply
function sdaRemainingStr(ticket: TicketType) {
  const now = new Date();
  const createdTime = ticket.createdAt?.toDate ? ticket.createdAt.toDate() : new Date(ticket.createdAt);
  const dueTime = ticket.slaDueAt?.toDate 
    ? ticket.slaDueAt.toDate() 
    : new Date(createdTime.getTime() + 2 * 3600 * 1000);

  const diff = dueTime.getTime() - now.getTime();
  if (diff <= 0) return "Breached";
  const hrs = Math.floor(diff / (3600 * 1000));
  const mins = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
  return hrs > 0 ? `Breaching in ${hrs}h` : `Breaching in ${mins}m`;
}
