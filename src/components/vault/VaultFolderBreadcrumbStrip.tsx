import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  buildFolderBreadcrumbPath,
  getChildFolders,
  getVaultFolderIcon,
  type VaultFolderNode,
} from './vaultFolderTypes';

export interface VaultFolderBreadcrumbStripProps {
  folders: VaultFolderNode[];
  vaultId: string;
  activeFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  className?: string;
}

export function VaultFolderBreadcrumbStrip({
  folders,
  vaultId,
  activeFolderId,
  onFolderSelect,
  className,
}: VaultFolderBreadcrumbStripProps) {
  const breadcrumb = buildFolderBreadcrumbPath(folders, activeFolderId);
  const rootFolders = getChildFolders(folders, vaultId, null);
  const activeChildren = activeFolderId
    ? getChildFolders(folders, vaultId, activeFolderId)
    : rootFolders;

  const renderFolderPill = (folder: VaultFolderNode, compact = false) => {
    const Icon = getVaultFolderIcon(folder.icon);
    const active = activeFolderId === folder.id;

    return (
      <button
        key={folder.id}
        type="button"
        onClick={() => onFolderSelect(folder.id)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors shrink-0',
          active
            ? 'border-[#1A73E8] bg-blue-50 text-[#1A73E8]'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
          compact && 'px-2.5 py-1',
        )}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate max-w-[140px]">{folder.name}</span>
      </button>
    );
  };

  return (
    <div className={cn('rounded-2xl border border-slate-200/80 bg-white p-3 space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-2 min-h-[32px]">
        <button
          type="button"
          onClick={() => onFolderSelect(null)}
          className={cn(
            'inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors',
            activeFolderId === null
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100',
          )}
        >
          Alle Einträge
        </button>

        {breadcrumb.length > 0 ? (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            {breadcrumb.map((folder, index) => {
              const Icon = getVaultFolderIcon(folder.icon);
              const isLast = index === breadcrumb.length - 1;
              return (
                <div key={folder.id} className="inline-flex items-center gap-2 shrink-0">
                  {index > 0 ? <ChevronRight className="w-3.5 h-3.5 text-slate-300" /> : null}
                  <button
                    type="button"
                    onClick={() => onFolderSelect(folder.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors',
                      isLast
                        ? 'border-[#1A73E8] bg-blue-50 text-[#1A73E8]'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {folder.name}
                  </button>
                </div>
              );
            })}
          </>
        ) : null}
      </div>

      {activeChildren.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-dashed border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
            {activeFolderId ? 'Unterordner' : 'Ordner'}
          </span>
          {activeChildren.map((folder) => renderFolderPill(folder, true))}
        </div>
      ) : null}
    </div>
  );
}
