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
