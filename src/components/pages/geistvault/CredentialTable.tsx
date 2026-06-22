import React, { useState } from 'react';
import {
  Star,
  MoreVertical,
  Copy,
  Trash,
  Edit,
  RotateCcw,
  Check,
  Terminal,
  Globe,
  Monitor,
  Shield,
  Database,
  Key as KeyIcon,
  Cloud,
  FileCode,
  Lock,
  Calendar,
  Layers,
  MessageSquare,
  Container,
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { toast } from 'sonner';
import { useTranslation } from '../../../lib/context/I18nContext';

interface Credential {
  id?: number | string;
  type: string;
  label: string;
  username: string;
  encryptedPassword: string;
  host?: string;
  updatedAt: number;
  favorite?: boolean;
  deleted?: boolean;
  vaultId?: string;
  notes?: string;
  lastModifiedBy?: string;
}

interface CredentialTableProps {
  credentials: Credential[];
  onRowClick: (cred: Credential) => void;
  onToggleFavorite: (cred: Credential) => void;
  onDecryptPassword: (cred: Credential) => Promise<string | null>;
  onEdit: (cred: Credential) => void;
  onDelete: (id: number | string) => void;
  onRestore: (id: number | string) => void;
  selectedView: 'all' | 'favorites' | 'recently' | 'shared' | 'trash';
}

const CATEGORY_STYLES: Record<string, { label: string; className: string }> = {
  rdp: { label: 'RDP Session', className: 'bg-blue-50 text-blue-700' },
  vpn: { label: 'VPN Access', className: 'bg-emerald-50 text-emerald-700' },
  ssh: { label: 'Server', className: 'bg-amber-50 text-amber-700' },
  web: { label: 'Web Login', className: 'bg-violet-50 text-violet-700' },
  db: { label: 'Database', className: 'bg-orange-50 text-orange-700' },
  api: { label: 'API Key', className: 'bg-rose-50 text-rose-700' },
  cloud: { label: 'Cloud Account', className: 'bg-cyan-50 text-cyan-800' },
  cert: { label: 'Certificate', className: 'bg-pink-50 text-pink-700' },
  k8s: { label: 'Kubernetes', className: 'bg-indigo-50 text-indigo-700' },
  slack: { label: 'Slack Workspace', className: 'bg-fuchsia-50 text-fuchsia-700' },
};

function renderIcon(type: string) {
  const cls = 'w-3.5 h-3.5 text-slate-500';
  switch (type) {
    case 'rdp': return <Monitor className={cls} />;
    case 'vpn': return <Shield className={cls} />;
    case 'ssh': return <Terminal className={cls} />;
    case 'web': return <Globe className={cls} />;
    case 'db': return <Database className={cls} />;
    case 'api': return <KeyIcon className={cls} />;
    case 'cloud': return <Cloud className={cls} />;
    case 'cert': return <FileCode className={cls} />;
    case 'k8s': return <Container className={cls} />;
    case 'slack': return <MessageSquare className={cls} />;
    default: return <Lock className={cls} />;
  }
}

function renderCategoryBadge(type: string) {
  const meta = CATEGORY_STYLES[type] ?? { label: 'Web Login', className: 'bg-slate-100 text-slate-700' };
  return (
    <Badge className={`border-none font-semibold text-[9px] uppercase tracking-wide px-2 py-0 h-5 ${meta.className}`}>
      {meta.label}
    </Badge>
  );
}

function renderStatus(cred: Credential) {
  const isWeak =
    cred.notes?.toLowerCase().includes('weak') ||
    cred.label.toLowerCase().includes('database') ||
    cred.username === 'db_admin';
  const isExpiring = cred.label.toLowerCase().includes('aws') || cred.type === 'cloud';

  if (isWeak) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Weak
      </span>
    );
  }
  if (isExpiring) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Expiring
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Healthy
    </span>
  );
}

