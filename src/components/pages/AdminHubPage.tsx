import { useEffect, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs';
import { useTranslation } from '../../lib/context/I18nContext';
import { ADMIN_HUB_TABS, resolveAdminHubTab, type AdminHubTabId } from '../../components/admin/hub/adminHubConfig';
import { AdminHubOverviewTab } from '../../components/admin/hub/AdminHubOverviewTab';
import { AdminHubAiEngineTab } from '../../components/admin/hub/AdminHubAiEngineTab';
import { AdminHubRagTab } from '../../components/admin/hub/AdminHubRagTab';
import { AdminHubGovernanceTab } from '../../components/admin/hub/AdminHubGovernanceTab';
import { AdminHubIntegrationsTab } from '../../components/admin/hub/AdminHubIntegrationsTab';
import { AdminHubSystemTab } from '../../components/admin/hub/AdminHubSystemTab';
import type { AdminHubTelemetry } from '../../components/admin/hub/adminHubTelemetry';
import { cn } from '../../lib/utils';

const EMPTY_TELEMETRY: AdminHubTelemetry = {
  activeAgents: 0,
  ticketsProcessed: 0,
  assetsManaged: 0,
  vaultSecrets: 0,
  knowledgeArticles: 0,
  aiRequests: 0,
  systemHealth: 100,
  latencyMs: 0,
  activeVectors: 0,
  primaryModel: null,
  providers: [],
};

export default function AdminHubPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolveAdminHubTab(searchParams.get('tab'));
  const [telemetry, setTelemetry] = useState<AdminHubTelemetry>(EMPTY_TELEMETRY);

  useEffect(() => {
    const raw = searchParams.get('tab');
    if (raw === activeTab) return;
    const next = new URLSearchParams(searchParams);
    next.set('tab', activeTab);
    setSearchParams(next, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  const refreshTelemetry = () => {
    void axios
      .get('/api/admin/hub-stats')
      .then((res) => setTelemetry(res.data))
      .catch((err) => console.warn('Admin hub stats unavailable', err));
  };

  useEffect(() => {
    refreshTelemetry();
    const interval = setInterval(refreshTelemetry, 30000);
    return () => clearInterval(interval);
  }, []);

  const setTab = (next: string) => {
    const resolved = resolveAdminHubTab(next);
    const params = new URLSearchParams(searchParams);
    params.set('tab', resolved);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#fafafa]">
      <div className="shrink-0 px-6 lg:px-8 pt-6 lg:pt-8 pb-4 border-b border-slate-200/80 bg-[#fafafa]">
        <AdminBreadcrumbs />

        <div className="mt-2 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
              <LayoutGrid className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900 truncate">
                {t('nav.admin', 'Admin Hub')}
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">
                {t('admin.subtitle', 'Central control for GeistDesk AI, governance, and infrastructure.')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.02)] scale-95 origin-right shrink-0 self-start md:self-auto">
            <span className="relative flex h-2 w-2">
              <span
                className={cn(
                  'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                  telemetry.systemHealth >= 99
                    ? 'bg-emerald-400'
                    : telemetry.systemHealth >= 97
                      ? 'bg-amber-400'
                      : 'bg-red-400',
                )}
              />
              <span
                className={cn(
                  'relative inline-flex rounded-full h-2 w-2',
                  telemetry.systemHealth >= 99
                    ? 'bg-emerald-500'
                    : telemetry.systemHealth >= 97
                      ? 'bg-amber-500'
                      : 'bg-red-500',
                )}
              />
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 font-mono">
              {telemetry.systemHealth >= 99
                ? 'Control Plane : Active & Sovereign'
                : telemetry.systemHealth >= 97
                  ? 'Control Plane : Degraded'
                  : 'Control Plane : Offline'}
            </span>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setTab(String(value))}
        orientation="vertical"
        className="flex-1 min-h-0 w-full gap-0 overflow-hidden data-[orientation=vertical]:flex-row"
      >
        {/* Persistent left sidebar — always expanded; never collapses on navigation */}
        <aside
          className="shrink-0 w-56 sm:w-60 lg:w-64 border-r border-slate-200/80 bg-white/80 backdrop-blur-sm flex flex-col min-h-0 overflow-y-auto"
          aria-label={t('nav.admin', 'Admin Hub')}
        >
          <div className="px-3 pt-4 pb-2">
            <p className="px-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              {t('admin.hubNav', 'Sections')}
            </p>
          </div>
          <TabsList
            variant="line"
            className="h-auto w-full flex-col items-stretch justify-start gap-0.5 bg-transparent p-2 rounded-none"
          >
            {ADMIN_HUB_TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  'w-full flex-none shrink-0 justify-start text-left whitespace-normal',
                  'h-auto min-h-10 px-3 py-2.5 rounded-xl text-[12px] font-bold tracking-wide',
                  'text-slate-500 hover:text-slate-900 hover:bg-slate-50',
                  'data-active:bg-primary/10 data-active:text-primary data-active:shadow-none',
                  'after:hidden',
                )}
              >
                {t(tab.labelKey, tab.label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </aside>

        {/* Main content panel — scrolls independently; tables/forms keep full width */}
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="p-6 lg:p-8 pb-20 max-w-6xl">
            <TabsContent value={'uebersicht' satisfies AdminHubTabId} className="mt-0 outline-none">
              <AdminHubOverviewTab telemetry={telemetry} onTelemetryRefresh={refreshTelemetry} />
            </TabsContent>
            <TabsContent value={'ai-engine' satisfies AdminHubTabId} className="mt-0 outline-none">
              <AdminHubAiEngineTab telemetry={telemetry} />
            </TabsContent>
            <TabsContent value={'rag' satisfies AdminHubTabId} className="mt-0 outline-none">
              <AdminHubRagTab />
            </TabsContent>
            <TabsContent value={'governance' satisfies AdminHubTabId} className="mt-0 outline-none">
              <AdminHubGovernanceTab />
            </TabsContent>
            <TabsContent value={'integrations' satisfies AdminHubTabId} className="mt-0 outline-none">
              <AdminHubIntegrationsTab />
            </TabsContent>
            <TabsContent value={'system' satisfies AdminHubTabId} className="mt-0 outline-none">
              <AdminHubSystemTab telemetry={telemetry} onTelemetryRefresh={refreshTelemetry} />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
