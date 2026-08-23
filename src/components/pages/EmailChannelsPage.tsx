import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Copy,
  Globe2,
  KeyRound,
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
import { Switch } from '../ui/switch';
import { cn } from '../../lib/utils';
import {
  emailChannelApi,
  type EmailChannelConfig,
  type EmailConnectionType,
} from '../../services/emailChannelApi';
import {
  azureAppRegistrationUrl,
  runMicrosoftDeviceFlow,
} from '../../lib/oauth-device-flow';

const CONNECTION_OPTIONS: {
  id: EmailConnectionType;
  label: string;
  icon: typeof Zap;
  recommended?: boolean;
  hint: string;
}[] = [
  {
    id: 'webhook',
    label: 'E-Mail-Weiterleitung',
    icon: Zap,
    recommended: true,
    hint: 'Empfohlen — passives Push über eine eindeutige help-{slug}@domain Adresse.',
  },
  {
    id: 'imap_basic',
    label: 'IMAP (Standard)',
    icon: Mail,
    hint: 'Klassischer Benutzername + Passwort über SSL/TLS.',
  },
  {
    id: 'imap_oauth2',
    label: 'IMAP (OAuth2)',
    icon: KeyRound,
    hint: 'XOAUTH2 für moderne Microsoft / Google Postfächer.',
  },
  {
    id: 'microsoft_graph',
    label: 'Microsoft Graph API',
    icon: Building2,
    hint: 'Aktives Pull über Graph Client-Credentials.',
  },
];

function emptyDraft(forwardingDomain?: string): Partial<EmailChannelConfig> {
  return {
    name: '',
    email: '',
    group: 'Technical Support',
    connectionType: 'webhook',
    enabled: true,
    status: 'pending',
    forwardingDomain,
  };
}

