import { type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import {
  ACCESS_CATEGORIES,
  VAULT_AUTHORITY_SCOPES,
  type VaultDefinition,
  type VaultAuthorityScope,
} from './vault-utils';

export type VaultSmartFilter = 'favorites' | 'recently' | 'pinned' | 'expiring' | 'alerts' | 'archived';

interface VaultLeftSidebarProps {
  vaultDefinitions: VaultDefinition[];
  activeVaultId: string;
  onVaultChange: (id: string) => void;
  vaultCounts: Record<string, number>;
  selectedCategory: string;
  onCategoryChange: (id: string) => void;
  categoryCounts: Record<string, number>;
  activeVaultScope: VaultAuthorityScope | 'all';
  onVaultScopeChange: (scope: VaultAuthorityScope | 'all') => void;
  scopeCounts: Partial<Record<VaultAuthorityScope, number>>;
  smartFilter: VaultSmartFilter | null;
  onSmartFilterChange: (filter: VaultSmartFilter) => void;
  smartCounts: Partial<Record<VaultSmartFilter, number>>;
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

function PermissionBadge({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className={cn(
        'text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
        active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
      )}
    >
      {label}
    </span>
  );
}

export function VaultLeftSidebar({
  vaultDefinitions,
  activeVaultId,
  onVaultChange,
  vaultCounts,
  selectedCategory,
  onCategoryChange,
  categoryCounts,
  activeVaultScope,
  onVaultScopeChange,
  scopeCounts,
  smartFilter,
  onSmartFilterChange,
  smartCounts,
}: VaultLeftSidebarProps) {
  const { t } = useTranslation();

  const smartFilters: { id: VaultSmartFilter; emoji: string; labelKey: string; defaultLabel: string }[] = [
    { id: 'favorites', emoji: '⭐', labelKey: 'vault.filters.favorites', defaultLabel: 'Favorites' },
    { id: 'recently', emoji: '🕒', labelKey: 'vault.filters.recentlyUsed', defaultLabel: 'Recently Used' },
    { id: 'pinned', emoji: '📌', labelKey: 'vault.filters.pinned', defaultLabel: 'Pinned' },
    { id: 'expiring', emoji: '⚠', labelKey: 'vault.filters.expiringSoon', defaultLabel: 'Expiring Soon' },
    { id: 'alerts', emoji: '🚨', labelKey: 'vault.filters.securityAlerts', defaultLabel: 'Security Alerts' },
    { id: 'archived', emoji: '🗑', labelKey: 'vault.filters.archived', defaultLabel: 'Archived' },
  ];

  return (
    <aside className="w-[240px] shrink-0 border-r border-slate-200/80 bg-white flex flex-col">
      <div className="p-3 flex-1 overflow-y-auto custom-scrollbar">
        <SectionTitle>{t('vault.sections.vaults', 'Vaults')}</SectionTitle>
        <div className="space-y-0.5">
          {vaultDefinitions.map((vault) => {
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
                    <PermissionBadge
                      label={t(vault.permissionKey, vault.defaultPermission)}
                      active={active}
                    />
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
        </div>

        <SectionTitle>{t('vault.sections.categories', 'Access Categories')}</SectionTitle>
        <div className="space-y-0.5">
          <NavButton active={selectedCategory === 'all'} onClick={() => onCategoryChange('all')}>
            {t('vault.allCategories', 'All categories')}
          </NavButton>
          {ACCESS_CATEGORIES.map((cat) => (
            <NavButton
              key={cat.id}
              active={selectedCategory === cat.id}
              onClick={() => onCategoryChange(cat.id)}
              trailing={
                <span className={cn('text-[10px] tabular-nums', selectedCategory === cat.id ? 'text-white/80' : 'text-slate-400')}>
                  {categoryCounts[cat.id] ?? 0}
                </span>
              }
            >
              <span className="flex items-center gap-2">
                <span>{cat.emoji}</span>
                {t(cat.nameKey, cat.defaultName)}
              </span>
            </NavButton>
          ))}
        </div>

        <SectionTitle>{t('vault.sections.authorities', 'Vault Authorities')}</SectionTitle>
        <div className="space-y-0.5">
          <NavButton
            active={activeVaultScope === 'all'}
            onClick={() => onVaultScopeChange('all')}
          >
            {t('vault.authorities.allScopes', 'All clearance tiers')}
          </NavButton>
          {VAULT_AUTHORITY_SCOPES.map((auth) => {
            const active = activeVaultScope === auth.id;
            const count = scopeCounts[auth.id] ?? 0;
            return (
              <NavButton
                key={auth.id}
                active={active}
                onClick={() => onVaultScopeChange(auth.id)}
                trailing={
                  <span className={cn('text-[10px] tabular-nums', active ? 'text-white/80' : 'text-slate-400')}>
                    {count}
                  </span>
                }
              >
                {t(auth.nameKey, auth.defaultLabel)}
              </NavButton>
            );
          })}
        </div>

        <SectionTitle>{t('vault.sections.smartFilters', 'Smart Filters')}</SectionTitle>
        <div className="space-y-0.5">
          {smartFilters.map((f) => (
            <NavButton
              key={f.id}
              active={smartFilter === f.id}
              onClick={() => onSmartFilterChange(f.id)}
              trailing={
                smartCounts[f.id] !== undefined ? (
                  <span className={cn('text-[10px] tabular-nums', smartFilter === f.id ? 'text-white/80' : 'text-slate-400')}>
                    {smartCounts[f.id]}
                  </span>
                ) : null
              }
            >
              <span className="flex items-center gap-2">
                <span>{f.emoji}</span>
                {t(f.labelKey, f.defaultLabel)}
              </span>
            </NavButton>
          ))}
        </div>
      </div>
    </aside>
  );
}
