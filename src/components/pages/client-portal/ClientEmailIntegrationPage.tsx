import { Mail, ShieldCheck } from 'lucide-react';

/**
 * CLIENT_ADMIN-only placeholder for org-level mailbox / M365 settings.
 * Full Graph channel configuration remains Hubcom-operated in Phase 2;
 * this page explains the co-managed model and next steps.
 */
export default function ClientEmailIntegrationPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">E-Mail & M365 Integration</h1>
        <p className="text-sm text-slate-500 mt-1">
          Verbinden Sie Ihre Organisations-Mailbox mit dem Hubcom ServiceDesk.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Microsoft 365 / Exchange</h2>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Eingehende Support-Mails Ihrer Firma können über Microsoft Graph an Hubcom
              weitergeleitet und als Tickets im Kunden-Portal sichtbar gemacht werden.
              Die App-Registrierung und Admin-Consent (Mail.ReadWrite / Mail.Send) werden
              gemeinsam mit Hubcom eingerichtet.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-sm text-emerald-900 leading-relaxed">
            Ihre Tickets und Teilnehmer bleiben strikt auf Ihre Organisation beschränkt.
            Interne Hubcom-Notizen sind im Kunden-Portal nie sichtbar.
          </p>
        </div>

        <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2">
          <li>Benennen Sie die Support-Adresse (z.&nbsp;B. support@ihre-firma.de).</li>
          <li>Hubcom hinterlegt Tenant-ID, Client-ID und Secret im sicheren Kanal.</li>
          <li>Nach dem Handshake erscheinen eingehende Mails als Firmen-Tickets.</li>
        </ol>

        <p className="text-xs text-slate-400">
          Direktes Speichern von Client Secrets im Kunden-Portal folgt in einer späteren Phase.
          Kontaktieren Sie Hubcom Support, um die Integration zu aktivieren.
        </p>
      </div>
    </div>
  );
}
