import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import type { HeaderTelemetrySnapshot, PiiShieldUiStatus } from '../../types/headerTelemetry';

interface PiiShieldPopoverProps {
  telemetry: HeaderTelemetrySnapshot;
}

function statusLabel(status: PiiShieldUiStatus, t: (key: string, fallback?: string) => string): string {
  if (status === 'active') return `🟢 ${t('header.shielded', 'Geschützt')}`;
  if (status === 'standby') return `🟡 ${t('header.standby', 'Standby')}`;
  return `⚪ ${t('header.inactive', 'Inaktiv')}`;
}

export function PiiShieldPopover({ telemetry }: PiiShieldPopoverProps) {
  const { t } = useTranslation();
  const status = telemetry.pii.status;
  const counts = telemetry.pii.counts;
  const active = status === 'active';

  return (
    <div className="shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              title={
                active
                  ? t('header.piiShieldActive', 'PII Shield Active')
                  : t('header.piiShieldInactive', 'PII Shield Inactive')
              }
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-full border transition-all shrink-0 cursor-pointer shadow-xs select-none relative',
                active
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70 border-emerald-100/80'
                  : status === 'standby'
                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100/70 border-amber-100/80'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100/70 border-slate-200/80',
              )}
            >
              <ShieldCheck className="w-4.5 h-4.5" />
              <span
                className={cn(
                  'absolute top-1 right-1 h-2 w-2 rounded-full',
                  active
                    ? 'bg-emerald-500 animate-pulse shadow-[0_0_4px_rgba(16,185,129,0.5)]'
                    : status === 'standby'
                      ? 'bg-amber-400'
                      : 'bg-slate-300',
                )}
              />
            </button>
          }
        />
        <DropdownMenuContent
          align="end"
          className="w-[280px] bg-white border border-slate-100 shadow-xl rounded-xl p-4 z-50 transition-all duration-200"
        >
          <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2.5">
            <div className="p-1 h-6 w-6 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                {t('header.sovereignPiiShield', 'Sovereign PII Shield')}
              </h4>
              <p className="text-[9px] text-slate-500 font-mono">
                {t('header.realtimeAnonymization', 'Real-time Anonymization')}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-2 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {t('header.status', 'Status')}
              </span>
              <span
                className={cn(
                  'text-[10px] font-black uppercase tracking-widest',
                  active ? 'text-emerald-600' : status === 'standby' ? 'text-amber-600' : 'text-slate-500',
                )}
              >
                {statusLabel(status, t)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50/60 border border-slate-100/60 rounded-xl p-2.5 flex flex-col">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  {t('header.emails', 'Emails')}
                </p>
                <p className="text-base font-black text-slate-800 font-mono">{counts.emails}</p>
              </div>
              <div className="bg-slate-50/60 border border-slate-100/60 rounded-xl p-2.5 flex flex-col">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  {t('header.passwords', 'Passwords')}
                </p>
                <p className="text-base font-black text-slate-800 font-mono">{counts.passwords}</p>
              </div>
              <div className="bg-slate-50/60 border border-slate-100/60 rounded-xl p-2.5 flex flex-col">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  {t('header.apiKeys', 'API Keys')}
                </p>
                <p className="text-base font-black text-slate-800 font-mono">{counts.apiKeys}</p>
              </div>
              <div className="bg-slate-50/60 border border-slate-100/60 rounded-xl p-2.5 flex flex-col">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  {t('header.ipAddresses', 'IP Addresses')}
                </p>
                <p className="text-base font-black text-slate-800 font-mono">{counts.ipAddresses}</p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-2.5 text-center">
              <Link
                to="/admin/pii"
                className="text-[9.5px] font-black text-[#1A73E8] hover:underline uppercase tracking-wider font-mono cursor-pointer block py-1 w-full text-center"
              >
                {t('header.configureGuardrails', 'Configure Guardrails →')}
              </Link>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
