import { Plus, Globe, Monitor, Key, Database, FileText, Lock, Upload } from 'lucide-react';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';
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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-xl text-xs gap-1.5"
            aria-label={t('vault.createAsset', 'Create Asset')}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            {t('vault.createAsset', 'Create Asset')}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-52 rounded-xl">
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
  );
}
