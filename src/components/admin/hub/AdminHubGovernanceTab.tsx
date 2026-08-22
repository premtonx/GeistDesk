import { useNavigate } from 'react-router-dom';
import { FileText, Shield } from 'lucide-react';
import { Switch } from '../../ui/switch';
import { Button } from '../../ui/button';
import { useTranslation } from '../../../lib/context/I18nContext';
import { AdminHubSectionGrid } from './AdminHubSectionGrid';
import { categoriesForTab } from './adminHubConfig';

const PII_RULES = [
  { id: 'email', nameKey: 'admin.hubGov.ruleEmail', fallback: 'E-Mail-Adressen', enabled: true },
  { id: 'phone', nameKey: 'admin.hubGov.rulePhone', fallback: 'Telefonnummern', enabled: true },
  { id: 'cc', nameKey: 'admin.hubGov.ruleCc', fallback: 'Kreditkarten (PCI)', enabled: true },
  { id: 'address', nameKey: 'admin.hubGov.ruleAddress', fallback: 'Physische Adressen', enabled: false },
  { id: 'ssn', nameKey: 'admin.hubGov.ruleSsn', fallback: 'Sensible IDs (SSN/USt-IdNr)', enabled: true },
];

export function AdminHubGovernanceTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200/80 rounded-[2rem] p-6 xl:p-8 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-500" />
              <div>
                <h2 className="text-lg font-black text-slate-900">{t('admin.hubGov.piiTitle', 'PII Shield')}</h2>
                <p className="text-sm text-slate-500">{t('admin.hubGov.piiSubtitle', 'Anonymization rules applied before model egress.')}</p>
              </div>
            </div>
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => navigate('/admin/pii')}>
              {t('admin.configureSection', 'Configure Section')}
            </Button>
          </div>
          <div className="space-y-3">
            {PII_RULES.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                <span className="text-sm font-semibold text-slate-700">{t(rule.nameKey, rule.fallback)}</span>
                <Switch checked={rule.enabled} disabled aria-readonly />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-[2rem] p-6 xl:p-8 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-500" />
              <div>
                <h2 className="text-lg font-black text-slate-900">{t('admin.hubGov.auditTitle', 'Audit logs')}</h2>
                <p className="text-sm text-slate-500">{t('admin.hubGov.auditSubtitle', 'Immutable protocol trail for redaction and policy events.')}</p>
              </div>
            </div>
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => navigate('/audit')}>
              {t('admin.hubGov.openAudit', 'Open audit log')}
            </Button>
          </div>
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
              {t('admin.hubGov.auditRedaction', 'PII redaction events stream into the legal intercept log.')}
            </li>
            <li className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
              {t('admin.hubGov.auditSovereignty', 'Sovereignty and egress checks are retained for compliance export.')}
            </li>
            <li className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
              {t('admin.hubGov.auditRoles', 'Role changes and vault unlocks appear on the Reports & Auditing page.')}
            </li>
          </ul>
        </div>
      </div>
      <AdminHubSectionGrid categories={categoriesForTab('governance')} />
    </div>
  );
}
