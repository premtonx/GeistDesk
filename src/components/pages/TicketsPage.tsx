import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronLeft, Ticket } from 'lucide-react';
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
import { suggestNeuralLinks, SuggestedLink } from '../../services/neuralLinkService';
import { cn, safeString } from '../../lib/utils';
import { ScrollArea } from '../../components/ui/scroll-area';
import { toast } from 'sonner';
import { Ticket as TicketType, Message, KBArticle, Company, Contact, TicketChecklistItem } from '../../types';
import type { AiCritiqueLog, AiTicketExecutionStatus } from '../../types/ai-orchestrator';
import { redactPII, isTextSensitive } from '../../lib/ai/pii-shield';
import { stripHtml } from '../kb/kb-utils';
import { logDraftDiffIfSubstantial } from '../../lib/ai/human-diff-learning';
import { AIAdapter } from '../../lib/ai/provider-adapter';
import { subscribeOrchestratorConfig, startOrchestratorConfigSync } from '../../lib/aiOrchestratorClient';
import { useWorkspaceModuleConfig } from '../../hooks/useWorkspaceModuleConfig';
import { getActiveSupportedLanguages } from '../../lib/polyglot-bridge';

interface AiDraftMetaState {
  rawDraft: string;
  confidenceScore: number | null;
  critiqueLog: AiCritiqueLog | null;
  executionStatus: AiTicketExecutionStatus;
}

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
import { CreateTicketDialog } from '../CreateTicketDialog';
import { FlagIcon, languageToFlagCode } from '../ui/FlagIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { TicketsLeftSidebar } from '../tickets/TicketsLeftSidebar';
import { TicketsSidebarManageSheet } from '../tickets/TicketsSidebarManageSheet';
import { TicketListView } from '../tickets/TicketListView';
import { TicketDetailContextPane } from '../tickets/TicketDetailContextPane';
import { TicketDetailView } from '../tickets/TicketDetailView';
import { TicketDialogs } from '../tickets/TicketDialogs';
import { TicketMergeDialog } from '../tickets/TicketMergeDialog';
import { TICKETS_SIDEBAR_GROUPS } from '../tickets/ticketsSidebarConfig';
import { TicketsLayoutMode } from '../tickets/TicketsViewModeSelector';
import { isReadonlyTerminalStatus } from '../../lib/ticket-status';
import { ticketsShareCustomer } from '../../lib/ticketMerge';
const matchStatus = (status: string | undefined, target: string): boolean => {
  if (!status) return false;
  return String(status).toLowerCase().trim() === target.toLowerCase().trim();
};

const hasTagCaseInsensitive = (tags: string[] | undefined, target: string): boolean => {
  if (!tags) return false;
  return tags.some(tag => String(tag).toLowerCase().trim() === target.toLowerCase().trim());
};

/**
 * Normalize an assignee change into the full set of fields the ticket stores.
 * Writes agentId/agentName plus alias fields so every consumer (list, detail,
 * backend mirror, RAG) sees the same assignee regardless of which screen set it.
 * - `null`  → explicit unassignment (persisted as NULL)
 * - `undefined` → field not provided; preserved server-side (omitted)
 */
const buildAssigneePayload = (
  agentId: string | undefined | null,
  agentName: string | undefined | null,
  assignedToEmail?: string,
): Partial<TicketType> => {
  const payload: Partial<TicketType> = {};
  if (agentId !== undefined) {
    payload.agentId = agentId;
    payload.assignedTo = agentId;
    payload.assigneeId = agentId;
  }
  if (agentName !== undefined) payload.agentName = agentName;
  if (assignedToEmail !== undefined) payload.assignedToEmail = assignedToEmail;
  return payload;
};

