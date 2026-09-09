import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import {
  ALL_VAULTS_ID,
  VAULT_DEFINITIONS,
  isCompanySharedVault,
  vaultRoleBadge,
  type VaultBrowseScope,
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

export interface VaultSidebarEntry {
  id: string;
  emoji: string;
  name: string;
  permission?: string;
  kind: 'personal' | 'company';
}

interface VaultLeftSidebarProps {
  activeVaultId: string;
  browseScope: VaultBrowseScope;
  onBrowseScopeChange: (scope: VaultBrowseScope) => void;
  /** When set, hide hardcoded demo partitions that do not exist as real vaults. */
  visibleVaultIds?: string[];
  onVaultChange: (id: string) => void;
  vaultCounts: Record<string, number>;
  dynamicVaults?: Array<{
    id: string;
    emoji: string;
    name: string;
    permission?: string;
    type?: 'personal' | 'shared';
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

function CollapsibleHeader({
  title,
  open,
  onToggle,
  trailing,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1 px-1 mb-2 mt-4 first:mt-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex-1 flex items-center gap-1 min-w-0 text-left"
        aria-expanded={open}
      >
        <ChevronDown
          className={cn(
            'w-3 h-3 text-slate-400 shrink-0 transition-transform',
            !open && '-rotate-90',
          )}
        />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 truncate">
          {title}
        </span>
      </button>
      {trailing}
    </div>
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

function RoleBadge({
  label,
  active,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        'text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap',
        active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
      )}
    >
      {label}
    </span>
  );
}

function PermissionBadge({ vault, active }: { vault: VaultDefinition; active?: boolean }) {
  const { t } = useTranslation();
  const label = vaultRoleBadge(t(vault.permissionKey, vault.defaultPermission), vault.id);
  return <RoleBadge label={label} active={active} />;
}

export function VaultLeftSidebar({
  activeVaultId,
  browseScope,
  onBrowseScopeChange,
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
  const [vaultsOpen, setVaultsOpen] = useState(true);
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const allowedStaticIds = new Set(visibleVaultIds ?? ['local']);
  const staticVaults = VAULT_DEFINITIONS.filter((vault) => allowedStaticIds.has(vault.id));
  const staticIds = new Set(VAULT_DEFINITIONS.map((v) => v.id));
  const extraVaults = dynamicVaults.filter((v) => !staticIds.has(v.id));

  const catalog = useMemo((): VaultSidebarEntry[] => {
    const entries: VaultSidebarEntry[] = staticVaults.map((vault) => ({
      id: vault.id,
      emoji: vault.emoji,
      name: t(vault.nameKey, vault.defaultName),
      permission: vault.defaultPermission,
      kind: isCompanySharedVault({ vaultId: vault.id, scope: vault.scope }) ? 'company' : 'personal',
    }));
    for (const vault of extraVaults) {
      entries.push({
        id: vault.id,
        emoji: vault.emoji,
        name: vault.name,
        permission: vault.permission,
        kind: vault.type === 'shared' || isCompanySharedVault({ vaultId: vault.id, folderType: vault.type })
          ? 'company'
          : 'personal',
      });
    }
    return entries;
  }, [staticVaults, extraVaults, t]);

  const visibleEntries = catalog.filter((entry) => {
    if (browseScope === 'all') return true;
    if (browseScope === 'company') return entry.kind === 'company';
    return entry.kind === 'personal';
  });

  const scopes: { id: VaultBrowseScope; label: string }[] = [
    { id: 'personal', label: t('vault.scope.personal', 'Persönlich') },
    { id: 'company', label: t('vault.scope.company', 'Unternehmen') },
    { id: 'all', label: t('vault.scope.all', 'Alle Vaults') },
  ];

  return (
    <aside className="w-[240px] shrink-0 border-r border-slate-200/80 bg-white flex flex-col min-h-0">
      <div className="p-3 flex-1 overflow-y-auto">
        <CollapsibleHeader
          title={t('vault.sections.vaults', 'Vaults')}
          open={vaultsOpen}
          onToggle={() => setVaultsOpen((v) => !v)}
        />
        {vaultsOpen ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-0.5 p-0.5 rounded-xl bg-slate-100">
              {scopes.map((scope) => (
                <button
                  key={scope.id}
                  type="button"
                  onClick={() => onBrowseScopeChange(scope.id)}
                  className={cn(
                    'px-1 py-1.5 rounded-[10px] text-[9px] font-bold leading-tight transition-colors',
                    browseScope === scope.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  {scope.label}
                </button>
              ))}
            </div>
            <div className="space-y-0.5">
              {browseScope === 'all' ? (
                <NavButton
                  active={activeVaultId === ALL_VAULTS_ID}
                  onClick={() => onVaultChange(ALL_VAULTS_ID)}
                >
                  {t('vault.scope.allEntries', 'Alle Einträge')}
                </NavButton>
              ) : null}
              {visibleEntries.length === 0 ? (
                <p className="px-2.5 py-2 text-[10px] text-slate-400 font-medium">
                  {browseScope === 'company'
                    ? t(
                        'vault.companyEmpty',
                        'Noch kein Unternehmens-Vault. Legen Sie einen geteilten Vault an.',
                      )
                    : t('vault.personalEmpty', 'Kein persönlicher Vault vorhanden.')}
                </p>
              ) : (
                visibleEntries.map((vault) => {
                  const active = activeVaultId === vault.id;
                  const count = vaultCounts[vault.id] ?? 0;
                  const def = VAULT_DEFINITIONS.find((v) => v.id === vault.id);
                  return (
                    <NavButton
                      key={vault.id}
                      active={active}
                      onClick={() => onVaultChange(vault.id)}
                      trailing={
                        <span className="flex items-center gap-1 shrink-0">
                          <span className={cn('text-[10px] tabular-nums', active ? 'text-white/80' : 'text-slate-400')}>
                            {count}
                          </span>
                          {vault.kind === 'company' ? (
                            def ? (
                              <PermissionBadge vault={def} active={active} />
                            ) : (
                              <RoleBadge
                                label={vaultRoleBadge(vault.permission, vault.id)}
                                active={active}
                              />
                            )
                          ) : def ? (
                            <PermissionBadge vault={def} active={active} />
                          ) : (
                            <RoleBadge label={t('vault.permissions.owner', 'Owner')} active={active} />
                          )}
                        </span>
                      }
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span aria-hidden>{vault.emoji}</span>
                        <span className="truncate">{vault.name}</span>
                      </span>
                    </NavButton>
                  );
                })
              )}
              {onCreateVault ? (
                <NavButton onClick={onCreateVault}>
                  <span className="flex items-center gap-2 text-blue-600">
                    <span aria-hidden>＋</span>
                    {t('vault.newVault', 'Neuer Vault')}
                  </span>
                </NavButton>
              ) : null}
            </div>
          </div>
        ) : null}

        <CollapsibleHeader
          title={t('vault.sections.categories', 'Access Categories')}
          open={categoriesOpen}
          onToggle={() => setCategoriesOpen((v) => !v)}
          trailing={
            canManageCategories && onCreateCategory ? (
              <button
                type="button"
                onClick={onCreateCategory}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700"
                title={t('vault.categories.add', 'Add category')}
              >
                <Plus className="w-3 h-3" />
                {t('vault.categories.addShort', 'Add')}
              </button>
            ) : null
          }
        />
        {categoriesOpen ? (
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
        ) : null}

        <CollapsibleHeader
          title={t('vault.sections.smartFilters', 'Smart Filters')}
          open={filtersOpen}
          onToggle={() => setFiltersOpen((v) => !v)}
        />
        {filtersOpen ? (
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
        ) : null}
      </div>
    </aside>
  );
}
