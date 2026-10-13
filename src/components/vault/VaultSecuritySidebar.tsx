import { type ReactNode } from 'react';
import { Shield, Key, RotateCcw, History, Eye, Share2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { formatUpdated } from './vault-utils';

interface ActivityCred {
  id?: number | string;
  label: string;
  username: string;
  updatedAt: number;
}

interface VaultSecuritySidebarProps {
  strengthPercent: number;
  mfaCoverage: number;
  rotationDue: number;
  recentViewed: ActivityCred[];
  recentModified: ActivityCred[];
  sharedItems: ActivityCred[];
  auditEventCount?: number;
}

export function VaultSecuritySidebar({
  strengthPercent,
  mfaCoverage,
  rotationDue,
  recentViewed,
  recentModified,
  sharedItems,
  auditEventCount = 0,
}: VaultSecuritySidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="hidden xl:flex w-[260px] shrink-0 flex-col border-l border-slate-200/80 bg-white/80">
      <div className="p-4 space-y-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            {t('vault.securityDashboard', 'Security Dashboard')}
          </h3>
          <div className="space-y-3">
            <MetricBar
              label={t('vault.passwordStrength', 'Password Strength')}
              value={strengthPercent}
              color="bg-emerald-500"
            />
            <MetricBar
              label={t('vault.mfaCoverage', 'MFA Coverage')}
              value={mfaCoverage}
              color="bg-blue-500"
            />
            <div className="rounded-xl border border-slate-200/80 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                {t('vault.rotationStatus', 'Secrets Rotation Status')}
              </div>
              <p className="text-[11px] text-amber-600 font-semibold mt-1">
                {t('vault.rotationDue', '{{count}} due for rotation').replace('{{count}}', String(rotationDue))}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <History className="w-3.5 h-3.5 text-slate-400" />
                {t('vault.accessAuditLog', 'Access Audit Log')}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {t('vault.auditRecent', '{{count}} events in the last 24h').replace('{{count}}', String(auditEventCount))}
              </p>
            </div>
          </div>
        </div>

        <ActivityList
          title={t('vault.recentlyViewed', 'Recently viewed')}
          icon={<Eye className="w-3.5 h-3.5 text-blue-500" />}
          items={recentViewed}
        />
        <ActivityList
          title={t('vault.recentlyModified', 'Recently modified')}
          icon={<Key className="w-3.5 h-3.5 text-violet-500" />}
          items={recentModified}
        />
        <ActivityList
          title={t('vault.sharedCredentials', 'Shared credentials')}
          icon={<Share2 className="w-3.5 h-3.5 text-emerald-500" />}
          items={sharedItems}
        />
      </div>
    </aside>
  );
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 p-3">
      <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-2">
        <span className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          {label}
        </span>
        <span className="tabular-nums font-bold">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ActivityList({
  title,
  icon,
  items,
}: {
  title: string;
  icon: ReactNode;
  items: ActivityCred[];
}) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-slate-200/80 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2">
        {icon}
        {title}
      </div>
      <ul className="space-y-2">
        {items.slice(0, 4).map((item) => (
          <li key={String(item.id)} className="min-w-0">
            <p className="text-[11px] font-medium text-slate-800 truncate">{item.label}</p>
            <p className="text-[10px] text-slate-400 truncate">
              {item.username} · {formatUpdated(item.updatedAt)}
            </p>
          </li>
        ))}
        {items.length === 0 ? (
          <li className="text-[10px] text-slate-400">{t('vault.noRecentActivity', 'No recent activity')}</li>
        ) : null}
      </ul>
    </div>
  );
}
