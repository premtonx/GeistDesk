import type { MutableRefObject, MouseEvent } from 'react';
import {
  AlertTriangle, Angry, Box, Building2, CheckCircle2, ChevronDown, ChevronLeft,
  ChevronRight, Clock, Frown, Globe, Hash, History, Link2, List, Mail, Meh,
  MessageCircleHeart, MessageSquare, MoreVertical, PhoneCall, RefreshCw, Settings2,
  Share2, SlidersHorizontal, Smile, Sparkles, Tag, Ticket, UserCheck, UserRound, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { redactPII } from '../../lib/ai/pii-shield';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '../ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';
import {
  ModulePageTabs, ModuleToolbar, ModuleToolbarSelect,
} from '../ui/module-page';
import { ModuleCreateButton } from '../ui/ModuleCreateButton';
import { TicketsQueueAiChip } from './TicketsQueueAiChip';
import { TicketsPageHeader } from './TicketsPageHeader';
import { TicketsEmptyState } from './TicketsEmptyState';
import { TicketDetailDrawer } from './TicketDetailDrawer';
import { TicketStatusChip, TicketPriorityChip, TicketAssigneeChip } from './TicketTableCells';
import { TicketsTableHeader } from './TicketsTableHeader';
import { getTicketTableGridClass, getTicketTableMinWidth, ticketTableRowClass } from './ticketTableLayout';
import { TicketsViewModeSelector, type TicketsLayoutMode } from './TicketsViewModeSelector';
import { TicketsKanbanBoard } from './TicketsKanbanBoard';
import { TicketsCardGrid } from './TicketsCardGrid';
import { useTranslation } from '../../lib/context/I18nContext';
import type { Ticket as TicketType, KBArticle, TicketStatus, TicketPriority } from '../../types';
import type { TicketQueueStats, TopStatusFilterId } from '../../lib/ticketViewFilters';

export interface TicketListViewProps {
  ticketQueueStats: TicketQueueStats;
  topStatusFilter: TopStatusFilterId;
  setTopStatusFilter: (f: TopStatusFilterId) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isFilterDrawerOpen: boolean;
  setIsFilterDrawerOpen: (open: boolean) => void;
  listSort: 'newest' | 'oldest' | 'priority';
  setListSort: (s: 'newest' | 'oldest' | 'priority') => void;
  layoutMode: TicketsLayoutMode;
  setLayoutMode: (m: TicketsLayoutMode) => void;
  openCreateTicket: () => void;
  tickets: TicketType[];
  filters: Record<string, any>;
  setFilters: (f: Record<string, any>) => void;
  user: { uid?: string; displayName?: string | null; email?: string | null } | null;
  handleViewChange: (view: string) => void;
  selectedTicketIds: string[];
  setSelectedTicketIds: (ids: string[]) => void;
  toggleSelectAll: () => void;
  toggleTicketSelection: (id: string) => void;
  headerCheckboxActive: boolean;
  handleInlineUpdate: (id: string, data: Partial<TicketType>) => void;
  handleTicketSelect: (id: string) => void;
  handleBulkUpdate: (updates: Partial<TicketType>) => Promise<void>;
  viewDensity: 'comfortable' | 'compact';
  setHoveredTicketId: (id: string | null) => void;
  mousePosRef: MutableRefObject<{ x: number; y: number }>;
  setPeekOffset: (pos: { x: number; y: number }) => void;
  handleMouseMove: (e: MouseEvent) => void;
  setIsMobileSidebarOpen: (open: boolean) => void;
  currentPage: number;
  setCurrentPage: (p: number | ((prev: number) => number)) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
  drawerTicketId: string | null;
  setDrawerTicketId: (id: string | null) => void;
  allTickets: TicketType[];
  kbArticles: KBArticle[];
  openFullTicketView: (id: string) => void;
  ticketService: { setPresence: (id: string, present: boolean) => void };
}

export function TicketListView(props: TicketListViewProps) {
  const { t } = useTranslation();
  const {
    ticketQueueStats,
    topStatusFilter,
    setTopStatusFilter,
    searchQuery,
    setSearchQuery,
    isFilterDrawerOpen,
    setIsFilterDrawerOpen,
    listSort,
    setListSort,
    layoutMode,
    setLayoutMode,
    openCreateTicket,
    tickets,
    filters,
    setFilters,
    user,
    handleViewChange,
    selectedTicketIds,
    setSelectedTicketIds,
    toggleSelectAll,
    toggleTicketSelection,
    headerCheckboxActive,
    handleInlineUpdate,
    handleTicketSelect,
    handleBulkUpdate,
    viewDensity,
    setHoveredTicketId,
    mousePosRef,
    setPeekOffset,
    handleMouseMove,
    setIsMobileSidebarOpen,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    drawerTicketId,
    setDrawerTicketId,
    allTickets,
    kbArticles,
    openFullTicketView,
    ticketService,
  } = props;

  const paginatedTickets = tickets.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalTicketsCount = tickets.length;
  const startIdx = totalTicketsCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalTicketsCount);
  const totalPages = Math.ceil(totalTicketsCount / pageSize) || 1;

  const formatTicketRef = (id: string) => {
    const upper = id.toUpperCase();
    if (upper.startsWith('TKT')) return `#${upper}`;
    return `#TKT-${id.slice(-4).toUpperCase()}`;
  };

  function stripHtml(html: string) {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'");
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#FAFBFC] relative">
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#FAFBFC] relative">
            <TicketsPageHeader
              stats={{
                open: ticketQueueStats.open,
                slaRisk: ticketQueueStats.slaRisk,
                pending: ticketQueueStats.pending,
                urgent: ticketQueueStats.urgent,
                unassigned: ticketQueueStats.unassigned,
              }}
              trailing={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="flex lg:hidden h-8 w-8 rounded-md shrink-0"
                  aria-label={t('tickets.detail.mobileMenu', 'Menu')}
                >
                  <List className="w-4 h-4" />
                </Button>
              }
            />
            <ModulePageTabs
              className="border-0 bg-transparent"
              tabs={[
                { id: 'all', label: `${t('tickets.allTickets', 'All')} ${ticketQueueStats.all}` },
                { id: 'open', label: `${t('tickets.open', 'Open')} ${ticketQueueStats.open}` },
                { id: 'pending', label: `${t('tickets.inProgress', 'In Progress')} ${ticketQueueStats.pending}` },
                { id: 'onhold', label: `${t('tickets.pendingOnHold', 'Pending')} ${ticketQueueStats.onhold}` },
                { id: 'urgent', label: `${t('tickets.priorityUrgent', 'Urgent')} ${ticketQueueStats.urgent}` },
                { id: 'unassigned', label: `${t('tickets.unassigned', 'Unassigned')} ${ticketQueueStats.unassigned}` },
              ]}
              activeId={topStatusFilter}
              onChange={(id) => setTopStatusFilter(id as typeof topStatusFilter)}
            />

            <ModuleToolbar
              searchPlaceholder={t('tickets.searchPlaceholderFull', 'Search tickets, customers, companies...')}
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              onFilterClick={() => setIsFilterDrawerOpen(true)}
              filterActive={isFilterDrawerOpen}
              sortControl={
                <div className="flex items-center gap-1 shrink-0">
                  <span className="hidden sm:inline text-[11px] font-medium text-slate-500">
                    {t('modulePage.sort', 'Sort')}:
                  </span>
                  <ModuleToolbarSelect
                    value={listSort}
                    onChange={(v) => setListSort(v as typeof listSort)}
                    aria-label={t('actions.sort', 'Sort')}
                  >
                    <option value="newest">{t('tickets.sortNewest', 'Newest')}</option>
                    <option value="oldest">{t('tickets.sortOldest', 'Oldest')}</option>
                    <option value="priority">{t('tickets.sortPriority', 'Priority')}</option>
                  </ModuleToolbarSelect>
                </div>
              }
              viewsSlot={
                <TicketsViewModeSelector value={layoutMode} onChange={setLayoutMode} />
              }
              createAction={
                <ModuleCreateButton
                  ariaLabelKey="actions.createTicket"
                  ariaLabelDefault="Create Ticket"
                  onClick={openCreateTicket}
                  iconOnly
                />
              }
            />
            <TicketsQueueAiChip
              id="tickets-ai-chip"
              ticketCount={tickets.length}
              criticalCount={ticketQueueStats.critical}
              vipCount={ticketQueueStats.vip}
              className="mb-1 mt-1"
            />

            {/* Filter Drawer Implementation using Sheet */}
            <Sheet open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
              <SheetContent side="right" className="w-[450px] sm:max-w-[450px] p-0 flex flex-col border-l border-border bg-card">
                <SheetHeader className="p-6 border-b bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-card rounded-xl shadow-sm border border-border">
                      <Settings2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <SheetTitle className="font-bold text-lg text-foreground uppercase tracking-tight">{t('tickets.filters.masterFilterList', 'Master-Filterliste')}</SheetTitle>
                      <SheetDescription className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{t('tickets.filters.geistGuardrails', 'GeistDesk Legal Guardrail & AI Controls')}</SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <ScrollArea className="flex-1 p-0">
                  <div className="p-8 space-y-10 pb-24">
                    {/* Category A: Standard Workflow */}
                    <div className="space-y-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-4 w-1 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                        <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{t('tickets.filters.catStandard', 'Kategorie A: Standard-Workflow')}</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-5">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                            <UserRound className="w-3.5 h-3.5 text-primary" /> {t('tickets.filters.agent', 'Agent (enthält)')}
                          </label>
                          <Select value={filters.agent} onValueChange={(v) => setFilters({...filters, agent: v})}>
                            <SelectTrigger className="w-full bg-muted/50 border-border rounded-xl h-11 font-medium">
                              <SelectValue placeholder={t('tickets.filters.selectAgent', 'Agent auswählen')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">{t('tickets.filters.anyAgent', 'Jeder Agent')}</SelectItem>
                              <SelectItem value={user?.displayName || "Me"}>{user?.displayName || "Me"} ({t('tickets.filters.you', 'Du')})</SelectItem>
                              <SelectItem value="Sarah Support">Sarah Support</SelectItem>
                              <SelectItem value="John Dev">John Dev</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-primary" /> Gruppe (Includes)
                          </label>
                          <Select value={filters.group} onValueChange={(v) => setFilters({...filters, group: v})}>
                            <SelectTrigger className="w-full bg-muted/50 border-border rounded-xl h-11 font-medium">
                              <SelectValue placeholder={t('tickets.filters.selectGroup', 'Gruppe auswählen')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">{t('tickets.filters.anyGroup', 'Jede Gruppe')}</SelectItem>
                              <SelectItem value="Support">{t('tickets.filters.supportTeam', 'Support-Team')}</SelectItem>
                              <SelectItem value="Engineering">{t('tickets.filters.engineering', 'Engineering')}</SelectItem>
                              <SelectItem value="Billing">{t('tickets.filters.billingSales', 'Billing & Vertrieb')}</SelectItem>
                              <SelectItem value="Legal">{t('tickets.filters.legalCompliance', 'Recht & Compliance')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> {t('tickets.filters.status', 'Status')}
                            </label>
                            <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
                              <SelectTrigger className="w-full bg-muted/50 border-border rounded-xl h-11 font-bold">
                                <SelectValue placeholder={t('tickets.filters.status', 'Status')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="any">{t('tickets.filters.any', 'Alle')}</SelectItem>
                                {['New', 'Open', 'Pending', 'On-Hold', 'Solved', 'Closed'].map(s => (
                                  <SelectItem key={s} value={s.toLowerCase()}>{t(`tickets.status.${s.toLowerCase()}`, s)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-primary" /> {t('tickets.filters.priority', 'Priorität')}
                            </label>
                            <Select value={filters.priority} onValueChange={(v) => setFilters({...filters, priority: v})}>
                              <SelectTrigger className="w-full bg-muted/50 border-border rounded-xl h-11 font-bold">
                                <SelectValue placeholder={t('tickets.filters.priority', 'Priorität')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="any">{t('tickets.filters.any', 'Alle')}</SelectItem>
                                {['Urgent', 'High', 'Medium', 'Low'].map(p => (
                                  <SelectItem key={p} value={p.toLowerCase()}>{t(`tickets.priority.${p.toLowerCase()}`, p)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                            <Hash className="w-3.5 h-3.5 text-primary" /> {t('tickets.filters.type', 'Typ')}
                          </label>
                          <Select value={filters.type} onValueChange={(v) => setFilters({...filters, type: v})}>
                            <SelectTrigger className="w-full bg-muted/50 border-border rounded-xl h-11 font-medium">
                              <SelectValue placeholder={t('tickets.filters.selectType', 'Typ auswählen')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">{t('tickets.filters.anyType', 'Jeder Typ')}</SelectItem>
                              {['Question', 'Incident', 'Problem', 'Feature Request'].map(typeOpt => (
                                <SelectItem key={typeOpt} value={typeOpt.toLowerCase()}>{t(`tickets.typeLabels.${typeOpt.toLowerCase().replace(' ', '_')}`, typeOpt)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5 text-primary" /> {t('tickets.filters.tags', 'Tags')}
                          </label>
                          <div className="relative group/tag">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <Input 
                              placeholder={t('tickets.filters.searchTags', 'Nach bestimmten Labels suchen...')} 
                              className="bg-muted/50 border-border rounded-xl pl-9 h-11 text-sm font-medium focus:bg-card transition-all"
                              value={filters.tags === 'any' ? '' : filters.tags} 
                              onChange={(e) => setFilters({...filters, tags: e.target.value || 'any'})} 
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Category B: AI-Enhanced */}
                    <div className="space-y-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-4 w-1 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{t('tickets.filters.catAi', 'Kategorie B: KI-gestützt (Contino)')}</h4>
                      </div>
                      <div className="space-y-5">
                        <div className="space-y-3">
                          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                            <Smile className="w-3.5 h-3.5 text-emerald-500" /> {t('tickets.filters.sentiment', 'Gefühl (Sentiment)')}
                          </label>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { id: 'angry', icon: Angry, color: 'text-red-500' },
                              { id: 'neutral', icon: Meh, color: 'text-amber-500' },
                              { id: 'happy', icon: Smile, color: 'text-emerald-500' },
                              { id: 'positive', icon: MessageCircleHeart, color: 'text-pink-500' }
                            ].map(s => (
                              <button 
                                key={s.id} 
                                onClick={() => setFilters({...filters, sentiment: filters.sentiment === s.id ? 'any' : s.id})}
                                className={cn(
                                  "p-2.5 rounded-2xl border text-[9px] font-bold uppercase transition-all flex flex-col items-center gap-1.5",
                                  filters.sentiment === s.id 
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm" 
                                    : "bg-card border-border text-muted-foreground hover:bg-muted"
                                )}
                              >
                                <s.icon className={cn("w-5 h-5", filters.sentiment === s.id ? s.color : "text-muted-foreground/60")} />
                                {s.id}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5 text-emerald-500" /> {t('tickets.filters.originalLanguage', 'Originalsprache')}
                          </label>
                          <Select value={filters.language} onValueChange={(v) => setFilters({...filters, language: v})}>
                            <SelectTrigger className="w-full bg-muted/50 border-border rounded-xl h-11 font-medium">
                              <SelectValue placeholder={t('tickets.filters.allLanguages', 'Alle Sprachen')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">{t('tickets.filters.nativeAny', 'Nativ/Alle')}</SelectItem>
                              <SelectItem value="German">German (DE)</SelectItem>
                              <SelectItem value="English">English (US/UK)</SelectItem>
                              <SelectItem value="Spanish">Spanish (ES)</SelectItem>
                              <SelectItem value="French">French (FR)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-emerald-50/30 rounded-2xl border border-emerald-100 group">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                               <Sparkles className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                               <span className="text-xs font-bold text-emerald-900 leading-none mb-0.5">{t('tickets.filters.aiConfidence', 'KI-Konfidenz')}</span>
                               <span className="text-[9px] font-medium text-emerald-700/60 uppercase tracking-tighter">{t('tickets.filters.requiresReview', 'Erfordert menschliche Prüfung')}</span>
                            </div>
                          </div>
                          <Select value={filters.aiConfidence} onValueChange={(v) => setFilters({...filters, aiConfidence: v})}>
                            <SelectTrigger className="w-28 bg-white border-emerald-200 text-[10px] font-black h-8 rounded-lg uppercase">
                              <SelectValue placeholder={t('tickets.filters.select', 'Auswählen')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">{t('tickets.filters.standard', 'Standard')}</SelectItem>
                              <SelectItem value="low">{t('tickets.filters.unsureLow', 'Unsicher (Niedrig)')}</SelectItem>
                              <SelectItem value="high">{t('tickets.filters.confident', 'Zuversichtlich')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Category C: Timeline & SLA */}
                    <div className="space-y-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-4 w-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{t('tickets.filters.catTimeline', 'Kategorie C: Zeitachse & SLA')}</h4>
                      </div>
                      <div className="space-y-5">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-blue-500" /> {t('tickets.filters.created', 'Erstellt (Created)')}
                          </label>
                          <Select value={filters.created} onValueChange={(v) => setFilters({...filters, created: v})}>
                            <SelectTrigger className="w-full bg-muted/50 border-border rounded-xl h-11 font-medium">
                              <SelectValue placeholder={t('tickets.filters.anyTime', 'Jederzeit')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">{t('tickets.filters.totalHistory', 'Gesamte Historie')}</SelectItem>
                              <SelectItem value="24h">{t('tickets.filters.last24h', 'Letzte 24 Stunden')}</SelectItem>
                              <SelectItem value="7d">{t('tickets.filters.last7d', 'Letzte 7 Tage')}</SelectItem>
                              <SelectItem value="30d">{t('tickets.filters.last30d', 'Letzte 30 Tage')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                            <History className="w-3.5 h-3.5 text-blue-500" /> {t('tickets.filters.resolvedClosedAt', 'Gelöst/Geschlossen am')}
                          </label>
                          <Select value={filters.closedAt} onValueChange={(v) => setFilters({...filters, closedAt: v})}>
                            <SelectTrigger className="w-full bg-muted/50 border-border rounded-xl h-11 font-medium">
                              <SelectValue placeholder={t('tickets.filters.completionState', 'Abschlussstatus')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">{t('tickets.filters.allStates', 'Alle Zustände')}</SelectItem>
                              <SelectItem value="today">{t('tickets.filters.today', 'Heute abgeschlossen')}</SelectItem>
                              <SelectItem value="yesterday">{t('tickets.filters.yesterday', 'Gestern abgeschlossen')}</SelectItem>
                              <SelectItem value="week">{t('tickets.filters.thisWeek', 'Diese Woche')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col gap-3">
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                 <Clock className="w-4 h-4 text-blue-600" />
                                 <span className="text-xs font-bold text-blue-900 uppercase tracking-tight">{t('tickets.filters.slaDue', 'Fällig bis (SLA)')}</span>
                              </div>
                              <Badge className="bg-blue-100 text-blue-700 border-none text-[9px] font-bold h-4">{t('tickets.filters.realTime', 'Echtzeit')}</Badge>
                           </div>
                           <Select value={filters.slaDue} onValueChange={(v) => setFilters({...filters, slaDue: v})}>
                             <SelectTrigger className="w-full bg-white border-blue-200 text-xs font-bold h-10 rounded-xl">
                               <SelectValue placeholder={t('tickets.filters.dueUrgency', 'Fälligkeit')} />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="any">{t('tickets.filters.anyUrgency', 'Jede Dringlichkeit')}</SelectItem>
                               <SelectItem value="1h">{t('tickets.filters.next1h', 'Nächste 1 Stunde')}</SelectItem>
                               <SelectItem value="4h">{t('tickets.filters.next4h', 'Nächste 4 Stunden')}</SelectItem>
                               <SelectItem value="24h">{t('tickets.filters.next24h', 'Nächste 24 Stunden')}</SelectItem>
                             </SelectContent>
                           </Select>
                        </div>
                      </div>
                    </div>

                    {/* Category D: Business Context */}
                    <div className="space-y-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-4 w-1 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                        <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{t('tickets.filters.catBusiness', 'Kategorie D: Geschäftskontext')}</h4>
                      </div>
                      <div className="space-y-5">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-amber-500" /> {t('tickets.filters.company', 'Unternehmen (Company)')}
                          </label>
                          <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                              placeholder={t('tickets.filters.searchOrg', 'Nach Organisation suchen...')} 
                              className="bg-muted/50 border-border rounded-xl pl-10 h-11 text-sm font-medium"
                              value={filters.company === 'any' ? '' : filters.company}
                              onChange={(e) => setFilters({...filters, company: e.target.value || 'any'})}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                            <Box className="w-3.5 h-3.5 text-amber-500" /> {t('tickets.filters.products', 'Produkte')}
                          </label>
                          <Select value={filters.product} onValueChange={(v) => setFilters({...filters, product: v})}>
                            <SelectTrigger className="w-full bg-muted/50 border-border rounded-xl h-11 font-medium">
                              <SelectValue placeholder={t('tickets.filters.allProducts', 'Alle Produkte')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">{t('tickets.filters.totalEcosystem', 'Gesamtes Ökosystem')}</SelectItem>
                              <SelectItem value="GeistDeskTech">{t('tickets.filters.geistCore', 'GeistDeskTech Core')}</SelectItem>
                              <SelectItem value="GeistDeskMobile">{t('tickets.filters.geistMobile', 'GeistDeskMobile Platform')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                            <Share2 className="w-3.5 h-3.5 text-amber-500" /> {t('tickets.filters.source.label', 'Quelle (Source)')}
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: 'email', icon: Mail },
                              { id: 'chat', icon: MessageSquare },
                              { id: 'whatsapp', icon: PhoneCall },
                              { id: 'phone', icon: PhoneCall }
                            ].map(s => (
                              <button 
                                key={s.id} 
                                onClick={() => setFilters({...filters, source: filters.source === s.id ? 'any' : s.id})}
                                className={cn(
                                  "p-3 rounded-xl border text-[10px] font-bold uppercase transition-all flex items-center gap-2 justify-center",
                                  filters.source === s.id 
                                    ? "bg-amber-50 border-amber-200 text-amber-700" 
                                    : "bg-card border-border text-muted-foreground hover:bg-muted"
                                )}
                              >
                                <s.icon className="w-4 h-4" />
                                {t(`tickets.filters.source.${s.id}`, s.id)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>

                <SheetFooter className="p-6 border-t bg-muted/30 shrink-0">
                   <div className="grid grid-cols-2 gap-3 w-full">
                      <Button 
                        variant="outline" 
                        className="rounded-xl h-11 font-bold text-xs uppercase tracking-widest border-border"
                        onClick={() => setFilters({
                          agent: 'any',
                          group: 'any',
                          sentiment: 'any',
                          created: 'any',
                          closedAt: 'any',
                          resolvedAt: 'any',
                          resolutionDue: 'any',
                          firstResponseDue: 'any',
                          nextResponseDue: 'any',
                          skills: 'any',
                          status: 'any',
                          priority: 'any',
                          type: 'any',
                          source: 'any',
                          sourceInfo: '',
                          tags: 'any',
                          company: 'any',
                          contacts: 'any',
                          product: 'any',
                          language: 'any',
                          aiConfidence: 'any',
                          slaDue: 'any'
                        })}
                      >
                        {t('tickets.filters.resetAll', 'Alle zurücksetzen')}
                      </Button>
                      <Button 
                        className="rounded-xl h-11 font-bold text-xs uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                        onClick={() => setIsFilterDrawerOpen(false)}
                      >
                        {t('tickets.filters.applyFilters', 'Filter anwenden')}
                      </Button>
                   </div>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            {/* Inline Bulk Actions Toolbar (Conditional Render) */}
            <AnimatePresence>
              {selectedTicketIds.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  className="mx-6 mb-3 overflow-hidden"
                >
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                    {/* Selected Count Checkbox control */}
                    <div className="flex items-center gap-2.5">
                      <Checkbox 
                        checked={selectedTicketIds.length === tickets.length && tickets.length > 0}
                        onCheckedChange={toggleSelectAll}
                        className="bg-card border-slate-300 h-4 w-4 rounded-sm animate-none"
                      />
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{selectedTicketIds.length} ausgewählt</span>
                    </div>

                    {/* Batch operations */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Bulk Assign button */}
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 px-3 rounded-full text-[10px] font-extrabold uppercase text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 gap-1 hover:bg-slate-50/65 shadow-xs cursor-pointer transition-colors">
                          <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                          {t('tickets.bulk.assign', 'Massen-Zuweisung')} <ChevronDown className="w-3 h-3 text-slate-400" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 rounded-xl">
                          <DropdownMenuItem 
                            className="text-xs font-semibold cursor-pointer py-2" 
                            onClick={() => {
                              handleBulkUpdate({ agentId: user?.uid, agentName: user?.displayName || user?.email || 'Me' });
                              toast.success(t('tickets.bulk.assignedToYou', 'Ausgewählte Tickets wurden Ihnen zugewiesen.'));
                            }}
                          >
                            {t('tickets.bulk.assignToMe', 'Mir zuweisen')}
                          </DropdownMenuItem>
                          <Separator className="my-1" />
                          {['Sarah James', 'Mike Chen', 'Sarah Connor'].map(agent => (
                            <DropdownMenuItem 
                              key={agent} 
                              className="text-xs cursor-pointer py-2" 
                              onClick={() => {
                                handleBulkUpdate({ agentName: agent, agentId: 'agent-' + agent.toLowerCase().replace(' ', '-') });
                                toast.success(t('tickets.bulk.assignedTo', 'Tickets zugewiesen an {{agent}}').replace('{{agent}}', agent));
                              }}
                            >
                              {t('tickets.bulk.assignTo', 'Zuweisen an')} {agent}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Update Status button */}
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 px-3 rounded-full text-[10px] font-extrabold uppercase text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 gap-1 hover:bg-slate-50/65 shadow-xs cursor-pointer transition-colors">
                          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                          {t('tickets.bulk.updateStatus', 'Status aktualisieren')} <ChevronDown className="w-3 h-3 text-slate-400" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-40 rounded-xl">
                          {['open', 'pending', 'resolved', 'closed'].map(statusVal => (
                            <DropdownMenuItem 
                              key={statusVal} 
                              className="capitalize text-xs cursor-pointer py-2" 
                              onClick={() => {
                                handleBulkUpdate({ status: statusVal as TicketStatus });
                                toast.success(t('tickets.bulk.statusUpdated', 'Status aktualisiert auf: {{status}}').replace('{{status}}', t(`tickets.status.${statusVal}`, statusVal)));
                              }}
                            >
                              {t(`tickets.status.${statusVal}`, statusVal)}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Modify Priority button */}
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 px-3 rounded-full text-[10px] font-bold uppercase text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 gap-1 hover:bg-slate-50/65 shadow-xs cursor-pointer transition-colors">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                          {t('tickets.bulk.modifyPriority', 'Priorität ändern')} <ChevronDown className="w-3 h-3 text-slate-400" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-40 rounded-xl">
                          {['low', 'medium', 'high', 'urgent'].map(priorityVal => (
                            <DropdownMenuItem 
                              key={priorityVal} 
                              className="capitalize text-xs cursor-pointer py-2" 
                              onClick={() => {
                                handleBulkUpdate({ priority: priorityVal as TicketPriority });
                                toast.success(t('tickets.bulk.priorityUpdated', 'Priorität geändert auf: {{priority}}').replace('{{priority}}', t(`tickets.priority.${priorityVal}`, priorityVal)));
                              }}
                            >
                              {t(`tickets.priority.${priorityVal}`, priorityVal)}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* AI Mass-Resolve button */}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={async () => {
                          const promise = handleBulkUpdate({ status: 'resolved' });
                          toast.promise(promise, {
                            loading: t('tickets.bulk.massResolveLoading', 'Mass resolving {{count}} tickets...').replace('{{count}}', String(selectedTicketIds.length)),
                            success: t('tickets.bulk.massResolveSuccess', '{{count}} tickets successfully AI-resolved!').replace('{{count}}', String(selectedTicketIds.length)),
                            error: t('tickets.bulk.massResolveError', 'Mass resolve failed.')
                          });
                        }}
                        className="h-8 px-3.5 rounded-full text-[10px] font-black border-indigo-200 dark:border-slate-800 bg-indigo-50/50 hover:bg-indigo-100/50 text-indigo-700 dark:text-indigo-300 gap-1.5 shadow-xs cursor-pointer uppercase tracking-tight"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                        {t('tickets.bulk.aiMassResolve', 'AI Mass-Resolve')}
                      </Button>
                    </div>

                    {/* Clear selection element */}
                    <button 
                      onClick={() => setSelectedTicketIds([])}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer select-none"
                    >
                      {t('tickets.bulk.clearSelection', 'Clear selection')} <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 transition-colors" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* List Content: List / Kanban / Card layouts */}
            <ScrollArea className="flex-1 bg-background min-h-0">
              {tickets.length === 0 ? (
                <TicketsEmptyState
                  onViewUnassigned={() => handleViewChange('unassigned')}
                  onOpenAiSuggestions={() => {
                    document.getElementById('tickets-ai-chip')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }}
                  onCreateTicket={openCreateTicket}
                />
              ) : layoutMode === 'kanban' ? (
                <TicketsKanbanBoard
                  tickets={tickets}
                  onSelect={handleTicketSelect}
                  onStatusChange={(id, status) => handleInlineUpdate(id, { status })}
                  onPriorityChange={(id, priority) => handleInlineUpdate(id, { priority })}
                />
              ) : layoutMode === 'cards' ? (
                <TicketsCardGrid
                  tickets={tickets}
                  onSelect={handleTicketSelect}
                  onStatusChange={(id, status) => handleInlineUpdate(id, { status })}
                  onPriorityChange={(id, priority) => handleInlineUpdate(id, { priority })}
                  onAssigneeChange={(id, agentId, agentName) => handleInlineUpdate(id, { agentId, agentName })}
                  currentUserId={user?.uid}
                  currentUserLabel={user?.displayName || user?.email || t('tickets.assigneeYourself', 'Yourself')}
                  formatTicketRef={formatTicketRef}
                />
              ) : (
              <>
              {/* Desktop Table Layout (lg and up) */}
              <div className="hidden lg:block w-full overflow-x-auto">
                <div className={cn('border-collapse bg-card', getTicketTableMinWidth())}>
                <TicketsTableHeader
                  headerCheckboxActive={headerCheckboxActive}
                  onToggleSelectAll={toggleSelectAll}
                />

                  <div className="divide-y divide-border">
                    {paginatedTickets.map(ticket => {
                      const sla = (() => {
                        if (ticket.status === 'resolved' || ticket.status === 'closed') return null;
                        const now = new Date();
                        const due = ticket.slaDueAt || ticket.firstResponseDue;
                        if (!due) return { label: t('tickets.noSla', 'No SLA'), color: 'text-muted-foreground border-border bg-slate-50' };
                        
                        const dueDate = due.toDate ? due.toDate() : new Date(due);
                        const diffMs = dueDate.getTime() - now.getTime();
                        if (diffMs < 0) {
                          return { label: t('tickets.slaBreached', 'SLA Breached'), color: 'text-rose-600 bg-rose-50 border-rose-200 animate-pulse font-semibold' };
                        }
                        const diffHrs = Math.ceil(diffMs / (1000 * 60 * 60));
                        if (diffHrs <= 12) {
                          return { label: t('tickets.breachInHrs', 'Breach in {{hrs}}h').replace('{{hrs}}', String(diffHrs)), color: 'text-amber-600 bg-amber-50 border-amber-200 animate-pulse font-semibold' };
                        }
                        return { label: t('tickets.slaDueHrs', 'SLA Due {{hrs}}h').replace('{{hrs}}', String(diffHrs)), color: 'text-slate-600 bg-slate-50 border-slate-200' };
                      })();

                      const duplicatesCount = allTickets.filter(other => other.id !== ticket.id && (other.subject.toLowerCase() === ticket.subject.toLowerCase() || (ticket.tags && other.tags && ticket.tags.some(t => other.tags?.includes(t))))).length;

                      const replies = (ticket.id.charCodeAt(1) % 5) + 2;
                      const channelIcon = (() => {
                        if (ticket.channel === 'whatsapp') return <span title={t('tickets.channels.whatsapp', 'WhatsApp-Kanal')}><MessageSquare className="w-3.5 h-3.5 text-emerald-500 animate-none shrink-0" /></span>;
                        if (ticket.channel === 'chat') return <span title={t('tickets.channels.chat', 'Live-Chat')}><MessageSquare className="w-3.5 h-3.5 text-blue-500 animate-none shrink-0" /></span>;
                        return <span title={t('tickets.channels.email', 'E-Mail-Kanal')}><Mail className="w-3.5 h-3.5 text-slate-500 animate-none shrink-0" /></span>;
                      })();

                      return (
                        <motion.div 
                          key={ticket.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          onClick={() => handleTicketSelect(ticket.id)}
                          className={cn(
                            getTicketTableGridClass(),
                            'px-4 overflow-hidden',
                            ticketTableRowClass(selectedTicketIds.includes(ticket.id)),
                          )}
                        >
                          {/* Checkbox Column */}
                          <div className="justify-self-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox 
                              checked={selectedTicketIds.includes(ticket.id)}
                              onCheckedChange={() => toggleTicketSelection(ticket.id)}
                              disabled={!headerCheckboxActive}
                              className="bg-card border-border h-4 w-4 rounded-sm"
                            />
                          </div>

                          {/* Customer Column */}
                          <div className="min-w-0 flex items-center gap-2 pr-1" onClick={(e) => e.stopPropagation()}>
                             <Avatar className={cn(
                               "border border-border shrink-0 shadow-sm",
                               viewDensity === 'comfortable' ? "h-8 w-8" : "h-7 w-7"
                             )}>
                                <AvatarFallback className="bg-accent text-primary font-bold text-xs uppercase">
                                   {ticket.customerName?.charAt(0) || 'U'}
                                </AvatarFallback>
                             </Avatar>
                             <div className="flex flex-col min-w-0">
                                <span className={cn(
                                  "font-bold text-foreground truncate",
                                  viewDensity === 'comfortable' ? "text-xs" : "text-[11px]"
                                )}>{ticket.customerName}</span>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-[10px] text-slate-500 truncate">{ticket.company || t('tickets.privateCustomer', 'Private')}</span>
                                </div>
                             </div>
                          </div>

                          {/* Subject Column */}
                          <div 
                             className="min-w-0 pr-2 relative flex flex-col justify-center gap-0.5"
                             onMouseEnter={(e) => {
                                 setHoveredTicketId(ticket.id);
                                 mousePosRef.current = { x: e.clientX, y: e.clientY };
                                 setPeekOffset(mousePosRef.current);
                             }}
                             onMouseLeave={() => setHoveredTicketId(null)}
                             onMouseMove={handleMouseMove}
                          >
                             <h3 className={cn(
                               "font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-primary transition-colors",
                               viewDensity === 'comfortable' ? "text-xs" : "text-[11px]"
                             )}>
                               {ticket.subject}
                             </h3>
                            <div className="flex items-center gap-1.5 flex-wrap">
                               <span className="text-[10px] text-slate-400 font-medium font-mono shrink-0">
                                 {formatTicketRef(ticket.id)}
                               </span>
                               {sla && (
                                 <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-blue-100 bg-blue-50 text-blue-700 shrink-0">
                                   SLA
                                 </span>
                               )}
                               {/* 3-Tier Agentic Graph — AI confidence badge */}
                               {ticket.aiExecutionStatus === 'auto_dispatched' && (
                                 <span
                                   title={t('tickets.aiStatus.autoDispatched', 'KI-Antwort wurde automatisch gesendet')}
                                   className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700 shrink-0"
                                 >
                                   🔵 {t('tickets.aiStatus.autoDispatchedShort', 'Auto-gesendet')}
                                 </span>
                               )}
                               {ticket.aiExecutionStatus === 'high_confidence' && (
                                 <span
                                   title={t('tickets.aiStatus.highConfidence', 'KI-Entwurf mit hoher Konfidenz ({{percent}}%)').replace('{{percent}}', String(ticket.aiConfidenceScore ?? 95))}
                                   className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 shrink-0"
                                 >
                                   🟢 {t('tickets.aiStatus.high', 'Hoch')} ({ticket.aiConfidenceScore ?? 95}%)
                                 </span>
                               )}
                               {ticket.aiExecutionStatus === 'nuanced' && (
                                 <span
                                   title={t('tickets.aiStatus.nuanced', 'Nuancenreicher KI-Entwurf ({{percent}}%) – Prüfung erforderlich').replace('{{percent}}', String(ticket.aiConfidenceScore ?? '<95'))}
                                   className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700 shrink-0"
                                 >
                                   🟡 {t('tickets.aiStatus.nuancedShort', 'Nuancenreich')} ({ticket.aiConfidenceScore ?? '<95'}%)
                                 </span>
                               )}
                                {viewDensity === 'comfortable' && duplicatesCount > 0 && (
                                  <Badge variant="outline" className="text-[8px] font-semibold bg-blue-50/50 border-blue-100 text-blue-700 h-4 flex items-center gap-0.5 shrink-0">
                                    <Link2 className="w-2.5 h-2.5" />
                                    <span>{duplicatesCount === 1 ? t('tickets.dup', '1 dup') : t('tickets.dups', '{{count}} dups').replace('{{count}}', String(duplicatesCount))}</span>
                                  </Badge>
                                )}
                                <div className="flex items-center gap-1 shrink-0 ml-auto">
                                  {channelIcon}
                                  {viewDensity === 'comfortable' && (
                                    <span className="text-[9.5px] text-muted-foreground font-medium">
                                      {replies === 1 ? t('tickets.reply', '1 reply') : t('tickets.replies', '{{count}} replies').replace('{{count}}', String(replies))}
                                    </span>
                                  )}
                                  {ticket.activeAgents && ticket.activeAgents
                                    .filter(a => a.uid !== user?.uid)
                                    .slice(0, 2)
                                    .map(agent => (
                                      <Avatar key={agent.uid} className="h-4 w-4 border border-background shrink-0">
                                        <AvatarImage src={agent.avatar} alt={agent.name} />
                                        <AvatarFallback className="text-[6px] bg-primary/10 text-primary font-bold">
                                          {agent.name.charAt(0)}
                                        </AvatarFallback>
                                      </Avatar>
                                    ))
                                  }
                                </div>
                             </div>

                             {viewDensity === 'comfortable' && (
                               <p className="text-[11px] text-muted-foreground truncate opacity-75 font-medium">
                                  {redactPII(stripHtml(ticket.description))}
                                </p>
                             )}
                          </div>

                          {/* Status Column */}
                          <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                            <TicketStatusChip
                              status={ticket.status ?? 'open'}
                              onChange={(val) => handleInlineUpdate(ticket.id, { status: val })}
                            />
                          </div>

                          {/* Priority Column */}
                          <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                            <TicketPriorityChip
                              priority={ticket.priority ?? 'medium'}
                              onChange={(val) => handleInlineUpdate(ticket.id, { priority: val })}
                            />
                          </div>

                          {/* Assignee Column */}
                          <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                            <TicketAssigneeChip
                              agentId={ticket.agentId}
                              agentName={ticket.agentName}
                              currentUserId={user?.uid}
                              currentUserLabel={user?.displayName || user?.email || t('tickets.assigneeYourself', 'Yourself')}
                              onChange={(agentId, agentName) => handleInlineUpdate(ticket.id, { agentId, agentName })}
                            />
                          </div>

                          {/* Last Update Column */}
                          <div className="min-w-0 text-xs text-muted-foreground font-semibold text-left truncate">
                             {ticket.updatedAt?.toDate ? ticket.updatedAt.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' }) : t('tickets.today', 'Today')}
                          </div>

                          {/* Actions Menu Column */}
                          <div className="justify-self-center" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger className="h-8 w-8 p-0 rounded-full hover:bg-muted cursor-pointer flex items-center justify-center animate-none border-none bg-transparent outline-none ring-0">
                                <MoreVertical className="w-4 h-4 text-slate-400 group-hover:text-slate-650 shrink-0" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40 rounded-xl">
                                <DropdownMenuItem className="text-xs cursor-pointer py-2 font-bold" onClick={() => handleTicketSelect(ticket.id)}>
                                  {t('tickets.rowActions.open', 'Open')}
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-xs cursor-pointer py-2 text-rose-600 focus:text-rose-650" onClick={() => handleInlineUpdate(ticket.id, { status: 'trash' })}>
                                  {t('tickets.rowActions.delete', 'Delete')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Mobile Card Stack View (below lg) */}
              <div className="lg:hidden p-4 space-y-3 bg-muted/20">
                {tickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-card rounded-2xl border">
                    <Ticket className="w-10 h-10 text-muted-foreground opacity-40 mb-4" />
                    <h3 className="font-bold text-lg text-foreground">{t('tickets.noTicketsInView', 'No tickets in this view.')}</h3>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">
                      {t('tickets.noTicketsInViewDesc', "You've reached the end of this queue. Adjust your filters or select a different view from the sidebar to find more tickets.")}
                    </p>
                  </div>
                ) : (
                  tickets.map(ticket => {
                    const tier = (() => {
                      if (ticket.priority === 'urgent' || ticket.tags?.includes('VIP') || ticket.customerName?.toLowerCase().includes('sarah')) {
                        return { label: t('tickets.tiers.vip', 'VIP'), style: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
                      }
                      if (ticket.company?.toLowerCase().includes('advanced') || ticket.company?.toLowerCase().includes('global') || ticket.tags?.includes('Enterprise')) {
                        return { label: t('tickets.tiers.enterprise', 'Enterprise'), style: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' };
                      }
                      return { label: t('tickets.tiers.standard', 'Standard'), style: 'bg-slate-100 text-slate-500 border-slate-200' };
                    })();

                    const sla = (() => {
                      if (ticket.status === 'resolved' || ticket.status === 'closed') return null;
                      const now = new Date();
                      const due = ticket.slaDueAt || ticket.firstResponseDue;
                      if (!due) return null;
                      const dueDate = due.toDate ? due.toDate() : new Date(due);
                      const diffMs = dueDate.getTime() - now.getTime();
                      if (diffMs < 0) return { label: t('tickets.slaBreached', 'SLA verletzt'), color: 'bg-red-500/10 text-rose-600 border-rose-200' };
                      const diffHrs = Math.ceil(diffMs / (1000 * 60 * 60));
                      if (diffHrs <= 12) return { label: t('tickets.breachInHrs', 'Verletzung in {{hrs}} Std.').replace('{{hrs}}', String(diffHrs)), color: 'bg-amber-500/10 text-amber-600 border-amber-200 animate-pulse' };
                      return { label: t('tickets.slaDueHrs', 'Fällig in {{hrs}} Std.').replace('{{hrs}}', String(diffHrs)), color: 'bg-slate-100 text-slate-600 border-slate-200' };
                    })();

                    return (
                      <div
                        key={ticket.id}
                        onClick={() => handleTicketSelect(ticket.id)}
                        className="bg-card hover:bg-muted/40 transition-all border border-border rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer flex flex-col gap-3 relative"
                      >
                        {/* Row 1: Sentiment, Customer, Tier Badge */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar className="h-8 w-8 border border-border shrink-0 shadow-xs">
                              <AvatarFallback className="bg-accent text-primary font-bold text-xs uppercase">
                                 {ticket.customerName?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col min-w-0">
                              <span className="font-extrabold text-xs text-foreground truncate">{ticket.customerName}</span>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground truncate">{ticket.company || t('tickets.privateCustomer', 'Private')}</span>
                                <Badge variant="outline" className={cn("text-[8px] h-3.5 px-1.5 pb-0 scale-90 select-none font-bold", tier.style)}>
                                  {tier.label}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {/* Sentiment icon in the corner */}
                          <div className="flex items-center gap-2 shrink-0">
                            <Checkbox 
                              checked={selectedTicketIds.includes(ticket.id)}
                              onCheckedChange={() => toggleTicketSelection(ticket.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-card border-border h-4 w-4"
                            />
                            <div className="p-1 rounded-full bg-slate-50/50 dark:bg-slate-800 border">
                              {ticket.sentiment === 'positive' && <Smile className="w-3.5 h-3.5 text-emerald-500" />}
                              {ticket.sentiment === 'neutral' && <Meh className="w-3.5 h-3.5 text-slate-400" />}
                              {ticket.sentiment === 'negative' && <Frown className="w-3.5 h-3.5 text-orange-500" />}
                              {ticket.sentiment === 'angry' && <Angry className="w-3.5 h-3.5 text-rose-500 animate-pulse" />}
                            </div>
                          </div>
                        </div>

                        {/* Row 2: Subject & ID & SLA */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] font-bold text-muted-foreground bg-muted border rounded px-1">#{ticket.id.slice(0, 4)}</span>
                            {sla && (
                              <Badge className={cn("text-[8px] px-1.5 py-0 h-4 border uppercase tracking-wider font-extrabold", sla.color)}>
                                {sla.label}
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-extrabold text-xs text-foreground leading-snug line-clamp-2">
                            {ticket.subject}
                          </h4>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-normal select-none font-medium mt-0.5">
                            {redactPII(stripHtml(ticket.description))}
                          </p>
                        </div>

                        {/* Row 3: Status, Priority, Assignee & Updated */}
                        <div className="border-t pt-2.5 flex items-center justify-between gap-2 flex-wrap">
                          {/* Left badges: status & priority */}
                          <div className="flex items-center gap-1.5">
                            <TicketStatusChip
                              status={ticket.status ?? 'open'}
                              onChange={(val) => handleInlineUpdate(ticket.id, { status: val })}
                            />
                            <span className={cn(
                              "text-[9px] font-semibold flex items-center gap-1.5 px-1.5 py-0.5 rounded-full border",
                              ticket.priority === 'urgent' ? "bg-rose-50/50 text-rose-600 border-rose-200 font-extrabold" :
                              ticket.priority === 'high' ? "bg-amber-50/50 text-amber-600 border-amber-200 font-bold" :
                              "bg-slate-50/50 text-slate-600 border-slate-200"
                            )}>
                              <div className={cn(
                                 "w-1.5 h-1.5 rounded-full shrink-0",
                                 ticket.priority === 'urgent' ? "bg-rose-500" :
                                 ticket.priority === 'high' ? "bg-amber-500" :
                                 ticket.priority === 'medium' ? "bg-blue-500" : "bg-slate-400"
                              )} />
                              <span>{t(`tickets.priority.${ticket.priority || 'medium'}`, ticket.priority || 'Mittel')}</span>
                            </span>
                          </div>

                          {/* Assignee & lastUpdate */}
                          <div className="flex items-center gap-2 text-muted-foreground text-[10px] ml-auto shrink-0 font-medium">
                            <div className="flex items-center gap-1 bg-muted/60 px-2 py-0.5 rounded-full border border-border/50">
                              <Avatar className="h-4.5 w-4.5 border shrink-0">
                                <AvatarFallback className="text-[7.5px] bg-[#E8F0FE] text-primary font-bold">
                                  {ticket.agentName?.charAt(0) || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <span className="max-w-[70px] truncate text-[9.5px] font-extrabold text-slate-700 dark:text-slate-300">
                                {ticket.agentId === user?.uid ? t('tickets.assigneeMeShort', 'Ich') : (ticket.agentName || t('tickets.unassigned', 'Nicht zugewiesen'))}
                              </span>
                            </div>
                            <span className="text-[9.5px]">
                              {ticket.updatedAt?.toDate ? ticket.updatedAt.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' }) : t('tickets.today', 'Heute')}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              </>
              )}
            </ScrollArea>

            {/* Data Table Pagination Footer (Sticky / Locked at the bottom) */}
            <div className="h-14 border-t border-border bg-card px-6 flex items-center justify-between shrink-0 select-none">
              {/* Left Side: Status display */}
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {t('tickets.pagination.showing', 'Showing')}{' '}
                <span className="font-extrabold text-slate-800 dark:text-slate-100">{totalTicketsCount === 0 ? 0 : startIdx + 1}</span>{' '}
                {t('tickets.pagination.to', 'to')}{' '}
                <span className="font-extrabold text-slate-800 dark:text-slate-100">{Math.min(endIdx, totalTicketsCount)}</span>{' '}
                {t('tickets.pagination.of', 'of')}{' '}
                <span className="font-extrabold text-slate-800 dark:text-slate-100">{totalTicketsCount}</span>{' '}
                {totalTicketsCount === 1 ? t('tickets.pagination.ticketSingular', 'ticket') : t('tickets.pagination.ticketPlural', 'tickets')}
              </div>

              {/* Right Side: Zeilen pro Seite selector & Navigation buttons list */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{t('tickets.pagination.rowsPerPage', 'Rows per page:')}</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(val) => {
                      setPageSize(Number(val));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-16 border border-border bg-muted/30 hover:bg-muted/50 transition-colors rounded-lg text-xs font-bold ring-0 focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {[5, 10, 20, 50].map(size => (
                        <SelectItem key={size} value={String(size)} className="text-xs font-bold">{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Navigation active page numbers controls */}
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-lg border hover:bg-muted font-black"
                    disabled={currentPage === 1 || totalPages === 0}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
                  </Button>

                  {/* Dynamic generation of page numbers */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "h-8 w-8 p-0 rounded-lg text-xs font-extrabold select-none",
                        currentPage === page 
                          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs" 
                          : "border hover:bg-muted text-slate-600 font-bold"
                      )}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-lg border hover:bg-muted font-black"
                    disabled={currentPage === totalPages || totalPages === 0}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  </Button>
                </div>
              </div>
            </div>

            <TicketDetailDrawer
              ticket={drawerTicketId ? allTickets.find((tk) => tk.id === drawerTicketId) ?? null : null}
              allTickets={allTickets}
              kbArticles={kbArticles}
              onClose={() => {
                if (drawerTicketId) ticketService.setPresence(drawerTicketId, false);
                setDrawerTicketId(null);
              }}
              onOpenFullView={() => {
                if (!drawerTicketId) return;
                openFullTicketView(drawerTicketId);
              }}
            />
          </div>
    </div>
  );
}
