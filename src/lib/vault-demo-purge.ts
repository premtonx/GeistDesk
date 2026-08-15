/**
 * Removes leftover GeistVault demo artifacts that older seeds and client
 * unlockers wrote into PostgreSQL. Ciphertext blobs cannot be inspected
 * server-side; those are stripped on unlock via isShowcaseVaultCredential.
 */

const SEEDED_FOLDER_SQL = `
  DELETE FROM geistdesk_documents
   WHERE collection = 'vault_folders'
     AND id LIKE 'folder-seed-%'
`;

export async function purgeSeededVaultFolders(
  exec: (sql: string, params?: unknown[]) => Promise<{ rowCount?: number | null }>,
): Promise<number> {
  const result = await exec(SEEDED_FOLDER_SQL);
  return result.rowCount || 0;
}
