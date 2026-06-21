import React from 'react';
import { cn } from '../../../lib/utils';
import { MODULE_PAGE_BORDER, MODULE_PAGE_MAX_W, MODULE_PAGE_PX } from './styles';

interface ModulePageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}

export function ModulePageHeader({ title, description, trailing, className }: ModulePageHeaderProps) {
  return (
    <header
      className={cn(
        MODULE_PAGE_PX,
        'py-5 border-b bg-white shrink-0',
        MODULE_PAGE_BORDER,
        className,
      )}
    >
      <div className={cn(MODULE_PAGE_MAX_W, 'mx-auto w-full flex items-start justify-between gap-4')}>
        <div className="min-w-0 space-y-1">
          <h1 className="text-[1.25rem] sm:text-[1.375rem] font-bold tracking-tight text-slate-900 leading-tight">
            {title}
          </h1>
          {description ? (
            <p className="text-sm text-slate-500 leading-snug max-w-2xl">{description}</p>
          ) : null}
        </div>
        {trailing ? <div className="shrink-0 flex items-center gap-2">{trailing}</div> : null}
      </div>
    </header>
  );
}
