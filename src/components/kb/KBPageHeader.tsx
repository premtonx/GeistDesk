import React from 'react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { MODULE_PAGE_PX } from '../ui/module-page/styles';

interface KBPageHeaderProps {
  className?: string;
  trailing?: React.ReactNode;
}

export function KBPageHeader({ className, trailing }: KBPageHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className={cn(MODULE_PAGE_PX, 'pt-6 pb-4 bg-white shrink-0', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('kb.pageTitle', 'Knowledge Base')}
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            {t(
              'kb.pageSubtitle',
              'Centralized documentation, SOPs, onboarding guides, and AI-powered company knowledge',
            )}
          </p>
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    </header>
  );
}
