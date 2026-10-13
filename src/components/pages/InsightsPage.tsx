import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Zap, 
  Smile, 
  Frown, 
  Target, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowDownRight,
  Info,
  Calendar,
  Filter,
  Download,
  Brain,
  Timer,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Search,
  Bot,
  Sliders,
  Globe,
  Fingerprint,
  FileText,
  Mail,
  Key,
  Check,
  Play,
  BookOpen
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { logAudit } from '../../services/auditService';
import { toast } from 'sonner';
import { useTranslation } from '../../lib/context/I18nContext';

// --- Mock Data for 2026 KPIs ---
const HUNTING_TIME_DATA = [
  { day: 'Mon', time: 45 },
  { day: 'Tue', time: 38 },
  { day: 'Wed', time: 52 },
  { day: 'Thu', time: 31 },
  { day: 'Fri', time: 24 },
  { day: 'Sat', time: 18 },
  { day: 'Sun', time: 15 },
];

const RESOLUTION_MIX_DATA = [
  { name: 'Autonomous (AI)', value: 68, color: '#1A73E8' },
  { name: 'Agent (Human)', value: 12, color: '#DADCE0' },
  { name: 'Collaborative', value: 20, color: '#4285F4' },
];

const SENTIMENT_SHIFT_DATA = [
  { time: '0m', sentiment: -40 },
  { time: '10m', sentiment: -20 },
  { time: '30m', sentiment: 10 },
  { time: '1h', sentiment: 45 },
  { time: '2h', sentiment: 85 },
];

const ROI_STATS = [
  { label: 'Avg. Hunting Time', value: '28m', change: '-14%', trend: 'up', icon: Timer },
  { label: 'Autonomous Rate', value: '82.4%', change: '+12%', trend: 'up', icon: Zap },
  { label: 'PII Elements Masked', value: '142,805', change: '+22%', trend: 'up', icon: ShieldCheck },
  { label: 'Costs Saved (Est.)', value: '$42,800', change: '+22%', trend: 'up', icon: TrendingUp },
];

const SHARD_HEALTH_DATA = [
  { name: 'Healthy (3/3)', value: 85, color: '#34A853' },
  { name: 'Redundant (5/5)', value: 12, color: '#1A73E8' },
  { name: 'Degraded', value: 3, color: '#EA4335' },
];

