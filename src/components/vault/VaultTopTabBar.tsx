import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { Badge } from '../ui/badge';
import type { VaultDefinition } from './vault-utils';

interface VaultTopTabBarProps {
  vaultDefinitions: VaultDefinition[];
  activeVaultId: string;
  onVaultChange: (id: string) => void;
  vaultCounts: Record<string, number>;
}

export function VaultTopTabBar({
  vaultDefinitions,
  activeVaultId,
  onVaultChange,
  vaultCounts,
}: VaultTopTabBarProps) {
  const { t } = useTranslation();

  return (
    <div className="w-full min-w-0 -mx-1 px-1">
      <div
        role="tablist"
        aria-label={t('vault.sections.vaults', 'Vaults')}
        className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar scroll-smooth"
      >
        {vaultDefinitions.map((vault) => {
          const active = activeVaultId === vault.id;
          const count = vaultCounts[vault.id] ?? 0;
          const label = t(vault.nameKey, vault.defaultName);

          return (
            <button
              key={vault.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onVaultChange(vault.id)}
              className={cn(
                'shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all',
                active
                  ? 'bg-white text-violet-700 border-violet-200 shadow-sm ring-1 ring-violet-100 dark:bg-violet-950/30 dark:text-violet-200 dark:border-violet-800'
                  : 'bg-slate-50/80 text-slate-600 border-transparent hover:bg-white hover:border-slate-200 hover:text-slate-800 dark:bg-slate-900/40 dark:text-slate-400',
              )}
            >
              <span aria-hidden className="text-sm leading-none">
                {vault.emoji}
              </span>
              <span className="whitespace-nowrap">{label}</span>
              <Badge
                variant="outline"
                className={cn(
                  'h-5 min-w-[1.25rem] px-1.5 text-[10px] font-bold tabular-nums border-0',
                  active
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200'
                    : 'bg-slate-200/70 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
                )}
              >
                {count}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}
