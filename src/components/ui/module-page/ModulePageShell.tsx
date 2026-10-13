import { type ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { MODULE_PAGE_PX } from './styles';

interface ModulePageShellProps {
  children: ReactNode;
  className?: string;
  /** When false, shell is a flex column without outer scroll (parent handles scroll). */
  scrollable?: boolean;
}

export function ModulePageShell({ children, className, scrollable = true }: ModulePageShellProps) {
  return (
    <div
      className={cn(
        'flex-1 flex flex-col min-h-0 min-w-0 bg-[#FAFBFC]',
        scrollable && 'overflow-hidden',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ModulePageBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex-1 flex flex-col min-h-0 min-w-0', className)}>
      {children}
    </div>
  );
}

export function ModulePageScrollRegion({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex-1 overflow-y-auto min-h-0 custom-scrollbar', className)}>
      {children}
    </div>
  );
}

export function ModulePageInset({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(MODULE_PAGE_PX, 'py-4', className)}>
      <div className="w-full">{children}</div>
    </div>
  );
}
