import React from 'react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { MODULE_PAGE_PX } from '../ui/module-page/styles';

interface MetaPillProps {
  dotClass: string;
  label: string;
}

function MetaPill({ dotClass, label }: MetaPillProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50/80 px-2.5 py-1 text-[11px] font-medium text-slate-600 shrink-0">
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotClass)} aria-hidden />
      {label}
    </span>
  );
}

interface KBPageHeaderProps {
  trailing?: React.ReactNode;
  className?: string;
}

export function KBPageHeader({ trailing, className }: KBPageHeaderProps) {
  const { t } = useTranslation();

  return (
    <header
      className={cn(
        MODULE_PAGE_PX,
        'h-14 min-h-[3.5rem] max-h-14 flex items-center justify-between border-b border-slate-200/80 bg-white shrink-0',
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <h1 className="text-base font-bold tracking-tight text-slate-900 shrink-0">
          {t('kb.pageTitle', 'Knowledge Base')}
        </h1>
        <div className="hidden sm:flex items-center gap-1.5 flex-wrap min-w-0">
          <MetaPill dotClass="bg-emerald-500" label={t('kb.metaPillPublished', 'Published')} />
          <MetaPill dotClass="bg-orange-500" label={t('kb.metaPillDrafts', 'Drafts')} />
          <MetaPill dotClass="bg-violet-500" label={t('kb.metaPillReview', 'Review Required')} />
        </div>
      </div>
      {trailing ? <div className="shrink-0 flex items-center gap-2">{trailing}</div> : null}
    </header>
  );
}
