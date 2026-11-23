import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Paperclip, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { RichTextEditor } from '../../RichTextEditor';
import { cn } from '../../../lib/utils';
import { useClientPortalSession } from '../../../hooks/useClientPortalSession';
import {
  clientPortalApi,
  type PortalMember,
  type PortalTicketAttachment,
} from '../../../services/clientPortalApi';
import type { Ticket, TicketStatus } from '../../../types';

type TimelineItem = {
  id: string;
  content: string;
  senderName: string;
  badge: 'Hubcom Support' | 'Kunden-Support' | 'Mitarbeiter';
  createdAt: string;
  attachments?: PortalTicketAttachment[];
};

function roleBadge(params: {
  senderType?: string;
  senderId?: string;
  membersById: Map<string, PortalMember>;
}): TimelineItem['badge'] {
  const member = params.senderId ? params.membersById.get(params.senderId) : undefined;
  if (member?.role === 'CLIENT_ADMIN' || member?.role === 'CLIENT_SUPPORTER') {
    return 'Kunden-Support';
  }
  if (member?.role === 'CLIENT_USER' || params.senderType === 'customer') {
    return 'Mitarbeiter';
  }
  if (params.senderType === 'agent' || params.senderType === 'ai') {
    return 'Hubcom Support';
  }
  return member ? 'Mitarbeiter' : 'Hubcom Support';
}

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'resolved', label: 'Gelöst' },
  { value: 'closed', label: 'Geschlossen' },
  { value: 'open', label: 'Wiedereröffnen' },
  { value: 'in_progress', label: 'In Bearbeitung' },
];

