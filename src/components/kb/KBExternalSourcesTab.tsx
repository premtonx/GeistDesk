/**
 * GeistKB — "Verknüpfte Datenquellen" tab.
 * Lists external connectors (NAS local dir, SFTP, SharePoint, OneDrive) with
 * delta-hash sync. Mirrors the admin-hub panel but is role-gated to read + sync.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Play,
  HardDrive,
  Share2,
  Cloud,
  FolderTree,
  AlertTriangle,
  Server,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { kbDocumentsApi, type KbExternalSource } from '../../services/kbDocumentsApi';
import { useTranslation } from '../../lib/context/I18nContext';

function sourceMeta(source: KbExternalSource) {
  switch (source.type) {
    case 'local_dir':
      return { icon: HardDrive, label: 'NAS / Lokal', iconClass: 'bg-blue-50 border-blue-100 text-blue-600' };
    case 'sftp':
      return { icon: Server, label: 'SFTP', iconClass: 'bg-violet-50 border-violet-100 text-violet-600' };
    case 'sharepoint':
      return { icon: Share2, label: 'SharePoint', iconClass: 'bg-amber-50 border-amber-100 text-amber-600' };
    case 'onedrive':
      return { icon: Cloud, label: 'OneDrive', iconClass: 'bg-emerald-50 border-emerald-100 text-emerald-600' };
  }
}

export function KBExternalSourcesTab() {
  const { t } = useTranslation();
  const [sources, setSources] = useState<KbExternalSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const loadSources = useCallback(async () => {
    try {
      const list = await kbDocumentsApi.listSources();
      setSources(list);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Quellen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const runSync = async (sourceId?: string) => {
    const target = sourceId || null;
    setSyncingId(target ?? 'all');
    try {
      await kbDocumentsApi.syncSource(target ?? undefined);
      toast.success(target ? 'Sync gestartet.' : 'Alle Quellen werden synchronisiert.');
      window.setTimeout(() => void loadSources(), 2500);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Sync konnte nicht gestartet werden.');
    } finally {
      setSyncingId(null);
    }
  };

  const toggleSource = async (source: KbExternalSource, enabled: boolean) => {
    try {
      await kbDocumentsApi.patchSource(source.id, { enabled });
      setSources((prev) => prev.map((s) => (s.id === source.id ? { ...s, enabled } : s)));
      toast.success(enabled ? `Quelle "${source.name}" aktiviert.` : `Quelle "${source.name}" deaktiviert.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Umschalten fehlgeschlagen.');
    }
  };

  const sourcePath = (source: KbExternalSource) => {
    switch (source.type) {
      case 'local_dir':
        return `/data/sources/${source.basePath || ''}`;
      case 'sftp':
        return `${source.username || ''}@${source.host || '?'}:${source.basePath || '/'}`;
      default:
        return source.folderId || 'Stammordner';
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-indigo-600" />
            <div>
              <h3 className="text-xs font-black text-slate-800">
                {t('kb.sourcesTitle', 'Verknüpfte Datenquellen')}
              </h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                NAS-Ordner, SFTP, SharePoint &amp; OneDrive — Delta-Hash-Sync in die KI-Wissensbasis
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void runSync()}
            disabled={syncingId !== null}
          >
            {syncingId === 'all' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            Alle synchronisieren
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-xs py-4">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Lade Quellen…
          </div>
        ) : sources.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
            <HardDrive className="w-6 h-6 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">Noch keine externen Quellen</p>
            <p className="text-[10px] text-slate-400 mt-1">
              Verknüpfen Sie ein NAS-Verzeichnis, einen SFTP-Server oder SharePoint/OneDrive im Admin Hub →
              RAG &amp; Wissensbasis → Verknüpfte Datenquellen.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
            {sources.map((source) => {
              const meta = sourceMeta(source);
              const Icon = meta.icon;
              return (
                <div key={source.id} className="flex items-center gap-3 px-4 py-3 bg-white">
                  <span
                    className={cn(
                      'shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center',
                      meta.iconClass,
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-800 truncate">{source.name}</p>
                      <Badge className="text-[9px] font-black uppercase border-none">{meta.label}</Badge>
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
                    <p className="text-[10px] text-slate-400 font-medium truncate font-mono">
                      {sourcePath(source)}
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
                        <RefreshCw className="w-3 h-3" />
                      )}
                      Sync
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="flex items-center gap-1.5 text-[10px] text-slate-400">
          {sources.length > 0 ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          ) : (
            <XCircle className="w-3 h-3 text-slate-300" />
          )}
          Quellen werden nur im Admin Hub (RAG &amp; Wissensbasis) angelegt und verwaltet.
        </p>
      </div>
    </div>
  );
}
