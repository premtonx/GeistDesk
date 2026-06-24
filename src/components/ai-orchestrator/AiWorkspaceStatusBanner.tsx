import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import {
  fetchAiStatus,
  getCachedAiHealth,
  subscribeAiHealth,
  startOrchestratorConfigSync,
} from '../../lib/aiOrchestratorClient';
import type { AiOrchestratorHealth } from '../../types/aiOrchestrator';
import { Activity } from 'lucide-react';

export function AiWorkspaceStatusBanner() {
  const [health, setHealth] = useState<AiOrchestratorHealth | null>(getCachedAiHealth());

  useEffect(() => {
    startOrchestratorConfigSync();
    void fetchAiStatus();
    return subscribeAiHealth(setHealth);
  }, []);

  if (!health) return null;

  const status = health.status;
  const label = health.label ?? (status === 'healthy' ? 'AI Healthy' : status === 'degraded' ? 'AI Degraded' : 'AI Offline');

  return (
    <div
      className={cn(
        'hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider font-mono shrink-0',
        status === 'healthy' && 'bg-emerald-50 border-emerald-200 text-emerald-700',
        status === 'degraded' && 'bg-amber-50 border-amber-200 text-amber-700',
        status === 'offline' && 'bg-red-50 border-red-200 text-red-700',
      )}
      title={`Provider failover: ${health.primaryModel ?? '—'}`}
    >
      <Activity className="w-3 h-3" />
      {label}
      {health.killSwitchActive && <span className="opacity-70">· Kill Switch</span>}
    </div>
  );
}