export default function TicketsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { role, loading: permsLoading } = usePermissions();
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(ticketId || null);
  const [replyText, setReplyText] = useState('');
  const [isMobilePropertiesOpen, setIsMobilePropertiesOpen] = useState(false);
  const [activeView, setActiveView] = useState<string>(() => {
    return localStorage.getItem('geistdesk_default_view') || 'team_all_open';
  });
  const [topStatusFilter, setTopStatusFilter] = useState<TopStatusFilterId>('all');
  const [drawerTicketId, setDrawerTicketId] = useState<string | null>(null);
  const [pendingResolveStatus, setPendingResolveStatus] = useState<string | null>(null);
  const [pendingResolveIncludeRag, setPendingResolveIncludeRag] = useState(true);
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

  const [additionalCategory] = useState<string | null>(() => {
    return localStorage.getItem('geistdesk_additional_category') || null;
  });
  const [categoryOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('geistdesk_category_order');
    return saved ? JSON.parse(saved) : ['inbox', 'my_work', 'team', 'priority', 'ai', 'kb', 'maintenance'];
  });
  const [defaultViewSetting] = useState<string>(() => {
    return localStorage.getItem('geistdesk_default_view') || 'unassigned';
  });

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
      const fallback = visibleViewIds.includes(defaultViewSetting)
        ? defaultViewSetting
        : 'team_all_open';
      setActiveView(fallback);
    }
  }, [sidebarPrefs.customViews, activeView, defaultViewSetting]);

  const [searchQuery, setSearchQuery] = useState('');
  const [legalViolation, setLegalViolation] = useState<LegalValidationResult | null>(null);
  const [isValidatingLegal, setIsValidatingLegal] = useState(false);
  const [watchedTicketIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('watchedTickets');
    return saved ? JSON.parse(saved) : [];
  });
  const collapsedGroups = sidebarPrefs.collapsedGroups;

  const toggleGroup = (group: string) => {
    toggleGroupCollapsed(group);
  };
  const [viewDensity] = useState<'comfortable' | 'compact'>('compact');
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isSentimentBreakdownOpen, setIsSentimentBreakdownOpen] = useState(false);
  const [sentimentTicketId] = useState<string | null>(null);
  const [ticketCompany, setTicketCompany] = useState<Company | null>(null);
  const [ticketContact, setTicketContact] = useState<Contact | null>(null);
  const [contactSchema, setContactSchema] = useState<CustomField[]>([]);

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
  const [isKbConvertOpen, setIsKbConvertOpen] = useState(false);
  const [isKbDrafting, setIsKbDrafting] = useState(false);
  const [kbDraft, setKbDraft] = useState<{ title: string; content: string; tags: string[] } | null>(null);
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

  const [suggestedTags] = useState<string[]>(['Billing', 'API_Error', 'Performance']);
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
    // Normalize assignee changes so agentId/agentName plus alias fields are
    // persisted together (list + detail screens use the same payload shape).
    const isAssigneeChange =
      data.agentId !== undefined ||
      data.agentName !== undefined ||
      data.assignedTo !== undefined ||
      data.assigneeId !== undefined;
    const payload: Partial<TicketType> = isAssigneeChange
      ? buildAssigneePayload(
          (data.agentId ?? data.assignedTo ?? data.assigneeId) as string | null | undefined,
          data.agentName,
          data.assignedToEmail,
        )
      : data;

    if (isReadonlyTerminalStatus(String(payload.status ?? '')) && payload.status === 'merged') {
      toast.error(t('tickets.merge.cannotSetManually', 'Zusammengeführt kann nicht manuell gesetzt werden.'));
      return;
    }

    // Snapshot the pre-update ticket so a failed write can be rolled back.
    const original = allTickets.find(t => t.id === ticketId);

    // Optimistic UI Update — selectedTicket is derived from allTickets,
    // so updating allTickets also refreshes the detail view. Shallow-spread
    // preserves nested structures (tags, messages, customFields, aiMetadata).
    setAllTickets(prev => prev.map(t => (t.id === ticketId ? { ...t, ...payload } : t)));

    try {
      await ticketService.updateTicket(ticketId, payload);
      toast.success(isAssigneeChange
        ? t('tickets.assignedToast', 'Ticket erfolgreich zugewiesen')
        : t('tickets.updatedToast', 'Ticket updated'));
    } catch (error) {
      // Roll back the optimistic merge on failure so the UI never shows a
      // phantom assignment/status.
      if (original) {
        setAllTickets(prev => prev.map(t => (t.id === ticketId ? original : t)));
      }
      toast.error(t('tickets.failedToast', 'Failed to update ticket'));
    }
  };

  const [isAiDrafting, setIsAiDrafting] = useState(false);
  const [ghostDraft, setGhostDraft] = useState('');
  const [isGhostDrafting, setIsGhostDrafting] = useState(false);
  // 3-Tier Agentic Graph — dispatch metadata for the active draft (confidence,
  // critique trace, execution status) used by the badge / approve & send UI.
  const [aiDraftMeta, setAiDraftMeta] = useState<AiDraftMetaState | null>(null);
  const [ghostDraftMeta, setGhostDraftMeta] = useState<AiDraftMetaState | null>(null);
  const [suggestedNeuralLinks, setSuggestedNeuralLinks] = useState<SuggestedLink[]>([]);
  const [isFindingNeuralLinks, setIsFindingNeuralLinks] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [mergeDialogAllowSearch, setMergeDialogAllowSearch] = useState(false);
  const [mergeDialogTickets, setMergeDialogTickets] = useState<TicketType[]>([]);
  const [isMerging, setIsMerging] = useState(false);

  const [aiSummary, setAiSummary] = useState<string>("");
  const [aiSources, setAiSources] = useState<{ paragraph: string; articleTitle: string; articleId?: string }[]>([]);

  // Redesign states
  const [activeDetailTab, setActiveDetailTab] = useState<string>('conversation');

  // Polyglot Bridge State
  const { config: moduleConfig } = useWorkspaceModuleConfig();
  const activePolyglotLanguages = useMemo(
    () => getActiveSupportedLanguages(moduleConfig.languages),
    [moduleConfig.languages],
  );
  const [agentLanguage, setAgentLanguage] = useState<string>(() => {
    return localStorage.getItem('agentLanguage') || 'English';
  });
  useEffect(() => {
    localStorage.setItem('agentLanguage', agentLanguage);
  }, [agentLanguage]);

  const [translationMood] = useState<'Professional' | 'Casual' | 'Empathetic'>('Professional');
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
      userEmail: user?.email ?? '',
      userName: user?.displayName || user?.email?.split('@')[0] || '',
      watchedTicketIds,
      allTickets,
      isAiReady,
      customViews: sidebarPrefs.customViews,
    }),
    [user?.uid, user?.email, user?.displayName, watchedTicketIds, allTickets, isAiReady, sidebarPrefs.customViews],
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

    const scope = (role?.visibilityScope === 'assigned' || role?.name === 'Restricted Agent') ? 'assigned' : 'all';

    return ticketService.subscribeToTickets((tickets) => {
      setAllTickets(tickets);
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

  const [hoveredTicketId, setHoveredTicketId] = useState<string | null>(null);
  const [peekMessages, setPeekMessages] = useState<Message[]>([]);
  const [peekOffset, setPeekOffset] = useState({ x: 0, y: 0 });
  const mousePosRef = useRef({ x: 0, y: 0 });

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

  const handleMouseMove = (e: React.MouseEvent) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY };
    setPeekOffset(mousePosRef.current);
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
        String(t.subject ?? '').toLowerCase().includes(query) ||
        String(t.id ?? '').toLowerCase().includes(query) ||
        (t.customerName && String(t.customerName).toLowerCase().includes(query)) ||
        (t.company && String(t.company).toLowerCase().includes(query)) ||
        (t.tags && t.tags.some(tag => String(tag).toLowerCase().includes(query))) ||
        (t.description && String(t.description).toLowerCase().includes(query))
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
        ((t as any).sourceInfo && String((t as any).sourceInfo).toLowerCase().includes(info)) ||
        String(t.subject ?? '').toLowerCase().includes(info)
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
  const headerCheckboxActive =
    tickets.length > 0 && tickets.every((ticket) => selectedTicketIds.includes(ticket.id));
  const selectedTicketsForMerge = allTickets.filter(
    (ticket) => selectedTicketIds.includes(ticket.id) && ticket.status !== 'merged',
  );
  const canBulkMerge =
    selectedTicketsForMerge.length >= 2 && ticketsShareCustomer(selectedTicketsForMerge);

  useEffect(() => {
    setCurrentPage(1);
  }, [totalTicketsCount, pageSize]);

  // Derive the selected ticket from the MASTER list (allTickets), not from the
  // filtered subset. Assigning a ticket can move it out of the active view
  // (e.g. "Nicht zugewiesen"), so the detail pane must keep resolving the
  // selection against the full list or it would crash with a null dereference
  // the moment the ticket disappears from the filter.
  const selectedTicket = useMemo(() => {
    if (!selectedTicketId) return null;
    return allTickets.find((t) => t.id === selectedTicketId) || null;
  }, [allTickets, selectedTicketId]) as TicketType | null;

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
    // Store the pending assignment (only agent-related fields), open the modal,
    // then try to enrich it with an AI briefing. The AI summary is optional:
    // if it fails, the agent can still confirm the transfer.
    setPendingAgentUpdate({ id, data });
    setIsHandoffOpen(true);
    setIsGeneratingHandoff(true);
    setHandoffSummary(null);
    try {
      const response = await axios.post(`/api/tickets/${id}/handoff-summary`);
      setHandoffSummary(response.data);
    } catch (e) {
      // Non-blocking: keep the modal open so the transfer can still be
      // confirmed. The dialog already shows a fallback hint when there is
      // no summary.
      console.warn('Handoff summary generation failed — proceeding without briefing.', e);
    } finally {
      setIsGeneratingHandoff(false);
    }
  };

  const confirmHandoff = async () => {
    if (!pendingAgentUpdate || !selectedTicketId) return;

    const { id: targetTicketId, data } = pendingAgentUpdate;
    const isAssigneeChange = data && (data.agentName !== undefined || data.agentId !== undefined);
    const assigneePayload = isAssigneeChange
      ? buildAssigneePayload(data.agentId, data.agentName, data.assignedToEmail)
      : {};

    try {
      // 1. Update the ticket assignee — always the primary action, awaited first.
      if (isAssigneeChange) {
        await ticketService.updateTicket(targetTicketId, assigneePayload);
        // Update React state immediately so the new assignee displays in the UI.
        setAllTickets(prev =>
          prev.map(t => (t.id === targetTicketId ? { ...t, ...assigneePayload } : t)),
        );
      }

      // 2. Best-effort: save the Golden Note briefing if we have a summary.
      //    A failure here must never block or fail the handoff.
      if (handoffSummary) {
        try {
          const content = `[NEXUS HANDOFF BRIEFING]\n\nCUSTOMER GOAL: ${handoffSummary.customerGoal}\n\nEFFORT SO FAR:\n${handoffSummary.effortSoFar.map(e => `• ${e}`).join('\n')}`;
          await axios.post(`/api/tickets/${targetTicketId}/golden-note`, {
            content,
            authorId: user?.uid,
            authorName: user?.email || 'System'
          });
          toast.success(t('tickets.handoff.successWithNote', 'Übergabe erfolgreich, Golden Note gespeichert.'));
        } catch (e) {
          console.warn('Golden Note could not be saved, but the handoff completed.', e);
          toast.warning(t('tickets.handoff.successNoNote', 'Übergabe erfolgreich, Briefing konnte nicht gespeichert werden'));
        }
      } else {
        toast.success(t('tickets.handoff.success', 'Übergabe erfolgreich'));
      }
    } catch (e) {
      console.error('Handoff assignment failed:', e);
      toast.error(t('tickets.handoff.failedToast', 'Handoff failed.'));
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

    // Direct navigation: single click opens the full ticket view (no drawer).
    openFullTicketView(id);
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

  const confirmResolveStatusChange = async () => {
    if (!pendingResolveStatus || !selectedTicket) return;
    const status = pendingResolveStatus;
    setPendingResolveStatus(null);
    try {
      await ticketService.updateTicket(selectedTicket.id, {
        status: status as any,
        include_in_rag: pendingResolveIncludeRag,
        resolvedAt: status === 'resolved' ? new Date() : undefined,
      });
      toast.success(status === 'resolved' ? 'Ticket als gelöst markiert.' : 'Ticket geschlossen.');
    } catch (error) {
      toast.error('Status konnte nicht aktualisiert werden.');
      console.error('[resolve] failed to update ticket', error);
    }
  };

  const autoGenerateZeroDraft = async (ticketId: string) => {
    if (!isAiReady) {
      console.log("AI is not configured. Skipping zero-draft generation.");
      return;
    }
    const ticket = allTickets.find(t => t.id === ticketId);
    if (!ticket) return;

    setIsGhostDrafting(true);
    try {
      // Feature: Hybrid RAG (pgvector + FTS) — grounding drafts in KB + resolved tickets
      const grounded = await ragService.findRelevantContextHybrid(
        `${ticket.subject} ${ticket.description}`,
        kbArticles,
        allTickets,
      );
      const relevantContext = grounded.results;
      
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
      
      const draftText = redactPII(response.text);
      const confidenceScore =
        response.confidenceScore !== undefined && response.confidenceScore !== null
          ? Math.min(100, Math.max(0, Math.round(response.confidenceScore)))
          : null;
      const executionStatus = response.executionStatus ?? (confidenceScore === null ? 'nuanced' : confidenceScore >= 95 ? 'high_confidence' : 'nuanced');

      setGhostDraft(draftText);
      setGhostDraftMeta({
        rawDraft: draftText,
        confidenceScore,
        critiqueLog: response.critiqueLog ?? null,
        executionStatus,
      });
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
      setAiDraftMeta(ghostDraftMeta);
      setGhostDraft('');
      setGhostDraftMeta(null);
      toast.success("AI draft accepted (Tab)");
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

  const generateAiReply = async () => {
    if (!selectedTicket) return;
    
    setIsAiDrafting(true);
    try {
      // Feature: Hybrid RAG (pgvector + FTS)
      const grounded = await ragService.findRelevantContextHybrid(
        `${selectedTicket.subject} ${selectedTicket.description}`,
        kbArticles,
        allTickets,
      );
      const relevantContext = grounded.results;
      
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

      const draftText = redactPII(response.text);

      // 3-Tier Agentic Graph — persist the evaluator-optimizer trace onto the
      // ticket so the list badges, dispatch UI and diff logger can read it back.
      const confidenceScore =
        response.confidenceScore !== undefined && response.confidenceScore !== null
          ? Math.min(100, Math.max(0, Math.round(response.confidenceScore)))
          : null;
      const executionStatus = response.executionStatus ?? (confidenceScore === null ? 'nuanced' : confidenceScore >= 95 ? 'high_confidence' : 'nuanced');

      setAiSources(response.sources);
      setAiDraftMeta({
        rawDraft: draftText,
        confidenceScore,
        critiqueLog: response.critiqueLog ?? null,
        executionStatus,
      });
      setReplyText(draftText);
      toast.success(
        confidenceScore === null
          ? "AI Draft generated (unverified — critic unavailable)."
          : `AI Draft generated with verified sources (${confidenceScore}% confidence).`,
      );

      // Persist the trace — non-fatal when the write fails.
      try {
        await ticketService.updateTicket(selectedTicket.id, {
          aiSuggestedDraft: draftText,
          aiDraftRaw: draftText,
          aiConfidenceScore: confidenceScore,
          aiCritiqueLog: response.critiqueLog ?? null,
          aiExecutionStatus: executionStatus,
        });
      } catch (writeErr) {
        console.warn("Failed to persist AI draft trace:", writeErr);
      }
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
    setIsKbConvertOpen(true);
    setKbDraft(null);
    const loadingToast = toast.loading(t('tickets.kbConvert.extracting', 'Lösung wird extrahiert…'));
    try {
      const draft = await ai.generateKBArticle({
        subject: selectedTicket.subject,
        description: selectedTicket.description,
        threadHistory: messages.map(m => m.content)
      });

      const resolutionNotes = (selectedTicket.agentComments || [])
        .map(c => c.content)
        .join('\n');

      // Extract ticket subject, customer issue (description), resolution notes and
      // tags into a new KB draft ready for vector indexing.
      const fullContent = [
        '## Problem',
        '',
        stripHtml(safeString(selectedTicket.description) || 'Keine Beschreibung vorhanden.'),
        '',
        draft.content,
        '',
        resolutionNotes
          ? '## Interne Lösungshinweise\n' + resolutionNotes
          : '## Lösung\n' + (selectedTicket.internalNotes || ''),
      ].join('\n').trim();

      setKbDraft({
        title: draft.title || `KB: ${safeString(selectedTicket.subject)}`,
        content: fullContent,
        tags: (selectedTicket.tags || []).slice(0, 6),
      });
      toast.success(t('tickets.kbConvert.generated', 'Wissensartikel erstellt. Bitte prüfen und speichern.'), { id: loadingToast });
    } catch (e) {
      console.error(e);
      setKbDraft(null);
      setIsKbConvertOpen(false);
      toast.error(t('tickets.kbConvert.failed', 'Wissenskonvertierung fehlgeschlagen. KI-Einstellungen prüfen.'), { id: loadingToast });
    } finally {
      setIsKbDrafting(false);
    }
  };

  const confirmKbConvert = async () => {
    if (!kbDraft || !user) return;
    try {
      const articleId = await kbService.createArticle({
        title: kbDraft.title.trim(),
        content: kbDraft.content,
        category: 'Troubleshooting',
        tags: kbDraft.tags.filter(Boolean),
        authorId: user.uid,
        owner: user.displayName || user.email,
        status: 'Draft',
        visibility: 'Private',
        language: 'German',
        linkedTicket: selectedTicket?.id,
      });
      if (selectedTicket) {
        await ticketService.updateTicket(selectedTicket.id, { include_in_rag: true });
      }
      toast.success(t('tickets.kbConvert.saved', 'Wissensartikel gespeichert und für RAG eingereiht.'));
      if (articleId) {
        console.info(`[KB Convert] Article ${articleId} created from ticket ${selectedTicket?.id}`);
      }
      setIsKbConvertOpen(false);
      setKbDraft(null);
    } catch (error) {
      console.error('[KB Convert] save failed', error);
      toast.error(t('tickets.kbConvert.saveFailed', 'Wissensartikel konnte nicht gespeichert werden.'));
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

    // 3-Tier Agentic Graph — Tier 2: Human-Diff Feedback Learning.
    // If the AI drafted the reply and the agent edited it beyond the 10%
    // character threshold, log the (original → final) pair for prompt
    // refinement. Non-fatal — never blocks the send.
    const aiBaseline = aiDraftMeta?.rawDraft || selectedTicket?.aiDraftRaw || null;
    if (aiBaseline && selectedTicket) {
      void logDraftDiffIfSubstantial({
        ticketId: selectedTicket.id,
        agentId: user.uid,
        originalDraft: aiBaseline,
        finalSentMessage: replyText,
      }).then(({ logged, ratio }) => {
        if (logged) {
          console.info(
            `[Human-Diff Learning] Draft edit ratio ${(ratio * 100).toFixed(1)}% logged for ticket ${selectedTicket.id}.`,
          );
        }
      });
    }
    // Clear the dispatch metadata — the draft was consumed by the human action.
    setAiDraftMeta(null);

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
      deliveryStatus: 'pending',
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
      const result = await ticketService.sendMessage(selectedTicketId, {
        ticketId: selectedTicketId,
        senderId: user.uid,
        senderType: 'agent',
        senderName: user.displayName || user.email || 'Agent',
        content: contentToSend,
        originalContent: originalContent
      });
      
      const persisted = result?.message;
      const deliveryStatus =
        result?.deliveryStatus ||
        (result?.delivered === false ? 'saved_locally' : 'delivered');

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                id: persisted?.id || m.id,
                deliveryStatus,
                deliveryReason: result?.deliveryReason ?? null,
              }
            : m,
        ),
      );

      logAudit({
        module: 'tickets',
        action: 'message_sent',
        details: {
          ticketId: selectedTicketId,
          wasTranslated: !!originalContent,
          delivered: result?.delivered !== false,
          deliveryStatus,
        },
      });

      if (result?.delivered === false) {
        toast.success(
          t(
            'tickets.replySavedLocally',
            'Reply saved. Outbound email unavailable — stored in ticket history only.',
          ),
        );
      } else {
        toast.success(
          originalContent
            ? t('tickets.replySentTranslated', 'Reply sent (translated for client).')
            : t('tickets.replySent', 'Reply sent.'),
        );
      }
    } catch (e) {
      // Rollback on write failure
      setReplyText(cachedReplyText);
      setLiveTranslation(cachedLiveTranslation);
      setIsComposerExpanded(true);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast.error(t('tickets.replyFailed', 'Failed to send reply.'));
    }
  };

  const toggleTicketSelection = (id: string) => {
    setSelectedTicketIds((prev) =>
      prev.includes(id) ? prev.filter((tid) => tid !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (headerCheckboxActive) {
      setSelectedTicketIds([]);
    } else {
      setSelectedTicketIds(tickets.map((ticket) => ticket.id));
    }
  };

  const openBulkMergeDialog = () => {
    if (!canBulkMerge) return;
    setMergeDialogAllowSearch(false);
    setMergeDialogTickets(selectedTicketsForMerge);
    setIsMergeDialogOpen(true);
  };

  const openDetailMergeDialog = () => {
    if (!selectedTicket || selectedTicket.status === 'merged') return;
    setMergeDialogAllowSearch(true);
    setMergeDialogTickets([selectedTicket]);
    setIsMergeDialogOpen(true);
  };

  const handleConfirmMerge = async (primaryId: string, sourceIds: string[]) => {
    const involved = [primaryId, ...sourceIds];
    const ticketsById = new Map(
      allTickets.filter((ticket) => involved.includes(ticket.id)).map((ticket) => [ticket.id, ticket]),
    );
    setIsMerging(true);
    const loadingToast = toast.loading(
      t('tickets.merge.merging', 'Tickets werden zusammengeführt…'),
    );
    try {
      await ticketService.mergeTicketsIntoPrimary(primaryId, sourceIds, ticketsById);
      setAllTickets((prev) =>
        prev.map((ticket) => {
          if (sourceIds.includes(ticket.id)) {
            return {
              ...ticket,
              status: 'merged',
              mergedIntoId: primaryId,
              masterTicketId: primaryId,
            };
          }
          if (ticket.id === primaryId) {
            return {
              ...ticket,
              isMasterTicket: true,
              linkedTicketIds: Array.from(new Set([...(ticket.linkedTicketIds || []), ...sourceIds])),
            };
          }
          return ticket;
        }),
      );
      toast.success(t('tickets.merge.success', 'Tickets erfolgreich zusammengeführt.'), {
        id: loadingToast,
      });
      setIsMergeDialogOpen(false);
      setSelectedTicketIds([]);
      if (selectedTicketId && sourceIds.includes(selectedTicketId)) {
        setSelectedTicketId(primaryId);
        navigate(`/tickets/${primaryId}`);
      }
    } catch (e) {
      toast.error(t('tickets.merge.failed', 'Zusammenführen fehlgeschlagen.'), { id: loadingToast });
    } finally {
      setIsMerging(false);
    }
  };

  const handleBulkUpdate = async (updates: Partial<TicketType>) => {
    if (selectedTicketIds.length === 0) return;

    // Normalize assignee payload (agentId/agentName + alias fields).
    const isAssigneeChange =
      updates.agentId !== undefined ||
      updates.agentName !== undefined ||
      updates.assignedTo !== undefined ||
      updates.assigneeId !== undefined;
    const payload: Partial<TicketType> = isAssigneeChange
      ? buildAssigneePayload(
          (updates.agentId ?? updates.assignedTo ?? updates.assigneeId) as string | null | undefined,
          updates.agentName,
          updates.assignedToEmail,
        )
      : updates;

    // Snapshot the original state for rollback.
    const ids = [...selectedTicketIds];
    const originals = new Map<string, TicketType>();
    for (const ticket of allTickets) {
      if (ids.includes(ticket.id)) originals.set(ticket.id, ticket);
    }

    // Optimistic UI update.
    setAllTickets(prev => prev.map(t => (ids.includes(t.id) ? { ...t, ...payload } : t)));

    const loadingToast = toast.loading(
      t('tickets.bulk.updating', 'Aktualisiere {{count}} Tickets...').replace('{{count}}', String(ids.length)),
    );
    try {
      const result = await ticketService.bulkUpdate(ids, payload);
      if (result.failed > 0 && result.updated === 0) {
        throw new Error(`Bulk update failed for ${result.failed} tickets`);
      }
      toast.success(
        isAssigneeChange
          ? t('tickets.bulk.assignedSuccess', 'Tickets erfolgreich zugewiesen')
          : t('tickets.bulk.updatedSuccess', 'Erfolgreich aktualisiert'),
        { id: loadingToast },
      );
      setSelectedTicketIds([]);
    } catch (e) {
      console.error('Bulk update failed:', e);
      toast.error(t('tickets.bulk.failedToast', 'Sammelaktualisierung fehlgeschlagen'), { id: loadingToast });
      // Revert optimistic state on total failure.
      setAllTickets(prev => prev.map(t => (originals.has(t.id) ? (originals.get(t.id) as TicketType) : t)));
    }
  };

  return (
    <div className="flex flex-1 min-h-0 min-w-0 w-full overflow-hidden bg-slate-50">
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
          moduleConfig.polyglotEnabled && activePolyglotLanguages.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    title={`${t('settings.polyglotBridge', 'Polyglot Bridge')}: ${agentLanguage}`}
                    className={cn(
                      'w-full flex items-center gap-2 h-8 px-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors min-w-0',
                      effectiveCollapsed && 'justify-center px-0',
                    )}
                  />
                }
              >
                <FlagIcon
                  code={
                    activePolyglotLanguages.find((f) => f.lang === agentLanguage)?.flagCode
                    || languageToFlagCode(agentLanguage)
                  }
                  className="w-5 h-3.5 shrink-0"
                />
                {!effectiveCollapsed && (
                  <>
                    <span className="truncate flex-1 text-left">{agentLanguage}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {activePolyglotLanguages.map((f) => (
                  <DropdownMenuItem
                    key={f.isoCode || f.lang}
                    className="text-xs font-medium cursor-pointer"
                    onClick={() => setAgentLanguage(f.lang)}
                  >
                    <FlagIcon code={f.flagCode || languageToFlagCode(f.lang)} className="w-5 h-3.5" />
                    <span className="flex-1 truncate">{f.lang}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
        "flex-1 min-w-0 min-h-0 h-full flex flex-col overflow-hidden bg-slate-50 text-foreground",
        isMobileSidebarOpen ? "hidden md:flex" : "flex"
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
          <div className="flex-1 min-w-0 min-h-0 h-full flex flex-col overflow-hidden relative">
            {selectedTicket ? (
            <div className="flex-1 min-w-0 min-h-0 h-full flex flex-row overflow-hidden">
              <TicketDetailView
                selectedTicket={selectedTicket}
                ticketContact={ticketContact}
                ticketCompany={ticketCompany}
                contactSchema={contactSchema}
                messages={messages}
                allTickets={allTickets}
                activeDetailTab={activeDetailTab}
                setActiveDetailTab={setActiveDetailTab}
                isAiReady={isAiReady}
                isAiDrafting={isAiDrafting}
                isTranslating={isTranslating}
                translatedTicket={translatedTicket}
                aiSummary={aiSummary}
                aiSources={aiSources}
                suggestedNeuralLinks={suggestedNeuralLinks}
                isFindingNeuralLinks={isFindingNeuralLinks}
                linkInput={linkInput}
                setLinkInput={setLinkInput}
                isComposerExpanded={isComposerExpanded}
                setIsComposerExpanded={setIsComposerExpanded}
                replyText={replyText}
                setReplyText={setReplyText}
                newAgentComment={newAgentComment}
                setNewAgentComment={setNewAgentComment}
                areNotesExpanded={areNotesExpanded}
                setAreNotesExpanded={setAreNotesExpanded}
                user={user}
                ticketService={ticketService}
                setAllTickets={setAllTickets}
                setSelectedTicketId={setSelectedTicketId}
                updateSummary={updateSummary}
                handleChecklistUpdated={handleChecklistUpdated}
                handleInlineUpdate={handleInlineUpdate}
                findNeuralLinks={findNeuralLinks}
                linkTicket={linkTicket}
                unlinkTicket={unlinkTicket}
                generateAiReply={generateAiReply}
                handleSendReply={handleSendReply}
                acceptGhostDraft={acceptGhostDraft}
                ghostDraft={ghostDraft}
                isGhostDrafting={isGhostDrafting}
                legalViolation={legalViolation}
                setLegalViolation={setLegalViolation}
                isValidatingLegal={isValidatingLegal}
                aiDraftMeta={aiDraftMeta}
                ai={ai}
                translationMood={translationMood}
                closeFullTicketView={closeFullTicketView}
                isMobilePropertiesOpen={isMobilePropertiesOpen}
                setIsMobilePropertiesOpen={setIsMobilePropertiesOpen}
                onConvertToKB={handleConvertToKB}
                isKbDrafting={isKbDrafting}
                onOpenMerge={openDetailMergeDialog}
              />
            <TicketDetailContextPane
              selectedTicket={selectedTicket}
              ticketContact={ticketContact}
              ticketCompany={ticketCompany}
              isMobilePropertiesOpen={isMobilePropertiesOpen}
              setIsMobilePropertiesOpen={setIsMobilePropertiesOpen}
              isAiReady={isAiReady}
              isAiDrafting={isAiDrafting}
              generateAiReply={generateAiReply}
              handleConvertToKB={handleConvertToKB}
              suggestedNeuralLinks={suggestedNeuralLinks}
              linkTicket={linkTicket}
              unlinkTicket={unlinkTicket}
              newTagInput={newTagInput}
              setNewTagInput={setNewTagInput}
              initiateHandoff={initiateHandoff}
              suggestedTags={suggestedTags}
              allTickets={allTickets}
              handleInlineUpdate={handleInlineUpdate}
            />
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
      <TicketListView
        ticketQueueStats={ticketQueueStats}
        topStatusFilter={topStatusFilter}
        setTopStatusFilter={setTopStatusFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isFilterDrawerOpen={isFilterDrawerOpen}
        setIsFilterDrawerOpen={setIsFilterDrawerOpen}
        listSort={listSort}
        setListSort={setListSort}
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        openCreateTicket={openCreateTicket}
        tickets={tickets}
        filters={filters}
        setFilters={setFilters}
        user={user}
        handleViewChange={handleViewChange}
        selectedTicketIds={selectedTicketIds}
        setSelectedTicketIds={setSelectedTicketIds}
        toggleSelectAll={toggleSelectAll}
        toggleTicketSelection={toggleTicketSelection}
        headerCheckboxActive={headerCheckboxActive}
        handleInlineUpdate={handleInlineUpdate}
        handleTicketSelect={handleTicketSelect}
        handleBulkUpdate={handleBulkUpdate}
        onOpenBulkMerge={openBulkMergeDialog}
        viewDensity={viewDensity}
        setHoveredTicketId={setHoveredTicketId}
        mousePosRef={mousePosRef}
        setPeekOffset={setPeekOffset}
        handleMouseMove={handleMouseMove}
        setIsMobileSidebarOpen={setIsMobileSidebarOpen}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
        drawerTicketId={drawerTicketId}
        setDrawerTicketId={setDrawerTicketId}
        allTickets={allTickets}
        kbArticles={kbArticles}
        openFullTicketView={openFullTicketView}
        ticketService={ticketService}
      />
        )}

        <TicketDialogs
          pendingResolveStatus={pendingResolveStatus}
          setPendingResolveStatus={setPendingResolveStatus}
          pendingResolveIncludeRag={pendingResolveIncludeRag}
          setPendingResolveIncludeRag={setPendingResolveIncludeRag}
          confirmResolveStatusChange={confirmResolveStatusChange}
          hoveredTicketId={hoveredTicketId}
          hoveredTicket={hoveredTicket}
          peekOffset={peekOffset}
          peekMessages={peekMessages}
          selectedTicketIds={selectedTicketIds}
          setSelectedTicketIds={setSelectedTicketIds}
          handleBulkUpdate={handleBulkUpdate}
          canBulkMerge={canBulkMerge}
          onOpenBulkMerge={openBulkMergeDialog}
          user={user}
          isSentimentBreakdownOpen={isSentimentBreakdownOpen}
          setIsSentimentBreakdownOpen={setIsSentimentBreakdownOpen}
          sentimentTicketId={sentimentTicketId}
          allTickets={allTickets}
          isHandoffOpen={isHandoffOpen}
          setIsHandoffOpen={setIsHandoffOpen}
          isGeneratingHandoff={isGeneratingHandoff}
          handoffSummary={handoffSummary}
          confirmHandoff={confirmHandoff}
          isKbConvertOpen={isKbConvertOpen}
          setIsKbConvertOpen={setIsKbConvertOpen}
          kbDraft={kbDraft}
          setKbDraft={setKbDraft}
          isKbDrafting={isKbDrafting}
          confirmKbConvert={confirmKbConvert}
        />

        <TicketMergeDialog
          open={isMergeDialogOpen}
          onOpenChange={setIsMergeDialogOpen}
          candidateTickets={mergeDialogTickets}
          allTickets={allTickets}
          allowSearch={mergeDialogAllowSearch}
          onConfirm={handleConfirmMerge}
          isMerging={isMerging}
        />

    </div>
    </div>
  );
}
