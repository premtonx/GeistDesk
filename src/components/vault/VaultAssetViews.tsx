import { useState, type MouseEvent, type ReactNode } from 'react';
import {
  Copy,
  Eye,
  EyeOff,
  Share2,
  PenLine,
  Star,
  Globe,
  Monitor,
  Shield,
  Database,
  Key as KeyIcon,
  Cloud,
  Terminal,
  MoreVertical,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { formatUpdated, getAssetStatus, resolveCredVaultId, VAULT_DEFINITIONS, ACCESS_CATEGORIES } from './vault-utils';
import { vaultHotkeyModLabel } from './useVaultAssetHotkeys';
import type { VaultAssetViewMode } from './VaultViewModeSelector';

export interface VaultAsset {
  id?: number | string;
  type: string;
  label: string;
  username: string;
  encryptedPassword: string;
  host?: string;
  updatedAt: number;
  favorite?: boolean;
  vaultId?: string;
  folderId?: string | null;
  owner?: string;
  tags?: string[];
  lastModifiedBy?: string;
  icon?: string;
  securitySettings?: {
    disableCopy?: boolean;
  };
}

interface VaultAssetViewsProps {
  assets: VaultAsset[];
  viewMode: VaultAssetViewMode;
  activeVaultId: string;
  selectedId?: string | number | null;
  onSelect: (asset: VaultAsset) => void;
  onOpen?: (asset: VaultAsset) => void;
  onEdit: (asset: VaultAsset) => void;
  onToggleFavorite: (asset: VaultAsset) => void;
  onDecryptPassword: (asset: VaultAsset) => Promise<string | null>;
  onShare?: (asset: VaultAsset) => void;
}

const STATUS_STYLES = {
  healthy: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  expired: 'bg-orange-50 text-orange-700 border-orange-100',
  review: 'bg-violet-50 text-violet-700 border-violet-100',
};

function typeIcon(type: string) {
  const cls = 'w-4 h-4 text-slate-500 shrink-0';
  switch (type) {
    case 'rdp': return <Monitor className={cls} />;
    case 'vpn': return <Shield className={cls} />;
    case 'ssh': return <Terminal className={cls} />;
    case 'web': return <Globe className={cls} />;
    case 'db': return <Database className={cls} />;
    case 'api': return <KeyIcon className={cls} />;
    case 'cloud': return <Cloud className={cls} />;
    default: return <KeyIcon className={cls} />;
  }
}

const BRAND_ICON_STYLES: Record<string, { label: string; className: string }> = {
  aws: { label: 'AWS', className: 'bg-[#FF9900]/15 text-[#FF9900] border-[#FF9900]/30' },
  docker: { label: '🐳', className: 'bg-[#2496ED]/10 text-[#2496ED] border-[#2496ED]/25' },
  amazon: { label: 'a', className: 'bg-[#FF9900]/10 text-slate-900 border-amber-200 font-black italic' },
  github: { label: 'GH', className: 'bg-slate-900 text-white border-slate-700 font-bold' },
};

function assetBrandIcon(asset: VaultAsset) {
  const brand = asset.icon ? BRAND_ICON_STYLES[asset.icon] : undefined;
  if (!brand) {
    return (
      <div className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
        {typeIcon(asset.type)}
      </div>
    );
  }
  return (
    <div
      className={cn(
        'h-8 w-8 rounded-xl border flex items-center justify-center shrink-0 text-[10px]',
        brand.className,
      )}
      title={asset.icon}
    >
      {brand.label}
    </div>
  );
}

function strengthFromTags(tags?: string[]): string | null {
  const match = tags?.find((tag) => /strength:\s*\d+%/i.test(tag));
  return match?.match(/(\d+)%/)?.[1] ? `${match.match(/(\d+)%/)![1]}%` : null;
}

function categoryLabel(type: string, t: (k: string, d?: string) => string): string {
  const cat = ACCESS_CATEGORIES.find((c) => c.types.includes(type));
  return cat ? t(cat.nameKey, cat.defaultName) : type;
}

function vaultLabel(vaultId: string, t: (k: string, d?: string) => string): string {
  const v = VAULT_DEFINITIONS.find((x) => x.id === vaultId);
  return v ? t(v.nameKey, v.defaultName) : vaultId;
}

export function VaultAssetViews({
  assets,
  viewMode,
  activeVaultId,
  selectedId,
  onSelect,
  onOpen,
  onEdit,
  onToggleFavorite,
  onDecryptPassword,
  onShare,
}: VaultAssetViewsProps) {
  const { t } = useTranslation();
  const mod = vaultHotkeyModLabel();

  if (assets.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center">
        <p className="text-sm font-semibold text-slate-700">
          {t('vault.noSecretsFound', 'Keine Tresor-Einträge vorhanden')}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {t('vault.noSecretsHint', 'Erstellen Sie Ihren ersten Eintrag — es werden keine Beispieldaten angezeigt.')}
        </p>
      </div>
    );
  }

  const shortcutHint = (
    <p className="px-3 py-2 text-[10px] text-slate-400 font-medium border-t border-slate-100 bg-slate-50/80">
      <span className="font-mono text-slate-500">[{mod}+C]</span> {t('vault.hotkey.password', 'Passwort')}
      <span className="mx-1.5 text-slate-300">|</span>
      <span className="font-mono text-slate-500">[{mod}+B]</span> {t('vault.hotkey.username', 'Username')}
      <span className="mx-1.5 text-slate-300">|</span>
      <span className="font-mono text-slate-500">[{mod}+L]</span> {t('vault.hotkey.url', 'URL')}
      <span className="mx-1.5 text-slate-300">|</span>
      <span className="font-mono text-slate-500">[↑↓]</span> {t('vault.hotkey.nav', 'Zeile')}
      <span className="mx-1.5 text-slate-300">|</span>
      <span className="font-mono text-slate-500">[Enter]</span> {t('vault.hotkey.open', 'Details')}
    </p>
  );

  if (viewMode === 'table') {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm w-full max-w-full">
        <div className="w-full max-w-full overflow-x-auto">
          <table className="w-full text-left text-xs border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                <th scope="col" className="px-4 py-3 font-semibold min-w-[200px]">{t('vault.colAsset', 'Asset')}</th>
                <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">{t('vault.colCategory', 'Kategorie')}</th>
                <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">{t('vault.colVault', 'Vault')}</th>
                <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap hidden xl:table-cell">{t('vault.colAuthority', 'Vault-Autorität')}</th>
                <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap hidden lg:table-cell">{t('vault.colOwner', 'Owner')}</th>
                <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap hidden xl:table-cell">{t('vault.colLastUsed', 'Zuletzt genutzt')}</th>
                <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">{t('vault.colStatus', 'Status')}</th>
                <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap hidden xl:table-cell">{t('vault.colUpdated', 'Updated')}</th>
                <th scope="col" className="px-4 py-3 font-semibold text-right whitespace-nowrap">{t('vault.quickActions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assets.map((asset, idx) => (
                <AssetTableRow
                  key={String(asset.id)}
                  asset={asset}
                  index={idx}
                  selected={String(selectedId) === String(asset.id)}
                  activeVaultId={activeVaultId}
                  onSelect={onSelect}
                  onOpen={onOpen}
                  onEdit={onEdit}
                  onToggleFavorite={onToggleFavorite}
                  onDecryptPassword={onDecryptPassword}
                  onShare={onShare}
                />
              ))}
            </tbody>
          </table>
        </div>
        {shortcutHint}
      </div>
    );
  }

  const gridClass = viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3' : 'space-y-3';

  return (
    <div className="w-full max-w-full space-y-2">
      <div className={gridClass}>
        {assets.map((asset, idx) => (
          <AssetCard
            key={String(asset.id)}
            asset={asset}
            index={idx}
            compact={viewMode === 'grid'}
            selected={String(selectedId) === String(asset.id)}
            onSelect={onSelect}
            onOpen={onOpen}
            onEdit={onEdit}
            onToggleFavorite={onToggleFavorite}
            onDecryptPassword={onDecryptPassword}
            onShare={onShare}
          />
        ))}
      </div>
      <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">{shortcutHint}</div>
    </div>
  );
}

