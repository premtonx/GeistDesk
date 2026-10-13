import { type ReactNode } from 'react';
import { Headphones, Bug, Bot } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useWorkspace } from '../../lib/context/WorkspaceContext';
import { AppWorkspace } from '../../lib/ticketWorkspace';
import { useTranslation } from '../../lib/context/I18nContext';

const options: {
  id: AppWorkspace;
  icon: ReactNode;
  labelKey: string;
  defaultLabel: string;
  emoji: string;
}[] = [
  {
    id: 'support',
    emoji: '🎧',
    icon: <Headphones className="w-3.5 h-3.5 shrink-0" aria-hidden />,
    labelKey: 'workspace.support',
    defaultLabel: 'Support Workspace',
  },
  {
    id: 'developer',
    emoji: '💻',
    icon: <Bug className="w-3.5 h-3.5 shrink-0" aria-hidden />,
    labelKey: 'workspace.developer',
    defaultLabel: 'Developer Workspace',
  },
  {
    id: 'ai_ops',
    emoji: '🤖',
    icon: <Bot className="w-3.5 h-3.5 shrink-0" aria-hidden />,
    labelKey: 'workspace.aiOps',
    defaultLabel: 'AI Operations',
  },
];

interface WorkspaceSwitcherProps {
  className?: string;
  compact?: boolean;
}

export function WorkspaceSwitcher({ className, compact }: WorkspaceSwitcherProps) {
  const { workspace, setWorkspace } = useWorkspace();
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'inline-flex h-10 max-h-10 items-center rounded-lg border border-slate-200/80 bg-white p-0.5 shrink-0',
        className,
      )}
      role="tablist"
      aria-label={t('workspace.switcherLabel', 'Workspace')}
    >
      {options.map((opt) => {
        const active = workspace === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setWorkspace(opt.id)}
            title={t(opt.labelKey, opt.defaultLabel)}
            className={cn(
              'inline-flex h-9 items-center gap-1 rounded-md px-2 text-[11px] font-semibold transition-colors',
              active
                ? 'bg-[#E8F0FE] text-[#1A73E8] shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50',
            )}
          >
            <span className="text-sm leading-none" aria-hidden>
              {opt.emoji}
            </span>
            {!compact && (
              <span className={cn('hidden xl:inline')}>{t(opt.labelKey, opt.defaultLabel)}</span>
            )}
            {compact && !active && null}
            {compact && active && (
              <span className="hidden sm:inline truncate max-w-[72px]">
                {t(opt.labelKey, opt.defaultLabel).split(' ')[0]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
