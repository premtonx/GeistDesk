import React from 'react';
import { BadgeCheck, SlidersHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';

import type { ExchangeQuickFilter } from './exchange-utils';
import {
  EXCHANGE_QUICK_FILTER_DEFAULT_TITLES,
  EXCHANGE_QUICK_FILTER_TITLE_KEYS,
} from './exchange-utils';

interface ExchangePageHeaderProps {
  onCustomize?: () => void;
  quickFilter?: ExchangeQuickFilter;
  className?: string;
}

export function ExchangePageHeader({ onCustomize, quickFilter, className }: ExchangePageHeaderProps) {
  const { t } = useTranslation();

  const subtitle = quickFilter
    ? t(
        EXCHANGE_QUICK_FILTER_TITLE_KEYS[quickFilter],
        EXCHANGE_QUICK_FILTER_DEFAULT_TITLES[quickFilter],
      )
    : t(
        'exchange.pageSubtitle',
        'Securely exchange credentials, diagnostics, files and secrets with enterprise-grade protection.',
      );

  return (
    <header className={cn('flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('exchange.pageTitle', 'GeistExchange')}
          </h1>
          <BadgeCheck className="w-5 h-5 text-emerald-500 shrink-0" />
        </div>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
          {subtitle}
        </p>
      </div>
      {onCustomize && !quickFilter ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCustomize}
          className="h-9 rounded-xl text-xs font-semibold border-slate-200/80 shrink-0"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
          {t('exchange.customizeDashboard', 'Customize Dashboard')}
        </Button>
      ) : null}
    </header>
  );
}
