import React from 'react';
import { 
  BadgeCheck,
  History,
  CheckCircle,
  PlusCircle,
  FolderSync
} from 'lucide-react';
import { Ticket as TicketType, Message, AgentComment } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { useTranslation } from '../../lib/context/I18nContext';

interface TimelineTabContentProps {
  ticket: TicketType;
  messages: Message[];
  agentComments: AgentComment[];
}

function fmt(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v),
    template
  );
}

export function TimelineTabContent({
  ticket,
  messages,
  agentComments
}: TimelineTabContentProps) {
  const { t } = useTranslation();

  const timelineEvents = React.useMemo(() => {
    const events: { id: string; type: string; title: string; desc: string; time: Date; actor: string }[] = [];

    const createdTime = ticket.createdAt?.toDate ? ticket.createdAt.toDate() : new Date(ticket.createdAt);
    events.push({
      id: 'event-creation',
      type: 'creation',
      title: t('tickets.timelineTab.ticketReceived', 'Ticket received'),
      desc: fmt(t('tickets.timelineTab.ticketReceivedDesc', 'Support case launched via {{channel}} channel.'), {
        channel: ticket.channel || t('tickets.timelineTab.portal', 'portal'),
      }),
      time: createdTime,
      actor: ticket.customerName
    });

    messages.forEach(m => {
      const msgTime = m.createdAt?.toDate ? m.createdAt.toDate() : new Date(m.createdAt);
      let title = t('tickets.timelineTab.agentReplyDispatched', 'Agent reply dispatched');
      if (m.senderType === 'customer') {
        title = t('tickets.timelineTab.customerResponse', 'Customer response');
      } else if (m.senderType === 'ai') {
        title = t('tickets.timelineTab.aiResponseDrafted', 'AI response drafted');
      }
      events.push({
        id: `event-msg-${m.id}`,
        type: m.senderType === 'customer' ? 'incoming' : 'reply',
        title,
        desc: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : ''),
        time: msgTime,
        actor: m.senderName || t('tickets.timelineTab.anonymous', 'Anonymous')
      });
    });

    agentComments.forEach(c => {
      const comTime = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
      events.push({
        id: `event-com-${c.id}`,
        type: 'note',
        title: t('tickets.timelineTab.internalNoteRecorded', 'Internal agent note recorded'),
        desc: c.content,
        time: comTime,
        actor: c.agentName
      });
    });

    return events.sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [ticket, messages, agentComments, t]);

  return (
    <div id="chronological-timeline-log" className="space-y-6">
      <Card className="border-border rounded-2xl shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-6 border-b pb-4">
            <History className="w-5 h-5 text-indigo-500" />
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {t('tickets.timelineTab.title', 'Chronological ticket audit timeline')}
              </h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                {t('tickets.timelineTab.subtitle', 'GoBD compliance logs')}
              </p>
            </div>
          </div>

          <div className="relative border-l border-border pl-6 ml-3 space-y-6">
            {timelineEvents.map((ev) => (
              <div key={ev.id} className="relative">
                <span className="absolute -left-9.5 top-0.5 w-6 h-6 rounded-full bg-card border-2 flex items-center justify-center shadow-sm">
                  {ev.type === 'creation' && <PlusCircle className="w-3.5 h-3.5 text-primary" />}
                  {ev.type === 'incoming' && <FolderSync className="w-3.5 h-3.5 text-blue-500 animate-pulse" />}
                  {ev.type === 'reply' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                  {ev.type === 'note' && <BadgeCheck className="w-3.5 h-3.5 text-amber-500" />}
                </span>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-foreground">{ev.title}</span>
                    <span className="text-[10px] text-muted-foreground">• {ev.actor}</span>
                    <Badge variant="outline" className="text-[8px] h-4 py-0 font-bold ml-auto uppercase tracking-tighter">
                      {ev.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground/90 pl-1 leading-relaxed">{ev.desc}</p>
                  <p className="text-[9.5px] text-muted-foreground font-mono pl-1">{ev.time.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
