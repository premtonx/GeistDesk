import { type ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { MODULE_PAGE_BORDER, MODULE_PAGE_INNER, MODULE_PAGE_PX } from './styles';

export interface ModuleKpiItem {
  id: string;
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
}

interface ModuleKpiGridProps {
  items: ModuleKpiItem[];
  className?: string;
}

export function ModuleKpiCard({
  label,
  value,
  hint,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-white border rounded-lg px-4 py-3 flex flex-col justify-between min-h-[4.5rem]',
        MODULE_PAGE_BORDER,
        className,
      )}
    >
      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide truncate">
        {label}
      </span>
      <div className="flex items-end justify-between gap-2 mt-1.5 min-w-0">
        <span className="text-xl font-semibold text-slate-900 tabular-nums truncate">{value}</span>
        {hint ? <span className="text-[10px] font-medium text-slate-400 shrink-0">{hint}</span> : null}
      </div>
    </div>
  );
}

export function ModuleKpiGrid({ items, className }: ModuleKpiGridProps) {
  if (!items.length) return null;

  return (
    <section
      className={cn(MODULE_PAGE_PX, 'py-4 border-b bg-[#FAFBFC] shrink-0', MODULE_PAGE_BORDER, className)}
    >
      <div
        className={cn(
          MODULE_PAGE_INNER,
          'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3',
        )}
      >
        {items.map((item) => (
          <ModuleKpiCard key={item.id} label={item.label} value={item.value} hint={item.hint} />
        ))}
      </div>
    </section>
  );
}
