import React from 'react';
import { 
  Sparkles, 
  Activity, 
  Laptop, 
  Key, 
  Clock, 
  ChevronRight, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle,
  Server,
  Network,
  AppWindow,
  Cpu,
  ShieldCheck,
  Mail,
  ExternalLink,
  Unlock
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Avatar, AvatarFallback } from '../../ui/avatar';
import { HydratedCompany } from './utils';
import { Ticket } from '../../../types';
import { useTranslation } from '../../../lib/context/I18nContext';

interface CompanyOverviewProps {
  company: HydratedCompany;
  ticketHistory: Ticket[];
  onTabChange: (tab: string) => void;
  onOpenVaultClick: () => void;
  onViewAllTicketsClick: () => void;
}

export default function CompanyOverviewTab({
  company,
  ticketHistory,
  onTabChange,
  onOpenVaultClick,
  onViewAllTicketsClick
}: CompanyOverviewProps) {
  const { t } = useTranslation();
  
  // Format dates elegantly
  const formatTicketTime = (ticket: Ticket) => {
    if (!ticket.createdAt) return 'Recently';
    if (ticket.createdAt.toDate) {
      const d = ticket.createdAt.toDate();
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (diffDays === 1) return t('companies.yesterday', 'Yesterday');
      return t('vault.expiresInDays', 'Expires in {{count}} Days').replace('{{count}}', String(diffDays)).replace('Expires in', '').replace('Days', 'days ago');
    }
    return 'N/A';
  };

  // Safe mock or real tickets list
  const displayTickets = React.useMemo(() => {
    if (ticketHistory.length > 0) {
      return ticketHistory.slice(0, 5);
    }
    // Static high fidelity mockup values matching screenshot if none exist
    return [
      { id: '443', subject: 'Login not working', priority: 'high', status: 'open', customerName: 'Sarah James', createdAtText: '10:24 AM' },
      { id: '441', subject: 'VPN connection failure', priority: 'medium', status: 'pending', customerName: 'Mike Chen', createdAtText: t('companies.yesterday', 'Yesterday') },
      { id: '438', subject: 'Password reset delay', priority: 'low', status: 'resolved', customerName: 'Will Coyote', createdAtText: `2 ${t('companies.daysAgo', 'days ago')}` },
      { id: '436', subject: 'Email sync issue', priority: 'medium', status: 'open', customerName: 'Anna Bell', createdAtText: `3 ${t('companies.daysAgo', 'days ago')}` },
      { id: '432', subject: 'MFA not receiving code', priority: 'high', status: 'open', customerName: 'John Doe', createdAtText: `3 ${t('companies.daysAgo', 'days ago')}` }
    ];
  }, [ticketHistory, t]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* COLUMN 1: Customer Health + AI Insights */}
      <div className="space-y-6 lg:col-span-1">
        
        {/* Customer Health Card */}
        <Card className="border border-muted-foreground/10 shadow-xs rounded-2xl bg-background">
          <CardHeader className="pb-2">
            <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">
              {t('companies.customerHealth', 'Customer Health')}
            </h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-foreground tracking-tight">
                {company.healthScore}
              </span>
              <span className="text-muted-foreground/50 text-base font-bold">/ 100</span>
              <Badge className={`ml-2 h-5 rounded-md text-[9px] font-extrabold uppercase px-2 py-0 border-none ${
                company.healthScore >= 80 ? 'bg-emerald-500/10 text-emerald-500' :
                company.healthScore >= 50 ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'
              }`}>
                {company.healthScore >= 80 ? t('companies.healthy', 'Healthy') : t('companies.unhealthy', 'Attention Needed')}
              </Badge>
            </div>
            
            <p className="text-xs text-muted-foreground font-semibold leading-relaxed">
              {company.healthScore >= 80 
                ? t('companies.healthDescHealthy', 'Great! Your account is in good standing with positive metrics.') 
                : t('companies.healthDescUnhealthy', 'Attention required! High volume SLA expirations or pending escalations.')}
            </p>

            {/* Health Bar */}
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  company.healthScore >= 80 ? 'bg-emerald-500' :
                  company.healthScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${company.healthScore}%` }}
              />
            </div>

            {/* Minor Health Grid */}
            <div className="grid grid-cols-4 gap-2 pt-3 border-t border-muted text-center">
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{t('companies.sentiment', 'Sentiment')}</p>
                <p className="text-xs text-emerald-500 font-extrabold mt-1">Positive ↑</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{t('companies.slaPerf', 'SLA Perf')}</p>
                <p className="text-xs text-emerald-500 font-extrabold mt-1">{company.slaPerformance} ↑</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{t('companies.open', 'Open')}</p>
                <p className="text-xs text-foreground font-extrabold mt-1">{company.openTicketsCount}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{t('companies.escalations', 'Escalations')}</p>
                <p className="text-xs text-rose-500 font-extrabold mt-1">{company.slaRisksCount}</p>
              </div>
            </div>

            <Button 
              onClick={() => onTabChange('insights')}
              variant="outline" 
              size="sm" 
              className="w-full h-8 rounded-xl border-muted text-muted-foreground hover:text-foreground text-[10px] font-bold"
            >
              {t('companies.viewHealthReport', 'View full health report')}
            </Button>
          </CardContent>
        </Card>

        {/* AI Insights Card */}
        <Card className="border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.03] via-transparent to-transparent shadow-xs rounded-2xl">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <h3 className="text-xs font-extrabold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
              {t('companies.aiInsights', 'AI Insights')}
            </h3>
            <Badge className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 h-4 border-none font-bold text-[7px] text-white tracking-widest uppercase rounded">
              {t('companies.poweredByAi', 'POWERED BY AI')}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4 text-xs font-semibold">
            {/* Rows of AI insights matching layout */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between py-1 border-b border-muted">
                <span className="text-muted-foreground flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-indigo-500/80" /> {t('companies.topIssueCategory', 'Top Issue Category')}</span>
                <span className="text-foreground font-extrabold text-right">Authentication</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-muted">
                <span className="text-muted-foreground flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-indigo-500/80" /> {t('companies.predictedChurnRisk', 'Predicted Churn Risk')}</span>
                <div className="text-right">
                  <Badge variant="secondary" className="bg-emerald-400/10 hover:bg-emerald-400/10 text-emerald-500 border-none px-2 h-4.5 rounded font-black text-[9px] uppercase">
                    {t('vault.low', 'Low')}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-muted">
                <span className="text-muted-foreground flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-indigo-500/80" /> {t('companies.similarCompanyIssues', 'Similar Company Issues')}</span>
                <span className="text-foreground font-extrabold text-right truncate max-w-[140px]">{t('dashboard.passwordResetDelays', 'Password Reset Delays')}</span>
              </div>
              <div className="flex items-start justify-between py-1">
                <span className="text-muted-foreground flex items-center gap-1.5 shrink-0"><Sparkles className="w-3 h-3 text-indigo-500/80" /> {t('companies.recommendedActions', 'Recommended Actions')}</span>
                <span className="text-indigo-600 font-extrabold text-right max-w-[150px]">{t('companies.recActionsDesc', '3 automation opportunities - save ~4h/week')}</span>
              </div>
            </div>

            <Button 
              onClick={() => onTabChange('insights')}
              variant="outline" 
              size="sm" 
              className="w-full h-8 rounded-xl border-indigo-200 hover:border-indigo-350 bg-indigo-500/[0.02] hover:bg-indigo-500/[0.05] text-indigo-600 text-[10px] font-bold"
            >
              {t('companies.viewAllInsights', 'View all insights')}
            </Button>
          </CardContent>
        </Card>

      </div>

      {/* COLUMN 2 & 3: Recent Tickets + Assets Summary + Vault & Activities */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Recent Tickets Card */}
        <Card className="border border-muted-foreground/10 shadow-xs rounded-2xl bg-background">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-black text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              {t('companies.recentTickets', 'Recent Tickets')}
            </CardTitle>
            <button 
              onClick={onViewAllTicketsClick}
              className="text-xs font-bold text-primary hover:underline"
            >
              {t('companies.viewAllTickets', 'View all tickets')}
            </button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-muted">
              {displayTickets.map((tItem, idx) => (
                <div key={idx} className="flex items-center justify-between px-5 py-3 hover:bg-muted/10 transition-colors select-none text-xs font-semibold">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-muted-foreground font-mono w-10">#{tItem.id}</span>
                    <span className="text-foreground font-black truncate max-w-[200px] md:max-w-xs">{tItem.subject}</span>
                    <Badge className={`text-[8px] font-black uppercase px-2 h-4.5 border-none rounded ${
                      tItem.priority === 'urgent' || tItem.priority === 'high' ? 'bg-rose-500/10 text-rose-500' :
                      tItem.priority === 'medium' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {tItem.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-6 text-muted-foreground">
                    <Badge variant="outline" className={`h-4.5 text-[8px] font-black uppercase border-none px-2 rounded ${
                      tItem.status === 'open' ? 'bg-emerald-500/10 text-emerald-500' :
                      tItem.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-150 text-slate-500'
                    }`}>
                      {tItem.status}
                    </Badge>
                    <span className="hidden md:inline text-right min-w-[100px] font-bold truncate">{tItem.customerName}</span>
                    <span className="text-right w-16 text-[10px]">{tItem.createdAtText || formatTicketTime(tItem as any)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Assets & GeistVault Summaries row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Asset Overview Card */}
          <Card className="border border-muted-foreground/10 shadow-xs rounded-2xl bg-background">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-black text-foreground flex items-center gap-2">
                <Laptop className="w-4 h-4 text-emerald-500" />
                {t('companies.assetOverview', 'Asset Overview')}
              </CardTitle>
              <button 
                onClick={() => onTabChange('assets')}
                className="text-xs font-bold text-primary hover:underline"
              >
                {t('companies.viewAllAssets', 'View all assets')}
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Asset grid */}
              <div className="grid grid-cols-2 gap-3 pb-2">
                <div className="p-3 bg-muted/20 border border-muted rounded-xl text-center flex flex-col items-center">
                  <Server className="w-5 h-5 text-indigo-500" />
                  <span className="text-lg font-black mt-2 text-foreground">
                    {company.name.includes('CyberDyne') ? 120 : 42}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">{t('companies.servers', 'Servers')}</span>
                  <span className="text-[8px] text-emerald-500 font-semibold mt-1">↑ 3 new</span>
                </div>
                <div className="p-3 bg-muted/20 border border-muted rounded-xl text-center flex flex-col items-center">
                  <Cpu className="w-5 h-5 text-emerald-500" />
                  <span className="text-lg font-black mt-2 text-foreground">
                    {company.name.includes('CyberDyne') ? 98 : 128}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">{t('companies.workstations', 'Workstations')}</span>
                  <span className="text-[8px] text-emerald-500 font-semibold mt-1">↑ 5 new</span>
                </div>
                <div className="p-3 bg-muted/20 border border-muted rounded-xl text-center flex flex-col items-center">
                  <Network className="w-5 h-5 text-amber-500" />
                  <span className="text-lg font-black mt-2 text-foreground">18</span>
                  <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">{t('companies.networkDevices', 'Network Devices')}</span>
                  <span className="text-[8px] text-emerald-500 font-semibold mt-1">↑ 1 new</span>
                </div>
                <div className="p-3 bg-muted/20 border border-muted rounded-xl text-center flex flex-col items-center">
                  <AppWindow className="w-5 h-5 text-purple-500" />
                  <span className="text-lg font-black mt-2 text-foreground">32</span>
                  <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">{t('companies.applications', 'Applications')}</span>
                  <span className="text-[8px] text-slate-400 font-semibold mt-1">{t('companies.noChange', 'No change')}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-bold uppercase pt-1 border-t border-muted">
                <span>{t('companies.discoveryEngine', 'Discovery Engine')}</span>
                <span className="text-emerald-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {t('companies.lastDiscovery', 'Last discovery: 2 hours ago')}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* GeistVault Summary Card */}
          <Card className="border border-muted-foreground/10 shadow-xs rounded-2xl bg-background">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-black text-foreground flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-500" />
                {t('companies.geistVaultSummary', 'GeistVault Summary')}
              </CardTitle>
              <button 
                onClick={onOpenVaultClick}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5"
              >
                <Unlock className="w-3 h-3 text-primary" />
                {t('companies.openVault', 'Open vault')}
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* List counts */}
              <div className="space-y-2.5 text-xs font-semibold">
                <div className="flex items-center justify-between py-1 border-b border-muted">
                  <span className="text-muted-foreground">{t('companies.credentials', 'Credentials')}</span>
                  <span className="text-foreground font-bold">{company.vaultEntriesCount}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-muted">
                  <span className="text-muted-foreground">{t('companies.apiKeys', 'API Keys')}</span>
                  <span className="text-foreground font-bold">6</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-muted">
                  <span className="text-muted-foreground">{t('companies.certificates', 'Certificates')}</span>
                  <span className="text-foreground font-bold">9</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">{t('companies.sharedEntries', 'Shared Entries')}</span>
                  <span className="text-foreground font-bold">12</span>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-amber-500/10 text-amber-700 px-3.5 py-2.5 rounded-xl text-xs font-bold leading-none border border-amber-500/25">
                <AlertTriangle className="w-4 h-4 text-amber-500 animate-bounce shrink-0" />
                <span>{t('companies.expiringSoonWithCount', '3 entries expiring soon (needs action)').replace('{{count}}', '3')}</span>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Activity Timeline Card */}
        <Card className="border border-muted-foreground/10 shadow-xs rounded-2xl bg-background">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-black text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-500" />
              {t('companies.activityTimeline', 'Activity Timeline')}
            </CardTitle>
            <button 
              onClick={() => onTabChange('activity')}
              className="text-xs font-bold text-primary hover:underline"
            >
              {t('companies.viewAllActivity', 'View all activity')}
            </button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative pl-5 border-l-2 border-muted space-y-4">
              {/* Event 1 */}
              <div className="relative">
                <div className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full bg-primary border-4 border-background" />
                <div className="flex items-center gap-3">
                  <span className="text-[10px] bg-muted/65 px-2 py-0.5 rounded font-black uppercase text-muted-foreground tracking-wider">{t('companies.today', 'Today')}</span>
                  <span className="text-[10px] text-muted-foreground font-bold">10:24 AM</span>
                </div>
                <p className="text-xs font-bold text-foreground mt-1">
                  Ticket #443 created by Sarah James
                </p>
              </div>

              {/* Event 2 */}
              <div className="relative">
                <div className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full bg-amber-500 border-4 border-background" />
                <div className="flex items-center gap-3">
                  <span className="text-[10px] bg-muted/65 px-2 py-0.5 rounded font-black uppercase text-muted-foreground tracking-wider">{t('companies.yesterday', 'Yesterday')}</span>
                  <span className="text-[10px] text-muted-foreground font-bold">04:15 PM</span>
                </div>
                <p className="text-xs font-bold text-foreground mt-1">
                  GeistVault entry updated: primary credentials for domain
                </p>
              </div>

              {/* Event 3 */}
              <div className="relative">
                <div className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border-4 border-background" />
                <div className="flex items-center gap-3">
                  <span className="text-[10px] bg-muted/65 px-2 py-0.5 rounded font-black uppercase text-muted-foreground tracking-wider">May 19</span>
                  <span className="text-[10px] text-muted-foreground font-bold">11:30 AM</span>
                </div>
                <p className="text-xs font-bold text-foreground mt-1">
                  Contract renewed for 12 months (Plan: {company.contractPlan})
                </p>
              </div>

              {/* Event 4 */}
              <div className="relative">
                <div className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full bg-indigo-500 border-4 border-background" />
                <div className="flex items-center gap-3">
                  <span className="text-[10px] bg-muted/65 px-2 py-0.5 rounded font-black uppercase text-muted-foreground tracking-wider">May 16</span>
                  <span className="text-[10px] text-muted-foreground font-bold">09:20 AM</span>
                </div>
                <p className="text-xs font-bold text-foreground mt-1">
                  New asset group "Production Servers" auto-added via discovery scan
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

    </div>
  );
}
