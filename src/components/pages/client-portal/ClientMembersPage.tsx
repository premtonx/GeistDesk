import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  KeyRound,
  Loader2,
  Pencil,
  Search,
  Shield,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { cn } from '../../../lib/utils';
import {
  clientPortalApi,
  type PortalMember,
  type PortalTeamRole,
  type PortalTeamSummary,
} from '../../../services/clientPortalApi';

const ROLE_META: Record<
  PortalTeamRole,
  { badge: string; label: string; description: string; tone: string }
> = {
  CLIENT_ADMIN: {
    badge: 'Admin',
    label: 'Client Admin',
    description:
      'Verwaltet Mitarbeiter, Rollen und Einstellungen der Organisation und sieht alle Firmen-Tickets.',
    tone: 'bg-indigo-50 text-indigo-700',
  },
  CLIENT_SUPPORTER: {
    badge: 'Support',
    label: 'Client Supporter',
    description:
      'Sieht und bearbeitet alle Tickets der Organisation, kann Teilnehmer hinzufügen und Tickets schließen.',
    tone: 'bg-violet-50 text-violet-700',
  },
  CLIENT_USER: {
    badge: 'Mitarbeiter',
    label: 'Client User',
    description:
      'Erstellt Tickets und sieht nur eigene Tickets sowie Tickets, zu denen er/sie als Teilnehmer hinzugefügt wurde.',
    tone: 'bg-slate-100 text-slate-700',
  },
};

const EMPTY_SUMMARY: PortalTeamSummary = {
  totalActive: 0,
  clientAdmins: 0,
  clientSupporters: 0,
  clientUsers: 0,
  total: 0,
};

