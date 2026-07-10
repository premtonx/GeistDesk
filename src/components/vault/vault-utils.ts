export type VaultPermission = 'Owner' | 'Admin' | 'Editor' | 'Viewer';

export interface VaultDefinition {
  id: string;
  emoji: string;
  nameKey: string;
  defaultName: string;
  permissionKey: string;
  defaultPermission: VaultPermission;
}

export const VAULT_DEFINITIONS: VaultDefinition[] = [
  { id: 'local', emoji: '🔒', nameKey: 'vault.vaults.personal', defaultName: 'Personal Vault', permissionKey: 'vault.permissions.owner', defaultPermission: 'Owner' },
  { id: 'shared-company', emoji: '👥', nameKey: 'vault.vaults.sharedCompany', defaultName: 'Shared Company Vault', permissionKey: 'vault.permissions.admin', defaultPermission: 'Admin' },
  { id: 'it-dept', emoji: '🏢', nameKey: 'vault.vaults.itDept', defaultName: 'IT Department Vault', permissionKey: 'vault.permissions.editor', defaultPermission: 'Editor' },
  { id: 'infra', emoji: '⚙', nameKey: 'vault.vaults.infrastructure', defaultName: 'Infrastructure Vault', permissionKey: 'vault.permissions.admin', defaultPermission: 'Admin' },
  { id: 'devops', emoji: '🚀', nameKey: 'vault.vaults.devops', defaultName: 'DevOps Vault', permissionKey: 'vault.permissions.editor', defaultPermission: 'Editor' },
  { id: 'support', emoji: '📞', nameKey: 'vault.vaults.support', defaultName: 'Support Team Vault', permissionKey: 'vault.permissions.viewer', defaultPermission: 'Viewer' },
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

export function resolveCredVaultId(cred: { vaultId?: string }): string {
  if (cred.vaultId) {
    if (cred.vaultId === 'shared') return 'shared-company';
    return cred.vaultId;
  }
  return 'local';
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
