import React, { useMemo } from 'react';
import { X, Sparkles, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Ticket as TicketType, KBArticle } from '../../types';

interface TicketDetailDrawerProps {
  ticket: TicketType | null;
  allTickets: TicketType[];
  kbArticles: KBArticle[];
  onClose: () => void;
  onOpenFullView: () => void;
}

function formatSlaLabel(ticket: TicketType, t: (key: string, fallback: string) => string): string {
  if (ticket.status === 'resolved' || ticket.status === 'closed') {
    return t('tickets.status.resolved', 'Resolved');
  }
  const due = ticket.slaDueAt || ticket.firstResponseDue;
  if (!due) return t('tickets.noSla', 'No SLA');
  const dueDate = due.toDate ? due.toDate() : new Date(due);
  const diffHrs = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60));
  if (diffHrs < 0) return t('tickets.slaBreached', 'SLA Breached');
  return t('tickets.slaDueHrs', 'SLA Due {{hrs}}h').replace('{{hrs}}', String(diffHrs));
}

export function TicketDetailDrawer({
  ticket,
  allTickets,
  kbArticles,
  onClose,
  onOpenFullView,
}: TicketDetailDrawerProps) {
  const { t } = useTranslation();

  const similarCount = useMemo(() => {
    if (!ticket) return 0;
    return allTickets.filter(
      (o) =>
        o.id !== ticket.id &&
        (o.subject.toLowerCase() === ticket.subject.toLowerCase() ||
          (ticket.tags && o.tags && ticket.tags.some((tag) => o.tags?.includes(tag)))),
    ).length;
  }, [ticket, allTickets]);

  const suggestedKb = useMemo(() => {
    if (!ticket) return [];
    const linked = ((ticket as any).aiLinkedKb || []) as Array<{ id: string; title: string }>;
    if (linked.length > 0) {
      return linked.slice(0, 5).map((l) => ({ id: l.id, title: l.title } as KBArticle));
    }
    const query = `${ticket.subject} ${ticket.description ?? ''}`.toLowerCase();
    return kbArticles
      .filter((a) => a.title.toLowerCase().split(' ').some((w) => query.includes(w)))
      .slice(0, 3);
  }, [ticket, kbArticles]);

  const linkedTickets = useMemo(() => {
    if (!ticket) return [];
    const linked = ((ticket as any).aiLinkedTickets || []) as Array<{ id: string; title: string }>;
    if (linked.length > 0) return linked.slice(0, 5);
    return allTickets
      .filter(
        (o) =>
          o.id !== ticket.id &&
          (o.status === 'resolved' || o.status === 'closed') &&
          (o.subject.toLowerCase() === ticket.subject.toLowerCase() ||
            (ticket.tags && o.tags && ticket.tags.some((tag) => o.tags?.includes(tag)))),
      )
      .slice(0, 5)
      .map((o) => ({ id: o.id, title: o.subject }));
  }, [ticket, allTickets]);

  return (
    <AnimatePresence>
      {ticket ? (
        <>
          <motion.div
            key="ticket-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="absolute inset-0 z-30 bg-black/20 backdrop-blur-[1px]"
            aria-hidden
          />
          <motion.aside
            key="ticket-drawer-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="absolute inset-y-0 right-0 z-40 w-full max-w-[480px] bg-white border-l border-slate-200/80 shadow-2xl flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label={t('tickets.drawer.ariaLabel', 'Ticket details')}
          >
            <header className="px-5 py-4 border-b border-slate-100 bg-[#FAFBFC] shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-[10px] h-5 capitalize">
                      {t(`tickets.status.${ticket.status ?? 'open'}`, ticket.status ?? 'open')}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] h-5 capitalize">
                      {t(`tickets.priority.${ticket.priority ?? 'medium'}`, ticket.priority ?? 'medium')}
                    </Badge>
                    <span className="text-[10px] font-mono text-slate-400">#{ticket.id.slice(-6).toUpperCase()}</span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 leading-snug break-words">{ticket.subject}</h2>
                  <p className="text-[11px] text-slate-500 mt-1 truncate">
                    {ticket.customerName} · {ticket.company || t('tickets.privateCustomer', 'Private')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8 w-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 transition-colors"
                  aria-label={t('tickets.drawer.close', 'Close')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <section className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">
                  {t('tickets.drawer.metaTray', 'Meta Tray')}
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase mb-0.5">
                      {t('tickets.table.assignee', 'Assignee')}
                    </p>
                    <p className="font-semibold text-slate-800 truncate">
                      {ticket.agentName || t('tickets.unassigned', 'Unassigned')}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase mb-0.5">
                      {t('tickets.table.priority', 'Priority')}
                    </p>
                    <p className="font-semibold text-slate-800 capitalize">{ticket.priority ?? 'medium'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase mb-0.5">
                      {t('tickets.table.customer', 'Customer')}
                    </p>
                    <p className="font-semibold text-slate-800 truncate">{ticket.customerName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase mb-0.5">SLA</p>
                    <p className="font-semibold text-slate-800">{formatSlaLabel(ticket, t)}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-xs font-bold text-slate-800">
                    {t('tickets.drawer.aiInsights', 'AI Insights')}
                  </h3>
                </div>
                <div className="space-y-2 text-xs">
                  <p className="text-slate-700">
                    <span className="font-semibold">{t('tickets.drawer.similarCount', 'Similar Tickets Count')}:</span>{' '}
                    {similarCount}
                  </p>
                  <div>
                    <p className="font-semibold text-slate-700 mb-1">
                      {t('tickets.drawer.suggestedKb', 'Suggested KB Articles')}
                    </p>
                    {suggestedKb.length === 0 ? (
                      <p className="text-slate-500">{t('tickets.drawer.noKbSuggestions', 'No matches yet')}</p>
                    ) : (
                      <ul className="space-y-1">
                        {suggestedKb.map((a) => (
                          <li key={a.id} className="text-indigo-700 font-medium truncate">
                            {a.title}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700 mb-1">
                      {t('tickets.drawer.relatedResolved', 'Related resolved tickets')}
                    </p>
                    {linkedTickets.length === 0 ? (
                      <p className="text-slate-500">{t('tickets.drawer.noRelated', 'No related tickets yet')}</p>
                    ) : (
                      <ul className="space-y-1">
                        {linkedTickets.map((tkt) => (
                          <li key={tkt.id} className="text-slate-700 font-medium truncate">
                            <span className="font-mono text-[10px] text-slate-400 mr-1">
                              #{tkt.id.slice(-6).toUpperCase()}
                            </span>
                            {tkt.title}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </section>

              {ticket.description && (
                <section className="rounded-xl border border-slate-200/80 p-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {t('tickets.drawer.description', 'Description')}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-6">
                    {ticket.description.replace(/<[^>]*>/g, '')}
                  </p>
                </section>
              )}
            </div>

            <footer className="px-5 py-3 border-t border-slate-100 bg-white shrink-0">
              <Button
                type="button"
                onClick={onOpenFullView}
                className="w-full h-9 text-xs font-bold gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {t('tickets.drawer.openFullView', 'Open Full Ticket View')}
              </Button>
            </footer>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
