import { Download, MoreHorizontal, Shield } from 'lucide-react';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface VaultPropertiesPaneProps {
  vaultName: string;
  vaultEmoji?: string;
  itemCount: number;
  isPersonal: boolean;
  onExportData: () => void;
}

/**
 * Compact personal vault properties strip with export action.
 * Shown above the credential list when a personal vault is selected.
 */
export function VaultPropertiesPane({
  vaultName,
  vaultEmoji = '🔒',
  itemCount,
  isPersonal,
  onExportData,
}: VaultPropertiesPaneProps) {
  const { t } = useTranslation();

  if (!isPersonal) return null;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-lg shadow-sm shrink-0">
          <span aria-hidden>{vaultEmoji}</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-900 truncate">{vaultName}</p>
            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
              <Shield className="w-2.5 h-2.5" />
              {t('vault.permissions.owner', 'Owner')}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            {t('vault.properties.subtitle', 'Personal vault properties · {{count}} encrypted items')
              .replace('{{count}}', String(itemCount))}
          </p>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-xl text-xs gap-1.5 shrink-0 border-slate-200"
              aria-label={t('vault.properties.actions', 'Vault actions')}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
              {t('vault.properties.actions', 'Vault actions')}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-64 rounded-xl">
          <DropdownMenuItem
            className="text-xs gap-2 cursor-pointer"
            onClick={onExportData}
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-semibold">
              {t('vault.export.menuLabel', 'Daten exportieren / Export Vault Data')}
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="text-[10px] text-slate-400 cursor-default">
            {t('vault.export.localOnlyHint', 'Exports decrypt locally — nothing is uploaded')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
