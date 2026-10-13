import {
  Clock,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  Database,
  CheckCircle2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { exchangePanelClass } from './exchange-utils';
import {
  formatExchangeBytes,
  type ExchangeAnalyticsCache,
  type ExchangeAuditEntry,
  type ExchangeStorageBreakdown,
} from '../../services/exchangeApi';

export interface ExpiringSidebarRow {
  id: string;
  title: string;
  meta: string;
  tone: string;
}

interface ExchangeSecuritySidebarProps {
  expiringItems?: ExpiringSidebarRow[];
  storage?: ExchangeStorageBreakdown | null;
  analytics?: ExchangeAnalyticsCache | null;
  auditLog?: ExchangeAuditEntry[];
  className?: string;
}

export function ExchangeSecuritySidebar({
  expiringItems = [],
  storage,
  analytics,
  auditLog = [],
  className,
}: ExchangeSecuritySidebarProps) {
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

  const totalBytes = storage?.totalBytes ?? 0;
  const secretsPct = totalBytes > 0 ? Math.round(((storage?.secretsBytes ?? 0) / totalBytes) * 100) : 0;
  const uploadsPct = totalBytes > 0 ? Math.round(((storage?.uploadsBytes ?? 0) / totalBytes) * 100) : 0;
  const diagnosticsPct = Math.max(0, 100 - secretsPct - uploadsPct);
  const insightCards = (analytics?.insights ?? []).slice(0, 2);

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
            <Sparkles className="w-4 h-4" /> {t('exchange.commandCenter.aiInsights', 'KI-Einblicke')}
          </h4>
          <div className="space-y-2 text-xs">
            {insightCards.length > 0 ? (
              insightCards.map((card) => (
                <div
                  key={card.titleKey}
                  className={cn(
                    'flex gap-2 p-2 rounded-xl border',
                    card.tone === 'critical'
                      ? 'bg-rose-50 border-rose-100'
                      : card.tone === 'warning'
                        ? 'bg-amber-50 border-amber-100'
                        : 'bg-blue-50 border-blue-100',
                  )}
                >
                  {card.tone === 'critical' ? (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  ) : (
                    <Database className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold text-slate-900">{t(card.titleKey, card.defaultTitle)}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {card.count} · {t(card.descriptionKey, card.defaultDescription)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[11px] text-slate-400">{t('exchange.aiInsights.empty', 'Noch keine Analysedaten vorhanden.')}</p>
            )}
          </div>
        </div>

        <div className={cn(exchangePanelClass(), 'p-4 space-y-3')}>
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> {t('exchange.commandCenter.expiringSoon', 'Expiring Soon')}
            </h4>
          </div>
          <div className="space-y-2 text-xs">
            {expiringItems.length > 0 ? (
              expiringItems.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{row.title}</p>
                  </div>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0', row.tone)}>{row.meta}</span>
                </div>
              ))
            ) : (
              <p className="text-[11px] text-slate-400">{t('exchange.expiring.empty', 'Keine bald ablaufenden Einträge.')}</p>
            )}
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
            {t('exchange.commandCenter.storageAnalytics', 'Speicheranalyse')}
          </h4>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
            <div className="bg-blue-500 h-full" style={{ width: `${secretsPct}%` }} />
            <div className="bg-violet-500 h-full" style={{ width: `${uploadsPct}%` }} />
            <div className="bg-amber-500 h-full" style={{ width: `${diagnosticsPct}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <span className="text-slate-400">{t('exchange.storage.total', 'Gesamt')}</span>
              <p className="font-bold text-slate-800">{storage ? formatExchangeBytes(storage.totalBytes) : '—'}</p>
            </div>
            <div>
              <span className="text-slate-400">{t('exchange.storage.secrets', 'Geheimnisse')}</span>
              <p className="font-bold text-slate-800">{storage ? formatExchangeBytes(storage.secretsBytes) : '—'}</p>
            </div>
            <div>
              <span className="text-slate-400">{t('exchange.storage.uploads', 'Uploads')}</span>
              <p className="font-bold text-slate-800">{storage ? formatExchangeBytes(storage.uploadsBytes) : '—'}</p>
            </div>
            <div>
              <span className="text-slate-400">{t('exchange.storage.diagnostics', 'Diagnose')}</span>
              <p className="font-bold text-slate-800">{storage ? formatExchangeBytes(storage.diagnosticsBytes) : '—'}</p>
            </div>
          </div>
        </div>

        <div className={cn(exchangePanelClass(), 'p-4')}>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-3">
            <Clock className="w-4 h-4" /> {t('exchange.commandCenter.recentActivity', 'Letzte Aktivität')}
          </h4>
          <div className="space-y-3 relative pl-3 border-l border-slate-100 text-xs">
            {auditLog.length > 0 ? (
              auditLog.map((entry) => (
                <div key={entry.id ?? `${entry.createdAt}-${entry.message}`} className="relative pl-3">
                  <span
                    className={cn(
                      'absolute -left-[13px] top-1.5 h-2 w-2 rounded-full border-2 border-white',
                      entry.action.includes('burned') || entry.action === 'credential_burned'
                        ? 'bg-rose-500'
                        : entry.action.includes('upload')
                          ? 'bg-violet-500'
                          : entry.action.includes('created')
                            ? 'bg-blue-500'
                            : 'bg-indigo-500',
                    )}
                  />
                  <p className="font-semibold text-slate-800">{entry.message}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-[11px] text-slate-400 pl-3">{t('exchange.activity.empty', 'Noch keine Aktivitäten protokolliert.')}</p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
