import React from 'react';
import { Sparkles, KeyRound, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';

interface VaultAiSecurityBannerProps {
  rotateCount?: number;
  expiringKeys?: number;
  mfaCoverage?: number;
  isEmpty?: boolean;
}

export function VaultAiSecurityBanner({
  rotateCount = 0,
  expiringKeys = 0,
  mfaCoverage = 0,
  isEmpty = false,
}: VaultAiSecurityBannerProps) {
  const { t } = useTranslation();

  const insights = isEmpty
    ? [
        {
          icon: CheckCircle2,
          text: t('vault.insights.emptyVault', 'Keine Tresor-Einträge — es werden keine Beispieldaten angezeigt.'),
          color: 'text-slate-700 bg-slate-50 border-slate-100',
        },
      ]
    : [
        {
          icon: KeyRound,
          text: t('vault.insights.rotatePasswords', '{{count}} passwords should be rotated').replace('{{count}}', String(rotateCount)),
          color: 'text-amber-700 bg-amber-50 border-amber-100',
        },
        {
          icon: Clock,
          text: t('vault.insights.expiringKeys', '{{count}} API keys expire soon').replace('{{count}}', String(expiringKeys)),
          color: 'text-orange-700 bg-orange-50 border-orange-100',
        },
        {
          icon: ShieldCheck,
          text: t('vault.insights.mfaCoverage', 'MFA enabled on {{percent}}% of accounts').replace('{{percent}}', String(mfaCoverage)),
          color: 'text-emerald-700 bg-emerald-50 border-emerald-100',
        },
        {
          icon: CheckCircle2,
          text: t('vault.insights.noBreaches', 'No security breaches detected'),
          color: 'text-blue-700 bg-blue-50 border-blue-100',
        },
      ];

  return (
    <div className="rounded-2xl border border-blue-100/80 bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/40 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            {isEmpty
              ? t('vault.aiBanner.emptyTitle', 'GeistVault ist leer. Legen Sie Ihren ersten Eintrag an.')
              : t('vault.aiBanner.title', 'Vault security overview')}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {insights.map((item) => (
              <span
                key={item.text}
                className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border', item.color)}
              >
                <item.icon className="w-3 h-3 shrink-0" />
                {item.text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
