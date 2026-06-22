import React from 'react';
import { Plus, Globe, Monitor, Key, Database, FileText, Lock, Upload } from 'lucide-react';
import { useTranslation } from '../../lib/context/I18nContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface VaultFabMenuProps {
  onNewAsset: (type: string) => void;
  onImport: () => void;
}

const ASSET_TYPES = [
  { type: 'web', icon: Globe, labelKey: 'vault.fab.newLogin', defaultLabel: 'New Login' },
  { type: 'rdp', icon: Monitor, labelKey: 'vault.fab.newServer', defaultLabel: 'New Server' },
  { type: 'api', icon: Key, labelKey: 'vault.fab.newApiKey', defaultLabel: 'New API Key' },
  { type: 'db', icon: Database, labelKey: 'vault.fab.newDatabase', defaultLabel: 'New Database' },
  { type: 'cert', icon: FileText, labelKey: 'vault.fab.newLicense', defaultLabel: 'New License' },
  { type: 'ssh', icon: Lock, labelKey: 'vault.fab.newSecret', defaultLabel: 'New Secret' },
];

export function VaultFabMenu({ onNewAsset, onImport }: VaultFabMenuProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all hover:scale-105"
              aria-label={t('vault.fab.newAsset', 'New Asset')}
            >
              <Plus className="w-5 h-5" strokeWidth={2.5} />
            </button>
          }
        />
        <DropdownMenuContent align="end" side="top" className="w-52 rounded-xl mb-2">
          {ASSET_TYPES.map((item) => (
            <DropdownMenuItem key={item.type} className="text-xs gap-2 cursor-pointer" onClick={() => onNewAsset(item.type)}>
              <item.icon className="w-3.5 h-3.5 text-slate-500" />
              {t(item.labelKey, item.defaultLabel)}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem className="text-xs gap-2 cursor-pointer" onClick={onImport}>
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            {t('vault.importAssets', 'Import Assets')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
