import React from 'react';
import { FileArchive, Sparkles, Building2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { exchangePanelClass, type ExchangeItemRow } from './exchange-utils';

interface ExchangeRecentTransfersProps {
  items: ExchangeItemRow[];
  className?: string;
}

export function ExchangeRecentTransfers({ items, className }: ExchangeRecentTransfersProps) {
  const { t } = useTranslation();
  const transfers = items.filter((i) => i.type === 'request' || i.size).slice(0, 4);

  return (
    <section className={className}>
      <h2 className="text-sm font-semibold text-slate-900 mb-3">
        {t('exchange.recentTransfers.title', 'Recent Transfers')}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {transfers.map((item) => (
          <div
            key={item.id}
            className={cn(exchangePanelClass(), 'p-4 hover:shadow-md transition-shadow cursor-pointer group')}
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 border border-violet-100">
                <FileArchive className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-600">{item.name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                  <Building2 className="w-3 h-3 shrink-0" /> {item.company}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] text-slate-400">
                  <span className="font-medium text-slate-600">{item.size ?? '—'}</span>
                  <span>·</span>
                  <span>{item.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </div>
                <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                  <Sparkles className="w-3 h-3" />
                  {item.aiStatus ?? t('exchange.recentTransfers.aiPending', 'AI analysis pending')}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
