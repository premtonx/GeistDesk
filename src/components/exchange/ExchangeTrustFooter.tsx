import React from 'react';
import { Shield, Lock, Flame, BadgeCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';

interface ExchangeTrustFooterProps {
  className?: string;
}

export function ExchangeTrustFooter({ className }: ExchangeTrustFooterProps) {
  const { t } = useTranslation();

  const items = [
    { icon: Lock, key: 'exchange.trust.e2e', default: 'End-to-End Encrypted' },
    { icon: Shield, key: 'exchange.trust.zeroKnowledge', default: 'Zero Knowledge Architecture' },
    { icon: Flame, key: 'exchange.trust.autoBurn', default: 'Auto-Burn Protection' },
    { icon: BadgeCheck, key: 'exchange.trust.compliance', default: 'Enterprise Compliance' },
  ];

  return (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3', className)}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.key}
            className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 flex items-center gap-2.5 shadow-sm"
          >
            <Icon className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-700">{t(item.key, item.default)}</span>
          </div>
        );
      })}
    </div>
  );
}
