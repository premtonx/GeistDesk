import { useCallback, useRef } from 'react';
import {
  decryptVaultBlob,
  encryptVaultBlob,
  decryptData,
  encryptData,
  generateVaultKey,
  isLegacyMkEncryptedVault,
  slugifyVaultName,
  unwrapVaultKeyForUser,
  wrapVaultKeyForRecipient,
  wrapVaultKeyWithMasterKey,
  type VaultBlobPayload,
  type WrappedVaultKey,
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
  /** Vault slug this category belongs to (personal or shared). */
  vaultId?: string;
}

export const PERSONAL_VAULT_SLUG = 'local';

export type VaultKeyMap = Map<string, Uint8Array>;

export interface VaultIdentity {
  userId: string;
  email: string;
}

export function buildEmptyBlobPayload(): VaultBlobPayload {
  return { credentials: [], categories: [] };
}

export async function encryptFolderBlob(
  payload: VaultBlobPayload,
  vaultKey: Uint8Array,
): Promise<string> {
  return encryptVaultBlob(payload, vaultKey);
}

export async function decryptFolderBlob(
  encryptedBlob: string,
  vaultKey: Uint8Array,
): Promise<VaultBlobPayload> {
  return decryptVaultBlob(encryptedBlob, vaultKey);
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
  const categoriesForVault = allCategories.filter(
    (cat) => (cat.vaultId || PERSONAL_VAULT_SLUG) === folderSlug,
  );
  return {
    credentials: credentialsForFolder(allCredentials, folderSlug) as unknown as Array<
      Record<string, unknown>
    >,
    categories: (includeCategories ? categoriesForVault : []) as unknown as Array<
      Record<string, unknown>
    >,
  };
}

async function resolveFolderVaultKey(
  folder: CredentialVaultFolder,
  masterKey: Uint8Array,
  identity: VaultIdentity,
): Promise<{ vaultKey: Uint8Array; legacy: boolean }> {
  if (isLegacyMkEncryptedVault(folder.keyWrappers)) {
    // Pre-KEK rows encrypted the blob directly with MK; treat MK as temporary DEK until migrate.
    return { vaultKey: masterKey, legacy: true };
  }
  const vaultKey = await unwrapVaultKeyForUser(folder.keyWrappers, masterKey, identity);
  return { vaultKey, legacy: false };
}

export async function fetchAndDecryptVaults(
  masterKey: Uint8Array,
  identity: VaultIdentity,
): Promise<{
  folders: CredentialVaultFolder[];
  credentials: VaultCredential[];
  categories: VaultCategory[];
  vaultKeys: VaultKeyMap;
}> {
  const folders = await credentialVaultApi.listVaults();
  const credentials: VaultCredential[] = [];
  const categories: VaultCategory[] = [];
  const vaultKeys: VaultKeyMap = new Map();

  for (const folder of folders) {
    try {
      const { vaultKey } = await resolveFolderVaultKey(folder, masterKey, identity);
      vaultKeys.set(folder.slug, vaultKey);
      const blob = await decryptFolderBlob(folder.encryptedBlob, vaultKey);
      for (const cred of blob.credentials) {
        credentials.push({
          ...(cred as unknown as VaultCredential),
          vaultId: folderSlugToVaultId(folder.slug),
        });
      }
      for (const cat of blob.categories) {
        categories.push({
          ...(cat as unknown as VaultCategory),
          vaultId: folderSlugToVaultId(folder.slug),
        });
      }
    } catch {
      throw new Error(
        `Unable to decrypt vault "${folder.name}". Verify your master password or sharing keys.`,
      );
    }
  }

  return { folders, credentials, categories, vaultKeys };
}

/** Build keyWrappers for a new vault: always MK-wrap for owner; hybrid-wrap for shared recipients. */
export async function buildKeyWrappersForVault(params: {
  vaultKey: Uint8Array;
  masterKey: Uint8Array;
  identity: VaultIdentity;
  type: 'personal' | 'shared';
  sharedWith?: string[];
}): Promise<{ wrappers: WrappedVaultKey[]; missingEmails: string[] }> {
  const ownerWrap = await wrapVaultKeyWithMasterKey(params.vaultKey, params.masterKey, {
    userId: params.identity.userId,
    email: params.identity.email,
  });
  const wrappers: WrappedVaultKey[] = [ownerWrap];
  const missingEmails: string[] = [];

  if (params.type !== 'shared' || !params.sharedWith?.length) {
    return { wrappers, missingEmails };
  }

  const memberEmails = [
    ...new Set(
      params.sharedWith
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e && e !== params.identity.email.toLowerCase()),
    ),
  ];
  if (memberEmails.length === 0) return { wrappers, missingEmails };

  const published = await credentialVaultApi.lookupPublicKeys(memberEmails);
  const byEmail = new Map(published.map((k) => [k.email.toLowerCase(), k]));

  for (const email of memberEmails) {
    const publishedKey = byEmail.get(email);
    if (!publishedKey?.publicKey) {
      missingEmails.push(email);
      continue;
    }
    wrappers.push(
      await wrapVaultKeyForRecipient(params.vaultKey, publishedKey.publicKey, {
        userId: publishedKey.userId,
        email,
      }),
    );
  }

  return { wrappers, missingEmails };
}

