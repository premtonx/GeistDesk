import React, { useMemo } from 'react';
import { AlertTriangle, Sparkles, TrendingUp, ChevronRight } from 'lucide-react';
import { cn, safeString } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { Ticket } from '../../types';
import { Button } from '../ui/button';

interface TicketsAiOpsPanelProps {
  tickets: Ticket[];
  onActionClick?: (action: string) => void;
  onClusterClick?: (label: string) => void;
  className?: string;
}

function clusterTickets(tickets: Ticket[]): { label: string; count: number; severity: 'critical' | 'high' | 'medium' }[] {
  const map = new Map<string, number>();
  for (const t of tickets) {
    const firstTag = t.tags?.[0];
    const tag = typeof firstTag === 'string'
      ? firstTag
      : (firstTag && typeof firstTag === 'object'
        ? safeString((firstTag as Record<string, unknown>).name ?? firstTag)
        : '');
    const key = tag || safeString(t.subject).split(' ').slice(0, 2).join(' ') || 'General';
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, count]) => ({
      label,
      count,
      severity: count >= 3 ? 'critical' : count >= 2 ? 'high' : 'medium',
    }));
}

export function TicketsAiOpsPanel({
  tickets,
  onActionClick,
  onClusterClick,
  className,
}: TicketsAiOpsPanelProps) {
  const { t } = useTranslation();

  const clusters = useMemo(() => {
    const built = clusterTickets(tickets);
    if (built.length > 0) return built;
    return [
      { label: t('tickets.aiOps.clusterVpn', 'VPN Outages'), count: 3, severity: 'critical' as const },
      { label: t('tickets.aiOps.clusterEmail', 'Email Sync'), count: 2, severity: 'high' as const },
    ];
  }, [tickets, t]);

  const recommendations = useMemo(() => {
    const urgent = tickets.find((tk) => tk.priority === 'urgent');
    const dupes = tickets.filter((tk, _, arr) =>
      arr.some((o) => o.id !== tk.id && o.subject.toLowerCase() === tk.subject.toLowerCase()),
    );
    return [
      urgent
        ? t('tickets.aiOps.escalateTicket', 'Escalate Ticket #{{id}}').replace(
            '{{id}}',
            urgent.id.slice(-4).toUpperCase(),
          )
        : t('tickets.aiOps.escalateSample', 'Escalate Ticket #2031'),
      dupes.length > 0
        ? t('tickets.aiOps.mergeDuplicates', 'Merge Duplicates')
        : t('tickets.aiOps.mergeSample', 'Merge Duplicates'),
      t('tickets.aiOps.assignUnassigned', 'Auto-assign unassigned queue'),
    ];
  }, [tickets, t]);

  const trends = useMemo(
    () => [
      { label: t('tickets.aiOps.trendVpn', 'VPN category traffic +38%'), direction: 'up' as const },
      { label: t('tickets.aiOps.trendAuth', 'Auth failures +12%'), direction: 'up' as const },
      { label: t('tickets.aiOps.trendBilling', 'Billing inquiries −5%'), direction: 'down' as const },
    ],
    [t],
  );

  return (
    <div className={cn('p-4 md:p-6 space-y-4', className)}>
      <div className="grid md:grid-cols-3 gap-4">
        <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {t('tickets.aiOps.incidentClusters', 'Critical Incident Clusters')}
            </h3>
          </div>
          <ul className="space-y-2">
            {clusters.map((c) => (
              <li key={c.label}>
                <button
                  type="button"
                  onClick={() => onClusterClick?.(c.label)}
                  className="w-full flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-left hover:bg-slate-100/80 transition-colors"
                >
                  <span className="text-xs font-semibold text-slate-800 truncate">
                    {c.label} — {t('tickets.aiOps.ticketCount', '{{count}} Tickets').replace('{{count}}', String(c.count))}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {t('tickets.aiOps.recommendedActions', 'Recommended Actions')}
            </h3>
          </div>
          <ul className="space-y-2">
            {recommendations.map((action) => (
              <li key={action}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onActionClick?.(action)}
                  className="w-full justify-start h-9 text-xs font-semibold rounded-lg border-slate-200"
                >
                  {action}
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {t('tickets.aiOps.trendAlerts', 'Trend Alerts')}
            </h3>
          </div>
          <ul className="space-y-2">
            {trends.map((tr) => (
              <li
                key={tr.label}
                className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-700"
              >
                <span
                  className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded',
                    tr.direction === 'up'
                      ? 'bg-rose-50 text-rose-600'
                      : 'bg-emerald-50 text-emerald-600',
                  )}
                >
                  {tr.direction === 'up' ? '↑' : '↓'}
                </span>
                {tr.label}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
