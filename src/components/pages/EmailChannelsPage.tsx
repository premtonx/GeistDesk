import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Server,
  Shield,
  Trash2,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Switch } from '../ui/switch';
import { cn } from '../../lib/utils';
import {
  emailChannelApi,
  type EmailChannelConfig,
  type EmailConnectionType,
} from '../../services/emailChannelApi';

const CONNECTION_OPTIONS: { id: EmailConnectionType; label: string; hint: string }[] = [
  {
    id: 'webhook',
    label: 'E-Mail-Weiterleitung (Webhook)',
    hint: 'Passive push via Postal / SendGrid / Mailgun / custom gateway',
  },
  {
    id: 'imap_basic',
    label: 'IMAP (Standard)',
    hint: 'Classic username + password over SSL/TLS',
  },
  {
    id: 'imap_oauth2',
    label: 'IMAP (OAuth2)',
    hint: 'XOAUTH2 for modern Microsoft / Google mailboxes',
  },
  {
    id: 'microsoft_graph',
    label: 'Microsoft Graph API',
    hint: 'Active pull via Graph client-credentials',
  },
];

function emptyDraft(): Partial<EmailChannelConfig> {
  return {
    name: '',
    email: '',
    group: 'Technical Support',
    connectionType: 'webhook',
    enabled: true,
    status: 'pending',
    imapPort: 993,
    imapTls: true,
  };
}

