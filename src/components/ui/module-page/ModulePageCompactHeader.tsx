import { type ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { MODULE_PAGE_BORDER, MODULE_PAGE_PX } from './styles';

interface ModulePageCompactHeaderProps {
  title: ReactNode;
  /** Inline metadata e.g. "9 Open • 4 Pending • 5 Urgent" */
  meta?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

/** ~56px single-line header — title + muted inline stats, no description block. */
export function ModulePageCompactHeader({ title, meta, trailing, className }: ModulePageCompactHeaderProps) {
  return (
    <header
      className={cn(
        MODULE_PAGE_PX,
        'h-14 min-h-[3.5rem] max-h-14 flex items-center border-b bg-white shrink-0',
        MODULE_PAGE_BORDER,
        className,
      )}
    >
      <div className="w-full flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <h1 className="text-[15px] font-semibold tracking-tight text-slate-900 shrink-0 leading-none">
            {title}
          </h1>
          {meta ? (
            <>
              <span className="text-slate-300 shrink-0 hidden sm:inline" aria-hidden>
                ·
              </span>
              <p className="text-xs text-slate-500 truncate leading-none hidden sm:block">{meta}</p>
            </>
          ) : null}
        </div>
        {trailing ? <div className="shrink-0 flex items-center gap-2">{trailing}</div> : null}
      </div>
    </header>
  );
}
