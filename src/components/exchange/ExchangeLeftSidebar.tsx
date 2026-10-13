import { useState, type ElementType, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Link2,
  FolderUp,
  Sparkles,
  FileStack,
  Activity,
  Shield,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import type { ExchangeNavId, ExchangeQuickFilter } from './exchange-utils';
import type { ExchangeTemplate } from './exchange-template-utils';
import { formatExchangeBytes, type ExchangeStorageBreakdown } from '../../services/exchangeApi';

interface ExchangeLeftSidebarProps {
  activeNav: ExchangeNavId;
  onNavigate: (id: ExchangeNavId) => void;
  quickFilter: ExchangeQuickFilter;
  onQuickFilter: (filter: ExchangeQuickFilter) => void;
  counts: {
    active: number;
    expiring: number;
    shared: number;
    received: number;
    burned: number;
    archived: number;
  };
  customTemplates?: ExchangeTemplate[];
  onApplyCustomTemplate?: (templateId: string) => void;
  storage?: ExchangeStorageBreakdown | null;
  onOpenSettings?: () => void;
  className?: string;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
      {children}
    </p>
  );
}

function NavButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
  countTone,
}: {
  active: boolean;
  onClick: () => void;
  icon: ElementType;
  label: string;
  count?: number;
  countTone?: 'green' | 'orange' | 'slate';
}) {
  const countClass =
    countTone === 'green'
      ? 'text-emerald-600'
      : countTone === 'orange'
        ? 'text-amber-600'
        : active
          ? 'text-blue-600'
          : 'text-slate-400';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors text-left',
        active
          ? 'bg-[#E8F0FE] text-[#1A73E8]'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
      )}
    >
      <Icon className="w-4 h-4 shrink-0 opacity-80" />
      <span className="truncate flex-1">{label}</span>
      {count !== undefined ? (
        <span className={cn('text-[11px] tabular-nums shrink-0 font-semibold', countClass)}>{count}</span>
      ) : null}
    </button>
  );
}

