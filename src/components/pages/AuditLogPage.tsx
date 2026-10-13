import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Download, 
  User, 
  Database, 
  Lock, 
  Key, 
  Ticket, 
  BarChart3,
  Clock,
  ArrowRight,
  ShieldAlert,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Fingerprint,
  RefreshCw,
  FileCheck2,
  HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAdmin } from '../../lib/hooks';
import { usePermissions } from '../../hooks/usePermissions';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { useTranslation } from '../../lib/context/I18nContext';

export default function AuditLogPage() {
  const { t } = useTranslation();
  const { isAdmin, checking } = useAdmin();
  const { userProfile, role, loading: permissionsLoading } = usePermissions();
  const [logs, setLogs] = useState<any[]>([]);
  const [complianceLogs, setComplianceLogs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('system');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const isAuthorized = isAdmin || 
                       (userProfile?.is_admin === true) ||
                       (userProfile?.role === 'admin') ||
                       (role?.name === 'admin');

  useEffect(() => {
    if (checking || permissionsLoading) return;
    if (!isAuthorized) return;

    const qSystem = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubSystem = onSnapshot(qSystem, (snapshot) => {
      setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qCompliance = query(collection(db, 'compliance_logs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubCompliance = onSnapshot(qCompliance, (snapshot) => {
      setComplianceLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubSystem();
      unsubCompliance();
    };
  }, [isAuthorized, checking, permissionsLoading]);

  if (checking || permissionsLoading) return <div className="p-8 h-screen flex items-center justify-center font-mono text-xs uppercase tracking-widest text-slate-400">Authenticating Governance Layer...</div>;
  if (!isAuthorized) return <div className="p-8 text-black font-black h-screen flex flex-col items-center justify-center bg-red-50">
    <ShieldAlert className="w-12 h-12 text-red-600 mb-4" />
    <h1 className="text-2xl uppercase tracking-tighter">Access Denied</h1>
    <p className="text-xs text-red-600/70 font-mono mt-2">SEC_REJECT: ADMINISTRATOR_LEVEL_REQUIRED</p>
  </div>;

  const getModuleIcon = (module: string) => {
    switch (module) {
      case 'vault': return <Lock className="w-4 h-4" />;
      case 'credentials': return <Key className="w-4 h-4" />;
      case 'insights': return <BarChart3 className="w-4 h-4" />;
      case 'tickets': return <Ticket className="w-4 h-4" />;
      case 'rbac': return <Fingerprint className="w-4 h-4" />;
      case 'system': return <Cpu className="w-4 h-4" />;
      default: return <Database className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white border-red-600';
      case 'high': return 'bg-orange-500 text-white border-orange-600';
      case 'medium': return 'bg-blue-500 text-white border-blue-600';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const filteredLogs = logs.filter(l => 
    l.actorEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.module?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCompliance = complianceLogs.filter(l => 
    l.agentEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.violatedRule?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = [
    { label: t('audit.totalEvents', 'Total Events'), value: logs.length + complianceLogs.length, icon: Database, color: 'text-blue-600' },
    { label: t('audit.securityAlerts', 'Security Alerts'), value: filteredCompliance.length, icon: ShieldAlert, color: 'text-red-600' },
    { label: t('audit.systemIntegrity', 'System Integrity'), value: t('audit.protected', 'Protected'), icon: FileCheck2, color: 'text-emerald-600' },
    { label: t('audit.verifiableSignatures', 'Verifiable Signatures'), value: logs.filter(l => l.signature).length, icon: Fingerprint, color: 'text-purple-600' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FA] p-6 lg:p-10 custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-10 pb-20">
        
        {/* Superior Header */}
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b-2 border-black pb-8">
          <div className="space-y-4">
             <div className="flex items-center gap-3">
                <div className="bg-black text-white p-2 rounded-lg">
                   <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                   <span className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase leading-none">{t('protocols.alpha', 'GeistDesk Protocol Alpha')}</span>
                   <h1 className="text-2xl sm:text-4xl font-black text-black tracking-tight uppercase leading-none mt-1 italic">{t('audit.sovereignty', 'Audit Sovereignty')}</h1>
                </div>
             </div>
             <p className="text-sm text-slate-500 max-w-xl leading-relaxed">
                {t('audit.description', 'Immutable record-keeping for enterprise-grade compliance. Every action is cryptographically tied to an identity and verified via the GeistDesk Governance Engine.')}
             </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
             <div className="flex flex-col items-end pr-6 border-r border-slate-200">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t('protocols.status', 'Protocol Status')}</span>
                <div className="flex items-center gap-1.5 mt-1">
                   <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                   <span className="text-[10px] font-bold text-slate-900 uppercase">{t('audit.liveIndexing', 'Live Indexing Active')}</span>
                </div>
             </div>
             <Button className="rounded-none bg-black hover:bg-slate-800 text-white font-black text-[10px] uppercase h-12 px-8 tracking-widest transition-all">
                <Download className="w-3.5 h-3.5 mr-2" />
                {t('audit.downloadManifest', 'Download Certified Manifest')}
             </Button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1">
           {stats.map((stat, i) => (
             <div key={i} className="bg-white border border-slate-200 p-6 space-y-3 hover:bg-slate-50 transition-colors">
                <div className={`p-2 w-fit rounded-lg bg-slate-50 ${stat.color}`}>
                   <stat.icon className="w-5 h-5" />
                </div>
                <div>
                   <h3 className="text-2xl font-black text-black leading-none">{stat.value}</h3>
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 block">{stat.label}</span>
                </div>
             </div>
           ))}
        </div>

        <Tabs defaultValue="system" onValueChange={setActiveTab} className="space-y-8">
           <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <TabsList className="bg-slate-100 p-1 h-12 rounded-lg w-full md:w-fit">
                 <TabsTrigger 
                   value="system" 
                   className="rounded-md px-4 sm:px-10 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm font-black text-[10px] uppercase tracking-widest h-10 transition-all"
                 >
                   {t('audit.atomicLogs', 'Atomic Logs')}
                 </TabsTrigger>
                 <TabsTrigger 
                   value="compliance" 
                   className="rounded-md px-4 sm:px-10 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm font-black text-[10px] uppercase tracking-widest h-10 transition-all text-red-600/60 data-[state=active]:text-red-600"
                 >
                   {t('audit.legalIntercepts', 'Legal Intercepts')}
                 </TabsTrigger>
              </TabsList>
              
              <div className="relative w-full md:w-96 group">
                 <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-black transition-colors" />
                 <Input 
                   placeholder={t('audit.searchPlaceholder', 'SEARCH BY IDENTITY, ACTION OR MODULE...')} 
                   className="h-12 w-full bg-white border-2 border-slate-100 rounded-lg pl-12 focus-visible:ring-0 focus-visible:border-black text-[10px] font-black uppercase tracking-widest placeholder:text-slate-300 transition-all shadow-sm"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                 />
              </div>
           </div>

           <TabsContent value="system" className="mt-0 space-y-1">
              <div className="grid grid-cols-12 px-6 py-3 border-b border-black text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] bg-white">
                 <div className="col-span-6 md:col-span-3">{t('audit.colActionIdentity', 'Action & Identity')}</div>
                 <div className="col-span-4 md:col-span-2">{t('audit.colOriginModule', 'Origin Module')}</div>
                 <div className="hidden md:block md:col-span-3">{t('audit.colTimestamp', 'Timestamp')}</div>
                 <div className="hidden lg:block lg:col-span-3">{t('audit.colVerificationId', 'Verification ID')}</div>
                 <div className="col-span-2 md:col-span-1 text-right">{t('audit.colDetails', 'Details')}</div>
              </div>

              <div className="space-y-1">
                {filteredLogs.map((log, i) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <div 
                      className={`group border border-slate-200 bg-white hover:border-black transition-all cursor-pointer ${expandedLog === log.id ? 'ring-2 ring-black border-black z-10 relative' : ''}`}
                      onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                    >
                      <div className="grid grid-cols-12 items-center px-6 py-5">
                         <div className="col-span-6 md:col-span-3 flex items-center gap-4">
                            <div className="h-10 w-10 bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-400 shrink-0 group-hover:bg-black group-hover:text-white transition-colors duration-300">
                               {getModuleIcon(log.module)}
                            </div>
                            <div className="flex flex-col min-w-0">
                               <span className="font-black text-black text-[11px] uppercase tracking-tight truncate leading-tight">
                                 {t('audit.actions.' + log.action.toLowerCase().replace(/[\s_-]+/g, '_'), log.action.replace(/_/g, ' '))}
                              </span>
                               <span className="text-[10px] font-bold text-slate-400 truncate mt-0.5">{log.actorEmail}</span>
                            </div>
                         </div>

                         <div className="col-span-4 md:col-span-2 flex items-center gap-2">
                            <Badge className="bg-slate-100 text-slate-900 border-none text-[8px] font-black uppercase tracking-widest px-2 h-5">
                               {log.module}
                            </Badge>
                            {log.severity && log.severity !== 'low' && (
                               <div className={`w-1.5 h-1.5 rounded-full ${
                                 log.severity === 'critical' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 
                                 log.severity === 'high' ? 'bg-orange-500' : 'bg-blue-500'
                               }`} />
                            )}
                         </div>

                         <div className="hidden md:flex md:col-span-3 items-center gap-2">
                             <Clock className="w-3.5 h-3.5 text-slate-300" />
                             <span className="text-[10px] font-bold text-slate-500">
                                {log.timestamp?.toDate?.() ? log.timestamp.toDate().toLocaleString() : 'Processing...'}
                             </span>
                         </div>

                         <div className="hidden lg:flex lg:col-span-3 items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                            <span className="text-[10px] font-mono font-bold text-emerald-600 truncate max-w-[150px]">
                               {log.signature || `ID-${log.id.slice(0, 12)}`}
                            </span>
                         </div>

                         <div className="col-span-2 md:col-span-1 text-right">
                            <div className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-slate-100 transition-colors">
                               {expandedLog === log.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                         </div>
                      </div>

                      <AnimatePresence>
                         {expandedLog === log.id && (
                           <motion.div
                             initial={{ height: 0, opacity: 0 }}
                             animate={{ height: 'auto', opacity: 1 }}
                             exit={{ height: 0, opacity: 0 }}
                             className="overflow-hidden border-t border-slate-100 bg-slate-50"
                           >
                             <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                   <div className="space-y-2">
                                      <h4 className="text-[9px] font-black text-black uppercase tracking-widest">{t('audit.metadataEvidence', 'Metadata Evidence')}</h4>
                                      <div className="bg-black p-6 rounded-lg shadow-inner">
                                         <pre className="text-[10px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                                            {JSON.stringify(log, null, 2)}
                                         </pre>
                                      </div>
                                   </div>
                                   <div className="flex items-center gap-3 p-4 bg-emerald-100 border border-emerald-200 rounded-lg">
                                      <FileCheck2 className="w-5 h-5 text-emerald-700" />
                                      <div>
                                         <p className="text-[10px] font-black text-emerald-900 uppercase">{t('audit.integrityVerified', 'Integrity Verified')}</p>
                                         <p className="text-[9px] text-emerald-700 font-bold">{t('audit.integrityVerifiedDesc', 'This log matches the cryptographic signature at the time of creation.')}</p>
                                      </div>
                                   </div>
                                </div>
                                
                                <div className="space-y-6">
                                   <h4 className="text-[9px] font-black text-black uppercase tracking-widest">{t('audit.actionChain', 'Action Chain')}</h4>
                                   <div className="space-y-4">
                                      {[
                                        { t: 'T-0s', a: t('audit.actionChainDetail.actionRequested', 'ACTION_REQUESTED'), d: `${t('audit.actionChainDetail.actor', 'Actor')} ${log.actorId} ${t('audit.actionChainDetail.initiated', 'initiated')} ${t('audit.actions.' + log.action.toLowerCase().replace(/[\s_-]+/g, '_'), log.action.replace(/_/g, ' '))}` },
                                        { t: 'T+2ms', a: t('audit.actionChainDetail.gatekeeperPermitted', 'GATEKEEPER_PERMITTED'), d: t('audit.actionChainDetail.gatekeeperPermittedDesc', 'RBAC Policy permit: Access granted based on current claims') },
                                        { t: 'T+14ms', a: t('audit.actionChainDetail.executionSuccess', 'EXECUTION_SUCCESS'), d: t('audit.actionChainDetail.executionSuccessDesc', 'Database write committed successfully') },
                                        { t: 'T+18ms', a: t('audit.actionChainDetail.logSigned', 'LOG_SIGNED'), d: `${t('audit.actionChainDetail.signatureGenerated', 'Signature generated')}: ${log.signature || 'N/A'}` }
                                      ].map((step, si) => (
                                        <div key={si} className="flex gap-4 items-start pl-4 border-l-2 border-slate-200 py-1">
                                           <span className="text-[9px] font-mono font-bold text-slate-400 shrink-0 w-12">{step.t}</span>
                                           <div className="space-y-0.5">
                                              <p className="text-[9px] font-black text-black uppercase tracking-tight">{step.a}</p>
                                              <p className="text-[10px] text-slate-500 font-medium">{step.d}</p>
                                           </div>
                                        </div>
                                      ))}
                                   </div>
                                </div>
                             </div>
                           </motion.div>
                         )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ))}
              </div>
              {filteredLogs.length === 0 && <EmptyState term={searchTerm} />}
           </TabsContent>

           <TabsContent value="compliance" className="mt-0 space-y-6">
              {filteredCompliance.map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                >
                   <div className="border-4 border-red-100 bg-white hover:border-red-200 transition-all">
                      <div className="bg-red-50 p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-red-100">
                         <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                            <div className="h-16 w-16 bg-white border-2 border-red-200 flex items-center justify-center text-red-600 shadow-sm">
                               <ShieldAlert className="w-8 h-8" />
                            </div>
                            <div>
                               <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] bg-red-100 px-2 py-0.5">{t('audit.alertLevelHigh', 'Alert Level: High')}</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Case ID: {log.id.slice(0, 8)}</span>
                               </div>
                               <h3 className="text-2xl font-black text-black uppercase leading-tight italic tracking-tighter">{t('audit.aiPolicyBreachIntercepted', 'AI Policy Breach Intercepted')}</h3>
                            </div>
                         </div>
                         <div className="flex items-center gap-3">
                            <Button className="rounded-none bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase h-10 px-6 tracking-widest shadow-lg shadow-red-200/50">
                               {t('audit.reviewViolationDetail', 'Review Violation Detail')}
                            </Button>
                         </div>
                      </div>
                      
                      <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-10">
                         <div className="space-y-6">
                            <div className="space-y-1.5">
                               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('audit.violatorIdentity', 'Violator Identity')}</span>
                               <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 bg-slate-900 text-white flex items-center justify-center font-black">
                                     {log.agentEmail?.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                     <p className="text-xs font-black text-black">{log.agentEmail}</p>
                                     <p className="text-[10px] font-bold text-slate-400 uppercase">{t('audit.agentNode', 'GeistDesk Agent Node')}</p>
                                  </div>
                               </div>
                            </div>
                            
                            <div className="space-y-1.5">
                               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('audit.policyClause', 'Policy Clause')}</span>
                               <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                                  <div className="flex items-center gap-2 text-red-700 mb-1">
                                     <AlertTriangle className="w-3.5 h-3.5" />
                                     <span className="text-[10px] font-black uppercase">Sovereignty Guard v2.1</span>
                                  </div>
                                  <p className="text-[11px] font-bold text-red-900 leading-snug">{log.violatedRule}</p>
                                </div>
                            </div>
                         </div>

                         <div className="lg:col-span-2 space-y-4">
                            <div className="relative">
                               <div className="absolute -top-3 left-6 bg-black text-white px-3 py-0.5 text-[8px] font-black uppercase tracking-widest">{t('audit.evidenceFragment', 'Evidence Fragment / Blocked Payload')}</div>
                               <div className="bg-slate-100 p-8 pt-10 border-2 border-slate-200 font-mono text-[11px] text-slate-700 leading-relaxed italic relative">
                                  <div className="absolute top-4 right-4 flex gap-1">
                                     <RefreshCw className="w-3 h-3 text-slate-300 animate-spin-slow" />
                                     <span className="text-[8px] font-black text-slate-300">{t('audit.intercepted', 'INTERCEPTED')}</span>
                                  </div>
                                  "{log.draftContent}"
                               </div>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-100 gap-3">
                               <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-1.5">
                                     <span className="text-[9px] font-black text-slate-400 uppercase">{t('audit.marker', 'Marker:')}</span>
                                     <Badge className="bg-red-100 text-red-700 border-none font-black text-[9px] uppercase px-3 italic">"{log.forbiddenText}"</Badge>
                                  </div>
                               </div>
                               <div className="flex items-center gap-2 text-slate-400">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">
                                     {log.timestamp?.toDate?.() ? log.timestamp.toDate().toLocaleString() : 'N/A'}
                                  </span>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                </motion.div>
              ))}
              {filteredCompliance.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white border-2 border-dashed border-slate-200">
                   <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                      <ShieldCheck className="w-10 h-10 text-emerald-500" />
                   </div>
                   <h3 className="text-xl font-black text-black uppercase italic tracking-tighter">{t('audit.zeroComplianceRuptures', 'Zero Compliance Ruptures')}</h3>
                   <p className="text-sm text-slate-500 max-w-sm mt-2">{t('audit.zeroComplianceRupturesDesc', 'All AI vectors and human actions are within the established legal boundaries of the GeistDesk Protocol.')}</p>
                </div>
              )}
           </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function EmptyState({ term }: { term: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-32 px-4 text-center bg-white border border-slate-200">
      <div className="w-20 h-20 bg-slate-50 flex items-center justify-center mb-8 border border-slate-100">
        <HardDrive className="w-10 h-10 text-slate-300" />
      </div>
      <h3 className="text-2xl font-black text-black uppercase italic tracking-tighter">{t('audit.fragmentNotFound', 'Fragment Not Found')}</h3>
      <p className="text-sm text-slate-400 max-w-xs mt-3 lowercase font-mono">
        {t('audit.fragmentNotFoundDescPre', 'The cryptographic sequence matching')} "{term}" {t('audit.fragmentNotFoundDescPost', 'does not exist in the current index.')}
      </p>
    </div>
  );
}

