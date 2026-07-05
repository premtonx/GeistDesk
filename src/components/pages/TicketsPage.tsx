import { useEffect, useMemo, useRef, useState, useCallback, type MouseEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Filter, 
  ChevronDown, 
  MoreHorizontal, 
  Layout,
  List,
  Sun,
  Moon,
  MessageSquare, 
  Send, 
  Sparkles,
  ShieldCheck,
  History,
  Info,
  AlertCircle,
  Ticket,
  Archive,
  Trash,
  Paperclip,
  Smile,
  Meh,
  Frown,
  Angry,
  BookOpen,
  Tag,
  UserPlus,
  UserRound,
  Zap,
  PlusCircle,
  Building2,
  PhoneCall,
  Share2,
  Star,
  Clock,
  Trash2,
  AlertTriangle,
  MailWarning,
  Globe,
  Mail,
  Search,
  SearchCheck,
  Languages,
  MessageCircleHeart,
  UserCheck,
  GraduationCap,
  Lock,
  Scale,
  FileText,
  Download,
  ArrowRight,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Hash,
  Settings2,
  Box,
  Link2,
  Link,
  Unlink,
  ExternalLink,
  Network,
  GitMerge,
  Plus,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Lightbulb,
  MoreVertical,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { suggestNeuralLinks, SuggestedLink } from '../../services/neuralLinkService';
import axios from 'axios';
import {
  executeTicketDeepDiveAnalysis,
  resolveLifecycleOutput,
} from '../../lib/aiLifecycleClient';
import {
  buildTicketDeepDivePrompt,
  buildTicketMessagesText,
  parseTicketAnalysisOutput,
  ticketAnalysisPatch,
} from '../../lib/ticket-ai-analysis';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Separator } from '../../components/ui/separator';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../../components/ui/dialog';
import { toast } from 'sonner';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '../../components/ui/card';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../../components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "../../components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Checkbox } from '../../components/ui/checkbox';
import { Ticket as TicketType, Message, KBArticle, TicketStatus, TicketPriority, Company, Contact, TicketChecklistItem } from '../../types';
import { redactPII, isTextSensitive } from '../../lib/ai/pii-shield';
import { AIAdapter } from '../../lib/ai/provider-adapter';
import { subscribeOrchestratorConfig, startOrchestratorConfigSync } from '../../lib/aiOrchestratorClient';
import { getModuleConfig, ModuleConfig } from '../../lib/module-config';
import { useTheme } from '../../lib/context/ThemeContext';

import { logAudit } from '../../services/auditService';
import { ticketService } from '../../services/ticketService';
import { kbService } from '../../services/kbService';
import { ragService } from '../../services/ragService';
import { customerService } from '../../services/customerService';
import { schemaService, CustomField } from '../../services/schemaService';
import { useAuth } from '../../lib/hooks';
import { useSidebar } from '../../lib/context/SidebarContext';
import {
  filterTicketsByWorkspace,
} from '../../lib/ticketWorkspace';
import {
  computeTicketQueueStats,
  countTicketsByView,
  filterTicketsByTopStatus,
  filterTicketsByView,
  type TopStatusFilterId,
} from '../../lib/ticketViewFilters';
import {
  customViewId,
  useTicketsSidebarPreferences,
} from '../../lib/ticketsSidebarPreferences';
import { usePermissions } from '../../hooks/usePermissions';
import { useCreateTicketCatalog } from '../../hooks/useCreateTicketCatalog';
import { useTranslation } from '../../lib/context/I18nContext';

import { validateDraft, LegalValidationResult } from '../../services/legalService';
import { RichTextEditor } from '../RichTextEditor';
import { CreateTicketDialog } from '../CreateTicketDialog';

import { DetailsHeader } from '../ticket-details/DetailsHeader';
import { SmartContextPanel } from '../ticket-details/SmartContextPanel';
import { AiSummaryCard } from '../ticket-details/AiSummaryCard';
import { ConversationTimeline } from '../ticket-details/ConversationTimeline';
import { EmailComposer } from '../ticket-details/EmailComposer';
import { CustomerTabContent } from '../ticket-details/CustomerTabContent';
import { TimelineTabContent } from '../ticket-details/TimelineTabContent';
import { AiInsightsTabContent } from '../ticket-details/AiInsightsTabContent';
import { AssetsTabContent } from '../ticket-details/AssetsTabContent';
import { RelatedTicketsTabContent } from '../ticket-details/RelatedTicketsTabContent';
import { TasksTabContent } from '../ticket-details/TasksTabContent';
import { TicketKindFieldsCard } from '../ticket-details/TicketKindFieldsCard';
import { RedesignedSidebar } from '../ticket-details/RedesignedSidebar';
import { FlagIcon, languageToFlagCode } from '../ui/FlagIcon';
import { ModuleCreateButton } from '../ui/ModuleCreateButton';
import {
  ModulePageTabs,
  ModuleToolbar,
  ModuleToolbarSelect,
} from '../ui/module-page';
import { TicketsQueueAiChip } from '../tickets/TicketsQueueAiChip';
import { TicketsPageHeader } from '../tickets/TicketsPageHeader';
import { TicketsLeftSidebar } from '../tickets/TicketsLeftSidebar';
import { TicketsSidebarManageSheet } from '../tickets/TicketsSidebarManageSheet';
import { TicketsEmptyState } from '../tickets/TicketsEmptyState';
import { TicketDetailDrawer } from '../tickets/TicketDetailDrawer';
import { FAVORITES_SECTION_ID, TICKETS_SIDEBAR_GROUPS } from '../tickets/ticketsSidebarConfig';
import { TicketStatusChip, TicketPriorityChip, TicketAssigneeChip } from '../tickets/TicketTableCells';
import { TicketsTableHeader } from '../tickets/TicketsTableHeader';
import { getTicketTableGridClass, getTicketTableMinWidth, ticketTableRowClass } from '../tickets/ticketTableLayout';
import { TicketsViewModeSelector, type TicketsLayoutMode } from '../tickets/TicketsViewModeSelector';
import { TicketsKanbanBoard } from '../tickets/TicketsKanbanBoard';
import { TicketsCardGrid } from '../tickets/TicketsCardGrid';
const matchStatus = (status: string | undefined, target: string): boolean => {
  if (!status) return false;
  return status.toLowerCase().trim() === target.toLowerCase().trim();
};

const matchStatusNot = (status: string | undefined, target: string): boolean => {
  if (!status) return true;
  return status.toLowerCase().trim() !== target.toLowerCase().trim();
};

const hasTagCaseInsensitive = (tags: string[] | undefined, target: string): boolean => {
  if (!tags) return false;
  return tags.some(tag => tag.toLowerCase().trim() === target.toLowerCase().trim());
};

function formatTicketRef(id: string): string {
  const upper = id.toUpperCase();
  if (upper.startsWith('TKT')) return `#${upper}`;
  return `#TKT-${id.slice(-4).toUpperCase()}`;
}

const staticCategories = [
  {
    id: 'inbox',
    label: 'Inbox',
    items: [
      { id: 'agent_seeking_help', label: 'Agenten Helfen', icon: HelpCircle, indicator: { label: 'help', color: 'bg-red-500 text-white font-black animate-pulse shadow shadow-red-500/50' } },
      { id: 'unassigned', label: 'Unassigned', icon: UserPlus },
      { id: 'new_tickets', label: 'New Tickets', icon: PlusCircle, indicator: { label: 'New', color: 'bg-rose-500 text-white font-bold' } },
      { id: 'awaiting_triage', label: 'Awaiting Triage', icon: Layout },
      { id: 'undelivered_msg', label: 'Undelivered Messages', icon: MailWarning },
      { id: 'sla_risk', label: 'SLA Breach Risk', icon: AlertCircle, indicator: { label: 'Urgent', color: 'bg-amber-500 text-black font-extrabold animate-pulse' } },
      { id: 'escalations', label: 'Escalations', icon: AlertTriangle }
    ]
  },
  {
    id: 'my_work',
    label: 'My Work',
    items: [
      { id: 'my_open', label: 'My Open Tickets', icon: UserRound },
      { id: 'assigned_me', label: 'Assigned To Me', icon: UserCheck },
      { id: 'mentioned_me', label: 'Mentioned To Me', icon: MessageSquare },
      { id: 'watching', label: 'Watching', icon: Star },
      { id: 'waiting_customer', label: 'Waiting For Customer', icon: Clock },
      { id: 'recently_updated', label: 'Recently Updated', icon: History }
    ]
  },
  {
    id: 'team',
    label: 'Team Queues',
    items: [
      { id: 'team_all_open', label: 'All Open Tickets', icon: List },
      { id: 'team_pending', label: 'Pending', icon: Clock, indicator: { label: 'Pending', color: 'bg-amber-400 text-black font-semibold' } },
      { id: 'team_on_hold', label: 'On Hold', icon: Lock },
      { id: 'resolved_today', label: 'Resolved Today', icon: CheckCircle2 },
      { id: 'closed_week', label: 'Closed This Week', icon: CheckCircle2 }
    ]
  },
  {
    id: 'priority',
    label: 'Priority Views',
    items: [
      { id: 'urgent_priority', label: 'Urgent', icon: AlertTriangle },
      { id: 'high_priority', label: 'High Priority', icon: ArrowRight },
      { id: 'vip_customers', label: 'VIP Customers', icon: GraduationCap },
      { id: 'enterprise_accounts', label: 'Enterprise Accounts', icon: Building2 },
      { id: 'escalated_tickets', label: 'Escalated Tickets', icon: Scale }
    ]
  },
  {
    id: 'ai',
    label: 'AI Workspace',
    items: [
      { id: 'ai_actions', label: 'AI Suggested Actions', icon: Sparkles },
      { id: 'ai_review', label: 'Tickets Needing Review', icon: SearchCheck },
      { id: 'sentiment_alerts', label: 'Sentiment Alerts', icon: Angry },
      { id: 'churn_risk', label: 'Churn Risk Customers', icon: Frown },
      { id: 'similar_clusters', label: 'Similar Ticket Clusters', icon: Network }
    ]
  },
  {
    id: 'kb',
    label: 'Knowledge & Automation',
    items: [
      { id: 'kb_opportunities', label: 'Suggested KB Opportunities', icon: BookOpen },
      { id: 'missing_docs', label: 'Missing Documentation', icon: FileText },
      { id: 'automation_candidates', label: 'Automation Candidates', icon: Zap }
    ]
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    items: [
      { id: 'trash', label: 'Trash', icon: Trash2 },
      { id: 'spam', label: 'Spam', icon: MailWarning }
    ]
  }
];

