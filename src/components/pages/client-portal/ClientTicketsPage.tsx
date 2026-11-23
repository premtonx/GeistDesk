import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Plus, Search } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { cn } from '../../../lib/utils';
import { useClientPortalSession } from '../../../hooks/useClientPortalSession';
import { clientPortalApi } from '../../../services/clientPortalApi';
import type { Ticket, TicketStatus } from '../../../types';

type Scope = 'mine' | 'all';

const STATUS_LABELS: Record<string, string> = {
  open: 'Offen',
  pending: 'Wartend',
  in_progress: 'In Bearbeitung',
  resolved: 'Gelöst',
  closed: 'Geschlossen',
  waiting_customer: 'Wartet auf Kunde',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Niedrig',
  medium: 'Normal',
  high: 'Hoch',
  urgent: 'Dringend',
};

function ticketRequesterId(t: Ticket): string {
  return String(t.requesterId || t.requester_id || t.creatorId || '');
}

export default function ClientTicketsPage() {
  const { session, isOrgWide } = useClientPortalSession();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [participantTicketIds, setParticipantTicketIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<Scope>('mine');
  const [status, setStatus] = useState<string>('all');
  const [priority, setPriority] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const list = await clientPortalApi.listTickets();
        if (!active) return;
        setTickets(list);

        // Resolve participant membership for "Meine Tickets" (CLIENT_USER + mine scope).
        if (session && isOrgWide) {
          const mine = new Set<string>();
          await Promise.all(
            list.slice(0, 80).map(async (t) => {
              try {
                const parts = await clientPortalApi.listParticipants(t.id);
                if (parts.some((p) => p.user_id === session.id)) mine.add(t.id);
              } catch {
                /* ignore */
              }
            }),
          );
          if (active) setParticipantTicketIds(mine);
        }
      } catch {
        if (active) setTickets([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [session, isOrgWide]);

  const filtered = useMemo(() => {
    if (!session) return [];
    let rows = [...tickets];

    if (!isOrgWide || scope === 'mine') {
      rows = rows.filter((t) => {
        const requester = ticketRequesterId(t);
        return requester === session.id || participantTicketIds.has(t.id);
      });
    }

    if (status !== 'all') {
      rows = rows.filter((t) => t.status === status);
    }
    if (priority !== 'all') {
      rows = rows.filter((t) => t.priority === priority);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (t) =>
          String(t.subject || '').toLowerCase().includes(q) ||
          String(t.id || '').toLowerCase().includes(q) ||
          String(t.customId || '').toLowerCase().includes(q),
      );
    }

    return rows.sort((a, b) => {
      const aT = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bT = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bT - aT;
    });
  }, [tickets, session, isOrgWide, scope, status, priority, search, participantTicketIds]);

  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Übersicht / Tickets</h1>
          <p className="text-sm text-slate-500 mt-1">
            Ihre Support-Anfragen an Hubcom — transparent und ohne interne Notizen.
          </p>
        </div>
        <Button type="button" className="gap-2" onClick={() => navigate('/portal/tickets/new')}>
          <Plus className="w-4 h-4" />
          Neues Ticket
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          {isOrgWide ? (
            <div className="inline-flex rounded-xl border border-slate-200 p-1 bg-slate-50">
              <button
                type="button"
                className={cn(
                  'px-3 py-1.5 text-xs font-bold rounded-lg',
                  scope === 'mine' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500',
                )}
                onClick={() => setScope('mine')}
              >
                Meine Tickets
              </button>
              <button
                type="button"
                className={cn(
                  'px-3 py-1.5 text-xs font-bold rounded-lg',
                  scope === 'all' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500',
                )}
                onClick={() => setScope('all')}
              >
                Alle Firmen-Tickets
              </button>
            </div>
          ) : null}

          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Suche nach Betreff oder ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">Alle Status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="all">Alle Prioritäten</option>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
            Tickets werden geladen…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            Keine Tickets gefunden.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-3 font-bold">Betreff</th>
                  <th className="py-2 pr-3 font-bold">Status</th>
                  <th className="py-2 pr-3 font-bold">Priorität</th>
                  <th className="py-2 font-bold">Aktualisiert</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                    <td className="py-3 pr-3">
                      <Link
                        to={`/portal/tickets/${t.id}`}
                        className="font-semibold text-slate-900 hover:underline"
                      >
                        {t.subject || '(ohne Betreff)'}
                      </Link>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {t.customId || t.id.slice(0, 8)}
                      </p>
                    </td>
                    <td className="py-3 pr-3">
                      <StatusPill status={t.status} />
                    </td>
                    <td className="py-3 pr-3">
                      {PRIORITY_LABELS[t.priority] || t.priority}
                    </td>
                    <td className="py-3 text-slate-500">
                      {formatDate(t.updatedAt || t.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: TicketStatus | string }) {
  const label = STATUS_LABELS[status] || status;
  const tone =
    status === 'resolved' || status === 'closed'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'urgent' || status === 'high'
        ? 'bg-amber-50 text-amber-800'
        : 'bg-slate-100 text-slate-700';
  return (
    <span className={cn('text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full', tone)}>
      {label}
    </span>
  );
}

function formatDate(value: unknown): string {
  try {
    const d =
      typeof value === 'string'
        ? new Date(value)
        : value && typeof value === 'object' && 'toDate' in (value as any)
          ? (value as any).toDate()
          : new Date(String(value || ''));
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}
