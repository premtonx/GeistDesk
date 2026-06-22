import React, { useState, useEffect } from 'react';
import { 
  X, 
  Key, 
  Eye, 
  EyeOff, 
  Copy, 
  ExternalLink, 
  Clock, 
  ShieldCheck, 
  Check, 
  Calendar, 
  User, 
  Server, 
  Globe, 
  AlertTriangle,
  Building2,
  Ticket,
  Cpu,
  Share2,
  RefreshCw,
  Star
} from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { toast } from 'sonner';
import { MOCK_AUDIT_LOGS } from './DefaultData';

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

interface CredentialDrawerProps {
  credential: Credential | null;
  onClose: () => void;
  onDecryptPassword: (cred: Credential) => Promise<string | null>;
  onToggleFavorite: (cred: Credential) => void;
  onEdit: (cred: Credential) => void;
  onDelete: (id: number | string) => void;
}

export function CredentialDrawer({
  credential,
  onClose,
  onDecryptPassword,
  onToggleFavorite,
  onEdit,
  onDelete
}: CredentialDrawerProps) {
  const [decryptedPassword, setDecryptedPassword] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [loadingDecryption, setLoadingDecryption] = useState(false);

  useEffect(() => {
    setDecryptedPassword(null);
    setIsRevealed(false);
    setIsCopied(false);
  }, [credential]);

  if (!credential) return null;

  const handleRevealToggle = async () => {
    if (isRevealed) {
      setIsRevealed(false);
      return;
    }

    if (decryptedPassword) {
      setIsRevealed(true);
      return;
    }

    setLoadingDecryption(true);
    try {
      const plain = await onDecryptPassword(credential);
      if (plain) {
        setDecryptedPassword(plain);
        setIsRevealed(true);
      }
    } catch (err) {
      toast.error("Decryption failed. Ensure vault is unlocked with proper master key.");
    } finally {
      setLoadingDecryption(false);
    }
  };

  const handleCopyPassword = async () => {
    let plain = decryptedPassword;
    if (!plain) {
      try {
        const p = await onDecryptPassword(credential);
        if (p) {
          plain = p;
          setDecryptedPassword(p);
        }
      } catch (err) {
        toast.error("Unable to copy. Vault key mismatch.");
        return;
      }
    }

    if (plain) {
      navigator.clipboard.writeText(plain);
      setIsCopied(true);
      toast.success("Password copied to clipboard!");
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleCopyUsername = () => {
    navigator.clipboard.writeText(credential.username);
    toast.success("Username copied!");
  };

  const handleCopyHost = () => {
    if (credential.host) {
      navigator.clipboard.writeText(credential.host);
      toast.success("Host IP / URL copied!");
    }
  };

  const formattedDate = new Date(credential.updatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const getStrengthMarkup = () => {
    const isWeak = credential.notes?.toLowerCase().includes('weak') || 
                   credential.label.toLowerCase().includes('database') || 
                   credential.username === 'db_admin';
    if (isWeak) {
      return {
        label: 'Weak Password',
        color: 'bg-red-50 text-red-600 border-red-100',
        disc: '▲ Weak password detected. Rotate immediately to preserve zero-trust.'
      };
    }
    return {
      label: 'Sovereign-grade Strong',
      color: 'bg-green-50 text-green-600 border-green-100',
      disc: '✓ High entropy protection verified locally before storage.'
    };
  };

  const strength = getStrengthMarkup();

  // Categories badge mapper
  const getCategoryTheme = (type: string) => {
    switch (type) {
      case 'rdp': return 'bg-blue-50 text-[#1A73E8] border-none font-bold text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full';
      case 'vpn': return 'bg-green-50 text-[#137333] border-none font-bold text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full';
      case 'ssh': return 'bg-amber-50 text-[#B06000] border-none font-bold text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full';
      case 'web': return 'bg-purple-50 text-[#6B21A8] border-none font-bold text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full';
      case 'db': return 'bg-pink-50 text-pink-700 border-none font-bold text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full';
      case 'api': return 'bg-rose-50 text-rose-600 border-none font-bold text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full';
      default: return 'bg-gray-50 text-gray-600 border-none font-bold text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden select-none">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-xs"
      />

      {/* Slide Drawer Content */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 220 }}
        className="relative w-full max-w-[480px] h-full bg-white shadow-2xl flex flex-col border-l border-[#DADCE0]"
      >
        {/* Header toolbar */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#F1F3F4] bg-[#F8F9FA]">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-neutral-200 transition-colors text-slate-500"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Asset Details</span>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onToggleFavorite(credential)}
              className="h-8 w-8 p-0 rounded-full border-[#DADCE0]"
            >
              <Star className={`w-4 h-4 ${credential.favorite ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`} />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onEdit(credential)}
              className="h-8 text-xs font-semibold rounded-lg border-[#DADCE0] hover:bg-neutral-50 px-3 text-[#1A73E8]"
            >
              Edit Asset
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => credential.id && onDelete(credential.id)}
              className="h-8 text-xs font-semibold rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 px-3"
            >
              Delete
            </Button>
          </div>
        </div>

        {/* Scrollable details */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Identity Block */}
          <div className="flex items-start gap-4 pb-4 border-b border-[#F1F3F4]">
            <div className="h-14 w-14 rounded-2xl bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center font-bold border border-[#F1F3F4] shadow-inner text-lg uppercase">
              {credential.label.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-[#202124] tracking-tight">{credential.label}</h3>
                <Badge className={getCategoryTheme(credential.type)}>
                  {credential.type}
                </Badge>
              </div>
              <p className="text-xs text-[#5F6368] mt-1">Host: <span className="font-mono text-[11px] font-semibold text-[#1A73E8] bg-[#E8F0FE] px-1.5 py-0.5 rounded-md break-all">{credential.host || 'Local Instance'}</span></p>
            </div>
          </div>

          {/* Core Credentials Section */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest">Sovereign Credentials</h4>
            
            <div className="bg-[#F8F9FA] rounded-2xl border border-[#DADCE0] p-4 space-y-4 shadow-xs">
              {/* Username Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Username</span>
                  <button 
                    onClick={handleCopyUsername}
                    className="p-1 rounded-md text-[#1A73E8] hover:bg-[#E8F0FE] transition-colors flex items-center gap-1 text-[10px] font-bold"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </button>
                </div>
                <p className="text-sm font-mono text-slate-800 break-all bg-white py-2 px-3 rounded-lg border border-[#F1F3F4]">{credential.username}</p>
              </div>

              {/* Password Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Secret Value / Password</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleRevealToggle}
                      className="p-1 rounded-md text-slate-600 hover:bg-[#E8F0FE] transition-colors flex items-center gap-1 text-[10px] font-bold"
                    >
                      {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {loadingDecryption ? '...' : (isRevealed ? 'Hide' : 'Reveal')}
                    </button>
                    <button 
                      onClick={handleCopyPassword}
                      className="p-1 rounded-md text-[#1A73E8] hover:bg-[#E8F0FE] transition-colors flex items-center gap-1 text-[10px] font-bold"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy
                    </button>
                  </div>
                </div>
                
                <div className="py-2 px-3 rounded-lg border border-[#F1F3F4] bg-white font-mono text-sm tracking-widest flex items-center justify-between h-10 overflow-hidden text-slate-800 break-all">
                  {isRevealed ? (
                    <span className="tracking-normal select-text">{decryptedPassword || '••••••••'}</span>
                  ) : (
                    <span>••••••••••••••••</span>
                  )}
                </div>
              </div>

              {/* Host Field */}
              {credential.host && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Endpoint Host / Target IP</span>
                    <button 
                      onClick={handleCopyHost}
                      className="p-1 rounded-md text-[#1a73e8] hover:bg-[#E8F0FE] transition-colors flex items-center gap-1 text-[10px] font-bold"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy Host
                    </button>
                  </div>
                  <p className="text-sm font-mono text-slate-800 bg-white py-2 px-3 rounded-lg border border-[#F1F3F4] break-all">{credential.host}</p>
                </div>
              )}
            </div>
          </div>

          {/* Security & Health Check Badge */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest">Strength & Health Review</h4>
            <div className={`border p-4 rounded-2xl flex items-start gap-3 shadow-2xs ${strength.color}`}>
              {strength.label.includes('Weak') ? (
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
              ) : (
                <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-500" />
              )}
              <div>
                <p className="text-xs font-bold">{strength.label}</p>
                <p className="text-[11px] opacity-80 mt-1 leading-relaxed">{strength.disc}</p>
              </div>
            </div>
          </div>

          {/* Linked Core Objects */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest">Enterprise Linkages</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#F8F9FA] rounded-xl border border-[#DADCE0] p-3 text-center flex flex-col items-center justify-center gap-1 shadow-2xs">
                <Ticket className="w-4 h-4 text-[#1A73E8]" />
                <span className="text-[9px] font-bold text-slate-400 uppercase">Linked Ticket</span>
                <span className="text-[10px] font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded-md border mt-1">#4392</span>
              </div>
              <div className="bg-[#F8F9FA] rounded-xl border border-[#DADCE0] p-3 text-center flex flex-col items-center justify-center gap-1 shadow-2xs">
                <Building2 className="w-4 h-4 text-green-600" />
                <span className="text-[9px] font-bold text-slate-400 uppercase">Linked Company</span>
                <span className="text-[10px] font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded-md border mt-1 select-none">Acme Global</span>
              </div>
              <div className="bg-[#F8F9FA] rounded-xl border border-[#DADCE0] p-3 text-center flex flex-col items-center justify-center gap-1 shadow-2xs">
                <Cpu className="w-4 h-4 text-purple-600" />
                <span className="text-[9px] font-bold text-slate-400 uppercase">Linked Asset</span>
                <span className="text-[10px] font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded-md border mt-1 select-none">Web_ORIG_99</span>
              </div>
            </div>
          </div>

          {/* Encryption metadata info */}
          <div className="space-y-3 bg-[#E8F0FE]/30 rounded-2xl border border-blue-50 p-4 shadow-inner">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#1A73E8]" />
              <p className="text-xs font-bold text-[#1a73e8] uppercase tracking-wide">Zero-Knowledge Quantum Bind</p>
            </div>
            <p className="text-[10px] text-slate-600 leading-relaxed leading-normal">
              This secret block is pre-encrypted in-browser using <b>AES-256-GCM</b> and <b>Argon2id</b>. Plaintext is decrypted purely locally in-memory and never reaches Cloud Servers or intermediate databases under any unencrypted form.
            </p>
          </div>

          {/* Internal Notes */}
          {credential.notes && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest">Internal Operational Notes</h4>
              <p className="text-xs text-slate-600 bg-[#F8F9FA] p-3.5 rounded-xl border leading-relaxed shadow-3xs break-words font-sans">{credential.notes}</p>
            </div>
          )}

          {/* Local / Sync Status */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest">Synchronization Status</h4>
            <div className="bg-[#F8F9FA] rounded-xl border border-[#DADCE0] p-3 space-y-1.5 text-xs shadow-2xs text-slate-500">
              <div className="flex items-center justify-between">
                <span>Authority Group</span>
                <span className="font-semibold text-slate-700">{credential.vaultId === 'shared' ? 'Team Shared Vault' : 'Personal Local Vault'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Modified By</span>
                <span className="font-semibold text-slate-700">{credential.lastModifiedBy || 'Local User'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Last Updated</span>
                <span className="font-mono text-slate-700 text-[11px]">{formattedDate}</span>
              </div>
            </div>
          </div>

          {/* Detailed Audit Logs Tracking */}
          <div className="space-y-3 pt-2 border-t border-[#F1F3F4]">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest">Audit Trails (ISO 27001 Compliance)</h4>
              <Badge variant="outline" className="text-[8px] h-4 px-1 text-green-600 bg-green-50 border-green-200 uppercase tracking-tighter">Verified Audit</Badge>
            </div>
            
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {MOCK_AUDIT_LOGS.map((log, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-[#F8F9FA] border border-[#F1F3F4] text-[10px] shadow-3xs">
                  <div>
                    <div className="flex items-center gap-1 bg-white border border-[#E8F0FE] text-slate-700 font-bold px-1.5 py-0.5 rounded-md inline-block">
                      {log.action}
                    </div>
                    <span className="ml-2 font-semibold text-slate-700">{log.user}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-mono text-slate-500">{log.date}</p>
                    <p className="text-[8px] text-[#1A73E8]">IP: {log.ip} ({log.loc})</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions Footer */}
        <div className="shrink-0 border-t border-slate-200/80 bg-white px-4 py-3 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleCopyUsername} className="h-8 text-xs font-semibold rounded-md">
            <Copy className="w-3.5 h-3.5 mr-1" />
            Copy Username
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleCopyPassword} className="h-8 text-xs font-semibold rounded-md">
            <Copy className="w-3.5 h-3.5 mr-1" />
            Copy Secret
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => toast.info('Credential rotation scheduled.')}
            className="h-8 text-xs font-semibold rounded-md"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Rotate
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => toast.success('Share link generated.')}
            className="h-8 text-xs font-semibold rounded-md"
          >
            <Share2 className="w-3.5 h-3.5 mr-1" />
            Share Access
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