// --- Problem Detection Clusters Dataset ---
const PROBLEMS = [
  {
    id: 'vpn',
    titleDe: 'VPN-Verbindungsfehler',
    titleEn: 'VPN Connection Failures',
    impactDe: 'Hohe Priorität',
    impactEn: 'High Priority',
    impactColor: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
    count: 23,
    categoryDe: 'Netzwerk & Tunneling',
    categoryEn: 'Network & Tunneling',
    statusDe: 'Analyse abgeschlossen',
    statusEn: 'Analysis Completed',
    descriptionDe: 'Häufige IPSec-Handshake-Timeouts bei Router-Firmware v14.2 für Mitarbeiter in Zürich und München.',
    descriptionEn: 'Frequent IPSec handshake timeouts detected on router firmware v14.2 for Zurich and Munich employees.',
    rootCauseDe: 'MTU-Größenänderungen nach VPN-Client-Updates führen zu Paketfragmentierung. Die KI empfiehlt eine Anpassung der MTU-Pfad-Entdeckung (MTU=1350) und ein Fallback-Protokoll.',
    rootCauseEn: 'MTU size changes post VPN client updates result in packet fragmentation. The AI recommendation suggests path discovery adjustment (MTU=1350) and a secondary protocol fallback handshake.',
    policyDe: 'Automatisierte MTU-Kompensation aktivieren (GeistExchange-Eigenschaften einschränken)',
    policyEn: 'Deploy Autonomous MTU Compensation & Tunnel Fallback',
    icon: Globe,
    affectedTickets: [
      { id: 'TKT-104', title: 'VPN connectivity failed constantly at Zurich office', name: 'Felix Keller', company: 'Müller GmbH', status: 'open' },
      { id: 'TKT-239', title: 'Cisco network client timeout error 401 on login', name: 'Sarah Becker', company: 'Schneider AG', status: 'pending' },
      { id: 'TKT-312', title: 'Tunnel dropped mid-session with fragmentation error', name: 'Markus Weber', company: 'Weber Tech', status: 'resolved' },
    ]
  },
  {
    id: 'email',
    titleDe: 'E-Mail-Synchronisierungsprobleme',
    titleEn: 'E-Mail Sync Problems',
    impactDe: 'Mittel',
    impactEn: 'Medium',
    impactColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
    count: 18,
    categoryDe: 'Kommunikation & Auth',
    categoryEn: 'Messaging & Collaboration',
    statusDe: 'Prüfbereite Anomalie',
    statusEn: 'Anomaly Detected',
    descriptionDe: 'ActiveSync-Protokollverzögerungen auf Exchange-Server-Konten aufgrund abgelaufener Mandanten-Secrets.',
    descriptionEn: 'ActiveSync protocol delays on exchange server accounts due to expired tenant OAuth secrets.',
    rootCauseDe: 'Zertifikatszuordnungsfehler. 18 Tickets enthalten das Token "IMAP-Timeout". Die KI empfiehlt einen automatisierten Token-Rollover in GeistExchange und die Generierung neuer Client-Schlüssel.',
    rootCauseEn: 'Certificate mapping mismatches. 18 tickets are linked by key token "IMAP-timeout". AI recommends automated token rollover in GeistExchange and client key regeneration.',
    policyDe: 'Automatische Mandanten-Token-Verlängerung via Auth-Hub ausführen',
    policyEn: 'Trigger Automated Tenant Token Rollover & Secret Regeneration',
    icon: Mail,
    affectedTickets: [
      { id: 'TKT-181', title: 'Outlook calendar sync lag is over 4 hours', name: 'Emma Fischer', company: 'Krupp KG', status: 'open' },
      { id: 'TKT-183', title: 'Mobile devices fail to map IMAP folders on Exchange', name: 'Laura Wagner', company: 'Fischer Group', status: 'pending' },
      { id: 'TKT-201', title: 'Re-authentication loop on shared mailbox mailbox_sales@corp', name: 'Thomas Schulz', company: 'Schulz Logistics', status: 'resolved' },
    ]
  },
  {
    id: 'password',
    titleDe: 'Verzögerungen beim Passwort-Reset',
    titleEn: 'Password Reset Delays',
    impactDe: 'Niedrig',
    impactEn: 'Low',
    impactColor: 'bg-slate-100 text-slate-705 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    count: 15,
    categoryDe: 'Zugriffsverwaltung (IAM)',
    categoryEn: 'IAM / User Access',
    statusDe: 'Präventiv gelöst',
    statusEn: 'Resolved (Auto-Mitigated)',
    descriptionDe: 'SMTP-Reset-E-Mails blieben in den Spam-Filtern hängen, da DKIM-Einträge für neue Subdomänen fehlten.',
    descriptionEn: 'SMTP reset emails caught in spam filtering queues due to missing DKIM registration on new subdomains.',
    rootCauseDe: 'DNS-Einträge wiesen nicht den aktualisierten Selektorschlüssel auf. Der KI-Autopilot hat die DKIM-DNS-Einträge über alle Registrare hinweg synchronisiert.',
    rootCauseEn: 'DNS records lacked the updated selector keys. AI Autopilot has automatically synchronized the DKIM DNS values across all registrar nodes.',
    policyDe: 'DNS-Validierung auf Autopilot belassen',
    policyEn: 'DNS Validation Autopilot Sync Policy',
    icon: Key,
    affectedTickets: [
      { id: 'TKT-912', title: 'DKIM mismatch on password reset link delivery', name: 'Jonas Hoffmann', company: 'Hoffmann AG', status: 'resolved' },
      { id: 'TKT-915', title: 'Password reset link not received by company employees', name: 'Monika Lang', company: 'Lang Consulting', status: 'resolved' },
      { id: 'TKT-944', title: 'Spam scoring filters blocked user reset token mail', name: 'Dieter Neumann', company: 'Neumann KG', status: 'resolved' },
    ]
  }
];

