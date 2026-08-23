import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Database, RefreshCw, Search, Settings2, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { useTranslation } from '../../../lib/context/I18nContext';
import { AdminHubSectionGrid } from './AdminHubSectionGrid';
import { categoriesForTab } from './adminHubConfig';
import { cn } from '../../../lib/utils';

type ResolutionMode = 'extract' | 'ai_generated' | 'hybrid';

interface RagStatus {
  success: boolean;
  tenantId: string;
  queueDepth: number;
  kb: {
    totalArticles: number;
    publishedArticles: number;
    indexedChunks: number;
    indexedArticles: number;
    missingIndexArticles: number;
  };
  tickets: {
    totalResolvedClosed: number;
    indexedChunks: number;
    indexedTickets: number;
    missingIndexTickets: number;
  };
  activeEmbeddingProvider: unknown;
  config: {
    resolutionMode: ResolutionMode;
    redactPii: boolean;
    chunkOverlapTokens: number;
  };
  sampledMissingKb?: string[];
  sampledMissingTickets?: string[];
}

interface SearchHit {
  sourceType?: string;
  sourceId?: string;
  title?: string;
  chunkContent?: string;
  hybridScore?: number;
  vectorDistance?: number;
  metadata?: Record<string, unknown>;
}

const MODE_LABELS: Record<ResolutionMode, string> = {
  extract: 'Extrahieren (0 LLM-Kosten)',
  ai_generated: 'KI-Zusammenfassung',
  hybrid: 'Hybrid (Standard)',
};

