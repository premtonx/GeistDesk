import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Building2, Loader2, Plus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { useTranslation } from '../../../lib/context/I18nContext';

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  is_active: boolean;
}

export function AdminOrganizationsPanel() {
  const { t } = useTranslation();
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [domain, setDomain] = useState('');
  const [inviteOrgId, setInviteOrgId] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [lastTempPassword, setLastTempPassword] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/organizations', { withCredentials: true });
      setOrganizations(res.data?.organizations || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createOrg = async () => {
    if (!name.trim()) {
      toast.error(t('admin.orgs.nameRequired', 'Organization name is required.'));
      return;
    }
    setSaving(true);
    try {
      await axios.post(
        '/api/admin/organizations',
        {
          name: name.trim(),
          slug: slug.trim() || undefined,
          domain: domain.trim() || null,
          is_active: true,
          settings: {},
        },
        { withCredentials: true },
      );
      setName('');
      setSlug('');
      setDomain('');
      toast.success(t('admin.orgs.created', 'Client organization created.'));
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const inviteAdmin = async () => {
    if (!inviteOrgId || !inviteEmail.trim() || !inviteName.trim()) {
      toast.error(t('admin.orgs.inviteRequired', 'Name and email are required.'));
      return;
    }
    setSaving(true);
    setLastTempPassword(null);
    try {
      const res = await axios.post(
        `/api/admin/organizations/${encodeURIComponent(inviteOrgId)}/invite-client-admin`,
        { name: inviteName.trim(), email: inviteEmail.trim() },
        { withCredentials: true },
      );
      setLastTempPassword(res.data?.temporaryPassword || null);
      setInviteName('');
      setInviteEmail('');
      toast.success(
        t('admin.orgs.invited', 'CLIENT_ADMIN provisioned for this organization.'),
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Invite failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-[2rem] p-6 shadow-sm space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900">
            {t('admin.orgs.title', 'Client Organizations (Kunden)')}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {t(
              'admin.orgs.subtitle',
              'Create MSP client tenants and provision the initial CLIENT_ADMIN for each organization.',
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="space-y-1 md:col-span-1">
          <Label className="text-[10px] font-bold uppercase text-slate-400">
            {t('admin.orgs.name', 'Name')}
          </Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme GmbH" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase text-slate-400">
            {t('admin.orgs.slug', 'Slug')}
          </Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase text-slate-400">
            {t('admin.orgs.domain', 'Domain')}
          </Label>
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="acme.example"
          />
        </div>
        <Button type="button" disabled={saving} onClick={() => void createOrg()} className="gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          {t('admin.orgs.create', 'Create organization')}
        </Button>
      </div>

      <div className="border border-slate-100 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-400 font-bold">
            <tr>
              <th className="px-4 py-3">{t('admin.orgs.colName', 'Organization')}</th>
              <th className="px-4 py-3">{t('admin.orgs.colSlug', 'Slug')}</th>
              <th className="px-4 py-3">{t('admin.orgs.colDomain', 'Domain')}</th>
              <th className="px-4 py-3">{t('admin.orgs.colStatus', 'Status')}</th>
              <th className="px-4 py-3 text-right">{t('admin.orgs.colActions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  {t('admin.orgs.loading', 'Loading…')}
                </td>
              </tr>
            ) : organizations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  {t('admin.orgs.empty', 'No client organizations yet.')}
                </td>
              </tr>
            ) : (
              organizations.map((org) => (
                <tr key={org.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold text-slate-800">{org.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{org.slug}</td>
                  <td className="px-4 py-3 text-slate-600">{org.domain || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        org.is_active
                          ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase'
                          : 'text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase'
                      }
                    >
                      {org.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        setInviteOrgId(org.id);
                        setLastTempPassword(null);
                      }}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {t('admin.orgs.inviteAdmin', 'Invite CLIENT_ADMIN')}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {inviteOrgId ? (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
            {t('admin.orgs.inviteTitle', 'Provision CLIENT_ADMIN')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Name</Label>
              <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Email</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" disabled={saving} onClick={() => void inviteAdmin()}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {t('admin.orgs.provision', 'Provision')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setInviteOrgId(null)}>
                {t('common.cancel', 'Cancel')}
              </Button>
            </div>
          </div>
          {lastTempPassword ? (
            <p className="text-xs text-indigo-800">
              {t('admin.orgs.tempPassword', 'Temporary password')}:{' '}
              <code className="font-mono font-bold bg-white border border-indigo-200 px-1.5 py-0.5 rounded">
                {lastTempPassword}
              </code>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
