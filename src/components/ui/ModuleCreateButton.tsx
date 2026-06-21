import React from 'react';
import { Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { useTranslation } from '../../lib/context/I18nContext';

export interface ModuleCreateMenuItem {
  labelKey: string;
  labelDefault: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

interface ModuleCreateButtonProps {
  /** Full label for aria-label / title (module-specific). */
  ariaLabelKey: string;
  ariaLabelDefault: string;
  /** Visible desktop text — defaults to actions.createShort ("New" / "Erstellen"). */
  shortLabelKey?: string;
  shortLabelDefault?: string;
  onClick?: () => void;
  menuItems?: ModuleCreateMenuItem[];
  className?: string;
  disabled?: boolean;
}

/**
 * Unified compact create action for module workspaces.
 * Desktop: [+] + short label. Mobile: icon-only circle (min 44px tap target).
 */
export function ModuleCreateButton({
  ariaLabelKey,
  ariaLabelDefault,
  shortLabelKey = 'actions.createShort',
  shortLabelDefault = 'New',
  onClick,
  menuItems,
  className,
  disabled,
}: ModuleCreateButtonProps) {
  const { t } = useTranslation();
  const fullLabel = t(ariaLabelKey, ariaLabelDefault);
  const shortLabel = t(shortLabelKey, shortLabelDefault);

  const trigger = (
    <Button
      type="button"
      disabled={disabled}
      onClick={menuItems?.length ? undefined : onClick}
      title={fullLabel}
      aria-label={fullLabel}
      className={cn(
        'shrink-0 h-10 w-10 sm:h-9 sm:w-auto sm:min-w-[4.5rem]',
        'rounded-full sm:rounded-full',
        'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white',
        'font-bold shadow-sm shadow-blue-600/15',
        'flex items-center justify-center gap-0 sm:gap-1.5',
        'px-0 sm:px-3.5',
        'transition-all hover:scale-[1.02] active:scale-95',
        className,
      )}
    >
      <Plus className="w-4 h-4 shrink-0" strokeWidth={2.5} aria-hidden />
      <span className="hidden sm:inline text-[11px] tracking-tight leading-none">{shortLabel}</span>
    </Button>
  );

  if (menuItems?.length) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={trigger} />
        <DropdownMenuContent
          align="start"
          className="w-52 bg-white border border-slate-200 shadow-xl rounded-xl p-1 z-[100]"
        >
          {menuItems.map((item) => (
            <DropdownMenuItem
              key={item.labelKey}
              onClick={item.onClick}
              className="flex items-center gap-2.5 text-xs font-bold text-slate-700 p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              {item.icon}
              <span>{t(item.labelKey, item.labelDefault)}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return trigger;
}