function statusLabel(status: ReturnType<typeof getAssetStatus>, t: (k: string, d?: string) => string) {
  const map = {
    healthy: t('vault.status.healthy', 'Healthy'),
    warning: t('vault.status.warning', 'Warning'),
    expired: t('vault.status.expired', 'Expired'),
    review: t('vault.status.reviewRequired', 'Review Required'),
  };
  return map[status];
}

function QuickActions({
  asset,
  onEdit,
  onDecryptPassword,
  onShare,
}: {
  asset: VaultAsset;
  onEdit: (a: VaultAsset) => void;
  onDecryptPassword: (a: VaultAsset) => Promise<string | null>;
  onShare?: (a: VaultAsset) => void;
}) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);

  const copyUsername = (e: MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(asset.username);
  };

  const copyPassword = async (e: MouseEvent) => {
    e.stopPropagation();
    const plain = await onDecryptPassword(asset);
    if (plain) {
      await navigator.clipboard.writeText(plain);
      toast.success('Passwort in die Zwischenablage kopiert');
    }
  };

  const reveal = async (e: MouseEvent) => {
    e.stopPropagation();
    setRevealed(!revealed);
    if (!revealed) await onDecryptPassword(asset);
  };

  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      <ActionBtn title={t('vault.copyUsername', 'Copy Username')} onClick={copyUsername} icon={<Copy className="w-3.5 h-3.5" />} />
      <ActionBtn title={t('vault.copySecret', 'Copy Password')} onClick={copyPassword} icon={<Copy className="w-3.5 h-3.5" />} />
      <ActionBtn title={t('vault.revealSecret', 'Reveal Secret')} onClick={revealed ? () => setRevealed(false) : reveal} icon={revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} />
      {onShare ? (
        <ActionBtn title={t('vault.shareAsset', 'Share')} onClick={(e) => { e.stopPropagation(); onShare(asset); }} icon={<Share2 className="w-3.5 h-3.5" />} />
      ) : null}
      <ActionBtn title={t('vault.editAsset', 'Edit')} onClick={(e) => { e.stopPropagation(); onEdit(asset); }} icon={<PenLine className="w-3.5 h-3.5" />} />
    </div>
  );
}

