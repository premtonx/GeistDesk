import React from 'react';
import {
  LayoutDashboard,
  FileText,
  FilePen,
  ClipboardCheck,
  Sparkles,
  BarChart3,
  BookOpen,
  Package,
  Code2,
  Plug,
  Wrench,
  CreditCard,
  Shield,
  Building2,
  TrendingUp,
  Clock,
  Eye,
  BookX,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { categoryI18nKey } from './kb-utils';

export type KBNavFilter =
  | { type: 'workspace'; id: string }
  | { type: 'category'; id: string }
  | { type: 'smart'; id: string };

interface KBLeftSidebarProps {
  active: KBNavFilter;
  onNavigate: (filter: KBNavFilter) => void;
  counts: {
    all: number;
    drafts: number;
    reviews: number;
    categories: Record<string, number>;
    popular: number;
    recent: number;
    mostViewed: number;
    missing: number;
    outdated: number;
  };
  className?: string;
}

const WORKSPACE_ITEMS = [
  { id: 'overview', icon: LayoutDashboard, labelKey: 'kb.sidebar.overview', defaultLabel: 'Overview' },
  { id: 'all', icon: FileText, labelKey: 'kb.sidebar.allArticles', defaultLabel: 'All Articles' },
  { id: 'drafts', icon: FilePen, labelKey: 'kb.sidebar.drafts', defaultLabel: 'Drafts' },
  { id: 'reviews', icon: ClipboardCheck, labelKey: 'kb.sidebar.reviews', defaultLabel: 'Reviews' },
  { id: 'ai', icon: Sparkles, labelKey: 'kb.sidebar.aiAssistant', defaultLabel: 'AI Assistant' },
  { id: 'analytics', icon: BarChart3, labelKey: 'kb.sidebar.analytics', defaultLabel: 'Analytics' },
] as const;

const CATEGORY_ITEMS: { id: string; icon: React.ElementType; labelKey?: string }[] = [
  { id: 'Getting Started', icon: BookOpen },
  { id: 'Product Guides', icon: Package },
  { id: 'API Documentation', icon: Code2 },
  { id: 'Integrations', icon: Plug },
  { id: 'Troubleshooting', icon: Wrench },
  { id: 'Billing', icon: CreditCard, labelKey: 'kb.sidebar.billingPlans' },
  { id: 'Security', icon: Shield },
  { id: 'Internal SOPs', icon: Shield },
  { id: 'Company Policies', icon: Building2 },
];

const SMART_ITEMS = [
  { id: 'popular', icon: TrendingUp, labelKey: 'kb.sidebar.popularArticles', defaultLabel: 'Popular Articles' },
  { id: 'recent', icon: Clock, labelKey: 'kb.sidebar.recentlyUpdated', defaultLabel: 'Recently Updated' },
  { id: 'mostViewed', icon: Eye, labelKey: 'kb.sidebar.mostViewed', defaultLabel: 'Most Viewed' },
  { id: 'missing', icon: BookX, labelKey: 'kb.sidebar.missingArticles', defaultLabel: 'Missing Articles' },
  { id: 'outdated', icon: AlertTriangle, labelKey: 'kb.sidebar.outdatedContent', defaultLabel: 'Outdated Content' },
] as const;

function NavButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  count?: number;
}) {
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
        <span className={cn('text-[11px] tabular-nums shrink-0', active ? 'text-blue-600' : 'text-slate-400')}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
      {children}
    </p>
  );
}

export function KBLeftSidebar({ active, onNavigate, counts, className }: KBLeftSidebarProps) {
  const { t } = useTranslation();

  const isActive = (type: KBNavFilter['type'], id: string) =>
    active.type === type && active.id === id;

  const workspaceCount = (id: string) => {
    if (id === 'all' || id === 'overview' || id === 'analytics') return counts.all;
    if (id === 'drafts') return counts.drafts;
    if (id === 'reviews') return counts.reviews;
    return undefined;
  };

  const smartCount = (id: string) => {
    if (id === 'popular') return counts.popular;
    if (id === 'recent') return counts.recent;
    if (id === 'mostViewed') return counts.mostViewed;
    if (id === 'missing') return counts.missing;
    if (id === 'outdated') return counts.outdated;
    return undefined;
  };

  return (
    <aside
      className={cn(
        'w-[220px] shrink-0 border-r border-slate-200/80 bg-white flex flex-col min-h-0 hidden lg:flex',
        className,
      )}
    >
      <div className="flex-1 overflow-y-auto py-3 px-2">
        <SectionLabel>{t('kb.sidebar.workspace', 'Workspace')}</SectionLabel>
        <nav className="space-y-0.5">
          {WORKSPACE_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              active={isActive('workspace', item.id)}
              onClick={() => onNavigate({ type: 'workspace', id: item.id })}
              icon={item.icon}
              label={t(item.labelKey, item.defaultLabel)}
              count={workspaceCount(item.id)}
            />
          ))}
        </nav>

        <SectionLabel>{t('kb.sidebar.categories', 'Categories')}</SectionLabel>
        <nav className="space-y-0.5">
          {CATEGORY_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              active={isActive('category', item.id)}
              onClick={() => onNavigate({ type: 'category', id: item.id })}
              icon={item.icon}
              label={
                item.labelKey
                  ? t(item.labelKey, 'Billing & Plans')
                  : t(categoryI18nKey(item.id), item.id)
              }
              count={counts.categories[item.id] ?? 0}
            />
          ))}
        </nav>

        <SectionLabel>{t('kb.sidebar.smartViews', 'Smart Views')}</SectionLabel>
        <nav className="space-y-0.5">
          {SMART_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              active={isActive('smart', item.id)}
              onClick={() => onNavigate({ type: 'smart', id: item.id })}
              icon={item.icon}
              label={t(item.labelKey, item.defaultLabel)}
              count={smartCount(item.id)}
            />
          ))}
        </nav>
      </div>

      <div className="border-t border-slate-200/80 p-2 shrink-0">
        <NavButton
          active={false}
          onClick={() => {}}
          icon={Settings}
          label={t('kb.sidebar.settings', 'Settings')}
        />
      </div>
    </aside>
  );
}
