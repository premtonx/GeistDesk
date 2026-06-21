import React, { useState } from 'react';
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
  Scale
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
  isValidatingLegal
}: EmailComposerProps) {
  const { t } = useTranslation();
  const [suggestionApplied, setSuggestionApplied] = useState(false);
  const suggestionText = "Hi there, I have investigated this issue and found similar cases where we resolved... Let me walk you through the troubleshooting.";

  const applySuggestion = () => {
    onChange(value ? `${value}<p>${suggestionText}</p>` : `<p>${suggestionText}</p>`);
    setSuggestionApplied(true);
    toast.success(t('tickets.emailComposer.suggestionApplied', 'AI strategic opening applied to composer.'));
  };

  return (
    <div id="email-reply-composer" className="bg-card border border-border rounded-2xl shadow-md overflow-hidden space-y-3 mt-4 transition-all hover:shadow-lg">
      {/* Email-style Header rows */}
      <div className="bg-muted/15 p-4 border-b border-border space-y-2.5 text-xs text-muted-foreground/80">
        <div className="flex items-center gap-2">
          <span className="w-12 font-bold text-foreground">{t('tickets.emailComposer.from', 'From:')}</span>
          <span className="font-mono bg-muted/60 px-2 py-0.5 rounded text-foreground border border-border/40">
            support@geistdesk.support
          </span>
          <span className="text-[10px] text-muted-foreground">{t('tickets.emailComposer.guardrails', '(Corporate guardrails enabled)')}</span>
        </div>
        
        <Separator className="bg-border/40" />
        
        <div className="flex items-center gap-2">
          <span className="w-12 font-bold text-foreground">{t('tickets.emailComposer.to', 'To:')}</span>
          <span className="font-mono bg-muted/60 px-2 py-0.5 rounded text-foreground border border-border/40">
            {ticket.customerName} &lt;{ticket.customerId}@client.com&gt;
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
