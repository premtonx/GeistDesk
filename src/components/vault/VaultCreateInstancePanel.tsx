import { type FormEvent } from 'react';
import { Lock, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { ModuleToolbarSelect } from '../ui/module-page';
import { useTranslation } from '../../lib/context/I18nContext';
import type { VaultAuthorityScope } from '../../lib/vault-service';

export interface VaultCreateInstancePanelProps {
  name: string;
  description: string;
  scope: VaultAuthorityScope;
  emoji: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onScopeChange: (scope: VaultAuthorityScope) => void;
  onEmojiChange: (value: string) => void;
  isSubmitting: boolean;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}

export function VaultCreateInstancePanel({
  name,
  description,
  scope,
  emoji,
  onNameChange,
  onDescriptionChange,
  onScopeChange,
  onEmojiChange,
  isSubmitting,
  onSubmit,
  onCancel,
}: VaultCreateInstancePanelProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-[#F8F9FB] flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">
              {t('vault.create.title', 'Create New Vault')}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              {t(
                'vault.create.description',
                'Create an independent KeePass-style vault instance with its own encryption salt.',
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t('actions.cancel', 'Abbrechen')}
        </button>
      </div>

      <form onSubmit={onSubmit} className="p-5 space-y-4 max-w-xl">
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <Input
            value={emoji}
            onChange={(e) => onEmojiChange(e.target.value)}
            className="w-14 text-center rounded-xl h-10"
            maxLength={4}
            aria-label={t('vault.portfolio.emoji', 'Emoji')}
          />
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t('vault.create.namePlaceholder', 'Vault name')}
            className="rounded-xl h-10"
            required
            autoFocus
          />
        </div>
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={t('vault.create.descPlaceholder', 'Description (optional)')}
          className="rounded-xl min-h-[72px] text-sm"
        />
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pl-1">
            {t('vault.portfolio.clearanceTier', 'Clearance tier')}
          </label>
          <ModuleToolbarSelect
            value={scope}
            onChange={(v) => onScopeChange(v as VaultAuthorityScope)}
            aria-label={t('vault.portfolio.clearanceTier', 'Clearance tier')}
          >
            <option value="personal">{t('vault.authorities.personal', 'Personal')}</option>
            <option value="department">{t('vault.authorities.department', 'Department')}</option>
            <option value="team">{t('vault.authorities.team', 'Shared Team')}</option>
            <option value="global">{t('vault.authorities.global', 'Company Global')}</option>
          </ModuleToolbarSelect>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold h-10 px-6"
          >
            {isSubmitting
              ? t('vault.create.creating', 'Creating...')
              : t('vault.create.button', 'Create Vault')}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} className="rounded-xl text-xs font-bold">
            {t('actions.cancel', 'Abbrechen')}
          </Button>
        </div>
      </form>
    </div>
  );
}
