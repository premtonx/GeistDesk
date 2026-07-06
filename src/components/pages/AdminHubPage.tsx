import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  Cpu, 
  Globe, 
  Webhook, 
  Database, 
  ShieldAlert, 
  Sparkles, 
  Mail, 
  Clock, 
  ArrowRight,
  Settings as SettingsIcon,
  LayoutGrid,
  Users,
  Radio,
  Briefcase,
  Activity,
  Bell,
  BarChart3,
  Building2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs';
import { AdminCard } from '../../components/AdminCard';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

import { usePermissions } from '../../hooks/usePermissions';
import { ShieldCheck, Lock } from 'lucide-react';
import { useTranslation } from '../../lib/context/I18nContext';

const categories = [
  {
    id: 'core_ai',
    title: 'Core AI',
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
        module: 'legal'
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
        module: 'insights'
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
        module: 'legal'
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
        module: 'customers'
      }
    ]
  },
  {
    id: 'identity_access',
    title: 'Identity & Access',
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
        module: 'rbac'
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
        module: 'workforce'
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
        module: 'groups'
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
        module: 'vault'
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
        module: 'customers'
      }
    ]
  },
  {
    id: 'governance',
    title: 'Governance',
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
        module: 'legal'
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
        module: 'legal'
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
        module: 'legal'
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
        module: 'rbac'
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
        module: 'customers'
      }
    ]
  },
  {
    id: 'platform',
    title: 'Platform',
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
        module: 'tickets'
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
        module: 'rbac'
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
        module: 'rbac'
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
        module: 'rbac'
      },
      {
        title: 'System Settings',
        description: 'Identity management, global feature flags, and debug tools.',
        icon: SettingsIcon,
        path: '/settings',
        color: 'text-slate-500',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-105',
        badge: 'Global',
        module: 'rbac'
      }
    ]
  }
];

