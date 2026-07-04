import React from 'react';
import {
  Clock,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  Database,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { exchangePanelClass } from './exchange-utils';
import type { ExchangeItemRow } from './exchange-utils';

export interface ExpiringSidebarRow {
  id: string;
  title: string;
  meta: string;
  tone: string;
}

interface ExchangeSecuritySidebarProps {
  expiringItems?: ExpiringSidebarRow[];
  className?: string;
}

export function ExchangeSecuritySidebar({ expiringItems = [], className }: ExchangeSecuritySidebarProps) {
  const { t } = useTranslation();

  const shields = [
    'exchange.shields.e2e',
    'exchange.shields.zeroKnowledge',
    'exchange.shields.malwareScan',
    'exchange.shields.shamir',
    'exchange.shields.auditLog',
    'exchange.shields.autoBurn',
  ];

  const shieldDefaults = [
    'End-to-End Encryption',
    'Zero Knowledge Storage',
    'Malware Scan',
    'Shamir Secret Sharing',
    'Audit Logging',
    'Auto Burn Policies',
  ];

  const activities = [
    { color: 'bg-blue-500', titleKey: 'exchange.activity.secretCreated', default: 'Secret Created', meta: 'Sarah@acme.com • 3m ago' },
    { color: 'bg-indigo-500', titleKey: 'exchange.activity.secretViewed', default: 'Secret Viewed', meta: 'john.doe@client.com • 15m ago' },
    { color: 'bg-rose-500', titleKey: 'exchange.activity.credentialBurned', default: 'Credential Burned', meta: t('exchange.activity.autoBurn', 'Auto burn • 1h ago') },
    { color: 'bg-violet-500', titleKey: 'exchange.activity.dropzoneUploaded', default: 'Dropzone Uploaded', meta: 'Acme Systems • 2h ago' },
    { color: 'bg-emerald-500', titleKey: 'exchange.activity.aiCompleted', default: 'AI Analysis Completed', meta: t('exchange.activity.justNow', 'Just now') },
  ];

  return (
    <aside
      className={cn(
        'w-[300px] shrink-0 border-l border-slate-200/80 bg-white flex flex-col',
        className,
      )}
    >
      <div className="p-4 space-y-5">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            {t('exchange.commandCenter.title', 'Security Command Center')}
          </h3>
        </div>

        <div className={cn(exchangePanelClass(), 'p-4 space-y-3')}>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> {t('exchange.commandCenter.aiInsights', 'AI Insights')}
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex gap-2 p-2 rounded-xl bg-rose-50 border border-rose-100">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-900">{t('exchange.aiInsights.criticalLogs', 'Critical log errors detected')}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">logs.zip • 2 findings</p>
              </div>
            </div>
            <div className="flex gap-2 p-2 rounded-xl bg-amber-50 border border-amber-100">
              <Database className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">{t('exchange.aiInsights.sqlWarnings', 'SQL dump warnings')}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">backup.sql • 3 warnings</p>
              </div>
            </div>
          </div>
        </div>

        <div className={cn(exchangePanelClass(), 'p-4 space-y-3')}>
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> {t('exchange.commandCenter.expiringSoon', 'Expiring Soon')}
            </h4>
          </div>
          <div className="space-y-2 text-xs">
            {(expiringItems.length > 0
              ? expiringItems
              : [
                  { id: 'fallback-1', title: 'Prod Firewall Credentials', meta: '23h', tone: 'text-rose-600 bg-rose-50' },
                  { id: 'fallback-2', title: 'ACME Log Dropzone', meta: '48h', tone: 'text-amber-600 bg-amber-50' },
                  { id: 'fallback-3', title: 'SQL Server Backup link', meta: '7d', tone: 'text-blue-600 bg-blue-50' },
                ]
            ).map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{row.title}</p>
                </div>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0', row.tone)}>{row.meta}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={cn(exchangePanelClass(), 'p-4 space-y-3')}>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> {t('exchange.commandCenter.securityShields', 'Security Shields')}
          </h4>
          <div className="space-y-2">
            {shields.map((key, idx) => (
              <div key={key} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600 font-medium">{t(key, shieldDefaults[idx])}</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              </div>
            ))}
          </div>
        </div>

        <div className={cn(exchangePanelClass(), 'p-4 space-y-3')}>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {t('exchange.commandCenter.storageAnalytics', 'Storage Analytics')}
          </h4>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
            <div className="bg-blue-500 h-full w-[14%]" />
            <div className="bg-violet-500 h-full w-[45%]" />
            <div className="bg-amber-500 h-full w-[15%]" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div><span className="text-slate-400">{t('exchange.storage.total', 'Total')}</span><p className="font-bold text-slate-800">286.7 GB</p></div>
            <div><span className="text-slate-400">{t('exchange.storage.secrets', 'Secrets')}</span><p className="font-bold text-slate-800">12.4 GB</p></div>
            <div><span className="text-slate-400">{t('exchange.storage.uploads', 'Uploads')}</span><p className="font-bold text-slate-800">186.3 GB</p></div>
            <div><span className="text-slate-400">{t('exchange.storage.diagnostics', 'Diagnostics')}</span><p className="font-bold text-slate-800">88.0 GB</p></div>
          </div>
        </div>

        <div className={cn(exchangePanelClass(), 'p-4')}>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-3">
            <Clock className="w-4 h-4" /> {t('exchange.commandCenter.recentActivity', 'Recent Activity')}
          </h4>
          <div className="space-y-3 relative pl-3 border-l border-slate-100 text-xs">
            {activities.map((act) => (
              <div key={act.titleKey} className="relative pl-3">
                <span className={cn('absolute -left-[13px] top-1.5 h-2 w-2 rounded-full border-2 border-white', act.color)} />
                <p className="font-semibold text-slate-800">{t(act.titleKey, act.default)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{act.meta}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
