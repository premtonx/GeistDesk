import { startOrchestratorConfigSync, fetchAiStatus, subscribeAiHealth } from '../../lib/aiOrchestratorClient';
import { AiWorkspaceStatusBanner } from '../ai-orchestrator/AiWorkspaceStatusBanner';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Ticket, 
  BookOpen, 
  Settings, 
  Search, 
  Plus, 
  LayoutGrid,
  Bell,
  HelpCircle,
  Users,
  Building2,
  Globe,
  Radio,
  Share2,
  Lock,
  ShieldAlert,
  Key,
  BarChart3,
  ShieldCheck,
  Menu,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowUpRight,
  UploadCloud,
  Mail,
  Sparkles,
  MoreVertical,
  BrainCircuit
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../ui/dropdown-menu';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '../../components/ui/tooltip';
import { useAdmin, useAuth } from '../../lib/hooks';
import { useSidebar } from '../../lib/context/SidebarContext';
import { usePermissions } from '../../hooks/usePermissions';

import { CreateTicketDialog } from '../CreateTicketDialog';
import { CommandPalette } from '../CommandPalette';
import { NotificationHub } from '../NotificationHub';
import { ticketService } from '../../services/ticketService';
import { customerService } from '../../services/customerService';
import { notificationService } from '../../services/notificationService';
import { Ticket as TicketType, Customer } from '../../types';

import { useTranslation } from '../../lib/context/I18nContext';
import { GeistDeskLogo } from '../ui/GeistDeskLogo';
import { FlagIcon } from '../ui/FlagIcon';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', key: 'dashboard' },
  { icon: Ticket, label: 'Tickets', path: '/tickets', key: 'tickets' },
  { icon: BookOpen, label: 'GeistKB', path: '/kb', key: 'geistKB' },
  { icon: Lock, label: 'GeistVault', path: '/credentials', key: 'geistVault' },
  { icon: UploadCloud, label: 'Geist Exchange', path: '/vault', key: 'geistExchange' },
  { icon: LayoutGrid, label: 'Admin Hub', path: '/admin', key: 'admin' },
  { icon: BrainCircuit, label: 'AI Operations', path: '/admin/ai', key: 'aiOrchestrator' },
];

import { WorkTimer } from './WorkTimer';

