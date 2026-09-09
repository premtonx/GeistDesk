export type VaultAuthorityScope = 'personal' | 'department' | 'team' | 'global';

export type VaultPermission = 'Owner' | 'Admin' | 'Editor' | 'Viewer';

export interface VaultDefinition {
  id: string;
  emoji: string;
  nameKey: string;
  defaultName: string;
  permissionKey: string;
  defaultPermission: VaultPermission;
  scope?: VaultAuthorityScope;
  isDynamic?: boolean;
}

export const VAULT_DEFINITIONS: VaultDefinition[] = [
  { id: 'local', emoji: '🔒', nameKey: 'vault.vaults.personal', defaultName: 'Personal Vault', permissionKey: 'vault.permissions.owner', defaultPermission: 'Owner', scope: 'personal' },
  { id: 'shared-company', emoji: '👥', nameKey: 'vault.vaults.sharedCompany', defaultName: 'Shared Company Vault', permissionKey: 'vault.permissions.admin', defaultPermission: 'Admin', scope: 'global' },
  { id: 'it-dept', emoji: '🏢', nameKey: 'vault.vaults.itDept', defaultName: 'IT Department Vault', permissionKey: 'vault.permissions.editor', defaultPermission: 'Editor', scope: 'department' },
  { id: 'infra', emoji: '⚙', nameKey: 'vault.vaults.infrastructure', defaultName: 'Infrastructure Vault', permissionKey: 'vault.permissions.admin', defaultPermission: 'Admin', scope: 'team' },
  { id: 'devops', emoji: '🚀', nameKey: 'vault.vaults.devops', defaultName: 'DevOps Vault', permissionKey: 'vault.permissions.editor', defaultPermission: 'Editor', scope: 'team' },
  { id: 'support', emoji: '📞', nameKey: 'vault.vaults.support', defaultName: 'Support Team Vault', permissionKey: 'vault.permissions.viewer', defaultPermission: 'Viewer', scope: 'department' },
];

export const VAULT_AUTHORITY_SCOPES: { id: VaultAuthorityScope; nameKey: string; defaultLabel: string }[] = [
  { id: 'personal', nameKey: 'vault.authorities.personal', defaultLabel: 'Personal' },
  { id: 'department', nameKey: 'vault.authorities.department', defaultLabel: 'Department' },
  { id: 'team', nameKey: 'vault.authorities.team', defaultLabel: 'Shared Team' },
  { id: 'global', nameKey: 'vault.authorities.global', defaultLabel: 'Company Global' },
];

export interface AccessCategoryDef {
  id: string;
  emoji: string;
  nameKey: string;
  defaultName: string;
  types: string[];
}

export const ACCESS_CATEGORIES: AccessCategoryDef[] = [
  { id: 'web', emoji: '🌐', nameKey: 'vault.categories.webLogins', defaultName: 'Web Logins', types: ['web'] },
  { id: 'servers', emoji: '🖥', nameKey: 'vault.categories.servers', defaultName: 'Servers', types: ['rdp', 'ssh'] },
  { id: 'api', emoji: '🔑', nameKey: 'vault.categories.apiKeys', defaultName: 'API Keys', types: ['api'] },
  { id: 'email', emoji: '📧', nameKey: 'vault.categories.email', defaultName: 'Email Accounts', types: ['web'] },
  { id: 'cloud', emoji: '☁', nameKey: 'vault.categories.cloud', defaultName: 'Cloud Platforms', types: ['cloud'] },
  { id: 'db', emoji: '🗄', nameKey: 'vault.categories.databases', defaultName: 'Databases', types: ['db'] },
  { id: 'license', emoji: '📜', nameKey: 'vault.categories.licenses', defaultName: 'Licenses', types: ['cert'] },
  { id: 'ssh', emoji: '🔒', nameKey: 'vault.categories.sshKeys', defaultName: 'SSH Keys', types: ['ssh'] },
  { id: 'billing', emoji: '💳', nameKey: 'vault.categories.billing', defaultName: 'Billing Accounts', types: ['cloud'] },
  { id: 'apps', emoji: '📱', nameKey: 'vault.categories.applications', defaultName: 'Applications', types: ['slack', 'k8s'] },
];

export function resolveCredVaultId(cred: { vaultId?: string }, _index?: number): string {
  if (cred.vaultId) {
    if (cred.vaultId === 'shared') return 'shared-company';
    return cred.vaultId;
  }
  return 'local';
}

