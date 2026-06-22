import React from 'react';
import {
  X,
  Sparkles,
  Shield,
  Eye,
  Clock,
  Mail,
  RefreshCw,
  Ban,
  Download,
  Lock,
  Upload,
  Building2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { exchangePanelClass, exchangeStatusClass, type ExchangeItemRow } from './exchange-utils';

interface ExchangeDetailDrawerProps {
  item: ExchangeItemRow | null;
  onClose: () => void;
  onRotateToken?: (id: string) => void;
  onRevokeAccess?: (id: string) => void;
  onDownloadSecure?: (id: string) => void;
}

function recipientDomain(email: string): string {
  const at = email.indexOf('@');
  return at >= 0 ? email.slice(at + 1) : email;
}

function buildAiSummary(item: ExchangeItemRow, t: (key: string, defaultValue: string) => string): string {
  if (item.name.includes('.sql') || item.name.includes('db')) {
    return t(
      'exchange.drawer.aiSummarySql',
      'SQL dump analyzed: index fragmentation warnings detected. Recommend schema review before production restore.',
    );
  }
  if (item.name.includes('.zip') || item.name.includes('log')) {
    return t(
      'exchange.drawer.aiSummaryLogs',
      'Log archive scanned: connection pool timeout patterns identified. No malware signatures detected.',
    );
  }
  if (item.name.includes('.png') || item.name.includes('.jpg') || item.name.includes('screenshot')) {
    return t(
      'exchange.drawer.aiSummaryImage',
      'Visual diagnostic reviewed: firewall policy error state captured. Compliance posture: acceptable.',
    );
  }
  if (item.type === 'secret') {
    return t(
      'exchange.drawer.aiSummarySecret',
      'Secret payload classified as high-sensitivity credential material. Zero plaintext exposure detected.',
    );
  }
  return t(
    'exchange.drawer.aiSummaryGeneric',
    'Automated scan complete. No critical compliance violations flagged for this exchange artifact.',
  );
}

export function ExchangeDetailDrawer({
  item,
  onClose,
  onRotateToken,
  onRevokeAccess,
  onDownloadSecure,
}: ExchangeDetailDrawerProps) {
  const { t } = useTranslation();

  const statusLabel =
    item?.status === 'Active'
      ? t('exchange.status.active', 'Active')
      : item?.status === 'Burned'
        ? t('exchange.status.burned', 'Burned')
        : item?.status === 'Expired'
          ? t('exchange.status.expired', 'Expired')
          : item?.status === 'Viewed' || (item?.views ?? 0) > 0
            ? t('exchange.status.viewed', 'Viewed')
            : t('exchange.status.pending', 'Pending');

  const securityPolicy =
    item?.type === 'secret'
      ? t('exchange.policy.burnAfterRead', 'Burn after read')
      : t('exchange.policy.malwareScan', 'Malware scan + 48h');

  return (
    <AnimatePresence>
      {item ? (
        <>
          <motion.div
            key="exchange-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="absolute inset-0 z-30 bg-black/20 backdrop-blur-[1px]"
            aria-hidden
          />
          <motion.aside
            key="exchange-drawer-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="absolute inset-y-0 right-0 z-40 w-full max-w-[420px] bg-white border-l border-slate-200/80 shadow-2xl flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label={t('exchange.drawer.ariaLabel', 'Exchange item details')}
          >
            <header className="px-5 py-4 border-b border-slate-100 bg-[#FAFBFC] shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center border shrink-0',
                        item.type === 'secret'
                          ? 'bg-blue-50 border-blue-100 text-blue-600'
                          : 'bg-violet-50 border-violet-100 text-violet-600',
                      )}
                    >
                      {item.type === 'secret' ? (
                        <Lock className="w-3.5 h-3.5" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-lg border shrink-0',
                        exchangeStatusClass(item.status),
                      )}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 leading-snug break-words">{item.name}</h2>
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3 shrink-0" />
                    {item.company}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8 w-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 transition-colors"
                  aria-label={t('exchange.drawer.close', 'Close')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <section className={cn(exchangePanelClass(), 'p-4 space-y-3')}>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('exchange.drawer.diagnostics', 'Diagnostics & Security')}
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                    <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                      <Shield className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide">
                        {t('exchange.drawer.securityPolicy', 'Security policy')}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-800">{securityPolicy}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                    <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                      <Eye className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide">
                        {t('exchange.drawer.views', 'Views / downloads')}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-800 tabular-nums">{item.views}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 col-span-2">
                    <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide">
                        {t('exchange.drawer.expiration', 'Expiration')}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-800">{item.expires}</p>
                  </div>
                </div>
              </section>

              <section className={cn(exchangePanelClass(), 'p-4 space-y-2')}>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  {t('exchange.drawer.authorizedRecipients', 'Authorized recipients')}
                </h3>
                <ul className="space-y-1.5 text-xs">
                  <li className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
                    <span className="font-medium text-slate-700 truncate">{item.recipient}</span>
                    <span className="text-[10px] font-semibold text-blue-600 shrink-0">
                      @{recipientDomain(item.recipient)}
                    </span>
                  </li>
                  {item.ticketId !== 'N/A' ? (
                    <li className="text-[10px] text-slate-400 px-1">
                      {t('exchange.drawer.linkedTicket', 'Linked ticket')}: {item.ticketId}
                    </li>
                  ) : null}
                </ul>
              </section>

              <section className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-xl text-[11px] font-semibold border-slate-200"
                  onClick={() => {
                    onRotateToken?.(item.id);
                    toast.success(t('exchange.drawer.rotateSuccess', 'Token rotation queued.'));
                  }}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  {t('exchange.drawer.rotateToken', 'Rotate Token Key')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-xl text-[11px] font-semibold border-rose-200 text-rose-700 hover:bg-rose-50"
                  onClick={() => {
                    onRevokeAccess?.(item.id);
                    toast.success(t('exchange.drawer.revokeSuccess', 'Access revocation initiated.'));
                  }}
                >
                  <Ban className="w-3.5 h-3.5 mr-1.5" />
                  {t('exchange.drawer.revokeAccess', 'Revoke Access immediately')}
                </Button>
                {item.type === 'request' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-xl text-[11px] font-semibold border-blue-200 text-blue-700 hover:bg-blue-50"
                    onClick={() => {
                      onDownloadSecure?.(item.id);
                      toast.success(t('exchange.drawer.downloadSuccess', 'Secure download channel opened.'));
                    }}
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    {t('exchange.drawer.downloadSecure', 'Download File Securely')}
                  </Button>
                ) : null}
              </section>

              <section className="rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50 to-indigo-50/80 p-4">
                <h3 className="text-xs font-bold text-indigo-800 flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-4 h-4" />
                  {t('exchange.drawer.aiAnalysis', 'AI Analysis')}
                </h3>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {buildAiSummary(item, t)}
                </p>
              </section>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
