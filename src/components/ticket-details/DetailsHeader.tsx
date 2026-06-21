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
import { cn } from '../../lib/utils';
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
  onSeekHelp
}: DetailsHeaderProps) {
  const { t, language } = useTranslation();
  // SLA Live Countdown calculation
  const [timeLeftStr, setTimeLeftStr] = useState(language === 'de' ? 'Fällig in--' : 'Due in--');
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
      
      const dueStr = language === 'de' 
        ? `Fällig in ${hours} Std. ${mins} Min.` 
        : `Due in ${hours}h ${mins}m`;
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
  }, [ticket]);

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
            <span>
              {language === 'de' ? 'Zurück zu Tickets' : 'Back to tickets'}
            </span>
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10.5px]">
            {language === 'de' ? 'Erstellt: ' : 'Created: '}
            {ticket.createdAt?.toDate ? ticket.createdAt.toDate().toLocaleDateString() : 'Today'}
          </span>
        </div>
      </div>

      {/* Main Command Center Header Block: Subjects and ribbon layout */}
      <div className="px-6 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Left Side: Ticket Id, Subject & Status/SLA/Priority Badges */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm shrink-0">
              #{ticket.id.slice(-5).toUpperCase()}
            </span>
            <h1 className="text-xl font-bold tracking-tight text-foreground truncate max-w-xl">
              {ticket.subject}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {/* SLA Status Badge */}
            <span className={cn(
              "inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-tight h-5.5 px-3 rounded-md shadow-sm border",
              slaStatus === 'breached' 
                ? "bg-rose-50 text-rose-700 border-rose-200" 
                : "bg-amber-50 text-amber-700 border-amber-200"
            )}>
              <Clock className="w-3 h-3 animate-pulse" />
              <span>
                {slaStatus === 'breached' 
                  ? (language === 'de' ? 'SLA Verletzung' : 'SLA Breaching') 
                  : (language === 'de' ? `SLA Fällig` : `SLA Breaching`)}
              </span>
            </span>

            {/* Company Badge */}
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10.5px] font-bold h-5.5 px-3 rounded-md flex items-center justify-center">
              {ticket.company || 'Enterprise Corp'}
            </span>

            {/* Priority Badge */}
            <span className={cn(
              "uppercase text-[10.5px] font-black h-5.5 px-3 rounded-md border flex items-center justify-center gap-1",
              ticket.priority === 'urgent' || ticket.priority === 'high'
                ? "bg-rose-50 text-rose-700 border-rose-250"
                : "bg-blue-50 text-blue-700 border-blue-200"
            )}>
              {ticket.priority === 'urgent' 
                ? 'P1 - Critical' 
                : ticket.priority === 'high' 
                ? 'High Priority' 
                : ticket.priority === 'medium' 
                ? 'Medium' 
                : 'Low'}
            </span>
          </div>
        </div>

        {/* Right Side: Command ribbon bar next to the ticket title */}
        <div className="flex items-center gap-2 shrink-0 self-start xl:self-center">
          {/* Answer Action Button */}
          <Button 
            size="sm" 
            variant="outline" 
            className="rounded-xl h-9.5 text-xs font-bold border-border bg-white text-slate-800 hover:bg-muted flex items-center gap-1.5 shadow-sm"
            onClick={onReplyClick}
          >
            <Clock className="w-4 h-4 text-slate-500" />
            <span>{language === 'de' ? 'Antworten' : 'Answer'}</span>
          </Button>

          {/* Internal Note Action Button */}
          <Button 
            size="sm" 
            variant="outline" 
            className="rounded-xl h-9.5 text-xs font-bold border-border bg-white text-slate-800 hover:bg-muted flex items-center gap-1.5 shadow-sm"
            onClick={onInternalNoteClick}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>{language === 'de' ? 'Interne Notiz' : 'Internal Note'}</span>
          </Button>

          {/* More Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="outline" size="sm" className="rounded-xl h-9.5 text-xs font-bold border-border bg-white text-slate-800 hover:bg-muted group gap-1 shadow-sm">
                <span>{language === 'de' ? 'Mehr' : 'More'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-y-0.5 transition-transform" />
              </Button>
            } />
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-2 shadow-lg border border-border bg-popover text-popover-foreground">
              <div className="px-2 py-1 text-[9px] font-black text-muted-foreground uppercase tracking-widest border-b mb-1">
                {language === 'de' ? 'Zusätzliche Aktionen' : 'More Actions'}
              </div>

              {/* Status change submenu */}
              <DropdownMenuItem className="rounded-lg text-xs font-semibold py-2 cursor-pointer">
                <span className="flex-1" onClick={() => onStatusChange(ticket.status === 'open' ? 'pending' : 'open')}>
                  {language === 'de' ? 'Status umschalten' : 'Toggle Status'}
                </span>
              </DropdownMenuItem>

              {/* Assignee item */}
              <DropdownMenuItem className="rounded-lg text-xs font-semibold py-2 cursor-pointer" onClick={onTakeOwnership}>
                <span>{language === 'de' ? 'Eigentum übernehmen' : 'Take Ownership'}</span>
              </DropdownMenuItem>

              {/* Convert to KB item */}
              <DropdownMenuItem 
                className={cn("rounded-lg text-xs font-semibold py-2 cursor-pointer", isKbDrafting && "opacity-50")}
                onClick={onConvertToKB}
                disabled={isKbDrafting || !isAiReady}
              >
                <BookOpen className="w-3.5 h-3.5 mr-2 text-[#1A73E8]" />
                {isKbDrafting ? 'Extracting...' : (language === 'de' ? 'In KB-Eintrag umwandeln' : 'Convert to KB')}
              </DropdownMenuItem>

              {/* Seek Help item */}
              {onSeekHelp && (
                <DropdownMenuItem className="rounded-lg text-xs font-semibold py-2 cursor-pointer" onClick={onSeekHelp}>
                  <HelpCircle className="w-3.5 h-3.5 mr-2 text-rose-500" />
                  {ticket.isHelpRequested 
                    ? (language === 'de' ? 'Hilfeanforderung abbrechen' : 'Cancel Help Request')
                    : (language === 'de' ? 'SLA-Team hinzuziehen' : 'Seek SLA Help')}
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
            <span>AI Copilot</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
