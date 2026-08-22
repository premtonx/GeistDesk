import type { LucideIcon } from 'lucide-react';
import {
  Shield,
  Globe,
  Webhook,
  Database,
  ShieldAlert,
  Sparkles,
  Mail,
  Settings as SettingsIcon,
  Users,
  Radio,
  Briefcase,
  Bell,
  BarChart3,
  Building2,
  ShieldCheck,
  Lock,
} from 'lucide-react';

export const ADMIN_HUB_TABS = [
  { id: 'uebersicht', label: 'Übersicht', labelKey: 'admin.hubTabs.overview' },
  { id: 'ai-engine', label: 'Kern-KI & Modelle', labelKey: 'admin.hubTabs.aiEngine' },
  { id: 'governance', label: 'PII & Compliance', labelKey: 'admin.hubTabs.governance' },
  { id: 'integrations', label: 'Mail & Schnittstellen', labelKey: 'admin.hubTabs.integrations' },
  { id: 'system', label: 'Infrastruktur & Backups', labelKey: 'admin.hubTabs.system' },
] as const;

export type AdminHubTabId = (typeof ADMIN_HUB_TABS)[number]['id'];

const TAB_ALIASES: Record<string, AdminHubTabId> = {
  uebersicht: 'uebersicht',
  overview: 'uebersicht',
  'ai-engine': 'ai-engine',
  ai: 'ai-engine',
  ki: 'ai-engine',
  governance: 'governance',
  pii: 'governance',
  compliance: 'governance',
  integrations: 'integrations',
  mail: 'integrations',
  system: 'system',
  infra: 'system',
};

export function resolveAdminHubTab(raw: string | null | undefined): AdminHubTabId {
  const key = String(raw || '').trim().toLowerCase();
  return TAB_ALIASES[key] ?? 'uebersicht';
}

export interface AdminHubSection {
  title: string;
  description: string;
  icon: LucideIcon;
  path: string;
  color: string;
  bgColor: string;
  borderColor: string;
  badge: string;
  module: string;
}

export interface AdminHubCategory {
  id: string;
  title: string;
  tab: AdminHubTabId;
  sections: AdminHubSection[];
}

