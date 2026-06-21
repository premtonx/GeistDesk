import React from 'react';
import { 
  Building2, 
  User, 
  MapPin, 
  Clock, 
  Globe, 
  BadgeCheck,
  ShieldCheck,
  History,
  GitFork,
  CheckCircle,
  PlusCircle,
  FolderSync
} from 'lucide-react';
import { Ticket as TicketType, Message, AgentComment } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

interface TimelineTabContentProps {
  ticket: TicketType;
  messages: Message[];
  agentComments: AgentComment[];
}

export function TimelineTabContent({
  ticket,
  messages,
  agentComments
}: TimelineTabContentProps) {
  // Merge messages, internal comments, and creation event into a chronological array
  const timelineEvents = React.useMemo(() => {
    const events: { id: string; type: string; title: string; desc: string; time: Date; actor: string }[] = [];

    // Base ticket creation
    const createdTime = ticket.createdAt?.toDate ? ticket.createdAt.toDate() : new Date(ticket.createdAt);
    events.push({
      id: 'event-creation',
      type: 'creation',
      title: 'Ticket Received',
      desc: `Support case launched via ${ticket.channel || 'portal'} channel.`,
      time: createdTime,
      actor: ticket.customerName
    });

    // Communication messages
    messages.forEach(m => {
      const msgTime = m.createdAt?.toDate ? m.createdAt.toDate() : new Date(m.createdAt);
      events.push({
        id: `event-msg-${m.id}`,
        type: m.senderType === 'customer' ? 'incoming' : 'reply',
        title: m.senderType === 'customer' ? 'Customer Response' : m.senderType === 'ai' ? 'AI Response Drafted' : 'Agent reply dispatched',
        desc: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : ''),
        time: msgTime,
        actor: m.senderName || 'Anonymous'
      });
    });

    // Agent internal notes
    agentComments.forEach(c => {
      const comTime = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
      events.push({
        id: `event-com-${c.id}`,
        type: 'note',
        title: 'Internal Agent Note Recorded',
        desc: c.content,
        time: comTime,
        actor: c.agentName
      });
    });

    // Sort chronologically (latest first or earliest first, let's do latest first for chronological logging)
    return events.sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [ticket, messages, agentComments]);

  return (
    <div id="chronological-timeline-log" className="space-y-6">
      <Card className="border-border rounded-2xl shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-6 border-b pb-4">
            <History className="w-5 h-5 text-indigo-500" />
            <div>
              <h3 className="text-sm font-bold text-foreground">Chronological Ticket Audit Timeline</h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">GoBD Compliance Logs</p>
            </div>
          </div>

          <div className="relative border-l border-border pl-6 ml-3 space-y-6">
            {timelineEvents.map((ev, index) => (
              <div key={ev.id} className="relative">
                {/* Visual Circle Node Indicator */}
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
