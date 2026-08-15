import { type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import {
  VAULT_DEFINITIONS,
  type VaultDefinition,
} from './vault-utils';

export type VaultSmartFilter = 'favorites' | 'recently' | 'pinned' | 'expiring' | 'alerts' | 'archived';

export interface VaultSidebarCategory {
  id: string;
  emoji: string;
  label: string;
  count: number;
  isCustom?: boolean;
}

interface VaultLeftSidebarProps {
  activeVaultId: string;
  /** When set, hide hardcoded demo partitions that do not exist as real vaults. */
  visibleVaultIds?: string[];
  onVaultChange: (id: string) => void;
  vaultCounts: Record<string, number>;
  dynamicVaults?: Array<{
    id: string;
    emoji: string;
    name: string;
    permission?: string;
  }>;
  onCreateVault?: () => void;
  /** Categories already scoped to the active vault. */
  categories: VaultSidebarCategory[];
  selectedCategory: string;
  onCategoryChange: (id: string) => void;
  canManageCategories?: boolean;
  onCreateCategory?: () => void;
  onDeleteCategory?: (id: string) => void;
  /** Smart filters already scoped / pruned for the active vault. */
  smartFilters: Array<{
    id: VaultSmartFilter;
    emoji: string;
    label: string;
    count: number;
  }>;
  smartFilter: VaultSmartFilter | null;
  onSmartFilterChange: (filter: VaultSmartFilter) => void;
  collapsed?: boolean;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-2 mt-4 first:mt-0">
      {children}
    </p>
  );
}

function NavButton({
  active,
  onClick,
  children,
  trailing,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-medium transition-colors',
        active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100',
      )}
    >
      <span className="flex-1 min-w-0 truncate">{children}</span>
      {trailing}
    </button>
  );
}

function PermissionBadge({ vault, active }: { vault: VaultDefinition; active?: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
        active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
      )}
    >
      {t(vault.permissionKey, vault.defaultPermission)}
    </span>
  );
}

export function VaultLeftSidebar({
  activeVaultId,
  visibleVaultIds,
  onVaultChange,
  vaultCounts,
  dynamicVaults = [],
  onCreateVault,
  categories,
  selectedCategory,
  onCategoryChange,
  canManageCategories = false,
  onCreateCategory,
  onDeleteCategory,
  smartFilters,
  smartFilter,
  onSmartFilterChange,
}: VaultLeftSidebarProps) {
  const { t } = useTranslation();

  const allowedStaticIds = new Set(visibleVaultIds ?? ['local']);
  const staticVaults = VAULT_DEFINITIONS.filter((vault) => allowedStaticIds.has(vault.id));
  const staticIds = new Set(VAULT_DEFINITIONS.map((v) => v.id));
  const extraVaults = dynamicVaults.filter((v) => !staticIds.has(v.id));

  return (
    <aside className="w-[240px] shrink-0 border-r border-slate-200/80 bg-white flex flex-col">
      <div className="p-3 flex-1 overflow-y-auto">
        <SectionTitle>{t('vault.sections.vaults', 'Vaults')}</SectionTitle>
        <div className="space-y-0.5">
          {staticVaults.map((vault) => {
            const active = activeVaultId === vault.id;
            const count = vaultCounts[vault.id] ?? 0;
            return (
              <NavButton
                key={vault.id}
                active={active}
                onClick={() => onVaultChange(vault.id)}
                trailing={
                  <span className="flex items-center gap-1 shrink-0">
                    <span className={cn('text-[10px] tabular-nums', active ? 'text-white/80' : 'text-slate-400')}>{count}</span>
                    <PermissionBadge vault={vault} active={active} />
                  </span>
                }
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span aria-hidden>{vault.emoji}</span>
                  <span className="truncate">{t(vault.nameKey, vault.defaultName)}</span>
                </span>
              </NavButton>
            );
          })}
          {extraVaults.map((vault) => {
            const active = activeVaultId === vault.id;
            const count = vaultCounts[vault.id] ?? 0;
            return (
              <NavButton
                key={vault.id}
                active={active}
                onClick={() => onVaultChange(vault.id)}
                trailing={
                  <span className={cn('text-[10px] tabular-nums', active ? 'text-white/80' : 'text-slate-400')}>
                    {count}
                  </span>
                }
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span aria-hidden>{vault.emoji}</span>
                  <span className="truncate">{vault.name}</span>
                </span>
              </NavButton>
            );
          })}
          {onCreateVault ? (
            <NavButton onClick={onCreateVault}>
              <span className="flex items-center gap-2 text-blue-600">
                <span aria-hidden>＋</span>
                {t('vault.newVault', 'New Vault')}
              </span>
            </NavButton>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 mt-4 mb-2 px-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {t('vault.sections.categories', 'Access Categories')}
          </p>
          {canManageCategories && onCreateCategory ? (
            <button
              type="button"
              onClick={onCreateCategory}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700"
              title={t('vault.categories.add', 'Add category')}
            >
              <Plus className="w-3 h-3" />
              {t('vault.categories.addShort', 'Add')}
            </button>
          ) : null}
        </div>
        <div className="space-y-0.5">
          <NavButton active={selectedCategory === 'all'} onClick={() => onCategoryChange('all')}>
            {t('vault.allCategories', 'All categories')}
          </NavButton>
          {categories.length === 0 ? (
            <p className="px-2.5 py-2 text-[10px] text-slate-400 font-medium">
              {t('vault.categories.emptyForVault', 'No categories in this vault yet.')}
            </p>
          ) : (
            categories.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <NavButton
                  key={cat.id}
                  active={active}
                  onClick={() => onCategoryChange(cat.id)}
                  trailing={
                    <span className="flex items-center gap-1 shrink-0">
                      <span className={cn('text-[10px] tabular-nums', active ? 'text-white/80' : 'text-slate-400')}>
                        {cat.count}
                      </span>
                      {canManageCategories && cat.isCustom && onDeleteCategory ? (
                        <button
                          type="button"
                          className={cn(
                            'p-0.5 rounded-md transition-colors',
                            active ? 'hover:bg-white/15 text-white/90' : 'hover:bg-slate-200 text-slate-400',
                          )}
                          aria-label={t('vault.categories.delete', 'Delete category')}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteCategory(cat.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      ) : null}
                    </span>
                  }
                >
                  <span className="flex items-center gap-2">
                    <span>{cat.emoji}</span>
                    {cat.label}
                  </span>
                </NavButton>
              );
            })
          )}
        </div>

        <SectionTitle>{t('vault.sections.smartFilters', 'Smart Filters')}</SectionTitle>
        <div className="space-y-0.5">
          {smartFilters.length === 0 ? (
            <p className="px-2.5 py-2 text-[10px] text-slate-400 font-medium">
              {t('vault.filters.emptyForVault', 'No smart views for this vault yet.')}
            </p>
          ) : (
            smartFilters.map((f) => (
              <NavButton
                key={f.id}
                active={smartFilter === f.id}
                onClick={() => onSmartFilterChange(f.id)}
                trailing={
                  <span className={cn('text-[10px] tabular-nums', smartFilter === f.id ? 'text-white/80' : 'text-slate-400')}>
                    {f.count}
                  </span>
                }
              >
                <span className="flex items-center gap-2">
                  <span>{f.emoji}</span>
                  {f.label}
                </span>
              </NavButton>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
