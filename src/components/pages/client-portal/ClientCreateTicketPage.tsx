import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { RichTextEditor } from '../../RichTextEditor';
import { useClientPortalSession } from '../../../hooks/useClientPortalSession';
import {
  clientPortalApi,
  type PortalMember,
  type PortalTicketAttachment,
} from '../../../services/clientPortalApi';
import type { TicketPriority } from '../../../types';

const PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Niedrig' },
  { value: 'medium', label: 'Normal' },
  { value: 'high', label: 'Hoch' },
  { value: 'urgent', label: 'Dringend' },
];

const CATEGORIES = [
  'Allgemein',
  'Hardware',
  'Software',
  'Netzwerk',
  'Zugriff / Accounts',
  'E-Mail',
  'Sonstiges',
];

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function fileToAttachment(file: File): Promise<PortalTicketAttachment> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      reject(new Error(`Datei zu groß (max. 5 MB): ${file.name}`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        contentBase64: base64,
      });
    };
    reader.onerror = () => reject(new Error(`Lesen fehlgeschlagen: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export default function ClientCreateTicketPage() {
  const { session, isOrgWide } = useClientPortalSession();
  const navigate = useNavigate();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<PortalTicketAttachment[]>([]);
  const [members, setMembers] = useState<PortalMember[]>([]);
  const [onBehalfOf, setOnBehalfOf] = useState('');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOrgWide) return;
    void clientPortalApi
      .listMembers()
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [isOrgWide]);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const next: PortalTicketAttachment[] = [];
      for (const file of Array.from(files)) {
        next.push(await fileToAttachment(file));
      }
      setAttachments((prev) => [...prev, ...next].slice(0, 10));
    } catch (err: any) {
      toast.error(err?.message || 'Anhang fehlgeschlagen');
    }
  };

  const submit = async () => {
    if (!session) return;
    if (!subject.trim() || !description.trim() || description === '<p><br></p>') {
      toast.error('Betreff und Beschreibung sind erforderlich.');
      return;
    }
    setSaving(true);
    try {
      const requesterId = isOrgWide && onBehalfOf ? onBehalfOf : session.id;
      const requester = members.find((m) => m.id === requesterId);
      const ticketId = await clientPortalApi.createTicket({
        subject: subject.trim(),
        description,
        priority,
        category,
        requesterId,
        participantIds: isOrgWide ? participantIds : [],
        attachments,
        customerName: requester?.name || session.name,
        customerEmail: requester?.email || session.email,
      });
      toast.success('Ticket erstellt.');
      navigate(`/portal/tickets/${ticketId}`, { replace: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Erstellen fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Neues Ticket erstellen</h1>
        <p className="text-sm text-slate-500 mt-1">
          Beschreiben Sie Ihr Anliegen — Hubcom Support meldet sich zeitnah.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
        <div className="space-y-1.5">
          <Label>Betreff</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Kurze Zusammenfassung des Problems"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Kategorie / Thema</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Priorität</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isOrgWide ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="space-y-1.5">
              <Label>Erstellen im Namen von (optional)</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-white px-3 text-sm"
                value={onBehalfOf}
                onChange={(e) => setOnBehalfOf(e.target.value)}
              >
                <option value="">Ich selbst</option>
                {members
                  .filter((m) => m.id !== session?.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.email}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Teilnehmer hinzufügen</Label>
              <select
                multiple
                className="w-full min-h-24 rounded-md border border-input bg-white px-3 py-2 text-sm"
                value={participantIds}
                onChange={(e) =>
                  setParticipantIds(Array.from(e.target.selectedOptions).map((o) => o.value))
                }
              >
                {members
                  .filter((m) => m.id !== session?.id && m.id !== onBehalfOf)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.email} ({m.role.replace('CLIENT_', '')})
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-slate-400">Strg/Cmd für Mehrfachauswahl</p>
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label>Beschreibung</Label>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <RichTextEditor value={description} onChange={setDescription} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Anhänge / Screenshots</Label>
          <label className="flex items-center gap-2 text-sm text-slate-600 border border-dashed border-slate-300 rounded-xl px-4 py-3 cursor-pointer hover:bg-slate-50">
            <Paperclip className="w-4 h-4" />
            Dateien auswählen (max. 5 MB je Datei)
            <input
              type="file"
              className="hidden"
              multiple
              accept="image/*,.pdf,.txt,.log,.zip"
              onChange={(e) => void onFiles(e.target.files)}
            />
          </label>
          {attachments.length > 0 ? (
            <ul className="space-y-1">
              {attachments.map((a) => (
                <li
                  key={`${a.filename}-${a.size}`}
                  className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2"
                >
                  <span className="truncate font-medium">
                    {a.filename} ({Math.round(a.size / 1024)} KB)
                  </span>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-rose-600"
                    onClick={() =>
                      setAttachments((prev) => prev.filter((x) => x.filename !== a.filename))
                    }
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate('/portal/tickets')}>
            Abbrechen
          </Button>
          <Button type="button" disabled={saving} onClick={() => void submit()} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Ticket absenden
          </Button>
        </div>
      </div>
    </div>
  );
}
