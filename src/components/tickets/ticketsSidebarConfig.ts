import {
  User,
  CalendarClock,
  MessageSquareReply,
  Star,
  PauseCircle,
  ShieldCheck,
  UserPlus,
  PlusCircle,
  Clock,
  List,
  CircleDot,
  Loader2,
  Hourglass,
  Code2,
  Building2,
  CheckCircle2,
  Archive,
  AlertTriangle,
  AlertCircle,
  LifeBuoy,
  Frown,
  TrendingUp,
  Copy,
  BookOpen,
  MailWarning,
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
  /** High-priority AI queue — preserve red accent styling */
  highlight?: boolean;
}

export interface SidebarGroupConfig {
  id: string;
  label: string;
  items: SidebarItemConfig[];
}

/** All navigable view ids with metadata for favorites / manage UI */
export const ALL_TICKETS_VIEW_ITEMS: SidebarItemConfig[] = [
  { id: 'assigned_me', label: 'My Tickets', icon: User },
  { id: 'due_today', label: 'Due Today', icon: CalendarClock },
  { id: 'waiting_my_response', label: 'Awaiting My Reply', icon: MessageSquareReply },
  { id: 'watching', label: 'Watching', icon: Star },
  { id: 'my_paused', label: 'Paused', icon: PauseCircle },
  { id: 'my_qs', label: 'In QA', icon: ShieldCheck },
  { id: 'unassigned', label: 'Unassigned', icon: UserPlus },
  { id: 'new_tickets', label: 'New Tickets', icon: PlusCircle, indicator: { label: 'new', color: 'bg-rose-500 text-white font-bold' } },
  { id: 'waiting_review', label: 'Waiting Review', icon: Clock, indicator: { label: 'pending', color: 'bg-amber-400 text-black font-semibold' } },
  { id: 'team_all_open', label: 'All Open Tickets', icon: List },
  { id: 'status_open', label: 'Open', icon: CircleDot },
  { id: 'status_pending', label: 'In Progress', icon: Loader2 },
  { id: 'status_paused', label: 'Paused', icon: PauseCircle },
  { id: 'status_qs', label: 'In QA', icon: ShieldCheck },
  { id: 'status_waiting_customer', label: 'Waiting on Customer', icon: Hourglass },
  { id: 'status_waiting_dev', label: 'Waiting on Engineering', icon: Code2 },
  { id: 'status_waiting_vendor', label: 'Waiting on Vendor', icon: Building2 },
  { id: 'status_resolved', label: 'Resolved', icon: CheckCircle2 },
  { id: 'status_closed', label: 'Closed', icon: Archive },
  { id: 'spam', label: 'Spam', icon: MailWarning },
  { id: 'escalations', label: 'Escalations', icon: AlertTriangle },
  { id: 'sla_risk', label: 'SLA Risk', icon: AlertCircle, indicator: { label: 'urgent', color: 'bg-amber-500 text-black font-extrabold animate-pulse' } },
  {
    id: 'help_requested',
    label: 'Help Requested',
    icon: LifeBuoy,
    indicator: { label: 'help', color: 'bg-red-500 text-white font-black animate-pulse shadow shadow-red-500/50' },
    highlight: true,
  },
  { id: 'negative_sentiment', label: 'Negative Sentiment', icon: Frown },
  { id: 'potential_escalations', label: 'Potential Escalations', icon: TrendingUp },
  { id: 'duplicates_detected', label: 'Duplicates Detected', icon: Copy },
  { id: 'kb_suggestion', label: 'KB Suggestion Available', icon: BookOpen },
];

const viewMap = new Map(ALL_TICKETS_VIEW_ITEMS.map((item) => [item.id, item]));

export function getSidebarViewItem(viewId: string): SidebarItemConfig | undefined {
  if (viewId.startsWith('custom:')) {
    return { id: viewId, label: viewId.replace('custom:', ''), icon: Star };
  }
  return viewMap.get(viewId);
}

