import {
  Folder,
  Shield,
  Server,
  KeyRound,
  Database,
  Cloud,
  type LucideIcon,
} from 'lucide-react';

/** Nested folder node scoped to a vault partition. */
export interface VaultFolderNode {
  id: string;
  name: string;
  icon: VaultFolderIconId;
  parentId: string | null;
  vaultId: string;
  createdAt: number;
  sortOrder?: number;
}

export type VaultFolderIconId =
  | 'folder'
  | 'lock'
  | 'server'
  | 'key'
  | 'database'
  | 'cloud';

export const VAULT_FOLDER_ICON_OPTIONS: {
  id: VaultFolderIconId;
  label: string;
}[] = [
  { id: 'folder', label: 'Ordner' },
  { id: 'lock', label: 'Sicherheit' },
  { id: 'server', label: 'Server' },
  { id: 'key', label: 'Schlüssel' },
  { id: 'database', label: 'Datenbank' },
  { id: 'cloud', label: 'Cloud' },
];

const FOLDER_ICON_MAP: Record<VaultFolderIconId, LucideIcon> = {
  folder: Folder,
  lock: Shield,
  server: Server,
  key: KeyRound,
  database: Database,
  cloud: Cloud,
};

export function resolveFolderIconId(icon?: string | null): VaultFolderIconId {
  if (icon && icon in FOLDER_ICON_MAP) {
    return icon as VaultFolderIconId;
  }
  return 'folder';
}

export function getVaultFolderIcon(icon?: string | null): LucideIcon {
  return FOLDER_ICON_MAP[resolveFolderIconId(icon)];
}

export function resolveCredFolderId(cred: { folderId?: string | null }): string | null {
  return cred.folderId?.trim() ? cred.folderId.trim() : null;
}

export function createVaultFolderId(): string {
  return `folder-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function buildFolderBreadcrumbPath(
  folders: VaultFolderNode[],
  folderId: string | null,
): VaultFolderNode[] {
  if (!folderId) return [];
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: VaultFolderNode[] = [];
  let current = byId.get(folderId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

export function getChildFolders(
  folders: VaultFolderNode[],
  vaultId: string,
  parentId: string | null,
): VaultFolderNode[] {
  return folders
    .filter((f) => f.vaultId === vaultId && f.parentId === parentId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
}

export function flattenFolderOptions(
  folders: VaultFolderNode[],
  vaultId: string,
): { id: string; label: string; depth: number }[] {
  const scoped = folders.filter((f) => f.vaultId === vaultId);
  const result: { id: string; label: string; depth: number }[] = [];

  const walk = (parentId: string | null, depth: number) => {
    getChildFolders(scoped, vaultId, parentId).forEach((folder) => {
      result.push({ id: folder.id, label: folder.name, depth });
      walk(folder.id, depth + 1);
    });
  };

  walk(null, 0);
  return result;
}

export function isFolderDescendant(
  folders: VaultFolderNode[],
  folderId: string,
  potentialAncestorId: string,
): boolean {
  const byId = new Map(folders.map((f) => [f.id, f]));
  let current = byId.get(folderId);
  while (current?.parentId) {
    if (current.parentId === potentialAncestorId) return true;
    current = byId.get(current.parentId);
  }
  return false;
}
