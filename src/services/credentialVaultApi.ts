import { getSessionToken } from '../lib/firebase-custom-client';

export type CredentialVaultType = 'personal' | 'shared';

export interface CredentialVaultLayout {
  permission?: string;
  sortOrder?: number;
  collapsed?: boolean;
  color?: string;
}

export interface CredentialVaultFolder {
  id: string;
  name: string;
  slug: string;
  type: CredentialVaultType;
  emoji?: string;
  layout?: CredentialVaultLayout;
  createdBy: string;
  ownerEmail?: string;
  sharedWith?: string[];
  encryptedBlob: string;
  blobVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCredentialVaultPayload {
  name: string;
  slug?: string;
  type: CredentialVaultType;
  emoji?: string;
  layout?: CredentialVaultLayout;
  sharedWith?: string[];
  encryptedBlob: string;
  blobVersion?: number;
}

export interface UpdateCredentialVaultPayload {
  name?: string;
  emoji?: string;
  layout?: CredentialVaultLayout;
  sharedWith?: string[];
  encryptedBlob?: string;
  blobVersion?: number;
}

function authHeaders(): Record<string, string> {
  const token = getSessionToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error || `Credential vault request failed (${res.status})`);
  }
  return data as T;
}

export const credentialVaultApi = {
  async listVaults(): Promise<CredentialVaultFolder[]> {
    const res = await fetch('/api/credential-vault/vaults', {
      method: 'GET',
      headers: authHeaders(),
    });
    const data = await parseResponse<{ vaults: CredentialVaultFolder[] }>(res);
    return data.vaults ?? [];
  },

  async createVault(payload: CreateCredentialVaultPayload): Promise<CredentialVaultFolder> {
    const res = await fetch('/api/credential-vault/vaults', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await parseResponse<{ vault: CredentialVaultFolder }>(res);
    return data.vault;
  },

  async updateVault(id: string, payload: UpdateCredentialVaultPayload): Promise<CredentialVaultFolder> {
    const res = await fetch(`/api/credential-vault/vaults/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await parseResponse<{ vault: CredentialVaultFolder }>(res);
    return data.vault;
  },

  async deleteVault(id: string): Promise<void> {
    const res = await fetch(`/api/credential-vault/vaults/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    await parseResponse<{ success: boolean }>(res);
  },
};
