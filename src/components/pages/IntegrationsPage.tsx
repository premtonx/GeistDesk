import React, { useState } from 'react';
import { Webhook, Database, Link2, Puzzle, ArrowUpRight, Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs';
import { useWorkspaceModuleConfig } from '../../hooks/useWorkspaceModuleConfig';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../../lib/hooks';
import { useTranslation } from '../../lib/context/I18nContext';

export default function IntegrationsPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { config, setConfig, persist } = useWorkspaceModuleConfig({ admin: true });
  const [isTesting, setIsTesting] = useState(false);

  const handleSave = async () => {
    const saved = await persist(config);
    if (saved) {
      toast.success(t('integrations.persisted', 'Integration settings persisted.'));
    }
  };

  const testPersonio = () => {
    setIsTesting(true);
    toast.promise(
      axios.post('/api/personio/test-connection', { 
        employeeId: config.personioEmployeeId || user?.email 
      }),
      {
        loading: t('integrations.handshaking', 'Handshaking with Personio...'),
        success: (res) => {
          setIsTesting(false);
          return `${t('integrations.secureLinkEstablished', 'Secure Link Established')}: ${res.data.employeeName}`;
        },
        error: (err) => {
          setIsTesting(false);
          return t('integrations.linkRefused', 'Link Refused: Check OAuth Credentials');
        }
      }
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#fafafa]">
      <div className="p-8 max-w-4xl mx-auto pb-20">
        <AdminBreadcrumbs />

        <div className="flex items-center justify-between mb-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Webhook className="w-6 h-6 text-indigo-500" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('integrations.title', 'Integrations Hub')}</h1>
            </div>
            <p className="text-slate-500">{t('integrations.subtitle', 'Connect GeistDesk to your external workforce and data tools.')}</p>
          </div>
          <Button onClick={handleSave} className="rounded-2xl font-bold shadow-lg shadow-primary/20 px-8">
            {t('integrations.persistConfig', 'Persist Config')}
          </Button>
        </div>

        <div className="space-y-8">
          {/* Personio Section */}
          <Card className="rounded-[2rem] border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-indigo-50/20 border-b border-indigo-50 px-8 py-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-indigo-100 flex items-center justify-center text-indigo-500 shadow-sm">
                    <Puzzle className="w-7 h-7" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900">{t('integrations.personioTitle', 'Personio Attendance')}</CardTitle>
                    <CardDescription>{t('integrations.personioDesc', 'Automate agent clock-in/out via Personnel Management API.')}</CardDescription>
                  </div>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold uppercase text-[9px] tracking-widest px-3">{t('integrations.activeLink', 'Active Link')}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('integrations.personioClientId', 'Personio Client ID')}</Label>
                   <Input 
                      value={config.personioClientId} 
                      onChange={(e) => setConfig({...config, personioClientId: e.target.value})}
                      placeholder="Enter Client ID" 
                      className="rounded-xl border-slate-200 h-12 focus:ring-indigo-500"
                   />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('integrations.clientSecret', 'Client Secret')}</Label>
                   <Input 
                      type="password"
                      value={config.personioClientSecret} 
                      onChange={(e) => setConfig({...config, personioClientSecret: e.target.value})}
                      placeholder="••••••••••••" 
                      className="rounded-xl border-slate-200 h-12"
                   />
                </div>
              </div>

              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 border-dashed">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                   <div className="flex-1 space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('integrations.handshakeMapping', 'Handshake Mapping')}</Label>
                    <Input 
                        value={config.personioEmployeeId || user?.email || ''} 
                        onChange={(e) => setConfig({...config, personioEmployeeId: e.target.value})}
                        placeholder="employee@company.com" 
                        className="rounded-xl border-slate-200 bg-white h-12"
                    />
                    <p className="text-[10px] text-slate-400 font-medium italic ml-1">{t('integrations.mappingDesc', 'Identifies the specific employee record to update.')}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={testPersonio}
                    disabled={isTesting}
                    className="rounded-2xl border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50 font-bold h-12 px-8 shrink-0"
                  >
                    {isTesting ? <Activity className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
                    {t('integrations.testHandshake', 'Test Handshake')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Incoming: Slack/Discord/Webhooks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Webhooks (Free Tier) */}
             <Card className="rounded-3xl border-slate-200 shadow-sm bg-slate-50/30">
                <CardHeader>
                   <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 mb-2">
                      <Webhook className="w-5 h-5" />
                   </div>
                   <CardTitle className="text-lg font-bold">{t('integrations.customWebhooks', 'Custom Webhooks')}</CardTitle>
                   <CardDescription>{t('integrations.customWebhooksDesc', 'Forward clean event payloads to internal endpoints.')}</CardDescription>
                </CardHeader>
                <CardContent>
                   <Button variant="outline" className="rounded-xl border-slate-200 font-bold text-xs">
                      {t('integrations.configureEndpoints', 'Configure Endpoints')}
                   </Button>
                </CardContent>
             </Card>

             {/* Enterprise Upsell */}
             <Card className="rounded-3xl border-black bg-black text-white shadow-xl shadow-slate-200 p-8 flex flex-col justify-between">
                <div>
                   <Badge className="bg-blue-600 text-white border-none font-black text-[9px] uppercase tracking-widest px-3 mb-4">{t('integrations.enterpriseTier', 'Enterprise Tier')}</Badge>
                   <h3 className="text-xl font-bold tracking-tight">{t('integrations.enterpriseConnectors', 'Enterprise Connectors')}</h3>
                   <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                      {t('integrations.enterpriseConnectorsDesc', 'Unlock deep bi-directional synchronization with your enterprise stack.')}
                   </p>
                </div>
                <div className="mt-8 space-y-4">
                   <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 opacity-50 grayscale">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                            <Activity className="w-4 h-4 text-white" />
                         </div>
                         <span className="text-xs font-bold font-mono">SALESFORCE_PRO</span>
                      </div>
                      <Badge variant="outline" className="text-white border-white/20 text-[8px] font-black uppercase tracking-widest">{t('integrations.locked', 'Locked')}</Badge>
                   </div>
                   <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 opacity-50 grayscale">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
                            <CheckCircle2 className="w-4 h-4" />
                         </div>
                         <span className="text-xs font-bold font-mono">OKTA_SSO_SYNC</span>
                      </div>
                      <Badge variant="outline" className="text-white border-white/20 text-[8px] font-black uppercase tracking-widest">{t('integrations.locked', 'Locked')}</Badge>
                   </div>
                   <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 opacity-50 grayscale">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
                            <Link2 className="w-4 h-4" />
                         </div>
                         <span className="text-xs font-bold font-mono">SLACK_ENT_HQ</span>
                      </div>
                      <Badge variant="outline" className="text-white border-white/20 text-[8px] font-black uppercase tracking-widest">{t('integrations.locked', 'Locked')}</Badge>
                   </div>
                   <Button className="w-full bg-white text-black font-black uppercase text-[11px] tracking-widest rounded-xl h-12 mt-4 hover:bg-slate-200">
                      {t('integrations.contactSales', 'Contact Sales / Upgrade')}
                   </Button>
                </div>
             </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
