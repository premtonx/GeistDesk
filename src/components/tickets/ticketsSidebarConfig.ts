import {
  UserPlus,
  PlusCircle,
  Clock,
  GraduationCap,
  AlertTriangle,
  AlertCircle,
  List,
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
    id: 'inbox',
    label: 'Inbox',
    items: [
      { id: 'team_all_open', label: 'All', icon: List },
      {
        id: 'unassigned',
        label: 'Unassigned',
        icon: UserPlus,
        indicator: { label: 'help', color: 'bg-red-500 text-white font-black animate-pulse shadow shadow-red-500/50' },
      },
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
    id: 'customers_sla',
    label: 'Customers / SLA',
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
];

export const TICKETS_SIDEBAR_GROUP_ORDER = ['inbox', 'customers_sla'];
