/**
 * Admin Hub — Data Import & Migration (CSV / JSON bulk + single-entry quick-add).
 */

import { useCallback, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import axios from 'axios';
import Papa from 'papaparse';
import {
  UploadCloud,
  FileSpreadsheet,
  FileJson,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Ticket,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminBreadcrumbs } from '../AdminBreadcrumbs';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { cn } from '../../lib/utils';

type ImportKind = 'tickets' | 'kb';

type ImportApiResult = {
  success?: boolean;
  successCount: number;
  errorCount: number;
  errors: string[];
  enqueuedVectors?: number;
  tenantId?: string;
  error?: string;
};

const TICKET_FIELDS = [
  { id: 'subject', label: 'Subject', required: true },
  { id: 'body', label: 'Body / Description', required: false },
  { id: 'html_content', label: 'HTML Content', required: false },
  { id: 'sender_email', label: 'Sender Email', required: false },
  { id: 'status', label: 'Status', required: false },
  { id: 'created_at', label: 'Created At', required: false },
  { id: 'tags', label: 'Tags', required: false },
  { id: 'priority', label: 'Priority', required: false },
  { id: 'customer_name', label: 'Customer Name', required: false },
] as const;

const KB_FIELDS = [
  { id: 'title', label: 'Title', required: true },
  { id: 'content', label: 'Content', required: true },
  { id: 'category', label: 'Category', required: false },
  { id: 'status', label: 'Status (PUBLISHED | DRAFT)', required: false },
  { id: 'tags', label: 'Tags', required: false },
] as const;

const TICKET_ALIASES: Record<string, string> = {
  subject: 'subject',
  ticket_subject: 'subject',
  title: 'subject',
  body: 'body',
  description: 'body',
  content: 'body',
  html_content: 'html_content',
  html: 'html_content',
  sender_email: 'sender_email',
  email: 'sender_email',
  customer_email: 'sender_email',
  from: 'sender_email',
  status: 'status',
  created_at: 'created_at',
  created: 'created_at',
  tags: 'tags',
  labels: 'tags',
  priority: 'priority',
  customer_name: 'customer_name',
  customer: 'customer_name',
};

const KB_ALIASES: Record<string, string> = {
  title: 'title',
  article_title: 'title',
  content: 'content',
  body: 'content',
  article_body: 'content',
  html_content: 'content',
  category: 'category',
  status: 'status',
  tags: 'tags',
  labels: 'tags',
};

function normalizeHeader(h: string): string {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function guessMappings(headers: string[], kind: ImportKind): Record<string, string> {
  const aliases = kind === 'tickets' ? TICKET_ALIASES : KB_ALIASES;
  const map: Record<string, string> = {};
  for (const header of headers) {
    const canonical = aliases[normalizeHeader(header)];
    map[header] = canonical || '__skip__';
  }
  return map;
}

export default function AdminImportPage() {
  const [mainTab, setMainTab] = useState('bulk');
  const [kind, setKind] = useState<ImportKind>('tickets');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<'idle' | 'ready' | 'uploading' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportApiResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick-add forms
  const [ticketForm, setTicketForm] = useState({
    subject: '',
    body: '',
    sender_email: '',
    status: 'OPEN',
    tags: '',
  });
  const [kbForm, setKbForm] = useState({
    title: '',
    content: '',
    category: 'General',
    status: 'PUBLISHED',
    tags: '',
  });
  const [quickBusy, setQuickBusy] = useState(false);

  const canonicalFields = kind === 'tickets' ? TICKET_FIELDS : KB_FIELDS;

  const resetFileState = useCallback(() => {
    setFile(null);
    setHeaders([]);
    setRowCount(0);
    setMappings({});
    setPhase('idle');
    setProgress(0);
    setResult(null);
  }, []);

  const loadFile = useCallback(
    (next: File) => {
      const ext = next.name.split('.').pop()?.toLowerCase();
      if (ext !== 'csv' && ext !== 'json') {
        toast.error('Only .csv or .json files are supported');
        return;
      }

      setFile(next);
      setResult(null);
      setProgress(0);
      setPhase('idle');

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result || '').replace(/^\uFEFF/, '');
          if (ext === 'json') {
            const parsed = JSON.parse(text);
            const records = Array.isArray(parsed)
              ? parsed
              : Array.isArray(parsed?.records)
                ? parsed.records
                : Array.isArray(parsed?.data)
                  ? parsed.data
                  : [parsed];
            const hdrs = records[0] ? Object.keys(records[0]) : [];
            setHeaders(hdrs);
            setRowCount(records.length);
            setMappings(guessMappings(hdrs, kind));
            setPhase('ready');
            return;
          }

          Papa.parse<Record<string, unknown>>(text, {
            header: true,
            skipEmptyLines: true,
            complete: (res) => {
              const hdrs = (res.meta.fields || []).filter(Boolean) as string[];
              setHeaders(hdrs);
              setRowCount(res.data.length);
              setMappings(guessMappings(hdrs, kind));
              setPhase('ready');
            },
            error: (err) => {
              toast.error(err.message || 'Failed to parse CSV');
              resetFileState();
            },
          });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to read file');
          resetFileState();
        }
      };
      reader.readAsText(next);
    },
    [kind, resetFileState],
  );

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) loadFile(f);
  };

  const mappingPayload = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [source, target] of Object.entries(mappings)) {
      if (target && target !== '__skip__') out[source] = target;
    }
    return out;
  }, [mappings]);

  const runImport = async () => {
    if (!file) {
      toast.error('Choose a CSV or JSON file first');
      return;
    }
    const required = canonicalFields.filter((f) => f.required).map((f) => f.id);
    const mappedTargets = new Set(Object.values(mappingPayload));
    const missing = required.filter((id) => !mappedTargets.has(id));
    if (missing.length) {
      toast.error(`Map required fields: ${missing.join(', ')}`);
      return;
    }

    setPhase('uploading');
    setProgress(12);
    setResult(null);

    const form = new FormData();
    form.append('file', file);
    form.append('fieldMapping', JSON.stringify(mappingPayload));

    const endpoint =
      kind === 'tickets' ? '/api/admin/import/tickets' : '/api/admin/import/kb';

    const progressTimer = window.setInterval(() => {
      setProgress((p) => (p >= 88 ? p : p + 4));
    }, 180);

    try {
      const res = await axios.post<ImportApiResult>(endpoint, form, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      window.clearInterval(progressTimer);
      setProgress(100);
      setResult(res.data);
      setPhase('done');

      const msg = `Imported ${res.data.successCount} row(s)` +
        (res.data.enqueuedVectors
          ? ` · ${res.data.enqueuedVectors} queued for RAG embeddings`
          : '');
      if (res.data.errorCount > 0) toast.warning(msg);
      else toast.success(msg);
    } catch (err: unknown) {
      window.clearInterval(progressTimer);
      setPhase('ready');
      setProgress(0);
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? String(err.response.data.error)
          : err instanceof Error
            ? err.message
            : 'Import failed';
      toast.error(message);
      setResult({
        successCount: 0,
        errorCount: 1,
        errors: [message],
      });
    } finally {
      window.clearInterval(progressTimer);
    }
  };

  const submitQuickTicket = async (e: FormEvent) => {
    e.preventDefault();
    if (!ticketForm.subject.trim()) {
      toast.error('Subject is required');
      return;
    }
    setQuickBusy(true);
    try {
      const res = await axios.post<ImportApiResult>(
        '/api/admin/import/tickets',
        {
          records: [
            {
              subject: ticketForm.subject,
              body: ticketForm.body,
              sender_email: ticketForm.sender_email,
              status: ticketForm.status,
              tags: ticketForm.tags,
            },
          ],
        },
        { withCredentials: true },
      );
      toast.success(
        `Ticket imported` +
          (res.data.enqueuedVectors ? ` · RAG index queued` : ''),
      );
      setTicketForm({ subject: '', body: '', sender_email: '', status: 'OPEN', tags: '' });
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? String(err.response.data.error)
          : 'Quick-add failed';
      toast.error(message);
    } finally {
      setQuickBusy(false);
    }
  };

  const submitQuickKb = async (e: FormEvent) => {
    e.preventDefault();
    if (!kbForm.title.trim() || !kbForm.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setQuickBusy(true);
    try {
      const res = await axios.post<ImportApiResult>(
        '/api/admin/import/kb',
        {
          records: [
            {
              title: kbForm.title,
              content: kbForm.content,
              category: kbForm.category,
              status: kbForm.status,
              tags: kbForm.tags,
            },
          ],
        },
        { withCredentials: true },
      );
      toast.success(
        `KB article imported` +
          (res.data.enqueuedVectors ? ` · RAG index queued` : ''),
      );
      setKbForm({ title: '', content: '', category: 'General', status: 'PUBLISHED', tags: '' });
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? String(err.response.data.error)
          : 'Quick-add failed';
      toast.error(message);
    } finally {
      setQuickBusy(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#fafafa]">
      <div className="p-8 max-w-5xl mx-auto pb-24">
        <AdminBreadcrumbs />

        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">
              Data Import & Migration
            </h1>
            <p className="text-slate-500 text-sm mt-1 max-w-xl">
              Bulk-import legacy tickets and GeistKB articles from CSV/JSON, or add single entries.
              Resolved tickets and published articles are queued for pgvector RAG automatically.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/tickets_import_template.csv"
              download="tickets_import_template.csv"
              className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium hover:bg-slate-50"
            >
              <Download className="w-4 h-4 mr-2" /> Tickets template
            </a>
            <a
              href="/kb_import_template.csv"
              download="kb_import_template.csv"
              className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium hover:bg-slate-50"
            >
              <Download className="w-4 h-4 mr-2" /> KB template
            </a>
          </div>
        </div>

        <Tabs
          value={mainTab}
          onValueChange={(v) => setMainTab(String(v))}
          className="w-full"
        >
          <TabsList className="bg-white border border-slate-200 p-1 rounded-2xl mb-6 h-auto">
            <TabsTrigger
              value="bulk"
              className="rounded-xl font-bold px-5 py-2 data-active:bg-slate-900 data-active:text-white"
            >
              Bulk CSV / JSON Import
            </TabsTrigger>
            <TabsTrigger
              value="quick"
              className="rounded-xl font-bold px-5 py-2 data-active:bg-slate-900 data-active:text-white"
            >
              Single Entry Quick-Add
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bulk" className="space-y-6">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={kind === 'tickets' ? 'default' : 'outline'}
                className="rounded-xl"
                onClick={() => {
                  setKind('tickets');
                  resetFileState();
                }}
              >
                <Ticket className="w-4 h-4 mr-2" /> Tickets
              </Button>
              <Button
                type="button"
                variant={kind === 'kb' ? 'default' : 'outline'}
                className="rounded-xl"
                onClick={() => {
                  setKind('kb');
                  resetFileState();
                }}
              >
                <BookOpen className="w-4 h-4 mr-2" /> GeistKB
              </Button>
            </div>

            <Card className="rounded-[1.75rem] border-slate-200 shadow-sm overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">Upload file</CardTitle>
                <CardDescription>
                  Drag and drop a .csv or .json export, then map columns to GeistDesk fields.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-2xl h-48 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/80',
                    dragOver ? 'border-slate-900 bg-slate-100' : 'border-slate-300 hover:border-slate-500',
                  )}
                >
                  <UploadCloud className="w-10 h-10 text-slate-400 mb-3" />
                  <p className="font-semibold text-slate-800">
                    {file ? file.name : 'Drop CSV / JSON here, or click to browse'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <FileSpreadsheet className="w-3.5 h-3.5" /> .csv
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FileJson className="w-3.5 h-3.5" /> .json
                    </span>
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.json,text/csv,application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) loadFile(f);
                    }}
                  />
                </div>

                {phase !== 'idle' && headers.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                        Field mapper
                      </h3>
                      <Badge variant="secondary" className="rounded-lg">
                        {rowCount} row{rowCount === 1 ? '' : 's'} detected
                      </Badge>
                    </div>
                    <div className="rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <span>Source column</span>
                        <span />
                        <span>GeistDesk field</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {headers.map((header) => (
                          <div
                            key={header}
                            className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center px-4 py-3"
                          >
                            <span className="text-sm font-medium text-slate-800 truncate">
                              {header}
                            </span>
                            <ArrowRight className="w-4 h-4 text-slate-300" />
                            <select
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                              value={mappings[header] || '__skip__'}
                              onChange={(e) =>
                                setMappings((prev) => ({ ...prev, [header]: e.target.value }))
                              }
                            >
                              <option value="__skip__">— Skip —</option>
                              {canonicalFields.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.label}
                                  {f.required ? ' *' : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {(phase === 'uploading' || phase === 'done') && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-slate-500">
                      <span>{phase === 'uploading' ? 'Uploading & importing…' : 'Complete'}</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                {result && (
                  <div
                    className={cn(
                      'rounded-2xl border p-4 space-y-2',
                      result.errorCount > 0
                        ? 'border-amber-200 bg-amber-50/60'
                        : 'border-emerald-200 bg-emerald-50/60',
                    )}
                  >
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      {result.errorCount > 0 ? (
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                      {result.successCount} succeeded · {result.errorCount} failed
                      {typeof result.enqueuedVectors === 'number'
                        ? ` · ${result.enqueuedVectors} embedding job(s)`
                        : ''}
                    </div>
                    {result.errors?.length > 0 && (
                      <ul className="max-h-40 overflow-y-auto text-xs text-slate-600 space-y-1 list-disc pl-5">
                        {result.errors.slice(0, 50).map((err, i) => (
                          <li key={`${i}-${err.slice(0, 24)}`}>{err}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={resetFileState}
                    disabled={phase === 'uploading'}
                  >
                    Reset
                  </Button>
                  <Button
                    type="button"
                    className="rounded-xl"
                    onClick={() => void runImport()}
                    disabled={!file || phase === 'uploading' || phase === 'idle'}
                  >
                    {phase === 'uploading' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing…
                      </>
                    ) : (
                      <>Run import</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quick" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="rounded-[1.75rem] border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Ticket className="w-5 h-5" /> Quick-add ticket
                  </CardTitle>
                  <CardDescription>
                    Status RESOLVED / CLOSED immediately queues RAG embeddings.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={submitQuickTicket}>
                    <div className="space-y-2">
                      <Label htmlFor="t-subject">Subject</Label>
                      <Input
                        id="t-subject"
                        value={ticketForm.subject}
                        onChange={(e) =>
                          setTicketForm((p) => ({ ...p, subject: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="t-body">Body</Label>
                      <Textarea
                        id="t-body"
                        rows={4}
                        value={ticketForm.body}
                        onChange={(e) => setTicketForm((p) => ({ ...p, body: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="t-email">Sender email</Label>
                      <Input
                        id="t-email"
                        type="email"
                        value={ticketForm.sender_email}
                        onChange={(e) =>
                          setTicketForm((p) => ({ ...p, sender_email: e.target.value }))
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="t-status">Status</Label>
                        <select
                          id="t-status"
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                          value={ticketForm.status}
                          onChange={(e) =>
                            setTicketForm((p) => ({ ...p, status: e.target.value }))
                          }
                        >
                          <option value="OPEN">OPEN</option>
                          <option value="PENDING">PENDING</option>
                          <option value="RESOLVED">RESOLVED</option>
                          <option value="CLOSED">CLOSED</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="t-tags">Tags</Label>
                        <Input
                          id="t-tags"
                          placeholder="vpn;network"
                          value={ticketForm.tags}
                          onChange={(e) =>
                            setTicketForm((p) => ({ ...p, tags: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full rounded-xl" disabled={quickBusy}>
                      {quickBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create ticket'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="rounded-[1.75rem] border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BookOpen className="w-5 h-5" /> Quick-add KB article
                  </CardTitle>
                  <CardDescription>
                    PUBLISHED articles are chunked and embedded for hybrid search.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={submitQuickKb}>
                    <div className="space-y-2">
                      <Label htmlFor="k-title">Title</Label>
                      <Input
                        id="k-title"
                        value={kbForm.title}
                        onChange={(e) => setKbForm((p) => ({ ...p, title: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="k-content">Content</Label>
                      <Textarea
                        id="k-content"
                        rows={4}
                        value={kbForm.content}
                        onChange={(e) => setKbForm((p) => ({ ...p, content: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="k-category">Category</Label>
                      <Input
                        id="k-category"
                        value={kbForm.category}
                        onChange={(e) => setKbForm((p) => ({ ...p, category: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="k-status">Status</Label>
                        <select
                          id="k-status"
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                          value={kbForm.status}
                          onChange={(e) => setKbForm((p) => ({ ...p, status: e.target.value }))}
                        >
                          <option value="PUBLISHED">PUBLISHED</option>
                          <option value="DRAFT">DRAFT</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="k-tags">Tags</Label>
                        <Input
                          id="k-tags"
                          placeholder="howto;password"
                          value={kbForm.tags}
                          onChange={(e) => setKbForm((p) => ({ ...p, tags: e.target.value }))}
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full rounded-xl" disabled={quickBusy}>
                      {quickBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create article'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
