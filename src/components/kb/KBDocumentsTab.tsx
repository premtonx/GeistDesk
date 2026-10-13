/**
 * GeistKB — "Dokumente" tab.
 * Drag-and-drop upload zone (async 202 → status polling) + document list with
 * status pills, per-document RAG toggle and delete (confirm dialog).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { UploadCloud, FileText, Trash2, Loader2, AlertTriangle, FileWarning, RefreshCw, Sparkles, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Switch } from '../../components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import {
  kbDocumentsApi,
  type KbDocumentRecord,
  type KbDocumentStatus,
} from '../../services/kbDocumentsApi';

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.csv'];

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

const STATUS_META: Record<
  KbDocumentStatus,
  { label: string; className: string; icon?: 'spin' | 'warn' | 'alert' }
> = {
  queued: { label: 'Warteschlange', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  processing: {
    label: 'Verarbeitung',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: 'spin',
  },
  indexed: { label: 'Indexiert', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  error: { label: 'Fehler', className: 'bg-rose-50 text-rose-700 border-rose-200', icon: 'alert' },
  no_text: {
    label: 'Kein Text',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: 'warn',
  },
};

export function KBDocumentsTab() {
  const [documents, setDocuments] = useState<KbDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [dragOver, setDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<KbDocumentRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await kbDocumentsApi.list();
      setDocuments(docs);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load documents';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  // Poll while any document is still processing.
  useEffect(() => {
    const hasProcessing = documents.some(
      (d) => d.status === 'queued' || d.status === 'processing',
    );
    if (!hasProcessing) return;
    const timer = window.setInterval(() => void loadDocuments(), 5000);
    return () => window.clearInterval(timer);
  }, [documents, loadDocuments]);

  const uploadFiles = async (files: FileList | File[]) => {
    const allowed = Array.from(files).filter((file) => {
      const ext = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '';
      return ALLOWED_EXTENSIONS.includes(ext);
    });
    const rejected = Array.from(files).length - allowed.length;
    if (rejected > 0) {
      toast.warning(
        `${rejected} Datei(en) übersprungen — erlaubt sind ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }
    if (allowed.length === 0) return;

    setUploading(true);
    let uploaded = 0;
    for (const file of allowed) {
      try {
        await kbDocumentsApi.upload(file, (percent) => {
          setUploadProgress((prev) => ({ ...prev, [file.name]: percent }));
        });
        uploaded += 1;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : `Upload fehlgeschlagen: ${file.name}`;
        toast.error(message);
      }
    }
    setUploading(false);
    setUploadProgress({});
    if (uploaded > 0) {
      toast.success(
        `${uploaded} Dokument(e) in die Warteschlange eingereiht — Verarbeitung läuft im Hintergrund.`,
      );
      await loadDocuments();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) void uploadFiles(files);
  };

  const toggleRag = async (doc: KbDocumentRecord, checked: boolean) => {
    try {
      await kbDocumentsApi.toggleRag(doc.id, checked);
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, index_in_rag: checked } : d)),
      );
      toast.success(
        checked
          ? 'Dokument wird wieder in den KI-Wissensspeicher aufgenommen.'
          : 'Dokument aus dem KI-Wissensspeicher entfernt (Vektoren gelöscht).',
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Toggle fehlgeschlagen');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await kbDocumentsApi.remove(deleteTarget.id);
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      toast.success('Dokument gelöscht — Datei und Vektoren entfernt.');
      setDeleteTarget(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    } finally {
      setDeleting(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadDocuments();
    } finally {
      setRefreshing(false);
    }
  };

  const hasProcessing = documents.some(
    (d) => d.status === 'queued' || d.status === 'processing',
  );

  return (
    <div className="space-y-5">
      {/* Upload zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-white',
          dragOver
            ? 'border-indigo-400 bg-indigo-50/60'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50/50',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              void uploadFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
        <UploadCloud className="w-10 h-10 text-slate-400 mb-3" />
        <p className="text-sm font-bold text-slate-800">
          Dokumente hierher ziehen oder klicken zum Hochladen
        </p>
        <p className="text-[11px] text-slate-500 mt-1 font-medium">
          {ALLOWED_EXTENSIONS.join(' · ')} — max. 25 MB pro Datei
        </p>
        {uploading ? (
          <div className="w-full max-w-sm mt-4 space-y-2">
            {Object.entries(uploadProgress).map(([name, percent]) => (
              <div key={name} className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold text-slate-500">
                  <span className="truncate max-w-[70%]">{name}</span>
                  <span>{percent}%</span>
                </div>
                <Progress value={percent} className="h-1.5" />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* List header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
            Dokumente
          </h3>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {documents.length}
          </span>
          {hasProcessing ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              <Loader2 className="w-3 h-3 animate-spin" />
              Verarbeitung läuft…
            </span>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[10px] font-bold rounded-lg"
          onClick={refresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          Aktualisieren
        </Button>
      </div>

      {/* Document table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Lade Dokumente…
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-600">Noch keine Dokumente</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Laden Sie eine PDF, DOCX, TXT, MD oder CSV hoch — sie wird automatisch
            für den KI-Copiloten indexiert.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-400 font-black">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5 w-24">Größe</th>
                <th className="px-4 py-2.5 w-28">Chunks / Seiten</th>
                <th className="px-4 py-2.5 w-32">Status</th>
                <th className="px-4 py-2.5 w-32">Hochgeladen</th>
                <th className="px-4 py-2.5 w-24">In RAG</th>
                <th className="px-4 py-2.5 w-16 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const meta = STATUS_META[doc.status] || STATUS_META.queued;
                return (
                  <tr
                    key={doc.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="shrink-0 w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                          <FileText className="w-4 h-4 text-indigo-500" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-700 truncate max-w-[260px]">
                            {doc.filename}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {doc.source === 'external' ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-px rounded">
                                <HardDrive className="w-2.5 h-2.5" />
                                Extern
                              </span>
                            ) : null}
                            {doc.sourcePath ? (
                              <span className="text-[9px] text-slate-400 font-medium truncate max-w-[180px]">
                                {doc.sourcePath}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-semibold">
                      {formatBytes(doc.size)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-semibold">
                      {doc.status === 'indexed' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <Sparkles className="w-3 h-3" />
                          {doc.chunkCount} Chunks
                          {doc.pages ? ` · ${doc.pages} S.` : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wide',
                          meta.className,
                        )}
                      >
                        {meta.icon === 'spin' ? (
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        ) : meta.icon === 'alert' ? (
                          <AlertTriangle className="w-2.5 h-2.5" />
                        ) : meta.icon === 'warn' ? (
                          <FileWarning className="w-2.5 h-2.5" />
                        ) : null}
                        {meta.label}
                      </span>
                      {doc.status === 'error' && doc.error ? (
                        <span
                          className="block text-[9px] text-rose-400 mt-0.5 truncate max-w-[140px]"
                          title={doc.error}
                        >
                          {doc.error}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-medium">
                      {formatDate(doc.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={doc.index_in_rag}
                        onCheckedChange={(checked) => void toggleRag(doc, checked)}
                        aria-label={`In RAG aufnehmen: ${doc.filename}`}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        onClick={() => setDeleteTarget(doc)}
                        aria-label={`Löschen: ${doc.filename}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-500" />
              Dokument löschen?
            </DialogTitle>
            <DialogDescription>
              <b className="text-slate-800">{deleteTarget?.filename}</b> wird endgültig
              gelöscht — die Rohdatei und alle zugehörigen KI-Vektoren werden entfernt.
              Dieser Vorgang kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              Abbrechen
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => void confirmDelete()}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
