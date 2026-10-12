import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Database, RefreshCw, Search, Settings2, Loader2, CheckCircle2, AlertTriangle, FolderTree, Plus, Trash2, Cloud, HardDrive, Share2, Play, KeyRound, Server } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Switch } from '../../ui/switch';
import { useTranslation } from '../../../lib/context/I18nContext';
import { AdminHubSectionGrid } from './AdminHubSectionGrid';
import { categoriesForTab } from './adminHubConfig';
import { cn } from '../../../lib/utils';
import { kbDocumentsApi, type KbExternalSource } from '../../../services/kbDocumentsApi';

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
    indexResolvedTickets?: boolean;
    indexNewKbArticles?: boolean;
    detectDuplicates?: boolean;
  };
  sampledMissingKb?: string[];
  sampledMissingTickets?: string[];
  embeddingError?: string | null;
  recentFailures?: Array<{ id: string; jobType: string; lastError: string | null; updatedAt: string }>;
}

interface SearchHit {
  id?: string;
  sourceType?: string;
  sourceId?: string;
  title?: string;
  content?: string;
  chunkContent?: string;
  similarityScore?: number;
  hybridScore?: number;
  vectorDistance?: number;
  metadata?: Record<string, unknown>;
}

interface IndexProgress {
  type: 'kb' | 'ticket';
  enqueued: number;
  completed: number;
  queueDepth: number;
  missing: number;
  message: string;
  error?: string | null;
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
  const [indexResolvedTickets, setIndexResolvedTickets] = useState(true);
  const [indexNewKbArticles, setIndexNewKbArticles] = useState(true);
  const [detectDuplicates, setDetectDuplicates] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [backfilling, setBackfilling] = useState<'kb' | 'ticket' | null>(null);
  const [indexProgress, setIndexProgress] = useState<IndexProgress | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);

  // External connectors state
  const [sources, setSources] = useState<KbExternalSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [savingSource, setSavingSource] = useState(false);
  const [form, setForm] = useState<{
    type: 'local_dir' | 'sftp' | 'sharepoint' | 'onedrive';
    name: string;
    basePath: string;
    host: string;
    port: string;
    username: string;
    authMode: 'password' | 'privateKey';
    folderId: string;
    clientId: string;
    azureTenantId: string;
    secret: string;
  }>({
    type: 'local_dir',
    name: '',
    basePath: '',
    host: '',
    port: '22',
    username: '',
    authMode: 'password',
    folderId: '',
    clientId: '',
    azureTenantId: '',
    secret: '',
  });

  const loadSources = useCallback(async () => {
    try {
      const list = await kbDocumentsApi.listSources();
      setSources(list);
    } catch (err) {
      console.warn('Failed to load external sources', err);
    } finally {
      setSourcesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const loadStatus = useCallback(async () => {
    try {
      const res = await axios.get('/api/rag/status');
      setStatus(res.data);
      setResolutionMode(res.data.config?.resolutionMode ?? 'hybrid');
      setRedactPii(res.data.config?.redactPii ?? true);
      setChunkOverlap(res.data.config?.chunkOverlapTokens ?? 100);
      setIndexResolvedTickets(res.data.config?.indexResolvedTickets !== false);
      setIndexNewKbArticles(res.data.config?.indexNewKbArticles !== false);
      setDetectDuplicates(res.data.config?.detectDuplicates !== false);
      return res.data as RagStatus;
    } catch (err) {
      console.warn('RAG status unavailable', err);
      return null;
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
      await axios.put('/api/rag/config', {
        resolutionMode,
        redactPii,
        chunkOverlapTokens: chunkOverlap,
        indexResolvedTickets,
        indexNewKbArticles,
        detectDuplicates,
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
      const res = await axios.post('/api/rag/search', {
        query: query.trim() || 'password reset',
        limit: 5,
        minSimilarity: 0.65,
      });
      setHits(res.data.hits ?? []);
    } catch (err) {
      console.warn('RAG search test failed', err);
      setHits([]);
    } finally {
      setSearching(false);
    }
  };

  /** Index only missing sources with 2s polling until complete or hard error. */
  const runIndexPending = async (type: 'kb' | 'ticket') => {
    setBackfilling(type);
    setIndexError(null);
    const initialMissing =
      type === 'kb' ? (status?.kb.missingIndexArticles ?? 0) : (status?.tickets.missingIndexTickets ?? 0);
    setIndexProgress({
      type,
      enqueued: 0,
      completed: 0,
      queueDepth: 0,
      missing: initialMissing,
      message: 'Warteschlange wird gefüllt…',
    });
    try {
      const res = await axios.post('/api/rag/index-pending', { type });
      const enqueued = Number(res.data.enqueued || 0);
      setIndexProgress({
        type,
        enqueued,
        completed: 0,
        queueDepth: Number(res.data.queueDepth || 0),
        missing: Math.max(enqueued, initialMissing),
        message:
          enqueued === 0
            ? '✓ Alle Artikel synchronisiert'
            : `⏳ Indexierung läuft... (0/${enqueued} in Bearbeitung)`,
      });

      if (enqueued === 0) {
        setBackfilling(null);
        await loadStatus();
        return;
      }

      const started = Date.now();
      while (Date.now() - started < 90_000) {
        await new Promise((r) => window.setTimeout(r, 2_000));
        const next = await loadStatus();
        if (!next) break;
        const missing =
          type === 'kb' ? next.kb.missingIndexArticles : next.tickets.missingIndexTickets;
        const depth = next.queueDepth ?? 0;
        const completed = Math.max(enqueued - missing, 0);
        const failure =
          next.embeddingError ||
          next.recentFailures?.find((f) => f.lastError)?.lastError ||
          null;
        const unreachable =
          failure &&
          /unreachable|timeout|ECONNREFUSED|nicht erreichbar|port 8080|no embedding provider/i.test(
            failure,
          );

        setIndexProgress({
          type,
          enqueued,
          completed,
          queueDepth: depth,
          missing,
          error: unreachable ? failure : null,
          message:
            missing === 0
              ? '✓ Alle Artikel synchronisiert'
              : `⏳ Indexierung läuft... (${completed}/${enqueued} in Bearbeitung)`,
        });

        if (unreachable) {
          setIndexError(
            'Embedding-Endpunkt nicht erreichbar. Bitte Modell-Server (Port 8080) oder API-Key prüfen.',
          );
          // Mock fallback may still complete jobs — keep polling briefly, but surface the warning.
        }

        if (missing === 0) break;
        // Queue drained but items still missing → jobs failed without indexing.
        if (depth === 0 && missing > 0 && Date.now() - started > 8_000) {
          setIndexError(
            failure ||
              'Embedding-Endpunkt nicht erreichbar. Bitte Modell-Server (Port 8080) oder API-Key prüfen.',
          );
          break;
        }
      }
      await loadStatus();
    } catch (err) {
      console.warn(`RAG index-pending (${type}) failed`, err);
      setIndexError(
        'Embedding-Endpunkt nicht erreichbar. Bitte Modell-Server (Port 8080) oder API-Key prüfen.',
      );
      setIndexProgress({
        type,
        enqueued: 0,
        completed: 0,
        queueDepth: 0,
        missing: 0,
        message: 'Indexierung fehlgeschlagen.',
        error: 'failed',
      });
    } finally {
      setBackfilling(null);
    }
  };

  const createSource = async () => {
    if (!form.name.trim()) {
      console.warn('Source name required');
      return;
    }
    setSavingSource(true);
    try {
      await kbDocumentsApi.createSource({
        type: form.type,
        name: form.name.trim(),
        basePath: form.type === 'local_dir' || form.type === 'sftp' ? form.basePath.trim() : undefined,
        host: form.type === 'sftp' ? form.host.trim() : undefined,
        port: form.type === 'sftp' ? Number(form.port) || 22 : undefined,
        username: form.type === 'sftp' ? form.username.trim() : undefined,
        authMode: form.type === 'sftp' ? form.authMode : undefined,
        folderId: form.type === 'sharepoint' || form.type === 'onedrive' ? form.folderId.trim() : undefined,
        clientId: form.type === 'sharepoint' || form.type === 'onedrive' ? form.clientId.trim() : undefined,
        azureTenantId: form.type === 'sharepoint' || form.type === 'onedrive' ? form.azureTenantId.trim() : undefined,
        secret:
          form.type === 'sftp' || form.type === 'sharepoint' || form.type === 'onedrive'
            ? form.secret
            : undefined,
        enabled: true,
      });
      setAddOpen(false);
      setForm({
        type: 'local_dir',
        name: '',
        basePath: '',
        host: '',
        port: '22',
        username: '',
        authMode: 'password',
        folderId: '',
        clientId: '',
        azureTenantId: '',
        secret: '',
      });
      await loadSources();
    } catch (err) {
      console.warn('Failed to create source', err);
    } finally {
      setSavingSource(false);
    }
  };

  const toggleSource = async (source: KbExternalSource, enabled: boolean) => {
    try {
      await kbDocumentsApi.patchSource(source.id, { enabled });
      setSources((prev) => prev.map((s) => (s.id === source.id ? { ...s, enabled } : s)));
    } catch (err) {
      console.warn('Failed to toggle source', err);
    }
  };

  const runSync = async (sourceId?: string) => {
    const target = sourceId || null;
    setSyncingId(target ?? 'all');
    try {
      await kbDocumentsApi.syncSource(target ?? undefined);
      if (target) {
        setSources((prev) =>
          prev.map((s) => (s.id === target ? { ...s, status: 'syncing' } : s)),
        );
      }
      window.setTimeout(() => void loadSources(), 2500);
    } catch (err) {
      console.warn('Sync enqueue failed', err);
    } finally {
      setSyncingId(null);
    }
  };

  const removeSource = async (id: string) => {
    try {
      await kbDocumentsApi.deleteSource(id);
      setSources((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.warn('Failed to delete source', err);
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
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Automatische Indexierung
            </p>
            <ConfigToggle
              label="Gelöste Tickets indexieren"
              hint="Lösungen gelöster Tickets automatisch in die Wissensbasis aufnehmen."
              checked={indexResolvedTickets}
              onChange={setIndexResolvedTickets}
            />
            <ConfigToggle
              label="Neue Artikel indexieren"
              hint="Neue Wissensdatenbank-Artikel automatisch in den RAG-Speicher aufnehmen."
              checked={indexNewKbArticles}
              onChange={setIndexNewKbArticles}
            />
            <ConfigToggle
              label="Semantische Duplikaterkennung"
              hint="Beim Erstellen vor inhaltlich ähnlichen Artikeln oder Lösungen warnen."
              checked={detectDuplicates}
              onChange={setDetectDuplicates}
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

      {indexError || status?.embeddingError ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2"
          role="alert"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-bold">
              {indexError ||
                'Embedding-Endpunkt nicht erreichbar. Bitte Modell-Server (Port 8080) oder API-Key prüfen.'}
            </p>
            {status?.embeddingError && indexError !== status.embeddingError ? (
              <p className="text-[11px] text-amber-800/80 mt-1 break-words">{status.embeddingError}</p>
            ) : null}
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
            kind="kb"
            onIndexPending={() => void runIndexPending('kb')}
            backfilling={backfilling === 'kb'}
            progress={indexProgress?.type === 'kb' ? indexProgress : null}
          />
          <StatusCard
            title={t('admin.rag.ticketsTitle', 'Gelöste Tickets')}
            total={tickets?.totalResolvedClosed ?? 0}
            indexed={tickets?.indexedTickets ?? 0}
            chunks={tickets?.indexedChunks ?? 0}
            missing={tickets?.missingIndexTickets ?? 0}
            kind="ticket"
            onIndexPending={() => void runIndexPending('ticket')}
            backfilling={backfilling === 'ticket'}
            progress={indexProgress?.type === 'ticket' ? indexProgress : null}
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
              {hits.length} Treffer (cosine ≥ 0.65) — Workspace-{status?.tenantId || 'default'} (
              <span className="font-semibold text-emerald-600">tenant-isoliert</span>)
            </p>
            {hits.length === 0 ? (
              <p className="text-[11px] text-slate-400">Keine Treffer.</p>
            ) : (
              hits.map((hit, i) => (
                <div key={hit.id || i} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 truncate">
                      {hit.title || hit.sourceId || 'Untitled'}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {typeof hit.similarityScore === 'number' ? (
                        <Badge className="text-[10px] font-bold bg-emerald-50 text-emerald-700">
                          {(hit.similarityScore * 100).toFixed(1)}%
                        </Badge>
                      ) : null}
                      <Badge className="text-[10px] font-bold uppercase">
                        {hit.sourceType === 'RESOLVED_TICKET' || hit.sourceType === 'resolved_ticket'
                          ? 'Ticket'
                          : 'KB'}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                    {String(hit.content || hit.chunkContent || '').slice(0, 220)}
                  </p>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>

      {/* Verknüpfte Datenquellen (external connectors) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-indigo-600" />
            <div>
              <h3 className="text-xs font-black text-slate-800">
                {t('admin.rag.sourcesTitle', 'Verknüpfte Datenquellen')}
              </h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                NAS-Ordner, SFTP, SharePoint & OneDrive — Delta-Hash-Sync in die KI-Wissensbasis
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void runSync()} disabled={syncingId !== null}>
              {syncingId === 'all' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              Alle synchronisieren
            </Button>
            <Button size="sm" onClick={() => setAddOpen((v) => !v)}>
              <Plus className="w-3.5 h-3.5" />
              Quelle hinzufügen
            </Button>
          </div>
        </div>

        {/* Add-connector form */}
        {addOpen ? (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400">Typ</label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      type: e.target.value as 'local_dir' | 'sftp' | 'sharepoint' | 'onedrive',
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="local_dir">Lokales Verzeichnis / NAS</option>
                  <option value="sftp">SFTP / SFTP-Server</option>
                  <option value="sharepoint">SharePoint</option>
                  <option value="onedrive">OneDrive</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400">Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="z. B. Handbuch-Server"
                  className="mt-1"
                />
              </div>
              {form.type === 'local_dir' ? (
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold uppercase text-slate-400">
                    Basis-Ordner (relativ zu /data/sources/)
                  </label>
                  <Input
                    value={form.basePath}
                    onChange={(e) => setForm((f) => ({ ...f, basePath: e.target.value }))}
                    placeholder="handbuecher/produkt-x"
                    className="mt-1 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Wird im Sandbox-Pfad <code className="font-mono">/data/sources/…</code> aufgelöst —
                    Pfad-Traversal ist blockiert.
                  </p>
                </div>
              ) : form.type === 'sftp' ? (
                <>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Host</label>
                    <Input
                      value={form.host}
                      onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                      placeholder="sftp.example.com"
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Port</label>
                    <Input
                      type="number"
                      min={1}
                      max={65535}
                      value={form.port}
                      onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                      placeholder="22"
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Benutzername</label>
                    <Input
                      value={form.username}
                      onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                      placeholder="deploy"
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Authentifizierung</label>
                    <select
                      value={form.authMode}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          authMode: e.target.value as 'password' | 'privateKey',
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="password">Passwort</option>
                      <option value="privateKey">Privater SSH-Schlüssel</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Basis-Pfad</label>
                    <Input
                      value={form.basePath}
                      onChange={(e) => setForm((f) => ({ ...f, basePath: e.target.value }))}
                      placeholder="/mnt/docs"
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">
                      {form.authMode === 'privateKey' ? 'Privater Schlüssel' : 'Passwort'}
                    </label>
                    <Input
                      type="password"
                      value={form.secret}
                      onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))}
                      placeholder={form.authMode === 'privateKey' ? '-----BEGIN OPENSSH PRIVATE KEY-----' : 'Wird via GeistVault verschlüsselt'}
                      className="mt-1 font-mono"
                    />
                  </div>
                  <p className="md:col-span-2 text-[10px] text-slate-400 flex items-center gap-1">
                    <KeyRound className="w-3 h-3" />
                    SFTP über SSH — unterstützt Passwort- und Private-Key-Authentifizierung. Zugangsdaten
                    werden via GeistVault verschlüsselt gespeichert.
                  </p>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">
                      Ordner-ID / Drive-ID
                    </label>
                    <Input
                      value={form.folderId}
                      onChange={(e) => setForm((f) => ({ ...f, folderId: e.target.value }))}
                      placeholder="0123456789abcdef"
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Client ID</label>
                    <Input
                      value={form.clientId}
                      onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                      placeholder="Client-ID der Entra-App"
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Tenant ID</label>
                    <Input
                      value={form.azureTenantId}
                      onChange={(e) => setForm((f) => ({ ...f, azureTenantId: e.target.value }))}
                      placeholder="Azure-Tenant-ID"
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">
                      Client Secret
                    </label>
                    <Input
                      type="password"
                      value={form.secret}
                      onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))}
                      placeholder="Wird via GeistVault verschlüsselt"
                      className="mt-1 font-mono"
                    />
                  </div>
                  <p className="md:col-span-2 text-[10px] text-slate-400 flex items-center gap-1">
                    <KeyRound className="w-3 h-3" />
                    Erfordert eine Entra-App-Registrierung mit <b>Files.Read.All</b> /{' '}
                    <b>Sites.Read.All</b> und Admin-Zustimmung.
                  </p>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void createSource()} disabled={savingSource}>
                {savingSource ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Quelle anlegen
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAddOpen(false)}>
                Abbrechen
              </Button>
            </div>
          </div>
        ) : null}

        {/* Connector list */}
        {sourcesLoading ? (
          <div className="flex items-center gap-2 text-slate-400 text-xs py-4">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Lade Quellen…
          </div>
        ) : sources.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
            <HardDrive className="w-6 h-6 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">Noch keine externen Quellen</p>
            <p className="text-[10px] text-slate-400 mt-1">
              Verknüpfen Sie ein NAS-Verzeichnis oder SharePoint/OneDrive, um Dateien automatisch in die Wissensbasis zu indexieren.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
            {sources.map((source) => (
              <div key={source.id} className="flex items-center gap-3 px-4 py-3 bg-white">
                <span
                  className={cn(
                    'shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center',
                    source.type === 'local_dir'
                      ? 'bg-blue-50 border-blue-100 text-blue-600'
                      : source.type === 'sftp'
                        ? 'bg-violet-50 border-violet-100 text-violet-600'
                        : source.type === 'sharepoint'
                          ? 'bg-amber-50 border-amber-100 text-amber-600'
                          : 'bg-emerald-50 border-emerald-100 text-emerald-600',
                  )}
                >
                  {source.type === 'local_dir' ? (
                    <HardDrive className="w-4 h-4" />
                  ) : source.type === 'sftp' ? (
                    <Server className="w-4 h-4" />
                  ) : source.type === 'sharepoint' ? (
                    <Share2 className="w-4 h-4" />
                  ) : (
                    <Cloud className="w-4 h-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-slate-800 truncate">{source.name}</p>
                    <Badge className="text-[9px] font-black uppercase border-none">
                      {source.type === 'local_dir'
                        ? 'NAS / Lokal'
                        : source.type === 'sftp'
                          ? 'SFTP'
                          : source.type === 'sharepoint'
                            ? 'SharePoint'
                            : 'OneDrive'}
                    </Badge>
                    {source.status === 'syncing' ? (
                      <Badge className="text-[9px] font-black uppercase border-none bg-amber-50 text-amber-700">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Sync läuft
                      </Badge>
                    ) : source.status === 'error' ? (
                      <Badge className="text-[9px] font-black uppercase border-none bg-rose-50 text-rose-700">
                        <AlertTriangle className="w-2.5 h-2.5" /> Fehler
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium truncate">
                    {source.type === 'local_dir'
                      ? `/data/sources/${source.basePath || ''}`
                      : source.type === 'sftp'
                        ? `${source.username || ''}@${source.host || '?'}:${source.basePath || '/'}`
                        : source.folderId || 'Stammordner'}
                    {source.lastSyncedAt
                      ? ` · zuletzt ${new Date(source.lastSyncedAt).toLocaleString()}`
                      : ''}
                  </p>
                  {source.lastSyncSummary ? (
                    <p className="text-[9px] text-slate-400">
                      +{source.lastSyncSummary.added} neu · {source.lastSyncSummary.updated} aktualisiert ·{' '}
                      {source.lastSyncSummary.unchanged} unverändert
                      {source.lastSyncSummary.failed > 0 ? ` · ${source.lastSyncSummary.failed} fehlgeschlagen` : ''}
                    </p>
                  ) : null}
                  {source.lastError ? (
                    <p className="text-[9px] text-rose-500 truncate max-w-md" title={source.lastError}>
                      {source.lastError}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Switch
                    checked={source.enabled}
                    onCheckedChange={(checked) => void toggleSource(source, checked)}
                    aria-label={`Aktivieren: ${source.name}`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] font-bold rounded-lg"
                    onClick={() => void runSync(source.id)}
                    disabled={syncingId !== null}
                  >
                    {syncingId === source.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    Sync
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    onClick={() => void removeSource(source.id)}
                    aria-label={`Löschen: ${source.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
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
  kind,
  onIndexPending,
  backfilling,
  progress,
}: {
  title: string;
  total: number;
  indexed: number;
  chunks: number;
  missing: number;
  kind: 'kb' | 'ticket';
  onIndexPending: () => void;
  backfilling: boolean;
  progress: IndexProgress | null;
}) {
  const syncedLabel =
    kind === 'kb' ? '✓ Alle Artikel synchronisiert' : '✓ Alle Tickets synchronisiert';
  const actionLabel =
    missing === 0 && !backfilling
      ? syncedLabel
      : backfilling
        ? `⏳ Indexierung läuft... (${progress?.completed ?? 0}/${progress?.enqueued || missing} in Bearbeitung)`
        : `⚡ Jetzt in RAG indexieren (${missing} ausstehend)`;

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
      <Button
        variant={missing === 0 && !backfilling ? 'secondary' : 'outline'}
        size="sm"
        className="w-full"
        onClick={onIndexPending}
        disabled={backfilling || missing === 0}
      >
        {backfilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        {actionLabel}
      </Button>
      {progress?.message ? (
        <p className="text-[11px] text-slate-500 font-medium" aria-live="polite">
          {progress.message}
          {backfilling && progress.queueDepth > 0 ? ` · Queue ${progress.queueDepth}` : ''}
        </p>
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

function ConfigToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
      <div className="flex flex-col">
        <span className="text-xs font-bold text-slate-800">{label}</span>
        <span className="text-[10px] text-slate-500 mt-0.5">{hint}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