export function CredentialTable({
  credentials,
  onRowClick,
  onToggleFavorite,
  onDecryptPassword,
  onEdit,
  onDelete,
  onRestore,
  selectedView,
}: CredentialTableProps) {
  const { t } = useTranslation();
  const [activeMenuId, setActiveMenuId] = useState<number | string | null>(null);
  const [copiedId, setCopiedId] = useState<number | string | null>(null);

  const handleQuickCopyPassword = async (e: React.MouseEvent, cred: Credential) => {
    e.stopPropagation();
    try {
      const plain = await onDecryptPassword(cred);
      if (plain) {
        navigator.clipboard.writeText(plain);
        if (cred.id) {
          setCopiedId(cred.id);
          toast.success(t('vault.passwordCopied', 'Password copied'));
          setTimeout(() => setCopiedId(null), 2000);
        }
      } else {
        toast.error(t('vault.decryptFailed', 'Decryption failed. Unlock vault first.'));
      }
    } catch {
      toast.error(t('vault.decryptError', 'Error decrypting secret.'));
    }
  };

  const handleQuickCopyUsername = (e: React.MouseEvent, username: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(username);
    toast.success(t('vault.usernameCopied', 'Username copied'));
  };

  const getVaultName = (cred: Credential) =>
    cred.vaultId === 'shared'
      ? t('vault.teamSharedVault', 'Team Shared Vault')
      : t('vault.personalLocalVault', 'Personal Local Vault');

  if (credentials.length === 0) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-xl p-12 text-center flex flex-col items-center justify-center">
        <div className="h-12 w-12 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-200/80 text-slate-400 mb-3">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">{t('vault.noSecretsFound', 'No secrets found')}</h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1">{t('vault.noSecretsHint', 'Create an entry or adjust filters to view assets.')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col">
      <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-2 px-3 w-9 text-center">★</th>
              <th className="py-2 px-3">{t('vault.colAsset', 'Asset')}</th>
              <th className="py-2 px-3 hidden md:table-cell">{t('vault.colCategory', 'Category')}</th>
              <th className="py-2 px-3">{t('vault.colUsername', 'Username')}</th>
              <th className="py-2 px-3 hidden lg:table-cell">{t('vault.colAuthority', 'Vault Authority')}</th>
              <th className="py-2 px-3 hidden sm:table-cell">{t('vault.colStatus', 'Status')}</th>
              <th className="py-2 px-3 hidden xl:table-cell">{t('vault.colUpdated', 'Updated')}</th>
              <th className="py-2 px-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {credentials.map((cred) => (
              <tr
                key={cred.id}
                onClick={() => onRowClick(cred)}
                className="hover:bg-blue-50/30 transition-colors cursor-pointer group h-10"
              >
                <td className="py-1.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(cred)}
                    className="p-1 rounded-md hover:bg-slate-100 text-slate-300 hover:text-amber-500 transition-colors"
                  >
                    <Star className={`w-3.5 h-3.5 ${cred.favorite ? 'fill-amber-400 text-amber-500' : ''}`} />
                  </button>
                </td>

                <td className="py-1.5 px-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200/60 shrink-0">
                      {renderIcon(cred.type)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate max-w-[180px]">{cred.label}</p>
                      <p className="text-[10px] font-mono text-slate-400 truncate max-w-[180px]">{cred.host || '—'}</p>
                    </div>
                  </div>
                </td>

                <td className="py-1.5 px-3 hidden md:table-cell">{renderCategoryBadge(cred.type)}</td>

                <td className="py-1.5 px-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-0.5">
                    <span className="text-[11px] font-mono text-slate-700 truncate max-w-[100px]">{cred.username}</span>
                    <button
                      type="button"
                      onClick={(e) => handleQuickCopyUsername(e, cred.username)}
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
                      title={t('vault.copyUsername', 'Copy username')}
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </td>

                <td className="py-1.5 px-3 hidden lg:table-cell">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                      cred.vaultId === 'shared'
                        ? 'bg-violet-50 text-violet-700 border-violet-100'
                        : 'bg-blue-50 text-blue-700 border-blue-100'
                    }`}
                  >
                    {getVaultName(cred)}
                  </span>
                </td>

                <td className="py-1.5 px-3 hidden sm:table-cell">{renderStatus(cred)}</td>

                <td className="py-1.5 px-3 hidden xl:table-cell">
                  <div className="text-[10px] text-slate-500">
                    <span>{new Date(cred.updatedAt).toLocaleDateString()}</span>
                    <span className="text-slate-400 ml-1">· {cred.lastModifiedBy || 'System'}</span>
                  </div>
                </td>

                <td className="py-1.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveMenuId(activeMenuId === cred.id ? null : (cred.id ?? null))}
                      className="p-1 rounded-md hover:bg-slate-100 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                    {activeMenuId === cred.id && (
                      <div className="absolute right-0 mt-1 w-40 rounded-lg shadow-lg bg-white border border-slate-200/80 z-50 text-left overflow-hidden">
                        <button
                          type="button"
                          onClick={() => { setActiveMenuId(null); onRowClick(cred); }}
                          className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 w-full"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          {t('vault.openDetails', 'Open Details')}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { setActiveMenuId(null); handleQuickCopyPassword(e, cred); }}
                          className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 w-full"
                        >
                          {copiedId === cred.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          {t('vault.copySecret', 'Copy Secret')}
                        </button>
                        {selectedView === 'trash' ? (
                          <button
                            type="button"
                            onClick={() => { setActiveMenuId(null); cred.id && onRestore(cred.id); }}
                            className="flex items-center gap-2 px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-50 w-full"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {t('vault.restore', 'Restore')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setActiveMenuId(null); onEdit(cred); }}
                            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 w-full"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            {t('vault.editAsset', 'Edit Asset')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => { setActiveMenuId(null); cred.id && onDelete(cred.id); }}
                          className="flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 w-full"
                        >
                          <Trash className="w-3.5 h-3.5" />
                          {selectedView === 'trash' ? t('vault.deletePermanent', 'Delete Forever') : t('vault.moveToTrash', 'Move to Trash')}
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200/80 bg-slate-50/80 text-[10px] text-slate-500 font-medium shrink-0">
        <span>{t('vault.showingEntries', 'Showing {{count}} entries').replace('{{count}}', String(credentials.length))}</span>
      </div>
    </div>
  );
}
