import React from 'react';
import { FolderPlus, Share2, Upload, CheckCircle2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { useTranslation } from '../../../lib/context/I18nContext';
import { cn } from '../../../lib/utils';

interface VaultOverviewProps {
  weakCount: number;
  expiringCount: number;
  onNewFolder: () => void;
  onShareVault: () => void;
  onImportDummyData: () => void;
}

export function VaultOverview({
  weakCount,
  expiringCount,
  onNewFolder,
  onShareVault,
  onImportDummyData,
}: VaultOverviewProps) {
  const { t } = useTranslation();

  const score = Math.max(0, 100 - Math.min(40, weakCount * 12) - Math.min(20, expiringCount * 8));
  const status =
    score >= 90
      ? { text: t('vault.excellent', 'Excellent'), color: 'text-emerald-600', ring: 'border-emerald-500' }
      : score >= 75
        ? { text: t('vault.good', 'Good'), color: 'text-blue-600', ring: 'border-blue-500' }
        : score >= 55
          ? { text: t('vault.needsAttention', 'Needs Attention'), color: 'text-amber-600', ring: 'border-amber-500' }
          : { text: t('vault.criticalRisk', 'Critical Risk'), color: 'text-red-600', ring: 'border-red-500' };

  const checks = [
    t('vault.mfaEnabled', 'MFA Enabled'),
    t('vault.aesGcmKeys', 'AES-GCM Keys'),
    t('vault.noBreaches', 'No Breaches'),
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-[160px] shrink-0">
      {/* Vault Health */}
      <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 flex items-center gap-4 min-h-[88px] max-h-[120px]">
        <div className={cn('h-12 w-12 rounded-full border-[3px] flex items-center justify-center shrink-0 bg-slate-50', status.ring)}>
          <span className="text-sm font-bold text-slate-900 tabular-nums">{score}</span>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t('vault.vaultHealth', 'Vault Health')}</p>
          <p className={cn('text-sm font-semibold', status.color)}>{status.text}</p>
        </div>
      </div>

      {/* Compliance */}
      <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 min-h-[88px] max-h-[120px]">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">{t('vault.complianceChecks', 'Compliance')}</p>
        <div className="space-y-1">
          {checks.map((label) => (
            <div key={label} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 min-h-[88px] max-h-[120px] flex flex-col justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t('vault.quickActions', 'Quick Actions')}</p>
        <div className="grid grid-cols-3 gap-1.5 mt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onNewFolder}
            className="h-7 text-[10px] font-semibold rounded-md border-slate-200/80 px-1 gap-1"
          >
            <FolderPlus className="w-3 h-3 shrink-0" />
            <span className="truncate">{t('vault.newVault', 'New Vault')}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onShareVault}
            className="h-7 text-[10px] font-semibold rounded-md border-slate-200/80 px-1 gap-1"
          >
            <Share2 className="w-3 h-3 shrink-0" />
            <span className="truncate">{t('vault.shareVault', 'Share')}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onImportDummyData}
            className="h-7 text-[10px] font-semibold rounded-md border-slate-200/80 px-1 gap-1"
          >
            <Upload className="w-3 h-3 shrink-0" />
            <span className="truncate">{t('vault.importAssets', 'Import')}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
