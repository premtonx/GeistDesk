import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from '../../lib/context/I18nContext';
import { 
  ChevronDown, 
  BookOpen, 
  Sparkles, 
  UserPlus, 
  UserRound, 
  PhoneCall, 
  Archive, 
  GitMerge, 
  FileText, 
  Trash, 
  UserCheck,
  Clock,
  CircleDot,
  HelpCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../ui/dropdown-menu';
import { Ticket as TicketType } from '../../types';
import { cn, safeString } from '../../lib/utils';
import { toast } from 'sonner';

interface DetailsHeaderProps {
  ticket: TicketType;
  onBack: () => void;
  activeView: string;
  onConvertToKB: () => void;
  onDraftWithAI: () => void;
  onAssign: (agentName: string) => void;
  onStatusChange: (status: any) => void;
  onTakeOwnership: () => void;
  isKbDrafting: boolean;
  isAiDrafting: boolean;
  isAiReady: boolean;
  onReplyClick: () => void;
  onInternalNoteClick: () => void;
  onSeekHelp?: () => void;
  /** Opens mark-as-spam confirmation (wired by ticket detail host). */
  onMarkAsSpam?: () => void;
  isSpam?: boolean;
}

export function DetailsHeader({
  ticket,
  onBack,
  activeView,
  onConvertToKB,
  onDraftWithAI,
  onAssign,
  onStatusChange,
  onTakeOwnership,
  isKbDrafting,
  isAiDrafting,
  isAiReady,
  onReplyClick,
  onInternalNoteClick,
  onSeekHelp,
  onMarkAsSpam,
  isSpam,
}: DetailsHeaderProps) {
  const { t } = useTranslation();
  const [timeLeftStr, setTimeLeftStr] = useState(() => t('tickets.detail.slaDuePending', 'Due in —'));
  const [slaPercent, setSlaPercent] = useState(65);
  const [slaStatus, setSlaStatus] = useState<'healthy' | 'warning' | 'breached'>('warning');

  useEffect(() => {
    const calculateSLA = () => {
      const now = new Date();
      const createdTime = ticket.createdAt?.toDate ? ticket.createdAt.toDate() : new Date(ticket.createdAt);
      const dueTime = ticket.slaDueAt?.toDate 
        ? ticket.slaDueAt.toDate() 
        : new Date(createdTime.getTime() + 4 * 3600 * 1000); // 4h fallback

      const totalDuration = dueTime.getTime() - createdTime.getTime();
      const remaining = dueTime.getTime() - now.getTime();
      
      if (remaining <= 0) {
        setTimeLeftStr(t('tickets.slaBreached', 'SLA BREACHED').toUpperCase());
        setSlaPercent(100);
        setSlaStatus('breached');
        return;
      }

      const hours = Math.floor(remaining / (3600 * 1000));
      const mins = Math.floor((remaining % (3600 * 1000)) / (60 * 1000));
      
      const dueTemplate = t('tickets.detail.slaDueIn', 'Due in {{hours}}h {{mins}}m');
      const dueStr = dueTemplate
        .replace('{{hours}}', String(hours))
        .replace('{{mins}}', String(mins));
      setTimeLeftStr(dueStr);
      const elapsedPercent = Math.max(0, Math.min(100, (remaining / totalDuration) * 100));
      setSlaPercent(100 - elapsedPercent);

      if (remaining < 3600 * 1000) {
        setSlaStatus('breached'); // Less than 1 hr is deep alert
      } else if (remaining < 2 * 3600 * 1000) {
        setSlaStatus('warning');
      } else {
        setSlaStatus('healthy');
      }
    };

    calculateSLA();
    const interval = setInterval(calculateSLA, 60000);
    return () => clearInterval(interval);
  }, [ticket, t]);

  return (
    <div id="ticket-header-command-center" className="sticky top-0 z-40 bg-card border-b border-border shadow-sm">
      {/* Top Breadcrumb Nav Line */}
      <div className="px-6 py-2.5 bg-muted/20 border-b border-border flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs font-semibold hover:bg-muted gap-1 px-2 rounded-lg text-slate-600 dark:text-slate-300" 
            onClick={onBack}
          >
            <ChevronDown className="w-3.5 h-3.5 rotate-90" />
            <span>{t('tickets.detail.backToList', 'Back to tickets')}</span>
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono tabular-nums text-[10.5px]">
            {t('tickets.detail.created', 'Created:')}
            {ticket.createdAt?.toDate ? ticket.createdAt.toDate().toLocaleDateString() : t('tickets.customerTab.today', 'Today')}
          </span>
        </div>
      </div>

      {/* Main Command Center Header Block: Subjects and ribbon layout */}
      <div className="px-6 py-4 flex flex-col gap-3 w-full min-w-0">
        {/* Left Side: Ticket Id, Subject & Status/SLA/Priority Badges */}
        <div className="min-w-0 w-full space-y-2">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <span className="font-mono tabular-nums text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm shrink-0">
              #{ticket.id.slice(-5).toUpperCase()}
            </span>
            <h1 className="min-w-0 max-w-full flex-1 text-xl font-bold tracking-tight text-foreground break-words line-clamp-2">
              {ticket.subject}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {/* SLA Status Badge */}
            <span className={cn(
              "inline-flex items-center gap-1 text-[10.5px] font-semibold font-mono tabular-nums tracking-tight h-5.5 px-3 rounded-md shadow-sm border",
              slaStatus === 'breached' 
                ? "bg-rose-50 text-rose-700 border-rose-200" 
                : "bg-amber-50 text-amber-700 border-amber-200"
            )}>
              <Clock className="w-3 h-3 animate-pulse" />
              <span>
                {slaStatus === 'breached' 
                  ? t('tickets.detail.slaViolated', 'SLA Violated') 
                  : t('tickets.detail.slaDue', 'SLA Due')}
              </span>
            </span>

            {/* Company Badge */}
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10.5px] font-bold h-5.5 px-3 rounded-md flex items-center justify-center">
              {safeString(ticket.company, t('tickets.detail.defaultCompany', 'Enterprise Corp'))}
            </span>

            {/* Priority Badge */}
            <span className={cn(
              "uppercase text-[10.5px] font-black h-5.5 px-3 rounded-md border flex items-center justify-center gap-1",
              ticket.priority === 'urgent' || ticket.priority === 'high'
                ? "bg-rose-50 text-rose-700 border-rose-250"
                : "bg-blue-50 text-blue-700 border-blue-200"
            )}>
              {ticket.priority === 'urgent' 
                ? t('tickets.detail.priorityCritical', 'P1 — Critical') 
                : ticket.priority === 'high' 
                ? t('tickets.detail.priorityHigh', 'High Priority') 
                : ticket.priority === 'medium' 
                ? t('tickets.detail.priorityMedium', 'Medium') 
                : t('tickets.detail.priorityLow', 'Low')}
            </span>
          </div>
        </div>

        {/* Right Side: Command ribbon bar next to the ticket title */}
        <div className="flex flex-wrap items-center gap-2 self-start">
          {onMarkAsSpam && !isSpam ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl h-9.5 text-xs font-bold border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 flex items-center gap-1.5 shadow-sm"
              onClick={onMarkAsSpam}
            >
              <span aria-hidden>🚫</span>
              <span>{t('tickets.spam.button', 'Als Spam markieren')}</span>
            </Button>
          ) : null}

          {/* Answer Action Button */}
          <Button 
            size="sm" 
            variant="outline" 
            className="rounded-xl h-9.5 text-xs font-bold border-border bg-white text-slate-800 hover:bg-muted flex items-center gap-1.5 shadow-sm"
            onClick={onReplyClick}
          >
            <Clock className="w-4 h-4 text-slate-500" />
            <span>{t('tickets.replyBtn', 'Reply')}</span>
          </Button>

          {/* Internal Note Action Button */}
          <Button 
            size="sm" 
            variant="outline" 
            className="rounded-xl h-9.5 text-xs font-bold border-border bg-white text-slate-800 hover:bg-muted flex items-center gap-1.5 shadow-sm"
            onClick={onInternalNoteClick}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>{t('tickets.noteBtn', 'Internal Note')}</span>
          </Button>

          {/* More Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="outline" size="sm" className="rounded-xl h-9.5 text-xs font-bold border-border bg-white text-slate-800 hover:bg-muted group gap-1 shadow-sm">
                <span>{t('tickets.detail.more', 'More')}</span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-y-0.5 transition-transform" />
              </Button>
            } />
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-2 shadow-lg border border-border bg-popover text-popover-foreground">
              <div className="px-2 py-1 text-[9px] font-black text-muted-foreground uppercase tracking-widest border-b mb-1">
                {t('tickets.detail.moreActions', 'More Actions')}
              </div>

              {/* Status change submenu */}
              <DropdownMenuItem className="rounded-lg text-xs font-semibold py-2 cursor-pointer">
                <span className="flex-1" onClick={() => onStatusChange(ticket.status === 'open' ? 'pending' : 'open')}>
                  {t('tickets.detail.toggleStatus', 'Toggle Status')}
                </span>
              </DropdownMenuItem>

              {/* Assignee item */}
              <DropdownMenuItem className="rounded-lg text-xs font-semibold py-2 cursor-pointer" onClick={onTakeOwnership}>
                <span>{t('tickets.takeOwnership', 'Take Ownership')}</span>
              </DropdownMenuItem>

              {/* Convert to KB item */}
              <DropdownMenuItem 
                className={cn("rounded-lg text-xs font-semibold py-2 cursor-pointer", isKbDrafting && "opacity-50")}
                onClick={onConvertToKB}
                disabled={isKbDrafting || !isAiReady}
              >
                <BookOpen className="w-3.5 h-3.5 mr-2 text-[#1A73E8]" />
                {isKbDrafting ? t('tickets.detail.extracting', 'Extracting...') : t('tickets.detail.convertToKb', 'Convert to KB')}
              </DropdownMenuItem>

              {/* Seek Help item */}
              {onSeekHelp && (
                <DropdownMenuItem className="rounded-lg text-xs font-semibold py-2 cursor-pointer" onClick={onSeekHelp}>
                  <HelpCircle className="w-3.5 h-3.5 mr-2 text-rose-500" />
                  {ticket.isHelpRequested 
                    ? t('tickets.detail.cancelHelpRequest', 'Cancel Help Request')
                    : t('tickets.detail.seekSlaHelp', 'Seek SLA Help')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* AI Copilot Solid Premium Button */}
          <Button 
            className="bg-[#1A73E8] hover:bg-[#1557B0] text-white rounded-xl h-9.5 font-bold text-xs shadow-md gap-1.5 px-4"
            onClick={onDraftWithAI}
            disabled={isAiDrafting || !isAiReady}
          >
            <Sparkles className="w-4 h-4 animate-pulse text-indigo-200" />
            <span>{t('tickets.aiCopilot', 'AI Copilot')}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