export function resolveVaultScope(vaultId: string, vaultDefinitions: VaultDefinition[]): VaultAuthorityScope {
  const match = vaultDefinitions.find((v) => v.id === vaultId);
  return match?.scope ?? 'personal';
}

/** True when the vault is personal (fully category-editable by the owner). */
export function isPersonalVaultContext(params: {
  vaultId: string;
  folderType?: 'personal' | 'shared' | null;
  scope?: VaultAuthorityScope;
}): boolean {
  if (params.vaultId === 'local') return true;
  if (params.folderType === 'personal') return true;
  if (params.scope === 'personal') return true;
  return false;
}

/**
 * Category write RBAC:
 * - Personal vaults: owner can always create/edit/delete categories.
 * - Shared / corporate vaults: only vault Owner/Admin (or platform admin / creator).
 */
export function canManageVaultCategories(params: {
  vaultId: string;
  folder?: {
    type?: 'personal' | 'shared';
    createdBy?: string;
    layout?: { permission?: string };
  } | null;
  vaultDefinition?: VaultDefinition | null;
  userId?: string | null;
  isPlatformAdmin?: boolean;
}): boolean {
  const scope = params.vaultDefinition?.scope ?? resolveVaultScope(params.vaultId, VAULT_DEFINITIONS);
  if (
    isPersonalVaultContext({
      vaultId: params.vaultId,
      folderType: params.folder?.type,
      scope,
    })
  ) {
    return true;
  }

  if (params.isPlatformAdmin) return true;
  if (params.userId && params.folder?.createdBy && params.folder.createdBy === params.userId) {
    return true;
  }

  const permission = String(
    params.folder?.layout?.permission ||
      params.vaultDefinition?.defaultPermission ||
      '',
  )
    .trim()
    .toLowerCase();

  return (
    permission === 'owner' ||
    permission === 'admin' ||
    permission === 'besitzer' ||
    permission === 'administrator'
  );
}

export function isWeakCred(cred: { notes?: string; label: string; username: string }): boolean {
  return (
    cred.notes?.toLowerCase().includes('weak') ||
    cred.label.toLowerCase().includes('database') ||
    cred.username === 'db_admin'
  );
}

export function isExpiringCred(cred: { label: string; type: string }): boolean {
  return cred.label.toLowerCase().includes('aws') || cred.type === 'cloud';
}

export function getAssetStatus(cred: { notes?: string; label: string; username: string; type: string }): 'healthy' | 'warning' | 'expired' | 'review' {
  if (isExpiringCred(cred)) return 'expired';
  if (isWeakCred(cred)) return 'review';
  if (cred.notes?.toLowerCase().includes('audit')) return 'warning';
  return 'healthy';
}

export function formatUpdated(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const ALL_VAULTS_ID = 'all';

export type VaultBrowseScope = 'personal' | 'company' | 'all';

export function isCompanySharedVault(params: {
  vaultId: string;
  folderType?: 'personal' | 'shared' | null;
  scope?: VaultAuthorityScope;
}): boolean {
  if (params.vaultId === ALL_VAULTS_ID) return false;
  if (params.folderType === 'shared') return true;
  if (params.folderType === 'personal') return false;
  if (params.vaultId === 'local') return false;
  if (params.scope && params.scope !== 'personal') return true;
  const def = VAULT_DEFINITIONS.find((v) => v.id === params.vaultId);
  return Boolean(def && def.scope && def.scope !== 'personal');
}

/** Compact role chip for shared/company vaults (Admin, Support, DevOps, …). */
export function vaultRoleBadge(permission?: string | null, vaultId?: string): string {
  const raw = String(permission || '').trim().toLowerCase();
  if (raw === 'admin' || raw === 'administrator') return 'Admin';
  if (raw === 'owner' || raw === 'besitzer') return 'Owner';
  if (raw === 'support' || raw === 'viewer') return 'Support';
  if (raw === 'devops' || raw === 'editor') return vaultId === 'support' ? 'Support' : 'DevOps';
  if (vaultId === 'support') return 'Support';
  if (vaultId === 'devops' || vaultId === 'infra') return 'DevOps';
  if (vaultId === 'shared-company' || vaultId === 'it-dept') return 'Admin';
  if (raw) return permission as string;
  return 'Admin';
}

export function isTypingHotkeyTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}
