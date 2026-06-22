import {
  UserRound,
  UserPlus,
  PlusCircle,
  Clock,
  GraduationCap,
  AlertTriangle,
  AlertCircle,
  Bug,
  List,
  Zap,
  Sparkles,
  Lightbulb,
  TrendingUp,
  Inbox,
  type LucideIcon,
} from 'lucide-react';

export interface SidebarIndicator {
  label: 'help' | 'new' | 'pending' | 'urgent';
  color: string;
}

export interface SidebarItemConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  indicator?: SidebarIndicator;
}

export interface SidebarGroupConfig {
  id: string;
  label: string;
  items: SidebarItemConfig[];
}

export const TICKETS_SIDEBAR_GROUPS: SidebarGroupConfig[] = [
  {
    id: 'support',
    label: 'Support',
    items: [
      {
        id: 'my_queue',
        label: 'My Queue',
        icon: UserRound,
        indicator: { label: 'help', color: 'bg-red-500 text-white font-black animate-pulse shadow shadow-red-500/50' },
      },
      { id: 'unassigned', label: 'Unassigned', icon: UserPlus },
      {
        id: 'new_tickets',
        label: 'New Tickets',
        icon: PlusCircle,
        indicator: { label: 'new', color: 'bg-rose-500 text-white font-bold' },
      },
      {
        id: 'waiting_review',
        label: 'Waiting Review',
        icon: Clock,
        indicator: { label: 'pending', color: 'bg-amber-400 text-black font-semibold' },
      },
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    items: [
      { id: 'vip_customers', label: 'VIP Customers', icon: GraduationCap },
      { id: 'escalations', label: 'Escalations', icon: AlertTriangle },
      {
        id: 'sla_risk',
        label: 'SLA Risk',
        icon: AlertCircle,
        indicator: { label: 'urgent', color: 'bg-amber-500 text-black font-extrabold animate-pulse' },
      },
    ],
  },
  {
    id: 'engineering',
    label: 'Engineering',
    items: [
      { id: 'linked_bugs', label: 'Linked Bugs', icon: Bug },
      { id: 'bug_backlog', label: 'Bug Backlog', icon: List },
      { id: 'incidents', label: 'Incidents', icon: Zap },
    ],
  },
  {
    id: 'ai_labs',
    label: 'AI Labs',
    items: [
      { id: 'ai_inbox', label: 'AI Inbox', icon: Inbox },
      { id: 'suggestions', label: 'Suggestions', icon: Sparkles },
      { id: 'trend_analytics', label: 'Trend Analytics', icon: TrendingUp },
    ],
  },
];

export const TICKETS_SIDEBAR_GROUP_ORDER = ['support', 'customers', 'engineering', 'ai_labs'];
