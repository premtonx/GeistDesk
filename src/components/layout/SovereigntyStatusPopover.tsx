import { Globe } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { FlagIcon } from '../ui/FlagIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import type { HeaderTelemetrySnapshot } from '../../types/headerTelemetry';

interface SovereigntyStatusPopoverProps {
  telemetry: HeaderTelemetrySnapshot;
}

export function SovereigntyStatusPopover({ telemetry }: SovereigntyStatusPopoverProps) {
  const { t } = useTranslation();
  const sov = telemetry.sovereignty;
  const flagCode = sov.dataResidencyCode === 'de' || sov.dataResidencyCode === 'eu' ? 'de' : undefined;
  const localRoute = sov.processingRoute === 'local';

  return (
    <div className="shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              title={t('header.dataSovereignDe', 'Data Sovereign: DE')}
              className="flex items-center justify-center h-9 w-9 bg-[#EBF5FF] text-[#1E40AF] hover:bg-[#DBEAFE] rounded-full border border-[#BFDBFE]/80 transition-all shrink-0 cursor-pointer shadow-xs select-none relative"
            >
              <Globe className="w-4.5 h-4.5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#3B82F6] animate-pulse shadow-[0_0_4px_rgba(59,130,246,0.5)]" />
            </button>
          }
        />
        <DropdownMenuContent
          align="end"
          className="w-[285px] bg-white border border-slate-100 shadow-xl rounded-xl p-4 z-50 transition-all duration-200"
        >
          <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2.5">
            <div className="p-1 h-6 w-6 rounded-lg bg-[#EBF5FF] border border-[#BFDBFE] flex items-center justify-center text-[#1E40AF]">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                {t('header.sovereignCloudStatus', 'Sovereign Cloud Status')}
              </h4>
              <p className="text-[9px] text-slate-500 font-mono">{sov.deploymentType}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-3">
              <div className="flex flex-col gap-1 text-[11px] pb-2 border-b border-slate-200/50">
                <span className="text-slate-400 font-medium">{t('header.dataResidency', 'Data Residency')}</span>
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  {flagCode ? <FlagIcon code={flagCode} className="w-4 h-3" /> : null}
                  {sov.dataResidency}
                </span>
              </div>
              <div className="flex flex-col gap-1 text-[11px] py-2 border-b border-slate-200/50">
                <span className="text-slate-400 font-medium">{t('header.deploymentType', 'Deployment Type')}</span>
                <span className="font-bold text-slate-800 flex items-center gap-1 text-[#059669]">
                  ✓ {sov.deploymentType}
                </span>
              </div>
              <div className="flex flex-col gap-1 text-[11px] py-2 border-b border-slate-200/50">
                <span className="text-slate-400 font-medium">{t('header.processingRoute', 'Processing Route')}</span>
                <span
                  className={cn(
                    'font-bold flex items-center gap-1',
                    localRoute ? 'text-[#059669]' : 'text-amber-700',
                  )}
                >
                  {localRoute ? '✓' : '↗'} {sov.processingRouteLabel}
                </span>
              </div>
              <div className="flex flex-col gap-1 text-[11px] pt-1">
                <span className="text-slate-400 font-medium">{t('header.slaAuditLog', 'SLA Audit Log')}</span>
                {sov.auditActive ? (
                  <span className="font-bold text-slate-800 flex items-center gap-1 text-[#059669]">
                    ✓ {t('header.auditActive', 'Aktiv')}
                  </span>
                ) : (
                  <span className="font-bold text-slate-500 flex items-center gap-1">
                    {t('header.auditInactive', 'Inaktiv')}
                  </span>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-2.5 text-center">
              <Link
                to="/admin/sovereignty"
                className="text-[9.5px] font-black text-[#1A73E8] hover:underline uppercase tracking-wider font-mono cursor-pointer block py-1 w-full text-center"
              >
                {t('header.sovereigntyCenterLink', 'Sovereignty Center →')}
              </Link>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
