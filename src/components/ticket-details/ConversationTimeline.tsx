import React, { useState } from 'react';
import { useTranslation } from '../../lib/context/I18nContext';
import { 
  User, 
  MessageSquare, 
  Sparkles, 
  ShieldCheck, 
  Scale, 
  AlertCircle, 
  CheckCircle, 
  UserRound, 
  Clock, 
  Mail,
  Lock,
  ArrowDownToLine,
  ChevronDown,
  Copy
} from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Ticket as TicketType, Message, AgentComment } from '../../types';
import { redactPII } from '../../lib/ai/pii-shield';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

interface ConversationTimelineProps {
  ticket: TicketType;
  messages: Message[];
  agentComments: AgentComment[];
  onReplyClick: () => void;
  onQuoteClick: (text: string) => void;
  onInternalNoteAction: () => void;
  onAddAgentComment: (text: string) => void;
  isTranslating: boolean;
  translatedTicket: { subject: string; description: string } | null;
}

function makeLinksClickable(text: string): string {
  if (!text) return "";
  // regex for standard http/https links
  const urlPattern = /(\b(https?):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  let result = text.replace(urlPattern, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline font-semibold">$1</a>');

  // regex to match www. sites (that aren't already prefixed with http/https)
  const wwwPattern = /(^|[^\/])(www\.[A-Za-z0-9_-]+\.[A-Za-z0-9_.-]+(?:\/[^\s]*)?)/g;
  result = result.replace(wwwPattern, '$1<a href="https://$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline font-semibold">$2</a>');

  return result;
}

export function ConversationTimeline({
  ticket,
  messages,
  agentComments,
  onReplyClick,
  onQuoteClick,
  onInternalNoteAction,
  onAddAgentComment,
  isTranslating,
  translatedTicket
}: ConversationTimelineProps) {
  const { t, language } = useTranslation();
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // We compile all chronological timeline items, beginning with the opening post.
  const timelineItems = React.useMemo(() => {
    // 1. Initial ticket description post as the first Customer post
    const items: Array<{
      id: string;
      senderName: string;
      senderType: 'customer' | 'bot' | 'agent' | 'ai';
      createdAt: any;
      content: string;
      channel: string;
    }> = [
      {
        id: 'opening-post',
        senderName: ticket.customerName || 'Customer',
        senderType: 'customer',
        createdAt: ticket.createdAt,
        content: translatedTicket?.description || ticket.description,
        channel: 'via Email'
      }
    ];

    // 2. Append all historical thread messages
    messages.forEach(msg => {
      // Determine senderType classification based on name or system classifications
      let isBot = msg.senderType === 'ai';
      if (msg.senderName && (msg.senderName.toLowerCase().includes('geist') || msg.senderName.toLowerCase().includes('shield') || msg.senderName.toLowerCase().includes('dropzone') || msg.senderName.toLowerCase().includes('bot'))) {
        isBot = true;
      }

      items.push({
        id: msg.id,
        senderName: msg.senderName || (msg.senderType === 'customer' ? 'Customer' : 'Agent'),
        senderType: isBot ? 'bot' : (msg.senderType === 'customer' ? 'customer' : 'agent'),
        createdAt: msg.createdAt,
        content: msg.content,
        channel: isBot ? 'via System' : (msg.senderType === 'customer' ? 'via Email' : 'via Web')
      });
    });

    return items;
  }, [ticket, messages, translatedTicket]);

  return (
    <div id="conversation-timeline-redesign" className="space-y-6">
      {/* Date Header Indicator */}
      <div className="flex items-center gap-3 my-4">
        <span className="text-xs font-black text-slate-400 dark:text-slate-500 tracking-wider">TODAY</span>
        <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
      </div>

      {/* Modern Connected chronological timeline list */}
      <div className="relative pl-8 border-l border-slate-200 dark:border-slate-800 ml-4 space-y-7">
        {timelineItems.map((item, idx) => {
          const isCustomer = item.senderType === 'customer';
          const isBot = item.senderType === 'bot';
          const isAgent = item.senderType === 'agent';

          // Render distinct left circle icons following the exact mockup patterns
          let timelineIcon = <Mail className="w-4 h-4 text-blue-600" />;
          let iconBg = "bg-blue-50 border-blue-100";
          
          if (isBot) {
            timelineIcon = <ShieldCheck className="w-4 h-4 text-emerald-600" />;
            iconBg = "bg-emerald-50 border-emerald-100";
          } else if (isAgent) {
            timelineIcon = <UserRound className="w-4 h-4 text-blue-600" />;
            iconBg = "bg-blue-50 border-blue-100";
          }

          // Format timestamp nicely
          let timeDisplay = "10:24 AM";
          if (item.createdAt) {
            const dateObj = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
            timeDisplay = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }

          // Initials calculation for avatar
          const initials = item.senderName
            ? item.senderName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
            : isCustomer ? 'C' : isBot ? 'GE' : 'A';

          return (
            <div 
              key={item.id} 
              className="relative group"
              onMouseEnter={() => setHoveredMessageId(item.id)}
              onMouseLeave={() => setHoveredMessageId(null)}
            >
              {/* Left absolute timeline bullet icon */}
              <div className={cn(
                "absolute -left-[42px] top-4 w-7 h-7 rounded-full border-2 border-white dark:border-background flex items-center justify-center shadow-sm z-10",
                iconBg
              )}>
                {timelineIcon}
              </div>

              {/* Message Card frame */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700 transition-all duration-200 flex gap-4">
                {/* Internal Avatar inside card */}
                <Avatar className={cn(
                  "w-9 h-9 border shadow-sm shrink-0 mt-0.5",
                  isBot ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-blue-50 border-blue-100 text-blue-800"
                )}>
                  <AvatarFallback className="font-extrabold text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                {/* Core contents column */}
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Card Header row: Sender name, role, timestamp, channel */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-foreground">
                        {item.senderName}
                      </span>
                      {/* Role Badge following mockup */}
                      <Badge className={cn(
                        "text-[9px] font-black uppercase px-2 py-0.5 rounded-full border-none pointer-events-none tracking-wider",
                        isCustomer ? "bg-blue-100 text-blue-850" : isBot ? "bg-emerald-100 text-emerald-850" : "bg-indigo-150 text-indigo-850"
                      )}>
                        {item.senderType === 'bot' ? 'Bot' : item.senderType}
                      </Badge>
                      <span className="text-[11px] text-slate-400 font-semibold font-mono">
                        {timeDisplay}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        — {item.channel}
                      </span>
                    </div>
                  </div>

                  {/* Message body text */}
                  <div className="text-[13px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words font-sans">
                    {isTranslating && item.id === 'opening-post' ? (
                      <p className="italic text-muted-foreground animate-pulse">Translating message content...</p>
                    ) : (
                      <div className="select-text cursor-text" dangerouslySetInnerHTML={{ __html: makeLinksClickable(redactPII(item.content)) }} />
                    )}
                  </div>

                  {/* MIT SafeLink badge check for Bot events */}
                  {isBot && (
                    <div className="mt-2.5">
                      <span className="bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6] font-bold px-2 py-1 rounded-full text-[9px] inline-flex items-center gap-1.5 shadow-sm">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>MIT SafeLink geprüft</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Hover actions menu inside timeline card */}
              {hoveredMessageId === item.id && (
                <div className="absolute right-4 top-4 bg-white dark:bg-slate-800 border border-slate-150 dark:border-slate-700 rounded-xl shadow-lg p-1 flex items-center gap-1 z-10 animate-fade-in select-none">
                  <Button variant="ghost" size="sm" className="h-7 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-lg text-xs font-semibold px-2" onClick={onReplyClick}>
                    Reply
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg text-xs font-semibold px-2" onClick={() => onQuoteClick(item.content)}>
                    Quote
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg text-sm font-semibold px-2 flex items-center gap-1" onClick={() => {
                    navigator.clipboard.writeText(item.content);
                    toast.success(language === 'de' ? "Nachricht kopiert!" : "Message copied!");
                  }}>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