export default function MainLayout() {
  const { t, language, i18n } = useTranslation();
  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  const { role, userProfile, hasPermission } = usePermissions();

  const isSystemAdmin = isAdmin || 
                        userProfile?.role === 'admin' || 
                        userProfile?.is_admin === true || 
                        role?.name === 'admin';

  const visibleNavItems = React.useMemo(() => {
    return navItems.filter((item) => {
      // Admin elements require system admin status
      if (item.path.startsWith('/admin') || item.path === '/audit') {
        return isSystemAdmin;
      }
      
      // Feature elements check direct RBAC and boolean toggles
      if (item.path === '/insights') {
        return hasPermission('insights', 'view');
      }
      if (item.path === '/vault' || item.path === '/credentials') {
        return hasPermission('vault', 'view');
      }
      if (item.path === '/customers') {
        return hasPermission('customers', 'view');
      }
      if (item.path === '/kb') {
        if (userProfile?.can_view_knowledgebase === false) return false;
        return hasPermission('kb_articles', 'view') || hasPermission('kb', 'view');
      }
      
      return true;
    });
  }, [isSystemAdmin, hasPermission, userProfile]);

  const location = useLocation();
  const hasLocalLeftCreateButton = location.pathname.startsWith('/tickets') || 
                                   location.pathname.startsWith('/kb') || 
                                   location.pathname.startsWith('/credentials') || 
                                   location.pathname.startsWith('/vault');
  const { 
    isMainCollapsed, 
    isPipelineCollapsed, 
    toggleMainSidebar, 
    togglePipelineSidebar 
  } = useSidebar();
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const [aiStatus, setAiStatus] = useState<'loading' | 'healthy' | 'degraded' | 'offline'>('loading');
  const [activeModel, setActiveModel] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    startOrchestratorConfigSync();
    const applyHealth = (data: { status?: string; primaryModel?: string }) => {
      if (data.status === 'healthy') {
        setAiStatus('healthy');
        setActiveModel(data.primaryModel || 'GPT-5');
      } else if (data.status === 'degraded') {
        setAiStatus('degraded');
        setActiveModel(data.primaryModel || '');
      } else {
        setAiStatus('offline');
        setActiveModel('');
      }
    };
    void fetchAiStatus().then((h) => h && applyHealth(h));
    return subscribeAiHealth((h) => applyHealth(h));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubTickets = ticketService.subscribeToTickets(setTickets);
    const unsubCustomers = customerService.subscribeToCustomers(setCustomers);
    
    // Seed mock notifications if none exist (one-time for demo)
    const hasSeeded = localStorage.getItem(`geistdesk_notifications_seeded_${user.uid}`);
    if (!hasSeeded) {
       notificationService.seedMockNotifications(user.uid).then(() => {
          localStorage.setItem(`geistdesk_notifications_seeded_${user.uid}`, 'true');
       });
    }

    return () => {
      unsubTickets();
      unsubCustomers();
    };
  }, [user]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isTicketsPage = location.pathname.startsWith('/tickets');
  
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <CreateTicketDialog 
        isOpen={isCreateTicketOpen} 
        onClose={() => setIsCreateTicketOpen(false)} 
      />
      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        tickets={tickets}
        customers={customers}
        onSelectTicket={(id) => navigate(`/tickets/${id}`)}
      />

      {/* Top Global Header Bar */}
      <header className="h-16 border-b bg-card flex items-center justify-between px-4 md:px-6 shrink-0 z-50 shadow-sm">
        {/* Left Side: Logo */}
        <div className="flex items-center gap-4 shrink-0 mr-4">
          {/* Mobile hamburger menu (visible < lg) */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsMobileNavOpen(v => !v)}
            title="Toggle Navigation Menu"
            className="lg:hidden rounded-full text-muted-foreground hover:bg-muted shrink-0"
          >
            <Menu className="w-5 h-5" />
          </Button>

          {/* Logo */}
          <div className="flex items-center cursor-pointer select-none" onClick={() => navigate('/dashboard')}>
            <GeistDeskLogo size="sm" showText={true} />
          </div>
        </div>

        {/* Right Side: Search, Timer, Actions, Notifications, Avatar */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Active View / Left Pipeline collapse button when on `/tickets` */}
          {isTicketsPage && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={togglePipelineSidebar}
              title={isPipelineCollapsed ? "Expand Pipeline Sidebar" : "Collapse Pipeline Sidebar"}
              className={cn(
                "rounded-full transition-colors shrink-0",
                isPipelineCollapsed ? "text-primary bg-[#E8F0FE]" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <PanelLeftOpen className="w-5 h-5" />
            </Button>
          )}

          {/* Search trigger (⌘K) */}
          <div 
            className="hidden md:flex items-center relative cursor-pointer w-36 xl:w-52 shrink-0 animate-fade-in" 
            onClick={() => setIsCommandPaletteOpen(true)}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <div className="pl-8 pr-3 bg-muted border-none h-9 rounded-full text-xs flex items-center text-muted-foreground transition-all hover:bg-muted/80 w-full whitespace-nowrap select-none truncate">
              {t('actions.searchPlaceholder', 'Search...')} (⌘K)
            </div>
          </div>

          {/* WorkTimer (Horizontal style in Header - hidden on mobile) */}
          <div className="hidden md:block shrink-0">
            <WorkTimer variant="horizontal" />
          </div>

          {/* Sovereignty Status interactive global indicator popover (visible everywhere including mobile) */}
          <div className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <button 
                  title={t('header.dataSovereignDe', 'Data Sovereign: DE')}
                  className="flex items-center justify-center h-9 w-9 bg-[#EBF5FF] text-[#1E40AF] hover:bg-[#DBEAFE] rounded-full border border-[#BFDBFE]/80 transition-all shrink-0 cursor-pointer shadow-xs select-none relative"
                >
                  <Globe className="w-4.5 h-4.5" />
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#3B82F6] animate-pulse shadow-[0_0_4px_rgba(59,130,246,0.5)]" />
                </button>
              } />
              <DropdownMenuContent align="end" className="w-[285px] bg-white border border-slate-100 shadow-xl rounded-xl p-4 z-50 transition-all duration-200">
                <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2.5">
                  <div className="p-1 h-6 w-6 rounded-lg bg-[#EBF5FF] border border-[#BFDBFE] flex items-center justify-center text-[#1E40AF]">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                      {t('header.sovereignCloudStatus', 'Sovereign Cloud Status')}
                    </h4>
                    <p className="text-[9px] text-slate-500 font-mono">
                      {t('header.germanyLocalNode', 'Germany Local Node')}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-3">
                    <div className="flex flex-col gap-1 text-[11px] pb-2 border-b border-slate-200/50">
                      <span className="text-slate-400 font-medium">
                        {t('header.localDeNodeResidency', 'Local DE Node: Data Residency')}
                      </span>
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <FlagIcon code="de" className="w-4 h-3" />
                        {t('header.germanyDe', 'Germany (DE)')}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 text-[11px] py-2 border-b border-slate-200/50">
                      <span className="text-slate-400 font-medium">
                        {t('header.deploymentType', 'Deployment Type')}
                      </span>
                      <span className="font-bold text-slate-800 flex items-center gap-1 text-[#059669]">
                        ✓ {t('header.selfHostedVpc', 'Self-Hosted (VPC)')}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 text-[11px] py-2 border-b border-slate-200/50">
                      <span className="text-slate-400 font-medium">
                        {t('header.processingRoute', 'Processing Route')}
                      </span>
                      <span className="font-bold text-slate-800 flex items-center gap-1 text-[#059669]">
                        ✓ {t('header.noExternalAiLeaks', 'No External AI Leaks')}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 text-[11px] pt-1">
                      <span className="text-slate-400 font-medium">
                        {t('header.slaAuditLog', 'SLA Audit Log')}
                      </span>
                      <span className="font-bold text-slate-800 flex items-center gap-1 text-[#059669]">
                        ✓ {t('header.immutableActive', 'Immutable & Active')}
                      </span>
                    </div>
                  </div>

                  <div className="text-[9.5px] leading-relaxed text-slate-500 bg-[#EBF5FF]/40 p-2.5 rounded-xl border border-[#BFDBFE]/40">
                    {t('header.sovereigntyDesc', 'Your enterprise deployment secures all context windows and telemetry safely here inside Germany.')}
                  </div>

                  <div className="border-t border-slate-100 pt-2.5 text-center flex justify-center">
                    <Link 
                      to="/admin/sovereignty"
                      className="text-[9.5px] font-black text-[#1A73E8] hover:underline uppercase tracking-wider font-mono cursor-pointer block py-1 w-full text-center"
                    >
                      {t('header.sovereigntyCenterLink', 'Sovereignty Center →')}
                    </Link>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* PII Shield Active interactive global indicator popover (visible everywhere including mobile) */}
          <div className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <button 
                  title={t('header.piiShieldActive', 'PII Shield Active')}
                  className="flex items-center justify-center h-9 w-9 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70 rounded-full border border-emerald-100/80 transition-all shrink-0 cursor-pointer shadow-xs select-none relative"
                >
                  <ShieldCheck className="w-4.5 h-4.5" />
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_4px_rgba(16,185,129,0.5)]" />
                </button>
              } />
              <DropdownMenuContent align="end" className="w-[280px] bg-white border border-slate-100 shadow-xl rounded-xl p-4 z-50 transition-all duration-200">
                <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2.5">
                  <div className="p-1 h-6 w-6 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                      {t('header.sovereignPiiShield', 'Sovereign PII Shield')}
                    </h4>
                    <p className="text-[9px] text-slate-500 font-mono">
                      {t('header.realtimeAnonymization', 'Real-time Anonymization')}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {t('header.status', 'Status')}
                    </span>
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                      🟢 {t('header.shielded', 'Shielded')}
                    </span>
                  </div>

                  <div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-50/60 hover:bg-slate-50 border border-slate-100/60 rounded-xl p-2.5 transition-colors flex flex-col">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          {t('header.emails', 'Emails')}
                        </p>
                        <p className="text-base font-black text-slate-800 font-mono">421</p>
                      </div>
                      <div className="bg-slate-50/60 hover:bg-slate-50 border border-slate-100/60 rounded-xl p-2.5 transition-colors flex flex-col">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          {t('header.passwords', 'Passwords')}
                        </p>
                        <p className="text-base font-black text-slate-800 font-mono">82</p>
                      </div>
                      <div className="bg-slate-50/60 hover:bg-slate-50 border border-slate-100/60 rounded-xl p-2.5 transition-colors flex flex-col">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          {t('header.apiKeys', 'API Keys')}
                        </p>
                        <p className="text-base font-black text-slate-800 font-mono">41</p>
                      </div>
                      <div className="bg-slate-50/60 hover:bg-slate-50 border border-slate-100/60 rounded-xl p-2.5 transition-colors flex flex-col">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          {t('header.ipAddresses', 'IP Addresses')}
                        </p>
                        <p className="text-base font-black text-slate-800 font-mono">129</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-2.5 text-center flex justify-center">
                    <Link 
                      to="/admin/pii"
                      className="text-[9.5px] font-black text-[#1A73E8] hover:underline uppercase tracking-wider font-mono cursor-pointer block py-1 w-full text-center"
                    >
                      {t('header.configureGuardrails', 'Configure Guardrails →')}
                    </Link>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <AiWorkspaceStatusBanner />

          {/* AI Orchestrator Gateway Global Indicator (with model details on click) */}
          <div className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <button 
                  title={t('header.aiOrchestratorStatus', 'AI Orchestrator Status')}
                  className={cn(
                    "flex items-center justify-center h-9 w-9 rounded-full border transition-all shrink-0 cursor-pointer shadow-xs select-none relative",
                    aiStatus === 'healthy' ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100/70 border-indigo-100/80" :
                    aiStatus === 'degraded' ? "bg-amber-50 text-amber-700 hover:bg-amber-100/70 border-amber-100/80" :
                    aiStatus === 'offline' ? "bg-red-50 text-red-700 hover:bg-red-100/70 border-red-100/80" :
                    "bg-slate-50 text-slate-400 border-slate-200"
                  )}
                >
                  <BrainCircuit className="w-4.5 h-4.5 animate-pulse" />
                  <span className={cn(
                    "absolute top-1 right-1 h-2 w-2 rounded-full",
                    aiStatus === 'healthy' ? "bg-emerald-500 animate-pulse shadow-[0_0_4px_rgba(16,185,129,0.5)]" :
                    aiStatus === 'degraded' ? "bg-amber-500 animate-pulse" :
                    aiStatus === 'offline' ? "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]" :
                    "bg-amber-400 animate-pulse"
                  )} />
                </button>
              } />
              <DropdownMenuContent align="end" className="w-[280px] bg-white border border-slate-100 shadow-xl rounded-xl p-4 z-50 transition-all duration-200">
                <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2.5">
                  <div className="p-1 h-6 w-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                    <BrainCircuit className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                      {t('header.aiOrchestrator', 'AI Orchestrator')}
                    </h4>
                    <p className="text-[9px] text-slate-500 font-mono">
                      {t('header.coreGatewayRouter', 'Core Gateway Router')}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Status
                    </span>
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest",
                      aiStatus === 'healthy' ? "text-emerald-600" :
                      aiStatus === 'degraded' ? "text-amber-600" :
                      aiStatus === 'offline' ? "text-red-700" : "text-amber-500"
                    )}>
                      {aiStatus === 'healthy' ? `🟢 ${t('header.aiHealthy', 'AI Healthy')}` :
                       aiStatus === 'degraded' ? `🟡 ${t('header.aiDegraded', 'AI Degraded')}` :
                       aiStatus === 'offline' ? `🔴 ${t('header.aiOffline', 'AI Offline')}` :
                       `🟡 ${t('header.checking', 'Checking...')}`}
                    </span>
                  </div>

                  <div className="bg-slate-50/60 border border-slate-100/60 rounded-xl p-2.5 flex flex-col gap-1.5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      {t('header.activeConnectedModel', 'Active Connected Model')}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      <span className="text-xs font-black text-slate-800">
                        {aiStatus === 'healthy' || aiStatus === 'degraded' ? (
                          activeModel === 'gemini-pro' ? 'Gemini 3.5 Pro' :
                          activeModel === 'gemini-flash' ? 'Gemini 2.5 Flash' : activeModel
                        ) : (aiStatus === 'offline' ? t('header.noneOffline', 'None (Offline)') : '...')}
                      </span>
                    </div>
                  </div>

                  {aiStatus === 'offline' && (
                    <div className="bg-red-50/50 border border-red-100 rounded-xl p-2 text-[10px] text-red-700 leading-tight">
                      {t('header.gatewayConnectionFailed', 'Gateway Connection Failed. Check your API keys and local gateway configurations.')}
                    </div>
                  )}

                  {isSystemAdmin && (
                    <div className="border-t border-slate-100 pt-2.5 text-center flex justify-center">
                      <Link 
                        to="/admin/ai"
                        className="text-[9.5px] font-black text-[#1A73E8] hover:underline uppercase tracking-wider font-mono cursor-pointer block py-1 w-full text-center"
                      >
                        {t('header.aiDashboardConfig', 'AI Dashboard Configuration →')}
                      </Link>
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Notification hub */}
          <div className="shrink-0 flex items-center justify-center">
            <NotificationHub />
          </div>

          {/* Language Selector Dropdown (hidden on mobile) */}
          <div className="hidden md:block">
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button 
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 rounded-full text-xs font-bold border border-slate-200 hover:bg-slate-50 flex items-center justify-center shrink-0 select-none cursor-pointer text-slate-700 bg-white shadow-sm"
                  title={language === 'de' ? t('header.changeLanguageDe', 'Sprache wechseln') : t('header.changeLanguage', 'Change language')}
                >
                  <FlagIcon code={language === 'de' ? 'de' : 'en'} className="w-5 h-3.5" />
                </Button>
              } />
              <DropdownMenuContent align="end" className="w-32 bg-white border border-slate-200 shadow-xl rounded-xl p-1 z-50">
                <DropdownMenuItem 
                  onClick={() => i18n.changeLanguage('de')} 
                  className={cn(
                    "flex items-center gap-2 text-xs font-bold p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer",
                    language === 'de' ? "text-[#1A73E8] bg-blue-50/50" : "text-slate-700"
                  )}
                >
                  <FlagIcon code="de" className="w-5 h-3.5" />
                  <span>{t('languages.de', 'Deutsch')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => i18n.changeLanguage('en')} 
                  className={cn(
                    "flex items-center gap-2 text-xs font-bold p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer",
                    language === 'en' ? "text-[#1A73E8] bg-blue-50/50" : "text-slate-700"
                  )}
                >
                  <FlagIcon code="en" className="w-5 h-3.5" />
                  <span>{t('languages.en', 'English')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Consolidated utilities under Menu for mobile (visible only on mobile) */}
          <div className="flex md:hidden shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted shrink-0 border border-slate-200/60 shadow-sm"
                  title="More tools"
                >
                  <MoreVertical className="w-4.5 h-4.5" />
                </Button>
              } />
              <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 shadow-xl rounded-xl p-1 z-50">
                <DropdownMenuItem 
                  onClick={() => setIsCommandPaletteOpen(true)}
                  className="flex items-center gap-2 text-xs font-bold text-slate-700 p-2 py-2.5 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  <Search className="w-4 h-4 text-[#1A73E8]" />
                  <span>{t('actions.search', 'Search...')} (⌘K)</span>
                </DropdownMenuItem>

                <div className="border-t border-slate-100 my-1" />

                <div className="px-2.5 py-1 text-[9px] uppercase font-bold text-slate-400 select-none">{t('header.sovereignCloudStatus', 'Sovereign Cloud Status')}</div>
                <div className="flex items-center gap-2 px-2.5 py-2 text-xs text-emerald-700 font-extrabold">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{t('header.shielded', 'Shielded')}</span>
                </div>

                <div className="border-t border-slate-100 my-1" />

                <div className="px-2.5 py-1 text-[9px] uppercase font-bold text-slate-400 select-none">{t('settings.interfaceLanguage', 'Interface Language')}</div>
                <DropdownMenuItem 
                  onClick={() => i18n.changeLanguage('en')}
                  className={cn(
                    "flex items-center gap-2 text-xs font-bold p-2 hover:bg-slate-50 rounded-lg cursor-pointer",
                    language === 'en' ? "text-[#1A73E8] bg-blue-50/50" : "text-slate-700"
                  )}
                >
                  <FlagIcon code="en" className="w-5 h-3.5" />
                  <span>{t('languages.en', 'English')} (EN)</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => i18n.changeLanguage('de')}
                  className={cn(
                    "flex items-center gap-2 text-xs font-bold p-2 hover:bg-slate-50 rounded-lg cursor-pointer",
                    language === 'de' ? "text-[#1A73E8] bg-blue-50/45" : "text-slate-700"
                  )}
                >
                  <FlagIcon code="de" className="w-5 h-3.5" />
                  <span>{t('languages.de', 'Deutsch')} (DE)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Create Button (with Dropdown) */}
          {!hasLocalLeftCreateButton && (
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button 
                  className="bg-[#1A73E8] hover:bg-[#1765cc] text-white px-3 md:px-5 rounded-full text-xs font-bold shadow-sm h-9 hover:shadow-xs select-none transition-all mr-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span className="hidden sm:inline">{t('actions.create', 'Create')}</span>
                  <span className="sm:hidden">{t('actions.create', 'Create')}</span>
                </Button>
              } />
              <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 shadow-xl rounded-xl p-1 z-50">
                <DropdownMenuItem onClick={() => setIsCreateTicketOpen(true)} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <Ticket className="w-4 h-4 text-[#1A73E8]" />
                  <span>{t('actions.createTicket', 'Create Ticket')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/kb?action=create')} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <BookOpen className="w-4 h-4 text-[#1A73E8]" />
                  <span>{t('actions.createKBArticle', 'Create GeistKB Article')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/credentials?action=create')} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <Lock className="w-4 h-4 text-[#1A73E8]" />
                  <span>{t('actions.createVaultEntry', 'Create GeistVault Entry')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/customers?action=create')} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <Building2 className="w-4 h-4 text-[#1A73E8]" />
                  <span>{t('actions.createCompany', 'Create Company')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Avatar / Profile Dropdown */}
          <div className="relative flex items-center shrink-0">
            <button 
              onClick={() => setIsProfileDropdownOpen(val => !val)}
              className="flex items-center gap-2 cursor-pointer focus:outline-none hover:opacity-90 active:scale-95 transition-all"
              id="header-profile-avatar-btn"
              title="Open Profile Menu"
            >
              <Avatar className="h-8 w-8 ring-1 ring-slate-200">
                <AvatarFallback className="bg-blue-100 text-blue-800 text-xs font-bold font-sans">
                  {user?.displayName ? user.displayName.charAt(0).toUpperCase() : (user?.email?.charAt(0).toUpperCase() || 'P')}
                </AvatarFallback>
              </Avatar>
            </button>

            {isProfileDropdownOpen && (
              <>
                {/* Overlay backdrop */}
                <div 
                  className="fixed inset-0 z-[100] bg-transparent" 
                  onClick={() => setIsProfileDropdownOpen(false)}
                />
                {/* Dropdown Box */}
                <div className="absolute right-0 top-10 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-3 z-[110] animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2 border-b border-slate-100 pb-2.5 mb-1.5">
                    <p className="text-[10px] font-bold text-slate-400 font-mono tracking-widest uppercase mb-0.5">Signed in as</p>
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {user?.displayName || (user?.email ? user.email.split('@')[0] : 'Operator')}
                    </p>
                    <p className="text-xs font-semibold text-slate-500 truncate">
                      {user?.email || 'N/A'}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      navigate('/settings');
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    Settings & Profile Config
                  </button>
                  
                  <div className="border-t border-slate-100/80 my-1" />
                  
                  <button
                    onClick={async () => {
                      setIsProfileDropdownOpen(false);
                      try {
                        const { logout } = await import('../../lib/hooks');
                        await logout();
                        navigate('/');
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <ArrowUpRight className="w-4 h-4 text-red-400 rotate-180" />
                    Logout / Switch User
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Navigation Sub-Header (Row 2) - visible lg and up */}
      <div className="hidden lg:flex h-12 border-b bg-slate-50/50 items-center px-6 gap-4 shrink-0 z-40 shadow-xs overflow-x-auto scrollbar-none">
        <nav className="flex items-center gap-1.5 w-full min-w-0">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-4 py-1.5 text-[13px] font-semibold transition-all duration-200 rounded-full whitespace-nowrap select-none",
                  isActive 
                    ? "bg-[#E8F0FE] text-[#1A73E8] font-bold shadow-sm" 
                    : "text-[#5F6368] hover:bg-slate-200/50 hover:text-foreground"
                )
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.key ? t('nav.' + item.key, item.label) : item.label}</span>
              {(item as any).isBeta && (
                <span className="bg-[#E8F0FE] text-[#1A73E8] text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">Beta</span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Main Row: Mobile Navigation overlay + Page Outlet content */}
      <div className="flex-1 flex overflow-hidden relative min-h-0 w-full">
        {/* Mobile Nav Overlay Slide-out */}
        <AnimatePresence>
          {isMobileNavOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/60 z-[150] lg:hidden backdrop-blur-xs flex justify-start" 
              onClick={() => setIsMobileNavOpen(false)}
            >
              <motion.div 
                initial={{ x: '-100%' }}
                animate={{ x: '0%' }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="w-72 h-full bg-slate-950 text-white p-5 flex flex-col gap-6 shadow-2xl relative" 
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <span className="font-bold text-lg tracking-tight text-white">{t('nav.title', 'Navigation')}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsMobileNavOpen(false)} 
                    className="rounded-full text-white/60 hover:text-white hover:bg-white/10 h-9 w-9 shrink-0 flex items-center justify-center"
                  >
                    <Plus className="w-5 h-5 rotate-45" />
                  </Button>
                </div>

                {/* Worktimer on Mobile list */}
                <div className="p-1 rounded-xl bg-white/5 border border-white/10 shrink-0">
                  <WorkTimer variant="horizontal" />
                </div>

                <nav className="flex-1 flex flex-col gap-1 overflow-y-auto pb-4">
                  {visibleNavItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileNavOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-all rounded-xl",
                          isActive 
                            ? "bg-[#1A73E8] text-white font-bold" 
                            : "text-slate-400 hover:bg-white/5 hover:text-white"
                        )
                      }
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1">{item.key ? t('nav.' + item.key, item.label) : item.label}</span>
                      {(item as any).isBeta && (
                        <span className="bg-[#E8F0FE] text-[#1A73E8] text-[9.5px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider scale-90">Beta</span>
                      )}
                    </NavLink>
                  ))}
                </nav>

                <div className="border-t border-white/10 pt-4 flex items-center gap-3 shrink-0">
                  <div className="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold border border-blue-400 uppercase shrink-0">
                    {user?.email?.charAt(0) || 'E'}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-white truncate max-w-[150px]">
                       {user?.email || 'Agent'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                       {isAdmin ? 'System Admin' : 'Agent'}
                    </span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Page Content Outlet (takes full remaining width below header) */}
        <div className="flex-1 overflow-hidden relative bg-background flex flex-col min-h-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