export default function ClientMembersPage() {
  const [members, setMembers] = useState<PortalMember[]>([]);
  const [summary, setSummary] = useState<PortalTeamSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selected, setSelected] = useState<PortalMember | null>(null);

  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<PortalTeamRole>('CLIENT_USER');
  const [inviteResult, setInviteResult] = useState<{
    temporaryPassword?: string;
    setupLink?: string;
    emailSent?: boolean;
  } | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<PortalMember | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await clientPortalApi.listTeam();
      setMembers(data.members);
      setSummary(data.summary);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Team konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q),
    );
  }, [members, search]);

  const openAdd = () => {
    setFormName('');
    setFormEmail('');
    setFormRole('CLIENT_USER');
    setInviteResult(null);
    setAddOpen(true);
  };

  const openEdit = (member: PortalMember) => {
    setSelected(member);
    setFormName(member.name || '');
    setFormRole((member.role as PortalTeamRole) || 'CLIENT_USER');
    setEditOpen(true);
  };

  const submitAdd = async () => {
    if (!formName.trim() || !formEmail.trim()) {
      toast.error('Name und E-Mail sind erforderlich.');
      return;
    }
    setSaving(true);
    try {
      const result = await clientPortalApi.createTeamMember({
        name: formName.trim(),
        email: formEmail.trim(),
        role: formRole,
      });
      setInviteResult({
        temporaryPassword: result.temporaryPassword,
        setupLink: result.setupLink,
        emailSent: result.emailSent,
      });
      toast.success('Mitarbeiter hinzugefügt.');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Anlegen fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await clientPortalApi.updateTeamMember(selected.id, {
        name: formName.trim(),
        role: formRole,
      });
      toast.success('Mitarbeiter aktualisiert.');
      setEditOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Aktualisieren fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const confirmToggleActive = (member: PortalMember) => {
    setPendingDeactivate(member);
    setConfirmOpen(true);
  };

  const applyToggleActive = async () => {
    if (!pendingDeactivate) return;
    const nextActive = pendingDeactivate.isActive === false || pendingDeactivate.isDeactivated === true;
    setSaving(true);
    try {
      await clientPortalApi.updateTeamMember(pendingDeactivate.id, { isActive: nextActive });
      toast.success(nextActive ? 'Mitarbeiter aktiviert.' : 'Mitarbeiter deaktiviert.');
      setConfirmOpen(false);
      setPendingDeactivate(null);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Statusänderung fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (member: PortalMember) => {
    if (!confirm(`Passwort-Reset für ${member.email} auslösen?`)) return;
    setSaving(true);
    try {
      const result = await clientPortalApi.resetTeamMemberPassword(member.id);
      toast.success(
        result.emailSent
          ? 'Reset-E-Mail gesendet.'
          : `Temporäres Passwort: ${result.temporaryPassword || '—'}`,
      );
      if (result.setupLink) {
        toast.message('Setup-Link', { description: result.setupLink });
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Reset fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Mitarbeiter & Rollen</h1>
          <p className="text-sm text-slate-500 mt-1">
            Verwalten Sie Kollegen Ihrer Organisation — nur Client-Rollen, keine Hubcom-Rechte.
          </p>
        </div>
        <Button type="button" className="gap-2" onClick={openAdd}>
          <UserPlus className="w-4 h-4" />
          Mitarbeiter hinzufügen
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          icon={<Users className="w-4 h-4 text-slate-500" />}
          label="Aktive Nutzer"
          value={summary.totalActive}
        />
        <SummaryCard
          icon={<UserCheck className="w-4 h-4 text-violet-600" />}
          label="Client Supporters"
          value={summary.clientSupporters}
        />
        <SummaryCard
          icon={<Shield className="w-4 h-4 text-indigo-600" />}
          label="Client Admins"
          value={summary.clientAdmins}
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Suche nach Name, E-Mail oder Rolle…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 font-bold text-left">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">E-Mail</th>
                <th className="px-4 py-3">Rolle</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Letzter Login</th>
                <th className="px-4 py-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Laden…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    Keine Mitarbeiter gefunden.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const active = m.isActive !== false && m.isDeactivated !== true;
                  const meta = ROLE_META[(m.role as PortalTeamRole) || 'CLIENT_USER'] || ROLE_META.CLIENT_USER;
                  return (
                    <tr key={m.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-semibold text-slate-900">{m.name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{m.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full',
                            meta.tone,
                          )}
                        >
                          {meta.badge}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full',
                            active
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700',
                          )}
                        >
                          {active ? 'Aktiv' : 'Deaktiviert'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {formatDate(m.lastLoginAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-2"
                            onClick={() => openEdit(m)}
                            title="Bearbeiten"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-2"
                            onClick={() => void resetPassword(m)}
                            title="Passwort zurücksetzen"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-xs font-bold"
                            onClick={() => confirmToggleActive(m)}
                          >
                            {active ? 'Deaktivieren' : 'Aktivieren'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mitarbeiter hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>E-Mail</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Rolle</Label>
              <div className="space-y-2">
                {(Object.keys(ROLE_META) as PortalTeamRole[]).map((role) => (
                  <label
                    key={role}
                    className={cn(
                      'flex gap-3 rounded-xl border p-3 cursor-pointer',
                      formRole === role
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <input
                      type="radio"
                      className="mt-1"
                      checked={formRole === role}
                      onChange={() => setFormRole(role)}
                    />
                    <span>
                      <span className="text-sm font-bold block">{ROLE_META[role].label}</span>
                      <span className="text-xs text-slate-500 leading-relaxed">
                        {ROLE_META[role].description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            {inviteResult ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-900 space-y-1">
                {inviteResult.emailSent ? (
                  <p>Einladungs-E-Mail wurde gesendet.</p>
                ) : (
                  <p>E-Mail-Versand nicht konfiguriert — bitte Setup-Daten manuell weitergeben.</p>
                )}
                {inviteResult.temporaryPassword ? (
                  <p>
                    Temporäres Passwort:{' '}
                    <code className="font-mono font-bold">{inviteResult.temporaryPassword}</code>
                  </p>
                ) : null}
                {inviteResult.setupLink ? (
                  <p className="break-all">
                    Setup-Link: <code className="font-mono">{inviteResult.setupLink}</code>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Schließen
            </Button>
            {!inviteResult ? (
              <Button type="button" disabled={saving} onClick={() => void submitAdd()}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Einladen'}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mitarbeiter bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Rolle</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as PortalTeamRole)}
              >
                {(Object.keys(ROLE_META) as PortalTeamRole[]).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_META[role].label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">{ROLE_META[formRole].description}</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Abbrechen
            </Button>
            <Button type="button" disabled={saving} onClick={() => void submitEdit()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate / deactivate confirm */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pendingDeactivate &&
              (pendingDeactivate.isActive === false || pendingDeactivate.isDeactivated === true)
                ? 'Mitarbeiter aktivieren?'
                : 'Mitarbeiter deaktivieren?'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 py-2">
            {pendingDeactivate
              ? pendingDeactivate.isActive === false || pendingDeactivate.isDeactivated === true
                ? `${pendingDeactivate.name || pendingDeactivate.email} wird wieder Zugriff auf das Kunden-Portal erhalten.`
                : `${pendingDeactivate.name || pendingDeactivate.email} verliert den Zugang zum Kunden-Portal. Der letzte aktive Client Admin kann nicht deaktiviert werden.`
              : ''}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Abbrechen
            </Button>
            <Button type="button" disabled={saving} onClick={() => void applyToggleActive()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Bestätigen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-400 mb-2">
        {icon}
        <span className="text-[10px] font-extrabold uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-3xl font-black text-slate-900 tabular-nums">{value}</div>
    </div>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}
