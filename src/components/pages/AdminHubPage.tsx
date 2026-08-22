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
import { AdminHubGovernanceTab } from '../../components/admin/hub/AdminHubGovernanceTab';
import { AdminHubIntegrationsTab } from '../../components/admin/hub/AdminHubIntegrationsTab';
import { AdminHubSystemTab } from '../../components/admin/hub/AdminHubSystemTab';
import type { AdminHubTelemetry } from '../../components/admin/hub/adminHubTelemetry';

const EMPTY_TELEMETRY: AdminHubTelemetry = {
  activeAgents: 0,
  ticketsProcessed: 0,
  assetsManaged: 0,
  vaultSecrets: 0,
  knowledgeArticles: 0,
  aiRequests: 0,
  systemHealth: 100,
  latencyMs: 0,
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

  useEffect(() => {
    let alive = true;
    const loadStats = async () => {
      try {
        const res = await axios.get('/api/admin/hub-stats');
        if (alive) setTelemetry(res.data);
      } catch (err) {
        console.warn('Admin hub stats unavailable', err);
      }
    };
    void loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const setTab = (next: string) => {
    const resolved = resolveAdminHubTab(next);
    const params = new URLSearchParams(searchParams);
    params.set('tab', resolved);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#fafafa]">
      <div className="p-8 max-w-6xl mx-auto pb-20">
        <AdminBreadcrumbs />

        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
                <LayoutGrid className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900">{t('nav.admin', 'Admin Hub')}</h1>
                <p className="text-slate-500 text-sm mt-0.5">
                  {t('admin.subtitle', 'Central control for GeistDesk AI, governance, and infrastructure.')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.02)] scale-95 origin-right">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 font-mono">
                Control Plane : Active & Sovereign
              </span>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setTab(String(value))} className="w-full gap-6">
          <div className="sticky top-0 z-20 -mx-2 px-2 bg-[#fafafa]/95 backdrop-blur-sm border-b border-slate-200/80 overflow-x-auto overscroll-x-contain scroll-smooth no-scrollbar">
            <TabsList
              variant="line"
              className="h-11 w-max min-w-full justify-start gap-1 flex-nowrap bg-transparent p-0"
            >
              {ADMIN_HUB_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex-none shrink-0 px-3 h-10 text-[12px] font-bold uppercase tracking-wide rounded-none after:bottom-0"
                >
                  {t(tab.labelKey, tab.label)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value={'uebersicht' satisfies AdminHubTabId} className="mt-6 outline-none">
            <AdminHubOverviewTab telemetry={telemetry} />
          </TabsContent>
          <TabsContent value={'ai-engine' satisfies AdminHubTabId} className="mt-6 outline-none">
            <AdminHubAiEngineTab telemetry={telemetry} />
          </TabsContent>
          <TabsContent value={'governance' satisfies AdminHubTabId} className="mt-6 outline-none">
            <AdminHubGovernanceTab />
          </TabsContent>
          <TabsContent value={'integrations' satisfies AdminHubTabId} className="mt-6 outline-none">
            <AdminHubIntegrationsTab />
          </TabsContent>
          <TabsContent value={'system' satisfies AdminHubTabId} className="mt-6 outline-none">
            <AdminHubSystemTab telemetry={telemetry} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