export const ADMIN_HUB_CATEGORIES: AdminHubCategory[] = [
  {
    id: 'core_ai',
    title: 'Core AI',
    tab: 'ai-engine',
    sections: [
      {
        title: 'AI Orchestrator',
        description: 'Configure LLM routing, sentiment analysis, and intelligence layers.',
        icon: Sparkles,
        path: '/admin/ai',
        color: 'text-blue-500',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-105',
        badge: 'Core Engine',
        module: 'legal',
      },
      {
        title: 'Sovereign AI Insights',
        description: 'Executive intelligence, autonomous problem detection clusters, and SLA analysis.',
        icon: Sparkles,
        path: '/insights',
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-105',
        badge: 'Insights',
        module: 'insights',
      },
      {
        title: 'MCP Protocol Hub',
        description: 'Model Context Protocol (MCP) management. Swap brains and secure local LLMs.',
        icon: Radio,
        path: '/admin/mcp',
        color: 'text-rose-600',
        bgColor: 'bg-rose-50',
        borderColor: 'border-rose-105',
        badge: 'Protocol',
        module: 'legal',
      },
      {
        title: 'Contact Profile',
        description: 'Custom attributes for individuals. Ingested into AI reply context.',
        icon: Users,
        path: '/admin/contact-schema',
        color: 'text-sky-600',
        bgColor: 'bg-sky-50',
        borderColor: 'border-sky-105',
        badge: 'Insights',
        module: 'customers',
      },
    ],
  },
  {
    id: 'identity_access',
    title: 'Identity & Access',
    tab: 'system',
    sections: [
      {
        title: 'RBAC Command',
        description: 'Granular role architecture, module-level scoping, and user mapping.',
        icon: ShieldCheck,
        path: '/admin/roles',
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-105',
        badge: 'Governance',
        module: 'rbac',
      },
      {
        title: 'Workforce Hub',
        description: 'Agent directory, multi-step onboarding, and workforce lifecycle management.',
        icon: Briefcase,
        path: '/admin/workforce',
        color: 'text-violet-600',
        bgColor: 'bg-violet-50',
        borderColor: 'border-violet-105',
        badge: 'Management',
        module: 'workforce',
      },
      {
        title: 'Functional Teams',
        description: 'Manage agent groups, routing targets, and team schedules.',
        icon: Users,
        path: '/admin/groups',
        color: 'text-violet-500',
        bgColor: 'bg-violet-50',
        borderColor: 'border-violet-105',
        badge: 'Routing',
        module: 'groups',
      },
      {
        title: 'Vault-Portfoliomanagement',
        description: 'Create KeePass-style vault instances, assign users, and manage RBAC clearance tiers.',
        icon: Lock,
        path: '/admin/vault-portfolio',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-105',
        badge: 'GeistVault',
        module: 'vault',
      },
      {
        title: 'Companies Directory',
        description: 'Manage corporate organizational accounts, domains, SLA tiers, and credentials.',
        icon: Building2,
        path: '/customers',
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-105',
        badge: 'Structure',
        module: 'customers',
      },
    ],
  },
  {
    id: 'governance',
    title: 'Governance',
    tab: 'governance',
    sections: [
      {
        title: 'Sovereignty Center',
        description: 'Verify local data residency, encryption status, and network egress limits in real-time.',
        icon: ShieldCheck,
        path: '/admin/sovereignty',
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-105',
        badge: 'Sovereignty',
        module: 'legal',
      },
      {
        title: 'PII Shield',
        description: 'Manage data redaction, compliance guardrails, and security masks.',
        icon: Shield,
        path: '/admin/pii',
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-105',
        badge: 'Security',
        module: 'legal',
      },
      {
        title: 'Legal & Risk',
        description: 'Forbidden topics, AI disclosures, and automated compliance checks.',
        icon: ShieldAlert,
        path: '/admin/legal',
        color: 'text-amber-500',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-105',
        badge: 'Governance',
        module: 'legal',
      },
      {
        title: 'Reports & Auditing',
        description: 'Immutable protocol audit trails, legal intercepts, and compliance tracking.',
        icon: BarChart3,
        path: '/audit',
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-105',
        badge: 'Reports',
        module: 'rbac',
      },
      {
        title: 'Company Schema',
        description: 'Dynamic metadata fields for accounts. Managed by AI Schema Architect.',
        icon: Database,
        path: '/admin/schema',
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-105',
        badge: 'Structure',
        module: 'customers',
      },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    tab: 'integrations',
    sections: [
      {
        title: 'Communication',
        description: 'Email channels, SMTP/IMAP settings, and routing rules.',
        icon: Mail,
        path: '/email-channels',
        color: 'text-rose-500',
        bgColor: 'bg-rose-50',
        borderColor: 'border-rose-105',
        badge: 'Inbound',
        module: 'tickets',
      },
      {
        title: 'Notifications',
        description: 'System triggers, master templates, and automated alerts.',
        icon: Bell,
        path: '/admin/notifications',
        color: 'text-orange-500',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-105',
        badge: 'Automation',
        module: 'rbac',
      },
      {
        title: 'Integrations Hub',
        description: 'Personio, Slack, Webhooks, and external API connections.',
        icon: Webhook,
        path: '/admin/integrations',
        color: 'text-indigo-500',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-105',
        badge: 'Connectivity',
        module: 'rbac',
      },
      {
        title: 'Polyglot Bridge',
        description: 'Provision header flags, translation API keys, and custom phrase dictionaries.',
        icon: Globe,
        path: '/admin/polyglot',
        color: 'text-teal-600',
        bgColor: 'bg-teal-50',
        borderColor: 'border-teal-105',
        badge: 'Global',
        module: 'rbac',
      },
    ],
  },
  {
    id: 'platform',
    title: 'Platform',
    tab: 'system',
    sections: [
      {
        title: 'System Settings',
        description: 'Identity management, global feature flags, and debug tools.',
        icon: SettingsIcon,
        path: '/settings',
        color: 'text-slate-500',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-105',
        badge: 'Global',
        module: 'rbac',
      },
      {
        title: 'Data Import & Migration',
        description: 'Bulk CSV/JSON import for tickets and GeistKB, plus single-entry quick-add with RAG indexing.',
        icon: Database,
        path: '/admin/import',
        color: 'text-cyan-600',
        bgColor: 'bg-cyan-50',
        borderColor: 'border-cyan-105',
        badge: 'Migration',
        module: 'rbac',
      },
    ],
  },
];

export function categoriesForTab(tab: AdminHubTabId): AdminHubCategory[] {
  return ADMIN_HUB_CATEGORIES.filter((category) => category.tab === tab);
}