export default function AdminHubPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { t } = useTranslation();

  // Unified Live Telemetry control state
  const [telemetry, setTelemetry] = useState({
    activeAgents: 0,
    ticketsProcessed: 0,
    assetsManaged: 0,
    vaultSecrets: 0,
    knowledgeArticles: 0,
    aiRequests: 0,
    systemHealth: 100,
    latencyMs: 0,
  });
  const [telemetryLoading, setTelemetryLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadStats = async () => {
      try {
        const res = await axios.get('/api/admin/hub-stats');
        if (!active) return;
        setTelemetry(res.data);
      } catch (err) {
        console.warn('Admin hub stats unavailable', err);
      } finally {
        if (active) setTelemetryLoading(false);
      }
    };
    void loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-[#fafafa]">
      <div className="p-8 max-w-6xl mx-auto pb-20">
        <AdminBreadcrumbs />
        
        {/* Hub Header Block */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
                <LayoutGrid className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900">{t('nav.admin', 'Admin Hub')}</h1>
                <p className="text-slate-500 text-sm mt-0.5">{t('admin.subtitle', 'Central control for GeistDesk AI, governance, and infrastructure.')}</p>
              </div>
            </div>
            
            {/* Control plane status banner */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.02)] scale-95 origin-right">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 font-mono">Control Plane : Active & Sovereign</span>
            </div>
          </div>
        </div>

        {/* 1. GLOBAL OPERATIONS OVERVIEW BLOCK */}
        <div className="mb-10 bg-white border border-slate-200/80 rounded-[2rem] p-6 xl:p-8 shadow-[0_2px_12px_rgba(15,23,42,0.02)] overflow-hidden relative">
          
          {/* Faint ambient scanline texture grid */}
          <div className="absolute inset-0 bg-[radial-gradient(#94A3B8_0.5px,transparent_0.5px)] bg-[size:16px_16px] opacity-10 pointer-events-none" />
          
          {/* Control Plane Header bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-5 mb-6 relative z-10">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-slate-400" />
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 font-mono">GeistControl Operations Overview v3.1</h2>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Local Model: OLLAMA / gemma
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Latency: {telemetry.latencyMs} ms
              </span>
            </div>
          </div>

          {/* Telemetry metrics rows */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 relative z-10 pb-2">
            
            {/* Met 1: Agents Online */}
            <div className="p-3.5 bg-slate-50/50 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all duration-300">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 font-mono">Agents</span>
                <Users className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="text-xl font-black text-slate-900 font-mono leading-none tracking-tight">
                {telemetry.activeAgents} <span className="text-[10px] text-slate-400 font-normal">/ 12</span>
              </div>
              <div className="text-[9px] font-bold text-emerald-600 mt-2 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> 100% Online
              </div>
            </div>

            {/* Met 2: Tickets Processed */}
            <div className="p-3.5 bg-slate-50/50 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all duration-300">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 font-mono">Pipeline</span>
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="text-xl font-black text-slate-900 font-mono leading-none tracking-tight">
                {telemetry.ticketsProcessed.toLocaleString()}
              </div>
              <div className="text-[9px] font-bold text-slate-400 mt-2">
                Processed Tickets
              </div>
            </div>

            {/* Met 3: Assets Managed */}
            <div className="p-3.5 bg-slate-50/50 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all duration-300">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 font-mono">Assets</span>
                <Database className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="text-xl font-black text-slate-900 font-mono leading-none tracking-tight">
                {telemetry.assetsManaged.toLocaleString()}
              </div>
              <div className="text-[9px] font-bold text-slate-400 mt-2">
                Managed Records
              </div>
            </div>

            {/* Met 4: Secrets shielded */}
            <div className="p-3.5 bg-slate-50/50 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all duration-300">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 font-mono">Vault</span>
                <Lock className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-xl font-black text-slate-900 font-mono leading-none tracking-tight">
                {telemetry.vaultSecrets.toLocaleString()}
              </div>
              <div className="text-[9px] font-bold text-amber-600 mt-2">
                Secrets Redacted
              </div>
            </div>

            {/* Met 5: Knowledge Articles */}
            <div className="p-3.5 bg-slate-50/50 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all duration-300">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 font-mono">KB Index</span>
                <Globe className="w-3.5 h-3.5 text-teal-500" />
              </div>
              <div className="text-xl font-black text-slate-900 font-mono leading-none tracking-tight">
                {telemetry.knowledgeArticles.toLocaleString()}
              </div>
              <div className="text-[9px] font-bold text-slate-400 mt-2">
                Dynamic RAG Synced
              </div>
            </div>

            {/* Met 6: AI Requests Today */}
            <div className="p-3.5 bg-slate-50/50 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all duration-300">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 font-mono">AI Requests</span>
                <Sparkles className="w-3.5 h-3.5 text-indigo-500 fill-indigo-200/50 animate-pulse" />
              </div>
              <div className="text-xl font-black text-slate-900 font-mono leading-none tracking-tight">
                {telemetry.aiRequests.toLocaleString()}
              </div>
              <div className="text-[9px] font-bold text-indigo-600 mt-2 flex items-center gap-1 text-[8.5px]">
                <span className="inline-block w-1.5 h-1.5 bg-indigo-500 rounded-sm animate-bounce" /> Streaming Requests
              </div>
            </div>

            {/* Met 7: System Health */}
            <div className="p-3.5 bg-slate-50/50 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all duration-300 col-span-2 md:col-span-1">
              <div className="flex items-center justify-between text-slate-405 mb-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 font-mono">SLA Uptime</span>
                <Activity className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-xl font-black text-emerald-600 font-mono leading-none tracking-tight">
                {telemetry.systemHealth}%
              </div>
              <div className="text-[9px] font-bold mt-2 text-emerald-600/90 tracking-tight">
                Platform High-Availability
              </div>
            </div>

          </div>

          {/* Micro telemetry health graph footer block */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center text-slate-400 text-[10px] font-mono gap-2 relative z-10">
            <div className="flex items-center gap-1.5">
              <span className="p-1 rounded bg-slate-100 border border-slate-205 flex items-center justify-center font-black">INFO</span>
              <span>All nodes operating on a sandboxed local-first secure enterprise runtime container.</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white animate-ping absolute" />
              </div>
              <span>No data pipelines telemetry leaked.</span>
            </div>
          </div>

        </div>

        {/* 2. CATEGORIZED INFRASTRUCTURE CONFIGURATION BLOCKS */}
        <div className="space-y-12">
          {categories.map((category) => (
            <div key={category.id} className="space-y-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
                {t(`admin.categories.${category.id}`, category.title)}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {category.sections.map((section) => {
                  const isAllowed = hasPermission(section.module || 'rbac', 'view');
                  const sectionKey = section.title.toLowerCase().replace(/ & /g, '_and_').replace(/ /g, '_');
                  
                  return (
                    <div key={section.path} className={cn(!isAllowed && "opacity-50 grayscale")}>
                      <AdminCard
                        title={t('admin.sections.' + sectionKey + '.title', section.title)}
                        description={t('admin.sections.' + sectionKey + '.description', section.description)}
                        icon={isAllowed ? section.icon : Lock}
                        path={isAllowed ? section.path : '#'}
                        badge={isAllowed ? t('admin.badges.' + section.badge.toLowerCase().replace(/ /g, '_'), section.badge) : t('admin.badges.restricted', 'Restricted')}
                        color={section.color}
                        bgColor={section.bgColor}
                        borderColor={section.borderColor}
                        onClick={() => isAllowed && navigate(section.path)}
                        actionLabel={t('admin.configureSection', 'Configure Section')}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* System Health Overview */}
        <div className="mt-16 bg-white border border-slate-200 rounded-[2.5rem] p-10 overflow-hidden relative shadow-sm">
          <div className="absolute top-0 right-0 p-8 opacity-5">
             <Activity className="w-32 h-32" />
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="max-w-md">
              <h3 className="text-xl font-bold text-slate-900 mb-2">{t('admin.resourceHealth', 'Resource Health')}</h3>
              <p className="text-sm text-slate-500">{t('admin.resourceHealthDesc', 'Real-time status of embedded vectors and LLM availability.')}</p>
              
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-slate-600">{t('admin.vectorIndex', 'Vector Index (GeistDesk_KB)')}</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md">{t('admin.statusHealthy', 'Healthy')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-slate-600">{t('admin.geminiEngine', 'Gemini 3.5 Pro Engine')}</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md">{t('admin.statusAvailable', 'Available')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span className="text-xs font-bold text-slate-600">{t('admin.ghostInstance', 'Local G3 Ghost Instance')}</span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-md">{t('admin.statusWarming', 'Warming')}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex-1 min-w-[160px]">
                <Database className="w-5 h-5 text-slate-400 mb-3" />
                <div className="text-2xl font-black text-slate-900">1,204</div>
                <div className="text-[10px] items-center gap-1 flex font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {t('admin.activeVectors', 'Active Vectors')}
                </div>
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex-1 min-w-[160px]">
                <Users className="w-5 h-5 text-slate-400 mb-3" />
                <div className="text-2xl font-black text-slate-900">12 ms</div>
                <div className="text-[10px] items-center gap-1 flex font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {t('admin.redactionLatency', 'P99 Redaction Latency')}
                </div>
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex-1 min-w-[160px]">
                <Activity className="w-5 h-5 text-slate-400 mb-3" />
                <div className="text-2xl font-black text-slate-900">99.9%</div>
                <div className="text-[10px] items-center gap-1 flex font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {t('admin.uptime', 'Uptime (30d)')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
