import { useCallback, useEffect, useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { clientPortalApi, type PortalMember } from '../../../services/clientPortalApi';

export default function ClientMembersPage() {
  const [members, setMembers] = useState<PortalMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'CLIENT_SUPPORTER' | 'CLIENT_USER'>('CLIENT_USER');
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMembers(await clientPortalApi.listMembers());
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Mitglieder konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error('Name und E-Mail sind erforderlich.');
      return;
    }
    setSaving(true);
    setTempPassword(null);
    try {
      const result = await clientPortalApi.inviteMember({
        name: name.trim(),
        email: email.trim(),
        role,
      });
      setTempPassword(result.temporaryPassword || null);
      setName('');
      setEmail('');
      toast.success('Mitarbeiter angelegt.');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Anlegen fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-10 space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Mitarbeiter & Rollen</h1>
        <p className="text-sm text-slate-500 mt-1">
          Verwalten Sie Kollegen in Ihrer Organisation (CLIENT_USER / CLIENT_SUPPORTER).
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <UserPlus className="w-4 h-4" /> Mitarbeiter einladen
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>E-Mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Rolle</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as 'CLIENT_SUPPORTER' | 'CLIENT_USER')}
            >
              <option value="CLIENT_USER">Mitarbeiter (CLIENT_USER)</option>
              <option value="CLIENT_SUPPORTER">Kunden-Support (CLIENT_SUPPORTER)</option>
            </select>
          </div>
          <Button type="button" disabled={saving} onClick={() => void invite()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Einladen'}
          </Button>
        </div>
        {tempPassword ? (
          <p className="text-xs text-slate-600">
            Temporäres Passwort:{' '}
            <code className="font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded">
              {tempPassword}
            </code>
          </p>
        ) : null}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 font-bold text-left">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">E-Mail</th>
              <th className="px-4 py-3">Rolle</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  Laden…
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                  Noch keine Mitglieder.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold">{m.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{m.email}</td>
                  <td className="px-4 py-3 font-mono text-xs">{m.role}</td>
                  <td className="px-4 py-3">
                    {m.isDeactivated ? (
                      <span className="text-rose-600 text-xs font-bold">Deaktiviert</span>
                    ) : (
                      <span className="text-emerald-700 text-xs font-bold">Aktiv</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
