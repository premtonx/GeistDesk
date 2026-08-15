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
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  formatUpdated,
  getAssetStatus,
  resolveCredVaultId,
  VAULT_DEFINITIONS,
  ACCESS_CATEGORIES,
} from './vault-utils';
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
}

interface VaultAssetViewsProps {
  assets: VaultAsset[];
  viewMode: VaultAssetViewMode;
  activeVaultId: string;
  onSelect: (asset: VaultAsset) => void;
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
  onSelect,
  onEdit,
  onToggleFavorite,
  onDecryptPassword,
  onShare,
}: VaultAssetViewsProps) {
  const { t } = useTranslation();

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

  if (viewMode === 'table') {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                <th className="px-4 py-3">{t('vault.colAsset', 'Asset')}</th>
                <th className="px-4 py-3">{t('vault.colCategory', 'Category')}</th>
                <th className="px-4 py-3">{t('vault.colVault', 'Vault')}</th>
                <th className="px-4 py-3">{t('vault.colAuthority', 'Authority')}</th>
                <th className="px-4 py-3">{t('vault.colOwner', 'Owner')}</th>
                <th className="px-4 py-3">{t('vault.colLastUsed', 'Last Used')}</th>
                <th className="px-4 py-3">{t('vault.colStatus', 'Status')}</th>
                <th className="px-4 py-3">{t('vault.colUpdated', 'Updated')}</th>
                <th className="px-4 py-3 text-right">{t('vault.quickActions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assets.map((asset, idx) => (
                <AssetTableRow
                  key={String(asset.id)}
                  asset={asset}
                  index={idx}
                  activeVaultId={activeVaultId}
                  onSelect={onSelect}
                  onEdit={onEdit}
                  onToggleFavorite={onToggleFavorite}
                  onDecryptPassword={onDecryptPassword}
                  onShare={onShare}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const gridClass = viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3' : 'space-y-3';

  return (
    <div className={gridClass}>
      {assets.map((asset, idx) => (
        <AssetCard
          key={String(asset.id)}
          asset={asset}
          index={idx}
          compact={viewMode === 'grid'}
          onSelect={onSelect}
          onEdit={onEdit}
          onToggleFavorite={onToggleFavorite}
          onDecryptPassword={onDecryptPassword}
          onShare={onShare}
        />
      ))}
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
    if (plain) navigator.clipboard.writeText(plain);
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
  onSelect,
  onEdit,
  onToggleFavorite,
  onDecryptPassword,
  onShare,
}: {
  asset: VaultAsset;
  index: number;
  activeVaultId: string;
  onSelect: (a: VaultAsset) => void;
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
    <tr onClick={() => onSelect(asset)} className="hover:bg-slate-50/60 cursor-pointer group">
      <td className="px-4 py-3">
        <div className="flex items-start gap-2.5 min-w-[200px]">
          {assetBrandIcon(asset)}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-slate-900 truncate">{asset.label}</p>
              <button type="button" onClick={(e) => { e.stopPropagation(); onToggleFavorite(asset); }} className="shrink-0">
                <Star className={cn('w-3.5 h-3.5', asset.favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 truncate">{asset.username}{asset.host ? ` · ${asset.host}` : ''}</p>
            {asset.tags?.length ? (
              <div className="flex gap-1 mt-1 flex-wrap">
                {asset.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{tag}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-600">{categoryLabel(asset.type, t)}</td>
      <td className="px-4 py-3">
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
          {vaultLabel(vaultId, t)}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-500">{vault ? t(vault.permissionKey, vault.defaultPermission) : '—'}</td>
      <td className="px-4 py-3 text-slate-600">{asset.owner ?? asset.lastModifiedBy ?? t('vault.defaultOwner', 'You')}</td>
      <td className="px-4 py-3 text-slate-400 tabular-nums">{formatUpdated(asset.updatedAt)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border w-fit', STATUS_STYLES[status])}>
            {statusLabel(status, t)}
          </span>
          {strength ? (
            <span className="text-[9px] font-bold text-violet-600 tabular-nums">{strength} strength</span>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3 text-slate-400">{formatUpdated(asset.updatedAt)}</td>
      <td className="px-4 py-3 text-right">
        <QuickActions asset={asset} onEdit={onEdit} onDecryptPassword={onDecryptPassword} onShare={onShare} />
      </td>
    </tr>
  );
}

function AssetCard({
  asset,
  index,
  compact,
  onSelect,
  onEdit,
  onToggleFavorite,
  onDecryptPassword,
  onShare,
}: {
  asset: VaultAsset;
  index: number;
  compact?: boolean;
  onSelect: (a: VaultAsset) => void;
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
      className={cn(
        'rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer p-4',
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
        <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">{vaultLabel(vaultId, t)}</span>
        <span className={cn('text-[9px] font-semibold px-2 py-0.5 rounded-full border', STATUS_STYLES[status])}>{statusLabel(status, t)}</span>
      </div>
      <div className={cn('flex items-center justify-between pt-2 border-t border-slate-100', compact && 'mt-auto')}>
        <span className="text-[10px] text-slate-400">{formatUpdated(asset.updatedAt)}</span>
        <QuickActions asset={asset} onEdit={onEdit} onDecryptPassword={onDecryptPassword} onShare={onShare} />
      </div>
    </div>
  );
}