function stripHtml(html: string) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export default function TicketsPage() {
  const { t, language } = useTranslation();
  const { user } = useAuth();
  const { hasPermission, role, loading: permsLoading } = usePermissions();
  const { isPipelineCollapsed, togglePipelineSidebar } = useSidebar();
  const { ticketId } = useParams();
  const navigate = useNavigate();
  
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);
  const { companies: createTicketCompanies, agents: createTicketAgents } = useCreateTicketCatalog();

  // Default to closed so mobile lands on the ticket list (not the pipeline
  // navigator). When true on small screens the list is `hidden`, which made
  // mobile users see zero tickets. Desktop shows the sidebar via `md:flex`
  // regardless of this flag, so false is correct for both.
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const effectiveCollapsed = isPipelineCollapsed && !isMobile;
  const [newAgentComment, setNewAgentComment] = useState("");
  const [allTickets, setAllTickets] = useState<TicketType[]>([]);
  const [kbArticles, setKbArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(ticketId || null);
  const [replyText, setReplyText] = useState('');
  const [isMobilePropertiesOpen, setIsMobilePropertiesOpen] = useState(false);
  const [activeView, setActiveView] = useState<string>(() => {
    return localStorage.getItem('geistdesk_default_view') || 'team_all_open';
  });
  const [topStatusFilter, setTopStatusFilter] = useState<TopStatusFilterId>('all');
  const [drawerTicketId, setDrawerTicketId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<TicketsLayoutMode>('list');
  const [listSort, setListSort] = useState<'newest' | 'oldest' | 'priority'>('newest');

  const [isManageViewsOpen, setIsManageViewsOpen] = useState(false);

  const {
    prefs: sidebarPrefs,
    toggleFavorite,
    reorderFavorites,
    reorderGroups,
    toggleGroupVisibility,
    toggleGroupCollapsed,
    setGroupCollapsed,
    addCustomView,
    updateCustomView,
    removeCustomView,
  } = useTicketsSidebarPreferences(user?.uid);

  const supportTickets = useMemo(
    () => filterTicketsByWorkspace(allTickets, 'support'),
    [allTickets],
  );

  const [additionalCategory, setAdditionalCategory] = useState<string | null>(() => {
    return localStorage.getItem('geistdesk_additional_category') || null;
  });
  const [categoryOrder, setCategoryOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('geistdesk_category_order');
    return saved ? JSON.parse(saved) : ['inbox', 'my_work', 'team', 'priority', 'ai', 'kb', 'maintenance'];
  });
  const [defaultViewSetting, setDefaultViewSetting] = useState<string>(() => {
    return localStorage.getItem('geistdesk_default_view') || 'unassigned';
  });
  const [isCustomizerExpanded, setIsCustomizerExpanded] = useState(false);

  const dynamicCategories = useMemo(() => TICKETS_SIDEBAR_GROUPS, []);

  useEffect(() => {
    if (additionalCategory) {
      localStorage.setItem('geistdesk_additional_category', additionalCategory);
    } else {
      localStorage.removeItem('geistdesk_additional_category');
    }
  }, [additionalCategory]);

  useEffect(() => {
    localStorage.setItem('geistdesk_category_order', JSON.stringify(categoryOrder));
  }, [categoryOrder]);

  useEffect(() => {
    localStorage.setItem('geistdesk_default_view', defaultViewSetting);
  }, [defaultViewSetting]);

  useEffect(() => {
    const builtIn = TICKETS_SIDEBAR_GROUPS.flatMap((c) => c.items.map((i) => i.id));
    const custom = sidebarPrefs.customViews.map((v) => customViewId(v));
    const visibleViewIds = [...builtIn, ...custom];
    if (!visibleViewIds.includes(activeView)) {
      setActiveView(defaultViewSetting);
    }
  }, [sidebarPrefs.customViews, activeView, defaultViewSetting]);

  const moveCategory = (id: string, direction: 'up' | 'down') => {
    const idx = categoryOrder.indexOf(id);
    if (idx === -1) return;
    const newOrder = [...categoryOrder];
    if (direction === 'up' && idx > 0) {
      const temp = newOrder[idx];
      newOrder[idx] = newOrder[idx - 1];
      newOrder[idx - 1] = temp;
    } else if (direction === 'down' && idx < newOrder.length - 1) {
      const temp = newOrder[idx];
      newOrder[idx] = newOrder[idx + 1];
      newOrder[idx + 1] = temp;
    }
    setCategoryOrder(newOrder);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [isAIPanelCollapsed, setIsAIPanelCollapsed] = useState(false);
  const [legalViolation, setLegalViolation] = useState<LegalValidationResult | null>(null);
  const [isValidatingLegal, setIsValidatingLegal] = useState(false);
  const [watchedTicketIds, setWatchedTicketIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('watchedTickets');
    return saved ? JSON.parse(saved) : [];
  });
  const collapsedGroups = sidebarPrefs.collapsedGroups;

  const toggleGroup = (group: string) => {
    toggleGroupCollapsed(group);
  };
  const [viewDensity, setViewDensity] = useState<'comfortable' | 'compact'>('compact');
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [headerCheckboxActive, setHeaderCheckboxActive] = useState(false);
  const [isAIPanelSecondaryExpanded, setIsAIPanelSecondaryExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isSentimentBreakdownOpen, setIsSentimentBreakdownOpen] = useState(false);
  const [sentimentTicketId, setSentimentTicketId] = useState<string | null>(null);
  const [ticketCompany, setTicketCompany] = useState<Company | null>(null);
  const [ticketContact, setTicketContact] = useState<Contact | null>(null);
  const [contactSchema, setContactSchema] = useState<CustomField[]>([]);
  const { theme, toggleTheme } = useTheme();

  const [areNotesExpanded, setAreNotesExpanded] = useState(false);
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);

  useEffect(() => {
    setAreNotesExpanded(false);
    setIsComposerExpanded(false);
  }, [selectedTicketId]);

  useEffect(() => {
    schemaService.getContactSchema().then(setContactSchema);
  }, []);

  // Filter State
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isHandoffOpen, setIsHandoffOpen] = useState(false);
  const [handoffSummary, setHandoffSummary] = useState<{ customerGoal: string; effortSoFar: string[] } | null>(null);
  const [isGeneratingHandoff, setIsGeneratingHandoff] = useState(false);
  const [pendingAgentUpdate, setPendingAgentUpdate] = useState<{ id: string; data: any } | null>(null);
  const [filters, setFilters] = useState({
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
  });

  const [suggestedTags, setSuggestedTags] = useState<string[]>(['Billing', 'API_Error', 'Performance']);
  const [newTagInput, setNewTagInput] = useState('');

  useEffect(() => {
    localStorage.setItem('watchedTickets', JSON.stringify(watchedTicketIds));
  }, [watchedTicketIds]);

  const handleViewChange = (view: typeof activeView) => {
    setActiveView(view);
    setSelectedTicketId(null);
    setSelectedTicketIds([]);
    navigate('/tickets');
    setIsMobileSidebarOpen(false);
    if (window.innerWidth < 768 && !isPipelineCollapsed && togglePipelineSidebar) {
      togglePipelineSidebar();
    }
  };

  const handleInlineUpdate = async (ticketId: string, data: Partial<TicketType>) => {
    // Optimistic UI Update
    setAllTickets(prev => prev.map(t => t.id === ticketId ? { ...t, ...data } : t));
    
    try {
      await ticketService.updateTicket(ticketId, data);
      toast.success("Ticket updated");
    } catch (error) {
      toast.error("Failed to update ticket");
    }
  };

  const toggleWatch = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    setWatchedTicketIds(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
    toast.success(watchedTicketIds.includes(id) ? "Removed from watched" : "Added to watched");
  };

  useEffect(() => {
    // Auto-seed sample tickets if empty
    if (!loading && allTickets.length === 0 && user) {
      const sampleTickets = [
        {
          subject: "Login not working #3",
          description: "I cannot log in with my new email address. It shows that the credentials are invalid, even though I just reset them.",
          status: 'open',
          priority: 'high',
          team: 'support',
          customerId: 'CUST-001',
          customerName: "Sarah James",
          company: "Advanced Machinery",
          channel: 'email',
          sentiment: 'angry',
          tags: ['auth', 'login'],
          creatorId: user.uid,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          subject: "Feature Request: Export to PDF",
          description: "We would like to be able to export our weekly reports directly to PDF format for our management team.",
          status: 'pending',
          priority: 'medium',
          team: 'engineering',
          customerId: 'CUST-002',
          customerName: "Mike Chen",
          company: "Global Tech Solutions",
          channel: 'chat',
          sentiment: 'positive',
          tags: ['feature', 'export'],
          creatorId: user.uid,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          subject: "System delay in production",
          description: "We are noticing significant latency in the production environment since the last update. Please investigate.",
          status: 'open',
          priority: 'urgent',
          team: 'engineering',
          customerId: 'CUST-003',
          customerName: "Alex Rivera",
          company: "FinStream",
          channel: 'phone',
          sentiment: 'negative',
          tags: ['performance', 'incident'],
          creatorId: user.uid,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      sampleTickets.forEach(t => ticketService.createTicket(t as any));
      toast.info("Sample tickets seeded for your workspace.");
    }
  }, [loading, allTickets.length, user]);

  const [isAiDrafting, setIsAiDrafting] = useState(false);
  const [ghostDraft, setGhostDraft] = useState('');
  const [isGhostDrafting, setIsGhostDrafting] = useState(false);
  const [suggestedNeuralLinks, setSuggestedNeuralLinks] = useState<SuggestedLink[]>([]);
  const [isFindingNeuralLinks, setIsFindingNeuralLinks] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [mergeSearchQuery, setMergeSearchQuery] = useState('');

  const mergeSearchSuggestions = useMemo(() => {
    if (!mergeSearchQuery.trim()) return [];
    return allTickets.filter(t => 
      t.id !== selectedTicketId && (
        t.subject.toLowerCase().includes(mergeSearchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(mergeSearchQuery.toLowerCase())
      )
    ).slice(0, 5);
  }, [mergeSearchQuery, allTickets, selectedTicketId]);

  const [showCitations, setShowCitations] = useState(true);
  const [kbDraft, setKbDraft] = useState<{ title: string; content: string } | null>(null);
  const [isKbDrafting, setIsKbDrafting] = useState(false);
  const [showKbDialog, setShowKbDialog] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [aiSources, setAiSources] = useState<{ paragraph: string; articleTitle: string; articleId?: string }[]>([]);

  // Redesign states
  const [activeDetailTab, setActiveDetailTab] = useState<string>('conversation');
  const [copilotMessages, setCopilotMessages] = useState<Array<{ sender: 'user' | 'assistant', text: string }>>([
    { sender: 'assistant', text: 'Ask me anything about this ticket...' }
  ]);
  const [copilotInput, setCopilotInput] = useState('');
  const [isCopilotTyping, setIsCopilotTyping] = useState(false);
  const [aiCardExpanded, setAiCardExpanded] = useState(true);
  const [collapsedSidebarSections, setCollapsedSidebarSections] = useState<Record<string, boolean>>({
    status: false,
    assignee: false,
    sla: false,
    customer: false,
    organization: false,
    tags: false,
    related_tickets: false,
    assets: false,
    history: false,
    ai_insights: false,
    ai_copilot: false,
  });

  // Polyglot Bridge State
  const [moduleConfig, setModuleConfig] = useState<ModuleConfig>(getModuleConfig());
  const [agentLanguage, setAgentLanguage] = useState<string>(() => {
    return localStorage.getItem('agentLanguage') || 'English';
  });
  useEffect(() => {
    localStorage.setItem('agentLanguage', agentLanguage);
  }, [agentLanguage]);

  const [translationMood, setTranslationMood] = useState<'Professional' | 'Casual' | 'Empathetic'>('Professional');
  const [translatedTicket, setTranslatedTicket] = useState<{ subject: string; description: string } | null>(null);
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [liveTranslation, setLiveTranslation] = useState('');
  
  const ai = useMemo(() => new AIAdapter(), []);

  useEffect(() => {
    startOrchestratorConfigSync();
    return subscribeOrchestratorConfig(() => ai.reloadConfig());
  }, [ai]);
  const isAiReady = useMemo(() => ai.isConfigured, [ai]);

  const viewFilterContext = useMemo(
    () => ({
      userId: user?.uid ?? '',
      watchedTicketIds,
      allTickets,
      isAiReady,
      customViews: sidebarPrefs.customViews,
    }),
    [user?.uid, watchedTicketIds, allTickets, isAiReady, sidebarPrefs.customViews],
  );

  // Compute tickets filtered ONLY by the current active sidebar view category
  const baseSidebarTickets = useMemo(() => {
    if (!user) return [];
    return filterTicketsByView(supportTickets, activeView, viewFilterContext);
  }, [supportTickets, activeView, user, viewFilterContext]);

  const ticketQueueStats = useMemo(
    () => computeTicketQueueStats(baseSidebarTickets),
    [baseSidebarTickets],
  );

  // Subscribe to all tickets
  useEffect(() => {
    if (!user || permsLoading) return;
    setLoading(true);

    const scope = (role?.visibilityScope === 'assigned' || role?.name === 'Restricted Agent') ? 'assigned' : 'all';

    return ticketService.subscribeToTickets((tickets) => {
      setAllTickets(tickets);
      setLoading(false);
    }, { scope, agentId: user.uid });
  }, [user, permsLoading, role]);

  // Subscribe to KB Articles
  useEffect(() => {
    return kbService.subscribeToArticles(setKbArticles);
  }, []);

  // Subscribe to messages when a ticket is selected
  useEffect(() => {
    if (!selectedTicketId) {
      setMessages([]);
      return;
    }
    return ticketService.subscribeToMessages(selectedTicketId, (msgs) => {
      setMessages(msgs);
    });
  }, [selectedTicketId]);

  useEffect(() => {
    const handleConfigChange = () => setModuleConfig(getModuleConfig());
    window.addEventListener('module-config-changed', handleConfigChange);
    return () => window.removeEventListener('module-config-changed', handleConfigChange);
  }, []);

  const [hoveredTicketId, setHoveredTicketId] = useState<string | null>(null);
  const [peekMessages, setPeekMessages] = useState<Message[]>([]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (hoveredTicketId) {
      const unsub = ticketService.subscribeToMessages(hoveredTicketId, (msgs) => {
        setPeekMessages(msgs.slice(-2).reverse());
      });
      return unsub;
    } else {
      setPeekMessages([]);
    }
  }, [hoveredTicketId]);

  const handleMouseMove = (e: MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const hoveredTicket = allTickets.find(t => t.id === hoveredTicketId);

  // Compute final tickets after applying the top sub-status filter, search query, and advanced filters drawer
  const finalRenderedTickets = useMemo(() => {
    if (!user) return [];
    
    let result = filterTicketsByTopStatus([...baseSidebarTickets], topStatusFilter);

    // Live search filtering
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.subject.toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query) ||
        (t.customerName && t.customerName.toLowerCase().includes(query)) ||
        (t.company && t.company.toLowerCase().includes(query)) ||
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(query))) ||
        (t.description && t.description.toLowerCase().includes(query))
      );
    }

    // Advanced Filters from Drawer
    if (filters.agent !== 'any') {
      result = result.filter(t => t.agentName === filters.agent || t.agentId === filters.agent);
    }
    if (filters.status !== 'any') {
      result = result.filter(t => matchStatus(t.status, filters.status));
    }
    if (filters.priority !== 'any') {
      result = result.filter(t => t.priority === filters.priority);
    }
    if (filters.group !== 'any') {
      result = result.filter(t => t.team === filters.group.toLowerCase());
    }
    if (filters.sentiment !== 'any') {
      result = result.filter(t => t.sentiment === filters.sentiment);
    }
    if (filters.type !== 'any') {
      result = result.filter(t => (t as any).type === filters.type);
    }
    if (filters.language !== 'any') {
      result = result.filter(t => (t as any).originalLanguage === filters.language);
    }
    if (filters.company !== 'any') {
      result = result.filter(t => t.company === filters.company);
    }
    if (filters.source !== 'any') {
      result = result.filter(t => t.channel === filters.source);
    }
    if (filters.tags !== 'any') {
      result = result.filter(t => hasTagCaseInsensitive(t.tags, filters.tags));
    }
    if (filters.product !== 'any') {
      result = result.filter(t => (t as any).product === filters.product);
    }
    if (filters.contacts !== 'any') {
      result = result.filter(t => t.customerName === filters.contacts);
    }
    
    if (filters.closedAt !== 'any') {
      const now = new Date();
      result = result.filter(t => {
        if (!t.closedAt) return false;
        const closedAt = t.closedAt.toDate ? t.closedAt.toDate() : new Date(t.closedAt);
        const diff = now.getTime() - closedAt.getTime();
        switch (filters.closedAt) {
          case 'today': return closedAt.toDateString() === now.toDateString();
          case 'yesterday': 
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            return closedAt.toDateString() === yesterday.toDateString();
          case 'week': return diff < (7 * 24 * 60 * 60 * 1000);
          default: return true;
        }
      });
    }

    if (filters.resolvedAt !== 'any') {
      const now = new Date();
      result = result.filter(t => {
        if (!t.resolvedAt) return false;
        const resolvedAt = t.resolvedAt.toDate ? t.resolvedAt.toDate() : new Date(t.resolvedAt);
        switch (filters.resolvedAt) {
          case 'today': return resolvedAt.toDateString() === now.toDateString();
          default: return true;
        }
      });
    }
    
    if (filters.created !== 'any') {
      const now = new Date();
      result = result.filter(t => {
        const createdAt = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
        switch (filters.created) {
          case '24h': return (now.getTime() - createdAt.getTime()) < (24 * 60 * 60 * 1000);
          case '7d': return (now.getTime() - createdAt.getTime()) < (7 * 24 * 60 * 60 * 1000);
          case '30d': return (now.getTime() - createdAt.getTime()) < (30 * 24 * 60 * 60 * 1000);
          default: return true;
        }
      });
    }

    if (filters.slaDue !== 'any') {
      const now = new Date();
      result = result.filter(t => {
        if (!t.slaDueAt && !t.firstResponseDue) return false;
        const dueAt = (t.slaDueAt || t.firstResponseDue).toDate ? (t.slaDueAt || t.firstResponseDue).toDate() : new Date(t.slaDueAt || t.firstResponseDue);
        const diff = dueAt.getTime() - now.getTime();
        switch (filters.slaDue) {
          case '1h': return diff > 0 && diff < (1 * 60 * 60 * 1000);
          case '4h': return diff > 0 && diff < (4 * 60 * 60 * 1000);
          case '24h': return diff > 0 && diff < (24 * 60 * 60 * 1000);
          default: return true;
        }
      });
    }

    if (filters.aiConfidence !== 'any') {
      result = result.filter(t => {
        const confidence = t.aiConfidence ?? 1;
        if (filters.aiConfidence === 'low') return confidence < 0.7;
        if (filters.aiConfidence === 'high') return confidence >= 0.7;
        return true;
      });
    }

    if (filters.sourceInfo) {
      const info = filters.sourceInfo.toLowerCase();
      result = result.filter(t => 
        (t as any).sourceInfo?.toLowerCase().includes(info) ||
        t.subject.toLowerCase().includes(info)
      );
    }

    result.sort((a, b) => {
      if (listSort === 'priority') {
        const rank = (p?: string) =>
          p === 'urgent' ? 4 : p === 'high' ? 3 : p === 'medium' ? 2 : 1;
        return rank(b.priority) - rank(a.priority);
      }
      const aTime = a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : 0;
      const bTime = b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : 0;
      return listSort === 'oldest' ? aTime - bTime : bTime - aTime;
    });

    return result;
  }, [baseSidebarTickets, topStatusFilter, searchQuery, filters, user, listSort, allTickets]);

  const getFilteredTickets = () => {
    return finalRenderedTickets;
  };

  const getViewCount = (view: string) => {
    if (!user) return 0;
    return countTicketsByView(supportTickets, view, viewFilterContext);
  };

  const tickets = getFilteredTickets();
  const totalTicketsCount = tickets.length;
  const startIdx = totalTicketsCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalTicketsCount);
  const paginatedTickets = tickets.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(totalTicketsCount / pageSize) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [totalTicketsCount, pageSize]);

  const selectedTicket = allTickets.find(t => t.id === selectedTicketId) as any;

  const handleChecklistUpdated = useCallback(
    (aiChecklist: TicketChecklistItem[]) => {
      if (!selectedTicketId) return;
      setAllTickets((prev) =>
        prev.map((row) => (row.id === selectedTicketId ? { ...row, aiChecklist } : row)),
      );
    },
    [selectedTicketId],
  );

  useEffect(() => {
    if (selectedTicket?.companyId) {
      customerService.getCompany(selectedTicket.companyId).then(setTicketCompany);
    } else {
      setTicketCompany(null);
    }
    if (selectedTicket?.contactId) {
      customerService.getContact(selectedTicket.contactId).then(setTicketContact);
    } else {
      setTicketContact(null);
    }
  }, [selectedTicket?.companyId, selectedTicket?.contactId]);

  useEffect(() => {
    if (selectedTicketId) {
      navigate(`/tickets/${selectedTicketId}`);
      updateSummary();
    }
  }, [selectedTicketId, selectedTicket, messages.length]); // Added dependencies

  // Polyglot Bridge: Native UI Translation
  useEffect(() => {
    const translateTicket = async () => {
      if (!selectedTicket || agentLanguage === 'English') {
        setTranslatedTicket(null);
        return;
      }

      setIsTranslating(true);
      try {
        const [subject, description] = await Promise.all([
          ai.translate(selectedTicket.subject, agentLanguage, 'Professional'),
          ai.translate(selectedTicket.description, agentLanguage, 'Professional')
        ]);
        setTranslatedTicket({ subject, description });
        logAudit({ module: 'tickets', action: 'polyglot_ui_translate', details: { ticketId: selectedTicketId, language: agentLanguage } });
      } catch (e) {
        console.error("Polyglot UI Error:", e);
      } finally {
        setIsTranslating(false);
      }
    };

    translateTicket();
  }, [selectedTicketId, agentLanguage, selectedTicket]);

  // Polyglot Bridge: Ghostwriting in Reverse (Live Translation)
  useEffect(() => {
    if (!replyText.trim() || agentLanguage === 'English' || !selectedTicket) {
      setLiveTranslation('');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const targetLang = (selectedTicket as any).originalLanguage || 'English';
        const translation = await ai.translate(replyText, targetLang, translationMood);
        setLiveTranslation(translation);
      } catch (e) {
        console.error("Ghostwriting Error:", e);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [replyText, agentLanguage, translationMood, selectedTicket]);

  // Polyglot Bridge: Incoming Message Translation
  useEffect(() => {
    const translateMessages = async () => {
      if (agentLanguage === 'English' || messages.length === 0) {
        setTranslatedMessages({});
        return;
      }

      // Find messages that need translation (customer messages or other agents)
      // Only translate if they aren't already in translatedMessages
      const untranslated = messages.filter(m => !translatedMessages[m.id]);
      if (untranslated.length === 0) return;

      try {
        const translations = await Promise.all(
          untranslated.map(m => ai.translate(m.content, agentLanguage, 'Professional'))
        );
        
        setTranslatedMessages(prev => {
          const next = { ...prev };
          untranslated.forEach((m, i) => {
            next[m.id] = translations[i];
          });
          return next;
        });
      } catch (e) {
        console.error("Polyglot Message Error:", e);
      }
    };

    translateMessages();
  }, [messages, agentLanguage]);

  const updateSummary = async (forceRefresh = false) => {
    if (!selectedTicketId || !selectedTicket) return;

    if (!forceRefresh && selectedTicket.aiSummary) {
      setAiSummary(selectedTicket.aiSummary);
      return;
    }

    try {
      setIsAiDrafting(true);
      const messagesText = buildTicketMessagesText(messages);
      const prompt = buildTicketDeepDivePrompt(selectedTicket, messagesText);
      const lifecycleResult = await executeTicketDeepDiveAnalysis(selectedTicketId, prompt, {
        forceRefresh,
      });

      if (lifecycleResult.status === 'pending_approval') {
        toast.info('AI analysis requires approval before it can be delivered.');
        return;
      }
      if (lifecycleResult.status === 'pending_review') {
        toast.info('AI analysis is queued for human review.');
      }

      const rawOutput = resolveLifecycleOutput(lifecycleResult);
      const analysis = parseTicketAnalysisOutput(rawOutput, selectedTicket);
      setAiSummary(analysis.aiSummary);

      const patch = ticketAnalysisPatch(analysis);
      await ticketService.updateTicket(selectedTicketId, patch);
      setAllTickets((prev) =>
        prev.map((t) => (t.id === selectedTicketId ? { ...t, ...patch } : t)),
      );
    } catch (e) {
      console.error('Failed to load/generate AI summary via lifecycle cache pipeline:', e);
      setAiSummary('Unable to generate summary. Check AI configuration.');
    } finally {
      setIsAiDrafting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (selectedTicketId) {
        ticketService.setPresence(selectedTicketId, false);
      }
    };
  }, [selectedTicketId]);

  const initiateHandoff = async (id: string, data: any) => {
    // Only trigger handoff if agentId or agentName is being updated
    if (data.agentId !== undefined || data.agentName !== undefined) {
      setPendingAgentUpdate({ id, data });
      setIsHandoffOpen(true);
      setIsGeneratingHandoff(true);
      try {
        const response = await axios.post(`/api/tickets/${id}/handoff-summary`);
        setHandoffSummary(response.data);
      } catch (e) {
        toast.error("Failed to generate handoff summary");
        setIsHandoffOpen(false);
        // Fallback: update anyway if AI fails? User requirement says high-priority briefing, 
        // so maybe we just allow manual update if AI fails, but let's keep it simple for now.
      } finally {
        setIsGeneratingHandoff(false);
      }
    } else {
      ticketService.updateTicket(id, data);
    }
  };

  const confirmHandoff = async () => {
    if (!pendingAgentUpdate || !selectedTicketId) return;

    try {
      // 1. Update the ticket assignee
      await ticketService.updateTicket(pendingAgentUpdate.id, pendingAgentUpdate.data);
      
      // 2. Save the Golden Note if we have a summary
      if (handoffSummary) {
        const content = `[NEXUS HANDOFF BRIEFING]\n\nCUSTOMER GOAL: ${handoffSummary.customerGoal}\n\nEFFORT SO FAR:\n${handoffSummary.effortSoFar.map(e => `• ${e}`).join('\n')}`;
        await axios.post(`/api/tickets/${selectedTicketId}/golden-note`, {
          content,
          authorId: user?.uid,
          authorName: user?.email || 'System'
        });
        toast.success("Handoff successful and Golden Note saved.");
      } else {
        toast.success("Handoff successful.");
      }
    } catch (e) {
      toast.error("Handoff failed.");
    } finally {
      setIsHandoffOpen(false);
      setPendingAgentUpdate(null);
      setHandoffSummary(null);
    }
  };

  const openFullTicketView = (id: string) => {
    if (selectedTicketId && selectedTicketId !== id) {
      ticketService.setPresence(selectedTicketId, false);
    }
    setDrawerTicketId(null);
    setSelectedTicketId(id);
    setActiveDetailTab('conversation');
    setIsMobileSidebarOpen(false);
    setHoveredTicketId(null);
    setPeekMessages([]);
    setReplyText('');
    setLegalViolation(null);
    setGhostDraft('');
    setAiSources([]);
    ticketService.setPresence(id, true);
    navigate(`/tickets/${id}`);
    autoGenerateZeroDraft(id);
  };

  const closeFullTicketView = () => {
    if (selectedTicketId) {
      ticketService.setPresence(selectedTicketId, false);
    }
    setDrawerTicketId(null);
    setSelectedTicketId(null);
    navigate('/tickets');
  };

  const closeCreateTicket = useCallback(() => {
    setIsCreateTicketOpen(false);
  }, []);

  const openCreateTicket = useCallback(() => {
    if (selectedTicketId) {
      ticketService.setPresence(selectedTicketId, false);
    }
    setDrawerTicketId(null);
    setSelectedTicketId(null);
    navigate('/tickets');
    setIsCreateTicketOpen(true);
  }, [navigate, selectedTicketId]);

  const handleTicketSelect = (id: string) => {
    if (selectedTicketIds.length > 0) {
      toggleTicketSelection(id);
      return;
    }
    if (selectedTicketId) {
      ticketService.setPresence(selectedTicketId, false);
    }
    if (id) {
      ticketService.setPresence(id, true);
    }

    setHoveredTicketId(null);
    setPeekMessages([]);
    setReplyText('');
    setLegalViolation(null);
    setGhostDraft('');
    setAiSources([]);

    if (id && !isMobile) {
      setDrawerTicketId(id);
      setActiveDetailTab('conversation');
      autoGenerateZeroDraft(id);
      return;
    }

    if (id) {
      openFullTicketView(id);
    } else {
      closeFullTicketView();
    }
  };

  useEffect(() => {
    if (ticketId) {
      setSelectedTicketId(prev => {
        if (prev !== ticketId) {
          setActiveDetailTab('conversation');
          setHoveredTicketId(null);
          setPeekMessages([]);
          setReplyText('');
          setLegalViolation(null);
          setGhostDraft('');
          setAiSources([]);
          autoGenerateZeroDraft(ticketId);
          
          if (prev) {
            ticketService.setPresence(prev, false);
          }
          ticketService.setPresence(ticketId, true);
        }
        return ticketId;
      });
    } else {
      setSelectedTicketId(prev => {
        if (prev) {
          ticketService.setPresence(prev, false);
        }
        return null;
      });
    }
  }, [ticketId]);

  const autoGenerateZeroDraft = async (ticketId: string) => {
    if (!isAiReady) {
      console.log("AI is not configured. Skipping zero-draft generation.");
      return;
    }
    const ticket = allTickets.find(t => t.id === ticketId);
    if (!ticket) return;

    setIsGhostDrafting(true);
    try {
      // Feature: RAG logic - Linking Tickets & Knowledge Base to AI
      const relevantContext = ragService.findRelevantContext(
        `${ticket.subject} ${ticket.description}`, 
        kbArticles, 
        allTickets
      );
      
      const kbContent = relevantContext.map(c => `[Source: ${c.sourceTitle} (${c.source})]\n${c.text}`).join('\n\n');

      let currentContact = ticketContact;
      if (!currentContact && ticket.contactId) {
        currentContact = await customerService.getContact(ticket.contactId);
      }

      const response = await ai.generateDraft({
        subject: ticket.subject,
        description: ticket.description,
        ticketId: ticket.id,
        kbContent: kbContent,
        threadHistory: messages.map(m => m.content),
        customerMetadata: currentContact?.metadata
      });
      
      setGhostDraft(redactPII(response.text));
      setAiSources(response.sources);
    } catch (e) {
      console.error("Zero-Draft Error:", e);
    } finally {
      setIsGhostDrafting(false);
    }
  };

  const acceptGhostDraft = () => {
    if (ghostDraft && !replyText) {
      setReplyText(ghostDraft);
      setGhostDraft('');
      toast.success("AI draft accepted (Tab)");
    }
  };

  const handleUpdateMasterTicket = async () => {
    if (!selectedTicket?.isMasterTicket || !selectedTicket?.linkedTicketIds?.length) return;
    
    toast.info(`AI Triggered: Notifying ${selectedTicket.linkedTicketIds.length} linked ticket holders.`);
    
    for (const linkedId of selectedTicket.linkedTicketIds) {
      await ticketService.updateTicket(linkedId, { 
        status: 'resolved',
        internalNotes: (selectedTicket.internalNotes || '') + "\n\n[Neural Link Update]: Issue resolved in Master Ticket #" + selectedTicket.id
      });
    }
  };

  const findNeuralLinks = async () => {
    if (!selectedTicket || isFindingNeuralLinks) return;
    setIsFindingNeuralLinks(true);
    try {
      const suggestions = await suggestNeuralLinks(selectedTicket);
      setSuggestedNeuralLinks(suggestions);
    } catch (error) {
      toast.error("Failed to find neural links.");
    } finally {
      setIsFindingNeuralLinks(false);
    }
  };

  const linkTicket = async (targetId: string) => {
    if (!selectedTicket) return;
    
    const existingLinks = selectedTicket.linkedTicketIds || [];
    if (existingLinks.includes(targetId)) {
      toast.warning("Ticket already linked.");
      return;
    }

    try {
      await ticketService.updateTicket(selectedTicket.id, {
        linkedTicketIds: [...existingLinks, targetId],
        isMasterTicket: true 
      });

      await ticketService.updateTicket(targetId, {
        masterTicketId: selectedTicket.id
      });

      toast.success(`Successfully linked ticket #${targetId}`);
      setLinkInput('');
      setSuggestedNeuralLinks(prev => prev.filter(s => s.ticketId !== targetId));
    } catch (error) {
      toast.error("Failed to link ticket.");
    }
  };

  const unlinkTicket = async (targetId: string) => {
    if (!selectedTicket) return;
    
    try {
      const newLinks = (selectedTicket.linkedTicketIds || []).filter(id => id !== targetId);
      await ticketService.updateTicket(selectedTicket.id, {
        linkedTicketIds: newLinks,
        isMasterTicket: newLinks.length > 0
      });

      await ticketService.updateTicket(targetId, {
        masterTicketId: null
      });

      toast.success(`Unlinked ticket #${targetId}`);
    } catch (error) {
      toast.error("Failed to unlink ticket.");
    }
  };

  const openTicket = (id: string) => {
    setSelectedTicketId(id);
  };

  const handleMerge = async (destinationId: string) => {
    if (!selectedTicketId) return;
    
    const loadingToast = toast.loading("Executing The Unifier: Merging tickets...");
    try {
      await ticketService.mergeTickets(selectedTicketId, destinationId);
      toast.success(`Successfully merged into #${destinationId.slice(-5)}`, { id: loadingToast });
      setIsMergeDialogOpen(false);
      setSelectedTicketId(destinationId); // Move to the target ticket
    } catch (e) {
      toast.error("Merge operation failed.", { id: loadingToast });
    }
  };

  const generateAiReply = async () => {
    if (!selectedTicket) return;
    
    setIsAiDrafting(true);
    try {
      // Feature: RAG logic - Linking Tickets & Knowledge Base to AI
      const relevantContext = ragService.findRelevantContext(
        `${selectedTicket.subject} ${selectedTicket.description}`, 
        kbArticles, 
        allTickets
      );
      
      const kbContent = relevantContext.map(c => `[Source: ${c.sourceTitle} (${c.source})]\n${c.text}`).join('\n\n');

      const response = await ai.generateDraft({
        subject: selectedTicket.subject,
        description: selectedTicket.description,
        ticketId: selectedTicket.id,
        kbContent: kbContent,
        threadHistory: messages.map(m => m.content)
      });
      
      if (isTextSensitive(response.text)) {
        toast.info("PII Shield: Redacted sensitive data from AI draft.");
      }
      
      setAiSources(response.sources);
      setReplyText(redactPII(response.text));
      toast.success("AI Draft generated with verified sources.");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate AI draft. Check your API key.");
    } finally {
      setIsAiDrafting(false);
    }
  };

  const handleConvertToKB = async () => {
    if (!selectedTicket) return;
    
    setIsKbDrafting(true);
    try {
      const draft = await ai.generateKBArticle({
        subject: selectedTicket.subject,
        description: selectedTicket.description,
        threadHistory: messages.map(m => m.content)
      });
      
      setKbDraft(draft);
      setShowKbDialog(true);
    } catch (e) {
      console.error(e);
      toast.error("Knowledge conversion failed. Check AI settings.");
    } finally {
      setIsKbDrafting(false);
    }
  };

  const saveKBArticle = async () => {
    if (!kbDraft || !user) return;
    
    try {
      await kbService.createArticle({
        ...kbDraft,
        authorId: user.uid,
        category: 'Getting Started',
        tags: ['extracted']
      });
      toast.success("Article saved to Knowledge Base!");
      setShowKbDialog(false);
      setKbDraft(null);
    } catch (e) {
      toast.error("Failed to save article.");
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedTicketId || !user) return;
    
    // Legal Guardrail Interceptor
    setIsValidatingLegal(true);
    setLegalViolation(null);
    try {
      const validation = await validateDraft(replyText, selectedTicketId);
      if (!validation.isValid) {
        setLegalViolation(validation);
        setIsValidatingLegal(false);
        toast.error("Policy Violation Detected", {
          description: validation.violationDetail,
          duration: 5000
        });
        
        // Highlight forbidden text if found
        if (validation.forbiddenText) {
          const highlighted = replyText.replace(
            new RegExp(`(${validation.forbiddenText})`, 'gi'), 
            '<strong style="color: #ef4444; background: #fee2e2; padding: 0 4px; border-radius: 4px;">$1 [Policy Violation]</strong>'
          );
          setReplyText(highlighted);
        }
        return; // Block send
      }
    } catch (e) {
      console.error("Legal validation skip due to error:", e);
    } finally {
      if (legalViolation?.isValid === false) return; // Prevent double trigger if we blocked
    }

    setIsValidatingLegal(false);

    let contentToSend = replyText;
    let originalContent = undefined;
    
    // Polyglot: If agent is writing in native language, send translated version to client
    if (agentLanguage !== 'English' && selectedTicket) {
        originalContent = replyText;
        const targetLang = (selectedTicket as any).originalLanguage || 'English';
        
        if (liveTranslation) {
            contentToSend = liveTranslation;
        } else {
            try {
                contentToSend = await ai.translate(replyText, targetLang, translationMood);
            } catch (e) {
                console.error("Polyglot Send Error:", e);
            }
        }
    }

    const tempId = `temp-${Date.now()}`;
    const now = new Date();
    const optimisticMessage: Message = {
      id: tempId,
      ticketId: selectedTicketId,
      senderId: user.uid,
      senderType: 'agent',
      senderName: user.displayName || user.email || 'Agent',
      content: contentToSend,
      originalContent: originalContent,
      createdAt: { toDate: () => now } as any
    };

    // Cache current states to rollback on failure
    const cachedReplyText = replyText;
    const cachedLiveTranslation = liveTranslation;

    // 1. Optimistic message append so it shows up on-screen instantly
    setMessages(prev => [...prev.filter(m => m.id !== tempId), optimisticMessage]);

    // 2. Immediately clear editor content and collapse composer window
    setReplyText("");
    setLiveTranslation("");
    setIsComposerExpanded(false);

    try {
      await ticketService.sendMessage(selectedTicketId, {
        ticketId: selectedTicketId,
        senderId: user.uid,
        senderType: 'agent',
        senderName: user.displayName || user.email || 'Agent',
        content: contentToSend,
        originalContent: originalContent
      });
      
      logAudit({ module: 'tickets', action: 'message_sent', details: { ticketId: selectedTicketId, wasTranslated: !!originalContent } });
      toast.success("Reply sent (translated for client).");
    } catch (e) {
      // Rollback on write failure
      setReplyText(cachedReplyText);
      setLiveTranslation(cachedLiveTranslation);
      setIsComposerExpanded(true);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast.error("Failed to send reply.");
    }
  };

  const takeOwnership = async () => {
    if (!selectedTicketId || !user) return;
    try {
      await ticketService.updateTicket(selectedTicketId, {
        agentId: user.uid,
        agentName: user.displayName || user.email || 'Agent'
      });
      toast.success("Ticket assigned to you.");
    } catch (e) {
      toast.error("Failed to assign ticket.");
    }
  };

  const toggleTicketSelection = (id: string) => {
    setSelectedTicketIds(prev => {
      const next = prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id];
      if (next.length === 0) {
        setHeaderCheckboxActive(false);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (headerCheckboxActive) {
      setHeaderCheckboxActive(false);
      setSelectedTicketIds([]);
    } else {
      setHeaderCheckboxActive(true);
      setSelectedTicketIds(tickets.map(t => t.id));
    }
  };

  const handleAddAgentComment = async () => {
    if (!newAgentComment.trim() || !selectedTicketId || !user) return;
    try {
        await ticketService.addAgentComment(selectedTicketId, {
            content: newAgentComment,
            agentName: user.displayName || user.email || 'Agent',
            agentId: user.uid
        });
        setNewAgentComment("");
        toast.success("Internal comment added.");
    } catch (e) {
        toast.error("Failed to add comment.");
    }
  };

  const handleBulkUpdate = async (updates: Partial<TicketType>) => {
    if (selectedTicketIds.length === 0) return;
    
    const loadingToast = toast.loading(`Updating ${selectedTicketIds.length} tickets...`);
    try {
      await Promise.all(selectedTicketIds.map(id => ticketService.updateTicket(id, updates)));
      toast.success(`Successfully updated ${selectedTicketIds.length} tickets`, { id: loadingToast });
      setSelectedTicketIds([]);
    } catch (e) {
      toast.error("Failed to perform bulk update", { id: loadingToast });
    }
  };

  const handleLegalExport = async () => {
    if (!selectedTicketId) return;
    const loadingToast = toast.loading("Preparing compliant legal archive...");
    try {
      const response = await axios.get(`/api/tickets/${selectedTicketId}/export`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `GeistDesk_Legal_Export_${selectedTicketId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Legal archive exported successfully (GoBD Compliant)", { id: loadingToast });
    } catch (e) {
      toast.error("Legal export failed. Check server logs.", { id: loadingToast });
    }
  };

  return (
    <div className="flex flex-1 min-h-0 w-full overflow-hidden bg-background">
      <TicketsLeftSidebar
        effectiveCollapsed={effectiveCollapsed}
        collapsedGroups={collapsedGroups}
        toggleGroup={toggleGroup}
        activeView={activeView}
        onViewChange={handleViewChange}
        getViewCount={getViewCount}
        favoriteViewIds={sidebarPrefs.favoriteViewIds}
        onToggleFavorite={toggleFavorite}
        onReorderFavorites={reorderFavorites}
        groupOrder={sidebarPrefs.groupOrder}
        hiddenGroupIds={sidebarPrefs.hiddenGroupIds}
        customViews={sidebarPrefs.customViews}
        onOpenManageViews={() => setIsManageViewsOpen(true)}
        selectedTicketId={selectedTicketId}
        isMobileSidebarOpen={isMobileSidebarOpen}
        footer={
          moduleConfig.polyglotEnabled ? (
            <div className={cn('mt-auto p-4 border-t border-border bg-card/50', effectiveCollapsed && 'p-2')}>
              {!effectiveCollapsed && (
                <div className="flex items-center gap-2 mb-3">
                  <Languages className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Polyglot Bridge
                  </span>
                </div>
              )}
              <div className={cn('flex flex-wrap gap-2', effectiveCollapsed && 'flex-col items-center')}>
                {moduleConfig.languages
                  .filter((l) => l.enabled)
                  .map((f) => (
                    <button
                      key={f.lang}
                      type="button"
                      onClick={() => setAgentLanguage(f.lang)}
                      className={cn(
                        'h-8 w-8 rounded-full border border-transparent hover:bg-card flex items-center justify-center text-sm shadow-none transition-all shrink-0',
                        agentLanguage === f.lang && 'border-primary bg-card shadow-sm scale-110',
                      )}
                      title={`${t('settings.polyglotBridge', 'Polyglot Bridge')}: ${f.lang}`}
                    >
                      <FlagIcon code={f.flagCode || languageToFlagCode(f.lang)} className="w-5 h-3.5" />
                    </button>
                  ))}
              </div>
            </div>
          ) : undefined
        }
      />

      <TicketsSidebarManageSheet
        open={isManageViewsOpen}
        onOpenChange={setIsManageViewsOpen}
        favoriteViewIds={sidebarPrefs.favoriteViewIds}
        hiddenGroupIds={sidebarPrefs.hiddenGroupIds}
        groupOrder={sidebarPrefs.groupOrder}
        collapsedGroups={sidebarPrefs.collapsedGroups}
        customViews={sidebarPrefs.customViews}
        onToggleGroupVisibility={toggleGroupVisibility}
        onReorderGroups={reorderGroups}
        onSetGroupCollapsed={setGroupCollapsed}
        onAddCustomView={addCustomView}
        onUpdateCustomView={updateCustomView}
        onRemoveCustomView={removeCustomView}
      />

      {/* Main Content Area: Conditional Master-Detail */}
      <div className={cn(
        "min-h-0 bg-background text-foreground flex flex-col",
        isMobileSidebarOpen ? "hidden md:flex md:flex-1" : "w-full flex-1 flex flex-col min-h-0"
      )}>
        {isCreateTicketOpen ? (
          <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#F8F9FB] overflow-hidden">
            <div className="px-4 md:px-6 pt-4 md:pt-5 pb-3 border-b border-slate-100 bg-white shrink-0">
              <button
                type="button"
                onClick={closeCreateTicket}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-800 font-extrabold text-xs cursor-pointer transition-colors select-none group"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-slate-450 group-hover:text-slate-650 transition-colors" />
                {t('tickets.detail.backToList', 'Back to tickets')}
              </button>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <CreateTicketDialog
                isOpen={isCreateTicketOpen}
                onClose={closeCreateTicket}
                presentation="inline"
                prefetchedCompanies={createTicketCompanies}
                prefetchedAgents={createTicketAgents}
              />
            </ScrollArea>
          </div>
        ) : selectedTicketId ? (
          /* Detail View */
          <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
            {selectedTicket ? (
              <div className="flex-1 flex flex-row min-h-0 min-w-0">
                <div className="flex-1 flex flex-col min-h-0 min-w-0">
                  {/* 1. Header component */}
                <div className="px-4 md:px-6 pt-4 md:pt-5 pb-3 border-b border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900 shrink-0">
                  <button 
                    type="button"
                    onClick={closeFullTicketView}
                    className="flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-extrabold text-xs cursor-pointer mb-2 transition-colors select-none group"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-slate-450 group-hover:text-slate-650 transition-colors" /> {t('tickets.detail.backToList', 'Back to tickets')}
                  </button>
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="flex items-center gap-2 md:gap-3 overflow-hidden min-w-0 flex-1">
                      <h2 className="text-xl font-extrabold text-slate-950 dark:text-slate-50 truncate tracking-tight">{selectedTicket.subject}</h2>
                      <span className="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300 px-3 py-1 rounded-md text-[11px] font-extrabold select-none shrink-0 capitalize">
                        {selectedTicket.status || 'New'}
                      </span>
                      <span className="bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-350 px-3 py-1 rounded-md text-[11px] font-extrabold select-none shrink-0 capitalize">
                        {selectedTicket.priority || 'High Priority'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setActiveDetailTab('conversation');
                          setIsComposerExpanded(true);
                          setTimeout(() => {
                            const noteEl = document.getElementById('quick-internal-note-input') || document.getElementById('email-reply-composer');
                            if (noteEl) noteEl.scrollIntoView({ behavior: 'smooth' });
                          }, 100);
                          toast.info(t('tickets.detail.switchedToComposer', 'Switched to conversation notes composer.'));
                        }}
                        className="h-9 px-3 rounded-lg border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
                      >
                        {t('tickets.noteBtn', 'Internal Note')}
                      </Button>
                      <Button 
                        onClick={async () => {
                          toast.promise(
                            updateSummary(true),
                            {
                              loading: 'Syncing AI Erkenntnisse with latest email thread...',
                              success: 'AI Erkenntnisse successfully updated!',
                              error: 'Failed to sync AI Erkenntnisse.'
                            }
                          );
                        }}
                        disabled={isAiDrafting}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 text-white font-extrabold text-xs h-9 px-3 rounded-lg flex items-center gap-1.5 transition-all shadow-sm select-none"
                      >
                        {isAiDrafting ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>{t('tickets.detail.aiSync', 'AI Sync')}</span>
                      </Button>

                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setIsMobilePropertiesOpen(prev => !prev)}
                        className="xl:hidden h-9 px-3 rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                        <span>{isMobilePropertiesOpen ? t('tickets.detail.closeProps', 'Close properties') : t('tickets.detail.properties', 'Properties')}</span>
                      </Button>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 font-bold mt-1 tracking-wide uppercase select-none">
                    {selectedTicket.company || 'Enterprise Corp'} &bull; {selectedTicket.customerName || 'PremtonXhafa'}
                  </div>
                </div>

                {/* 2. Horizontal Tabs Menu Bar */}
                <div className="px-6 border-b border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900 shrink-0 flex items-center justify-between h-[48px] select-none">
                  <div className="flex items-center gap-1 h-full overflow-x-auto custom-scrollbar">
                    {([
                      { id: 'conversation', labelKey: 'overview' },
                      { id: 'customer', labelKey: 'customer' },
                      { id: 'timeline', labelKey: 'timeline' },
                      { id: 'ai_insights', labelKey: 'aiInsights' },
                      { id: 'assets', labelKey: 'assets' },
                      { id: 'related_tickets', labelKey: 'neuralLinks' },
                      { id: 'tasks', labelKey: 'tasks' }
                    ] as const).map(tab => (
                      <button
                        key={tab.id}
                        className={cn(
                          "h-full px-4 text-xs font-extrabold border-b-2 transition-all shrink-0 hover:text-slate-800 flex items-center gap-2 relative",
                          activeDetailTab === tab.id 
                            ? "border-blue-600 text-blue-600" 
                            : "border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                        )}
                        onClick={() => {
                          setActiveDetailTab(tab.id);
                        }}
                      >
                        {t(`tickets.tabs.${tab.labelKey}`, tab.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>

             <header className="px-6 py-4 border-b bg-card flex items-center justify-between shrink-0 h-[64px]" style={{ display: 'none' }}>
                    <div className="flex items-center gap-3 overflow-hidden">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-9 gap-2 text-muted-foreground hover:bg-muted px-3 rounded-lg" 
                        onClick={() => setSelectedTicketId(null)}
                      >
                        <ChevronDown className="w-4 h-4 rotate-90" />
                        <span className="text-sm font-semibold">Back to {activeView.replace('_', ' ')}</span>
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-full h-9 font-bold text-primary border-border hover:bg-muted transition-all group"
                    onClick={handleConvertToKB}
                    disabled={isKbDrafting || !isAiReady}
                    title={!isAiReady ? "AI Model Orchestrator is not configured" : undefined}
                  >
                    <BookOpen className="w-3.5 h-3.5 mr-2 text-primary group-hover:scale-110 transition-transform" />
                    {isKbDrafting ? 'Extracting...' : !isAiReady ? 'Convert to KB (AI Not Configured)' : 'Convert to KB'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-full h-9 font-bold text-primary border-border hover:bg-muted transition-all"
                    onClick={generateAiReply}
                    disabled={isAiDrafting || !isAiReady}
                    title={!isAiReady ? "AI Model Orchestrator is not configured" : undefined}
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-2 text-primary" />
                    {isAiDrafting ? 'Drafting...' : !isAiReady ? 'Draft with AI (AI Not Configured)' : 'Draft with AI'}
                  </Button>
                  <div className="w-px h-6 bg-border mx-1"></div>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={
                      <button className="flex items-center justify-center h-9 w-9 text-muted-foreground rounded-full hover:bg-muted transition-all cursor-pointer focus:outline-none">
                        <UserPlus className="w-5 h-5" />
                      </button>
                    } />
                    <DropdownMenuContent align="end" className="w-48 rounded-xl p-2 shadow-lg border-border">
                      <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Assign Active Agent</div>
                      <DropdownMenuItem className="rounded-lg text-sm transition-all hover:bg-accent hover:text-primary">
                         <UserRound className="w-4 h-4 mr-2" />
                         John Doe (You)
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-lg text-sm transition-all hover:bg-accent hover:text-primary">
                         <UserRound className="w-4 h-4 mr-2" />
                         Sarah Support
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-lg text-sm transition-all hover:bg-accent hover:text-primary">
                         <UserRound className="w-4 h-4 mr-2" />
                         Mike Engineer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground rounded-full hover:bg-muted text-destructive hover:text-destructive"
                    onClick={() => toast.info("Help request broadcasted to the Workspace team.")}
                  >
                    <PhoneCall className="w-5 h-5" />
                  </Button>
                  <div className="w-px h-6 bg-border mx-1"></div>
                  <Button variant="ghost" size="icon" className="text-muted-foreground rounded-full hover:bg-muted">
                    <Archive className="w-5 h-5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground rounded-full hover:bg-muted" 
                    onClick={() => setIsMergeDialogOpen(true)}
                    title="Merge Ticket"
                  >
                    <GitMerge className="w-5 h-5 text-indigo-500" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-foreground rounded-full hover:bg-muted" onClick={handleLegalExport} title="Legal Export (GoBD Compliant)">
                    <FileText className="w-5 h-5 text-emerald-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-foreground rounded-full hover:bg-muted">
                    <Trash className="w-5 h-5" />
                  </Button>
                  <div className="w-px h-6 bg-border mx-1"></div>
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 rounded-full text-xs font-bold shadow-sm h-9" onClick={takeOwnership}>
                    Take Ownership
                  </Button>
                </div>
              </header>

              {/* Thread Content */}
              <ScrollArea className="flex-1 px-8 py-6 min-h-0">
                {true ? (
                  <div className="max-w-4xl mx-auto space-y-6 pb-12">
                    
                    {activeDetailTab === 'conversation' && (
                      <div className="space-y-6">
                        {/* 1. Collapsible gradient AI summary card */}
                        <AiSummaryCard 
                          ticket={selectedTicket}
                          aiSummary={aiSummary}
                          isAiReady={isAiReady}
                          onRefreshSummary={() => updateSummary(true)}
                          isAiDrafting={isAiDrafting}
                          onChecklistUpdated={handleChecklistUpdated}
                        />

                        {/* 2. Foldable/Collapsible Agent Notes Section */}
                        <div className="bg-amber-50/15 dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-900/20 rounded-2xl overflow-hidden shadow-sm transition-all hover:bg-amber-50/25 dark:hover:bg-amber-950/15">
                          <button 
                            onClick={() => setAreNotesExpanded(!areNotesExpanded)}
                            className="w-full flex items-center justify-between p-4 focus:outline-none"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center border border-amber-200 dark:border-amber-900 text-amber-805 dark:text-amber-200 shrink-0 shadow-sm">
                                <MessageSquare className="w-4 h-4" />
                              </div>
                              <div className="text-left">
                                <h3 className="text-xs font-bold text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
                                  <span>Internal Agent Workspace Notes</span>
                                  <Badge className="bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100 border-none text-[8.5px] font-black tracking-tight px-1.5 h-4.5 rounded-full shadow-sm">
                                    {(selectedTicket.agentComments || []).length}
                                  </Badge>
                                </h3>
                                <p className="text-[10px] text-amber-800/80 dark:text-amber-300/85 mt-0.5">
                                  {areNotesExpanded ? 'Collapse notes panel' : 'Expand to read notes and log internal coordination'}
                                </p>
                              </div>
                            </div>
                            <ChevronDown className={cn(
                              "w-4 h-4 text-amber-700/80 dark:text-amber-400 transition-transform duration-200", 
                              areNotesExpanded && "rotate-180"
                            )} />
                          </button>

                          {areNotesExpanded && (
                            <div className="px-4 pb-4 pt-1 space-y-4 border-t border-amber-200/30 dark:border-amber-900/30">
                              {/* Notes list */}
                              {(selectedTicket.agentComments || []).length === 0 ? (
                                <p className="text-[11px] text-amber-800/60 dark:text-amber-400/70 italic py-2 text-center">No internal agent notes logged yet.</p>
                              ) : (
                                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                  {(selectedTicket.agentComments || []).map((comment: any) => (
                                    <div 
                                      key={comment.id} 
                                      className="p-3 bg-amber-50/90 dark:bg-slate-900 border border-amber-200/50 dark:border-slate-800 rounded-xl shadow-sm text-slate-900 dark:text-slate-100 flex items-start gap-3"
                                    >
                                      <div className="w-6.5 h-6.5 rounded-full bg-amber-100/80 dark:bg-slate-800 border border-amber-200 dark:border-slate-700 text-amber-800/80 dark:text-slate-200 flex items-center justify-center shrink-0 text-[10px] font-black uppercase">
                                        {comment.agentName ? comment.agentName.substring(0, 2) : 'AG'}
                                      </div>
                                      <div className="flex-1 min-w-0 space-y-0.5">
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold text-[11px] text-amber-950 dark:text-amber-100">{comment.agentName}</span>
                                          <span className="text-[9px] text-amber-800/60 dark:text-slate-400 font-medium">
                                            {comment.createdAt ? new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-amber-950 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Form to add note */}
                              <div className="p-3 bg-white dark:bg-slate-900 border border-amber-200/40 dark:border-slate-800 rounded-xl flex gap-2 items-center">
                                <input 
                                  id="quick-internal-note-input"
                                  type="text" 
                                  placeholder={t('tickets.notes.typeNotePlaceholder', 'Type an internal note to notify workforce, share state...')} 
                                  className="flex-1 bg-transparent border-none text-[11px] text-slate-850 dark:text-slate-200 focus:outline-none focus:ring-0 placeholder:text-slate-400"
                                  value={newAgentComment}
                                  onChange={(e) => setNewAgentComment(e.target.value)}
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter' && newAgentComment.trim()) {
                                      if (!user) return;
                                      try {
                                        await ticketService.addAgentComment(selectedTicket.id, {
                                          content: newAgentComment.trim(),
                                          agentId: user.uid,
                                          agentName: user.displayName || user.email || 'Agent'
                                        });
                                        setNewAgentComment("");
                                        // Reload comments
                                        const updatedTicket = await ticketService.getTicket(selectedTicket.id);
                                        if (updatedTicket) {
                                          setAllTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));
                                        }
                                        toast.success("Internal note logged.");
                                      } catch (err) {
                                        toast.error("Failed to log internal note.");
                                      }
                                    }
                                  }}
                                />
                                <Button 
                                  size="sm" 
                                  className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-100 dark:hover:bg-amber-850 text-amber-900 border-none font-bold text-[10px] h-7 px-3 rounded-lg shadow-sm font-sans"
                                  onClick={async () => {
                                    if (!newAgentComment.trim() || !user) return;
                                    try {
                                      await ticketService.addAgentComment(selectedTicket.id, {
                                        content: newAgentComment.trim(),
                                        agentId: user.uid,
                                        agentName: user.displayName || user.email || 'Agent'
                                      });
                                      setNewAgentComment("");
                                      // Reload comments
                                      const updatedTicket = await ticketService.getTicket(selectedTicket.id);
                                      if (updatedTicket) {
                                        setAllTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));
                                      }
                                      toast.success("Internal note logged.");
                                    } catch (err) {
                                      toast.error("Failed to log internal note.");
                                    }
                                  }}
                                >
                                  Post Note
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 3. Modernized chronological message & notes feed */}
                        <ConversationTimeline 
                          ticket={selectedTicket}
                          messages={messages}
                          agentComments={selectedTicket.agentComments || []}
                          onReplyClick={() => {
                            setIsComposerExpanded(true);
                            setTimeout(() => {
                              const replyComposer = document.getElementById('email-reply-composer');
                              if (replyComposer) replyComposer.scrollIntoView({ behavior: 'smooth' });
                            }, 100);
                          }}
                          onQuoteClick={(text) => {
                            setReplyText(prev => prev ? `${prev}<blockquote>${text}</blockquote><br/>` : `<blockquote>${text}</blockquote><br/>`);
                            setIsComposerExpanded(true);
                            setTimeout(() => {
                              const replyComposer = document.getElementById('email-reply-composer');
                              if (replyComposer) replyComposer.scrollIntoView({ behavior: 'smooth' });
                            }, 100);
                          }}
                          onInternalNoteAction={() => {
                            setAreNotesExpanded(true);
                            setTimeout(() => {
                              const quickNoteInput = document.getElementById('quick-internal-note-input');
                              if (quickNoteInput) quickNoteInput.focus();
                            }, 100);
                          }}
                          onAddAgentComment={async (text) => {
                            if (!user) return;
                            try {
                              await ticketService.addAgentComment(selectedTicket.id, {
                                content: text,
                                agentId: user.uid,
                                agentName: user.displayName || user.email || 'Agent'
                              });
                              // Reload agent comments by grabbing latest ticket info
                              const updatedTicket = await ticketService.getTicket(selectedTicket.id);
                              if (updatedTicket) {
                                setAllTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));
                              }
                              toast.success("Internal note logged.");
                            } catch (e) {
                              toast.error("Failed to log internal note.");
                            }
                          }}
                          isTranslating={isTranslating}
                          translatedTicket={translatedTicket}
                        />

                        {/* 4. Professional email-style response composer (Foldable/collapsed by default) */}
                        {isComposerExpanded ? (
                          <div className="relative">
                            <EmailComposer 
                              ticket={selectedTicket}
                              value={replyText}
                              onChange={setReplyText}
                              isDrafting={isAiDrafting || isGhostDrafting}
                              ghostDraft={ghostDraft}
                              onAcceptGhostDraft={acceptGhostDraft}
                              onSend={handleSendReply}
                              onDiscard={() => {
                                setReplyText("");
                                setLegalViolation(null);
                                setIsComposerExpanded(false);
                              }}
                              isAiReady={isAiReady}
                              isAiDrafting={isAiDrafting}
                              onDraftWithAI={generateAiReply}
                              onImproveWriting={async () => {
                                if (!isAiReady || !replyText) return;
                                try {
                                  const polished = await ai.improveTone(replyText, 'Professional');
                                  setReplyText(polished);
                                  toast.success("Tone polish applied with AI.");
                                } catch (e) {
                                  toast.error("Failed to improve writing tone.");
                                }
                              }}
                              onTranslate={async () => {
                                if (!isAiReady || !replyText) return;
                                try {
                                  const translated = await ai.translate(replyText, 'German', translationMood);
                                  setReplyText(translated);
                                  toast.success("Document draft translated to client's language.");
                                } catch (e) {
                                  toast.error("Translation assist failed.");
                                }
                              }}
                              onSummarize={updateSummary}
                              legalViolation={legalViolation}
                              isValidatingLegal={isValidatingLegal}
                            />
                            <div className="mt-2 flex justify-end">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-xs text-muted-foreground font-semibold hover:text-foreground h-8"
                                onClick={() => setIsComposerExpanded(false)}
                              >
                                {t('tickets.composer.collapseResponseEditor', 'Collapse Response Editor')}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-muted/40 border border-dashed border-border rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-900">
                                <Mail className="w-4 h-4" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{t('tickets.composer.noActiveDraft', 'No active response draft')}</span>
                                <span className="text-[10px] text-muted-foreground">{t('tickets.composer.clickReplyDesc', 'Click reply on any message or details header to write a message to the client.')}</span>
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              className="bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs h-8 px-3 rounded-lg shadow-sm"
                              onClick={() => setIsComposerExpanded(true)}
                            >
                              {t('tickets.composer.expandResponseForm', 'Expand Response Form')}
                            </Button>
                          </div>
                        )}

                        {/* 5. Bento Grid horizontal context cards at the end */}
                        <TicketKindFieldsCard
                          ticket={selectedTicket}
                          onUpdate={(data) => handleInlineUpdate(selectedTicket.id, data)}
                        />
                        <SmartContextPanel 
                          ticket={selectedTicket}
                          contact={ticketContact}
                          company={ticketCompany}
                          allTickets={allTickets}
                        />
                      </div>
                    )}

                    {activeDetailTab === 'customer' && (
                      <CustomerTabContent 
                        ticket={selectedTicket}
                        contact={ticketContact}
                        company={ticketCompany}
                        contactSchema={contactSchema}
                        allTickets={allTickets}
                      />
                    )}

                    {activeDetailTab === 'timeline' && (
                      <TimelineTabContent 
                        ticket={selectedTicket}
                        messages={messages}
                        agentComments={selectedTicket.agentComments || []}
                      />
                    )}

                    {activeDetailTab === 'ai_insights' && (
                      <AiInsightsTabContent 
                        ticket={selectedTicket}
                        aiSummary={aiSummary}
                        aiSources={aiSources}
                        isAiReady={isAiReady}
                      />
                    )}

                    {activeDetailTab === 'assets' && (
                      <AssetsTabContent ticket={selectedTicket} />
                    )}

                    {activeDetailTab === 'related_tickets' && (
                      <RelatedTicketsTabContent 
                        ticket={selectedTicket}
                        suggestedNeuralLinks={suggestedNeuralLinks}
                        isFindingNeuralLinks={isFindingNeuralLinks}
                        onFindNeuralLinks={findNeuralLinks}
                        onLinkTicket={linkTicket}
                        onUnlinkTicket={unlinkTicket}
                        linkInput={linkInput}
                        onChangeLinkInput={setLinkInput}
                      />
                    )}

                    {activeDetailTab === 'tasks' && (
                      <TasksTabContent
                        ticket={selectedTicket}
                        onChecklistUpdated={handleChecklistUpdated}
                      />
                    )}

                  </div>
                ) : (
                  <div className="max-w-4xl mx-auto space-y-8 pb-12">
                  
                  {selectedTicket.status === 'merged' && (
                    <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-between mb-8">
                       <div className="flex items-center gap-3">
                         <div className="p-2 bg-slate-200 rounded-full">
                           <GitMerge className="w-5 h-5 text-slate-600" />
                         </div>
                         <div className="flex flex-col">
                           <span className="text-sm font-bold text-slate-900">This ticket has been merged</span>
                           <span className="text-xs text-slate-500">All updates are now tracked in the original ticket thread.</span>
                         </div>
                       </div>
                       {selectedTicket.mergedIntoId && (
                         <Button 
                           variant="outline" 
                           size="sm" 
                           className="text-[10px] font-bold h-8 rounded-lg"
                           onClick={() => {
                             setSelectedTicketId(selectedTicket.mergedIntoId!);
                             toast.info(`Switched to original thread.`);
                           }}
                         >
                            View Original
                         </Button>
                       )}
                    </div>
                  )}

                  {/* Message Title/Sender Info */}
                  <div className="flex items-center gap-4 mb-4">
                     <div className="w-10 h-10 rounded-full bg-[#1A73E8] flex items-center justify-center text-white font-bold text-sm">
                        {selectedTicket.customerName.charAt(0)}
                     </div>
                     <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                           <span className="font-bold text-sm text-[#202124]">{selectedTicket.customerName}</span>
                           <span className="text-[10px] text-[#5F6368]">&lt;{selectedTicket.customerId}@client.com&gt;</span>
                        </div>
                        <span className="text-xs text-[#5F6368]">to me, support@geistdesk.support</span>
                     </div>
                  </div>

                  {/* AI & Agent Shared Analysis Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-2">
                    {/* AI Insight Section: Feature: Long Story Short */}
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-5 bg-accent/20 border border-primary/20 rounded-2xl shadow-sm relative overflow-hidden group h-full"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-primary/40"></div>
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center gap-1">
                           <Zap className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <h3 className="text-[10px] font-bold text-primary uppercase tracking-widest">Long Story Short</h3>
                                {selectedTicket.aiCitations && (selectedTicket as any).aiCitations.length > 0 && (
                                  <Badge className="bg-emerald-50 text-emerald-700 border-none text-[8px] h-3.5 font-bold">
                                    <CheckCircle2 className="w-2 h-2 mr-1" />
                                    Verified
                                  </Badge>
                                )}
                              </div>
                              <Badge variant="secondary" className="text-[8px] bg-card text-primary border-none font-bold">AI SUMMARY</Badge>
                           </div>
                          <div className="space-y-2">
                             {aiSummary ? (
                               aiSummary.split('\n').filter(s => s.trim()).slice(0, 3).map((bullet, i) => (
                                 <div key={i} className="flex gap-2 text-sm text-foreground/90 leading-relaxed">
                                   <span className="text-primary font-bold">{i + 1}.</span>
                                   <p className="line-clamp-2">{bullet.replace(/^[-\d.]\s*/, '')}</p>
                                 </div>
                               ))
                             ) : (
                               <p className="text-sm text-muted-foreground italic animate-pulse">{t('tickets.detail.digestingThread', 'The AI is currently digesting the thread context...')}</p>
                             )}
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    {/* Agent Internal Collaboration Box */}
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-5 bg-card border border-border rounded-2xl shadow-sm relative flex flex-col h-full"
                    >
                      <div className="flex items-center justify-between mb-3 shrink-0">
                         <div className="flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-blue-500" />
                            <h3 className="text-[10px] font-bold text-foreground uppercase tracking-widest">Agent Insights</h3>
                         </div>
                         <Badge variant="outline" className="text-[8px] font-bold uppercase">Human Log</Badge>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-3 max-h-[100px] scrollbar-thin scrollbar-thumb-muted">
                        {selectedTicket.agentComments && selectedTicket.agentComments.length > 0 ? (
                           selectedTicket.agentComments.map((comment) => (
                             <div key={comment.id} className="text-[11px] leading-relaxed">
                               <div className="flex items-center gap-2 mb-0.5">
                                 <span className="font-bold text-foreground">{comment.agentName}</span>
                                 <span className="text-[9px] text-muted-foreground">
                                   {new Date(comment.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                 </span>
                               </div>
                               <p className="text-muted-foreground">{comment.content}</p>
                             </div>
                           ))
                        ) : (
                           <div className="h-full flex flex-col items-center justify-center opacity-40">
                             <MessageSquare className="w-8 h-8 mb-1" />
                             <p className="text-[10px] font-medium italic">No agent notes yet.</p>
                           </div>
                        )}
                      </div>

                      <div className="relative mt-auto border-t border-border pt-3">
                        <Input 
                           placeholder="Drop a quick note for other agents..." 
                           className="h-8 text-xs bg-muted/30 border-none pr-10 focus-visible:ring-1 focus-visible:ring-primary/20"
                           value={newAgentComment}
                           onChange={(e) => setNewAgentComment(e.target.value)}
                           onKeyDown={(e) => {
                             if (e.key === 'Enter' && !e.shiftKey) {
                               e.preventDefault();
                               handleAddAgentComment();
                             }
                           }}
                        />
                        <Button 
                           variant="ghost" 
                           size="icon" 
                           className="absolute right-1 top-[15px] h-6 w-6 text-primary hover:bg-primary/10 rounded-md"
                           onClick={handleAddAgentComment}
                        >
                           <Send className="w-3 h-3" />
                        </Button>
                      </div>
                    </motion.div>
                  </div>

                  {/* Message Body */}
                  <div className="pl-14 space-y-12 pb-12">
                    <div className="text-sm leading-relaxed text-[#3C4043]">
                       {isTranslating ? (
                         <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                           <Globe className="w-4 h-4 animate-spin-slow" />
                           Context-Aware Translation...
                         </div>
                       ) : (
                         redactPII(translatedTicket?.description || selectedTicket.description)
                       )}
                    </div>

                     {/* Golden Note Pin (Latest Handoff Briefing) */}
                     {messages.find(m => (m as any).isGoldenNote) && (
                       <motion.div 
                         initial={{ opacity: 0, y: -10 }}
                         animate={{ opacity: 1, y: 0 }}
                         className="bg-amber-50/80 border border-amber-200/50 rounded-2xl p-6 mt-8 shadow-sm relative overflow-hidden"
                       >
                         <div className="absolute top-0 right-0 p-2 opacity-10">
                            <Zap className="w-12 h-12 text-amber-500" />
                         </div>
                         <div className="flex items-center gap-2 mb-4">
                            <Badge className="bg-amber-100 text-amber-800 border-none text-[9px] font-black uppercase tracking-widest px-2 h-5 leading-none">
                               GeistDesk Handoff Briefing
                            </Badge>
                            <span className="text-[10px] font-bold text-amber-700/60 uppercase tracking-tight">
                               Context secured for transition
                            </span>
                         </div>
                         <div className="text-sm text-amber-950 font-medium leading-relaxed whitespace-pre-wrap">
                            {messages.filter(m => (m as any).isGoldenNote).pop()?.content}
                         </div>
                         <div className="mt-4 flex items-center gap-2">
                            <Avatar className="h-5 w-5 border border-amber-200">
                               <AvatarFallback className="bg-amber-100 text-[8px] font-bold text-amber-700">HB</AvatarFallback>
                            </Avatar>
                            <span className="text-[10px] font-bold text-amber-800/70">
                               Drafted by {messages.filter(m => (m as any).isGoldenNote).pop()?.senderName}
                            </span>
                         </div>
                       </motion.div>
                     )}

                    {messages.filter(msg => !(msg as any).isGoldenNote).map(msg => (
                      <div 
                        key={msg.id} 
                        className={cn(
                          "pt-8 border-t border-[#F1F3F4] space-y-4",
                          (msg as any).isGoldenNote && "bg-amber-50/50 p-6 -mx-6 rounded-none border-y border-amber-100/50 mb-4"
                        )}
                      >
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#202124]">{msg.senderName}</span>
                            {(msg as any).isGoldenNote && (
                              <Badge className="bg-amber-100 text-amber-700 border-none text-[8px] h-4 font-black uppercase tracking-widest px-1.5 leading-none">
                                Golden Handoff
                              </Badge>
                            )}
                           </div>
                        <div className="flex items-center gap-2">
                           {msg.senderType === 'ai' && (
                             <Popover>
                               <PopoverTrigger asChild>
                                 <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-600 hover:bg-emerald-50 rounded-full">
                                   <ShieldCheck className="w-3.5 h-3.5" />
                                 </Button>
                               </PopoverTrigger>
                               <PopoverContent className="w-80 shadow-2xl border-emerald-100 p-0 overflow-hidden rounded-2xl">
                                  <div className="bg-emerald-50/50 p-4 border-b border-emerald-100">
                                     <div className="flex items-center gap-2 text-emerald-800 font-black text-[10px] uppercase tracking-widest">
                                        <Scale className="w-3.5 h-3.5" />
                                        Reasoning Path & Compliance
                                     </div>
                                  </div>
                                  <div className="p-4 space-y-4">
                                     <div className="space-y-1.5">
                                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-tighter">AI Reasoning Strategy</p>
                                        <p className="text-xs font-medium text-slate-700 leading-relaxed italic">
                                           {msg.reasoningPath || "Logical deduction based on KB parity and historical ticket weighting."}
                                        </p>
                                     </div>
                                     <div className="space-y-2">
                                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-tighter">Verified Citations</p>
                                        <div className="space-y-1.5">
                                           {msg.citations && msg.citations.length > 0 ? msg.citations.map((cite, i) => (
                                             <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg group hover:border-emerald-200 transition-all">
                                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                <span className="text-[10px] font-bold text-slate-600 truncate">{cite}</span>
                                                <SearchCheck className="w-3 h-3 text-emerald-400 opacity-0 group-hover:opacity-100 ml-auto" />
                                             </div>
                                           )) : (
                                             <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                                                <AlertCircle className="w-3 h-3 text-amber-500" />
                                                <span className="text-[10px] font-bold text-slate-500">Heuristic reasoning (No direct citation)</span>
                                             </div>
                                           )}
                                        </div>
                                     </div>
                                     <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                        <span className="text-[9px] font-black text-emerald-700 uppercase">German-Engineered Transparency v4</span>
                                     </div>
                                  </div>
                               </PopoverContent>
                             </Popover>
                           )}
                           <span className="text-[10px] text-[#5F6368]">
                             {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString() : 'Just now'}
                           </span>
                        </div>
                        </div>
                        <div className="text-sm leading-relaxed text-[#3C4043]">
                          {redactPII(translatedMessages[msg.id] || msg.originalContent || msg.content)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reply Area: Now integrated directly in the message flow */}
                  <div className="pt-8 border-t border-border">
                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden transition-all focus-within:shadow-lg focus-within:border-primary">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-muted">
                        <Button 
                          variant={isAiDrafting ? "secondary" : "ghost"}
                          size="sm" 
                          className={cn(
                            "text-[11px] font-bold rounded-full h-8 px-4",
                            isAiDrafting ? "bg-accent text-primary" : "text-primary hover:bg-muted"
                          )}
                          onClick={generateAiReply}
                          disabled={isAiDrafting || !isAiReady}
                          title={!isAiReady ? "AI Model Orchestrator is not configured" : undefined}
                        >
                          <Sparkles className="w-3.5 h-3.5 mr-2" />
                          {isAiDrafting ? 'Drafting...' : !isAiReady ? 'Smart Reply (AI Not Configured)' : 'Smart Reply'}
                        </Button>
                        <div className="h-4 w-px bg-[#DADCE0] mx-2"></div>
                        {moduleConfig.polyglotEnabled && (
                          <>
                            <DropdownMenu>
                              <DropdownMenuTrigger render={
                                <button className="flex items-center gap-1 text-[11px] font-bold text-primary hover:bg-muted rounded-full px-4 h-8 transition-colors focus:outline-none">
                                  Mood: {translationMood}
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              } />
                              <DropdownMenuContent align="start" className="w-40 rounded-xl">
                                <DropdownMenuItem onClick={() => setTranslationMood('Professional')} className="gap-2">
                                  <ShieldCheck className="w-4 h-4 text-blue-500" /> Professional
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setTranslationMood('Casual')} className="gap-2">
                                  <Smile className="w-4 h-4 text-orange-500" /> Casual
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setTranslationMood('Empathetic')} className="gap-2">
                                  <MessageCircleHeart className="w-4 h-4 text-pink-500" /> Empathetic
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <div className="h-4 w-px bg-[#DADCE0] mx-2"></div>
                          </>
                        )}
                        <button className="text-[11px] font-bold text-muted-foreground hover:text-foreground">Internal</button>
                      </div>
                      
                      <div className="relative group">
                        <RichTextEditor 
                          placeholder={agentLanguage === 'English' ? "Type your reply..." : `Type in ${agentLanguage}...`}
                          className="border-none rounded-none"
                          value={replyText}
                          onChange={setReplyText}
                        />

                        {/* Ghost Draft Overlay - Adapted for RichTextEditor */}
                        {ghostDraft && !replyText && !isGhostDrafting && (
                          <div className="absolute top-[50px] left-4 p-4 text-sm text-muted-foreground/30 pointer-events-none whitespace-pre-wrap leading-relaxed select-none z-20">
                            {ghostDraft}
                            <div className="mt-4 flex items-center gap-2 opacity-60">
                              <Badge variant="outline" className="text-[9px] font-bold py-0 h-4 border-muted-foreground/20 text-muted-foreground/40">TAB</Badge>
                              <span className="text-[10px] font-medium">to accept AI suggestion</span>
                            </div>
                          </div>
                        )}

                        {/* Loading state for Zero-Draft */}
                        {isGhostDrafting && (
                          <div className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground/40">
                            <Sparkles className="w-4 h-4 animate-pulse" />
                            <span className="text-xs italic animate-pulse">AI is preparing your zero-draft...</span>
                          </div>
                        )}

                        {isValidatingLegal && (
                          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-50 flex items-center justify-center gap-3">
                            <Scale className="w-5 h-5 text-amber-600 animate-bounce" />
                            <span className="text-sm font-bold text-amber-900 tracking-tight">GeistDesk Legal Interceptor is auditing your draft...</span>
                          </div>
                        )}

                        {legalViolation && (
                          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-4 shadow-sm animate-in slide-in-from-top-2 duration-300">
                            <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0 border border-red-200">
                               <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                            <div className="flex-1">
                               <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[11px] font-black uppercase text-red-700 tracking-widest">Legal Guardrail Violation</span>
                                  <Badge className="bg-red-200 text-red-800 border-none text-[8px] font-black h-4 px-1.5">Compliance Risk: High</Badge>
                               </div>
                               <h4 className="text-sm font-bold text-red-900 mb-1">{legalViolation.violationDetail}</h4>
                               <p className="text-xs text-red-700/80 leading-relaxed italic">
                                  "The text highlighted in your editor contains unauthorized financial or legal language. This violation has been logged to the compliance database."
                               </p>
                               <div className="mt-3 flex items-center gap-3">
                                  <Button 
                                    size="sm" 
                                    variant="link" 
                                    className="p-0 h-auto text-red-700 font-bold text-[10px] uppercase hover:no-underline hover:text-red-900"
                                    onClick={() => setLegalViolation(null)}
                                  >
                                    Acknowledge & Edit
                                  </Button>
                                  <div className="h-3 w-px bg-red-200"></div>
                                  <Button 
                                    size="sm" 
                                    variant="link" 
                                    className="p-0 h-auto text-red-700 font-bold text-[10px] uppercase hover:no-underline hover:text-red-900"
                                    onClick={() => {
                                      // Special bypass: Clear violation and trigger send directly, bypassing the interceptor check once
                                      setLegalViolation(null);
                                      // Since we are in an onClick, we can't easily jump back into handleSendReply with a bypass flag unless we refactor.
                                      // But for this "Legal Guardrail", bypassing should probably be an admin-only or specific "Force Send" action. 
                                      // Let's just have them edit for now.
                                    }}
                                  >
                                    View Policy
                                  </Button>
                               </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Ghostwriting: Translation Preview Overlay */}
                        <AnimatePresence>
                          {liveTranslation && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className="absolute bottom-4 right-6 left-6 p-4 bg-muted/80 backdrop-blur-sm rounded-xl border border-border shadow-sm select-none pointer-events-none"
                            >
                               <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                     <Languages className="w-3 h-3" />
                                     Polyglot Live Preview ({(selectedTicket as any).originalLanguage || 'English'})
                                  </div>
                                  <Badge className="bg-card text-primary border-border text-[9px] font-bold uppercase h-4">
                                     {translationMood} Tone
                                  </Badge>
                               </div>
                               <p className="text-xs text-foreground italic line-clamp-2">
                                  {liveTranslation}
                               </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="px-6 py-4 bg-muted flex justify-between items-center border-t border-border">
                        <div className="flex items-center gap-4">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground rounded-full"><Paperclip className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground rounded-full"><Smile className="w-4 h-4" /></Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-primary rounded-full hover:bg-accent"
                            onClick={() => navigate('/vault')}
                            title="Generate Phantom Vault Link"
                          >
                            <Lock className="w-4 h-4" />
                          </Button>
                          <div className="h-4 w-px bg-border"></div>
                          <Badge className="bg-green-100/30 text-green-700 border-none text-[9px] font-bold uppercase tracking-tight">
                             <ShieldCheck className="w-3 h-3 mr-1" />
                             Identity Verified
                          </Badge>
                        </div>
                        <div className="flex gap-3">
                          <Button variant="ghost" size="sm" className="text-[11px] font-bold text-muted-foreground rounded-full" onClick={() => {
                            setReplyText("");
                            setLegalViolation(null);
                          }}>Discard</Button>
                          <Button 
                            size="sm" 
                            className="px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[12px] rounded-full h-10 shadow-md" 
                            onClick={handleSendReply}
                            disabled={isValidatingLegal}
                          >
                            {isValidatingLegal ? 'Auditing...' : 'Send'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </ScrollArea>
            </div> {/* End of message column */}
            {/* Mobile drawer backdrop (tap to dismiss); never shown on desktop. */}
            {isMobilePropertiesOpen && (
              <div
                onClick={() => setIsMobilePropertiesOpen(false)}
                className="xl:hidden absolute inset-0 z-20 bg-black/40 backdrop-blur-[1px]"
                aria-hidden="true"
              />
            )}
            {/* Right Context Pane: Sticky properties column */}
            <aside className={cn(
              "shrink-0 border-l border-border overflow-y-auto custom-scrollbar z-30 transition-all",
              // Desktop (xl+): a sticky in-flow properties column.
              "xl:flex xl:relative xl:sticky xl:top-6 xl:h-[calc(100vh-5rem)] xl:w-[325px] xl:shadow-none xl:bg-muted",
              isMobilePropertiesOpen
                // Mobile/tablet: a full-height drawer that never exceeds the viewport.
                ? "flex absolute inset-y-0 right-0 h-full w-[min(22rem,92vw)] shadow-2xl bg-white dark:bg-slate-900"
                : "hidden bg-muted"
            )}>
               {true ? (
                 <RedesignedSidebar 
                   ticket={selectedTicket}
                   contact={ticketContact}
                   company={ticketCompany}
                   onUpdateTicketField={(data) => {
                     ticketService.updateTicket(selectedTicket.id, data);
                     setAllTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, ...data } : t));
                   }}
                   isAiReady={isAiReady}
                   isAiDrafting={isAiDrafting}
                   onDraftWithAI={generateAiReply}
                   onConvertToKB={handleConvertToKB}
                   suggestedNeuralLinks={suggestedNeuralLinks}
                   onLinkTicket={linkTicket}
                   onUnlinkTicket={unlinkTicket}
                   tagsInput={newTagInput}
                   onChangeTagsInput={setNewTagInput}
                   onInitiateHandoff={(data) => initiateHandoff(selectedTicket.id, data)}
                   onCloseMobile={() => setIsMobilePropertiesOpen(false)}
                   onAddTag={() => {
                     if (newTagInput.trim() && selectedTicket) {
                       ticketService.updateTicket(selectedTicket.id, { tags: [...selectedTicket.tags, newTagInput.trim()] });
                       setNewTagInput('');
                     }
                   }}
                   /* onRetentionPeriodChange={(retention) => {
                     ticketService.updateTicket(selectedTicket.id, { retentionPeriod: retention as any });
                     toast.success("Retention rules aligned to " + retention);
                   }}
                   onComplianceApprovalChange={(status) => {
                     ticketService.updateTicket(selectedTicket.id, { complianceApproval: status as any });
                     toast.success("Compliance override updated to " + status);
                   }}
                   onOwnerGroupChange={(group) => {
                     ticketService.updateTicket(selectedTicket.id, { ownerGroup: group as any });
                     toast.success("Operational owner group updated to " + group);
                   }}
                   onToggleSection={(sec) => setCollapsedSidebarSections(prev => ({ ...prev, [sec]: !prev[sec] }))}
                   collapsedSections={collapsedSidebarSections}
                   isAiReady={isAiReady}
                   aiInsights={aiInsights}
                   onVerifySla={verifySlaCompliance}
                   onGenerateAudit={generateRegulatoryAuditDigest}
                   isSlaChecking={isSlaChecking}
                   isGeneratingAudit={isGeneratingAudit} */
                    suggestedTags={suggestedTags}
                   allTickets={allTickets}
                   /* onAddAgentComment={async (text) => {
                     if (!user) return;
                     try {
                       await ticketService.addAgentComment(selectedTicket.id, {
                         content: text,
                         agentId: user.uid,
                         agentName: user.displayName || user.email || 'Agent'
                       });
                       const updatedTicket = await ticketService.getTicket(selectedTicket.id);
                       if (updatedTicket) {
                         setAllTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));
                       }
                       toast.success("Internal note logged.");
                     } catch (e) {
                       toast.error("Failed to log internal note.");
                     }
                   }} */
                 />
               ) : (
                 <>
                   <div className="p-4 border-b flex items-center justify-between bg-card shrink-0">
                <h3 className="font-bold text-sm text-foreground">Ticket Properties</h3>
                <Settings2 className="w-4 h-4 text-muted-foreground" />
              </div>
              <div 
                className="flex-1 overflow-y-auto min-h-0 custom-scrollbar" 
                style={{ scrollbarGutter: 'stable' }}
              >
                <div className="p-5 space-y-8 pb-12">
                  
                  {/* Category: Requester Information */}
                  <div className="space-y-4">
                     <div className="flex items-center gap-2 mb-2">
                        <div className="h-3 w-1 bg-primary rounded-full" />
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Requester Information</h4>
                     </div>
                     <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                              {selectedTicket.customerName.charAt(0)}
                           </div>
                           <div>
                              <p className="text-sm font-bold text-foreground">{selectedTicket.customerName}</p>
                              <p className="text-[11px] text-muted-foreground">Premium Account</p>
                           </div>
                        </div>
                        <div className="space-y-2 pt-2 border-t border-border mt-2">
                           <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</span>
                              <span className="font-semibold text-foreground truncate max-w-[150px]">{selectedTicket.customerId}@client.com</span>
                           </div>
                           <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Org</span>
                              <span className="font-semibold text-foreground">{selectedTicket.company || 'Unknown'}</span>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Category A: Standard Workflow */}
                  <div className="space-y-4">
                     <div className="flex items-center gap-2 mb-2">
                        <div className="h-3 w-1 bg-primary rounded-full" />
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Standard Workflow</h4>
                     </div>
                     
                     <div className="space-y-4">
                        <div>
                           <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Status</label>
                           <DropdownMenu>
                              <DropdownMenuTrigger render={
                                 <button className="w-full flex items-center justify-between h-10 bg-card border border-border hover:bg-muted text-xs font-semibold px-3 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-primary">
                                    <div className="flex items-center gap-2">
                                       <div className={cn(
                                          "w-2 h-2 rounded-full",
                                          selectedTicket.status === 'open' ? "bg-primary" :
                                          selectedTicket.status === 'pending' ? "bg-amber-500" :
                                          "bg-muted-foreground"
                                       )} />
                                       {selectedTicket.status.toUpperCase()}
                                    </div>
                                    <ChevronDown className="w-3 h-3 opacity-50" />
                                 </button>
                              } />
                              <DropdownMenuContent className="w-56">
                                 {['open', 'pending', 'resolved', 'closed', 'trash'].map(s => (
                                    <DropdownMenuItem key={s} className="capitalize text-xs" onClick={() => ticketService.updateTicket(selectedTicket.id, { status: s as any })}>
                                       {s}
                                    </DropdownMenuItem>
                                 ))}
                              </DropdownMenuContent>
                           </DropdownMenu>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                           <div>
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Priority</label>
                              <DropdownMenu>
                                 <DropdownMenuTrigger render={
                                    <button className="w-full flex items-center justify-between h-10 bg-card border border-border hover:bg-muted text-xs font-semibold px-3 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-primary">
                                       <div className="flex items-center gap-2">
                                          <div className={cn(
                                             "w-2 h-2 rounded-full",
                                             selectedTicket.priority === 'urgent' ? "bg-destructive" :
                                             selectedTicket.priority === 'high' ? "bg-amber-500" :
                                             selectedTicket.priority === 'medium' ? "bg-primary" : "bg-muted-foreground"
                                          )} />
                                          {selectedTicket.priority.toUpperCase()}
                                       </div>
                                       <ChevronDown className="w-3 h-3 opacity-50" />
                                    </button>
                                 } />
                                 <DropdownMenuContent className="w-40">
                                    {['low', 'medium', 'high', 'urgent'].map(p => (
                                       <DropdownMenuItem key={p} className="capitalize text-xs" onClick={() => ticketService.updateTicket(selectedTicket.id, { priority: p as any })}>
                                          {p}
                                       </DropdownMenuItem>
                                    ))}
                                 </DropdownMenuContent>
                              </DropdownMenu>
                           </div>
                           <div>
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Group</label>
                              <DropdownMenu>
                                 <DropdownMenuTrigger render={
                                    <button className="w-full flex items-center justify-between h-10 bg-card border border-border hover:bg-muted text-xs font-semibold px-3 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-primary">
                                       <div className="truncate pr-1">{selectedTicket.team?.toUpperCase() || 'SUPPORT'}</div>
                                       <ChevronDown className="w-3 h-3 opacity-50" />
                                    </button>
                                 } />
                                 <DropdownMenuContent className="w-40">
                                    {['SUPPORT', 'ENGINEERING', 'BILLING', 'SALES'].map(g => (
                                       <DropdownMenuItem key={g} className="text-xs" onClick={() => ticketService.updateTicket(selectedTicket.id, { team: g.toLowerCase() as any })}>
                                          {g}
                                       </DropdownMenuItem>
                                    ))}
                                 </DropdownMenuContent>
                              </DropdownMenu>
                           </div>
                        </div>

                        <div>
                           <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Assignee</label>
                           <DropdownMenu>
                              <DropdownMenuTrigger render={
                                 <button className="w-full flex items-center justify-start gap-3 h-10 bg-card border border-border hover:bg-muted text-xs font-semibold px-3 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-primary">
                                    <UserRound className="w-4 h-4 text-muted-foreground" />
                                    <div className="truncate">{selectedTicket.agentName || 'Unassigned'}</div>
                                    <ChevronDown className="w-3 h-3 opacity-50 ml-auto" />
                                 </button>
                              } />
                              <DropdownMenuContent className="w-64">
                                 <DropdownMenuItem className="text-xs font-semibold" onClick={() => initiateHandoff(selectedTicket.id, { agentId: user?.uid, agentName: user?.email })}>
                                    Assign to me
                                 </DropdownMenuItem>
                                 <Separator className="my-1" />
                                 {['Sarah Agent', 'Mike Lead', 'Dev Team'].map(a => (
                                    <DropdownMenuItem key={a} className="text-xs" onClick={() => initiateHandoff(selectedTicket.id, { agentName: a })}>
                                       {a}
                                    </DropdownMenuItem>
                                 ))}
                              </DropdownMenuContent>
                           </DropdownMenu>
                        </div>

                        <div>
                           <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Type</label>
                           <DropdownMenu>
                              <DropdownMenuTrigger render={
                                 <button className="w-full flex items-center justify-between h-10 bg-card border border-border hover:bg-muted text-xs font-semibold px-3 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-primary">
                                    <div className="truncate pr-1">{(selectedTicket as any).type?.toUpperCase() || 'QUESTION'}</div>
                                    <ChevronDown className="w-3 h-3 opacity-50" />
                                 </button>
                              } />
                              <DropdownMenuContent className="w-56">
                                 {['Question', 'Incident', 'Problem', 'Feature Request'].map(t => (
                                    <DropdownMenuItem key={t} className="text-xs" onClick={() => ticketService.updateTicket(selectedTicket.id, { type: t.toLowerCase() } as any)}>
                                       {t}
                                    </DropdownMenuItem>
                                 ))}
                              </DropdownMenuContent>
                           </DropdownMenu>
                        </div>
                     </div>
                  </div>

                  <Separator />

                  {/* AI Context & Citations */}
                  {(aiSources.length > 0 || isGhostDrafting) && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-1 bg-primary rounded-full shadow-[0_0_8px_rgba(26,115,232,0.5)]" />
                          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">AI Citations</h4>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-muted-foreground"
                          onClick={() => setShowCitations(!showCitations)}
                        >
                          {showCitations ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </Button>
                      </div>
                      
                      <AnimatePresence>
                        {showCitations && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 overflow-hidden"
                          >
                            {isGhostDrafting ? (
                              <div className="space-y-3">
                                {[1, 2].map(i => (
                                  <div key={i} className="h-20 bg-muted/50 rounded-xl animate-pulse" />
                                ))}
                              </div>
                            ) : (
                              aiSources.map((source, idx) => (
                                <div 
                                  key={idx} 
                                  className="group relative bg-card border border-border rounded-xl p-3 hover:shadow-md transition-all cursor-help"
                                >
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <div className="w-1 h-1 rounded-full bg-primary" />
                                    <span className="text-[10px] font-bold text-primary truncate">
                                      {source.articleTitle}
                                    </span>
                                    <Badge variant="outline" className="ml-auto text-[8px] h-3 px-1 border-primary/20 text-primary bg-primary/5 uppercase font-bold shrink-0">
                                      {idx === 0 ? 'Primary' : 'Support'}
                                    </Badge>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 italic">
                                    "{source.paragraph}"
                                  </p>
                                  
                                  {/* Hover Snippet */}
                                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-[100] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                    <div className="text-[9px] font-bold text-primary uppercase mb-2 border-b border-gray-800 pb-1">Verified Source Snippet</div>
                                    <p className="text-[11px] text-gray-300 leading-relaxed italic">
                                      {source.paragraph}
                                    </p>
                                    <div className="mt-2 pt-2 border-t border-gray-800 flex justify-between items-center text-[9px] text-gray-400">
                                      <span>KB ID: {source.articleId || 'N/A'}</span>
                                      <span className="flex items-center gap-1"><BookOpen className="w-2.5 h-2.5 text-primary" /> Resolved Ticket</span>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                            <div className="pt-1 px-1">
                              <p className="text-[9px] text-muted-foreground leading-relaxed">
                                AI identified these entries from <span className="font-bold">Knowledge Base</span> and <span className="font-bold">Resolved Tickets</span> to construct this draft.
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  <Separator />

                  {/* Category B: AI-Enhanced */}
                  <div className="space-y-4">
                     <div className="flex items-center gap-2 mb-2">
                        <div className="h-3 w-1 bg-primary rounded-full" />
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">AI-Enhanced (Contino)</h4>
                     </div>
                     <div className="space-y-4">
                        <div>
                           <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Sentiment Mood</label>
                           <div className="flex gap-2">
                              {['angry', 'neutral', 'positive'].map(s => (
                                 <button 
                                    key={s}
                                    onClick={() => ticketService.updateTicket(selectedTicket.id, { sentiment: s as any })}
                                    className={cn(
                                       "flex-1 p-2 rounded-lg border transition-all flex flex-col items-center gap-1",
                                       selectedTicket.sentiment === s ? "bg-accent border-primary text-primary" : "bg-card border-border text-muted-foreground hover:bg-muted"
                                    )}
                                 >
                                    {s === 'angry' ? <Angry className="w-4 h-4" /> : s === 'neutral' ? <Meh className="w-4 h-4" /> : <Smile className="w-4 h-4" />}
                                    <span className="text-[8px] font-bold uppercase">{s}</span>
                                 </button>
                              ))}
                           </div>
                        </div>

                        <div className="bg-accent/30 rounded-xl p-3 border border-accent space-y-2">
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                 <Languages className="w-3.5 h-3.5 text-primary" />
                                 <span className="text-[10px] font-bold text-primary uppercase tracking-tight">Original Lang</span>
                              </div>
                              <span className="text-[10px] font-bold text-primary">{(selectedTicket as any).originalLanguage || 'German'}</span>
                           </div>
                           <Separator className="bg-primary/10" />
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                 <Sparkles className="w-3.5 h-3.5 text-primary" />
                                 <span className="text-[10px] font-bold text-primary uppercase tracking-tight">AI Confidence</span>
                              </div>
                              <Badge className="bg-primary text-primary-foreground border-none text-[8px] font-bold h-4">HIGH</Badge>
                           </div>
                        </div>
                     </div>
                  </div>

                  <Separator />

                  {/* Category C: Timeline & SLA */}
                  <div className="space-y-4">
                     <div className="flex items-center gap-2 mb-2">
                        <div className="h-3 w-1 bg-[#1A73E8] rounded-full" />
                        <h4 className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest">Timeline & SLA</h4>
                     </div>
                     <div className="space-y-3">
                        <div className="flex items-center justify-between text-[11px]">
                           <span className="text-[#5F6368]">Created:</span>
                           <span className="font-semibold text-[#202124]">{selectedTicket.createdAt?.toDate ? selectedTicket.createdAt.toDate().toLocaleDateString() : 'Today'}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                           <span className="text-[#5F6368]">Closed at:</span>
                           <span className="font-semibold text-[#202124]">{(selectedTicket as any).resolvedAt || '-'}</span>
                        </div>
                        <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                           <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-red-600 uppercase tracking-tight">SLA BREACH RISK</span>
                              <Clock className="w-3 h-3 text-red-600" />
                           </div>
                           <p className="text-[11px] font-bold text-red-700">Due in 2h 14m</p>
                        </div>
                     </div>
                  </div>

                  <Separator />

                  {/* Neural Links Section */}
                  <div className="space-y-4">
                     <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                           <div className="h-3 w-1 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                           <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Neural Links (KB Web)</h4>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn("h-6 w-6 text-indigo-500 hover:bg-indigo-50", isFindingNeuralLinks && "animate-spin")}
                          onClick={findNeuralLinks}
                          disabled={isFindingNeuralLinks}
                        >
                          <Network className="w-3.5 h-3.5" />
                        </Button>
                     </div>

                     {/* Master Ticket Control */}
                     {selectedTicket.isMasterTicket && (
                       <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl mb-4">
                         <div className="flex items-center gap-2 mb-2">
                           <ShieldCheck className="w-4 h-4 text-indigo-600" />
                           <span className="text-[10px] font-black text-indigo-800 uppercase">Master Controller</span>
                         </div>
                         <p className="text-[11px] text-indigo-700 leading-tight mb-3">
                           This is a Master Ticket for {selectedTicket.linkedTicketIds?.length} issues.
                         </p>
                         {selectedTicket.status === 'resolved' && (
                           <Button 
                             className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold h-8 rounded-lg"
                             onClick={handleUpdateMasterTicket}
                           >
                              Notify All Linked
                           </Button>
                         )}
                       </div>
                     )}

                     {/* Linked Tickets List */}
                     <div className="space-y-2">
                        {selectedTicket.linkedTicketIds && selectedTicket.linkedTicketIds.length > 0 ? (
                          selectedTicket.linkedTicketIds.map(id => (
                            <div key={id} className="group flex items-center justify-between p-2.5 bg-card border border-border rounded-xl hover:border-indigo-200 transition-all">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <Link2 className="w-3 h-3 text-indigo-400 shrink-0" />
                                <span className="text-xs font-bold text-foreground truncate cursor-pointer hover:text-indigo-600" onClick={() => openTicket(id)}>
                                  #{id.slice(-5).toUpperCase()}
                                </span>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                                onClick={() => unlinkTicket(id)}
                              >
                                <Unlink className="w-3 h-3" />
                              </Button>
                            </div>
                          ))
                        ) : !selectedTicket.masterTicketId && (
                          <div className="text-[10px] text-muted-foreground italic px-2">{t('tickets.detail.noNeuralLinks', 'No active neural links.')}</div>
                        )}

                        {selectedTicket.masterTicketId && (
                           <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <Lock className="w-3.5 h-3.5 text-slate-400" />
                               <div className="flex flex-col">
                                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Linked to Master</span>
                                 <span 
                                   className="text-xs font-bold text-slate-800 cursor-pointer hover:underline"
                                   onClick={() => openTicket(selectedTicket.masterTicketId!)}
                                 >
                                   #{selectedTicket.masterTicketId.slice(-5).toUpperCase()}
                                 </span>
                               </div>
                             </div>
                             <ExternalLink className="w-3 h-3 text-slate-400" />
                           </div>
                        )}
                     </div>

                     {/* AI Suggestions */}
                     {suggestedNeuralLinks.length > 0 && (
                       <div className="mt-4 pt-4 border-t border-dashed border-indigo-100 space-y-3">
                         <div className="flex items-center gap-1.5 px-1">
                            <Sparkles className="w-3 h-3 text-indigo-500" />
                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tight">AI Suggested Links</span>
                         </div>
                         {suggestedNeuralLinks.map(suggestion => (
                           <motion.div 
                             key={suggestion.ticketId}
                             initial={{ opacity: 0, x: 10 }}
                             animate={{ opacity: 1, x: 0 }}
                             className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2 group"
                           >
                             <div className="flex items-center justify-between">
                               <span className="text-[10px] font-bold text-indigo-900 truncate pr-2">{suggestion.subject}</span>
                               <Badge className="bg-indigo-100 text-indigo-700 border-none text-[8px] h-3.5">{Math.round(suggestion.confidence * 100)}%</Badge>
                             </div>
                             <p className="text-[9px] text-indigo-700/70 leading-tight italic">"{suggestion.reason}"</p>
                             <Button 
                               className="w-full bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-100 text-[9px] font-bold h-7 rounded-lg group-hover:border-indigo-400 shadow-sm"
                               onClick={() => linkTicket(suggestion.ticketId)}
                             >
                               Confirm Link
                             </Button>
                           </motion.div>
                         ))}
                       </div>
                     )}

                     {/* Manual Linking Input */}
                     <div className="relative mt-4">
                        <Input 
                          placeholder="Manual Link by ID (#...)" 
                          className="h-9 text-xs rounded-lg border-border focus:ring-indigo-500/20 focus:border-indigo-500 pr-10"
                          value={linkInput}
                          onChange={(e) => setLinkInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && linkInput.trim()) {
                              const cleanId = linkInput.replace('#', '').trim();
                              linkTicket(cleanId);
                            }
                          }}
                        />
                        <Link2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                     </div>
                  </div>

                  <Separator />

                  {/* Internal Notes */}
                  <div className="space-y-4">
                     <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                           <div className="h-3 w-1 bg-amber-500 rounded-full" />
                           <h4 className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest">Internal Notes</h4>
                        </div>
                     </div>
                     <div className="relative">
                        <Textarea 
                           placeholder="Add an internal note for agents..." 
                           className="text-xs min-h-[80px] bg-amber-50/30 border-amber-200/50 rounded-xl focus:ring-amber-500/20 focus:border-amber-500"
                           value={selectedTicket.internalNotes || ''}
                           onChange={(e) => ticketService.updateTicket(selectedTicket.id, { internalNotes: e.target.value })}
                        />
                        <Info className="absolute bottom-3 right-3 w-3.5 h-3.5 text-amber-500/50" />
                     </div>
                  </div>

                  <Separator />

                  {/* Category D: Business Context */}
                  <div className="space-y-4">
                     <div className="flex items-center gap-2 mb-2">
                        <div className="h-3 w-1 bg-[#1A73E8] rounded-full" />
                        <h4 className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest">Business Context</h4>
                     </div>
                     <div className="space-y-4">
                        <div>
                           <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-wider mb-2 block">Organization</label>
                           <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-[#DADCE0]">
                              <Building2 className="w-4 h-4 text-[#1A73E8]" />
                              <span className="text-xs font-bold text-[#202124]">{selectedTicket.company || 'Advanced Machinery'}</span>
                           </div>
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-wider mb-2 block">Product</label>
                           <select className="w-full bg-white border border-[#DADCE0] rounded-lg p-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-[#1A73E8]" value={(selectedTicket as any).product || 'GeistDeskTech'} onChange={(e) => ticketService.updateTicket(selectedTicket.id, { product: e.target.value } as any)}>
                              <option>GeistDeskTech</option>
                              <option>GeistDeskMobile</option>
                           </select>
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-wider mb-2 block">Channel Source</label>
                           <div className="flex items-center gap-2 text-xs font-semibold text-[#5F6368] capitalize">
                              {selectedTicket.channel === 'email' ? <Mail className="w-4 h-4" /> : 
                               selectedTicket.channel === 'chat' ? <MessageSquare className="w-4 h-4" /> : 
                               selectedTicket.channel === 'phone' ? <PhoneCall className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                              {selectedTicket.channel}
                           </div>
                        </div>
                     </div>
                  </div>

                  <Separator />

                  {/* Tag Cloud */}
                  <div className="space-y-4">
                     <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-wider flex items-center gap-1.5">
                           <Tag className="w-3 h-3" /> Tags
                        </label>
                     </div>
                     <div className="flex flex-wrap gap-1.5">
                        {selectedTicket.tags.map(tag => (
                           <Badge key={tag} variant="secondary" className="bg-[#E8F0FE] text-[#1A73E8] border-none text-[10px] font-bold py-0.5 px-2 group flex items-center gap-1">
                              {tag}
                              <button onClick={() => ticketService.updateTicket(selectedTicket.id, { tags: selectedTicket.tags.filter(t => t !== tag) })} className="hover:text-red-500 opacity-0 group-hover:opacity-100 p-0.5">
                                 <XCircle className="w-3 h-3" />
                              </button>
                           </Badge>
                        ))}
                     </div>
                     <div className="relative">
                        <Input 
                           placeholder="Add tag..." 
                           className="h-9 text-xs rounded-lg border-[#DADCE0] focus:ring-1 focus:ring-[#1A73E8] pr-10" 
                           value={newTagInput}
                           onChange={(e) => setNewTagInput(e.target.value)}
                           onKeyDown={(e) => {
                              if (e.key === 'Enter' && newTagInput.trim()) {
                                 ticketService.updateTicket(selectedTicket.id, { tags: [...selectedTicket.tags, newTagInput.trim()] });
                                 setNewTagInput('');
                              }
                           }}
                        />
                        <PlusCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5F6368]" />
                     </div>

                     {/* AI Tag Suggestions */}
                     <div className="bg-[#E8F0FE]/30 rounded-xl p-3 border border-[#E8F0FE]">
                        <div className="flex items-center gap-1.5 mb-2">
                           <Sparkles className="w-3.5 h-3.5 text-[#1A73E8]" />
                           <span className="text-[10px] font-bold text-[#1A73E8] uppercase tracking-tight">AI Suggestions</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                           {suggestedTags.filter(st => !selectedTicket.tags.includes(st)).map(tag => (
                              <button 
                                 key={tag}
                                 onClick={() => ticketService.updateTicket(selectedTicket.id, { tags: [...selectedTicket.tags, tag] })}
                                 className="text-[10px] font-bold text-[#1A73E8] hover:bg-[#E8F0FE] border border-[#1A73E8]/30 rounded-full px-2.5 py-0.5 transition-colors"
                              >
                                 #{tag}
                              </button>
                           ))}
                        </div>
                     </div>
                  </div>

                  <Separator />

                  {/* Customer & Company History */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] uppercase font-bold text-[#5F6368] tracking-wider">Contact Details</h4>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="w-10 h-10 border shadow-sm">
                          <AvatarFallback className="bg-slate-100 text-[#5F6368] font-bold">{(ticketContact?.name || selectedTicket.customerName).charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#202124]">{ticketContact?.name || selectedTicket.customerName}</p>
                          <p className="text-xs text-[#5F6368] truncate mb-2">{redactPII((ticketContact?.email || selectedTicket.customerId) + (ticketContact?.email ? "" : "@gmail.com"))}</p>
                          <div className="flex gap-2">
                             <Button variant="ghost" size="sm" className="h-6 text-[10px] font-bold text-[#1A73E8] p-0 hover:bg-transparent" onClick={() => navigate(`/customers?id=${selectedTicket.companyId}`)}>VIEW PROFILE</Button>
                             <span className="text-[#BDC1C6] text-xs">|</span>
                             <Button variant="ghost" size="sm" className="h-6 text-[10px] font-bold text-[#1A73E8] p-0 hover:bg-transparent">HISTORY</Button>
                          </div>
                          
                          {/* Contact Metadata Attributes */}
                          {ticketContact?.metadata && Object.keys(ticketContact.metadata).length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1">
                               {contactSchema.filter(f => !f.system && ticketContact.metadata?.[f.internalName]).map(field => (
                                 <Badge key={field.id} variant="secondary" className="bg-sky-50 text-sky-600 border-sky-100/50 text-[9px] font-bold">
                                   {field.label}: {String(ticketContact.metadata?.[field.internalName])}
                                 </Badge>
                               ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow">
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                               {ticketCompany?.logoUrl ? (
                                 <img src={ticketCompany.logoUrl} alt="Logo" className="w-4 h-4 rounded object-contain" referrerPolicy="no-referrer" />
                               ) : (
                                 <Building2 className="w-4 h-4 text-[#1A73E8]" />
                               )}
                               <span className="text-xs font-bold text-[#202124] cursor-pointer hover:text-primary transition-colors" onClick={() => navigate(`/customers?id=${selectedTicket.companyId}`)}>
                                 {ticketCompany?.name || selectedTicket.company || 'GeistDeskTech'}
                               </span>
                            </div>
                            {ticketCompany?.wartungsvertragStatus === 'Active' && (
                              <Badge className="bg-[#E6F4EA] text-[#137333] border-none text-[8px] font-bold uppercase">Active Maintenance</Badge>
                            )}
                         </div>
                         <div className="flex items-center gap-2 text-[10px] text-[#5F6368] font-medium">
                            <Globe className="w-3 h-3" />
                            <span>{ticketCompany?.website || 'geistdesk-tech.com'}</span>
                         </div>
                         <Separator />
                         <div className="space-y-2">
                            <p className="text-[10px] font-bold text-[#5F6368] uppercase tracking-tighter">Recent Related Tickets</p>
                            {[1, 2].map(i => (
                               <div key={i} className="flex items-center justify-between group cursor-pointer">
                                  <span className="text-xs text-[#1A73E8] group-hover:underline truncate pr-2">#T-004{i} Issue with...</span>
                                  <span className="text-[10px] text-[#5F6368] shrink-0">2d ago</span>
                               </div>
                            ))}
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </aside>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white">
            <div className="w-20 h-20 bg-[#F1F3F4] rounded-full flex items-center justify-center mb-6">
              <Ticket className="w-10 h-10 text-[#5F6368]" />
            </div>
            <h2 className="text-2xl font-bold mb-3 text-[#202124]">Ticket Loading...</h2>
            <p className="text-[#5F6368] max-w-sm mx-auto mb-8 font-medium">
              We are retrieving the ticket details. Please wait a moment.
            </p>
          </div>
        )}
      </div>
    ) : (
      /* List View: Expanded Full Width */
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
                      <SheetTitle className="font-bold text-lg text-foreground uppercase tracking-tight">Master Filter List</SheetTitle>
                      <SheetDescription className="text-xs text-muted-foreground font-medium uppercase tracking-widest">GeistDesk Legal Guardrail & AI Controls</SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <ScrollArea className="flex-1 p-0">
                  <div className="p-8 space-y-10 pb-24">
                    {/* Category A: Standard Workflow */}
                    <div className="space-y-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-4 w-1 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                        <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Category A: Standard Workflow</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-5">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                            <UserRound className="w-3.5 h-3.5 text-primary" /> Agent (Includes)
                          </label>
                          <Select value={filters.agent} onValueChange={(v) => setFilters({...filters, agent: v})}>
                            <SelectTrigger className="w-full bg-muted/50 border-border rounded-xl h-11 font-medium">
                              <SelectValue placeholder="Select Agent" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any Agent</SelectItem>
                              <SelectItem value={user?.displayName || "Me"}>{user?.displayName || "Me"} (You)</SelectItem>
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
                              <SelectValue placeholder="Select Group" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any Group</SelectItem>
                              <SelectItem value="Support">Support Team</SelectItem>
                              <SelectItem value="Engineering">Engineering</SelectItem>
                              <SelectItem value="Billing">Billing & Sales</SelectItem>
                              <SelectItem value="Legal">Legal & Compliance</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Status
                            </label>
                            <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
                              <SelectTrigger className="w-full bg-muted/50 border-border rounded-xl h-11 font-bold">
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="any">Any</SelectItem>
                                {['New', 'Open', 'Pending', 'On-Hold', 'Solved', 'Closed'].map(s => (
                                  <SelectItem key={s} value={s.toLowerCase()}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-primary" /> Priorität
                            </label>
                            <Select value={filters.priority} onValueChange={(v) => setFilters({...filters, priority: v})}>
                              <SelectTrigger className="w-full bg-muted/50 border-border rounded-xl h-11 font-bold">
                                <SelectValue placeholder="Priority" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="any">Any</SelectItem>
                                {['Urgent', 'High', 'Medium', 'Low'].map(p => (
                                  <SelectItem key={p} value={p.toLowerCase()}>{p}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                            <Hash className="w-3.5 h-3.5 text-primary" /> Typ
                          </label>
                          <Select value={filters.type} onValueChange={(v) => setFilters({...filters, type: v})}>
                            <SelectTrigger className="w-full bg-muted/50 border-border rounded-xl h-11 font-medium">
                              <SelectValue placeholder="Select Type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any Type</SelectItem>
                              {['Question', 'Incident', 'Problem', 'Feature Request'].map(t => (
                                <SelectItem key={t} value={t.toLowerCase()}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5 text-primary" /> Tags
                          </label>
                          <div className="relative group/tag">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <Input 
                              placeholder="Search for specific labels..." 
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
                        <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Category B: AI-Enhanced (Contino)</h4>
                      </div>
                      <div className="space-y-5">
                        <div className="space-y-3">
                          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                            <Smile className="w-3.5 h-3.5 text-emerald-500" /> Gefühl (Sentiment)
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
                            <Globe className="w-3.5 h-3.5 text-emerald-500" /> Originalsprache
                          </label>
                          <Select value={filters.language} onValueChange={(v) => setFilters({...filters, language: v})}>
                            <SelectTrigger className="w-full bg-muted/50 border-border rounded-xl h-11 font-medium">
                              <SelectValue placeholder="All Languages" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Native/Any</SelectItem>
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
                               <span className="text-xs font-bold text-emerald-900 leading-none mb-0.5">AI-Confidence</span>
                               <span className="text-[9px] font-medium text-emerald-700/60 uppercase tracking-tighter">Requires Human Review</span>
                            </div>
                          </div>
                          <Select value={filters.aiConfidence} onValueChange={(v) => setFilters({...filters, aiConfidence: v})}>
                            <SelectTrigger className="w-28 bg-white border-emerald-200 text-[10px] font-black h-8 rounded-lg uppercase">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Standard</SelectItem>
                              <SelectItem value="low">Unsure (Low)</SelectItem>
                              <SelectItem value="high">Confident</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Category C: Timeline & SLA */}
                    <div className="space-y-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-4 w-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Category C: Timeline & SLA</h4>
                      </div>
                      <div className="space-y-5">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-blue-500" /> Erstellt (Created)
                          </label>
                          <Select value={filters.created} onValueChange={(v) => setFilters({...filters, created: v})}>
                            <SelectTrigger className="w-full bg-muted/50 border-border rounded-xl h-11 font-medium">
                              <SelectValue placeholder="Any time" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Total History</SelectItem>
                              <SelectItem value="24h">Last 24 Hours</SelectItem>
                              <SelectItem value="7d">Last 7 Days</SelectItem>
                              <SelectItem value="30d">Last 30 Days</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                            <History className="w-3.5 h-3.5 text-blue-500" /> Gelöst/Geschlossen am
                          </label>
                          <Select value={filters.closedAt} onValueChange={(v) => setFilters({...filters, closedAt: v})}>
                            <SelectTrigger className="w-full bg-muted/50 border-border rounded-xl h-11 font-medium">
                              <SelectValue placeholder="Completion State" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">All States</SelectItem>
                              <SelectItem value="today">CI/CD Finished Today</SelectItem>
                              <SelectItem value="yesterday">Finished Yesterday</SelectItem>
                              <SelectItem value="week">This Week</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col gap-3">
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                 <Clock className="w-4 h-4 text-blue-600" />
                                 <span className="text-xs font-bold text-blue-900 uppercase tracking-tight">Fällig bis (SLA)</span>
                              </div>
                              <Badge className="bg-blue-100 text-blue-700 border-none text-[9px] font-bold h-4">Real-time</Badge>
                           </div>
                           <Select value={filters.slaDue} onValueChange={(v) => setFilters({...filters, slaDue: v})}>
                             <SelectTrigger className="w-full bg-white border-blue-200 text-xs font-bold h-10 rounded-xl">
                               <SelectValue placeholder="Due urgency" />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="any">Any Urgency</SelectItem>
                               <SelectItem value="1h">Next 1 Hour</SelectItem>
                               <SelectItem value="4h">Next 4 Hours</SelectItem>
                               <SelectItem value="24h">Next 24 Hours</SelectItem>
                             </SelectContent>
                           </Select>
                        </div>
                      </div>
                    </div>

                    {/* Category D: Business Context */}
                    <div className="space-y-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-4 w-1 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                        <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Category D: Business Context</h4>
                      </div>
                      <div className="space-y-5">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-amber-500" /> Unternehmen (Company)
                          </label>
                          <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                              placeholder="Search by organization..." 
                              className="bg-muted/50 border-border rounded-xl pl-10 h-11 text-sm font-medium"
                              value={filters.company === 'any' ? '' : filters.company}
                              onChange={(e) => setFilters({...filters, company: e.target.value || 'any'})}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                            <Box className="w-3.5 h-3.5 text-amber-500" /> Produkte
                          </label>
                          <Select value={filters.product} onValueChange={(v) => setFilters({...filters, product: v})}>
                            <SelectTrigger className="w-full bg-muted/50 border-border rounded-xl h-11 font-medium">
                              <SelectValue placeholder="All Products" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Total Ecosystem</SelectItem>
                              <SelectItem value="GeistDeskTech">GeistDeskTech Core</SelectItem>
                              <SelectItem value="GeistDeskMobile">GeistDeskMobile Platform</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                            <Share2 className="w-3.5 h-3.5 text-amber-500" /> Quelle (Source)
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
                                {s.id}
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
                        Reset All
                      </Button>
                      <Button 
                        className="rounded-xl h-11 font-bold text-xs uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                        onClick={() => setIsFilterDrawerOpen(false)}
                      >
                        Apply Filters
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
                          Bulk Assign <ChevronDown className="w-3 h-3 text-slate-400" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 rounded-xl">
                          <DropdownMenuItem 
                            className="text-xs font-semibold cursor-pointer py-2" 
                            onClick={() => {
                              handleBulkUpdate({ agentId: user?.uid, agentName: user?.displayName || user?.email || 'Me' });
                              toast.success("Ausgewählte Tickets wurden Ihnen zugewiesen.");
                            }}
                          >
                            Assign to Me
                          </DropdownMenuItem>
                          <Separator className="my-1" />
                          {['Sarah James', 'Mike Chen', 'Sarah Connor'].map(agent => (
                            <DropdownMenuItem 
                              key={agent} 
                              className="text-xs cursor-pointer py-2" 
                              onClick={() => {
                                handleBulkUpdate({ agentName: agent, agentId: 'agent-' + agent.toLowerCase().replace(' ', '-') });
                                toast.success(`Tickets zugewiesen an ${agent}`);
                              }}
                            >
                              Assign to {agent}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Update Status button */}
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 px-3 rounded-full text-[10px] font-extrabold uppercase text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 gap-1 hover:bg-slate-50/65 shadow-xs cursor-pointer transition-colors">
                          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                          Update Status <ChevronDown className="w-3 h-3 text-slate-400" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-40 rounded-xl">
                          {['open', 'pending', 'resolved', 'closed'].map(statusVal => (
                            <DropdownMenuItem 
                              key={statusVal} 
                              className="capitalize text-xs cursor-pointer py-2" 
                              onClick={() => {
                                handleBulkUpdate({ status: statusVal as TicketStatus });
                                toast.success(`Status aktualisiert auf: ${statusVal}`);
                              }}
                            >
                              {statusVal}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Modify Priority button */}
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 px-3 rounded-full text-[10px] font-bold uppercase text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 gap-1 hover:bg-slate-50/65 shadow-xs cursor-pointer transition-colors">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                          Modify Priority <ChevronDown className="w-3 h-3 text-slate-400" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-40 rounded-xl">
                          {['low', 'medium', 'high', 'urgent'].map(priorityVal => (
                            <DropdownMenuItem 
                              key={priorityVal} 
                              className="capitalize text-xs cursor-pointer py-2" 
                              onClick={() => {
                                handleBulkUpdate({ priority: priorityVal as TicketPriority });
                                toast.success(`Priorität geändert auf: ${priorityVal}`);
                              }}
                            >
                              {priorityVal}
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
                        if (ticket.channel === 'whatsapp') return <span title="WhatsApp Channel"><MessageSquare className="w-3.5 h-3.5 text-emerald-500 animate-none shrink-0" /></span>;
                        if (ticket.channel === 'chat') return <span title="Live Chat"><MessageSquare className="w-3.5 h-3.5 text-blue-500 animate-none shrink-0" /></span>;
                        return <span title="Email Channel"><Mail className="w-3.5 h-3.5 text-slate-500 animate-none shrink-0" /></span>;
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
                                 setMousePos({ x: e.clientX, y: e.clientY });
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
                        return { label: 'VIP', style: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
                      }
                      if (ticket.company?.toLowerCase().includes('advanced') || ticket.company?.toLowerCase().includes('global') || ticket.tags?.includes('Enterprise')) {
                        return { label: 'Enterprise', style: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' };
                      }
                      return { label: 'Standard', style: 'bg-slate-100 text-slate-500 border-slate-200' };
                    })();

                    const sla = (() => {
                      if (ticket.status === 'resolved' || ticket.status === 'closed') return null;
                      const now = new Date();
                      const due = ticket.slaDueAt || ticket.firstResponseDue;
                      if (!due) return null;
                      const dueDate = due.toDate ? due.toDate() : new Date(due);
                      const diffMs = dueDate.getTime() - now.getTime();
                      if (diffMs < 0) return { label: 'SLA Breached', color: 'bg-red-500/10 text-rose-600 border-rose-200' };
                      const diffHrs = Math.ceil(diffMs / (1000 * 60 * 60));
                      if (diffHrs <= 12) return { label: `Breach in ${diffHrs}h`, color: 'bg-amber-500/10 text-amber-600 border-amber-200 animate-pulse' };
                      return { label: `Due ${diffHrs}h`, color: 'bg-slate-100 text-slate-600 border-slate-200' };
                    })();

                    const replies = (ticket.id.charCodeAt(1) % 5) + 2;
                    const channelIcon = (() => {
                      if (ticket.channel === 'whatsapp') return <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />;
                      if (ticket.channel === 'chat') return <MessageSquare className="w-3.5 h-3.5 text-blue-500" />;
                      return <Mail className="w-3.5 h-3.5 text-slate-500" />;
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
                              <span className="capitalize">{ticket.priority}</span>
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
                                {ticket.agentId === user?.uid ? 'Me' : (ticket.agentName || 'Unassigned')}
                              </span>
                            </div>
                            <span className="text-[9.5px]">
                              {ticket.updatedAt?.toDate ? ticket.updatedAt.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Today'}
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
        )}
      </div>

      <AnimatePresence>
        {hoveredTicketId && hoveredTicket && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed z-[100] w-[400px] pointer-events-none"
            style={{ 
              left: Math.min(mousePos.x + 20, window.innerWidth - 430), 
              top: Math.min(mousePos.y, window.innerHeight - 500) 
            }}
          >
            <div className="bg-card rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-border overflow-hidden flex flex-col backdrop-blur-xl">
              <div className="p-4 border-b bg-muted flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('tickets.peekView', 'Peek View')}</span>
                 </div>
                 <Badge variant="outline" className="text-[9px] font-bold border-border text-muted-foreground">#{hoveredTicket.id.slice(0, 4)}</Badge>
              </div>
              
              <div className="p-5 space-y-4">
                 {/* Sentiment Indicator */}
                 <div className="flex items-center justify-between p-3 bg-muted rounded-xl border border-border">
                    <div className="flex items-center gap-2">
                       <Sparkles className="w-3.5 h-3.5 text-[#1A73E8]" />
                       <span className="text-[10px] font-bold text-[#5F6368] uppercase tracking-tight">{t('tickets.aiSentimentAnalysis', 'AI Sentiment Analysis')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-card border border-border">
                       {hoveredTicket.sentiment === 'angry' ? <Angry className="w-3 h-3 text-rose-500" /> :
                        hoveredTicket.sentiment === 'negative' ? <Frown className="w-3 h-3 text-orange-500" /> :
                        hoveredTicket.sentiment === 'positive' ? <Smile className="w-3 h-3 text-emerald-500" /> :
                        <Meh className="w-3 h-3 text-slate-400" />}
                       <span className={cn(
                          "text-[9px] font-bold uppercase",
                          hoveredTicket.sentiment === 'angry' ? "text-rose-600" :
                          hoveredTicket.sentiment === 'negative' ? "text-orange-600" :
                          hoveredTicket.sentiment === 'positive' ? "text-emerald-600" :
                          "text-slate-500"
                       )}>{hoveredTicket.sentiment || 'neutral'}</span>
                    </div>
                 </div>

                 {/* Internal Notes */}
                 {hoveredTicket.internalNotes ? (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                       <div className="flex items-center gap-1.5 mb-2">
                          <Info className="w-3.5 h-3.5 text-amber-600" />
                          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-tight">{t('tickets.internalNote', 'Internal Note')}</span>
                       </div>
                       <p className="text-xs text-amber-800 font-medium leading-relaxed italic">
                          "{hoveredTicket.internalNotes}"
                       </p>
                    </div>
                 ) : (
                    <div className="flex items-center gap-2 p-3 bg-[#F8F9FA] rounded-xl border border-[#DADCE0] border-dashed">
                       <Info className="w-3.5 h-3.5 text-[#BDC1C6]" />
                       <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight italic">{t('tickets.noInternalNotesYet', 'No internal notes yet')}</span>
                    </div>
                 )}

                 {/* Last Messages */}
                 <div className="space-y-3">
                    <div className="flex items-center gap-2">
                       <MessageSquare className="w-3.5 h-3.5 text-[#1A73E8]" />
                       <span className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest">{t('tickets.recentActivity', 'Recent Activity')}</span>
                    </div>
                    
                    <div className="space-y-3">
                       {peekMessages.length > 0 ? (
                          peekMessages.map((msg, i) => (
                             <div key={msg.id} className={cn(
                                "p-3 rounded-xl border transition-all",
                                i === 0 ? "bg-accent border-accent shadow-sm ml-4" : "bg-card border-border mr-4"
                             )}>
                                <div className="flex items-center justify-between mb-1">
                                   <span className="text-[10px] font-bold text-muted-foreground uppercase">{msg.senderName || msg.senderType}</span>
                                   <span className="text-[9px] text-[#9AA0A6]">{msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</span>
                                </div>
                                <p className="text-xs text-foreground line-clamp-3 leading-relaxed">
                                   {redactPII(stripHtml(msg.content))}
                                </p>
                             </div>
                          ))
                       ) : (
                          <p className="text-xs text-muted-foreground italic pl-6 py-4">Loading conversation thread...</p>
                       )}
                    </div>
                 </div>
              </div>
              
              <div className="px-5 py-3 bg-muted border-t border-border flex items-center gap-2">
                 <Zap className="w-3.5 h-3.5 text-primary" />
                 <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight italic">Press to Expand for Full Context</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The Unifier: Merge Tickets Dialog */}
      <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
        <DialogContent className="sm:max-w-[500px] border-border bg-card">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100">
                <GitMerge className="w-5 h-5 text-indigo-600" />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">The Unifier</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground">
              Select the original ticket to merge this current duplicate into. 
              <br/>
              <span className="font-bold text-destructive">Warning:</span> All messages from this ticket will be moved, and this ticket will be marked as merged.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <label className="text-xs font-bold text-foreground uppercase tracking-widest px-1">Original Ticket Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by ID or Subject..." 
                  className="pl-10 h-12 bg-muted/30 border-border rounded-xl"
                  value={mergeSearchQuery}
                  onChange={(e) => setMergeSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
               {mergeSearchSuggestions.length > 0 ? (
                 mergeSearchSuggestions.map((t) => (
                   <button 
                     key={t.id}
                     onClick={() => handleMerge(t.id)}
                     className="w-full text-left p-4 rounded-xl border border-border bg-card hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group flex items-center justify-between"
                   >
                     <div className="flex flex-col gap-1 overflow-hidden">
                       <span className="text-xs font-black text-indigo-600 uppercase tracking-tighter">#{t.id.slice(-5).toUpperCase()}</span>
                       <span className="text-sm font-bold text-foreground truncate">{t.subject}</span>
                       <div className="flex items-center gap-2 mt-1">
                          <Badge className="text-[9px] font-bold h-4 uppercase">{t.status}</Badge>
                          <span className="text-[10px] text-muted-foreground">{t.customerName}</span>
                       </div>
                     </div>
                     <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                   </button>
                 ))
               ) : mergeSearchQuery.trim() ? (
                 <div className="py-8 text-center text-muted-foreground space-y-2">
                    <SearchCheck className="w-8 h-8 mx-auto opacity-20" />
                    <p className="text-xs font-medium">No original ticket found for "{mergeSearchQuery}"</p>
                 </div>
               ) : (
                 <div className="py-8 text-center text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border">
                    <Info className="w-8 h-8 mx-auto opacity-20 mb-2" />
                    <p className="text-xs font-medium">Enter a ticket ID or subject <br/> to find the original thread.</p>
                 </div>
               )}
            </div>
          </div>

          <DialogFooter className="sm:justify-start">
            <Button 
              variant="ghost" 
              className="text-xs font-bold uppercase text-muted-foreground"
              onClick={() => setIsMergeDialogOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AnimatePresence>
        {selectedTicketIds.length > 0 && (
          <motion.div 
            initial={{ y: 50, x: '-50%', opacity: 0 }}
            animate={{ y: 0, x: '-50%', opacity: 1 }}
            exit={{ y: 50, x: '-50%', opacity: 0 }}
            className="fixed bottom-8 left-1/2 z-[1000] bg-gray-900 text-white rounded-2xl shadow-2xl border border-gray-800 p-4 px-6 flex items-center gap-8 min-w-[700px] backdrop-blur-md"
          >
            <div className="flex items-center gap-3 pr-6 border-r border-gray-700">
              <div className="bg-primary h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-black">
                {selectedTicketIds.length}
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Selected</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedTicketIds([])}
                className="h-7 text-[10px] text-gray-400 hover:text-white"
              >
                Clear
              </Button>
            </div>

            <div className="flex items-center gap-6">
               <div className="flex flex-col gap-1">
                 <span className="text-[9px] font-black text-gray-500 uppercase">Mass Status</span>
                 <div className="flex items-center gap-2">
                   {['open', 'pending', 'resolved', 'closed'].map(status => (
                     <Button 
                       key={status}
                       variant="ghost"
                       size="sm"
                       onClick={() => handleBulkUpdate({ status: status as TicketStatus })}
                       className="h-7 text-[10px] font-bold bg-gray-800 hover:bg-primary hover:text-white rounded-lg capitalize"
                     >
                       {status}
                     </Button>
                   ))}
                 </div>
               </div>

               <div className="flex flex-col gap-1 ml-4">
                 <span className="text-[9px] font-black text-gray-500 uppercase">Assignment</span>
                 <div className="flex items-center gap-2">
                   <Button 
                     variant="ghost"
                     size="sm"
                     onClick={() => handleBulkUpdate({ agentId: user?.uid, agentName: user?.displayName || user?.email || 'Me' })}
                     className="h-7 text-[10px] font-bold bg-primary/20 text-primary hover:bg-primary hover:text-white rounded-lg"
                   >
                     Assign to Me
                   </Button>
                   <Button 
                     variant="ghost"
                     size="sm"
                     className="h-7 text-[10px] font-bold bg-gray-800 hover:bg-gray-700 rounded-lg"
                   >
                      Set Team...
                   </Button>
                 </div>
               </div>

               <div className="flex flex-col gap-1 ml-4">
                 <span className="text-[9px] font-black text-gray-500 uppercase">Destruction</span>
                 <Button 
                   variant="ghost"
                   size="sm"
                   onClick={() => handleBulkUpdate({ status: 'trash' })}
                   className="h-7 text-[10px] font-bold bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg"
                 >
                    Move to Trash
                 </Button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={isSentimentBreakdownOpen} onOpenChange={setIsSentimentBreakdownOpen}>
        <DialogContent className="max-w-md bg-card border-border shadow-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Sentiment Breakdown
            </DialogTitle>
            <DialogDescription>
              AI-powered analysis of the customer's emotional state throughout this ticket.
            </DialogDescription>
          </DialogHeader>
          
          {sentimentTicketId && (
            <div className="space-y-6 pt-4">
              {(() => {
                const ticket = allTickets.find(t => t.id === sentimentTicketId);
                if (!ticket) return null;
                
                return (
                  <>
                    <div className="flex items-center justify-between p-4 bg-muted rounded-2xl border border-border">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Calculated Sentiment</p>
                        <p className="text-xl font-black text-foreground capitalize">{ticket.sentiment || 'Neutral'}</p>
                      </div>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center bg-card border border-border shadow-sm">
                        {ticket.sentiment === 'angry' && <Angry className="w-7 h-7 text-rose-500" />}
                        {ticket.sentiment === 'negative' && <Frown className="w-7 h-7 text-orange-500" />}
                        {ticket.sentiment === 'positive' && <Smile className="w-7 h-7 text-emerald-500" />}
                        {(!ticket.sentiment || ticket.sentiment === 'neutral') && <Meh className="w-7 h-7 text-slate-400" />}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-primary" />
                        AI Analysis Details
                      </h4>
                      <div className="space-y-2">
                        {ticket.sentiment === 'angry' ? (
                          <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl">
                            <p className="text-sm text-foreground/80 leading-relaxed font-medium">
                              AI detected high frustration in this ticket based on multiple signal factors:
                            </p>
                            <ul className="mt-2 space-y-1.5 list-disc list-inside text-xs text-muted-foreground">
                              <li>Highly negative framing of problem description</li>
                              <li>Multiple exclamatory or capitalized phrases</li>
                              <li>History of similar unresolved issues</li>
                              <li>Urgency signals exceeding standard priority thresholds</li>
                            </ul>
                          </div>
                        ) : ticket.sentiment === 'negative' ? (
                          <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                            <p className="text-sm text-foreground/80 leading-relaxed font-medium">
                              AI detected negative undertones in this interaction:
                            </p>
                            <ul className="mt-2 space-y-1.5 list-disc list-inside text-xs text-muted-foreground">
                              <li>Polite but disappointed language markers</li>
                              <li>Expressions of repeated failure to solve the issue</li>
                              <li>Concerned regarding impact on their business workflow</li>
                            </ul>
                          </div>
                        ) : ticket.sentiment === 'positive' ? (
                          <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                            <p className="text-sm text-foreground/80 leading-relaxed font-medium">
                              Customer appears satisfied with the current progress:
                            </p>
                            <ul className="mt-2 space-y-1.5 list-disc list-inside text-xs text-muted-foreground">
                              <li>Gratitude markers detected ("Thanks", "Helpful")</li>
                              <li>Optimistic framing of the conversation</li>
                              <li>Calm and cooperative response patterns</li>
                            </ul>
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-500/5 border border-slate-500/20 rounded-xl">
                            <p className="text-sm text-foreground/80 leading-relaxed font-medium">
                              Sentiment remains neutral or transactional:
                            </p>
                            <ul className="mt-2 space-y-1.5 list-disc list-inside text-xs text-muted-foreground">
                              <li>Matter-of-fact communication style</li>
                              <li>Focus solely on technical requirements</li>
                              <li>No significant emotional markers detected</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-muted p-4 rounded-xl border border-border">
                       <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Recommended Action</p>
                       <p className="text-xs text-foreground font-semibold">
                          {ticket.sentiment === 'angry' ? "Transfer to Senior Specialist immediately." : 
                           ticket.sentiment === 'negative' ? "Address with extra empathy and offer a workaround." :
                           "Continue standard processing pipeline."}
                       </p>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          
          <DialogFooter className="mt-6 border-t pt-4 bg-muted/30 px-6 -mx-6 -mb-6">
            <Button onClick={() => setIsSentimentBreakdownOpen(false)} className="rounded-full px-8 font-bold">
              Dismiss Analysis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Actions Toolbar */}
      <AnimatePresence>
        {selectedTicketIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-full px-6 py-3 shadow-2xl shadow-black/40"
          >
            <div className="flex items-center gap-3 pr-4 border-r border-gray-800">
              <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white">
                {selectedTicketIds.length}
              </div>
              <span className="text-xs font-bold text-white">Tickets Selected</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedTicketIds([])}
                className="h-7 text-[10px] uppercase font-bold text-gray-400 hover:text-white hover:bg-gray-800"
              >
                Cancel
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="ghost" size="sm" className="h-9 px-4 rounded-full text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 gap-2">
                    Status <ChevronDown className="w-3 h-3" />
                  </Button>
                } />
                <DropdownMenuContent className="w-40">
                  {['open', 'pending', 'resolved', 'closed'].map(s => (
                    <DropdownMenuItem key={s} className="capitalize text-xs" onClick={() => handleBulkUpdate({ status: s as any })}>
                      {s}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="ghost" size="sm" className="h-9 px-4 rounded-full text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 gap-2">
                    Priority <ChevronDown className="w-3 h-3" />
                  </Button>
                } />
                <DropdownMenuContent className="w-40">
                  {['low', 'medium', 'high', 'urgent'].map(p => (
                    <DropdownMenuItem key={p} className="capitalize text-xs" onClick={() => handleBulkUpdate({ priority: p as any })}>
                      {p}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="ghost" size="sm" className="h-9 px-4 rounded-full text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 gap-2">
                    Assign Agent <ChevronDown className="w-3 h-3" />
                  </Button>
                } />
                <DropdownMenuContent className="w-56">
                  <DropdownMenuItem className="text-xs font-semibold" onClick={() => handleBulkUpdate({ agentId: user?.uid, agentName: user?.email })}>
                    Assign to me
                  </DropdownMenuItem>
                  <Separator className="my-1" />
                  {['Sarah Agent', 'Mike Lead', 'Dev Team'].map(a => (
                    <DropdownMenuItem key={a} className="text-xs" onClick={() => handleBulkUpdate({ agentName: a })}>
                      {a}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="w-px h-6 bg-gray-800 mx-2" />

              <Tooltip>
                <TooltipTrigger 
                  className="h-9 w-9 rounded-full text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center justify-center transition-colors cursor-pointer"
                  onClick={() => handleBulkUpdate({ status: 'deleted' })}
                >
                  <Trash2 className="w-4 h-4" />
                </TooltipTrigger>
                <TooltipContent>Move to Trash</TooltipContent>
              </Tooltip>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GeistDesk Handoff Engine Modal */}
      <Dialog open={isHandoffOpen} onOpenChange={setIsHandoffOpen}>
        <DialogContent className="sm:max-w-[500px] bg-slate-50 border-amber-100 rounded-2xl overflow-hidden p-0 gap-0 shadow-2xl">
          <div className="bg-amber-50 p-6 border-b border-amber-100">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-amber-100 p-2 rounded-xl">
                  <UserPlus className="w-5 h-5 text-amber-600" />
                </div>
                <Badge variant="outline" className="bg-white border-amber-200 text-amber-700 text-[10px] font-black uppercase tracking-widest px-2 h-5">
                  GeistDesk Handoff Engine
                </Badge>
              </div>
              <DialogTitle className="text-xl font-bold text-slate-900">High-Priority Transfer Briefing</DialogTitle>
              <DialogDescription className="text-slate-500 font-medium text-sm">
                AI is summarizing the context to ensure a smooth transition for the next agent.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-6">
            {isGeneratingHandoff ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                  <div className="h-12 w-12 border-4 border-amber-100 border-t-amber-500 rounded-full animate-spin" />
                  <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-amber-500 animate-pulse" />
                </div>
                <p className="text-xs font-black text-amber-600 uppercase tracking-widest animate-pulse">Analyzing thread logic...</p>
              </div>
            ) : handoffSummary ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-slate-400" />
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-tighter">What the customer wants</label>
                  </div>
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm italic text-sm text-slate-700 leading-relaxed font-medium">
                    "{handoffSummary.customerGoal}"
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-tighter">Effort Invested So Far</label>
                  </div>
                  <div className="space-y-2">
                    {handoffSummary.effortSoFar.map((effort, i) => (
                      <div key={i} className="flex gap-3 items-start group">
                        <div className="mt-1 h-5 w-5 bg-white border border-slate-200 rounded-lg flex items-center justify-center shrink-0 group-hover:border-amber-300 transition-colors">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        </div>
                        <span className="text-xs text-slate-600 font-medium leading-normal pt-0.5">{effort}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-100/50 p-3 rounded-lg flex items-center gap-3 border border-amber-200">
                   <ShieldCheck className="w-4 h-4 text-amber-600" />
                   <p className="text-[10px] font-bold text-amber-800 leading-tight">
                     Confirming this transfer will automatically pin this briefing as a <span className="font-black text-amber-950 uppercase">Golden Note</span> for the next agent.
                   </p>
                </div>
              </motion.div>
            ) : (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-medium text-center">
                Failed to generate briefing. You can still confirm the transfer.
              </div>
            )}
          </div>

          <DialogFooter className="p-6 pt-2 bg-slate-50/50 border-t border-slate-100 gap-2">
            <Button variant="ghost" onClick={() => setIsHandoffOpen(false)} className="rounded-xl font-bold text-xs h-10 px-6">
              Cancel Transfer
            </Button>
            <Button 
                onClick={confirmHandoff}
                disabled={isGeneratingHandoff}
                className="bg-slate-900 text-white hover:bg-black rounded-xl font-black text-xs h-10 px-6 shadow-lg shadow-slate-200"
            >
              Confirm Transfer <ArrowRight className="w-3.5 h-3.5 ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
