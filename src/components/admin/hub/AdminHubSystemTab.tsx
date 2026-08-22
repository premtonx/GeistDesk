import type { ReactNode } from 'react';
import { Database, HardDrive, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../../../lib/context/I18nContext';
import { AdminHubSectionGrid } from './AdminHubSectionGrid';
import { categoriesForTab } from './adminHubConfig';
import type { AdminHubTelemetry } from './adminHubTelemetry';

interface AdminHubSystemTabProps {
  telemetry: AdminHubTelemetry;
}

export function AdminHubSystemTab({ telemetry }: AdminHubSystemTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SystemTile
          icon={<ShieldCheck className="w-4 h-4 text-emerald-500" />}
          label={t('admin.hubSys.health', 'Control plane')}
          value={`${telemetry.systemHealth}%`}
          hint={t('admin.hubSys.healthHint', 'SLA uptime on the sovereign runtime')}
        />
        <SystemTile
          icon={<HardDrive className="w-4 h-4 text-slate-500" />}
          label={t('admin.hubSys.assets', 'Managed records')}
          value={telemetry.assetsManaged.toLocaleString()}
          hint={t('admin.hubSys.assetsHint', 'Tickets, vault items, and directory rows')}
        />
        <SystemTile
          icon={<Database className="w-4 h-4 text-cyan-600" />}
          label={t('admin.hubSys.backup', 'Import & restore')}
          value={t('admin.hubSys.backupValue', 'CSV / JSON')}
          hint={t('admin.hubSys.backupHint', 'Use Data Import for tenant backups and migrations')}
        />
      </div>
      <AdminHubSectionGrid categories={categoriesForTab('system')} />
    </div>
  );
}

function SystemTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-[2rem] p-6 shadow-sm">
      <div className="flex items-center gap-2 text-slate-400 mb-3">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-2xl font-black text-slate-900">{value}</div>
      <p className="text-sm text-slate-500 mt-2">{hint}</p>
    </div>
  );
}