export async function createVaultFolderOnServer(params: {
  name: string;
  type: 'personal' | 'shared';
  emoji?: string;
  sharedWith?: string[];
  layout?: CreateCredentialVaultPayload['layout'];
  masterKey: Uint8Array;
  identity: VaultIdentity;
  slug?: string;
}): Promise<{ folder: CredentialVaultFolder; vaultKey: Uint8Array; missingEmails: string[] }> {
  const slug = params.slug || slugifyVaultName(params.name);
  const vaultKey = generateVaultKey();
  const { wrappers, missingEmails } = await buildKeyWrappersForVault({
    vaultKey,
    masterKey: params.masterKey,
    identity: params.identity,
    type: params.type,
    sharedWith: params.sharedWith,
  });

  const encryptedBlob = await encryptFolderBlob(buildEmptyBlobPayload(), vaultKey);
  const payload: CreateCredentialVaultPayload = {
    name: params.name.trim(),
    slug,
    type: params.type,
    emoji: params.emoji,
    layout: params.layout,
    sharedWith: params.sharedWith,
    keyWrappers: wrappers,
    encryptedBlob,
    blobVersion: 1,
  };
  const folder = await credentialVaultApi.createVault(payload);
  return { folder, vaultKey, missingEmails };
}

export async function ensureDefaultPersonalVault(
  masterKey: Uint8Array,
  identity: VaultIdentity,
  existingFolders: CredentialVaultFolder[],
  vaultKeys: VaultKeyMap,
): Promise<{ folder: CredentialVaultFolder; vaultKey: Uint8Array }> {
  const personal = existingFolders.find((f) => f.slug === PERSONAL_VAULT_SLUG);
  if (personal) {
    const existingKey = vaultKeys.get(personal.slug);
    if (existingKey) return { folder: personal, vaultKey: existingKey };
    const { vaultKey } = await resolveFolderVaultKey(personal, masterKey, identity);
    vaultKeys.set(personal.slug, vaultKey);
    return { folder: personal, vaultKey };
  }

  const created = await createVaultFolderOnServer({
    name: 'Personal Vault',
    type: 'personal',
    emoji: '🔒',
    slug: PERSONAL_VAULT_SLUG,
    masterKey,
    identity,
  });
  vaultKeys.set(created.folder.slug, created.vaultKey);
  return { folder: created.folder, vaultKey: created.vaultKey };
}

export async function migrateLegacyVaultToKek(params: {
  folder: CredentialVaultFolder;
  credentials: VaultCredential[];
  categories: VaultCategory[];
  masterKey: Uint8Array;
  identity: VaultIdentity;
}): Promise<{ folder: CredentialVaultFolder; vaultKey: Uint8Array; credentials: VaultCredential[] }> {
  if (!isLegacyMkEncryptedVault(params.folder.keyWrappers)) {
    const vaultKey = await unwrapVaultKeyForUser(
      params.folder.keyWrappers,
      params.masterKey,
      params.identity,
    );
    return { folder: params.folder, vaultKey, credentials: params.credentials };
  }

  const vaultKey = generateVaultKey();
  const { wrappers } = await buildKeyWrappersForVault({
    vaultKey,
    masterKey: params.masterKey,
    identity: params.identity,
    type: params.folder.type,
    sharedWith: params.folder.sharedWith,
  });

  const reencrypted: VaultCredential[] = [];
  for (const cred of params.credentials) {
    if ((cred.vaultId || PERSONAL_VAULT_SLUG) !== params.folder.slug) {
      reencrypted.push(cred);
      continue;
    }
    try {
      const plain = await decryptData(cred.encryptedPassword, params.masterKey);
      const encryptedPassword = await encryptData(plain, vaultKey);
      reencrypted.push({ ...cred, encryptedPassword });
    } catch {
      // Leave ciphertext untouched if it was already not MK-encrypted.
      reencrypted.push(cred);
    }
  }

  const payload = buildFolderPayload(
    reencrypted,
    params.categories,
    params.folder.slug,
    true,
  );
  const encryptedBlob = await encryptFolderBlob(payload, vaultKey);
  const folder = await credentialVaultApi.updateVault(params.folder.id, {
    encryptedBlob,
    keyWrappers: wrappers,
    blobVersion: Math.max(2, (params.folder.blobVersion || 1) + 1),
  });

  return { folder, vaultKey, credentials: reencrypted };
}

export function useVaultPersistence() {
  const syncTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const persistFolder = useCallback(
    async (
      folder: CredentialVaultFolder,
      allCredentials: VaultCredential[],
      allCategories: VaultCategory[],
      vaultKey: Uint8Array,
      opts?: {
        keyWrappers?: WrappedVaultKey[];
      },
    ) => {
      const includeCategories = true;
      const payload = buildFolderPayload(
        allCredentials,
        allCategories,
        folder.slug,
        includeCategories,
      );
      const encryptedBlob = await encryptFolderBlob(payload, vaultKey);
      const keyWrappers = opts?.keyWrappers ?? folder.keyWrappers;

      return credentialVaultApi.updateVault(folder.id, {
        encryptedBlob,
        ...(keyWrappers?.length ? { keyWrappers } : {}),
        blobVersion: folder.blobVersion || 1,
      });
    },
    [],
  );

  const schedulePersistFolder = useCallback(
    (
      folder: CredentialVaultFolder,
      allCredentials: VaultCredential[],
      allCategories: VaultCategory[],
      vaultKey: Uint8Array,
      opts?: {
        keyWrappers?: WrappedVaultKey[];
        delayMs?: number;
      },
    ) => {
      const existing = syncTimers.current.get(folder.id);
      if (existing) clearTimeout(existing);
      const delayMs = opts?.delayMs ?? 400;
      const timer = setTimeout(() => {
        void persistFolder(folder, allCredentials, allCategories, vaultKey, opts).catch((err) => {
          console.error('[GeistVault] Failed to persist folder', folder.slug, err);
        });
      }, delayMs);
      syncTimers.current.set(folder.id, timer);
    },
    [persistFolder],
  );

  return { persistFolder, schedulePersistFolder };
}