function DnsRecordRow({
  label,
  type,
  host,
  value,
  onCopy,
}: {
  label: string;
  type: string;
  host: string;
  value: string;
  onCopy: (value: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        {value ? (
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => onCopy(value)}>
            <Copy className="w-3 h-3 mr-1" />
            Copy value
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-[72px_1fr] gap-x-2 gap-y-1 text-[11px] items-start">
        <span className="text-slate-400 font-semibold uppercase">Type</span>
        <code className="font-mono text-slate-900 bg-white border border-slate-200 rounded px-1.5 py-0.5 w-fit">
          {type}
        </code>
        <span className="text-slate-400 font-semibold uppercase">Host</span>
        <code className="font-mono text-slate-900 bg-white border border-slate-200 rounded px-1.5 py-0.5 w-fit break-all">
          {host}
        </code>
        <span className="text-slate-400 font-semibold uppercase">Value</span>
        <code className="font-mono text-[10px] text-slate-900 bg-white border border-slate-200 rounded px-1.5 py-1 break-all leading-relaxed">
          {value || '—'}
        </code>
      </div>
    </div>
  );
}

/** Build API payload — webhook channels omit IMAP/Graph server fields entirely. */
function buildSavePayload(editing: Partial<EmailChannelConfig>): Partial<EmailChannelConfig> {
  const connectionType = (editing.connectionType || 'webhook') as EmailConnectionType;
  const base: Partial<EmailChannelConfig> = {
    name: editing.name?.trim() || '',
    email: editing.email?.trim() || '',
    group: editing.group || '',
    connectionType,
    enabled: editing.enabled !== false,
    status: editing.status || 'pending',
  };

  if (connectionType === 'webhook') {
    return {
      ...base,
      forwardingAddress: editing.forwardingAddress || undefined,
      webhookSecret:
        editing.webhookSecret && editing.webhookSecret !== '••••••••'
          ? editing.webhookSecret
          : undefined,
    };
  }

  if (connectionType === 'imap_basic' || connectionType === 'imap_oauth2') {
    return {
      ...base,
      imapHost: editing.imapHost || '',
      imapPort: editing.imapPort ?? 993,
      imapUser: editing.imapUser || editing.email || '',
      imapPassword: editing.imapPassword || undefined,
      imapTls: editing.imapTls !== false,
      oauthClientId: connectionType === 'imap_oauth2' ? editing.oauthClientId || '' : undefined,
      oauthClientSecret:
        connectionType === 'imap_oauth2' ? editing.oauthClientSecret || undefined : undefined,
      oauthTokenUrl: connectionType === 'imap_oauth2' ? editing.oauthTokenUrl || '' : undefined,
      oauthRefreshToken:
        connectionType === 'imap_oauth2' ? editing.oauthRefreshToken || undefined : undefined,
      oauthScope: connectionType === 'imap_oauth2' ? editing.oauthScope || undefined : undefined,
    };
  }

  // microsoft_graph
  return {
    ...base,
    mailbox: editing.mailbox || editing.email || '',
    tenantId: editing.tenantId || '',
    clientId: editing.clientId || '',
    clientSecret: editing.clientSecret || undefined,
  };
}

export default function EmailChannelsPage() {
  const [channels, setChannels] = useState<EmailChannelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [verifyingDns, setVerifyingDns] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [dnsCheckMessage, setDnsCheckMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<EmailChannelConfig> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [forwardingDomain, setForwardingDomain] = useState('');
  const [oauthFlow, setOauthFlow] = useState<{
    userCode: string;
    verificationUri: string;
    message: string;
    pending: boolean;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await emailChannelApi.list();
      setChannels(list);
      const domain = list.find((c) => c.forwardingDomain)?.forwardingDomain || '';
      if (domain) setForwardingDomain(domain);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to load email channels');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-refresh listener: when a forwarding channel receives a verification
  // ping or inbound test payload, the server flips its status to "connected".
  // Poll quietly in the background while the modal is open so the status badge
  // updates without a manual refresh.
  useEffect(() => {
    if (!editing?.id || editing.connectionType !== 'webhook') return;
    const interval = window.setInterval(() => {
      emailChannelApi
        .list()
        .then((list) => {
          setChannels(list);
          setEditing((prev) => {
            if (!prev?.id) return prev;
            const fresh = list.find((c) => c.id === prev.id);
            return fresh ? { ...prev, ...fresh } : prev;
          });
        })
        .catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [editing?.id, editing?.connectionType]);

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
    setDnsCheckMessage(null);
    setOauthFlow(null);
    setEditing(emptyDraft(forwardingDomain));
  };

  const openEdit = (channel: EmailChannelConfig) => {
    setTestResult(null);
    setDnsCheckMessage(null);
    setOauthFlow(null);
    setEditing({ ...channel });
  };

  const handleSave = async () => {
    if (!editing?.name?.trim() || !editing?.email?.trim()) {
      toast.error('Name and support email are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = buildSavePayload(editing);
      let saved: EmailChannelConfig;
      if (editing.id) {
        const updated = await emailChannelApi.update(editing.id, payload);
        setChannels((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setEditing(updated);
        saved = updated;
        toast.success('Channel saved');
      } else {
        const created = await emailChannelApi.create(payload);
        setChannels((prev) => [created, ...prev]);
        setEditing(created);
        saved = created;
        toast.success('Channel created');
      }

      // Advanced direct connections (IMAP/Graph) run a background test on save
      // and report connected / auth_error / pending.
      const type = saved.connectionType;
      if (type === 'imap_basic' || type === 'imap_oauth2' || type === 'microsoft_graph') {
        try {
          const result = await emailChannelApi.test(saved.id, buildSavePayload(editing));
          setTestResult(result);
          const list = await emailChannelApi.list();
          setChannels(list);
          const fresh = list.find((c) => c.id === saved.id);
          if (fresh) setEditing(fresh);
          if (result.ok) toast.success(result.message || 'Verbindung erfolgreich');
          else toast.error(result.message || 'Verbindungs-Test fehlgeschlagen');
        } catch (err: any) {
          const message =
            err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Verbindungs-Test fehlgeschlagen';
          setTestResult({ ok: false, message });
          toast.error(message);
        }
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
    const type = connectionType;
    if (type === 'webhook') {
      setTestResult({
        ok: true,
        message:
          'Weiterleitungskanäle sind passiv — kein aktiver Test. Sende eine Testmail an die help-Adresse; der Status wird automatisch auf „connected" gesetzt.',
      });
      toast.success('Weiterleitung ist passiv — Testmail an die help-Adresse senden');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const payload = buildSavePayload(editing);
      let channelId = editing.id;
      if (!channelId) {
        const created = await emailChannelApi.create(payload);
        channelId = created.id;
        setChannels((prev) => [created, ...prev]);
        setEditing(created);
      }
      const result = await emailChannelApi.test(channelId!, payload);
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

  const handleVerifyDns = async () => {
    if (!editing) return;
    setVerifyingDns(true);
    setDnsCheckMessage(null);
    try {
      let channelId = editing.id;
      if (!channelId) {
        const created = await emailChannelApi.create(buildSavePayload(editing));
        channelId = created.id;
        setChannels((prev) => [created, ...prev]);
        setEditing(created);
      }
      const result = await emailChannelApi.verifyDomain(channelId!);
      setDnsCheckMessage(result.message || (result.success ? 'Domain verified' : 'Verification failed'));

      // Always surface the records the API (back)filled — even when DNS check fails.
      setEditing((prev) =>
        prev
          ? {
              ...prev,
              id: channelId,
              dnsVerified: Boolean(result.dnsVerified || result.success),
              dnsVerifiedAt: result.channel?.dnsVerifiedAt || prev.dnsVerifiedAt || null,
              verificationToken:
                result.records?.verificationToken || prev.verificationToken || null,
              dkimRecordName: result.records?.dkimRecordName || prev.dkimRecordName || null,
              dkimRecordValue: result.records?.dkimRecordValue || prev.dkimRecordValue || null,
              spfRecordValue: result.records?.spfRecordValue || prev.spfRecordValue || null,
            }
          : prev,
      );

      if (result.success) toast.success(result.message || 'DNS verified');
      else toast.error(result.message || result.error || 'DNS check failed');

      const list = await emailChannelApi.list();
      setChannels(list);
      const refreshed = list.find((c) => c.id === channelId);
      if (refreshed) {
        setEditing((prev) => (prev ? { ...prev, ...refreshed } : refreshed));
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'DNS verification failed';
      setDnsCheckMessage(message);
      toast.error(message);
    } finally {
      setVerifyingDns(false);
    }
  };

  const setField = <K extends keyof EmailChannelConfig>(key: K, value: EmailChannelConfig[K]) => {
    setEditing((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleOAuthConnect = async () => {
    if (!editing) return;
    setOauthFlow({ userCode: '', verificationUri: '', message: 'OAuth-Verbindung wird vorbereitet…', pending: true });
    try {
      // IMAP OAuth2 stores credentials differently than Graph: tenant lives in
      // the token endpoint URL (login.microsoftonline.com/{tenant}/...).
      let tenantId = editing.tenantId?.trim() || '';
      const clientId =
        editing.clientId?.trim() || editing.oauthClientId?.trim() || '';
      if (!tenantId) {
        const tokenUrl = editing.oauthTokenUrl?.trim() || '';
        const match = tokenUrl.match(/login\.microsoftonline\.com\/([^/]+)/i);
        if (match?.[1]) tenantId = match[1].trim();
      }
      if (!tenantId || !clientId) {
        throw new Error(
          connectionType === 'imap_oauth2'
            ? 'Client ID und Tenant (Token-URL oder Tenant-ID) angeben, um OAuth zu verbinden.'
            : 'Tenant ID und Client ID angeben, um OAuth zu verbinden.',
        );
      }
      const refreshToken = await runMicrosoftDeviceFlow({
        tenantId,
        clientId,
        onUserCode: (userCode, verificationUri, message) =>
          setOauthFlow({ userCode, verificationUri, message, pending: true }),
      });

      if (connectionType === 'imap_oauth2') {
        setField('oauthRefreshToken', refreshToken);
        setOauthFlow((prev) =>
          prev ? { ...prev, pending: false, message: 'OAuth verbunden — Refresh Token gespeichert. Kanal jetzt speichern.' } : prev,
        );
        toast.success('Microsoft OAuth verbunden — Refresh Token gespeichert');
      } else {
        // Graph driver uses client_credentials; the device flow validated the
        // app registration. Persist nothing sensitive beyond what's already set.
        setOauthFlow((prev) =>
          prev ? { ...prev, pending: false, message: 'Microsoft App-Registrierung validiert. Kanal jetzt speichern & testen.' } : prev,
        );
        toast.success('Microsoft App-Registrierung validiert');
      }
    } catch (err: any) {
      setOauthFlow((prev) =>
        prev ? { ...prev, pending: false, message: err?.message || 'OAuth-Verbindung fehlgeschlagen' } : prev,
      );
      toast.error(err?.message || 'OAuth-Verbindung fehlgeschlagen');
    }
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
                          channel.status === 'verified' ||
                            channel.status === 'active' ||
                            channel.status === 'connected'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : channel.status === 'failed' || channel.status === 'auth_error'
                              ? 'bg-rose-50 text-rose-700 border-rose-100'
                              : 'bg-amber-50 text-amber-700 border-amber-100',
                        )}
                      >
                        {channel.status}
                      </Badge>
                      {channel.enabled === false ? (
                        <span className="ml-2 text-[10px] text-slate-400 font-bold uppercase">Disabled</span>
                      ) : null}
                      {channel.dnsVerified ? (
                        <Badge className="ml-2 text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border-emerald-100">
                          Verifiziert
                        </Badge>
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
                <div className="grid grid-cols-2 gap-2">
                  {CONNECTION_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = connectionType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          const next = opt.id;
                          setTestResult(null);
                          setOauthFlow(null);
                          setEditing((prev) => {
                            if (!prev) return prev;
                            const base: Partial<EmailChannelConfig> = {
                              ...prev,
                              connectionType: next,
                            };
                            if (next === 'webhook') {
                              return {
                                ...base,
                                imapHost: undefined,
                                imapPort: undefined,
                                imapUser: undefined,
                                imapPassword: undefined,
                                imapTls: undefined,
                                oauthClientId: undefined,
                                oauthClientSecret: undefined,
                                oauthTokenUrl: undefined,
                                oauthRefreshToken: undefined,
                                oauthScope: undefined,
                                tenantId: undefined,
                                clientId: undefined,
                                clientSecret: undefined,
                                mailbox: undefined,
                              };
                            }
                            if (next === 'imap_basic' || next === 'imap_oauth2') {
                              return {
                                ...base,
                                imapPort: prev.imapPort ?? 993,
                                imapTls: prev.imapTls !== false,
                                imapUser: prev.imapUser || prev.email || '',
                              };
                            }
                            return {
                              ...base,
                              mailbox: prev.mailbox || prev.email || '',
                            };
                          });
                        }}
                        className={cn(
                          'rounded-xl border px-3 py-2.5 text-left transition',
                          active
                            ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500/30'
                            : 'border-slate-200 hover:border-slate-300',
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <Icon className={cn('w-3.5 h-3.5', active ? 'text-blue-600' : 'text-slate-400')} />
                          <span
                            className={cn(
                              'text-[11px] font-bold leading-tight',
                              active ? 'text-blue-800' : 'text-slate-600',
                            )}
                          >
                            {opt.label}
                          </span>
                          {opt.recommended ? (
                            <Badge className="ml-auto text-[8px] font-black uppercase bg-emerald-50 text-emerald-700 border-emerald-100">
                              Empfohlen
                            </Badge>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400">
                  {CONNECTION_OPTIONS.find((o) => o.id === connectionType)?.hint}
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                <div>
                  <p className="text-xs font-bold text-slate-800">Aktiv</p>
                  <p className="text-[10px] text-slate-400">
                    {connectionType === 'webhook'
                      ? 'Weiterleitungskanäle pollen nicht — sie warten auf eingehende Mails (automatische Verifizierung).'
                      : 'Aktive Pull-Treiber werden alle 60 Sekunden abgefragt.'}
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
                            ? `help-${editing.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16).toLowerCase()}@${forwardingDomain || 'app.premtonx.cloud'}`
                            : 'Speichern, um die Adresse zu generieren')
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

                  <div
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px] font-semibold',
                      editing.status === 'connected' || editing.status === 'verified'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : editing.status === 'auth_error'
                          ? 'border-rose-200 bg-rose-50 text-rose-800'
                          : 'border-amber-200 bg-amber-50 text-amber-800',
                    )}
                  >
                    {editing.status === 'connected' || editing.status === 'verified' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    ) : editing.status === 'auth_error' ? (
                      <Shield className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Loader2 className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                    )}
                    <span>
                      {editing.status === 'connected' || editing.status === 'verified'
                        ? 'Verbindung aktiv — erste Weiterleitung bestätigt.'
                        : editing.status === 'auth_error'
                          ? 'Authentifizierungsfehler — bitte Secret prüfen.'
                          : 'Wartet auf erste eingehende Mail an die Weiterleitungsadresse (Verifizierung automatisch).'}
                    </span>
                  </div>

                  <details open className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <summary className="cursor-pointer list-none px-3 py-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                        <Globe2 className="w-3.5 h-3.5 text-emerald-600" />
                        DNS Verification
                      </div>
                      {editing.dnsVerified ? (
                        <Badge className="text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border-emerald-100">
                          Verifiziert
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border-amber-100">
                          Unverifiziert
                        </Badge>
                      )}
                    </summary>
                    <div className="border-t border-slate-100 px-3 py-3 space-y-3">
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Add these <span className="font-semibold text-slate-700">TXT</span> records
                        at your DNS host for{' '}
                        <span className="font-mono font-semibold text-slate-700">
                          {(editing.email || '').split('@')[1] || 'your-domain.com'}
                        </span>
                        . After DNS propagates, agents can reply as{' '}
                        <span className="font-mono font-semibold text-slate-700">
                          {editing.email || 'support@domain.com'}
                        </span>
                        .
                      </p>

                      <div className="space-y-2.5">
                        <DnsRecordRow
                          label="1. Domain ownership (TXT)"
                          type="TXT"
                          host="@"
                          value={
                            editing.verificationToken
                              ? `geist-verification=${editing.verificationToken}`
                              : 'geist-verification=<save channel to generate token>'
                          }
                          onCopy={(value) => void copyText(value, 'TXT verification record')}
                        />
                        <DnsRecordRow
                          label="2. DKIM signing (TXT)"
                          type="TXT"
                          host={editing.dkimRecordName || 'geist._domainkey'}
                          value={
                            editing.dkimRecordValue ||
                            'v=DKIM1; k=rsa; p=<save channel to generate key>'
                          }
                          onCopy={(value) => void copyText(value, 'DKIM record')}
                        />
                        <DnsRecordRow
                          label="3. SPF authorization (TXT)"
                          type="TXT"
                          host="@"
                          value={
                            editing.spfRecordValue ||
                            'v=spf1 include:app.premtonx.cloud ~all'
                          }
                          onCopy={(value) => void copyText(value, 'SPF record')}
                        />
                      </div>

                      {!editing.verificationToken || !editing.dkimRecordValue ? (
                        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
                          Token/DKIM values are generated automatically — click{' '}
                          <span className="font-bold">Speichern</span> or{' '}
                          <span className="font-bold">DNS-Einträge prüfen</span> to load your unique
                          values, then publish them at your DNS provider.
                        </p>
                      ) : null}

                      {dnsCheckMessage ? (
                        <p
                          className={cn(
                            'text-[11px] font-semibold rounded-lg px-2.5 py-2 border',
                            editing.dnsVerified
                              ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                              : 'bg-rose-50 border-rose-100 text-rose-800',
                          )}
                        >
                          {dnsCheckMessage}
                        </p>
                      ) : null}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={verifyingDns || !editing.email}
                        onClick={() => void handleVerifyDns()}
                        className="gap-1.5"
                      >
                        {verifyingDns ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Globe2 className="w-3.5 h-3.5" />
                        )}
                        DNS-Einträge prüfen
                      </Button>
                    </div>
                  </details>
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
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-indigo-600"
                          disabled={oauthFlow?.pending || false}
                          onClick={() => void handleOAuthConnect()}
                        >
                          {oauthFlow?.pending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <KeyRound className="w-3.5 h-3.5" />
                          )}
                          Mit Microsoft verbinden
                        </Button>
                        <a
                          href={azureAppRegistrationUrl(editing.tenantId)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-semibold text-slate-400 underline hover:text-slate-600"
                        >
                          App-Registrierung öffnen
                        </a>
                      </div>
                      {oauthFlow ? (
                        <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 space-y-1.5">
                          {oauthFlow.userCode ? (
                            <>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                                Schritt 1 — Code eingeben
                              </p>
                              <div className="flex items-center gap-2">
                                <code className="font-mono text-sm font-black text-indigo-800 tracking-widest bg-white border border-indigo-200 rounded px-2 py-1">
                                  {oauthFlow.userCode}
                                </code>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => void copyText(oauthFlow.userCode, 'Code')}
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                              <p className="text-[10px] text-indigo-600">
                                Öffne{' '}
                                <a
                                  href={oauthFlow.verificationUri}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-bold underline"
                                >
                                  {oauthFlow.verificationUri}
                                </a>{' '}
                                und melde dich an.
                              </p>
                            </>
                          ) : (
                            <p className="text-[11px] text-indigo-700">{oauthFlow.message}</p>
                          )}
                          {oauthFlow.pending && oauthFlow.userCode ? (
                            <p className="text-[10px] text-indigo-500 flex items-center gap-1.5">
                              <Loader2 className="w-3 h-3 animate-spin" /> Warte auf Anmeldung im
                              Browser…
                            </p>
                          ) : null}
                          {!oauthFlow.pending && !oauthFlow.userCode ? (
                            <p className="text-[11px] font-semibold text-indigo-700">{oauthFlow.message}</p>
                          ) : null}
                        </div>
                      ) : null}
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
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-indigo-600"
                      disabled={oauthFlow?.pending || false}
                      onClick={() => void handleOAuthConnect()}
                    >
                      {oauthFlow?.pending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Building2 className="w-3.5 h-3.5" />
                      )}
                      App verbinden & validieren
                    </Button>
                    <a
                      href={azureAppRegistrationUrl(editing.tenantId)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-semibold text-slate-400 underline hover:text-slate-600"
                    >
                      App-Registrierung öffnen
                    </a>
                  </div>
                  {oauthFlow ? (
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 space-y-1.5">
                      {oauthFlow.userCode ? (
                        <>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                            Schritt 1 — Code eingeben
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-sm font-black text-indigo-800 tracking-widest bg-white border border-indigo-200 rounded px-2 py-1">
                              {oauthFlow.userCode}
                            </code>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => void copyText(oauthFlow.userCode, 'Code')}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                          <p className="text-[10px] text-indigo-600">
                            Öffne{' '}
                            <a
                              href={oauthFlow.verificationUri}
                              target="_blank"
                              rel="noreferrer"
                              className="font-bold underline"
                            >
                              {oauthFlow.verificationUri}
                            </a>{' '}
                            und melde dich mit einem berechtigten Konto an.
                          </p>
                        </>
                      ) : (
                        <p className="text-[11px] text-indigo-700">{oauthFlow.message}</p>
                      )}
                      {oauthFlow.pending && oauthFlow.userCode ? (
                        <p className="text-[10px] text-indigo-500 flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" /> Warte auf Anmeldung im
                          Browser…
                        </p>
                      ) : null}
                      {!oauthFlow.pending && !oauthFlow.userCode ? (
                        <p className="text-[11px] font-semibold text-indigo-700">{oauthFlow.message}</p>
                      ) : null}
                    </div>
                  ) : null}
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
              {connectionType === 'webhook' ? 'Hinweis anzeigen' : 'Verbindung testen'}
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
