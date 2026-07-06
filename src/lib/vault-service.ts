/**
 * GeistVault portfolio service — KeePass-style independent vault instances
 * backed by PostgreSQL JSONB documents (collection: geist_vault_portfolios).
 */

export type VaultPortfolioRole = 'Besitzer' | 'Admin' | 'Bearbeiter' | 'Betrachter';
export type VaultAuthorityScope = 'personal' | 'department' | 'team' | 'global';

export interface VaultPortfolioAssignment {
  userId: string;
  userEmail?: string;
  userName?: string;
  role: VaultPortfolioRole;
}

export interface VaultPortfolio {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
  scope: VaultAuthorityScope;
  encryptionSalt: string;
  assignments: VaultPortfolioAssignment[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface VaultPortfolioInput {
  name: string;
  description?: string;
  emoji?: string;
  scope?: VaultAuthorityScope;
  assignments?: VaultPortfolioAssignment[];
}

export interface AccessibleVaultPortfolio extends VaultPortfolio {
  userRole: VaultPortfolioRole;
}

export interface VaultFolderRecord {
  id: string;
  name: string;
  icon: string;
  parentId: string | null;
  vaultId: string;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface VaultFolderInput {
  name: string;
  icon?: string;
  parentId?: string | null;
  vaultId: string;
  sortOrder?: number;
}

const API_BASE = '/api/credential-vault';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Vault API error (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const credentialVaultService = {
  listPortfolios: () => apiFetch<{ portfolios: VaultPortfolio[] }>('/portfolios'),

  listMyPortfolios: () =>
    apiFetch<{ portfolios: AccessibleVaultPortfolio[] }>('/portfolios/mine'),

  createPortfolio: (input: VaultPortfolioInput) =>
    apiFetch<{ portfolio: VaultPortfolio }>('/portfolios', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updatePortfolio: (id: string, input: Partial<VaultPortfolioInput> & { assignments?: VaultPortfolioAssignment[] }) =>
    apiFetch<{ portfolio: VaultPortfolio }>(`/portfolios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  deletePortfolio: (id: string) =>
    apiFetch<{ success: boolean }>(`/portfolios/${id}`, { method: 'DELETE' }),

  shareVault: (id: string, assignments: VaultPortfolioAssignment[]) =>
    apiFetch<{ portfolio: VaultPortfolio }>(`/portfolios/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ assignments }),
    }),

  listFolders: (vaultId: string) =>
    apiFetch<{ folders: VaultFolderRecord[] }>(`/folders?vaultId=${encodeURIComponent(vaultId)}`),

  createFolder: (input: VaultFolderInput) =>
    apiFetch<{ folder: VaultFolderRecord }>('/folders', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateFolder: (id: string, input: Partial<Omit<VaultFolderInput, 'vaultId'>>) =>
    apiFetch<{ folder: VaultFolderRecord }>(`/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  deleteFolder: (id: string) =>
    apiFetch<{ success: boolean }>(`/folders/${id}`, { method: 'DELETE' }),
};

export const VAULT_ROLE_LABELS: Record<VaultPortfolioRole, string> = {
  Besitzer: 'Owner',
  Admin: 'Admin',
  Bearbeiter: 'Editor',
  Betrachter: 'Viewer',
};

export const VAULT_SCOPE_LABELS: Record<VaultAuthorityScope, { key: string; defaultLabel: string; emoji: string }> = {
  personal: { key: 'vault.authorities.personal', defaultLabel: 'Personal', emoji: '👤' },
  department: { key: 'vault.authorities.department', defaultLabel: 'Department', emoji: '🏢' },
  team: { key: 'vault.authorities.team', defaultLabel: 'Shared Team', emoji: '👥' },
  global: { key: 'vault.authorities.global', defaultLabel: 'Company Global', emoji: '🌐' },
};

export function roleToPermissionKey(role: VaultPortfolioRole): string {
  switch (role) {
    case 'Besitzer':
      return 'vault.permissions.owner';
    case 'Admin':
      return 'vault.permissions.admin';
    case 'Bearbeiter':
      return 'vault.permissions.editor';
    case 'Betrachter':
    default:
      return 'vault.permissions.viewer';
  }
}

export function roleToDefaultPermission(role: VaultPortfolioRole): 'Owner' | 'Admin' | 'Editor' | 'Viewer' {
  switch (role) {
    case 'Besitzer':
      return 'Owner';
    case 'Admin':
      return 'Admin';
    case 'Bearbeiter':
      return 'Editor';
    case 'Betrachter':
    default:
      return 'Viewer';
  }
}