export default function ClientTicketDetailPage() {
  const { ticketId = '' } = useParams();
  const { session, isOrgWide } = useClientPortalSession();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [members, setMembers] = useState<PortalMember[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [reply, setReply] = useState('');
  const [attachments, setAttachments] = useState<PortalTicketAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [addUserId, setAddUserId] = useState('');

  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const refresh = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const [t, msgs, parts, mems] = await Promise.all([
        clientPortalApi.getTicket(ticketId),
        clientPortalApi.listMessages(ticketId),
        clientPortalApi.listParticipants(ticketId).catch(() => []),
        isOrgWide ? clientPortalApi.listMembers().catch(() => []) : Promise.resolve([]),
      ]);
      setTicket(t);
      setMessages(
        (msgs || []).filter((m) => !(m.is_internal === true || m.isInternal === true)),
      );
      setParticipants((parts || []).map((p) => p.user_id));
      setMembers(mems || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Ticket konnte nicht geladen werden');
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [ticketId, isOrgWide]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const timeline: TimelineItem[] = useMemo(() => {
    if (!ticket) return [];
    const opener: TimelineItem = {
      id: 'opener',
      content: String(ticket.html_content || ticket.description || ''),
      senderName: String(ticket.customerName || ticket.customerEmail || 'Mitarbeiter'),
      badge: roleBadge({
        senderType: 'customer',
        senderId: String(ticket.requesterId || ticket.requester_id || ticket.creatorId || ''),
        membersById,
      }),
      createdAt: String(ticket.createdAt || ''),
      attachments: Array.isArray((ticket as any).attachments)
        ? ((ticket as any).attachments as PortalTicketAttachment[])
        : undefined,
    };
    const rest = messages
      .slice()
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
      .map((m) => ({
        id: String(m.id),
        content: String(m.content || m.html_content || ''),
        senderName: String(m.senderName || 'Unbekannt'),
        badge: roleBadge({
          senderType: m.senderType,
          senderId: m.senderId,
          membersById,
        }),
        createdAt: String(m.createdAt || ''),
        attachments: Array.isArray(m.attachments) ? m.attachments : undefined,
      }));
    return [opener, ...rest];
  }, [ticket, messages, membersById]);

  const sendReply = async () => {
    if (!session || !ticketId) return;
    if (!reply.trim() || reply === '<p><br></p>') {
      toast.error('Antwort darf nicht leer sein.');
      return;
    }
    setSending(true);
    try {
      // Persist reply via portal API (never internal).
      await clientPortalApi.reply(ticketId, {
        content: reply,
        senderId: session.id,
        senderName: session.name || session.email,
      });
      // Optional: store attachment metadata as a follow-up message note via /api/db.
      if (attachments.length > 0) {
        await clientPortalApi.reply(ticketId, {
          content: `<p><em>Anhänge:</em> ${attachments.map((a) => a.filename).join(', ')}</p>`,
          senderId: session.id,
          senderName: session.name || session.email,
        });
      }
      setReply('');
      setAttachments([]);
      toast.success('Antwort gesendet.');
      await refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Senden fehlgeschlagen');
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (status: TicketStatus) => {
    if (!ticketId) return;
    try {
      const updated = await clientPortalApi.updateTicketStatus(ticketId, status);
      setTicket(updated || { ...ticket!, status });
      toast.success('Status aktualisiert.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Status-Update fehlgeschlagen');
    }
  };

  const addParticipant = async () => {
    if (!ticketId || !addUserId) return;
    try {
      await clientPortalApi.addParticipant(ticketId, addUserId);
      setAddUserId('');
      toast.success('Teilnehmer hinzugefügt.');
      await refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Hinzufügen fehlgeschlagen');
    }
  };

  const removeParticipant = async (userId: string) => {
    if (!ticketId) return;
    try {
      await clientPortalApi.removeParticipant(ticketId, userId);
      toast.success('Teilnehmer entfernt.');
      await refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Entfernen fehlgeschlagen');
    }
  };

  if (loading) {
    return (
      <div className="p-20 text-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
        Ticket wird geladen…
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-10 space-y-4">
        <Link to="/portal/tickets" className="text-sm font-semibold text-slate-600 hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Zurück
        </Link>
        <p className="text-slate-500">Ticket nicht gefunden oder kein Zugriff.</p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col lg:flex-row">
      <div className="flex-1 min-w-0 p-6 lg:p-8 space-y-6 overflow-y-auto">
        <div>
          <Link
            to="/portal/tickets"
            className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700 inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Tickets
          </Link>
          <h1 className="text-2xl font-black tracking-tight mt-2">{ticket.subject}</h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            {ticket.customId || ticket.id} · Status: {ticket.status} · Priorität: {ticket.priority}
          </p>
        </div>

        <div className="space-y-4">
          {timeline.map((item) => (
            <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-bold truncate">{item.senderName}</span>
                  <Badge label={item.badge} />
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">
                  {formatDate(item.createdAt)}
                </span>
              </div>
              <div
                className="prose prose-sm max-w-none text-slate-700"
                dangerouslySetInnerHTML={{ __html: item.content || '' }}
              />
              {item.attachments?.length ? (
                <ul className="mt-3 space-y-1">
                  {item.attachments.map((a) => (
                    <li key={a.filename} className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Paperclip className="w-3 h-3" />
                      {a.filename}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          <Label className="text-sm font-bold">Antworten</Label>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <RichTextEditor value={reply} onChange={setReply} />
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
            <Paperclip className="w-3.5 h-3.5" />
            Anhang hinzufügen
            <input
              type="file"
              className="hidden"
              multiple
              onChange={async (e) => {
                const files = e.target.files;
                if (!files?.length) return;
                const next: PortalTicketAttachment[] = [];
                for (const file of Array.from(files)) {
                  const dataUrl = await readFile(file);
                  next.push({
                    filename: file.name,
                    contentType: file.type || 'application/octet-stream',
                    size: file.size,
                    contentBase64: dataUrl.split(',')[1] || '',
                  });
                }
                setAttachments((prev) => [...prev, ...next]);
              }}
            />
          </label>
          {attachments.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {attachments.map((a) => (
                <span
                  key={a.filename}
                  className="text-[11px] bg-slate-100 rounded-full px-2 py-1 inline-flex items-center gap-1"
                >
                  {a.filename}
                  <button type="button" onClick={() => setAttachments((p) => p.filter((x) => x !== a))}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button type="button" disabled={sending} onClick={() => void sendReply()} className="gap-2">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Antwort senden
            </Button>
          </div>
        </div>
      </div>

      {isOrgWide ? (
        <aside className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 bg-white p-5 space-y-6 overflow-y-auto">
          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-3">
              Status
            </h2>
            <div className="space-y-2">
              {STATUS_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={ticket.status === opt.value ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => void updateStatus(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-3">
              Teilnehmer
            </h2>
            <ul className="space-y-2 mb-3">
              {participants.length === 0 ? (
                <li className="text-xs text-slate-400">Noch keine Teilnehmer.</li>
              ) : (
                participants.map((uid) => {
                  const m = membersById.get(uid);
                  return (
                    <li
                      key={uid}
                      className="flex items-center justify-between gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2"
                    >
                      <span className="truncate font-medium">{m?.name || m?.email || uid}</span>
                      <button
                        type="button"
                        className="text-slate-400 hover:text-rose-600"
                        onClick={() => void removeParticipant(uid)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
            <div className="flex gap-2">
              <select
                className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
              >
                <option value="">Mitglied wählen…</option>
                {members
                  .filter((m) => !participants.includes(m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.email}
                    </option>
                  ))}
              </select>
              <Button type="button" size="sm" className="gap-1" onClick={() => void addParticipant()}>
                <UserPlus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function Badge({ label }: { label: TimelineItem['badge'] }) {
  const tone =
    label === 'Hubcom Support'
      ? 'bg-blue-50 text-blue-700'
      : label === 'Kunden-Support'
        ? 'bg-violet-50 text-violet-700'
        : 'bg-slate-100 text-slate-600';
  return (
    <span className={cn('text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full', tone)}>
      {label}
    </span>
  );
}

function formatDate(value: string): string {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '';
  }
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}
