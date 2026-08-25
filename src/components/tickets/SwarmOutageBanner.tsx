import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '../ui/button';
import type { AiIncidentCluster } from '../../types/ai-orchestrator';

interface SwarmOutageBannerProps {
  ticketId: string;
}

/**
 * Swarm Outage Detection (Tier 3) — dismissible emergency warning banner shown
 * at the top of the Ticket view when 5+ similar unassigned tickets arrived in
 * the last 15 minutes.
 */
export function SwarmOutageBanner({ ticketId }: SwarmOutageBannerProps) {
  const [clusters, setClusters] = useState<AiIncidentCluster[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('geistdesk_swarm_dismissed') || '[]') as string[];
    } catch {
      return [];
    }
  });

  const loadClusters = useCallback(async () => {
    try {
      const res = await axios.get('/api/ai/incident-clusters');
      const list = (res.data?.clusters ?? []) as AiIncidentCluster[];
      setClusters(list);
    } catch {
      /* banner is best-effort */
    }
  }, []);

  useEffect(() => {
    void loadClusters();
    const interval = window.setInterval(loadClusters, 120_000);
    return () => window.clearInterval(interval);
  }, [loadClusters]);

  const dismiss = (clusterId: string) => {
    const next = [...dismissedIds, clusterId];
    setDismissedIds(next);
    localStorage.setItem('geistdesk_swarm_dismissed', JSON.stringify(next));
    // Non-fatal server-side resolve (marks the cluster resolved).
    void axios
      .post(`/api/ai/incident-clusters/${encodeURIComponent(clusterId)}/resolve`)
      .catch(() => undefined);
  };

  const visible = clusters.filter((c) => !dismissedIds.includes(c.id));
  if (visible.length === 0) return null;

  const relevant = visible.find((c) => c.sampleTicketIds.includes(ticketId)) ?? visible[0];

  return (
    <div className="px-4 md:px-6 pt-3">
      <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 animate-bounce-short">
        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-rose-800">
            ⚠️ Potential Outage Cluster: {relevant.ticketCount} tickets regarding{' '}
            <span className="font-black uppercase">{relevant.clusterTitle}</span> detected in the last 15 mins.
          </p>
          <p className="text-[10px] text-rose-600/80 mt-0.5">
            Incoming ticket volume suggests a shared root cause. Review open tickets before replying.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-rose-400 hover:text-rose-700 hover:bg-rose-100 shrink-0"
          onClick={() => dismiss(relevant.id)}
          aria-label="Dismiss outage cluster warning"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
