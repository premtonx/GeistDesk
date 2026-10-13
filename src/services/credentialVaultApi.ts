import { getSessionToken } from '../lib/firebase-custom-client';
import type { WrappedVaultKey } from '../lib/credential-vault-crypto';

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
  /** Client-wrapped Vault Keys — server never sees raw VK. */
  keyWrappers: WrappedVaultKey[];
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
  keyWrappers: WrappedVaultKey[];
  encryptedBlob: string;
  blobVersion?: number;
}

export interface UpdateCredentialVaultPayload {
  name?: string;
  emoji?: string;
  layout?: CredentialVaultLayout;
  sharedWith?: string[];
  keyWrappers?: WrappedVaultKey[];
  encryptedBlob?: string;
  blobVersion?: number;
}

export interface VaultUserPublicKey {
  userId: string;
  email: string;
  publicKey: string;
  alg: string;
  updatedAt: string;
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

  /** Publish the current user's hybrid vault public key (for shared vault wrapping). */
  async publishPublicKey(publicKey: string): Promise<VaultUserPublicKey> {
    const res = await fetch('/api/credential-vault/public-key', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        publicKey,
        alg: 'HYBRID-MLKEM1024-X25519',
      }),
    });
    const data = await parseResponse<{ key: VaultUserPublicKey }>(res);
    return data.key;
  },

  /** Lookup published vault public keys by email for shared wrapping. */
  async lookupPublicKeys(emails: string[]): Promise<VaultUserPublicKey[]> {
    const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (unique.length === 0) return [];
    const res = await fetch(
      `/api/credential-vault/public-keys?emails=${encodeURIComponent(unique.join(','))}`,
      {
        method: 'GET',
        headers: authHeaders(),
      },
    );
    const data = await parseResponse<{ keys: VaultUserPublicKey[] }>(res);
    return data.keys ?? [];
  },
};