function ActionBtn({ title, onClick, icon }: { title: string; onClick: (e: MouseEvent) => void; icon: ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick} className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
      {icon}
    </button>
  );
}

function AssetTableRow({
  asset,
  index,
  selected,
  onSelect,
  onOpen,
  onEdit,
  onToggleFavorite,
  onDecryptPassword,
  onShare,
}: {
  asset: VaultAsset;
  index: number;
  selected?: boolean;
  activeVaultId: string;
  onSelect: (a: VaultAsset) => void;
  onOpen?: (a: VaultAsset) => void;
  onEdit: (a: VaultAsset) => void;
  onToggleFavorite: (a: VaultAsset) => void;
  onDecryptPassword: (a: VaultAsset) => Promise<string | null>;
  onShare?: (a: VaultAsset) => void;
}) {
  const { t } = useTranslation();
  const status = getAssetStatus(asset);
  const vaultId = resolveCredVaultId(asset);
  const vault = VAULT_DEFINITIONS.find((v) => v.id === vaultId);
  const strength = strengthFromTags(asset.tags);

  return (
    <tr
      onClick={() => onSelect(asset)}
      onDoubleClick={() => onOpen?.(asset)}
      aria-selected={selected}
      className={cn(
        'cursor-pointer group',
        selected ? 'bg-blue-50/80' : 'hover:bg-slate-50/60',
      )}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-3 min-w-0">
          {assetBrandIcon(asset)}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-medium text-slate-900 truncate">{asset.label}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); onToggleFavorite(asset); }} className="shrink-0">
                <Star className={cn('w-3.5 h-3.5', asset.favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
              </button>
            </div>
            <p className="text-xs text-slate-400 truncate">{asset.host || asset.username}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className="inline-flex max-w-full text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap truncate">
          {categoryLabel(asset.type, t)}
        </span>
      </td>
      <td className="py-3 px-4">
        <span className="inline-flex max-w-full items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 whitespace-nowrap truncate">
          {vaultLabel(vaultId, t)}
        </span>
      </td>
      <td className="py-3 px-4 text-slate-500 hidden xl:table-cell truncate">{vault ? t(vault.permissionKey, vault.defaultPermission) : '—'}</td>
      <td className="py-3 px-4 text-slate-600 hidden lg:table-cell truncate">{asset.owner ?? asset.lastModifiedBy ?? t('vault.defaultOwner', 'You')}</td>
      <td className="py-3 px-4 text-slate-400 tabular-nums hidden xl:table-cell">{formatUpdated(asset.updatedAt)}</td>
      <td className="py-3 px-4">
        <div className="flex flex-col gap-1 min-w-0">
          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border w-fit whitespace-nowrap', STATUS_STYLES[status])}>
            {statusLabel(status, t)}
          </span>
          {strength ? (
            <span className="text-[9px] font-bold text-violet-600 tabular-nums">{strength} strength</span>
          ) : null}
        </div>
      </td>
      <td className="py-3 px-4 text-slate-400 hidden xl:table-cell">{formatUpdated(asset.updatedAt)}</td>
      <td className="py-3 px-4 text-right">
        <QuickActions asset={asset} onEdit={onEdit} onDecryptPassword={onDecryptPassword} onShare={onShare} />
      </td>
    </tr>
  );
}

function AssetCard({
  asset,
  index,
  compact,
  selected,
  onSelect,
  onOpen,
  onEdit,
  onToggleFavorite,
  onDecryptPassword,
  onShare,
}: {
  asset: VaultAsset;
  index: number;
  compact?: boolean;
  selected?: boolean;
  onSelect: (a: VaultAsset) => void;
  onOpen?: (a: VaultAsset) => void;
  onEdit: (a: VaultAsset) => void;
  onToggleFavorite: (a: VaultAsset) => void;
  onDecryptPassword: (a: VaultAsset) => Promise<string | null>;
  onShare?: (a: VaultAsset) => void;
}) {
  const { t } = useTranslation();
  const status = getAssetStatus(asset);
  const vaultId = resolveCredVaultId(asset);

  return (
    <div
      onClick={() => onSelect(asset)}
      onDoubleClick={() => onOpen?.(asset)}
      className={cn(
        'rounded-2xl border bg-white shadow-sm hover:shadow-md transition-all cursor-pointer p-4',
        selected ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200/80 hover:border-blue-200',
        compact && 'h-full flex flex-col',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {assetBrandIcon(asset)}
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">{asset.label}</p>
            <p className="text-[10px] text-slate-400 truncate">{asset.username}</p>
          </div>
        </div>
        <button type="button" onClick={(e) => { e.stopPropagation(); onToggleFavorite(asset); }}>
          <Star className={cn('w-4 h-4', asset.favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
        </button>
      </div>
      {asset.host ? <p className="text-[10px] text-slate-500 mb-2 truncate">{asset.host}</p> : null}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{categoryLabel(asset.type, t)}</span>
        <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 whitespace-nowrap truncate max-w-[140px]">{vaultLabel(vaultId, t)}</span>
        <span className={cn('text-[9px] font-semibold px-2 py-0.5 rounded-full border', STATUS_STYLES[status])}>{statusLabel(status, t)}</span>
      </div>
      <div className={cn('flex items-center justify-between pt-2 border-t border-slate-100', compact && 'mt-auto')}>
        <span className="text-[10px] text-slate-400">{formatUpdated(asset.updatedAt)}</span>
        <QuickActions asset={asset} onEdit={onEdit} onDecryptPassword={onDecryptPassword} onShare={onShare} />
      </div>
    </div>
  );
}