export function AdminHubRagTab() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<RagStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [resolutionMode, setResolutionMode] = useState<ResolutionMode>('hybrid');
  const [redactPii, setRedactPii] = useState(true);
  const [chunkOverlap, setChunkOverlap] = useState(100);
  const [savingConfig, setSavingConfig] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [backfilling, setBackfilling] = useState<'kb' | 'ticket' | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await axios.get('/api/admin/rag/status');
      setStatus(res.data);
      setResolutionMode(res.data.config?.resolutionMode ?? 'hybrid');
      setRedactPii(res.data.config?.redactPii ?? true);
      setChunkOverlap(res.data.config?.chunkOverlapTokens ?? 100);
    } catch (err) {
      console.warn('RAG status unavailable', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      await axios.put('/api/admin/rag/config', {
        resolutionMode,
        redactPii,
        chunkOverlapTokens: chunkOverlap,
      });
      setConfigOpen(false);
      await loadStatus();
    } catch (err) {
      console.warn('Failed to save RAG config', err);
    } finally {
      setSavingConfig(false);
    }
  };

  const runSearchTest = async () => {
    setSearching(true);
    setHits(null);
    try {
      const res = await axios.get('/api/admin/rag/search-test', {
        params: { q: query.trim() || 'password reset', limit: 5 },
      });
      setHits(res.data.hits ?? []);
    } catch (err) {
      console.warn('RAG search test failed', err);
      setHits([]);
    } finally {
      setSearching(false);
    }
  };

  const runBackfill = async (type: 'kb' | 'ticket') => {
    setBackfilling(type);
    try {
      await axios.get('/api/admin/rag/backfill', { params: { type } });
      await loadStatus();
    } catch (err) {
      console.warn(`RAG backfill (${type}) failed`, err);
    } finally {
      setBackfilling(null);
    }
  };

  const kb = status?.kb;
  const tickets = status?.tickets;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-slate-900">
          {t('admin.rag.title', 'RAG & Wissensbasis')}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadStatus()}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfigOpen((v) => !v)}>
            <Settings2 className="w-3.5 h-3.5" />
            {t('admin.rag.config', 'Pipeline-Konfiguration')}
          </Button>
        </div>
      </div>

      {configOpen ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400">
              {t('admin.rag.resolutionMode', 'Resolution-Modus')}
            </label>
            <select
              value={resolutionMode}
              onChange={(e) => setResolutionMode(e.target.value as ResolutionMode)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {(Object.keys(MODE_LABELS) as ResolutionMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {MODE_LABELS[mode]}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Wie die finale akzeptierte Lösung eines gelösten Tickets für das RAG erfasst wird.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={redactPii}
              onChange={(e) => setRedactPii(e.target.checked)}
              className="rounded"
            />
            PII-Redaktion vor dem Embedding (empfohlen)
          </label>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400">
              Chunk-Überlappung (Tokens)
            </label>
            <Input
              type="number"
              min={20}
              max={300}
              value={chunkOverlap}
              onChange={(e) => setChunkOverlap(Number(e.target.value) || 100)}
              className="mt-1 w-32"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void saveConfig()} disabled={savingConfig}>
              {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Speichern
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfigOpen(false)}>
              Abbrechen
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Lade RAG-Status…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatusCard
            title={t('admin.rag.kbTitle', 'Wissensbasis-Artikel')}
            total={kb?.publishedArticles ?? 0}
            indexed={kb?.indexedArticles ?? 0}
            chunks={kb?.indexedChunks ?? 0}
            missing={kb?.missingIndexArticles ?? 0}
            missingLabel={t('admin.rag.kbMissing', 'Artikel ohne Index')}
            onBackfill={() => void runBackfill('kb')}
            backfilling={backfilling === 'kb'}
          />
          <StatusCard
            title={t('admin.rag.ticketsTitle', 'Gelöste Tickets')}
            total={tickets?.totalResolvedClosed ?? 0}
            indexed={tickets?.indexedTickets ?? 0}
            chunks={tickets?.indexedChunks ?? 0}
            missing={tickets?.missingIndexTickets ?? 0}
            missingLabel={t('admin.rag.ticketsMissing', 'Tickets ohne Index')}
            onBackfill={() => void runBackfill('ticket')}
            backfilling={backfilling === 'ticket'}
          />
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <Search className="w-3.5 h-3.5 text-blue-600" />
          {t('admin.rag.searchTest', 'Ähnlichkeitssuche (End-to-End)')}
        </div>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="z. B. Passwort zurücksetzen"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runSearchTest();
            }}
          />
          <Button size="sm" onClick={() => void runSearchTest()} disabled={searching}>
            {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Suchen
          </Button>
        </div>
        {hits !== null ? (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-500">
              {hits.length} Treffer — nur Workspace-{status?.tenantId || 'default'}-Daten (
              <span className="font-semibold text-emerald-600">tenant-isoliert</span>)
            </p>
            {hits.length === 0 ? (
              <p className="text-[11px] text-slate-400">Keine Treffer.</p>
            ) : (
              hits.map((hit, i) => (
                <div key={i} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 truncate">
                      {hit.title || hit.sourceId || 'Untitled'}
                    </span>
                    <Badge className="text-[10px] font-bold uppercase">
                      {hit.sourceType === 'RESOLVED_TICKET' ? 'Ticket' : 'KB'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                    {String(hit.chunkContent || '').slice(0, 220)}
                  </p>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>

      <AdminHubSectionGrid categories={categoriesForTab('rag')} />
    </div>
  );
}

function StatusCard({
  title,
  total,
  indexed,
  chunks,
  missing,
  missingLabel,
  onBackfill,
  backfilling,
}: {
  title: string;
  total: number;
  indexed: number;
  chunks: number;
  missing: number;
  missingLabel: string;
  onBackfill: () => void;
  backfilling: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-black text-slate-900">{title}</h3>
        </div>
        <Badge
          className={cn(
            'text-[10px] font-bold uppercase',
            missing === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
          )}
        >
          {missing === 0 ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Vollständig
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {missing} offen
            </span>
          )}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric label="Quellen" value={indexed} />
        <Metric label="Chunks" value={chunks} />
        <Metric label="Total" value={total} />
      </div>
      {missing > 0 ? (
        <Button variant="outline" size="sm" className="w-full" onClick={onBackfill} disabled={backfilling}>
          {backfilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {missingLabel} ({missing})
        </Button>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-100 py-2">
      <div className="text-lg font-black text-slate-800">{value}</div>
      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  );
}
