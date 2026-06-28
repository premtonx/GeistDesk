import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Activity, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useTranslation } from '../../lib/context/I18nContext';
import type { AiProviderBenchmarkRow } from '../../types/aiOrchestrator';

function costScaleClass(scale: string): string {
  if (scale === '$') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (scale === '$$') return 'text-blue-700 bg-blue-50 border-blue-200';
  if (scale === '$$$') return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function statusBadge(status: AiProviderBenchmarkRow['status']) {
  if (status === 'online') return 'border-emerald-200 text-emerald-700 bg-emerald-50';
  if (status === 'degraded') return 'border-amber-200 text-amber-700 bg-amber-50';
  if (status === 'missing_key') return 'border-orange-200 text-orange-700 bg-orange-50';
  return 'border-red-200 text-red-700 bg-red-50';
}

export function AiProviderBenchmarkGrid() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<AiProviderBenchmarkRow[]>([]);
  const [refreshedAt, setRefreshedAt] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const res = await axios.get('/api/admin/orchestrator/benchmark');
      setRows(res.data.rows || []);
      setRefreshedAt(res.data.refreshedAt || new Date().toISOString());
    } catch {
      setRows([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(true), 30_000);
    return () => clearInterval(interval);
  }, [load]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="w-4 h-4" />
          {refreshedAt && (
            <span>
              {t('aiOrchestrator.benchmark.lastRefresh', 'Last refresh')}:{' '}
              {new Date(refreshedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" disabled={isRefreshing} onClick={() => void load(true)}>
          {isRefreshing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          {t('aiOrchestrator.benchmark.refresh', 'Refresh')}
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left p-3 font-semibold text-slate-600">{t('aiOrchestrator.benchmark.provider', 'Provider')}</th>
                <th className="text-right p-3 font-semibold text-slate-600">{t('aiOrchestrator.benchmark.latency', 'Latency (ms)')}</th>
                <th className="text-center p-3 font-semibold text-slate-600">{t('aiOrchestrator.benchmark.costScale', 'Cost Scale')}</th>
                <th className="text-right p-3 font-semibold text-slate-600">{t('aiOrchestrator.benchmark.quality', 'Quality Rating (%)')}</th>
                <th className="text-right p-3 font-semibold text-slate-600">{t('aiOrchestrator.benchmark.reliability', 'Connection Reliability (%)')}</th>
                <th className="text-center p-3 font-semibold text-slate-600">{t('aiOrchestrator.benchmark.status', 'Status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.provider} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="p-3 font-semibold text-slate-800">{row.label}</td>
                  <td className="p-3 text-right font-mono">{row.latencyMs != null ? row.latencyMs : '—'}</td>
                  <td className="p-3 text-center">
                    <Badge variant="outline" className={`font-black tracking-widest ${costScaleClass(row.costScale)}`}>
                      {row.costScale}
                    </Badge>
                  </td>
                  <td className="p-3 text-right font-mono">{row.qualityRating.toFixed(1)}%</td>
                  <td className="p-3 text-right font-mono">{row.connectionReliability.toFixed(1)}%</td>
                  <td className="p-3 text-center">
                    <Badge variant="outline" className={`text-[10px] capitalize ${statusBadge(row.status)}`}>
                      {t(`aiOrchestrator.benchmark.statuses.${row.status}`, row.status.replace(/_/g, ' '))}
                    </Badge>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    {t('aiOrchestrator.benchmark.empty', 'No provider metrics available yet.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
