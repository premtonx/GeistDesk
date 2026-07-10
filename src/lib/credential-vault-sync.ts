import { useCallback, useRef } from 'react';
import {
  buildVaultKeySalt,
  decryptVaultBlob,
  encryptVaultBlob,
  slugifyVaultName,
  type VaultBlobPayload,
} from '../lib/credential-vault-crypto';
import {
  credentialVaultApi,
  type CredentialVaultFolder,
  type CreateCredentialVaultPayload,
} from '../services/credentialVaultApi';

export interface VaultCredential {
  id?: number | string;
  type: string;
  label: string;
  username: string;
  encryptedPassword: string;
  host?: string;
  port?: string;
  domain?: string;
  gateway?: string;
  configData?: string;
  notes?: string;
  updatedAt: number;
  icon?: string;
  iconType?: 'preset' | 'custom';
  lastModifiedBy?: string;
  favorite?: boolean;
  deleted?: boolean;
  vaultId?: string;
  visibility?: string;
  owner?: string;
  team?: string;
  department?: string;
  linkedCompany?: string;
  linkedAsset?: string;
  linkedTicket?: string;
  tags?: string[];
  expirationPolicy?: string;
  rotationPolicy?: string;
  totpSecret?: string;
  backupCodes?: string;
  recoveryKeys?: string;
  authenticatorNotes?: string;
  attachments?: { name: string; size: string; type: string }[];
  securitySettings?: Record<string, boolean>;
}

export interface VaultCategory {
  id?: number;
  name: string;
  slug: string;
  icon: string;
}

export const PERSONAL_VAULT_SLUG = 'local';

export function buildEmptyBlobPayload(): VaultBlobPayload {
  return { credentials: [], categories: [] };
}

export async function encryptFolderBlob(
  payload: VaultBlobPayload,
  derivedKey: Uint8Array,
): Promise<string> {
  return encryptVaultBlob(payload, derivedKey);
}

export async function decryptFolderBlob(
  encryptedBlob: string,
  derivedKey: Uint8Array,
): Promise<VaultBlobPayload> {
  return decryptVaultBlob(encryptedBlob, derivedKey);
}

export function folderSlugToVaultId(slug: string): string {
  return slug;
}

export function credentialsForFolder(
  allCredentials: VaultCredential[],
  folderSlug: string,
): VaultCredential[] {
  return allCredentials.filter((cred) => {
    const vaultId = cred.vaultId || PERSONAL_VAULT_SLUG;
    return vaultId === folderSlug;
  });
}

export function buildFolderPayload(
  allCredentials: VaultCredential[],
  allCategories: VaultCategory[],
  folderSlug: string,
  includeCategories: boolean,
): VaultBlobPayload {
  return {
    credentials: credentialsForFolder(allCredentials, folderSlug) as unknown as Array<Record<string, unknown>>,
    categories: (includeCategories ? allCategories : []) as unknown as Array<Record<string, unknown>>,
  };
}

export async function fetchAndDecryptVaults(
  derivedKey: Uint8Array,
): Promise<{
  folders: CredentialVaultFolder[];
  credentials: VaultCredential[];
  categories: VaultCategory[];
}> {
  const folders = await credentialVaultApi.listVaults();
  const credentials: VaultCredential[] = [];
  const categories: VaultCategory[] = [];

  for (const folder of folders) {
    try {
      const blob = await decryptFolderBlob(folder.encryptedBlob, derivedKey);
      for (const cred of blob.credentials) {
        credentials.push({
          ...(cred as unknown as VaultCredential),
          vaultId: folderSlugToVaultId(folder.slug),
        });
      }
      if (folder.slug === PERSONAL_VAULT_SLUG || folder.type === 'personal') {
        for (const cat of blob.categories) {
          categories.push(cat as unknown as VaultCategory);
        }
      }
    } catch {
      throw new Error(
        `Unable to decrypt vault "${folder.name}". Verify your master password.`,
      );
    }
  }

  return { folders, credentials, categories };
}

export async function createVaultFolderOnServer(
  params: {
    name: string;
    type: 'personal' | 'shared';
    emoji?: string;
    sharedWith?: string[];
    derivedKey: Uint8Array;
    slug?: string;
  },
): Promise<CredentialVaultFolder> {
  const slug = params.slug || slugifyVaultName(params.name);
  const encryptedBlob = await encryptFolderBlob(buildEmptyBlobPayload(), params.derivedKey);
  const payload: CreateCredentialVaultPayload = {
    name: params.name.trim(),
    slug,
    type: params.type,
    emoji: params.emoji,
    sharedWith: params.sharedWith,
    encryptedBlob,
    blobVersion: 1,
  };
  return credentialVaultApi.createVault(payload);
}

export async function ensureDefaultPersonalVault(
  derivedKey: Uint8Array,
  existingFolders: CredentialVaultFolder[],
): Promise<CredentialVaultFolder> {
  const personal = existingFolders.find((f) => f.slug === PERSONAL_VAULT_SLUG);
  if (personal) return personal;

  return createVaultFolderOnServer({
    name: 'Personal Vault',
    type: 'personal',
    emoji: '🔒',
    slug: PERSONAL_VAULT_SLUG,
    derivedKey,
  });
}

export function useVaultPersistence() {
  const syncTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const persistFolder = useCallback(
    async (
      folder: CredentialVaultFolder,
      allCredentials: VaultCredential[],
      allCategories: VaultCategory[],
      derivedKey: Uint8Array,
    ) => {
      const includeCategories =
        folder.slug === PERSONAL_VAULT_SLUG || folder.type === 'personal';
      const payload = buildFolderPayload(
        allCredentials,
        allCategories,
        folder.slug,
        includeCategories,
      );
      const encryptedBlob = await encryptFolderBlob(payload, derivedKey);
      return credentialVaultApi.updateVault(folder.id, {
        encryptedBlob,
        blobVersion: 1,
      });
    },
    [],
  );

  const schedulePersistFolder = useCallback(
    (
      folder: CredentialVaultFolder,
      allCredentials: VaultCredential[],
      allCategories: VaultCategory[],
      derivedKey: Uint8Array,
      delayMs = 400,
    ) => {
      const existing = syncTimers.current.get(folder.id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        void persistFolder(folder, allCredentials, allCategories, derivedKey).catch((err) => {
          console.error('[GeistVault] Failed to persist folder', folder.slug, err);
        });
      }, delayMs);
      syncTimers.current.set(folder.id, timer);
    },
    [persistFolder],
  );

  return { persistFolder, schedulePersistFolder };
}