export default function InsightsPage() {
  const [timeframe, setTimeframe] = useState('7d');
  const [selectedProblemId, setSelectedProblemId] = useState('vpn');
  const [activatedPolicies, setActivatedPolicies] = useState<Record<string, boolean>>({
    vpn: false,
    email: false,
    password: true // starts as auto-mitigated/active
  });
  const [isSimulatingId, setIsSimulatingId] = useState<string | null>(null);
  const { t, language } = useTranslation();

  const isDe = language === 'de';

  const handleActivatePolicy = (problemId: string) => {
    setIsSimulatingId(problemId);
    logAudit({ module: 'insights', action: 'policy_simulation_start', details: { problemId } });
    setTimeout(() => {
      setActivatedPolicies(prev => ({ ...prev, [problemId]: true }));
      setIsSimulatingId(null);
      logAudit({ module: 'insights', action: 'policy_activated', details: { problemId } });
      toast.success(
        isDe 
          ? "Die automatisierte Korrektur-Richtlinie wurde erfolgreich geschaltet!" 
          : "Automated remediation rule deployed on GeistExchange nodes successfully!"
      );
    }, 1600);
  };

  const selectedProblem = PROBLEMS.find(p => p.id === selectedProblemId) || PROBLEMS[0];

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FA] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-[#DADCE0]">
          <div>
            <h1 className="text-3xl font-medium text-[#202124] tracking-tight">
              {isDe ? 'Sovereign KI-Erkennnisse' : t('insights.title', 'Sovereign Insights')}
            </h1>
            <p className="text-sm text-[#5F6368] font-medium mt-1">
              {isDe ? 'Lokale kognitive Risiko- und Cluster-Aufbereitung (Datenschutzkonform)' : t('insights.subtitle', 'Local-First Executive Intelligence Engine (Privacy-Safe)')}
            </p>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex bg-white border border-[#DADCE0] rounded-full p-1 shadow-sm">
                {['24h', '7d', '30d'].map((tVal) => (
                  <button
                    key={tVal}
                    onClick={() => setTimeframe(tVal)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                      timeframe === tVal ? 'bg-[#1A73E8] text-white shadow-md' : 'text-[#5F6368] hover:bg-[#F1F3F4]'
                    }`}
                  >
                    {tVal.toUpperCase()}
                  </button>
                ))}
             </div>
             <Button 
                variant="outline" 
                className="rounded-full border-[#DADCE0] gap-2 font-bold text-xs shadow-sm bg-white"
                onClick={() => {
                   logAudit({ module: 'insights', action: 'report_exported', details: { timeframe } });
                   toast.success(t('insights.exportSuccess', 'Audit Export generated and signed.'));
                }}
             >
                <Download className="w-3.5 h-3.5" />
                {t('insights.exportAudit', 'Export Audit')}
             </Button>
          </div>
        </header>

        {/* Local Processing Banner */}
        <div className="bg-[#E8F0FE] border border-[#1A73E8]/20 rounded-[32px] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
           <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-[#1A73E8] rounded-2xl flex items-center justify-center text-white shrink-0">
                 <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                 <h3 className="font-bold text-[#1A73E8] text-sm italic">{t('insights.localTransparency', 'Local-First Transparency')}</h3>
                 <p className="text-xs text-[#1A73E8]/80 leading-relaxed">{t('insights.localTransparencyDesc', 'Analytics are computed on-device. No customer telemetry has left your infrastructure.')}</p>
              </div>
           </div>
           <Badge className="bg-white text-[#1A73E8] border-none px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest shadow-sm self-start sm:self-auto shrink-0">{t('insights.privacyCompliant', '2026 PRIVACY COMPLIANT')}</Badge>
        </div>

        {/* Today's AI Activity board */}
        <div className="bg-white border border-[#DADCE0] rounded-[32px] p-6 shadow-sm space-y-5">
           <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                 <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                 <h2 className="text-xs font-black uppercase tracking-widest text-[#5F6368] font-mono">
                    {isDe ? 'Heutige KI-Aktivität' : "Today's AI Activity"}
                 </h2>
              </div>
              <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border border-emerald-100/80 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider font-mono">
                 {isDe ? 'Echtzeit-Statistiken' : 'Real-time Stats'}
              </Badge>
           </div>

           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100/80 rounded-2xl transition-all duration-300">
                 <div className="flex items-center gap-2.5 mb-2">
                    <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                       <FileText className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                       {isDe ? 'Tickets zusammengefasst' : 'Tickets Summarized'}
                    </span>
                 </div>
                 <h3 className="text-2xl font-black text-slate-900 font-mono">422</h3>
                 <p className="text-[9px] text-[#5F6368] mt-1 font-mono italic">
                    {isDe ? 'Ø Lesezeit-Ersparnis: 4,2 Min' : 'Avg. reading time saved: 4.2m'}
                 </p>
              </div>

              <div className="p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100/80 rounded-2xl transition-all duration-300">
                 <div className="flex items-center gap-2.5 mb-2">
                    <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                       <Mail className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                       {isDe ? 'Antworten entworfen' : 'Responses Drafted'}
                    </span>
                 </div>
                 <h3 className="text-2xl font-black text-slate-900 font-mono">128</h3>
                 <p className="text-[9px] text-[#5F6368] mt-1 font-mono italic">
                    {isDe ? 'Übernahme-Rate: 88,5%' : 'Acceptance rate: 88.5%'}
                 </p>
              </div>

              <div className="p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100/80 rounded-2xl transition-all duration-300">
                 <div className="flex items-center gap-2.5 mb-2">
                    <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                       <AlertTriangle className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                       {isDe ? 'Eskalationen vorgeschlagen' : 'Escalations Suggested'}
                    </span>
                 </div>
                 <h3 className="text-2xl font-black text-slate-900 font-mono">41</h3>
                 <p className="text-[9px] text-[#5F6368] mt-1 font-mono italic">
                    {isDe ? 'SLA-Sicherungen' : 'Prevented SLA breaches'}
                 </p>
              </div>

              <div className="p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100/80 rounded-2xl transition-all duration-300">
                 <div className="flex items-center gap-2.5 mb-2">
                    <div className="h-7 w-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                       <BookOpen className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                       {isDe ? 'Beiträge generiert' : 'Articles Generated'}
                    </span>
                 </div>
                 <h3 className="text-2xl font-black text-slate-900 font-mono">97</h3>
                 <p className="text-[9px] text-[#5F6368] mt-1 font-mono italic">
                    {isDe ? 'GeistKB Entwürfe' : 'GeistKB contributions'}
                 </p>
              </div>
           </div>
        </div>

        <Tabs defaultValue="problems" className="space-y-8">
           <TabsList className="bg-white border border-[#DADCE0] p-1 rounded-full h-12 shadow-sm w-fit flex flex-wrap max-w-full">
              <TabsTrigger value="problems" className="rounded-full px-6 md:px-8 data-[state=active]:bg-black data-[state=active]:text-white font-bold text-[11px] uppercase tracking-widest h-10 transition-all flex items-center gap-2">
                 <Brain className="w-3.5 h-3.5" />
                 {isDe ? 'Problemerkennung' : 'Problem Detection'}
                 <Badge className="bg-[#1A73E8] text-white ml-1 border-none px-1.5 h-4.5 text-[8px] font-black">3</Badge>
              </TabsTrigger>
              <TabsTrigger value="roi" className="rounded-full px-6 md:px-8 data-[state=active]:bg-black data-[state=active]:text-white font-bold text-[11px] uppercase tracking-widest h-10 transition-all">
                 {t('insights.roiEngine', 'ROI Engine')}
              </TabsTrigger>
              <TabsTrigger value="governance" className="rounded-full px-6 md:px-8 data-[state=active]:bg-black data-[state=active]:text-white font-bold text-[11px] uppercase tracking-widest h-10 transition-all flex items-center gap-2">
                 <ShieldCheck className="w-3.5 h-3.5" />
                 {t('insights.auditorCiso', 'Auditor (CISO View)')}
              </TabsTrigger>
           </TabsList>

           {/* --- TAB: PROBLEM DETECTION (Problemerkennung) --- */}
           <TabsContent value="problems" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 
                 {/* Left Column: Detected Clusters List */}
                 <div className="lg:col-span-1 space-y-4">
                    <div className="flex items-center justify-between px-2">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {isDe ? 'Erkannte Mustergruppen' : 'Detected Pattern Clusters'}
                       </span>
                       <Badge variant="outline" className="text-[9px] font-bold text-[#5F6368] border-slate-300">
                          {isDe ? 'Lokal verarbeitet' : 'Processed Locally'}
                       </Badge>
                    </div>

                    {PROBLEMS.map((prob) => {
                       const title = isDe ? prob.titleDe : prob.titleEn;
                       const impact = isDe ? prob.impactDe : prob.impactEn;
                       const category = isDe ? prob.categoryDe : prob.categoryEn;
                       const isSelected = prob.id === selectedProblemId;
                       const isDeployed = activatedPolicies[prob.id];

                       return (
                          <motion.div
                            key={prob.id}
                            whileHover={{ y: -2 }}
                            transition={{ duration: 0.15 }}
                          >
                             <button
                               onClick={() => setSelectedProblemId(prob.id)}
                               className={`w-full text-left p-5 rounded-[24px] border transition-all flex flex-col justify-between gap-3 shadow-xs relative overflow-hidden ${
                                 isSelected 
                                   ? 'bg-white border-[#1A73E8] ring-2 ring-[#1A73E8]/10' 
                                   : 'bg-white border-[#DADCE0] hover:border-slate-400'
                               }`}
                             >
                                <div className="flex items-start justify-between gap-2.5">
                                   <div className="flex items-center gap-2">
                                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-[#1A73E8]/10 text-[#1A73E8]' : 'bg-slate-100 text-slate-600'}`}>
                                         <prob.icon className="w-4.5 h-4.5" />
                                      </div>
                                      <div>
                                         <h3 className="font-bold text-[#202124] text-xs leading-tight sm:text-sm">{title}</h3>
                                         <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">{category}</span>
                                      </div>
                                   </div>
                                   <Badge className={`text-[8.5px] font-bold uppercase py-0.5 px-2 border border-none shadow-none leading-none ${prob.impactColor}`}>
                                      {impact}
                                   </Badge>
                                </div>

                                <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100 mt-1">
                                   <span className="text-slate-500 font-medium">
                                      {isDe ? `${prob.count} ähnliche Tickets` : `${prob.count} similar support cases`}
                                   </span>
                                   <span className={`text-[9.5px] font-bold flex items-center gap-1 ${isDeployed ? 'text-green-600' : 'text-[#1A73E8]'}`}>
                                      {isDeployed ? (
                                         <>
                                            <CheckCircle className="w-3.5 h-3.5" />
                                            {isDe ? 'Aktiv' : 'Active'}
                                         </>
                                      ) : (
                                         <>
                                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                            {isDe ? 'Aktion bereit' : 'Remedy Ready'}
                                         </>
                                      )}
                                   </span>
                                </div>
                             </button>
                          </motion.div>
                       );
                    })}

                    <Card className="rounded-[24px] border-dashed border-[#DADCE0] bg-slate-50/50 p-6 flex flex-col justify-center items-center text-center space-y-2">
                       <Bot className="w-8 h-8 text-slate-350" />
                       <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                          {isDe ? 'Überwachung läuft' : 'Watcher Daemon Active'}
                       </h4>
                       <p className="text-[10px] text-slate-400 leading-snug">
                          {isDe 
                            ? 'Die KI-Pipeline wertet eintreffende Tickets aus, um neue Anomalie-Cluster sofort bei Entstehen hinzuzufügen.' 
                            : 'AI analytical daemon continues evaluating real-time ticket logs to record new recurring anomalies instantly.'}
                       </p>
                    </Card>
                 </div>

                 {/* Right Column: Detailed cluster inspector and policy actions */}
                 <div className="lg:col-span-2 space-y-6">
                    <Card className="rounded-[40px] border-[#DADCE0] shadow-sm bg-white overflow-hidden p-6 md:p-8 space-y-6">
                       
                       {/* Header Section */}
                       <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-100">
                          <div>
                             <div className="flex items-center gap-2">
                                <Badge className="bg-[#1A73E8]/10 text-[#1A73E8] font-bold text-[9px] uppercase tracking-wider hover:bg-[#1A73E8]/10 border-none px-2.5 h-5 leading-none">
                                   {isDe ? selectedProblem.categoryDe : selectedProblem.categoryEn}
                                </Badge>
                                <span className="text-[11px] text-slate-400 font-bold font-mono">
                                   CLUSTER_ID: {selectedProblem.id.toUpperCase()}_AUTOFIX
                                </span>
                             </div>
                             <h2 className="text-xl md:text-2xl font-semibold text-slate-900 mt-2">
                                {isDe ? selectedProblem.titleDe : selectedProblem.titleEn}
                             </h2>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:self-center">
                             <Badge className={`text-[10px] font-bold uppercase py-1 px-3 border border-none shadow-none leading-none ${selectedProblem.impactColor}`}>
                                {isDe ? selectedProblem.impactDe : selectedProblem.impactEn}
                             </Badge>
                             <Badge variant="outline" className="text-[10px] font-bold border-slate-300 py-1 px-2.5">
                                {isDe ? selectedProblem.statusDe : selectedProblem.statusEn}
                             </Badge>
                          </div>
                       </div>

                       {/* Summary & description block */}
                       <div className="space-y-2">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                             <Info className="w-3.5 h-3.5 text-slate-400" />
                             {isDe ? 'Problembeschreibung & Symptomlage' : 'Problem Diagnosis & Symptoms'}
                          </h4>
                          <p className="text-slate-700 text-xs sm:text-sm leading-relaxed bg-[#F8F9FA] p-4 rounded-xl border border-slate-150">
                             {isDe ? selectedProblem.descriptionDe : selectedProblem.descriptionEn}
                          </p>
                       </div>

                       {/* AI Root-Cause Highlight */}
                       <div className="bg-gradient-to-r from-indigo-50/70 to-blue-50/70 dark:from-indigo-950/20 dark:to-blue-950/20 border border-indigo-100 dark:border-indigo-900 rounded-2xl p-5 space-y-3 relative overflow-hidden">
                          <div className="absolute right-3 top-3 opacity-15">
                             <Sparkles className="w-16 h-16 text-indigo-505" />
                          </div>
                          
                          <div className="flex items-center gap-1.5 text-[#1A73E8]">
                             <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                             <h3 className="text-xs font-black uppercase tracking-wider text-indigo-905">
                                {isDe ? 'KI Ursachen-Hypothese & Reparaturprognose' : 'AI Autonomous Root Cause Hypothesis'}
                             </h3>
                          </div>
                          <p className="text-indigo-950 text-xs sm:text-sm leading-relaxed pr-8">
                             {isDe ? selectedProblem.rootCauseDe : selectedProblem.rootCauseEn}
                          </p>
                       </div>

                       {/* Simulated Affected Tickets list */}
                       <div className="space-y-3">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                             {isDe ? `Zugeordnete Tickets (${selectedProblem.count} insgesamt)` : `Linked tickets (${selectedProblem.count} total)`}
                          </h4>
                          <div className="divide-y divide-slate-100 border border-slate-150 rounded-xl overflow-hidden bg-[#F8F9FA]/30">
                             {selectedProblem.affectedTickets.map((tkt, index) => (
                                <div key={index} className="p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:bg-slate-50/80 transition-colors">
                                   <div className="space-y-0.5 max-w-[80%]">
                                      <div className="flex items-center gap-2">
                                         <span className="font-mono text-xs font-bold text-slate-900 bg-white border px-1.5 py-0.5 rounded shadow-2xs leading-none">
                                            {tkt.id}
                                         </span>
                                         <span className="text-[11px] text-slate-500 font-bold truncate">
                                            {tkt.company} • {tkt.name}
                                         </span>
                                      </div>
                                      <p className="text-xs text-slate-650 truncate max-w-full font-medium">
                                         {tkt.title}
                                      </p>
                                   </div>
                                   <Badge className={`text-[8px] font-bold uppercase px-2 h-4.5 border-none leading-none ${
                                     tkt.status === 'open' ? 'bg-red-50 text-red-700' :
                                     tkt.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                                   }`}>
                                      {tkt.status === 'open' ? (isDe ? 'OFFEN' : 'OPEN') :
                                       tkt.status === 'pending' ? (isDe ? 'PENDING' : 'PENDING') : (isDe ? 'GELÖST' : 'SOLVED')}
                                   </Badge>
                                </div>
                             ))}
                          </div>
                       </div>

                       {/* Policy Activation Action card */}
                       <div className="p-5 border border-slate-200 bg-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                          <div className="space-y-1">
                             <span className="text-[10px] text-slate-450 uppercase font-black tracking-widest block leading-none">
                                {isDe ? 'GeistExchange Richtlinien-Konfiguration' : 'GeistExchange Orchestrator Remediator'}
                             </span>
                             <h4 className="font-bold text-xs sm:text-sm text-slate-800">
                                {isDe ? selectedProblem.policyDe : selectedProblem.policyEn}
                             </h4>
                          </div>

                          {activatedPolicies[selectedProblem.id] ? (
                             <Badge className="bg-emerald-100 text-emerald-800 font-bold uppercase tracking-wider text-[10px] border-none px-4 py-2 rounded-full h-10 flex items-center gap-1.5 self-start sm:self-auto shadow-none">
                                <CheckCircle className="w-4 h-4 text-emerald-600" />
                                {isDe ? 'RICHTLINIE AKTIV' : 'POLICY ENFORCED'}
                             </Badge>
                          ) : (
                             <Button
                               onClick={() => handleActivatePolicy(selectedProblem.id)}
                               disabled={isSimulatingId === selectedProblem.id}
                               className="bg-black hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl px-4 py-2 h-10 shadow-sm flex items-center justify-center gap-2 self-start sm:self-auto shrink-0"
                             >
                                {isSimulatingId === selectedProblem.id ? (
                                   <>
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                      {isDe ? 'Schalte Regel...' : 'Deploying Rule...'}
                                   </>
                                ) : (
                                   <>
                                      <Sliders className="w-3.5 h-3.5" />
                                      {isDe ? 'Regel aktivieren' : 'Activate Policy'}
                                   </>
                                )}
                             </Button>
                          )}
                       </div>

                    </Card>
                 </div>

              </div>
           </TabsContent>

           {/* --- TAB: ROI ENGINE --- */}
           <TabsContent value="roi" className="space-y-8 mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 {ROI_STATS.map((stat, i) => (
                   <motion.div
                     key={i}
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: i * 0.1 }}
                   >
                     <Card className={`rounded-[32px] border-[#DADCE0] shadow-none bg-white p-6 hover:shadow-lg transition-all cursor-default ${i === 1 ? 'ring-2 ring-[#1A73E8] ring-offset-4 ring-offset-[#F8F9FA]' : ''}`}>
                        <div className="flex items-center justify-between mb-4">
                           <div className="p-2.5 bg-[#F8F9FA] rounded-xl text-[#1A73E8]">
                              <stat.icon className="w-5 h-5" />
                           </div>
                           <div className={`flex items-center gap-1 text-[10px] font-black ${stat.trend === 'up' ? 'text-green-600' : 'text-red-700'}`}>
                              {stat.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              {stat.change}
                           </div>
                        </div>
                        <div>
                           <p className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest">{t('insights.roiStats.' + stat.label.toLowerCase().replace(/[^a-z0-9]/g, '_'), stat.label)}</p>
                           <h2 className="text-2xl font-medium text-[#202124] mt-1">{stat.value}</h2>
                        </div>
                     </Card>
                   </motion.div>
                 ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 <Card className="lg:col-span-2 rounded-[40px] border-[#DADCE0] shadow-none bg-white overflow-hidden min-w-0">
                   <CardHeader className="p-6 md:p-8">
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <CardTitle className="text-xl font-medium">{t('insights.huntingTitle', 'Hunting Time Efficiency')}</CardTitle>
                          <CardDescription className="text-xs mt-1 italic">{t('insights.huntingDesc', "Average minutes customers remain in 'unassigned limbo'.")}</CardDescription>
                        </div>
                        <Badge className="bg-[#F1F3F4] text-[#5F6368] font-bold text-[10px] border-none px-3 py-1 self-start sm:self-auto">{t('insights.huntingPeriodChange', '-15% From Last Period')}</Badge>
                     </div>
                   </CardHeader>
                   <CardContent className="h-[350px] p-4 md:p-8">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={HUNTING_TIME_DATA}>
                          <defs>
                            <linearGradient id="colorTime" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#1A73E8" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#1A73E8" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F3F4" />
                          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#9AA0A6', fontSize: 11}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#9AA0A6', fontSize: 11}} dx={-10} />
                          <Tooltip 
                            contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px'}}
                            cursor={{stroke: '#1A73E8', strokeWidth: 2, strokeDasharray: '4 4'}}
                          />
                          <Area type="monotone" dataKey="time" stroke="#1A73E8" strokeWidth={3} fillOpacity={1} fill="url(#colorTime)" />
                        </AreaChart>
                      </ResponsiveContainer>
                   </CardContent>
                 </Card>

                 <Card className="rounded-[40px] border-[#DADCE0] shadow-none bg-white min-w-0">
                   <CardHeader className="px-8 pt-8">
                     <CardTitle className="text-xl font-medium">{t('insights.autonomousMixTitle', 'Autonomous Mix')}</CardTitle>
                     <CardDescription className="text-xs mt-1">{t('insights.autonomousMixDesc', 'Resolution distribution across entity types.')}</CardDescription>
                   </CardHeader>
                   <CardContent className="p-8">
                      <div className="h-[200px] mb-8">
                         <ResponsiveContainer width="100%" height="100%">
                           <PieChart>
                             <Pie
                              data={RESOLUTION_MIX_DATA}
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                             >
                               {RESOLUTION_MIX_DATA.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={entry.color} />
                               ))}
                             </Pie>
                             <Tooltip />
                           </PieChart>
                         </ResponsiveContainer>
                      </div>
                      <div className="space-y-4">
                         {RESOLUTION_MIX_DATA.map((item, i) => (
                            <div key={i} className="flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                  <div className="h-2 w-2 rounded-full" style={{backgroundColor: item.color}}></div>
                                  <span className="text-sm font-medium text-[#202124]">{t('insights.mix.' + item.name.toLowerCase().replace(/[^a-z0-9]/g, '_'), item.name)}</span>
                               </div>
                               <span className="text-sm font-bold text-[#5F6368]">{item.value}%</span>
                            </div>
                         ))}
                      </div>
                   </CardContent>
                 </Card>
              </div>
           </TabsContent>

           {/* --- TAB: GOVERNANCE & PRIVACY --- */}
           <TabsContent value="governance" className="space-y-8 mt-0">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="rounded-[40px] border-[#DADCE0] shadow-none bg-white overflow-hidden">
                   <CardHeader className="px-8 pt-8">
                      <div className="flex items-center gap-4">
                         <div className="h-12 w-12 bg-black rounded-2xl flex items-center justify-center text-white">
                            <Brain className="w-6 h-6" />
                         </div>
                         <div>
                            <CardTitle className="text-xl font-medium">{t('insights.shamirTitle', 'Shamir Shard Integrity')}</CardTitle>
                            <CardDescription className="text-xs mt-1">{t('insights.shamirDesc', 'Health of distributed secret management across the organization.')}</CardDescription>
                         </div>
                      </div>
                   </CardHeader>
                   <CardContent className="p-8 flex flex-col items-center">
                      <div className="h-[250px] w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                               <Pie
                                 data={SHARD_HEALTH_DATA}
                                 cx="50%"
                                 cy="50%"
                                 innerRadius={70}
                                 outerRadius={100}
                                 paddingAngle={10}
                                 dataKey="value"
                               >
                                  {SHARD_HEALTH_DATA.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                               </Pie>
                               <Tooltip 
                                 contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                               />
                            </PieChart>
                         </ResponsiveContainer>
                      </div>
                      <div className="grid grid-cols-3 gap-6 w-full mt-4">
                         {SHARD_HEALTH_DATA.map((item, i) => (
                           <div key={i} className="text-center">
                              <p className="text-[10px] font-black text-slate-404 uppercase tracking-widest leading-none">{t('insights.shards.' + item.name.toLowerCase().replace(/[^a-z0-9]/g, '_'), item.name)}</p>
                              <p className="text-2xl font-black text-black mt-2">{item.value}%</p>
                           </div>
                         ))}
                      </div>
                   </CardContent>
                </Card>

                <Card className="rounded-[40px] border-[#DADCE0] shadow-none bg-white overflow-hidden">
                   <CardHeader className="px-8 pt-8">
                      <div className="flex items-center gap-4">
                         <div className="h-12 w-12 bg-[#1A73E8] rounded-2xl flex items-center justify-center text-white">
                            <Target className="w-6 h-6" />
                         </div>
                         <div>
                            <CardTitle className="text-xl font-medium">{t('insights.privacyGuardTitle', 'Privacy Guard Velocity')}</CardTitle>
                            <CardDescription className="text-xs mt-1">{t('insights.privacyGuardDesc', 'Volume of sensitive data intercepted by the AI Shield per hour.')}</CardDescription>
                         </div>
                      </div>
                   </CardHeader>
                   <CardContent className="h-[300px] p-8">
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={HUNTING_TIME_DATA}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F3F4" />
                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#9AA0A6', fontSize: 11}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#9AA0A6', fontSize: 11}} />
                            <Tooltip 
                               cursor={{fill: '#F8F9FA'}}
                               contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                            />
                            <Bar dataKey="time" fill="#1A73E8" radius={[10, 10, 0, 0]} barSize={40} />
                         </BarChart>
                      </ResponsiveContainer>
                   </CardContent>
                </Card>
             </div>

             <Card className="rounded-[32px] border-none bg-black p-10 text-white overflow-hidden relative">
                <div className="relative z-10 space-y-6">
                   <Badge className="bg-[#34A853] text-white border-none uppercase text-[10px] font-black tracking-widest px-4 h-6">{t('insights.cisoCertified', 'CISO Certified 2026')}</Badge>
                   <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter max-w-2xl leading-tight">
                      {t('insights.leaksHeadline', 'GeistDesk has prevented 1,240 accidental PII leaks this quarter through autonomous entity redaction.')}
                   </h2>
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 sm:gap-8">
                      <div>
                         <p className="text-slate-450 text-[10px] font-black uppercase tracking-widest mb-1">{t('insights.auditScore', 'Audit Score')}</p>
                         <p className="text-3xl font-black">99.8%</p>
                      </div>
                      <div>
                         <p className="text-slate-450 text-[10px] font-black uppercase tracking-widest mb-1">{t('insights.zeroTrustLevel', 'Zero-Trust Level')}</p>
                         <p className="text-3xl font-black">L4 Sovereign</p>
                      </div>
                      <Button className="sm:ml-auto w-full sm:w-auto bg-white text-black font-black uppercase text-[11px] tracking-widest rounded-full px-10 h-12 md:h-14 hover:bg-slate-200 transition-all">
                         {t('insights.generateReport', 'Generate CISO Compliance Report')}
                      </Button>
                   </div>
                </div>
                <div className="absolute right-[-100px] top-[-50px] opacity-10 blur-3xl w-[500px] h-[500px] bg-blue-500 rounded-full" />
             </Card>
           </TabsContent>
        </Tabs>

        {/* Sentiment Analysis segment footer */}
        <Card className="rounded-[40px] border-[#DADCE0] shadow-none bg-white overflow-hidden">
          <CardHeader className="px-8 pt-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-medium">{t('insights.sentimentTitle', 'Sentiment Velocity (Shift)')}</CardTitle>
                <CardDescription className="text-xs mt-1 italic">{t('insights.sentimentDesc', 'Customer mood progression from ticket open to resolution.')}</CardDescription>
              </div>
              <div className="flex items-center gap-4 self-start sm:self-auto">
                 <div className="flex items-center gap-2 text-xs font-bold text-[#EA4335]">
                    <Frown className="w-4 h-4" /> Start
                 </div>
                 <div className="flex items-center gap-2 text-xs font-bold text-[#34A853]">
                    <Smile className="w-4 h-4" /> Resolve
                 </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[250px] p-8 pt-4">
            <ResponsiveContainer width="100%" height="100%">
               <BarChart data={SENTIMENT_SHIFT_DATA}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F3F4" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#9AA0A6', fontSize: 11}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#9AA0A6', fontSize: 11}} dx={-10} domain={[-100, 100]} />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Bar dataKey="sentiment" radius={[12, 12, 0, 0]}>
                    {SENTIMENT_SHIFT_DATA.map((entry, index) => (
                       <Cell 
                        key={`cell-${index}`} 
                        fill={entry.sentiment > 0 ? '#34A853' : '#EA4335'} 
                        fillOpacity={Math.abs(entry.sentiment) / 100 + 0.2} 
                       />
                    ))}
                  </Bar>
               </BarChart>
            </ResponsiveContainer>
          </CardContent>
          <div className="bg-[#F8F9FA] px-6 py-5 md:px-8 md:py-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
            <div className="flex -space-x-3">
               {[1,2,3,4].map(v => (
                 <div key={v} className="h-10 w-10 rounded-full border-2 border-[#F8F9FA] bg-[#F1F3F4] flex items-center justify-center text-[10px] font-bold text-[#5F6368]">
                    AG
                 </div>
               ))}
            </div>
            <div className="text-xs">
               <p className="font-bold text-[#202124]">{t('insights.sentimentIntelHub', 'Sentiment Intelligence Hub')}</p>
               <p className="text-[#5F6368]">{t('insights.sentimentIntelHubDesc', 'AI Engine matched 1,420 tokens of "frustration" and inverted them to "gratitude" in 84% of sessions.')}</p>
            </div>
            <Button className="md:ml-auto w-full md:w-auto bg-white border border-[#DADCE0] text-[#1A73E8] hover:bg-[#E8F0FE] rounded-full text-xs font-bold px-6 h-10 shadow-none">
               {t('insights.drillDown', 'Drill Down')}
            </Button>
          </div>
        </Card>

      </div>
    </div>
  );
}