export const TICKETS_SIDEBAR_GROUPS: SidebarGroupConfig[] = [
  {
    id: 'my_work',
    label: 'My Work',
    items: [
      { id: 'assigned_me', label: 'My Tickets', icon: User },
      { id: 'due_today', label: 'Due Today', icon: CalendarClock },
      { id: 'waiting_my_response', label: 'Awaiting My Reply', icon: MessageSquareReply },
      { id: 'watching', label: 'Watching', icon: Star },
      { id: 'my_paused', label: 'Paused', icon: PauseCircle },
      { id: 'my_qs', label: 'In QA', icon: ShieldCheck },
    ],
  },
  {
    id: 'inbox',
    label: 'Inbox',
    items: [
      { id: 'unassigned', label: 'Unassigned', icon: UserPlus },
      { id: 'new_tickets', label: 'New Tickets', icon: PlusCircle, indicator: { label: 'new', color: 'bg-rose-500 text-white font-bold' } },
      { id: 'waiting_review', label: 'Waiting Review', icon: Clock, indicator: { label: 'pending', color: 'bg-amber-400 text-black font-semibold' } },
      { id: 'team_all_open', label: 'All Open Tickets', icon: List },
    ],
  },
  {
    id: 'status',
    label: 'Status',
    items: [
      { id: 'status_open', label: 'Open', icon: CircleDot },
      { id: 'status_pending', label: 'In Progress', icon: Loader2 },
      { id: 'status_paused', label: 'Paused', icon: PauseCircle },
      { id: 'status_qs', label: 'In QA', icon: ShieldCheck },
      { id: 'status_waiting_customer', label: 'Waiting on Customer', icon: Hourglass },
      { id: 'status_waiting_dev', label: 'Waiting on Engineering', icon: Code2 },
      { id: 'status_waiting_vendor', label: 'Waiting on Vendor', icon: Building2 },
      { id: 'status_resolved', label: 'Resolved', icon: CheckCircle2 },
      { id: 'status_closed', label: 'Closed', icon: Archive },
      { id: 'spam', label: 'Spam', icon: MailWarning },
    ],
  },
  {
    id: 'customers_sla',
    label: 'Customers / SLA',
    items: [
      { id: 'escalations', label: 'Escalations', icon: AlertTriangle },
      { id: 'sla_risk', label: 'SLA Risk', icon: AlertCircle, indicator: { label: 'urgent', color: 'bg-amber-500 text-black font-extrabold animate-pulse' } },
    ],
  },
  {
    id: 'ai_views',
    label: 'AI Views',
    items: [
      {
        id: 'help_requested',
        label: 'Help Requested',
        icon: LifeBuoy,
        indicator: { label: 'help', color: 'bg-red-500 text-white font-black animate-pulse shadow shadow-red-500/50' },
        highlight: true,
      },
      { id: 'negative_sentiment', label: 'Negative Sentiment', icon: Frown },
      { id: 'potential_escalations', label: 'Potential Escalations', icon: TrendingUp },
      { id: 'duplicates_detected', label: 'Duplicates Detected', icon: Copy },
      { id: 'kb_suggestion', label: 'KB Suggestion Available', icon: BookOpen },
    ],
  },
];

export const FAVORITES_SECTION_ID = 'favorites';

/** Compact Linear-style nav — view ids stay the same so routing/filters are unchanged. */
export const WAITING_QUEUE_VIEW_IDS = [
  'status_waiting_customer',
  'status_waiting_dev',
  'status_waiting_vendor',
] as const;

export const ARCHIVE_VIEW_IDS = ['status_resolved', 'status_closed'] as const;

export const COMPACT_PRIMARY_VIEWS: SidebarItemConfig[] = [
  { id: 'assigned_me', label: 'Assigned to me', icon: User },
  { id: 'unassigned', label: 'Unassigned', icon: UserPlus },
  { id: 'team_all_open', label: 'All tickets', icon: List },
];

export const COMPACT_URGENCY_VIEWS: SidebarItemConfig[] = [
  { id: 'sla_risk', label: 'SLA Risk', icon: AlertCircle },
  {
    id: 'help_requested',
    label: 'Help Requested',
    icon: LifeBuoy,
    indicator: { label: 'help', color: 'bg-rose-100 text-rose-700' },
    highlight: true,
  },
  { id: 'escalations', label: 'Escalations', icon: AlertTriangle },
];

export const COMPACT_STATUS_VIEWS: SidebarItemConfig[] = [
  { id: 'status_open', label: 'Open', icon: CircleDot },
  { id: 'status_pending', label: 'In Progress', icon: Loader2 },
];

const COMPACT_INLINE_IDS = new Set<string>([
  ...COMPACT_PRIMARY_VIEWS.map((item) => item.id),
  ...COMPACT_URGENCY_VIEWS.map((item) => item.id),
  ...COMPACT_STATUS_VIEWS.map((item) => item.id),
  ...WAITING_QUEUE_VIEW_IDS,
  ...ARCHIVE_VIEW_IDS,
]);

export const COMPACT_MORE_VIEW_IDS = [
  'watching',
  'due_today',
  'status_qs',
  'status_paused',
  'spam',
] as const;

export function getCompactOverflowViews(): SidebarItemConfig[] {
  return ALL_TICKETS_VIEW_ITEMS.filter(
    (item) => !COMPACT_INLINE_IDS.has(item.id) && !(COMPACT_MORE_VIEW_IDS as readonly string[]).includes(item.id),
  );
}
