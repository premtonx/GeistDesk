import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  buildFolderBreadcrumbPath,
  getChildFolders,
  getVaultFolderIcon,
  type VaultFolderNode,
} from './vaultFolderTypes';
import {
  VAULT_FOLDER_ACTIVE_CLASS,
  VAULT_FOLDER_ROOT_ACTIVE_CLASS,
} from './vaultFolderStyles';

export interface VaultFolderSidebarTreeProps {
  folders: VaultFolderNode[];
  vaultId: string;
  activeFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onCreateFolderIn: (parentId: string | null) => void;
  folderCounts?: Record<string, number>;
  className?: string;
}

interface FolderTreeNodeProps {
  folder: VaultFolderNode;
  depth: number;
  folders: VaultFolderNode[];
  vaultId: string;
  activeFolderId: string | null;
  expandedIds: Set<string>;
  onToggleExpand: (folderId: string) => void;
  onFolderSelect: (folderId: string | null) => void;
  onCreateFolderIn: (parentId: string | null) => void;
  folderCounts?: Record<string, number>;
}

function FolderTreeNode({
  folder,
  depth,
  folders,
  vaultId,
  activeFolderId,
  expandedIds,
  onToggleExpand,
  onFolderSelect,
  onCreateFolderIn,
  folderCounts,
}: FolderTreeNodeProps) {
  const children = getChildFolders(folders, vaultId, folder.id);
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(folder.id);
  const isActive = activeFolderId === folder.id;
  const Icon = getVaultFolderIcon(folder.icon);
  const count = folderCounts?.[folder.id] ?? 0;

  const handleChevronClick = (event: MouseEvent) => {
    event.stopPropagation();
    if (hasChildren) onToggleExpand(folder.id);
  };

  const handleAddClick = (event: MouseEvent) => {
    event.stopPropagation();
    onCreateFolderIn(folder.id);
  };

  return (
    <div className="select-none">
      <div
        className={cn(
          'group flex items-center gap-0.5 rounded-lg pr-1 transition-colors',
          isActive
            ? cn(VAULT_FOLDER_ACTIVE_CLASS, 'border')
            : 'text-slate-700 hover:bg-slate-50',
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        <button
          type="button"
          onClick={handleChevronClick}
          aria-label={isExpanded ? 'Ordner einklappen' : 'Ordner ausklappen'}
          className={cn(
            'shrink-0 w-5 h-7 flex items-center justify-center rounded-md transition-colors',
            hasChildren ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100' : 'text-transparent pointer-events-none',
          )}
        >
          <ChevronRight
            className={cn('w-3.5 h-3.5 transition-transform duration-150', isExpanded && 'rotate-90')}
          />
        </button>

        <button
          type="button"
          onClick={() => onFolderSelect(folder.id)}
          className="flex-1 min-w-0 flex items-center gap-2 py-1.5 text-left"
        >
          <Icon className={cn('w-3.5 h-3.5 shrink-0', isActive ? 'text-emerald-700' : 'text-slate-500')} />
          <span className="truncate text-[11px] font-medium leading-none">{folder.name}</span>
          {count > 0 ? (
            <span
              className={cn(
                'ml-auto shrink-0 text-[9px] tabular-nums px-1.5 py-0.5 rounded-full',
                isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500',
              )}
            >
              {count}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={handleAddClick}
          aria-label={`Unterordner in ${folder.name} erstellen`}
          className={cn(
            'shrink-0 w-6 h-6 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity',
            'text-slate-400 hover:text-[#1A73E8] hover:bg-blue-50',
          )}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {hasChildren && isExpanded ? (
        <div className="relative">
          <div
            className="absolute top-0 bottom-2 w-px bg-slate-200/80"
            style={{ left: `${18 + depth * 14}px` }}
          />
          {children.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              folders={folders}
              vaultId={vaultId}
              activeFolderId={activeFolderId}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onFolderSelect={onFolderSelect}
              onCreateFolderIn={onCreateFolderIn}
              folderCounts={folderCounts}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function VaultFolderSidebarTree({
  folders,
  vaultId,
  activeFolderId,
  onFolderSelect,
  onCreateFolderIn,
  folderCounts,
  className,
}: VaultFolderSidebarTreeProps) {
  const rootFolders = useMemo(
    () => getChildFolders(folders ?? [], vaultId, null),
    [folders, vaultId],
  );

  const ancestorIds = useMemo(() => {
    if (!activeFolderId) return [];
    return buildFolderBreadcrumbPath(folders ?? [], activeFolderId).slice(0, -1).map((f) => f.id);
  }, [folders, activeFolderId]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (ancestorIds.length === 0) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      ancestorIds.forEach((id) => next.add(id));
      return next;
    });
  }, [ancestorIds]);

  const toggleExpand = (folderId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const isRootActive = activeFolderId === null;
  const totalInFolders = Object.values(folderCounts ?? {}).reduce((sum, n) => sum + n, 0);

  return (
    <div className={cn('space-y-0.5', className)}>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors',
          isRootActive
            ? cn(VAULT_FOLDER_ROOT_ACTIVE_CLASS, 'border')
            : 'text-slate-700 hover:bg-slate-50 border border-transparent',
        )}
      >
        <button
          type="button"
          onClick={() => onFolderSelect(null)}
          className="flex-1 min-w-0 flex items-center gap-2 text-left"
        >
          <span className="text-sm leading-none">📂</span>
          <span className="truncate text-[11px] font-semibold">Alle Ordner</span>
        </button>
        <button
          type="button"
          onClick={() => onCreateFolderIn(null)}
          aria-label="Root-Ordner erstellen"
          className={cn(
            'shrink-0 w-6 h-6 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity',
            'text-slate-400 hover:text-[#1A73E8] hover:bg-blue-50',
          )}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {rootFolders.length === 0 ? (
        <p className="px-2 py-2 text-[10px] text-slate-400 leading-relaxed">
          Noch keine Ordner. Nutzen Sie <strong>+</strong> oder „Ordner erstellen“.
        </p>
      ) : (
        rootFolders.map((folder) => (
          <FolderTreeNode
            key={folder.id}
            folder={folder}
            depth={0}
            folders={folders ?? []}
            vaultId={vaultId}
            activeFolderId={activeFolderId}
            expandedIds={expandedIds}
            onToggleExpand={toggleExpand}
            onFolderSelect={onFolderSelect}
            onCreateFolderIn={onCreateFolderIn}
            folderCounts={folderCounts}
          />
        ))
      )}

      {totalInFolders > 0 ? (
        <p className="px-2 pt-1 text-[9px] text-slate-400 tabular-nums">
          {totalInFolders} Einträge in Ordnern zugeordnet
        </p>
      ) : null}
    </div>
  );
}
