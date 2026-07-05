import { type FormEvent } from 'react';
import { X, PenLine } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useTranslation } from '../../lib/context/I18nContext';

export interface VaultEditCredential {
  id?: number | string;
  type: string;
  label: string;
  username: string;
  encryptedPassword: string;
  host?: string;
  notes?: string;
}

export interface VaultCustomCategoryOption {
  slug: string;
  name: string;
}

export interface VaultCredentialEditSidebarProps {
  credential: VaultEditCredential;
  onChange: (credential: VaultEditCredential) => void;
  rawPassword: string;
  onRawPasswordChange: (value: string) => void;
  customCategories: VaultCustomCategoryOption[];
  isSaving: boolean;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}

export function VaultCredentialEditSidebar({
  credential,
  onChange,
  rawPassword,
  onRawPasswordChange,
  customCategories,
  isSaving,
  onSubmit,
  onCancel,
}: VaultCredentialEditSidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="w-[340px] shrink-0 border-l border-slate-200/80 bg-white flex flex-col min-h-0">
      <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="px-4 py-4 border-b border-slate-200/80 bg-[#F8F9FB] shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[#1A73E8] mb-1">
                <PenLine className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {t('vault.editPanel.title', 'Edit Asset')}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 truncate">{credential.label}</h3>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                {t('vault.editPanel.subtitle', 'Changes encrypt locally before saving to the vault.')}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
              aria-label={t('actions.close', 'Close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1">
              {t('vault.editPanel.nameLabel', 'Name Label')}
            </label>
            <Input
              value={credential.label}
              onChange={(e) => onChange({ ...credential, label: e.target.value })}
              className="bg-white border-[#DADCE0] rounded-xl text-sm h-9"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1">
              {t('vault.editPanel.category', 'Category Type')}
            </label>
            <Select
              value={credential.type}
              onValueChange={(val) => onChange({ ...credential, type: val })}
            >
              <SelectTrigger className="bg-white border-[#DADCE0] rounded-xl text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="web">Standard Web Login</SelectItem>
                <SelectItem value="rdp">Remote Desktop (RDP)</SelectItem>
                <SelectItem value="vpn">VPN Tunnel</SelectItem>
                <SelectItem value="ssh">Secure Shell (SSH)</SelectItem>
                <SelectItem value="db">Database Account</SelectItem>
                <SelectItem value="api">API Token & Key</SelectItem>
                <SelectItem value="cloud">Cloud Account</SelectItem>
                {customCategories.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1">
              {t('vault.editPanel.host', 'Host Endpoint Address')}
            </label>
            <Input
              value={credential.host || ''}
              onChange={(e) => onChange({ ...credential, host: e.target.value })}
              className="bg-white border-[#DADCE0] rounded-xl text-sm h-9"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1">
              {t('vault.editPanel.username', 'Username / ID')}
            </label>
            <Input
              value={credential.username}
              onChange={(e) => onChange({ ...credential, username: e.target.value })}
              className="bg-white border-[#DADCE0] rounded-xl text-sm h-9"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1">
              {t('vault.editPanel.password', 'New Password (optional)')}
            </label>
            <Input
              type="password"
              placeholder="••••••••"
              value={rawPassword}
              onChange={(e) => onRawPasswordChange(e.target.value)}
              className="bg-white border-[#DADCE0] rounded-xl text-sm h-9"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1">
              {t('vault.editPanel.notes', 'Operational Internal Notes')}
            </label>
            <Textarea
              value={credential.notes || ''}
              onChange={(e) => onChange({ ...credential, notes: e.target.value })}
              className="bg-white border-[#DADCE0] rounded-xl text-sm resize-none h-24"
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200/80 bg-white p-4 flex flex-col gap-2">
          <Button
            type="submit"
            disabled={isSaving || !credential.label.trim()}
            className="w-full bg-[#1A73E8] hover:bg-[#155fc0] text-white rounded-xl font-bold text-xs h-10"
          >
            {isSaving
              ? t('vault.editPanel.saving', 'Re-Encrypting…')
              : t('vault.editPanel.save', 'Update Secrets Record')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="w-full rounded-xl text-xs font-bold text-[#5F6368]"
          >
            {t('actions.cancel', 'Cancel')}
          </Button>
        </div>
      </form>
    </aside>
  );
}
