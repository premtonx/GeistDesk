import React, { useState } from 'react';
import { 
  Star, 
  MoreVertical, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  Copy, 
  Trash, 
  Edit,
  RotateCcw,
  Check,
  ShieldAlert,
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
  Layers
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { toast } from 'sonner';

interface Credential {
  id?: number | string;
  type: string;
  label: string;
  username: string;
  encryptedPassword: string;
  host?: string;
  port?: string;
  domain?: string;
  gateway?: string;
  configData?: string;
  notes?: string;
  updatedAt: number;
  icon?: string;
  iconType?: 'preset' | 'custom';
  lastModifiedBy?: string;
  favorite?: boolean;
  deleted?: boolean;
  vaultId?: string;

  // Enterprise Extensions
  visibility?: string;
  owner?: string;
  team?: string;
  department?: string;
  linkedCompany?: string;
  linkedAsset?: string;
  linkedTicket?: string;
  tags?: string[];
  expirationPolicy?: string;
  rotationPolicy?: string;
  totpSecret?: string;
  backupCodes?: string;
  recoveryKeys?: string;
  authenticatorNotes?: string;
  attachments?: { name: string; size: string; type: string }[];
  securitySettings?: {
    burnAfterRead?: boolean;
    requireApproval?: boolean;
    jitAccess?: boolean;
    requireMfa?: boolean;
    disableExport?: boolean;
    disableCopy?: boolean;
  };
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

export function CredentialTable({
  credentials,
  onRowClick,
  onToggleFavorite,
  onDecryptPassword,
  onEdit,
  onDelete,
  onRestore,
  selectedView
}: CredentialTableProps) {
  const [activeMenuId, setActiveMenuId] = useState<number | string | null>(null);
  const [copiedId, setCopiedId] = useState<number | string | null>(null);

  // Decrypt and copy secret directly from table action
  const handleQuickCopyPassword = async (e: React.MouseEvent, cred: Credential) => {
    e.stopPropagation();
    try {
      const plain = await onDecryptPassword(cred);
      if (plain) {
        navigator.clipboard.writeText(plain);
        if (cred.id) {
          setCopiedId(cred.id);
          toast.success("Password copied!");
          setTimeout(() => setCopiedId(null), 2000);
        }
      } else {
        toast.error("Decryption failed. Unlock vault first.");
      }
    } catch (err) {
      toast.error("Error decrypting vault secret.");
    }
  };

  const handleQuickCopyUsername = (e: React.MouseEvent, username: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(username);
    toast.success("Username copied!");
  };

  // Maps credential types to Category labels & styling badge
  const renderCategoryBadge = (type: string) => {
    let label = 'Web Login';
    let style = 'bg-slate-100 text-slate-800 border-none font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full';

    switch (type) {
      case 'rdp':
        label = 'RDP Session';
        style = 'bg-blue-50 text-[#1A73E8] border-none font-bold text-[9.5px] uppercase tracking-wider px-2 py-0.5 rounded-full';
        break;
      case 'vpn':
        label = 'VPN Access';
        style = 'bg-green-50 text-[#137333] border-none font-bold text-[9.5px] uppercase tracking-wider px-2 py-0.5 rounded-full';
        break;
      case 'ssh':
        label = 'SSH Node';
        style = 'bg-[#FFF9E6] text-[#B06000] border-none font-bold text-[9.5px] uppercase tracking-wider px-2 py-0.5 rounded-full';
        break;
      case 'web':
        label = 'Web Login';
        style = 'bg-purple-50 text-[#6B21A8] border-none font-bold text-[9.5px] uppercase tracking-wider px-2 py-0.5 rounded-full';
        break;
      case 'db':
        label = 'Database';
        style = 'bg-[#FEF3C7] text-[#D97706] border-none font-bold text-[9.5px] uppercase tracking-wider px-2 py-0.5 rounded-full';
        break;
      case 'api':
        label = 'API Key';
        style = 'bg-[#FCE8E6] text-[#C5221F] border-none font-bold text-[9.5px] uppercase tracking-wider px-2 py-0.5 rounded-full';
        break;
      case 'cloud':
        label = 'Cloud Account';
        style = 'bg-[#E0F7FA] text-[#006064] border-none font-bold text-[9.5px] uppercase tracking-wider px-2 py-0.5 rounded-full';
        break;
      case 'cert':
        label = 'Certificate';
        style = 'bg-pink-50 text-pink-700 border-none font-bold text-[9.5px] uppercase tracking-wider px-2 py-0.5 rounded-full';
        break;
    }

    return (
      <Badge className={style}>{label}</Badge>
    );
  };

  // Render icons beautifully
  const renderIcon = (type: string) => {
    const iconStyle = "w-4 h-4 text-slate-500";
    switch (type) {
      case 'rdp': return <Monitor className={iconStyle} />;
      case 'vpn': return <Shield className={iconStyle} />;
      case 'ssh': return <Terminal className={iconStyle} />;
      case 'web': return <Globe className={iconStyle} />;
      case 'db': return <Database className={iconStyle} />;
      case 'api': return <KeyIcon className={iconStyle} />;
      case 'cloud': return <Cloud className={iconStyle} />;
      case 'cert': return <FileCode className={iconStyle} />;
      default: return <Lock className={iconStyle} />;
    }
  };

  // Determine password health/status badge from strength logic
  const renderStatus = (cred: Credential) => {
    const isWeak = cred.notes?.toLowerCase().includes('weak') || 
                   cred.label.toLowerCase().includes('database') || 
                   cred.username === 'db_admin';
    const isExpiring = cred.label.toLowerCase().includes('aws') || cred.type === 'cloud';

    if (isWeak) {
      return (
        <span className="flex items-center gap-1.5 text-xs text-red-600 font-semibold select-none">
          <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
          ▲ Weak Password
        </span>
      );
    }
    if (isExpiring) {
      return (
        <span className="flex items-center gap-1.5 text-xs text-amber-500 font-semibold select-none">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          ◔ Expiring Soon
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 text-xs text-green-600 font-semibold select-none">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        ● Healthy
      </span>
    );
  };

  const getVaultName = (cred: Credential) => {
    return cred.vaultId === 'shared' ? 'Team Shared Vault' : 'Personal Local Vault';
  };

  if (credentials.length === 0) {
    return (
      <div className="bg-white border border-[#DADCE0] rounded-2.5xl p-16 text-center shadow-xs flex flex-col items-center justify-center select-none">
        <div className="h-16 w-16 bg-[#F8F9FA] rounded-2xl flex items-center justify-center border border-[#F1F3F4] text-slate-400 mb-4 shadow-inner">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-800">No Secret Found</h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1 mb-6 leading-relaxed">
          Create a new entry, search by another query, or switch categories to view your keys.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#DADCE0] rounded-2.5xl shadow-sm overflow-hidden select-none">
      <div className="overflow-x-auto">
        <table className="w-full text-left table-auto border-collapse">
          <thead>
            <tr className="bg-[#F8F9FA] border-b border-[#F1F3F4] text-[10px] font-bold text-[#5F6368] uppercase tracking-wider select-none">
              <th className="py-4 px-5 w-12 text-center">Fav</th>
              <th className="py-4 px-5">Name / Endpoint</th>
              <th className="py-4 px-5">Category</th>
              <th className="py-4 px-5">Username</th>
              <th className="py-4 px-5">Vault Authority</th>
              <th className="py-4 px-5">Status</th>
              <th className="py-4 px-5">Last Updated</th>
              <th className="py-4 px-5 w-16 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F3F4]">
            {credentials.map((cred) => (
              <tr 
                key={cred.id}
                onClick={() => onRowClick(cred)}
                className="hover:bg-[#E8F0FE]/10 transition-colors cursor-pointer group select-none"
              >
                {/* Star toggle */}
                <td className="py-3 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => onToggleFavorite(cred)}
                    className="p-1.5 rounded-full hover:bg-neutral-100 text-slate-300 hover:text-amber-500 transition-all active:scale-95"
                  >
                    <Star className={`w-4 h-4 ${cred.favorite ? 'fill-amber-400 text-amber-500' : ''}`} />
                  </button>
                </td>

                {/* Name & endpoint */}
                <td className="py-3 px-5">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-[#F8F9FA] flex items-center justify-center border border-[#F1F3F4] flex-shrink-0 group-hover:scale-105 transition-transform shadow-3xs">
                      {renderIcon(cred.type)}
                    </div>
                    <div className="max-w-[180px] sm:max-w-[240px] truncate">
                      <p className="text-xs font-bold text-slate-800 tracking-tight">{cred.label}</p>
                      <p className="text-[10px] font-mono text-slate-400/80 mt-0.5 truncate">{cred.host || 'Local binding'}</p>
                    </div>
                  </div>
                </td>

                {/* Category Badge */}
                <td className="py-3 px-5">
                  {renderCategoryBadge(cred.type)}
                </td>

                {/* Username with Copy Button */}
                <td className="py-3 px-5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono font-medium text-slate-700 bg-[#F8F9FA] border border-[#F1F3F4] px-1.5 py-0.5 rounded-md truncate max-w-[120px]">{cred.username}</span>
                    <button 
                      onClick={(e) => handleQuickCopyUsername(e, cred.username)}
                      className="p-1 rounded hover:bg-neutral-100 text-slate-400 hover:text-slate-600 transition-colors"
                      title="Copy Username"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>

                {/* Vault Identifier */}
                <td className="py-3 px-5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                    cred.vaultId === 'shared' 
                      ? 'bg-purple-50 text-purple-700 border-purple-100' 
                      : 'bg-blue-50 text-[#1A73E8] border-blue-100'
                  }`}>
                    {getVaultName(cred)}
                  </span>
                </td>

                {/* Status indicator */}
                <td className="py-3 px-5">
                  {renderStatus(cred)}
                </td>

                {/* Last updated */}
                <td className="py-3 px-5">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-semibold">{new Date(cred.updatedAt).toLocaleDateString()}</span>
                    <span className="text-[9px] text-[#9AA0A6] mt-0.5">by {cred.lastModifiedBy || 'System Operator'}</span>
                  </div>
                </td>

                {/* Dropdown Options trigger */}
                <td className="py-3 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="relative inline-block text-left">
                    <button 
                      onClick={() => setActiveMenuId(activeMenuId === cred.id ? null : (cred.id || null))}
                      className="p-1.5 rounded-full hover:bg-neutral-100 text-slate-500"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenuId === cred.id && (
                      <div className="origin-top-right absolute right-0 mt-1 w-44 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-neutral-100 z-50 text-left select-none overflow-hidden border border-[#DADCE0]">
                        <div className="py-1">
                          <button 
                            onClick={(e) => { setActiveMenuId(null); onRowClick(cred); }}
                            className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-[#E8F0FE]/30 hover:text-[#1A73E8] w-full"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            Open Diagnostics
                          </button>
                          <button 
                            onClick={(e) => { setActiveMenuId(null); handleQuickCopyPassword(e, cred); }}
                            className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-[#E8F0FE]/30 hover:text-[#1A73E8] w-full font-bold"
                          >
                            {copiedId === cred.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                            Copy Password
                          </button>
                        </div>
                        <div className="py-1">
                          {selectedView === 'trash' ? (
                            <button 
                              onClick={() => { setActiveMenuId(null); cred.id && onRestore(cred.id); }}
                              className="flex items-center gap-2 px-4 py-2 text-xs text-[#137333] hover:bg-green-50 w-full"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Restore Credential
                            </button>
                          ) : (
                            <button 
                              onClick={() => { setActiveMenuId(null); onEdit(cred); }}
                              className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 w-full"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              Edit Asset
                            </button>
                          )}
                          <button 
                            onClick={() => { setActiveMenuId(null); cred.id && onDelete(cred.id); }}
                            className="flex items-center gap-2 px-4 py-2 text-xs text-red-600 hover:bg-red-50 w-full"
                          >
                            <Trash className="w-3.5 h-3.5" />
                            {selectedView === 'trash' ? 'Permanent Delete' : 'Move to Trash'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Row */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-[#F1F3F4] bg-[#F8F9FA] text-[11px] text-[#5F6368] font-bold select-none">
        <div className="flex items-center gap-3">
          <span>Showing 1 to {credentials.length} of {credentials.length} entries</span>
          <select className="bg-white border text-[10px] rounded px-1.5 py-0.5 outline-none font-bold text-slate-700">
            <option>20 / page</option>
            <option>50 / page</option>
            <option>100 / page</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled className="h-6 text-[10px] rounded px-2 select-none border-neutral-200">Previous</Button>
          <button className="h-6 w-6 rounded bg-[#1A73E8] text-white flex items-center justify-center font-black">1</button>
          <Button variant="outline" size="sm" disabled className="h-6 text-[10px] rounded px-2 select-none border-neutral-200">Next</Button>
        </div>
      </div>
    </div>
  );
}
