import React, { useState, useEffect, useMemo } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Smile, 
  Sparkles,
  Calendar,
  ChevronDown,
  ArrowUpRight,
  Radio,
  Mail,
  Lock,
  HardDrive,
  Terminal,
  Search,
  BookOpen,
  Plus,
  Users,
  AlertTriangle,
  FileDown,
  Bot
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { ticketService } from '../../services/ticketService';
import { Ticket as TicketType } from '../../types';
import { CreateTicketDialog } from '../CreateTicketDialog';
import { usePermissions } from '../../hooks/usePermissions';
import { useTranslation } from '../../lib/context/I18nContext';
import { getSessionToken } from 'firebase/auth';

interface TicketStats {
  total: number;
  open: number;
  pending: number;
  resolved: number;
  closed: number;
  unassigned: number;
  urgent: number;
}

// Visual trend points exactly resembling the premium dashboard curve
const TRENDS_CHART_DATA = [
  { name: 'May 12', tickets: 23 },
  { name: 'May 13', tickets: 35 },
  { name: 'May 14', tickets: 38 },
  { name: 'May 15', tickets: 72 }, // peak
  { name: 'May 16', tickets: 53 },
  { name: 'May 17', tickets: 40 },
  { name: 'May 18', tickets: 28 },
];

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userProfile } = usePermissions();
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [serverStats, setServerStats] = useState<TicketStats>({
    total: 0, open: 0, pending: 0, resolved: 0, closed: 0, unassigned: 0, urgent: 0
  });

  // Subscribe to real tickets (used for the recent-activity feed only)
  useEffect(() => {
    if (!userProfile) return;
    const unsub = ticketService.subscribeToTickets(setTickets);
    return () => unsub();
  }, [userProfile]);

  // Authoritative metrics are computed server-side in SQL so they match
  // production exactly rather than being filtered/mocked in the client.
  useEffect(() => {
    if (!userProfile) return;
    let active = true;
    const loadStats = async () => {
      try {
        const token = getSessionToken();
        const res = await fetch('/api/stats/tickets', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok && active) {
          setServerStats(await res.json());
        }
      } catch {
        /* transient; will retry on next dependency change */
      }
    };
    loadStats();
    const intervalId = setInterval(loadStats, 10000);
    return () => { active = false; clearInterval(intervalId); };
  }, [userProfile]);

  // Derive display KPIs strictly from authoritative server counts.
  const stats = useMemo(() => {
    const resolved = serverStats.resolved + serverStats.closed;
    const total = serverStats.total || 0;
    const resolutionRate = total > 0 ? `${Math.round((resolved / total) * 1000) / 10}%` : '0%';
    return {
      resolutionRate,
      avgResolutionTime: '—',
      resolvedCount: resolved,
      openCount: serverStats.open,
      pendingCount: serverStats.pending,
      unassignedCount: serverStats.unassigned,
      overdueCount: serverStats.urgent,
      satisfaction: '—',
      aiSuggestionsCount: tickets.filter(t => !!(t as any).aiSummary).length
    };
  }, [serverStats, tickets]);

  // Recent activity is sourced exclusively from real tickets (no mock blending).
  const recentTicketsList = useMemo(() => {
    return tickets.slice(0, 5).map((t) => {
      const ticketAny = t as any;
      const category = ticketAny.category || t.team || 'General';
      let CatIcon = Mail;
      let colors = 'bg-[#EFF6FF] text-[#2563EB] border-[#DBEAFE]';
      if (category === 'Network' || category === 'engineering') {
        CatIcon = Radio;
        colors = 'bg-[#FDF2F8] text-[#DB2777] border-[#FCE7F3]';
      } else if (category === 'Account' || category === 'Security' || category === 'Vault' || category === 'legal') {
        CatIcon = Lock;
        colors = 'bg-[#FAF5FF] text-[#7C3AED] border-[#F3E8FF]';
      } else if (category === 'Storage') {
        CatIcon = HardDrive;
        colors = 'bg-[#ECFDF5] text-[#059669] border-[#D1FAE5]';
      } else if (category === 'Software') {
        CatIcon = Terminal;
        colors = 'bg-[#FFFBEB] text-[#D97706] border-[#FEF3C7]';
      }

      let priorityColor = 'bg-[#FFEDD5] text-[#D97706]';
      if (t.priority === 'urgent' || t.priority === 'high') {
        priorityColor = 'bg-[#FEE2E2] text-[#DC2626]';
      } else if (t.priority === 'low') {
        priorityColor = 'bg-[#ECFDF5] text-[#059669]';
      }

      return {
        id: t.id,
        isReal: true,
        subject: t.subject,
        category,
        priority: t.priority || 'medium',
        time: 'Recently',
        icon: CatIcon,
        iconColor: colors,
        priorityColor
      };
    });
  }, [tickets]);

  return (
    <div id="dashboard-scroller" className="flex-1 overflow-y-auto min-h-0 bg-[#F8F9FA] custom-scrollbar">
      <CreateTicketDialog 
        isOpen={isNewTicketOpen} 
        onClose={() => setIsNewTicketOpen(false)} 
      />

      <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto pb-20">
        
        {/* Dashboard Title Header & Filter Row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-[#202124] flex items-center gap-2">
              {t('dashboard.welcome', 'Welcome back, {{name}}! 👋').replace('{{name}}', userProfile?.name || 'Operator')}
            </h1>
            <p className="text-sm text-[#5F6368] font-medium">
              {t('dashboard.subtitle', "Here's what's happening with your support operations today.")}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant="outline" 
              className="bg-white border-gray-200 text-gray-700 h-10 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all"
            >
              <Calendar className="w-4 h-4 text-gray-500" />
              May 12 – May 18, 2025
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </Button>
            
            <Button 
              variant="outline" 
              className="bg-white border-gray-200 text-gray-700 h-10 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all"
            >
              <ArrowUpRight className="w-4 h-4 text-gray-500" />
              {t('dashboard.exportReport', 'Export Report')}
            </Button>
          </div>
        </div>

        {/* Five Key Metric Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          
          {/* 1. Resolution Rate */}
          <CardWrapper>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#E8F0FE] text-[#1A73E8] border border-[#D2E3FC] flex items-center justify-center">
                  <TrendingUp className="w-4.5 h-4.5" />
                </div>
                <span className="text-[13px] font-semibold text-[#5F6368]">{t('dashboard.resolutionRate', 'Resolution Rate')}</span>
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-[26px] font-bold text-[#202124] tracking-tight">{stats.resolutionRate}</span>
              <span className="text-xs font-bold text-[#137333] flex items-center gap-0.5">
                ↗ 12.5%
              </span>
            </div>
            <p className="text-[11px] text-[#80868B] mt-1 font-medium">{t('dashboard.vsLast7Days', 'vs last 7 days')}</p>
          </CardWrapper>

          {/* 2. Avg Resolution Time */}
          <CardWrapper>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#F3E8FF] text-[#7C3AED] border border-[#F3E8FF] flex items-center justify-center">
                  <Clock className="w-4.5 h-4.5" />
                </div>
                <span className="text-[13px] font-semibold text-[#5F6368]">{t('dashboard.avgResolutionTime', 'Avg. Resolution Time')}</span>
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-[26px] font-bold text-[#202124] tracking-tight">{stats.avgResolutionTime}</span>
              <span className="text-xs font-bold text-[#137333] flex items-center gap-0.5">
                ↘ 18.3%
              </span>
            </div>
            <p className="text-[11px] text-[#80868B] mt-1 font-medium">{t('dashboard.vsLast7Days', 'vs last 7 days')}</p>
          </CardWrapper>

          {/* 3. Tickets Resolved */}
          <CardWrapper>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6] flex items-center justify-center">
                  <CheckCircle2 className="w-4.5 h-4.5" />
                </div>
                <span className="text-[13px] font-semibold text-[#5F6368]">{t('dashboard.ticketsResolved', 'Tickets Resolved')}</span>
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-[26px] font-bold text-[#202124] tracking-tight">{stats.resolvedCount}</span>
              <span className="text-xs font-bold text-[#137333] flex items-center gap-0.5">
                ↗ 8.1%
              </span>
            </div>
            <p className="text-[11px] text-[#80868B] mt-1 font-medium">{t('dashboard.vsLast7Days', 'vs last 7 days')}</p>
          </CardWrapper>

          {/* 4. Customer Satisfaction */}
          <CardWrapper>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#FEF3C7] text-[#D97706] border-[#FEF3C7] flex items-center justify-center">
                  <Smile className="w-4.5 h-4.5" />
                </div>
                <span className="text-[13px] font-semibold text-[#5F6368]">{t('dashboard.customerSatisfaction', 'Customer Satisfaction')}</span>
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-[26px] font-bold text-[#202124] tracking-tight">{stats.satisfaction}</span>
              <span className="text-xs font-bold text-[#137333] flex items-center gap-0.5">
                ↗ 0.3
              </span>
            </div>
            <p className="text-[11px] text-[#80868B] mt-1 font-medium">{t('dashboard.vsLast7Days', 'vs last 7 days')}</p>
          </CardWrapper>

          {/* 5. AI Suggestions */}
          <CardWrapper>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#FCE7F3] text-[#DB2777] border border-[#FCE7F3] flex items-center justify-center">
                  <Sparkles className="w-4.5 h-4.5" />
                </div>
                <span className="text-[13px] font-semibold text-[#5F6368]">{t('dashboard.aiSuggestions', 'AI Suggestions')}</span>
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-[26px] font-bold text-[#202124] tracking-tight">{stats.aiSuggestionsCount}</span>
              <span className="text-xs font-bold text-[#137333] flex items-center gap-0.5">
                ↗ 23.7%
              </span>
            </div>
            <p className="text-[11px] text-[#80868B] mt-1 font-medium">{t('dashboard.vsLast7Days', 'vs last 7 days')}</p>
          </CardWrapper>

        </div>

        {/* Secondary Metric Badges / Sub-KPIs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <BadgeCard border="border-l-4 border-l-[#2563EB] bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50/60 text-[#2563EB] flex items-center justify-center">
                <Radio className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{t('dashboard.open', 'Open')}</span>
                <span className="text-xl font-bold text-gray-900 leading-tight">{stats.openCount}</span>
                <span className="text-[11px] text-[#1A73E8] font-medium">{t('dashboard.needsAttention', 'Needs attention')}</span>
              </div>
            </div>
          </BadgeCard>

          <BadgeCard border="border-l-4 border-l-[#FFA000] bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50/60 text-[#FFA000] flex items-center justify-center">
                <Clock className="w-4.5 h-4.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{t('dashboard.pending', 'Pending')}</span>
                <span className="text-xl font-bold text-gray-900 leading-tight">{stats.pendingCount}</span>
                <span className="text-[11px] text-[#FFA000] font-medium">{t('dashboard.waitingResponse', 'Waiting response')}</span>
              </div>
            </div>
          </BadgeCard>

          <BadgeCard border="border-l-4 border-l-[#DC2626] bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50/60 text-[#DC2626] flex items-center justify-center">
                <Users className="w-4.5 h-4.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{t('dashboard.unassigned', 'Unassigned')}</span>
                <span className="text-xl font-bold text-gray-900 leading-tight">{stats.unassignedCount}</span>
                <span className="text-[11px] text-[#DC2626] font-medium">{t('dashboard.requiresAssignment', 'Requires assignment')}</span>
              </div>
            </div>
          </BadgeCard>

          <BadgeCard border="border-l-4 border-l-[#D93025] bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50/60 text-[#D93025] flex items-center justify-center">
                <AlertTriangle className="w-4.5 h-4.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{t('dashboard.overdue', 'Overdue')}</span>
                <span className="text-xl font-bold text-gray-900 leading-tight">{stats.overdueCount}</span>
                <span className="text-[11px] text-[#D93025] font-medium">{t('dashboard.urgent', 'Urgent')}</span>
              </div>
            </div>
          </BadgeCard>

        </div>

        {/* Central Dashboard Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Area (Trends, Recent, Quick Actions) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Ticket Trends Chart Card */}
            <div className="bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-[16px] font-bold text-[#202124]">{t('dashboard.ticketTrends', 'Ticket Trends')}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button className="bg-[#F8F9FA] border border-gray-250 text-gray-600 rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 hover:bg-gray-100 transition-all">
                    {t('dashboard.incoming', 'Incoming')}
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  <button className="bg-[#F8F9FA] border border-gray-250 text-gray-600 rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 hover:bg-gray-100 transition-all">
                    {t('dashboard.days7', '7 Days')}
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="h-[210px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={TRENDS_CHART_DATA} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="trendsColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1A73E8" stopOpacity={0.16}/>
                          <stop offset="95%" stopColor="#1A73E8" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ECEFF1" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#80868B', fontWeight: 500 }} 
                        dy={6}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#80868B', fontWeight: 500 }} 
                        dx={-8}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '12px', 
                          border: '1px solid #ECEFF1', 
                          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                          padding: '10px 14px',
                          background: '#FFFFFF'
                        }}
                        itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#1A73E8' }}
                        labelStyle={{ fontSize: '10px', color: '#80868B', marginBottom: '3px' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="tickets" 
                        stroke="#1A73E8" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#trendsColor)" 
                        activeDot={{ r: 6, stroke: '#FFFFFF', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Chart Footer stats matches exactly */}
                <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-gray-100 text-center">
                  <div>
                    <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">{t('dashboard.totalTickets', 'Total Tickets')}</span>
                    <div className="flex items-center justify-center gap-1.5 mt-1">
                      <span className="text-[17px] font-bold text-gray-900 leading-none">324</span>
                      <span className="text-[11px] font-bold text-green-600">↗ 12.5%</span>
                    </div>
                  </div>
                  <div className="border-x border-gray-100">
                    <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">{t('dashboard.incoming', 'Incoming')}</span>
                    <div className="flex items-center justify-center gap-1.5 mt-1">
                      <span className="text-[17px] font-bold text-gray-900 leading-none">189</span>
                      <span className="text-[11px] font-bold text-green-600">↗ 8.3%</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">{t('tickets.solved', 'Resolved')}</span>
                    <div className="flex items-center justify-center gap-1.5 mt-1">
                      <span className="text-[17px] font-bold text-gray-900 leading-none">247</span>
                      <span className="text-[11px] font-bold text-green-600">↗ 15.2%</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Recent Tickets Section */}
            <div className="bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-[#202124]">{t('dashboard.recentTickets', 'Recent Tickets')}</h3>
                <button 
                  onClick={() => navigate('/tickets')}
                  className="text-xs font-bold text-[#1A73E8] hover:underline"
                >
                  {t('dashboard.viewAll', 'View All')}
                </button>
              </div>

              <div className="divide-y divide-gray-100">
                {recentTicketsList.map((ticket, idx) => {
                  const IconComp = ticket.icon;
                  return (
                    <div 
                      key={ticket.id || idx} 
                      onClick={() => ticket.id && navigate(`/tickets?id=${ticket.id}`)}
                      className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/60 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border shrink-0", ticket.iconColor)}>
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="text-[13px] font-bold text-gray-900 truncate group-hover:text-[#1A73E8] transition-colors pr-2">
                            {ticket.subject}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[#1A73E8] bg-[#E8F0FE] px-2 py-0.5 rounded-md">
                              {ticket.id || `#TKT-${idx}`}
                            </span>
                            <span className="text-xs text-[#5F6368] font-medium">
                              • {ticket.category}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <Badge className={cn("text-[10px] font-bold uppercase tracking-wider border-none px-2.5 h-6 rounded-full", ticket.priorityColor)}>
                          {ticket.priority}
                        </Badge>
                        <span className="text-xs text-[#80868B] font-medium w-16 text-right">
                          {ticket.time}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Quick Access Cards Section */}
            <div className="space-y-3">
              <h4 className="text-[13px] font-bold text-[#202124]">{t('dashboard.quickAccess', 'Quick Access')}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <QuickCard 
                  onClick={() => setIsNewTicketOpen(true)}
                  icon={Plus} 
                  iconBg="bg-blue-50 text-[#1A73E8]"
                  title={t('actions.createTicket', 'Create Ticket')} 
                  description={t('dashboard.createTicketDesc', 'Submit a new request')} 
                />

                <QuickCard 
                  onClick={() => navigate('/kb')}
                  icon={BookOpen} 
                  iconBg="bg-indigo-50 text-[#4F46E5]"
                  title={t('dashboard.searchKb', 'Search Knowledge Base')} 
                  description={t('dashboard.searchKbDesc', 'Find solutions')} 
                />

                <QuickCard 
                  onClick={() => navigate('/credentials')}
                  icon={Lock} 
                  iconBg="bg-violet-50 text-[#7C3AED]"
                  title={t('dashboard.geistVault', 'GeistVault')} 
                  description={t('dashboard.geistVaultDesc', 'Store and retrieve system secrets')} 
                />

                <QuickCard 
                  onClick={() => navigate('/insights')}
                  icon={Bot} 
                  iconBg="bg-pink-50 text-[#DB2777]"
                  title={t('dashboard.aiAssistant', 'AI Assistant')} 
                  description={t('dashboard.aiAssistantDesc', 'Get AI-powered help')} 
                />

              </div>
            </div>

          </div>

          {/* Right Area (AI Insights, KB Health) */}
          <div className="space-y-6">
            
            {/* AI Insights Card */}
            <div className="bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4.5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold text-[#202124]">{t('dashboard.aiInsights', 'AI Insights')}</span>
                  <span className="bg-[#E8F0FE] text-[#1A73E8] text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider">Beta</span>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <div className="flex items-center gap-2 text-[#202124]">
                    <Search className="w-4 h-4 text-gray-500" />
                    <h4 className="text-[13px] font-bold">{t('dashboard.problemDetection', 'Problem Detection')}</h4>
                  </div>
                  <p className="text-[12px] text-gray-500 font-medium mt-1.5 leading-relaxed">
                    {t('dashboard.aiProblemDetectionDesc', 'AI has identified 3 recurring issues that may require your attention.')}
                  </p>
                </div>

                <div className="space-y-4">
                  
                  <InsightItem 
                    title={t('dashboard.vpnConnectionFailures', 'VPN Connection Failures')} 
                    impact={t('dashboard.highImpact', 'High Impact')} 
                    count={t('dashboard.similarTickets', '{{count}} similar tickets').replace('{{count}}', '23')} 
                    badgeColor="bg-[#FEE2E2] text-[#DC2626]" 
                    onClick={() => navigate('/insights')} 
                  />

                  <InsightItem 
                    title={t('dashboard.emailSyncProblems', 'Email Sync Problems')} 
                    impact={t('dashboard.mediumImpact', 'Medium')} 
                    count={t('dashboard.similarTickets', '{{count}} similar tickets').replace('{{count}}', '18')} 
                    badgeColor="bg-[#FFEDD5] text-[#D97706]" 
                    onClick={() => navigate('/insights')} 
                  />

                  <InsightItem 
                    title={t('dashboard.passwordResetDelays', 'Password Reset Delays')} 
                    impact={t('dashboard.lowImpact', 'Low')} 
                    count={t('dashboard.similarTickets', '{{count}} similar tickets').replace('{{count}}', '15')} 
                    badgeColor="bg-[#ECFDF5] text-[#059669]" 
                    onClick={() => navigate('/insights')} 
                  />

                </div>

                <Button 
                  onClick={() => navigate('/insights')}
                  className="w-full h-11 bg-[#F1F3F4] text-gray-800 hover:bg-gray-200 border-none font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                  {t('dashboard.viewAllInsights', 'View All Insights →')}
                </Button>
              </div>
            </div>

            {/* Knowledge Base Health Card */}
            <div className="bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-gray-500" />
                  <span className="text-[15px] font-bold text-[#202124]">{t('dashboard.kbHealth', 'Knowledge Base Health')}</span>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between gap-4">
                  {/* Circular Gauge Ring */}
                  <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                    <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
                      <circle 
                        cx="50" 
                        cy="50" 
                        r="40" 
                        className="text-gray-100" 
                        strokeWidth="10" 
                        stroke="currentColor" 
                        fill="transparent" 
                      />
                      <circle 
                        cx="50" 
                        cy="50" 
                        r="40" 
                        className="text-[#10B981]" 
                        strokeWidth="10" 
                        stroke="currentColor" 
                        fill="transparent" 
                        strokeDasharray="251.2"
                        strokeDashoffset="32.65" // 87% progress ring (251.2 * 0.13)
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-black text-gray-800">87%</span>
                    </div>
                  </div>

                  {/* Healthy details */}
                  <div className="space-y-1">
                    <span className="text-[15px] font-bold text-[#10B981] flex items-center gap-1">
                      {t('dashboard.wellMaintained', 'Well Maintained')}
                    </span>
                    <p className="text-[11px] text-[#137333] font-bold">
                      ↗ 5% {t('dashboard.vsLastMonth', 'vs last month')}
                    </p>
                  </div>
                </div>

                <Button 
                  onClick={() => navigate('/kb')}
                  className="w-full h-11 bg-[#F1F3F4] text-gray-800 hover:bg-gray-200 border-none font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                  {t('dashboard.viewKbAnalytics', 'View KB Analytics →')}
                </Button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

// Highly stylized White Inner wrapper
function CardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-150 p-4.5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
      {children}
    </div>
  );
}

// Side Badge card wrapper
function BadgeCard({ border, children }: { border: string; children: React.ReactNode }) {
  return (
    <div className={cn("p-5 rounded-2xl border border-gray-150 shadow-sm transition-all hover:translate-y-[-2px]", border)}>
      {children}
    </div>
  );
}

// Quick card helper
function QuickCard({ onClick, icon: IconComp, iconBg, title, description }: {
  onClick: () => void;
  icon: any;
  iconBg: string;
  title: string;
  description: string;
}) {
  return (
    <div 
      onClick={onClick}
      className="bg-white border border-gray-150 p-4 rounded-xl shadow-sm hover:border-[#1A73E8] hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between h-32"
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-bold border border-transparent shrink-0", iconBg)}>
        <IconComp className="w-5 h-5" />
      </div>
      <div>
        <h5 className="text-xs font-bold text-gray-900 truncate mt-1 group-hover:text-[#1A73E8] transition-colors">{title}</h5>
        <p className="text-[10px] text-[#5F6368] font-medium leading-relaxed truncate mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// AI Insight List component
function InsightItem({ title, impact, count, badgeColor, onClick }: {
  title: string;
  impact: string;
  count: string;
  badgeColor: string;
  onClick: () => void;
}) {
  return (
    <div 
      onClick={onClick}
      className="border-b border-gray-100 pb-3 last:border-0 last:pb-0 cursor-pointer group"
    >
      <div className="flex items-center justify-between gap-2">
        <h5 className="text-[12.5px] font-bold text-gray-900 group-hover:text-[#1A73E8] transition-colors truncate">
          {title}
        </h5>
        <Badge className={cn("text-[9px] font-extrabold uppercase px-2 h-5 shrink-0 rounded border-none tracking-widest", badgeColor)}>
          {impact}
        </Badge>
      </div>
      <span className="text-[11px] text-[#5F6368] font-medium leading-none block mt-1">{count}</span>
    </div>
  );
}
