import { type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import {
  ACCESS_CATEGORIES,
  VAULT_AUTHORITY_SCOPES,
  type VaultAuthorityScope,
} from './vault-utils';
import { VaultFolderSidebarTree } from './VaultFolderSidebarTree';
import type { VaultFolderNode } from './vaultFolderTypes';

export type VaultSmartFilter = 'favorites' | 'recently' | 'pinned' | 'expiring' | 'alerts' | 'archived';

interface VaultLeftSidebarProps {
  activeVaultScope: VaultAuthorityScope;
  selectedCategory: string;
  onCategoryChange: (id: string) => void;
  categoryCounts: Record<string, number>;
  onVaultScopeChange: (scope: VaultAuthorityScope) => void;
  scopeCounts: Partial<Record<VaultAuthorityScope, number>>;
  allowedVaultScope: VaultAuthorityScope;
  smartFilter: VaultSmartFilter | null;
  onSmartFilterChange: (filter: VaultSmartFilter | null) => void;
  smartCounts: Partial<Record<VaultSmartFilter, number>>;
  folders?: VaultFolderNode[];
  vaultId?: string;
  activeFolderId?: string | null;
  onFolderSelect?: (folderId: string | null) => void;
  onCreateFolderIn?: (parentId: string | null) => void;
  folderCounts?: Record<string, number>;
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
  disabled,
  onClick,
  children,
  trailing,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-medium transition-colors',
        disabled && 'opacity-40 pointer-events-none cursor-not-allowed',
        !disabled && active && 'bg-violet-600 text-white shadow-sm',
        !disabled && !active && 'text-slate-700 hover:bg-slate-100',
      )}
    >
      <span className="flex-1 min-w-0 truncate">{children}</span>
      {trailing}
    </button>
  );
}

export function VaultLeftSidebar({
  activeVaultScope,
  selectedCategory,
  onCategoryChange,
  categoryCounts,
  onVaultScopeChange,
  scopeCounts,
  allowedVaultScope,
  smartFilter,
  onSmartFilterChange,
  smartCounts,
  folders = [],
  vaultId = 'local',
  activeFolderId = null,
  onFolderSelect,
  onCreateFolderIn,
  folderCounts,
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
        <SectionTitle>{t('vault.sections.categories', 'Access Categories')}</SectionTitle>
        <div className="space-y-0.5">
          <NavButton active={selectedCategory === 'all'} onClick={() => onCategoryChange('all')}>
            {t('vault.allCategories', 'All categories')}
          </NavButton>
          {ACCESS_CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.id] ?? 0;
            const disabled = count === 0;
            const active = selectedCategory === cat.id;
            return (
              <NavButton
                key={cat.id}
                active={active}
                disabled={disabled}
                onClick={() => onCategoryChange(cat.id)}
                trailing={
                  <span
                    className={cn(
                      'text-[10px] tabular-nums',
                      active ? 'text-white/80' : disabled ? 'text-slate-300' : 'text-slate-400',
                    )}
                  >
                    {count}
                  </span>
                }
              >
                <span className="flex items-center gap-2">
                  <span>{cat.emoji}</span>
                  {t(cat.nameKey, cat.defaultName)}
                </span>
              </NavButton>
            );
          })}
        </div>

        <SectionTitle>{t('vault.sections.authorities', 'Vault Authorities')}</SectionTitle>
        <div className="space-y-0.5">
          {VAULT_AUTHORITY_SCOPES.map((auth) => {
            const active = activeVaultScope === auth.id;
            const count = scopeCounts[auth.id] ?? 0;
            const scopeMismatch = auth.id !== allowedVaultScope;
            const disabled = scopeMismatch || count === 0;
            return (
              <NavButton
                key={auth.id}
                active={active}
                disabled={disabled}
                onClick={() => onVaultScopeChange(auth.id)}
                trailing={
                  <span
                    className={cn(
                      'text-[10px] tabular-nums',
                      active ? 'text-white/80' : disabled ? 'text-slate-300' : 'text-slate-400',
                    )}
                  >
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
          {smartFilters.map((f) => {
            const count = smartCounts[f.id];
            const disabled = count === 0;
            const active = smartFilter === f.id;
            return (
              <NavButton
                key={f.id}
                active={active}
                disabled={disabled}
                onClick={() => onSmartFilterChange(active ? null : f.id)}
                trailing={
                  count !== undefined ? (
                    <span
                      className={cn(
                        'text-[10px] tabular-nums',
                        active ? 'text-white/80' : disabled ? 'text-slate-300' : 'text-slate-400',
                      )}
                    >
                      {count}
                    </span>
                  ) : null
                }
              >
                <span className="flex items-center gap-2">
                  <span>{f.emoji}</span>
                  {t(f.labelKey, f.defaultLabel)}
                </span>
              </NavButton>
            );
          })}
        </div>

        <SectionTitle>📁 DATENSTRUKTUR / FOLDERS</SectionTitle>
        {onFolderSelect && onCreateFolderIn ? (
          <VaultFolderSidebarTree
            folders={folders}
            vaultId={vaultId}
            activeFolderId={activeFolderId}
            onFolderSelect={onFolderSelect}
            onCreateFolderIn={onCreateFolderIn}
            folderCounts={folderCounts}
          />
        ) : null}
      </div>
    </aside>
  );
}
