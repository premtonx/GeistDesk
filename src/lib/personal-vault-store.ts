import { getDocDirect, getDocsDirect, deleteDocDirect, updateDocDirect } from './postgres-backend.js';

const VAULT_FOLDERS = 'vault_folders';
const VAULTS = 'vaults';

export const PERSONAL_VAULT_TYPE = 'personal' as const;
export const PERSONAL_VAULT_ID = 'local';

function isPersonalVaultDocument(doc: Record<string, unknown>, userId: string): boolean {
  const vaultType = String(doc.vaultType || '').toLowerCase();
  if (vaultType === PERSONAL_VAULT_TYPE) {
    const owner = String(doc.ownerId || doc.userId || doc.createdBy || '');
    return !owner || owner === userId;
  }

  const vaultId = String(doc.vaultId || '');
  if (vaultId === PERSONAL_VAULT_ID) {
    const owner = String(doc.ownerId || doc.userId || doc.createdBy || '');
    return owner === userId;
  }

  return false;
}

export async function getPersonalVaultInitialized(userId: string): Promise<boolean> {
  const user = await getDocDirect('users', userId);
  if (!user) return false;
  if (user.personalVaultInitialized === true) return true;
  if (user.personalVaultInitialized === false) return false;

  const folders = await getDocsDirect(VAULT_FOLDERS, []);
  const hasPersonalFolders = folders.some((folder) => isPersonalVaultDocument(folder, userId));
  if (hasPersonalFolders) return true;

  const vaultDocs = await getDocsDirect(VAULTS, []);
  return vaultDocs.some((vault) => isPersonalVaultDocument(vault, userId));
}

export async function setPersonalVaultInitialized(userId: string, initialized: boolean): Promise<void> {
  await updateDocDirect('users', userId, {
    personalVaultInitialized: initialized,
    personalVaultInitializedAt: initialized ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
  });
}

export interface PersonalVaultPurgeResult {
  deletedFolders: number;
  deletedVaults: number;
}

export async function purgePersonalVaultMetadata(userId: string): Promise<PersonalVaultPurgeResult> {
  const [folders, vaultDocs] = await Promise.all([
    getDocsDirect(VAULT_FOLDERS, []),
    getDocsDirect(VAULTS, []),
  ]);

  const folderIds = folders.filter((folder) => isPersonalVaultDocument(folder, userId)).map((folder) => folder.id);
  const vaultIds = vaultDocs.filter((vault) => isPersonalVaultDocument(vault, userId)).map((vault) => vault.id);

  await Promise.all([
    ...folderIds.map((id) => deleteDocDirect(VAULT_FOLDERS, id)),
    ...vaultIds.map((id) => deleteDocDirect(VAULTS, id)),
  ]);

  await setPersonalVaultInitialized(userId, false);

  return {
    deletedFolders: folderIds.length,
    deletedVaults: vaultIds.length,
  };
}

export async function countPersonalVaultMetadata(userId: string): Promise<{ folders: number; vaults: number }> {
  const [folders, vaultDocs] = await Promise.all([
    getDocsDirect(VAULT_FOLDERS, []),
    getDocsDirect(VAULTS, []),
  ]);

  return {
    folders: folders.filter((folder) => isPersonalVaultDocument(folder, userId)).length,
    vaults: vaultDocs.filter((vault) => isPersonalVaultDocument(vault, userId)).length,
  };
}
