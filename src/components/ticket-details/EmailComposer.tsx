import { useEffect, useMemo, useState } from 'react';
import { 
  Sparkles, 
  Send, 
  Trash2, 
  Paperclip, 
  Languages, 
  ChevronDown, 
  FileText, 
  BookOpen, 
  ShieldAlert, 
  Smile, 
  HelpCircle,
  Mail,
  ListRestart,
  Scale,
  Zap,
  ChevronUp,
  CheckCircle2
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { RichTextEditor } from '../RichTextEditor';
import { LegalValidationResult } from '../../services/legalService';
import { Ticket as TicketType } from '../../types';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { useTranslation } from '../../lib/context/I18nContext';
import { ticketService } from '../../services/ticketService';
import { getModuleConfig } from '../../lib/module-config';
import { formatReplyRecipientLabel, resolveComposerFromAddress } from '../../lib/ticket-reply-address';

export interface AiComposerMeta {
  confidenceScore: number | null;
  executionStatus: 'auto_dispatched' | 'high_confidence' | 'nuanced' | 'manual';
  critiqueLog: {
    iterations: Array<{
      iteration: number;
      draft: string;
      critique: {
        factual_accuracy: number;
        policy_adherence: number;
        confidence_score: number;
        actionable_critique: string;
      };
      criticError?: boolean;
      drafterModel?: string;
      criticModel?: string;
    }>;
    finalConfidence: number | null;
    exitReason: 'threshold_met' | 'max_iterations' | 'critic_failed' | 'critique_disabled';
  } | null;
}

interface EmailComposerProps {
  ticket: TicketType;
  value: string;
  onChange: (val: string) => void;
  isDrafting: boolean;
  ghostDraft: string;
  onAcceptGhostDraft: () => void;
  onSend: () => void;
  onDiscard: () => void;
  isAiReady: boolean;
  isAiDrafting: boolean;
  onDraftWithAI: () => void;
  onImproveWriting: () => void;
  onTranslate: () => void;
  onSummarize: () => void;
  legalViolation: LegalValidationResult | null;
  isValidatingLegal: boolean;
  aiDraftMeta?: AiComposerMeta | null;
  autoDispatchThreshold?: number;
  isAutoDispatched?: boolean;
}

export function EmailComposer({
  ticket,
  value,
  onChange,
  isDrafting,
  ghostDraft,
  onAcceptGhostDraft,
  onSend,
  onDiscard,
  isAiReady,
  isAiDrafting,
  onDraftWithAI,
  onImproveWriting,
  onTranslate,
  onSummarize,
  legalViolation,
  isValidatingLegal,
  aiDraftMeta = null,
  autoDispatchThreshold = 95,
  isAutoDispatched = false,
}: EmailComposerProps) {
  const { t } = useTranslation();
  const [suggestionApplied, setSuggestionApplied] = useState(false);
  const [critiqueOpen, setCritiqueOpen] = useState(false);
  const [fromAddress, setFromAddress] = useState(() =>
    resolveComposerFromAddress({
      ticketMailbox: ticket.mailbox,
      moduleSupportEmail: getModuleConfig().email?.supportEmail,
    }),
  );
  const suggestionText = "Hi there, I have investigated this issue and found similar cases where we resolved... Let me walk you through the troubleshooting.";

  const replyToLabel = useMemo(() => formatReplyRecipientLabel(ticket), [ticket]);

  useEffect(() => {
    let alive = true;
    const mailbox = ticket.mailbox;
    ticketService
      .getComposerAddresses(ticket.id)
      .then((addresses) => {
        if (!alive) return;
        if (addresses.from) {
          setFromAddress(addresses.from);
          return;
        }
        setFromAddress(
          resolveComposerFromAddress({
            ticketMailbox: mailbox,
            moduleSupportEmail: getModuleConfig().email?.supportEmail,
          }),
        );
      })
      .catch(() => {
        if (!alive) return;
        setFromAddress(
          resolveComposerFromAddress({
            ticketMailbox: mailbox,
            moduleSupportEmail: getModuleConfig().email?.supportEmail,
          }),
        );
      });
    return () => {
      alive = false;
    };
  }, [ticket.id, ticket.mailbox]);

  const applySuggestion = () => {
    onChange(value ? `${value}<p>${suggestionText}</p>` : `<p>${suggestionText}</p>`);
    setSuggestionApplied(true);
    toast.success(t('tickets.emailComposer.suggestionApplied', 'AI strategic opening applied to composer.'));
  };

  const isHighConfidence = (aiDraftMeta?.confidenceScore ?? 0) >= autoDispatchThreshold;
  const isNuanced = aiDraftMeta !== null && !isHighConfidence && !isAutoDispatched;

  return (
    <div id="email-reply-composer" className={cn(
      "bg-card border rounded-2xl shadow-md overflow-hidden space-y-3 mt-4 transition-all hover:shadow-lg",
      aiDraftMeta && !isAutoDispatched ? "border-emerald-400 ring-1 ring-emerald-200/60" : "border-border",
      isAutoDispatched ? "border-blue-400 ring-1 ring-blue-200/60" : "",
    )}>
      {/* Auto-dispatched indicator */}
      {isAutoDispatched && (
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-3 py-2 text-xs font-semibold">
            <Zap className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{t('tickets.emailComposer.autoDispatched', 'This AI draft was automatically dispatched. Review before sending manually if needed.')}</span>
          </div>
        </div>
      )}
      {/* Email-style Header rows */}
      <div className="bg-muted/15 p-4 border-b border-border space-y-2.5 text-xs text-muted-foreground/80">
        <div className="flex items-center gap-2">
          <span className="w-12 font-bold text-foreground">{t('tickets.emailComposer.from', 'From:')}</span>
          <span className="font-mono bg-muted/60 px-2 py-0.5 rounded text-foreground border border-border/40">
            {fromAddress || t('tickets.emailComposer.fromUnset', 'Kein Absender konfiguriert')}
          </span>
          <span className="text-[10px] text-muted-foreground">{t('tickets.emailComposer.guardrails', '(Corporate guardrails enabled)')}</span>
        </div>
        
        <Separator className="bg-border/40" />
        
        <div className="flex items-center gap-2">
          <span className="w-12 font-bold text-foreground">{t('tickets.emailComposer.to', 'To:')}</span>
          <span className="font-mono bg-muted/60 px-2 py-0.5 rounded text-foreground border border-border/40">
            {replyToLabel || t('tickets.emailComposer.toUnset', 'Kein Empfänger')}
          </span>
        </div>

        <Separator className="bg-border/40" />

        <div className="flex items-center gap-2">
          <span className="w-12 font-bold text-foreground">{t('tickets.emailComposer.subject', 'Subject:')}</span>
          <span className="font-semibold text-foreground">
            Re: {ticket.subject} [Ref: #{ticket.id.slice(-5).toUpperCase()}]
          </span>
        </div>
      </div>

      {/* Suggestion Bubble above Typing Field */}
      {!suggestionApplied && (
        <div className="px-4 pt-1">
          <div className="bg-indigo-50/70 border border-indigo-100 p-2.5 rounded-xl flex items-center justify-between text-xs gap-3">
            <div className="flex items-center gap-2 text-indigo-900 font-medium">
              <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>
                <span className="font-black text-indigo-600">{t('tickets.emailComposer.aiSuggestedStrategy', 'AI suggested strategy:')}</span> &quot;{t('tickets.emailComposer.suggestionPreview', 'Hi there, I have investigated this issue...')}&quot;
              </span>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              className="bg-white hover:bg-indigo-100/50 text-indigo-600 border-indigo-200 h-7 text-[10px] font-bold rounded-lg shrink-0" 
              onClick={applySuggestion}
            >
              {t('tickets.emailComposer.applyOpening', 'Apply opening')}
            </Button>
          </div>
        </div>
      )}

      {/* Primary HTML Rich Editor */}
      <div className="px-4">
        <RichTextEditor 
          value={value}
          onChange={onChange}
          placeholder={t('tickets.emailComposer.placeholder', 'Type your professional response here... To activate AI drafting assistance, use the AI actions toolbar below.')}
        />
      </div>

      {/* AI Reasoning & Critique Trace accordion (Nuanced drafts) */}
      {isNuanced && aiDraftMeta?.critiqueLog && (
        <div className="mx-4 rounded-xl border border-amber-200/70 bg-amber-50/40 overflow-hidden">
          <button
            type="button"
            onClick={() => setCritiqueOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-left"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="text-[11px] font-black text-amber-800 uppercase tracking-wide">
                {t('tickets.emailComposer.critiqueTraceTitle', 'AI Reasoning & Critique Trace')}
              </span>
              <Badge variant="outline" className="text-[9px] font-bold text-amber-700 border-amber-200 bg-white h-4">
                {aiDraftMeta.confidenceScore === null
                  ? 'unverified'
                  : `${aiDraftMeta.confidenceScore}%`}
              </Badge>
            </div>
            {critiqueOpen ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-amber-600" />}
          </button>
          {critiqueOpen && (
            <div className="px-3 pb-3 space-y-2 text-[11px] text-slate-700">
              {aiDraftMeta.critiqueLog.iterations.map((it, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 bg-white/80 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-800">
                      {t('tickets.emailComposer.critiquePass', 'Critique Pass')} #{idx + 1}
                      {it.criticError ? (
                        <span className="ml-1.5 text-[9px] font-bold text-rose-600 uppercase">critic failed</span>
                      ) : null}
                    </span>
                    <span className="font-mono text-slate-500 text-[10px]">
                      {it.drafterModel} → {it.criticModel}
                    </span>
                  </div>
                  {!it.criticError && (
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="text-[9px] h-4 border-slate-200 bg-slate-50 text-slate-600">
                        Factual {it.critique.factual_accuracy}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] h-4 border-slate-200 bg-slate-50 text-slate-600">
                        Policy {it.critique.policy_adherence}
                      </Badge>
                      <Badge
                        className={cn(
                          'text-[9px] h-4 border',
                          it.critique.confidence_score >= 95
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700',
                        )}
                      >
                        Confidence {it.critique.confidence_score}
                      </Badge>
                    </div>
                  )}
                  {it.critique.actionable_critique && (
                    <p className="text-slate-600 leading-snug">
                      <span className="font-bold text-slate-800">{t('tickets.emailComposer.criticNotes', 'Critic notes:')}</span>{' '}
                      {it.critique.actionable_critique}
                    </p>
                  )}
                  {idx === aiDraftMeta.critiqueLog!.iterations.length - 1 && (
                    <p className="text-slate-500 italic">
                      {t('tickets.emailComposer.finalRevision', 'Final accepted revision:')}{' '}
                      <span className="not-italic">{it.draft}</span>
                    </p>
                  )}
                </div>
              ))}
              <p className="text-slate-500 font-medium">
                {aiDraftMeta.critiqueLog.exitReason === 'critic_failed'
                  ? t('tickets.emailComposer.criticFailedNote', 'The critic model timed out — this draft was not independently verified.')
                  : aiDraftMeta.critiqueLog.exitReason === 'max_iterations'
                    ? t('tickets.emailComposer.maxIterationsNote', 'Reached the maximum self-correction iterations. Draft still needs human review.')
                    : t('tickets.emailComposer.thresholdMetNote', 'Loop exited after the confidence threshold was met.')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Legal Guardrails Warnings Box */}
      {legalViolation && (
        <div className="mx-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 animate-bounce-short">
          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h5 className="text-xs font-black text-red-800 uppercase tracking-tight">{t('tickets.emailComposer.legalWarningTitle', 'Safeguard violation warning')}</h5>
            <p className="text-[11px] text-red-700 leading-normal">
              {legalViolation.violationDetail || t('tickets.emailComposer.legalWarningDefault', 'The response draft contains unauthorized language or unverified contractual commitments.')}
            </p>
          </div>
        </div>
      )}

      {/* Toolbar actions & Primary Submit buttons */}
      <div className="px-4 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        {/* Helper Assist Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 rounded-lg text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 gap-1 border border-indigo-100/30 bg-indigo-50/20"
            onClick={onDraftWithAI}
            disabled={!isAiReady || isAiDrafting}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('tickets.emailComposer.aiAssistDraft', 'AI assist draft')}</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 rounded-lg text-[11px] font-bold text-teal-600 hover:bg-teal-50 gap-1 border border-teal-100/30"
            onClick={onImproveWriting}
            disabled={!isAiReady}
          >
            <Smile className="w-3.5 h-3.5" />
            <span>{t('tickets.emailComposer.tonePolish', 'Tone polish')}</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 rounded-lg text-[11px] font-bold text-violet-600 hover:bg-violet-50 gap-1 border border-violet-100/30"
            onClick={onTranslate}
            disabled={!isAiReady}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{t('tickets.emailComposer.translate', 'Translate')}</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 rounded-lg text-[11px] font-bold text-muted-foreground hover:bg-muted gap-1 border"
            onClick={onSummarize}
            disabled={!isAiReady}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t('tickets.emailComposer.threadDigest', 'Thread digest')}</span>
          </Button>
        </div>

        {/* Send / Discard Operations */}
        <div className="flex items-center gap-2.5 ml-auto">
          {isHighConfidence && !isAutoDispatched && (
            <Button
              className="h-9 font-bold text-xs rounded-xl shadow-md min-w-[110px] bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              onClick={onSend}
              disabled={isValidatingLegal}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{t('tickets.emailComposer.approveAndSend', '⚡ Approve & Send')}</span>
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-[11px] font-bold text-muted-foreground hover:text-red-500 rounded-lg h-9" 
            onClick={onDiscard}
          >
            {t('tickets.emailComposer.discard', 'Discard')}
          </Button>
          <Button 
            className="h-9 font-bold text-xs rounded-xl shadow-md min-w-[90px] bg-primary hover:bg-primary/95 text-primary-foreground gap-1.5"
            onClick={onSend}
            disabled={isValidatingLegal}
          >
            {isValidatingLegal ? (
              <span>{t('tickets.emailComposer.auditing', 'Auditing...')}</span>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>{t('tickets.emailComposer.sendReply', 'Send reply')}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
