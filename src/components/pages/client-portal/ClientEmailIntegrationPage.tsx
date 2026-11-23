import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Info,
  Loader2,
  Mail,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { cn } from '../../../lib/utils';
import {
  clientPortalApi,
  type PortalEmailChannel,
  type PortalEmailOrgSettings,
} from '../../../services/clientPortalApi';

const MASK = '••••••••';

export default function ClientEmailIntegrationPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savingSso, setSavingSso] = useState(false);

  const [supportEmail, setSupportEmail] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [hasClientSecret, setHasClientSecret] = useState(false);
  const [secretDirty, setSecretDirty] = useState(false);
  const [inboundEnabled, setInboundEnabled] = useState(true);
  const [sendAsEnabled, setSendAsEnabled] = useState(false);

  const [channelMeta, setChannelMeta] = useState<PortalEmailChannel | null>(null);
  const [org, setOrg] = useState<PortalEmailOrgSettings | null>(null);
  const [m365TenantId, setM365TenantId] = useState('');
  const [ssoEnabled, setSsoEnabled] = useState(false);

  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await clientPortalApi.getEmailChannel();
      const ch = data.channel;
      setChannelMeta(ch);
      setSupportEmail(ch?.mailbox || ch?.email || '');
      setTenantId(ch?.tenantId || '');
      setClientId(ch?.clientId || '');
      setHasClientSecret(Boolean(ch?.hasClientSecret));
      setClientSecret(ch?.hasClientSecret ? MASK : '');
      setSecretDirty(false);
      setInboundEnabled(ch?.inboundEnabled !== false);
      setSendAsEnabled(Boolean(ch?.sendAsEnabled));
      setOrg(data.organization);
      setM365TenantId(data.organization?.m365TenantId || '');
      setSsoEnabled(Boolean(data.organization?.ssoEnabled));
      if (ch?.lastTestOk != null) {
        setTestResult({
          ok: Boolean(ch.lastTestOk),
          message: ch.lastError || (ch.lastTestOk ? 'Zuletzt erfolgreich getestet.' : ''),
        });
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'E-Mail-Kanal konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (!supportEmail.trim() || !supportEmail.includes('@')) {
      toast.error('Bitte eine gültige Support-E-Mail angeben.');
      return;
    }
    if (!tenantId.trim() || !clientId.trim()) {
      toast.error('Directory (Tenant)-ID und Application (Client)-ID sind erforderlich.');
      return;
    }
    if (!hasClientSecret && !clientSecret.trim()) {
      toast.error('Client-Secret ist erforderlich.');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        email: supportEmail.trim(),
        mailbox: supportEmail.trim(),
        tenantId: tenantId.trim(),
        clientId: clientId.trim(),
        inboundEnabled,
        sendAsEnabled,
      };
      if (secretDirty && clientSecret && clientSecret !== MASK) {
        payload.clientSecret = clientSecret;
      }
      const channel = await clientPortalApi.saveEmailChannel(payload);
      setChannelMeta(channel);
      setHasClientSecret(Boolean(channel.hasClientSecret));
      setClientSecret(channel.hasClientSecret ? MASK : '');
      setSecretDirty(false);
      toast.success('E-Mail-Kanal gespeichert.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const payload: Record<string, unknown> = {
        email: supportEmail.trim(),
        mailbox: supportEmail.trim(),
        tenantId: tenantId.trim(),
        clientId: clientId.trim(),
      };
      if (secretDirty && clientSecret && clientSecret !== MASK) {
        payload.clientSecret = clientSecret;
      }
      const result = await clientPortalApi.testEmailChannel(payload);
      setTestResult({ ok: result.ok, message: result.message });
      if (result.ok) toast.success('Verbindung erfolgreich.');
      else toast.error(result.message || 'Verbindungstest fehlgeschlagen.');
      await load();
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'Verbindungstest fehlgeschlagen.';
      setTestResult({ ok: false, message });
      toast.error(message);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSso = async () => {
    setSavingSso(true);
    try {
      const updated = await clientPortalApi.updateEmailSso({
        m365TenantId: m365TenantId.trim() || null,
        ssoEnabled,
      });
      setOrg(updated);
      setM365TenantId(updated?.m365TenantId || '');
      setSsoEnabled(Boolean(updated?.ssoEnabled));
      toast.success('SSO-Einstellungen gespeichert.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'SSO konnte nicht gespeichert werden.');
    } finally {
      setSavingSso(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight">E-Mail & M365 Integration</h1>
        <p className="text-sm text-slate-500 mt-1">
          Verbinden Sie Ihr Microsoft-365-Postfach für eingehende Tickets und Send-As-Antworten
          {org?.name ? ` (${org.name})` : ''}.
        </p>
      </div>

      {/* Setup helper */}
      <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-5 py-4 space-y-3">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-sky-700 mt-0.5 shrink-0" />
          <div className="text-sm text-sky-950 space-y-2">
            <p className="font-bold">Entra-ID App-Registrierung</p>
            <p className="leading-relaxed text-sky-900/90">
              Legen Sie in Azure Portal eine App-Registrierung an und erteilen Sie die
              Anwendungsberechtigungen (Application permissions) mit Admin Consent:
            </p>
            <ul className="list-disc list-inside space-y-1 font-mono text-[13px]">
              <li>Mail.ReadWrite</li>
              <li>Mail.Send</li>
            </ul>
            <p className="text-sky-900/80 leading-relaxed">
              Authentifizierung erfolgt serverseitig per Client Credentials — kein Browser-OAuth,
              kein CORS-Problem beim Verbindungstest.
            </p>
          </div>
        </div>
      </div>

      {/* Graph channel form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Microsoft Graph Postfach</h2>
            <p className="text-sm text-slate-500 mt-1">
              Support-Adresse, die Hubcom für Ihr Unternehmen abruft und als Absender nutzt.
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="support-email">Support-E-Mail (Send-As)</Label>
            <Input
              id="support-email"
              type="email"
              placeholder="it@kunde-a.de"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tenant-id">Directory (Tenant)-ID</Label>
            <Input
              id="tenant-id"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              autoComplete="off"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-id">Application (Client)-ID</Label>
            <Input
              id="client-id"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              autoComplete="off"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-secret">Client-Secret</Label>
            <Input
              id="client-secret"
              type="password"
              placeholder={hasClientSecret ? 'Gespeichertes Secret beibehalten' : 'Client Secret'}
              value={clientSecret}
              onChange={(e) => {
                setClientSecret(e.target.value);
                setSecretDirty(true);
              }}
              onFocus={() => {
                if (!secretDirty && clientSecret === MASK) {
                  setClientSecret('');
                  setSecretDirty(true);
                }
              }}
              autoComplete="new-password"
            />
            {hasClientSecret && !secretDirty ? (
              <p className="text-xs text-slate-400">Secret ist gespeichert (verschlüsselt) und wird nicht angezeigt.</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Eingehende E-Mails abrufen</p>
              <p className="text-xs text-slate-500">Ungelesene Mails werden als Tickets Ihrer Organisation angelegt.</p>
            </div>
            <Switch checked={inboundEnabled} onCheckedChange={setInboundEnabled} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Antworten über eigenes Postfach senden (Send As)
              </p>
              <p className="text-xs text-slate-500">
                Agenten-Antworten gehen von Ihrer Support-Adresse; sonst Fallback auf hubcom.support@hubcom.de.
              </p>
            </div>
            <Switch checked={sendAsEnabled} onCheckedChange={setSendAsEnabled} />
          </div>
        </div>

        {testResult ? (
          <div
            className={cn(
              'rounded-xl px-4 py-3 flex items-start gap-2.5 text-sm',
              testResult.ok
                ? 'bg-emerald-50 border border-emerald-100 text-emerald-900'
                : 'bg-rose-50 border border-rose-100 text-rose-900',
            )}
          >
            {testResult.ok ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <span className="leading-relaxed">{testResult.message}</span>
          </div>
        ) : null}

        {channelMeta?.status ? (
          <p className="text-xs text-slate-400">
            Status: <span className="font-semibold text-slate-600">{channelMeta.status}</span>
            {channelMeta.lastTestAt
              ? ` · letzter Test ${new Date(channelMeta.lastTestAt).toLocaleString('de-DE')}`
              : ''}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" onClick={() => void handleSave()} disabled={saving || testing}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Speichern
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleTest()}
            disabled={testing || saving}
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Verbindung testen
          </Button>
        </div>
      </div>

      {/* Optional SSO */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Microsoft 365 SSO (optional)</h2>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Verknüpfen Sie Ihre Entra-ID-Tenant-ID, damit vorab angelegte oder domain-passende
              Benutzer sich mit Microsoft 365 anmelden und im eigenen Kunden-Portal landen.
              Unbekannte externe Tenants werden abgelehnt.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sso-tenant">M365 Tenant-ID (SSO)</Label>
          <Input
            id="sso-tenant"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={m365TenantId}
            onChange={(e) => setM365TenantId(e.target.value)}
            className="font-mono text-sm"
            autoComplete="off"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">SSO aktivieren</p>
            <p className="text-xs text-slate-500">Nur für diesen verknüpften Tenant zulassen.</p>
          </div>
          <Switch checked={ssoEnabled} onCheckedChange={setSsoEnabled} />
        </div>

        <Button type="button" variant="outline" onClick={() => void handleSaveSso()} disabled={savingSso}>
          {savingSso ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          SSO speichern
        </Button>
      </div>
    </div>
  );
}
