import React from 'react';
import { cn } from '../../../lib/utils';
import { MODULE_PAGE_MAX_W, MODULE_PAGE_PX } from './styles';

interface ModulePageContentProps {
  children: React.ReactNode;
  className?: string;
  flush?: boolean;
}

export function ModulePageContent({ children, className, flush }: ModulePageContentProps) {
  return (
    <div className={cn('flex-1 overflow-y-auto min-h-0 custom-scrollbar', className)}>
      <div className={cn(!flush && MODULE_PAGE_PX, 'py-4')}>
        <div className={cn(MODULE_PAGE_MAX_W, 'mx-auto w-full')}>{children}</div>
      </div>
    </div>
  );
}