export default function EmailChannelsPage() {
  const [channels, setChannels] = useState<EmailChannelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [editing, setEditing] = useState<Partial<EmailChannelConfig> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await emailChannelApi.list();
      setChannels(list);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to load email channels');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      channels.filter(
        (c) =>
          c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.name?.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [channels, searchQuery],
  );

  const connectionType = (editing?.connectionType || 'webhook') as EmailConnectionType;

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Copy failed');
    }
  };

  const openCreate = () => {
    setTestResult(null);
    setEditing(emptyDraft());
  };

  const openEdit = (channel: EmailChannelConfig) => {
    setTestResult(null);
    setEditing({ ...channel });
  };

  const handleSave = async () => {
    if (!editing?.name?.trim() || !editing?.email?.trim()) {
      toast.error('Name and support email are required.');
      return;
    }
    setSaving(true);
    try {
      if (editing.id) {
        const updated = await emailChannelApi.update(editing.id, editing);
        setChannels((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setEditing(updated);
        toast.success('Channel saved');
      } else {
        const created = await emailChannelApi.create(editing);
        setChannels((prev) => [created, ...prev]);
        setEditing(created);
        toast.success('Channel created');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this email channel?')) return;
    try {
      await emailChannelApi.remove(id);
      setChannels((prev) => prev.filter((c) => c.id !== id));
      if (editing?.id === id) setEditing(null);
      toast.success('Channel deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Delete failed');
    }
  };

  const handleTest = async () => {
    if (!editing) return;
    setTesting(true);
    setTestResult(null);
    try {
      let channelId = editing.id;
      if (!channelId) {
        const created = await emailChannelApi.create(editing);
        channelId = created.id;
        setChannels((prev) => [created, ...prev]);
        setEditing(created);
      }
      const result = await emailChannelApi.test(channelId!, editing);
      setTestResult(result);
      if (result.ok) toast.success(result.message || 'Connection OK');
      else toast.error(result.message || 'Connection failed');
      await load();
    } catch (err: any) {
      const message =
        err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Test failed';
      setTestResult({ ok: false, message });
      toast.error(message);
    } finally {
      setTesting(false);
    }
  };

  const setField = <K extends keyof EmailChannelConfig>(key: K, value: EmailChannelConfig[K]) => {
    setEditing((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">E-Mail-Kanäle</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Multi-provider ingestion: Webhook forwarding, IMAP (password / OAuth2), and Microsoft Graph.
            Active drivers poll every 60s; webhook channels wait for passive push.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} className="gap-1.5">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button type="button" size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Channel hinzufügen
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search addresses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm h-9"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-10 flex items-center justify-center text-slate-400 gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading channels…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No email channels yet. Add a webhook or IMAP/Graph channel to start mail-to-ticket.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="text-left px-4 py-3 font-bold">Channel</th>
                <th className="text-left px-4 py-3 font-bold">Verbindungstyp</th>
                <th className="text-left px-4 py-3 font-bold">Status</th>
                <th className="text-right px-4 py-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((channel) => {
                const typeLabel =
                  CONNECTION_OPTIONS.find((o) => o.id === channel.connectionType)?.label ||
                  channel.connectionType;
                return (
                  <tr key={channel.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{channel.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{channel.email}</div>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">{typeLabel}</td>
                    <td className="px-4 py-3">
                      <Badge
                        className={cn(
                          'text-[10px] font-bold uppercase',
                          channel.status === 'verified' || channel.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : channel.status === 'failed'
                              ? 'bg-rose-50 text-rose-700 border-rose-100'
                              : 'bg-amber-50 text-amber-700 border-amber-100',
                        )}
                      >
                        {channel.status}
                      </Badge>
                      {channel.enabled === false ? (
                        <span className="ml-2 text-[10px] text-slate-400 font-bold uppercase">Disabled</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => openEdit(channel)}>
                        Configure
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-rose-600"
                        onClick={() => void handleDelete(channel.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-600" />
              {editing?.id ? 'E-Mail-Kanal bearbeiten' : 'Neuer E-Mail-Kanal'}
            </DialogTitle>
            <DialogDescription>
              Verbindungstyp wählen — das Formular zeigt nur die relevanten Felder.
            </DialogDescription>
          </DialogHeader>

          {editing ? (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Name</Label>
                  <Input value={editing.name || ''} onChange={(e) => setField('name', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Support-E-Mail
                  </Label>
                  <Input
                    value={editing.email || ''}
                    onChange={(e) => setField('email', e.target.value)}
                    placeholder="support@domain.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Verbindungstyp
                </Label>
                <Select
                  value={connectionType}
                  onValueChange={(v) => setField('connectionType', v as EmailConnectionType)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONNECTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-400">
                  {CONNECTION_OPTIONS.find((o) => o.id === connectionType)?.hint}
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                <div>
                  <p className="text-xs font-bold text-slate-800">Aktiv</p>
                  <p className="text-[10px] text-slate-400">
                    {connectionType === 'webhook'
                      ? 'Webhook channels never poll — they wait for push.'
                      : 'Active pull drivers are polled every 60 seconds.'}
                  </p>
                </div>
                <Switch
                  checked={editing.enabled !== false}
                  onCheckedChange={(checked) => setField('enabled', checked)}
                />
              </div>

              {connectionType === 'webhook' ? (
                <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-800">
                    <Shield className="w-3.5 h-3.5" />
                    Weiterleitungsziel
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">
                      Forwarding address
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={
                          editing.forwardingAddress ||
                          (editing.id
                            ? `ticket-${editing.id.slice(0, 12)}@app.premtonx.cloud`
                            : 'Save channel to generate address')
                        }
                        className="font-mono text-xs bg-white"
                      />
                      {editing.forwardingAddress ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void copyText(editing.forwardingAddress!, 'Address')}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">
                      Webhook-Secret
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={editing.webhookSecret || (editing.id ? '••••••••' : 'Generated on save')}
                        className="font-mono text-xs bg-white"
                      />
                      {editing.webhookSecret && editing.webhookSecret !== '••••••••' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void copyText(editing.webhookSecret!, 'Secret')}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      ) : null}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Send header <code className="font-mono">x-geistdesk-webhook-secret</code> from
                      Postal / SendGrid / Mailgun to <code className="font-mono">/api/webhooks/inbound-mail</code>.
                    </p>
                  </div>
                </div>
              ) : null}

              {connectionType === 'imap_basic' || connectionType === 'imap_oauth2' ? (
                <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Server className="w-3.5 h-3.5" />
                    IMAP
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Host</Label>
                      <Input
                        value={editing.imapHost || ''}
                        onChange={(e) => setField('imapHost', e.target.value)}
                        placeholder="imap.example.com"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Port</Label>
                      <Input
                        value={String(editing.imapPort ?? 993)}
                        onChange={(e) => setField('imapPort', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">E-Mail / User</Label>
                    <Input
                      value={editing.imapUser || editing.email || ''}
                      onChange={(e) => setField('imapUser', e.target.value)}
                    />
                  </div>
                  {connectionType === 'imap_basic' ? (
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Password</Label>
                      <Input
                        type="password"
                        value={editing.imapPassword || ''}
                        onChange={(e) => setField('imapPassword', e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-400">
                          OAuth Client ID
                        </Label>
                        <Input
                          value={editing.oauthClientId || ''}
                          onChange={(e) => setField('oauthClientId', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-400">
                          Client Secret
                        </Label>
                        <Input
                          type="password"
                          value={editing.oauthClientSecret || ''}
                          onChange={(e) => setField('oauthClientSecret', e.target.value)}
                          placeholder="••••••••"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-400">
                          Token Endpoint URL
                        </Label>
                        <Input
                          value={editing.oauthTokenUrl || ''}
                          onChange={(e) => setField('oauthTokenUrl', e.target.value)}
                          placeholder="https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
                        />
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">SSL/TLS</Label>
                    <Switch
                      checked={editing.imapTls !== false}
                      onCheckedChange={(checked) => setField('imapTls', checked)}
                    />
                  </div>
                </div>
              ) : null}

              {connectionType === 'microsoft_graph' ? (
                <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Zap className="w-3.5 h-3.5 text-indigo-600" />
                    Microsoft Graph
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">
                      Target Support Email
                    </Label>
                    <Input
                      value={editing.mailbox || editing.email || ''}
                      onChange={(e) => setField('mailbox', e.target.value)}
                      placeholder="support@contoso.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Tenant ID</Label>
                    <Input
                      value={editing.tenantId || ''}
                      onChange={(e) => setField('tenantId', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Client ID</Label>
                    <Input
                      value={editing.clientId || ''}
                      onChange={(e) => setField('clientId', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Client Secret</Label>
                    <Input
                      type="password"
                      value={editing.clientSecret || ''}
                      onChange={(e) => setField('clientSecret', e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              ) : null}

              {testResult ? (
                <div
                  className={cn(
                    'rounded-xl border px-3 py-2 text-xs font-semibold flex items-start gap-2',
                    testResult.ok
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-rose-200 bg-rose-50 text-rose-800',
                  )}
                >
                  {testResult.ok ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Close
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={testing || !editing}
              onClick={() => void handleTest()}
              className="gap-1.5"
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Verbindung testen
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSave()}>
              {saving ? 'Saving…' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