export function ExchangeLeftSidebar({
  activeNav,
  onNavigate,
  quickFilter,
  onQuickFilter,
  counts,
  customTemplates = [],
  onApplyCustomTemplate,
  storage,
  onOpenSettings,
  className,
}: ExchangeLeftSidebarProps) {
  const { t } = useTranslation();
  const [templatesExpanded, setTemplatesExpanded] = useState(false);

  const workspaceItems: { id: ExchangeNavId; icon: ElementType; labelKey: string; defaultLabel: string }[] = [
    { id: 'overview', icon: LayoutDashboard, labelKey: 'exchange.sidebar.overview', defaultLabel: 'Overview' },
    { id: 'secrets', icon: Link2, labelKey: 'exchange.sidebar.secureLinks', defaultLabel: 'Secure Links' },
    { id: 'dropzones', icon: FolderUp, labelKey: 'exchange.sidebar.dropzones', defaultLabel: 'Secure Dropzones' },
    { id: 'analysis', icon: Sparkles, labelKey: 'exchange.sidebar.aiEngine', defaultLabel: 'AI Analysis Engine' },
    { id: 'templates', icon: FileStack, labelKey: 'exchange.sidebar.templates', defaultLabel: 'Templates' },
    { id: 'activity', icon: Activity, labelKey: 'exchange.sidebar.activity', defaultLabel: 'Activity' },
    { id: 'security', icon: Shield, labelKey: 'exchange.sidebar.securityCenter', defaultLabel: 'Security Center' },
  ];

  const filterItems: { id: ExchangeQuickFilter; labelKey: string; defaultLabel: string; countKey?: keyof typeof counts; tone?: 'green' | 'orange' }[] = [
    { id: 'active', labelKey: 'exchange.filters.active', defaultLabel: 'Aktiv', countKey: 'active', tone: 'green' },
    { id: 'expiring', labelKey: 'exchange.filters.expiring', defaultLabel: 'Läuft bald ab', countKey: 'expiring', tone: 'orange' },
    { id: 'shared', labelKey: 'exchange.filters.sharedByMe', defaultLabel: 'Von mir geteilt', countKey: 'shared' },
    { id: 'received', labelKey: 'exchange.filters.received', defaultLabel: 'Empfangen', countKey: 'received' },
    { id: 'burned', labelKey: 'exchange.filters.burned', defaultLabel: 'Vernichtet', countKey: 'burned' },
    { id: 'archived', labelKey: 'exchange.filters.archived', defaultLabel: 'Archiviert', countKey: 'archived' },
  ];

  const usedPercent = storage ? Math.round(storage.usedPercent) : 0;
  const quotaLabel = storage ? formatExchangeBytes(storage.quotaBytes) : '2 TB';
  const usedLabel = storage ? formatExchangeBytes(storage.totalBytes) : '—';
  const strokeDash = `${Math.max(1, usedPercent)} ${100 - Math.max(1, usedPercent)}`;
  const storageWarning = storage ? usedPercent >= storage.warningThresholdPercent : false;

  return (
    <aside
      className={cn(
        'w-[280px] shrink-0 border-r border-slate-200/80 bg-white flex flex-col min-h-0 hidden xl:flex',
        className,
      )}
    >
      <div className="flex-1 overflow-y-auto py-3 px-2">
        <SectionLabel>{t('exchange.sidebar.workspace', 'Workspace')}</SectionLabel>
        <nav className="space-y-0.5">
          {workspaceItems.map((item) => (
            <NavButton
              key={item.id}
              active={activeNav === item.id && !quickFilter}
              onClick={() => {
                onQuickFilter(null);
                onNavigate(item.id);
              }}
              icon={item.icon}
              label={t(item.labelKey, item.defaultLabel)}
            />
          ))}
        </nav>

        <SectionLabel>{t('exchange.sidebar.quickFilters', 'Schnellfilter')}</SectionLabel>
        <nav className="space-y-0.5">
          {filterItems.map((item) => (
            <NavButton
              key={item.id}
              active={quickFilter === item.id}
              onClick={() => onQuickFilter(quickFilter === item.id ? null : item.id)}
              icon={Shield}
              label={t(item.labelKey, item.defaultLabel)}
              count={item.countKey ? counts[item.countKey] : undefined}
              countTone={item.tone}
            />
          ))}
        </nav>

        <div className="px-1 pt-2">
          <button
            type="button"
            onClick={() => setTemplatesExpanded((open) => !open)}
            className="w-full flex items-center justify-between px-2 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-wider text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          >
            <span>{t('exchange.sidebar.templatesSection', 'Vorlagen')}</span>
            <ChevronDown className={cn('w-4 h-4 transition-transform', templatesExpanded && 'rotate-180')} />
          </button>
          {templatesExpanded ? (
            <nav className="space-y-0.5 mt-1">
              {customTemplates.length === 0 ? (
                <p className="px-3 py-2 text-[11px] text-slate-400">
                  {t('exchange.templates.emptySidebar', 'Keine benutzerdefinierten Vorlagen. Erstellen Sie eine unter Vorlagen.')}
                </p>
              ) : (
                customTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => onApplyCustomTemplate?.(template.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 text-left transition-colors"
                  >
                    <FileStack className="w-4 h-4 shrink-0 opacity-70" />
                    <span className="truncate">{template.title}</span>
                  </button>
                ))
              )}
            </nav>
          ) : null}
        </div>
      </div>

      <div className="border-t border-slate-200/80 p-3 shrink-0 space-y-3">
        <div
          className={cn(
            'rounded-xl border bg-slate-50/80 p-3',
            storageWarning ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200/80',
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            {t('exchange.storage.title', 'Speicher')}
          </p>
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0">
              <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke={storageWarning ? '#f59e0b' : '#1A73E8'}
                  strokeWidth="3"
                  strokeDasharray={strokeDash}
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900">{usedLabel}</p>
              <p className="text-[10px] text-slate-500">
                {t('exchange.storage.ofTotal', 'von {{quota}}').replace('{{quota}}', quotaLabel)}
              </p>
            </div>
          </div>
          <div className="mt-2 space-y-1 text-[10px] text-slate-500">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                {t('exchange.storage.secrets', 'Geheimnisse')}
              </span>
              <span className="font-semibold text-slate-700">
                {storage ? formatExchangeBytes(storage.secretsBytes) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                {t('exchange.storage.dropzoneFiles', 'Uploads')}
              </span>
              <span className="font-semibold text-slate-700">
                {storage ? formatExchangeBytes(storage.uploadsBytes) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {t('exchange.storage.diagnostics', 'Diagnose')}
              </span>
              <span className="font-semibold text-slate-700">
                {storage ? formatExchangeBytes(storage.diagnosticsBytes) : '—'}
              </span>
            </div>
          </div>
        </div>
        <NavButton
          active={false}
          onClick={() => onOpenSettings?.()}
          icon={Settings}
          label={t('exchange.sidebar.settings', 'Einstellungen')}
        />
      </div>
    </aside>
  );
}
