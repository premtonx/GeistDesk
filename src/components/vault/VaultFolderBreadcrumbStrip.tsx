import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  buildFolderBreadcrumbPath,
  getChildFolders,
  getVaultFolderIcon,
  type VaultFolderNode,
} from './vaultFolderTypes';
import {
  VAULT_FOLDER_ACTIVE_CLASS,
  VAULT_FOLDER_INACTIVE_CLASS,
  VAULT_FOLDER_NESTED_ACTIVE_CLASS,
  VAULT_FOLDER_ROOT_ACTIVE_CLASS,
  VAULT_FOLDER_ROOT_INACTIVE_CLASS,
} from './vaultFolderStyles';

export interface VaultFolderBreadcrumbStripProps {
  folders: VaultFolderNode[];
  vaultId: string;
  activeFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  className?: string;
}

const ROOT_ACTIVE_CLASS = VAULT_FOLDER_ROOT_ACTIVE_CLASS;
const ROOT_INACTIVE_CLASS = VAULT_FOLDER_ROOT_INACTIVE_CLASS;
const FOLDER_ACTIVE_CLASS = VAULT_FOLDER_ACTIVE_CLASS;
const FOLDER_INACTIVE_CLASS = VAULT_FOLDER_INACTIVE_CLASS;
const NESTED_ACTIVE_CLASS = VAULT_FOLDER_NESTED_ACTIVE_CLASS;

function FolderChip({
  folder,
  active,
  nested = false,
  onClick,
  compact = false,
}: {
  folder: VaultFolderNode;
  active: boolean;
  nested?: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const Icon = getVaultFolderIcon(folder.icon);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors shrink-0',
        compact && 'px-2.5 py-1 text-[10px]',
        active
          ? nested
            ? NESTED_ACTIVE_CLASS
            : FOLDER_ACTIVE_CLASS
          : FOLDER_INACTIVE_CLASS,
      )}
    >
      <Icon className={cn('shrink-0', compact ? 'w-3 h-3' : 'w-3.5 h-3.5', active && !nested && 'text-emerald-700')} />
      <span className="truncate max-w-[160px]">{folder.name}</span>
    </button>
  );
}

export function VaultFolderBreadcrumbStrip({
  folders,
  vaultId,
  activeFolderId,
  onFolderSelect,
  className,
}: VaultFolderBreadcrumbStripProps) {
  const scopedFolders = folders ?? [];
  const rootFolders = getChildFolders(scopedFolders, vaultId, null);
  const breadcrumb = buildFolderBreadcrumbPath(scopedFolders, activeFolderId);
  const nestedTrail = breadcrumb.length > 1 ? breadcrumb.slice(1) : [];
  const subfolders = activeFolderId
    ? getChildFolders(scopedFolders, vaultId, activeFolderId)
    : [];

  return (
    <div className={cn('rounded-2xl border border-slate-200/80 bg-white p-3 space-y-2.5', className)}>
      {/* Primary folder scope row — synced with sidebar activeFolderId */}
      <div className="flex flex-wrap items-center gap-2 min-h-[32px]">
        <button
          type="button"
          onClick={() => onFolderSelect(null)}
          className={cn(
            'inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors shrink-0',
            activeFolderId === null ? ROOT_ACTIVE_CLASS : ROOT_INACTIVE_CLASS,
          )}
        >
          Alle Einträge
        </button>

        {rootFolders.length > 0 ? (
          <>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
              Ordner
            </span>
            {rootFolders.map((folder) => (
              <FolderChip
                key={folder.id}
                folder={folder}
                active={activeFolderId === folder.id}
                onClick={() => onFolderSelect(folder.id)}
              />
            ))}
          </>
        ) : null}

        {nestedTrail.length > 0 ? (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            {nestedTrail.map((folder, index) => {
              const isLast = index === nestedTrail.length - 1;
              return (
                <div key={folder.id} className="inline-flex items-center gap-2 shrink-0">
                  {index > 0 ? <ChevronRight className="w-3.5 h-3.5 text-slate-300" /> : null}
                  <FolderChip
                    folder={folder}
                    active={isLast && activeFolderId === folder.id}
                    nested={isLast}
                    onClick={() => onFolderSelect(folder.id)}
                    compact={!isLast}
                  />
                </div>
              );
            })}
          </>
        ) : null}
      </div>

      {/* Dynamic subfolder expansion when the active node has children */}
      {activeFolderId && subfolders.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-dashed border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
            Unterordner
          </span>
          {subfolders.map((folder) => (
            <FolderChip
              key={folder.id}
              folder={folder}
              active={activeFolderId === folder.id}
              nested
              compact
              onClick={() => onFolderSelect(folder.id)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
