import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from '../../../lib/context/I18nContext';

interface VaultCredential {
  id?: number | string;
  type: string;
  label: string;
  username: string;
  updatedAt: number;
  notes?: string;
}

interface VaultInsightsFooterProps {
  credentials: VaultCredential[];
  totalCount: number;
  weakCount: number;
  expiringCount: number;
  onSelectCredential: (cred: VaultCredential) => void;
  onViewAllExpiring?: () => void;
}

function isExpiring(c: VaultCredential) {
  return c.label.toLowerCase().includes('aws') || c.type === 'cloud';
}

export function VaultInsightsFooter({
  credentials,
  totalCount,
  weakCount,
  expiringCount,
  onSelectCredential,
  onViewAllExpiring,
}: VaultInsightsFooterProps) {
  const { t } = useTranslation();

  const strongCount = Math.max(0, totalCount - weakCount - expiringCount);
  const mediumCount = expiringCount;
  const strongPct = totalCount > 0 ? Math.round((strongCount / totalCount) * 100) : 75;
  const mediumPct = totalCount > 0 ? Math.round((mediumCount / totalCount) * 100) : 17;
  const weakPct = totalCount > 0 ? Math.round((weakCount / totalCount) * 100) : 8;

  const expiringItems = credentials.filter(isExpiring).slice(0, 3);
  const expiryDays = [18, 11, 7];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[100px] shrink-0">
      {/* Password strength bar */}
      <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-2.5 flex flex-col justify-center min-h-[72px] max-h-[100px]">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
          {t('vault.passwordStrength', 'Password Strength')}
        </p>
        <div className="h-2 rounded-full overflow-hidden flex bg-slate-100">
          <div className="bg-emerald-500 h-full transition-all" style={{ width: `${strongPct}%` }} />
          <div className="bg-amber-400 h-full transition-all" style={{ width: `${mediumPct}%` }} />
          <div className="bg-red-500 h-full transition-all" style={{ width: `${weakPct}%` }} />
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[10px] font-semibold text-slate-500">
          <span className="text-emerald-600">{t('vault.strong', 'Strong')} {strongPct}%</span>
          <span className="text-amber-600">{t('vault.medium', 'Medium')} {mediumPct}%</span>
          <span className="text-red-600">{t('vault.weak', 'Weak')} {weakPct}%</span>
        </div>
      </div>

      {/* Expiring credentials */}
      <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-2.5 flex flex-col justify-center min-h-[72px] max-h-[100px]">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {t('vault.expiringCredentials', 'Expiring Credentials')}
          </p>
          {expiringItems.length > 0 && (
            <button
              type="button"
              onClick={onViewAllExpiring}
              className="text-[10px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
            >
              {t('vault.viewAll', 'View All')}
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="space-y-0.5 overflow-hidden">
          {expiringItems.length === 0 ? (
            <p className="text-[11px] text-slate-400">{t('vault.zeroExpirations', 'No expiring credentials detected.')}</p>
          ) : (
            expiringItems.map((item, idx) => (
              <button
                key={item.id ?? idx}
                type="button"
                onClick={() => onSelectCredential(item)}
                className="w-full flex items-center justify-between text-left text-[11px] hover:bg-slate-50 rounded px-1 -mx-1 transition-colors"
              >
                <span className="font-medium text-slate-700 truncate mr-2">{item.label}</span>
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">
                  {t('vault.expiresInDays', 'Expires in {{count}} days').replace('{{count}}', String(expiryDays[idx] ?? 14))}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
