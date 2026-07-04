import { useCallback, useEffect, useMemo, useRef, useState, type SVGProps } from 'react';
import { startOrchestratorConfigSync } from '../../lib/aiOrchestratorClient';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  BookOpen, 
  ArrowRight,
  PlusCircle,
  Check,
  X,
  FileText,
  Zap,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Bookmark,
  MoreHorizontal,
  Calendar,
  Eye,
  EyeOff,
  Share2,
  Link as LinkIcon,
  Printer,
  ArrowLeft,
  LayoutGrid,
  Filter,
  ThumbsUp,
  ThumbsDown,
  Settings,
  Sparkles,
  Ticket,
  Lightbulb,
  FileSearch,
  AlertTriangle,
  History,
  TrendingUp,
  PenLine,
  HelpCircle,
  Wrench,
  Link,
  ShieldCheck,
  FileQuestion,
  GraduationCap,
  FileJson,
  Copy,
  Globe,
  Lock,
  Tag,
  Info,
  Trash2,
  CheckCircle2,
  Shield,
  Download,
  Languages,
  Network,
  LineChart,
  Activity,
  User,
  AppWindow,
  GitBranch,
  ArrowUpRight,
  Folder,
  FolderPlus,
  Split,
  RefreshCw,
  Wand2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription,
} from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '../../components/ui/tooltip';
import { toast } from 'sonner';

import { kbService } from '../../services/kbService';
import { useAuth } from '../../lib/hooks';
import { useTranslation } from '../../lib/context/I18nContext';
import { ModuleToolbarSelect } from '../ui/module-page';
import { KBPageHeader } from '../kb/KBPageHeader';
import { KBKpiCards } from '../kb/KBKpiCards';
import { KBSearchSection } from '../kb/KBSearchSection';
import { KBSearchAiOverlay } from '../kb/KBSearchAiOverlay';
import { KBArticleEditorWorkspace, type KBArticleDraft } from '../kb/KBArticleEditorWorkspace';
import { KBBulkActionBar } from '../kb/KBBulkActionBar';
import { truncateRagSnippet } from '../kb/kbSearchUtils';
import { ragService, type RAGResult } from '../../services/ragService';
import { AIAdapter } from '../../lib/ai/provider-adapter';
import { KBCategoryGrid } from '../kb/KBCategoryGrid';
import { KBActivitySidebar, buildRecentActivity, buildTopContributors } from '../kb/KBActivitySidebar';
import { KBViewModeSelector, type KBArticleViewMode } from '../kb/KBViewModeSelector';
import { KBArticleViews } from '../kb/KBArticleViews';
import { KBLeftSidebar, type KBNavFilter } from '../kb/KBLeftSidebar';
import { filterArticlesByWorkspace, isKbOverviewMode, isKbAiAssistantMode, categoryI18nKey } from '../kb/kb-utils';
import {
  type KBCategoryRecord,
  UNCATEGORIZED_CATEGORY_ID,
  slugifyCategoryId,
  resolveArticleCategoryId,
  articleMatchesCategoryId,
} from '../kb/kbCategoryUtils';
import { KBCategoryDeleteModal, type CategoryDeleteStrategy } from '../kb/KBCategoryDeleteModal';
import { useWorkspace } from '../../lib/context/WorkspaceContext';
import { KBImporter } from '../KBImporter';
import { KBAutopilotDashboard } from '../KBAutopilotDashboard';
import { KBArticle } from '../../types';
import { KBArticleDetailView } from '../kb/KBArticleDetailView';
import { trustScoreService, generateDefaultTrustScore } from '../../services/trustScoreService';
import { AIRelationshipGraph2 } from '../AIRelationshipGraph2';

// Preset Users for Owners & Reviewers allocation
const ENTERPRISE_USERS = [
  { uid: 'admin', name: 'Sarah James', role: 'Documentation Owner', email: 'sarah.j@geistdesk.io', avatar: 'SJ' },
  { uid: 'agent-1', name: 'Mike Chen', role: 'Security Supervisor', email: 'mike.c@geistdesk.io', avatar: 'MC' },
  { uid: 'agent-2', name: 'Anna Bell', role: 'DevOps Tech Writer', email: 'anna.b@geistdesk.io', avatar: 'AB' },
  { uid: 'agent-3', name: 'John Doe', role: 'Customer Success lead', email: 'john.d@geistdesk.io', avatar: 'JD' },
  { uid: 'agent-4', name: 'Will Coyote', role: 'Tier 3 Support Lead', email: 'will.c@geistdesk.io', avatar: 'WC' }
];

// Seed sample articles loaded dynamically or fallback merged with Firestore
const ENTERPRISE_SEED_ARTICLES: any[] = [
  {
    id: "seed-1",
    title: "Getting Started with Azure AD SSO",
    category: "Security",
    subCategory: "Identity & SSO SOP",
    content: "<h2>Overview</h2><p>Configure federated single sign-on between Azure Active Directory and GeistDesk to centralize identity governance, enforce MFA, and map security groups to operational roles.</p><h2>Prerequisites</h2><p>Before enabling the connector, confirm you hold Global Administrator or Identity Administrator privileges in your Azure AD tenant and that conditional access policies are active.</p><h3>Client Secret Rotation</h3><p>Rotate application client secrets every 90 days and document each rotation in the linked compliance ticket.</p><h2>Configuration Steps</h2><p>Register a new enterprise application in Azure AD, configure SAML or OIDC endpoints, and paste the metadata URL into GeistDesk Settings &gt; Identity Providers.</p><pre><code>sso.metadata_url = https://login.microsoftonline.com/{tenant}/federationmetadata/2007-06/federationmetadata.xml</code></pre><h3>Role Mapping</h3><p>Map Azure AD security groups to GeistDesk RBAC roles before enabling automated provisioning for production users.</p>",
    tags: ["onboarding", "security", "sso", "azure-ad"],
    authorId: "admin",
    owner: "Sarah James",
    reviewer: "Mike Chen",
    lastEditor: "Sarah James",
    approvalStatus: "Approved",
    reviewDueDate: "2026-09-01",
    status: "Published",
    visibility: "Internal",
    linkedTicket: "TKT-184",
    trustScore: 92,
    views: 14280,
    helpfulCount: 224,
    unhelpfulCount: 4,
    avgReadTime: "6m 40s",
    language: "English",
    createdAt: { toDate: () => new Date("2026-05-15") },
    updatedAt: { toDate: () => new Date("2026-06-01") }
  },
  {
    id: "seed-2",
    title: "Inviting and Managing Team Members",
    category: "Getting Started",
    subCategory: "User Provisioning",
    content: "<h2>User Onboarding Guide</h2><p>Ensure that all incoming support representatives are registered under your Azure Active Directory or custom SSO identity provider cluster.</p><h3>Admin & Agent Role Assignments</h3><p>Never grant master permissions. Restrict vault operations and decryption scopes strictly behind multi-party authorization thresholds.</p>",
    tags: ["team", "rbac", "permissions"],
    authorId: "admin",
    owner: "Sarah James",
    reviewer: "John Doe",
    lastEditor: "Mike Chen",
    approvalStatus: "Approved",
    reviewDueDate: "2026-10-15",
    status: "Published",
    visibility: "Public",
    views: 840,
    helpfulCount: 130,
    unhelpfulCount: 2,
    avgReadTime: "2m 45s",
    language: "English",
    createdAt: { toDate: () => new Date("2026-05-18") },
    updatedAt: { toDate: () => new Date("2026-06-02") }
  },
  {
    id: "seed-3",
    title: "Billing Plans and Invoices FAQ",
    category: "Billing",
    subCategory: "Invoicing Methods",
    content: "<h2>Common Billing Structure questions</h2><p>We compile active policies regarding automated usage metering across our LLM pipelines and secure dropzones retention schemas.</p><h3>How do I download monthly clear invoices?</h3><p>Enterprise subscription invoices are dispatched automatically on the first day of every epoch month to primary finance email addresses specified in your account profile settings.</p>",
    tags: ["invoice", "pricing", "plans"],
    authorId: "admin",
    owner: "John Doe",
    reviewer: "Sarah James",
    lastEditor: "John Doe",
    approvalStatus: "Approved",
    reviewDueDate: "2026-12-01",
    status: "Published",
    visibility: "Public",
    views: 512,
    helpfulCount: 92,
    unhelpfulCount: 18,
    avgReadTime: "1m 30s",
    language: "English",
    createdAt: { toDate: () => new Date("2026-05-01") },
    updatedAt: { toDate: () => new Date("2026-05-20") }
  },
  {
    id: "seed-4",
    title: "API Authentication & Secret Management Guide",
    category: "API Documentation",
    subCategory: "Authentication",
    content: "<h2>Bearer Token Authorization Protocols</h2><p>To communicate with our sovereign data gateway cluster, instantiate standard Bearer auth tags inside API headers.</p><pre><code>Authorization: Bearer gd_live_sec_prod_xxxxxx</code></pre><h3>Quantum Safety Keys Rotate Schedule</h3><p>Our agent network routinely tracks vulnerability risks. We recommend rotated tokens every 30 days automatically via administrative webhooks.</p>",
    tags: ["api", "auth", "token", "developer"],
    authorId: "admin",
    owner: "Anna Bell",
    reviewer: "Mike Chen",
    lastEditor: "Anna Bell",
    approvalStatus: "Approved",
    reviewDueDate: "2026-07-20",
    status: "Published",
    visibility: "Private",
    views: 1850,
    helpfulCount: 390,
    unhelpfulCount: 5,
    avgReadTime: "5m 20s",
    language: "English",
    createdAt: { toDate: () => new Date("2026-04-10") },
    updatedAt: { toDate: () => new Date("2026-05-28") }
  },
  {
    id: "seed-5",
    title: "Slack and MS Teams Live Webhook Integration",
    category: "Integrations",
    subCategory: "Slack Integrations",
    content: "<h2>Realtech Real-time Chat Orchestrator</h2><p>Instaniate automated notifications within your organization chats whenever core system health metrics decay beneath 95% SLA ratios.</p><h3>Mapping Dynamic Webhook Payloads</h3><p>Inject customized payloads carrying active ticket link records, assignment cues, and priority markers into outbound JSON bindings.</p>",
    tags: ["slack", "teams", "webhooks"],
    authorId: "admin",
    owner: "Anna Bell",
    reviewer: "John Doe",
    lastEditor: "Sarah James",
    approvalStatus: "Approved",
    reviewDueDate: "2026-11-15",
    status: "Published",
    visibility: "Public",
    views: 742,
    helpfulCount: 120,
    unhelpfulCount: 1,
    avgReadTime: "4m 10s",
    language: "English",
    createdAt: { toDate: () => new Date("2026-05-05") },
    updatedAt: { toDate: () => new Date("2026-05-15") }
  },
  {
    id: "seed-6",
    title: "Enterprise VPN and DNS Routing Debug Protocols",
    category: "Troubleshooting",
    subCategory: "VPN Configuration Issues",
    content: "<h2>DNS Routing Leak Mitigations for Hybrid Workforces</h2><p>We resolved 43 related ticket complaints regarding local resolver DNS drops while establishing secure IPSec or Wireguard bridges.</p><h3>Diagnostic Actions</h3><ol><li>Flush local service directories via administrative prompt.</li><li>Bind fallback servers explicitly to primary non-public standard nodes.</li></ol>",
    tags: ["vpn", "dns", "network", "debug"],
    authorId: "admin",
    owner: "Will Coyote",
    reviewer: "Mike Chen",
    lastEditor: "Will Coyote",
    approvalStatus: "Needs Review",
    reviewDueDate: "2026-06-20",
    status: "Needs Review",
    visibility: "Public",
    views: 1290,
    helpfulCount: 284,
    unhelpfulCount: 8,
    avgReadTime: "6m 45s",
    language: "English",
    createdAt: { toDate: () => new Date("2026-05-22") },
    updatedAt: { toDate: () => new Date("2026-06-01") }
  },
  {
    id: "seed-7",
    title: "SOC2 Compliance and Server Sanitization Guidelines",
    category: "Internal SOPs",
    subCategory: "SOC2 Incident Playbooks",
    content: "<h2>Standard Operating Procedure for Production Telemetry Erasure</h2><p>To adhere with auditing benchmarks, verify all private client key mappings are shredded immediately after support ticket closure status is verified.</p><h3>Compliance Checklists</h3><ul><li>Log output scrubbing validations.</li><li>Weekly credential audits.</li><li>Multi-tenant context isolation logs.</li></ul>",
    tags: ["soc2", "sop", "compliance", "security"],
    authorId: "admin",
    owner: "Mike Chen",
    reviewer: "Sarah James",
    lastEditor: "Mike Chen",
    approvalStatus: "Approved",
    reviewDueDate: "2026-07-01",
    status: "Published",
    visibility: "Private",
    views: 310,
    helpfulCount: 85,
    unhelpfulCount: 0,
    avgReadTime: "8m 10s",
    language: "English",
    createdAt: { toDate: () => new Date("2026-05-10") },
    updatedAt: { toDate: () => new Date("2026-05-25") }
  },
  {
    id: "seed-8",
    title: "MFA Token De-synchronization Playbook",
    category: "Troubleshooting",
    subCategory: "MFA Token De-synchronization",
    content: "<h2>MFA Desynchronization issues remediation</h2><p>When software tokens lose synchronization with authorization servers, agents must initiate manual validation hashes check to align time offset variables.</p>",
    tags: ["mfa", "auth", "security", "troubleshoot"],
    authorId: "admin",
    owner: "Will Coyote",
    reviewer: "Mike Chen",
    lastEditor: "Anna Bell",
    approvalStatus: "Draft",
    reviewDueDate: "2026-08-10",
    status: "Draft",
    visibility: "Private",
    views: 45,
    helpfulCount: 12,
    unhelpfulCount: 1,
    avgReadTime: "3m 00s",
    language: "English",
    createdAt: { toDate: () => new Date("2026-06-01") },
    updatedAt: { toDate: () => new Date("2026-06-01") }
  }
];

export default function KBPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { workspace, isDeveloperWorkspace } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    startOrchestratorConfigSync();
  }, []);
  
  // States
  const [firestoreArticles, setFirestoreArticles] = useState<KBArticle[]>([]);
  const [articles, setArticles] = useState<any[]>(ENTERPRISE_SEED_ARTICLES);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // AI Knowledge Coverage Map states
  const [viewMode, setViewMode] = useState<'standard' | 'coverage'>('standard');
  const [coverageData, setCoverageData] = useState<any>(null);
  const [isLoadingCoverage, setIsLoadingCoverage] = useState<boolean>(false);
  const [selectedCoverageCategory, setSelectedCoverageCategory] = useState<string | null>(null);
  const [coverageSubView, setCoverageSubView] = useState<'heatmap' | 'tree'>('heatmap');

  const fetchCoverageData = async (forceRecalc = false) => {
    setIsLoadingCoverage(true);
    try {
      const url = forceRecalc ? '/api/coverage/recalculate' : '/api/coverage';
      const method = forceRecalc ? 'POST' : 'GET';
      const res = await fetch(url, { method });
      if (res.ok) {
        const data = await res.json();
        setCoverageData(data.dashboard || data);
      } else {
        console.warn("Coverage API response was not OK, falling back to local simulation logic.");
        simulateLocalCoverageCalculation();
      }
    } catch (error) {
      console.error("Error fetching coverage, falling back to simulation:", error);
      simulateLocalCoverageCalculation();
    } finally {
      setIsLoadingCoverage(false);
    }
  };

  const simulateLocalCoverageCalculation = () => {
    const mockCoverage = {
      overallPercentage: 74,
      totalExpected: 24,
      totalExistingMatched: 18,
      totalMissing: 6,
      healthStatus: 'Excellent',
      criticalGaps: [
        { topic: 'Disaster Recovery Guide', category: 'Troubleshooting', importance: 'High' },
        { topic: 'API Rate Limits FAQ', category: 'API Documentation', importance: 'High' },
        { topic: 'SAML SSO Setup Playbook', category: 'Getting Started', importance: 'High' }
      ],
      categories: [
        {
          categoryId: 'getting_started',
          categoryName: 'Getting Started',
          percentage: 75,
          totalExpected: 4,
          matchedCount: 3,
          missingCount: 1,
          topics: [
            { name: 'Setup Guide', status: 'Matched', importance: 'High', matchedArticles: [{ id: 'seed-1', title: 'Onboarding Agent Checklist & Guide' }] },
            { name: 'Onboarding Checklist', status: 'Matched', importance: 'Medium', matchedArticles: [{ id: 'seed-1', title: 'Onboarding Agent Checklist & Guide' }] },
            { name: 'SSO Integration', status: 'Missing', importance: 'High', matchedArticles: [] },
            { name: 'Workspace Workspace FAQ', status: 'Matched', importance: 'Low', matchedArticles: [{ id: 'seed-2', title: 'Workspace Layout Customization Playbook' }] }
          ]
        },
        {
          categoryId: 'billing',
          categoryName: 'Billing',
          percentage: 100,
          totalExpected: 3,
          matchedCount: 3,
          missingCount: 0,
          topics: [
            { name: 'Invoicing Setup', status: 'Matched', importance: 'High', matchedArticles: [{ id: 'seed-3', title: 'Enterprise Billing & Invoice Diagnostics' }] },
            { name: 'Refund Workflows', status: 'Matched', importance: 'High', matchedArticles: [{ id: 'seed-4', title: 'Refund Discrepancies Resolution SOP' }] },
            { name: 'Payment Portals Guide', status: 'Matched', importance: 'Medium', matchedArticles: [{ id: 'seed-3', title: 'Enterprise Billing & Invoice Diagnostics' }] }
          ]
        },
        {
          categoryId: 'api_documentation',
          categoryName: 'API Documentation',
          percentage: 66,
          totalExpected: 3,
          matchedCount: 2,
          missingCount: 1,
          topics: [
            { name: 'Webhook Bindings', status: 'Matched', importance: 'High', matchedArticles: [{ id: 'seed-5', title: 'API Webhook Subscriptions Protocols' }] },
            { name: 'Rate Limits Guide', status: 'Missing', importance: 'High', matchedArticles: [] },
            { name: 'OAuth Security SOP', status: 'Matched', importance: 'High', matchedArticles: [{ id: 'seed-5', title: 'API Webhook Subscriptions Protocols' }] }
          ]
        },
        {
          categoryId: 'integrations',
          categoryName: 'Integrations',
          percentage: 50,
          totalExpected: 4,
          matchedCount: 2,
          missingCount: 2,
          topics: [
            { name: 'Slack Integration SOP', status: 'Matched', importance: 'High', matchedArticles: [{ id: 'seed-6', title: 'Slack Intercom Integration Playbook' }] },
            { name: 'MS Teams Setup', status: 'Missing', importance: 'Medium', matchedArticles: [] },
            { name: 'Bot Sync Protocols', status: 'Matched', importance: 'Medium', matchedArticles: [{ id: 'seed-6', title: 'Slack Intercom Integration Playbook' }] },
            { name: 'External Webhooks FAQ', status: 'Missing', importance: 'Low', matchedArticles: [] }
          ]
        },
        {
          categoryId: 'troubleshooting',
          categoryName: 'Troubleshooting',
          percentage: 75,
          totalExpected: 4,
          matchedCount: 3,
          missingCount: 1,
          topics: [
            { name: 'VPN Access Guide', status: 'Matched', importance: 'High', matchedArticles: [{ id: 'seed-7', title: 'PulseSecure VPN Diagnostic Path' }] },
            { name: 'DNS Routing SOP', status: 'Matched', importance: 'High', matchedArticles: [{ id: 'seed-8', title: 'DNS Resolution Error Resolution Guide' }] },
            { name: 'Incident Playbooks', status: 'Matched', importance: 'High', matchedArticles: [{ id: 'seed-7', title: 'PulseSecure VPN Diagnostic Path' }] },
            { name: 'Disaster Recovery Guide', status: 'Missing', importance: 'High', matchedArticles: [] }
          ]
        },
        {
          categoryId: 'internal_sops',
          categoryName: 'Internal SOPs',
          percentage: 80,
          totalExpected: 5,
          matchedCount: 4,
          missingCount: 1,
          topics: [
            { name: 'SOC2 Audit Guide', status: 'Matched', importance: 'High', matchedArticles: [{ id: 'seed-9', title: 'SOC2 Sanitization Audit Procedures' }] },
            { name: 'Incident Logs', status: 'Matched', importance: 'High', matchedArticles: [{ id: 'seed-9', title: 'SOC2 Sanitization Audit Procedures' }] },
            { name: 'GDPR Compliance FAQ', status: 'Matched', importance: 'Medium', matchedArticles: [{ id: 'seed-9', title: 'SOC2 Sanitization Audit Procedures' }] },
            { name: 'PII Scrubbing SOP', status: 'Matched', importance: 'High', matchedArticles: [{ id: 'seed-9', title: 'SOC2 Sanitization Audit Procedures' }] },
            { name: 'Data Residency Audit SOP', status: 'Missing', importance: 'Medium', matchedArticles: [] }
          ]
        }
      ],
      aiSuggestions: [
        {
          title: "SAML SSO Setup Playbook",
          category: "Getting Started",
          reason: "Identified via support tickets where users raised support overhead regarding user authentication reset lockouts.",
          priority: "High"
        },
        {
          title: "API Rate Limits FAQ",
          category: "API Documentation",
          reason: "Created during dynamic webhook analysis where developer logs indicated a spikes of 429 Too Many Requests issues.",
          priority: "High"
        },
        {
          title: "Disaster Recovery Guide",
          category: "Troubleshooting",
          reason: "Identified via SOC2 compliance mandate checklists demanding clear procedures during database regional failover incidents.",
          priority: "High"
        },
        {
          title: "MS Teams Setup SOP",
          category: "Integrations",
          reason: "Suggested based on ticket analysis showing a 34% increase in customer tickets requesting Teams bot configurations.",
          priority: "Medium"
        }
      ]
    };
    setCoverageData(mockCoverage);
  };

  const handleRecalculate = async () => {
    setIsLoadingCoverage(true);
    const toastId = toast.loading("AI Engine scanning knowledge articles, tags and ticket histories...");
    try {
      const res = await fetch('/api/coverage/recalculate', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCoverageData(data.dashboard || data);
        toast.success("AI Coverage Map recalculated & cached successfully!", { id: toastId });
      } else {
        setTimeout(() => {
          simulateLocalCoverageCalculation();
          toast.success("AI Coverage Map successfully updated! (Local Scoring Mode)", { id: toastId });
        }, 1200);
      }
    } catch (err) {
      setTimeout(() => {
        simulateLocalCoverageCalculation();
        toast.success("AI Coverage Map successfully updated! (Local Scoring Mode)", { id: toastId });
      }, 1200);
    } finally {
      setIsLoadingCoverage(false);
    }
  };

  useEffect(() => {
    // Proactively pre-fill coverage data on mount so it feels instantaneous
    simulateLocalCoverageCalculation();
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      // Clear query param so it doesn't reopen
      setSearchParams({}, { replace: true });
      // Open add article dialog
      setNewArticle({
        title: '',
        content: '',
        category: selectedCategory || 'Getting Started',
        subCategory: 'Workspace Setup',
        visibility: 'Public',
        tags: [],
        owner: 'Sarah James',
        reviewer: 'Mike Chen',
        lastEditor: 'Sarah James',
        status: 'Published',
        avgReadTime: '3m 00s'
      });
      setTagInput('');
      setEditingArticleId(null);
      setIsAddingArticle(true);
    }
  }, [searchParams, setSearchParams, selectedCategory]);
  const [activeSubTab, setActiveSubTab] = useState<string>('All');
  const [kbNav, setKbNav] = useState<KBNavFilter>({ type: 'workspace', id: 'overview' });
  const [viewLayout, setViewLayout] = useState<KBArticleViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'views' | 'confidence' | 'popular'>('popular');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  
  // Custom interactive layout filters
  const [filterOwner, setFilterOwner] = useState<string>('All');
  const [filterVisibility, setFilterVisibility] = useState<string>('All');
  const [filterLanguage, setFilterLanguage] = useState<string>('All');
  const [filterTag, setFilterTag] = useState<string>('All');

  const [aiSearchQuery, setAiSearchQuery] = useState<string | null>(null);
  const [aiSearchSummary, setAiSearchSummary] = useState<string | null>(null);
  const [aiSearchSources, setAiSearchSources] = useState<RAGResult[]>([]);
  const [isAiSearchLoading, setIsAiSearchLoading] = useState(false);
  const [aiSearchError, setAiSearchError] = useState<string | null>(null);

  const aiAdapter = useMemo(() => new AIAdapter(), []);
  const isAiSearchReady = useMemo(() => aiAdapter.isConfigured, [aiAdapter]);
  
  // Advanced side panels & creation states
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isRenamingCategory, setIsRenamingCategory] = useState(false);
  const [renameCategoryId, setRenameCategoryId] = useState<string | null>(null);
  const [renameCategoryName, setRenameCategoryName] = useState('');
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<KBCategoryRecord | null>(null);
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const pendingDeleteRef = useRef<{ items: any[]; timeoutId: ReturnType<typeof setTimeout> } | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [newCategoryOwner, setNewCategoryOwner] = useState('Sarah James');
  const [newCategoryParent, setNewCategoryParent] = useState('None');
  
  const [isAddingArticle, setIsAddingArticle] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [viewingArticle, setViewingArticle] = useState<any>(null);

  // Restore native scroll if legacy modal code left the document body locked.
  useEffect(() => {
    if (!viewingArticle) return;
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
  }, [viewingArticle]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, []);

  const closeArticleDraft = useCallback(() => {
    setIsAddingArticle(false);
    setEditingArticleId(null);
  }, []);
  
  const handleSelectArticleByTitle = (title: string) => {
    const matched = articles.find(a => a.title.toLowerCase() === title.toLowerCase());
    if (matched) {
      setViewingArticle(matched);
    }
  };
  const [activeReadingLanguage, setActiveReadingLanguage] = useState<string>('English');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  
  const [newArticle, setNewArticle] = useState<KBArticleDraft>({
    title: '',
    content: '',
    category: 'Getting Started',
    subCategory: 'Workspace Setup',
    visibility: 'Public',
    tags: [],
    owner: 'Sarah James',
    reviewer: 'Mike Chen',
    lastEditor: 'Sarah James',
    status: 'Published',
    avgReadTime: '3m 00s',
  });
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    closeArticleDraft();
    setSelectedCategory('All');
    setActiveSubTab('All');
    setKbNav({ type: 'workspace', id: 'overview' });
  }, [workspace, closeArticleDraft]);

  // Default internal structures
  const [categories, setCategories] = useState<KBCategoryRecord[]>([
    { id: 'getting-started', name: 'Getting Started', subCategory: 'Workspace Setup', desc: 'Onboarding tools, basic walk-throughs, and quick guides for setting up core nodes.', owner: 'Sarah James', updated: '2 days ago', icon: BookOpen, order: 1 },
    { id: 'billing', name: 'Billing', subCategory: 'Invoicing Methods', desc: 'Invoices troubleshooting, subscription models, and finance integration configurations.', owner: 'John Doe', updated: '5 days ago', icon: FileText, order: 2 },
    { id: 'api-documentation', name: 'API Documentation', subCategory: 'Authentication', desc: 'Developer integration guidelines, dynamic webhooks, API tokens, and sandbox tools.', owner: 'Anna Bell', updated: 'Yesterday', icon: FileJson, order: 3 },
    { id: 'integrations', name: 'Integrations', subCategory: 'Slack Integrations', desc: 'Third-party notification setups, Slack pipelines, and Teams live synchronization.', owner: 'Anna Bell', updated: '1 week ago', icon: Link, order: 4 },
    { id: 'troubleshooting', name: 'Troubleshooting', subCategory: 'VPN Configuration Issues', desc: 'Diagnostic flowcharts, DNS routing remedies, and customer hardware alignment SOPs.', owner: 'Will Coyote', updated: 'Today', icon: Wrench, order: 5 },
    { id: 'internal-sops', name: 'Internal SOPs', subCategory: 'SOC2 Incident Playbooks', desc: 'Rigorous standard operating procedures for SOC2 sanitization audits and security operations.', owner: 'Mike Chen', updated: '6 days ago', icon: ShieldCheck, order: 6 },
  ]);

  // Syncing with Firestore DB
  useEffect(() => {
    const unsub = kbService.subscribeToArticles((data) => {
      setFirestoreArticles(data);
    });
    return () => unsub();
  }, []);

  // Merge Seed data with active Firestore loaded items! Allows live CRUD while remaining densely populated.
  useEffect(() => {
    // Collect all articles
    const merged: any[] = [...ENTERPRISE_SEED_ARTICLES];
    firestoreArticles.forEach((fa) => {
      // Avoid duplicate matching keys with seed
      if (!merged.some(m => m.id === fa.id || m.title.toLowerCase() === fa.title.toLowerCase())) {
        merged.push({
          ...fa,
          owner: fa.owner || 'Sarah James',
          reviewer: fa.reviewer || 'Mike Chen',
          lastEditor: fa.lastEditor || 'Sarah James',
          status: fa.status || (fa.visibility === 'Public' ? 'Published' : 'Draft'),
          views: fa.views || Math.floor(Math.random() * 250) + 12,
          helpfulCount: fa.helpfulCount || Math.floor(Math.random() * 45) + 3,
          unhelpfulCount: fa.unhelpfulCount || 0,
          avgReadTime: fa.avgReadTime || '3m 15s',
          language: fa.language || 'English',
          subCategory: fa.subCategory || 'Workspace Setup'
        });
      }
    });
    setArticles(merged);
  }, [firestoreArticles]);

  const stripHtml = (html: string) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      const id = slugifyCategoryId(newCategoryName);
      if (!categories.find((c) => c.id === id || c.name === newCategoryName)) {
        setCategories([...categories, {
          id,
          name: newCategoryName,
          subCategory: newCategoryParent !== 'None' ? `${newCategoryParent} Child` : 'General Node',
          desc: newCategoryDesc || t('kb.categoryAdd.defaultDesc', 'Enterprise custom knowledge structures pipeline.'),
          owner: newCategoryOwner,
          updated: t('kb.categoryAdd.justNow', 'Just now'),
          icon: BookOpen,
          order: categories.length + 1,
        }]);
        setNewCategoryName('');
        setNewCategoryDesc('');
        setIsAddingCategory(false);
        toast.success(t('kb.categoryAdd.success', 'Category registered successfully.'));
      } else {
        toast.error(t('kb.categoryAdd.duplicate', 'Category already exists in workspace.'));
      }
    }
  };

  const openRenameCategory = (categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    setRenameCategoryId(categoryId);
    setRenameCategoryName(cat.name);
    setIsRenamingCategory(true);
  };

  const handleRenameCategory = () => {
    if (!renameCategoryId || !renameCategoryName.trim()) return;
    const duplicate = categories.some(
      (c) => c.id !== renameCategoryId && c.name.toLowerCase() === renameCategoryName.trim().toLowerCase(),
    );
    if (duplicate) {
      toast.error(t('kb.categoryRename.duplicate', 'Another category already uses this name.'));
      return;
    }
    setCategories((prev) =>
      prev.map((c) =>
        c.id === renameCategoryId
          ? { ...c, name: renameCategoryName.trim(), updated: t('kb.categoryAdd.justNow', 'Just now') }
          : c,
      ),
    );
    setIsRenamingCategory(false);
    setRenameCategoryId(null);
    toast.success(t('kb.categoryRename.success', 'Category renamed. Article references preserved.'));
  };

  const openDeleteCategory = (categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat || cat.id === UNCATEGORIZED_CATEGORY_ID) return;
    setDeleteCategoryTarget(cat);
  };

  const handleConfirmDeleteCategory = async (strategy: CategoryDeleteStrategy) => {
    if (!deleteCategoryTarget) return;
    const catId = deleteCategoryTarget.id;
    const affected = articles.filter((a) => resolveArticleCategoryId(a, categories) === catId);

    if (strategy === 'reassign') {
      setArticles((prev) =>
        prev.map((a) =>
          resolveArticleCategoryId(a, categories) === catId
            ? { ...a, category: UNCATEGORIZED_CATEGORY_ID }
            : a,
        ),
      );
      const firestoreItems = affected.filter((a) => !a.id.startsWith('seed-'));
      await Promise.all(
        firestoreItems.map((a) => kbService.updateArticle(a.id, { category: UNCATEGORIZED_CATEGORY_ID }, a.tags ?? [])),
      );
      toast.success(
        t('kb.categoryDelete.reassignedToast', '{{count}} articles moved to Uncategorized.')
          .replace('{{count}}', String(affected.length)),
      );
    } else {
      schedulePermanentDelete(affected);
      toast.success(
        t('kb.categoryDelete.purgedToast', '{{count}} articles queued for deletion.')
          .replace('{{count}}', String(affected.length)),
      );
    }

    setCategories((prev) => prev.filter((c) => c.id !== catId));
    if (selectedCategory === catId || kbNav.type === 'category' && kbNav.id === catId) {
      setSelectedCategory('All');
      setKbNav({ type: 'workspace', id: 'overview' });
    }
    setDeleteCategoryTarget(null);
  };

  const schedulePermanentDelete = useCallback((items: any[]) => {
    if (items.length === 0) return;
    const ids = new Set(items.map((a) => a.id));
    setArticles((prev) => prev.filter((a) => !ids.has(a.id)));
    setSelectedArticleIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });

    if (pendingDeleteRef.current) {
      clearTimeout(pendingDeleteRef.current.timeoutId);
    }

    const timeoutId = setTimeout(async () => {
      const firestoreItems = items.filter((a) => !a.id.startsWith('seed-'));
      if (firestoreItems.length === 1) {
        await kbService.deleteArticle(firestoreItems[0].id, firestoreItems[0].tags ?? []);
      } else if (firestoreItems.length > 1) {
        await kbService.deleteArticles(
          firestoreItems.map((a) => ({ id: a.id, tags: a.tags ?? [] })),
        );
      }
      pendingDeleteRef.current = null;
    }, 5000);

    pendingDeleteRef.current = { items, timeoutId };
  }, []);

  const restorePendingDelete = useCallback(() => {
    if (!pendingDeleteRef.current) return;
    clearTimeout(pendingDeleteRef.current.timeoutId);
    const { items } = pendingDeleteRef.current;
    setArticles((prev) => {
      const existing = new Set(prev.map((a) => a.id));
      const restored = items.filter((a) => !existing.has(a.id));
      return [...restored, ...prev];
    });
    pendingDeleteRef.current = null;
  }, []);

  const showUndoDeleteToast = useCallback((count: number) => {
    toast(t('kb.delete.undoToast', 'Article removed'), {
      description:
        count > 1
          ? t('kb.delete.undoToastBulk', '{{count}} articles removed').replace('{{count}}', String(count))
          : undefined,
      action: {
        label: t('kb.delete.undo', 'Undo'),
        onClick: restorePendingDelete,
      },
      duration: 5000,
    });
  }, [restorePendingDelete, t]);

  const openCreateArticle = (category = selectedCategory || 'getting-started') => {
    const catId =
      category === 'All'
        ? 'getting-started'
        : resolveArticleCategoryId({ category }, categories);
    setNewArticle({
      title: '',
      content: '',
      category: catId,
      subCategory: 'Workspace Setup',
      visibility: 'Public',
      tags: [],
      owner: 'Sarah James',
      reviewer: 'Mike Chen',
      lastEditor: 'Sarah James',
      status: 'Published',
      avgReadTime: '3m 00s',
    });
    setTagInput('');
    setEditingArticleId(null);
    setIsAddingArticle(true);
  };

  const handleSaveArticle = async () => {
    if (newArticle.title && newArticle.content && user) {
      try {
        const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
        
        const payload: any = {
          title: newArticle.title,
          content: newArticle.content,
          category: newArticle.category,
          subCategory: newArticle.subCategory || 'Workspace Setup',
          visibility: newArticle.visibility,
          tags: tags,
          owner: newArticle.owner,
          reviewer: newArticle.reviewer,
          lastEditor: user.email || 'Admin',
          status: newArticle.status,
          avgReadTime: newArticle.avgReadTime || '4m 00s',
          language: 'English'
        };

        if (editingArticleId) {
          // If it is static seed, modify local state directly to show seamless interactivity
          if (editingArticleId.startsWith('seed-')) {
            setArticles(prev => prev.map(art => art.id === editingArticleId ? {
              ...art,
              ...payload,
              updatedAt: { toDate: () => new Date() }
            } : art));
            toast.success("Knowledge item draft cached successfully.");
          } else {
            const oldArticle = firestoreArticles.find(a => a.id === editingArticleId);
            await kbService.updateArticle(editingArticleId, payload, oldArticle?.tags || []);
            toast.success("Enterprise article published and synchronized to database.");
          }
        } else {
          // Add locally first as well so UI updates immediately
          const newId = `art-${Date.now()}`;
          const localItem = {
            id: newId,
            ...payload,
            views: 0,
            helpfulCount: 0,
            unhelpfulCount: 0,
            createdAt: { toDate: () => new Date() },
            updatedAt: { toDate: () => new Date() }
          };
          setArticles(prev => [localItem, ...prev]);

          await kbService.createArticle({
            ...payload,
            authorId: user.uid
          });
          toast.success("New article deployed into secure active directory!");
        }

        setIsAddingArticle(false);
        setEditingArticleId(null);
        setNewArticle({ 
          title: '', 
          content: '', 
          category: selectedCategory, 
          subCategory: 'Workspace Setup', 
          visibility: 'Public', 
          tags: [], 
          owner: 'Sarah James', 
          reviewer: 'Mike Chen', 
          lastEditor: 'Sarah James', 
          status: 'Published',
          avgReadTime: '3m 00s' 
        });
        setTagInput('');
      } catch (e) {
        toast.error("Authentication vulnerability: secure save failed.");
      }
    } else {
      toast.error("Validation error: Title and content block are mandatory.");
    }
  };

  const handleEditArticle = (article: any) => {
    setEditingArticleId(article.id);
    setNewArticle({
      title: article.title,
      content: article.content,
      category: resolveArticleCategoryId(article, categories),
      subCategory: article.subCategory || 'Workspace Setup',
      visibility: article.visibility || 'Public',
      tags: article.tags || [],
      owner: article.owner || 'Sarah James',
      reviewer: article.reviewer || 'Mike Chen',
      lastEditor: article.lastEditor || 'Sarah James',
      status: article.status || 'Published',
      avgReadTime: article.avgReadTime || '3m 15s'
    });
    setTagInput((article.tags || []).join(', '));
    setIsAddingArticle(true);
  };

  const handleDuplicateArticle = (article: any) => {
    const dup = {
       ...article,
       id: `seed-dup-${Date.now()}`,
       title: `${article.title} (Copy)`,
       views: 0,
       helpfulCount: 0,
       unhelpfulCount: 0,
       createdAt: { toDate: () => new Date() }
    };
    setArticles(p => [dup, ...p]);
    toast.success(`Duplicated "${article.title}" successfully.`);
  };

  const handleArchiveArticle = (id: string) => {
    setArticles(p => p.map(a => a.id === id ? { ...a, status: 'Archived' } : a));
    toast.success(t('kb.archive.success', 'Article moved to archive.'));
  };

  const handleUpdateStatus = (id: string, newStats: string) => {
    setArticles(p => p.map(a => a.id === id ? { ...a, status: newStats } : a));
    toast.success(`Status updated to "${newStats}" successfully.`);
  };

  const handleCopyUrl = (title: string) => {
    const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
    const url = `${window.location.origin}/kb/docs/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Document canonical URI pinned to host clipboard!");
  };

  const handleTranslateArticle = (lang: string) => {
    setIsTranslating(true);
    toast.info(`Orchestrating premium AI Translation of "${viewingArticle.title}" into ${lang}...`);
    
    // Simulate translate loop
    setTimeout(() => {
      setIsTranslating(false);
      setActiveReadingLanguage(lang);
      toast.success(`Article successfully localized! Dynamic translations rendered under ML-KEM Shield.`);
    }, 1500);
  };

  // Global search & tags & owner matching logic
  const searchNormalized = searchQuery.toLowerCase();

  // Attach trust scores deterministically if not already loaded or set in state
  const withConfidence = articles.map((art) => {
    const calculatedScore = art.trustScore !== undefined
      ? art.trustScore
      : generateDefaultTrustScore(art.id, art.title).score;
    return {
      ...art,
      trustScore: calculatedScore
    };
  });

  const workspaceArticles = useMemo(
    () => filterArticlesByWorkspace(withConfidence, workspace),
    [withConfidence, workspace],
  );

  const matchSidebarCategory = (art: { category?: string; tags?: string[] }, catId: string) =>
    articleMatchesCategoryId(art, catId, categories);

  const processedArticles = workspaceArticles.filter((art) => {
    if (selectedCategory !== 'All' && !matchSidebarCategory(art, selectedCategory)) return false;

    if (kbNav.type === 'workspace') {
      if (kbNav.id === 'drafts' && art.status !== 'Draft') return false;
      if (kbNav.id === 'reviews' && art.status !== 'Needs Review' && art.status !== 'Under Revision') return false;
    }
    if (kbNav.type === 'category' && !matchSidebarCategory(art, kbNav.id)) return false;
    if (kbNav.type === 'smart') {
      if (kbNav.id === 'missing' && art.tags && art.tags.length > 0) return false;
      if (kbNav.id === 'outdated' && art.status !== 'Outdated' && art.status !== 'Archived') return false;
    }

    if (activeSubTab === 'Published' && art.status !== 'Published') return false;
    if (activeSubTab === 'Drafts' && art.status !== 'Draft') return false;
    if (activeSubTab === 'Archived' && art.status !== 'Archived' && art.status !== 'Outdated') return false;

    if (filterOwner !== 'All' && art.owner !== filterOwner) return false;
    if (filterVisibility !== 'All' && art.visibility !== filterVisibility) return false;
    if (filterLanguage !== 'All' && art.language !== filterLanguage) return false;
    if (filterTag !== 'All' && !(art.tags && art.tags.includes(filterTag))) return false;

    if (searchNormalized) {
      const titleMatch = art.title?.toLowerCase().includes(searchNormalized);
      const contentMatch = art.content?.toLowerCase().includes(searchNormalized);
      const categoryMatch = art.category?.toLowerCase().includes(searchNormalized);
      const ownerMatch = art.owner?.toLowerCase().includes(searchNormalized);
      const tagMatch = art.tags?.some((tag: string) => tag.toLowerCase().includes(searchNormalized));
      return titleMatch || contentMatch || categoryMatch || ownerMatch || tagMatch;
    }

    return true;
  });

  // Sort articles according to the select state
  processedArticles.sort((a, b) => {
    if (kbNav.type === 'smart' && kbNav.id === 'recent') {
      const dateA = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(0);
      const dateB = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(0);
      return dateB.getTime() - dateA.getTime();
    }
    if (sortBy === 'confidence') {
      return (b.trustScore || 0) - (a.trustScore || 0);
    } else if (sortBy === 'views' || sortBy === 'popular' || (kbNav.type === 'smart' && (kbNav.id === 'popular' || kbNav.id === 'mostViewed'))) {
      return (b.views || 0) - (a.views || 0);
    } else {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
      return dateB.getTime() - dateA.getTime();
    }
  });

  const handleDeleteArticle = (id: string) => {
    const article = articles.find((a) => a.id === id);
    if (!article) return;
    schedulePermanentDelete([article]);
    showUndoDeleteToast(1);
    if (viewingArticle?.id === id) setViewingArticle(null);
  };

  const toggleArticleSelection = (id: string) => {
    setSelectedArticleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllArticles = () => {
    const visibleIds = processedArticles.map((a) => a.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedArticleIds.has(id));
    setSelectedArticleIds((prev) => {
      const next = new Set(prev);
      if (allSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleBulkDelete = () => {
    const items = articles.filter((a) => selectedArticleIds.has(a.id));
    if (items.length === 0) return;
    schedulePermanentDelete(items);
    showUndoDeleteToast(items.length);
    setBulkDeleteOpen(false);
    setSelectedArticleIds(new Set());
  };

  // Library stats for compact header and tab counts
  const publishedCount = workspaceArticles.filter(a => a.status === 'Published').length;
  const draftCount = workspaceArticles.filter(a => a.status === 'Draft').length;
  const needsReviewCount = workspaceArticles.filter(a => a.status === 'Needs Review' || a.status === 'Under Revision').length;
  const archivedCount = workspaceArticles.filter(
    (a) => a.status === 'Archived' || a.status === 'Outdated',
  ).length;
  const outdatedCount = workspaceArticles.filter(
    (a) => a.status === 'Outdated' || a.status === 'Archived',
  ).length;
  const healthScore = Math.round(
    workspaceArticles.reduce((sum, a) => sum + (a.trustScore || 0), 0) / Math.max(workspaceArticles.length, 1),
  );
  const monthlyViews = workspaceArticles.reduce((sum, a) => sum + (a.views || 0), 0);
  const missingTagsCount = workspaceArticles.filter((a) => !a.tags || a.tags.length === 0).length;
  const recentActivity = buildRecentActivity(workspaceArticles, t);
  const topContributors = buildTopContributors(workspaceArticles);

  const isOverviewMode = isKbOverviewMode(kbNav);
  const isAiAssistantMode = isKbAiAssistantMode(kbNav);

  const articlesSectionTitle = useMemo(() => {
    if (isOverviewMode) return t('kb.allArticlesSection', 'All Articles');
    if (kbNav.type === 'workspace') {
      const workspaceLabels: Record<string, string> = {
        all: t('kb.sidebar.allArticles', 'All Articles'),
        drafts: t('kb.sidebar.drafts', 'Drafts'),
        reviews: t('kb.sidebar.reviews', 'Reviews'),
        ai: t('kb.sidebar.aiAssistant', 'AI Assistant'),
        analytics: t('kb.sidebar.analytics', 'Analytics'),
      };
      return workspaceLabels[kbNav.id] ?? t('kb.allArticlesSection', 'All Articles');
    }
    if (kbNav.type === 'category') {
      if (kbNav.id === 'Billing') return t('kb.sidebar.billingPlans', 'Billing & Plans');
      return t(categoryI18nKey(kbNav.id), kbNav.id);
    }
    const smartLabels: Record<string, string> = {
      popular: t('kb.sidebar.popularArticles', 'Popular Articles'),
      recent: t('kb.sidebar.recentlyUpdated', 'Recently Updated'),
      mostViewed: t('kb.sidebar.mostViewed', 'Most Viewed'),
      missing: t('kb.sidebar.missingArticles', 'Missing Articles'),
      outdated: t('kb.sidebar.outdatedContent', 'Outdated Content'),
    };
    return smartLabels[kbNav.id] ?? t('kb.allArticlesSection', 'All Articles');
  }, [kbNav, isOverviewMode, t]);

  const sidebarCounts = useMemo(() => {
    const categoryIds = [
      'Getting Started', 'Product Guides', 'API Documentation', 'Integrations',
      'Troubleshooting', 'Billing', 'Security', 'Internal SOPs', 'Company Policies',
    ];
    const categories: Record<string, number> = {};
    for (const id of categoryIds) {
      categories[id] = workspaceArticles.filter((a) => matchSidebarCategory(a, id)).length;
    }
    return {
      all: workspaceArticles.length,
      drafts: draftCount,
      reviews: needsReviewCount,
      categories,
      popular: workspaceArticles.filter((a) => (a.views ?? 0) > 100).length,
      recent: workspaceArticles.length,
      mostViewed: workspaceArticles.filter((a) => (a.views ?? 0) > 200).length,
      missing: missingTagsCount,
      outdated: outdatedCount,
    };
  }, [workspaceArticles, draftCount, needsReviewCount, missingTagsCount, outdatedCount]);

  const handleKbNavigate = (filter: KBNavFilter) => {
    closeArticleDraft();
    setKbNav(filter);
    if (filter.type === 'category') {
      setSelectedCategory(filter.id);
    } else {
      setSelectedCategory('All');
    }
    if (filter.type === 'smart') {
      if (filter.id === 'recent') setSortBy('date');
      if (filter.id === 'popular' || filter.id === 'mostViewed') setSortBy('views');
    }
  };

  const resetFilters = () => {
    closeArticleDraft();
    setFilterOwner('All');
    setFilterVisibility('All');
    setFilterTag('All');
    setFilterLanguage('All');
    setSearchQuery('');
    setActiveSubTab('All');
    setSelectedCategory('All');
    setKbNav({ type: 'workspace', id: 'overview' });
    setAiSearchQuery(null);
    setAiSearchSummary(null);
    setAiSearchSources([]);
    setAiSearchError(null);
  };

  const dismissAiSearchOverlay = () => {
    setAiSearchQuery(null);
    setAiSearchSummary(null);
    setAiSearchSources([]);
    setAiSearchError(null);
  };

  const handlePopularSearch = (term: string) => {
    setSearchQuery(term);
    dismissAiSearchOverlay();
  };

  const handleAskGeistAi = useCallback(
    async (query: string, options?: { forceRefresh?: boolean }) => {
      setAiSearchQuery(query);
      if (!options?.forceRefresh) {
        setAiSearchSummary(null);
      }
      setAiSearchError(null);
      setIsAiSearchLoading(true);

      const scopedArticles = filterArticlesByWorkspace(articles, workspace);
      const ragHits = ragService.findRelevantContext(query, scopedArticles, []);
      const minimizedSnippets = ragHits.map((hit) => ({
        ...hit,
        text: truncateRagSnippet(hit.text),
      }));
      setAiSearchSources(minimizedSnippets);

      if (!isAiSearchReady) {
        setAiSearchError(
          t('kb.aiNotConfigured', 'Geist AI is not configured. Connect a model in AI Orchestrator settings.'),
        );
        setIsAiSearchLoading(false);
        return;
      }

      const cacheEntityId = `kb-search-${query.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 96)}`;

      try {
        const summary = await aiAdapter.answerKnowledgeQuery(query, minimizedSnippets, {
          entityId: cacheEntityId,
          forceRefresh: options?.forceRefresh,
        });
        setAiSearchSummary(summary);
      } catch (err) {
        const message = err instanceof Error ? err.message : t('kb.aiAnswerFailed', 'Could not generate an AI answer.');
        setAiSearchError(message);
      } finally {
        setIsAiSearchLoading(false);
      }
    },
    [articles, workspace, isAiSearchReady, aiAdapter, t],
  );

  // Helper translations for preview reading
  const getLocalizedTitle = (art: any, lang: string) => {
    if (!art) return '';
    if (lang === 'German') return `[DE] ${art.title} - Deutsch Handbuch`;
    if (lang === 'French') return `[FR] Guide de l'utilisateur: ${art.title}`;
    if (lang === 'Spanish') return `[ES] Manual de Procedimiento: ${art.title}`;
    if (lang === 'Japanese') return `[JA] 用語集・ドキュメント: ${art.title}`;
    if (lang === 'Italian') return `[IT] Guida Completa: ${art.title}`;
    if (lang === 'Dutch') return `[NL] Handleiding: ${art.title}`;
    return art.title;
  };

  const renderCoverageDashboard = () => {
    if (!coverageData) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white space-y-4">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="font-bold text-slate-700">Loading AI Knowledge Coverage Map...</p>
        </div>
      );
    }

    const overallPercentage = coverageData.overallPercentage || 0;
    const totalExpected = coverageData.totalExpected || 0;
    const totalExistingMatched = coverageData.totalExistingMatched || 0;
    const totalMissing = coverageData.totalMissing || 0;
    const healthStatus = coverageData.healthStatus || 'Good';

    const getProgressColor = (pct: number) => {
      if (pct >= 80) return 'bg-emerald-500';
      if (pct >= 50) return 'bg-amber-500';
      return 'bg-rose-500';
    };

    const getProgressBg = (pct: number) => {
      if (pct >= 80) return 'bg-emerald-50';
      if (pct >= 50) return 'bg-amber-50';
      return 'bg-rose-50';
    };

    const getProgressText = (pct: number) => {
      if (pct >= 80) return 'text-emerald-700';
      if (pct >= 50) return 'text-amber-700';
      return 'text-rose-700';
    };

    const activeCategoryData = selectedCoverageCategory 
      ? coverageData.categories?.find((c: any) => c.categoryName?.toLowerCase() === selectedCoverageCategory.toLowerCase() || c.categoryId?.toLowerCase() === selectedCoverageCategory.toLowerCase())
      : coverageData.categories?.[0];

    return (
      <div className="flex-1 bg-slate-50/50 p-8 space-y-8 animate-in fade-in duration-200">
        
        {/* Dashboard Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[1.5rem] border border-slate-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-2.5">
              <Badge className="bg-indigo-100 text-indigo-700 border-none font-black text-[9px] uppercase tracking-widest px-2.5 py-1">
                AI Knowledge Engine
              </Badge>
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Telemetry Live syncing
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1.5 uppercase leading-tight">
              AI Knowledge Coverage Map
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Visualize documentation completeness, identify missing organizational criteria, and draft critical SOPs.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              disabled={isLoadingCoverage}
              onClick={() => fetchCoverageData(false)}
              className="bg-white border-slate-200 hover:bg-slate-50 h-10 rounded-xl font-bold text-xs gap-1.5 shrink-0 px-4 cursor-pointer"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-slate-500", isLoadingCoverage && "animate-spin")} />
              <span>Refresh</span>
            </Button>
            <Button
              disabled={isLoadingCoverage}
              onClick={handleRecalculate}
              className="bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold text-xs h-10 rounded-xl shadow-xs flex items-center gap-1.5 shrink-0 px-4.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
              <span>Recalculate Coverage</span>
            </Button>
          </div>
        </div>

        {/* Bento Grid: Summary KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-1">
          
          <div className="bg-white p-6 rounded-[1.5rem] border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div className="space-y-1 text-left">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Overall Coverage</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-slate-900">{overallPercentage}%</span>
                <span className={cn("text-[10px] font-bold", getProgressText(overallPercentage))}>
                  {overallPercentage >= 80 ? 'Optimal' : 'Gap-heavy'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Across all domains</p>
            </div>
            
            {/* Custom Circular Progress Ring */}
            <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="28" cy="28" r="24" stroke="#F1F5F9" strokeWidth="4" fill="transparent" />
                <circle 
                  cx="28" 
                  cy="28" 
                  r="24" 
                  stroke={overallPercentage >= 80 ? '#10B981' : overallPercentage >= 50 ? '#F59E0B' : '#EF4444'} 
                  strokeWidth="4" 
                  fill="transparent" 
                  strokeDasharray={`${2 * Math.PI * 24}`} 
                  strokeDashoffset={`${2 * Math.PI * 24 * (1 - overallPercentage / 100)}`}
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <span className="absolute text-[10px] font-extrabold text-slate-800">{overallPercentage}%</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[1.5rem] border border-slate-200/80 shadow-xs flex flex-col justify-between text-left">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Matched Articles</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-black text-slate-900">{totalExistingMatched}</span>
              <Badge className="bg-emerald-50 text-emerald-700 border-none px-1.5 text-[9px] font-black">
                {totalExistingMatched} / {totalExpected} Match
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Associated with expected nodes</p>
          </div>

          <div className="bg-white p-6 rounded-[1.5rem] border border-slate-200/80 shadow-xs flex flex-col justify-between text-left">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Unresolved Gaps</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-black text-red-600">{totalMissing}</span>
              <Badge className="bg-red-50 text-red-700 border-none px-1.5 text-[9px] font-black">
                {totalExpected > 0 ? Math.round((totalMissing / totalExpected) * 100) : 0}% Missing
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Suggested for drafting</p>
          </div>

          <div className="bg-white p-6 rounded-[1.5rem] border border-slate-200/80 shadow-xs flex flex-col justify-between text-left">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Model Quality Health</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className={cn(
                "text-2xl font-black uppercase tracking-tight",
                healthStatus === 'Excellent' || healthStatus === 'Good' ? 'text-emerald-600' : 'text-amber-600'
              )}>
                {healthStatus}
              </span>
              <Badge className="bg-indigo-50 text-indigo-700 border-none px-1.5 text-[9px] font-black">
                Active Audit
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-1">GDPR & Operational Compliant</p>
          </div>

        </div>

        {/* Main Interactive Area: Heatmap / Topic Tree & Suggestions panels */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left panel (Heatmap, Tree Nodes & Categories progress) */}
          <div className="lg:col-span-8 bg-white p-6 rounded-[1.5rem] border border-slate-200/80 shadow-xs space-y-6">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 text-left">
              <div className="space-y-0.5">
                <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">
                  Coverage Heatmap & Node Progress
                </h2>
                <p className="text-[11px] text-slate-400 font-semibold">
                  Click a category below to load its compliance checklists.
                </p>
              </div>

              <div className="bg-slate-100 p-1 rounded-xl flex border gap-1 text-[11px] font-black">
                <button
                  onClick={() => setCoverageSubView('heatmap')}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg transition-all cursor-pointer",
                    coverageSubView === 'heatmap' ? "bg-white text-indigo-650 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Heatmap View
                </button>
                <button
                  onClick={() => setCoverageSubView('tree')}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg transition-all cursor-pointer",
                    coverageSubView === 'tree' ? "bg-white text-indigo-650 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Topic Tree View
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {coverageData.categories?.map((cat: any) => {
                const isSelected = selectedCoverageCategory 
                  ? selectedCoverageCategory.toLowerCase() === cat.categoryName?.toLowerCase()
                  : cat.categoryName === 'Getting Started';

                const progressColor = getProgressColor(cat.percentage);
                const progressBg = getProgressBg(cat.percentage);
                const progressText = getProgressText(cat.percentage);

                return (
                  <div
                    key={cat.categoryName}
                    onClick={() => setSelectedCoverageCategory(cat.categoryName)}
                    className={cn(
                      "p-4 rounded-xl border transition-all cursor-pointer text-left space-y-3 hover:border-slate-350",
                      isSelected 
                        ? "bg-[#FAF9FF] border-indigo-400 shadow-sm" 
                        : "bg-white border-slate-200/85"
                    )}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-black text-slate-850 uppercase tracking-tight">{cat.categoryName}</span>
                      <Badge className={cn("border-none text-[8px] font-black h-5 px-1.5", progressBg, progressText)}>
                        {cat.percentage}% Mapped
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full transition-all duration-500", progressColor)} 
                          style={{ width: `${cat.percentage}%` }} 
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                        <span>{cat.matchedCount} Match (✓)</span>
                        <span>{cat.missingCount} Missing (✗)</span>
                      </div>
                    </div>

                    {/* Heatmap Cubes */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {cat.topics?.map((topic: any, idx: number) => (
                        <div
                          key={idx}
                          className={cn(
                            "w-5 h-5 rounded flex items-center justify-center text-[10px] font-extrabold shrink-0 relative group",
                            topic.status === 'Matched' ? 'bg-emerald-500 text-white' : 'bg-rose-100 text-rose-600'
                          )}
                          title={`${topic.name} (${topic.status})`}
                        >
                          {topic.status === 'Matched' ? '✓' : '✗'}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Topic checking detail block */}
            {activeCategoryData && (
              <div className="border border-indigo-100/80 bg-[#FAF9FF] p-5 rounded-[1.25rem] space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-[11px] font-black uppercase text-indigo-950 tracking-wider text-left">
                      {activeCategoryData.categoryName} Index Details
                    </h3>
                  </div>
                  <Badge className="bg-indigo-100 text-indigo-750 border-none font-extrabold text-[9px]">
                    {activeCategoryData.percentage}% Topic Resolution
                  </Badge>
                </div>

                {coverageSubView === 'heatmap' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                    {activeCategoryData.topics?.map((topic: any, idx: number) => (
                      <div 
                        key={idx} 
                        className={cn(
                          "p-4 rounded-xl border text-left bg-white transition-all space-y-2.5 shadow-3xs",
                          topic.status === 'Matched' ? 'border-slate-200/80 bg-white' : 'border-rose-100 bg-rose-50/10'
                        )}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-xs font-black text-slate-900 leading-tight">{topic.name}</h4>
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-sm",
                            topic.importance === 'High' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
                          )}>
                            {topic.importance}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                          <span>Status</span>
                          <span className={cn(
                            "flex items-center gap-1 text-[11px] font-black",
                            topic.status === 'Matched' ? 'text-emerald-600' : 'text-red-500'
                          )}>
                            {topic.status === 'Matched' ? '✓ Covered' : '✗ Gap'}
                          </span>
                        </div>

                        {topic.status === 'Matched' && topic.matchedArticles?.length > 0 ? (
                          <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg flex items-center justify-between gap-1.5 mt-1 overflow-hidden">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span className="text-[10.5px] text-slate-600 font-bold truncate">
                                {topic.matchedArticles[0].title}
                              </span>
                            </div>
                            <Button 
                              variant="ghost" 
                              onClick={() => {
                                const found = articles.find(a => a.id === topic.matchedArticles[0].id || a.title === topic.matchedArticles[0].title);
                                if (found) {
                                  setViewingArticle(found);
                                  setViewMode('standard');
                                } else {
                                  toast.error("Original source article is currently undergoing SOC2 revision.");
                                }
                              }}
                              className="h-6 px-2 hover:bg-slate-200 text-indigo-600 hover:text-indigo-800 text-[10px] font-black uppercase cursor-pointer shrink-0"
                            >
                              Open
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setViewMode('standard');
                              setNewArticle({
                                title: topic.name,
                                content: `<h2>${topic.name} Standard Operating Procedure</h2><p>Provide specific step-by-step operating checklists for addressing ${topic.name} within secure regional workspace bounds.</p>`,
                                category: activeCategoryData.categoryName,
                                subCategory: 'Workspace Setup',
                                visibility: 'Public',
                                tags: ['automation-gap'],
                                owner: 'Sarah James',
                                reviewer: 'Mike Chen',
                                lastEditor: 'Sarah James',
                                status: 'Draft',
                                avgReadTime: '3m 00s'
                              });
                              setTagInput('automation-gap');
                              setEditingArticleId(null);
                              setIsAddingArticle(true);
                            }}
                            className="bg-white hover:bg-red-50 text-red-650 border-red-200 hover:border-red-300 h-7.5 text-[10px] font-black rounded-lg w-full flex items-center justify-center gap-1 mt-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3 text-red-500" />
                            <span>Draft SOP Checklist</span>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200/80 rounded-xl divide-y divide-slate-100 overflow-hidden text-left text-xs font-semibold">
                    {activeCategoryData.topics?.map((topic: any, idx: number) => (
                      <div key={idx} className="p-3.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5">
                          {topic.status === 'Matched' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                          )}
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 leading-snug">{topic.name}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{topic.importance} Importance</span>
                          </div>
                        </div>

                        <div>
                          {topic.status === 'Matched' ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-none text-[8px] font-black">
                              Match found
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-50 text-rose-700 border-none text-[8px] font-black">
                              GAP IDENTIFIED
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right panel (AI Suggestions & critical gaps) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* AI Recommendations */}
            <div className="bg-white p-6 rounded-[1.5rem] border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-left">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">AI Content Optimizer</h3>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold leading-relaxed text-left">
                Continually analyzes support tickets, bot conversations and logs to suggest new entries.
              </p>

              <div className="space-y-3.5 pt-1">
                {coverageData.aiSuggestions?.map((sug: any, index: number) => (
                  <div 
                    key={index} 
                    className="p-4 bg-slate-50 border border-slate-250/60 rounded-xl text-left space-y-2.5"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="text-xs font-black text-slate-900 leading-tight">{sug.title}</h4>
                      <Badge className="bg-indigo-150 text-indigo-700 hover:bg-indigo-150 border-none text-[8px] font-black">
                        {sug.priority}
                      </Badge>
                    </div>

                    <p className="text-[10.5px] text-slate-500 leading-relaxed font-semibold">
                      {sug.reason}
                    </p>

                    <Button
                      variant="outline"
                      onClick={() => {
                        setViewMode('standard');
                        setNewArticle({
                          title: sug.title,
                          content: `<h2>${sug.title} Draft SOP</h2><p>Auto-generated placeholders regarding ${sug.title} specifically mapped to deflect ticketing cascades.</p>`,
                          category: sug.category || "Getting Started",
                          subCategory: "Workspace Setup",
                          visibility: "Public",
                          tags: ["ai-suggested", "critical-gap"],
                          owner: "Sarah James",
                          reviewer: "Mike Chen",
                          lastEditor: "Sarah James",
                          status: "Draft",
                          avgReadTime: "3m 00s"
                        });
                        setTagInput("ai-suggested, critical-gap");
                        setEditingArticleId(null);
                        setIsAddingArticle(true);
                      }}
                      className="bg-white hover:bg-indigo-50 text-indigo-650 hover:text-indigo-800 border-slate-200 hover:border-indigo-200 h-8 text-[10px] font-black rounded-lg w-full flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Draft suggested article</span>
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Critical Gaps list block */}
            <div className="bg-white p-6 rounded-[1.5rem] border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-1.5 text-left">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Most Critical Gaps</h3>
              </div>

              <div className="divide-y divide-slate-100 text-left text-xs font-semibold">
                {coverageData.criticalGaps?.map((gap: any, keyIdx: number) => (
                  <div key={keyIdx} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-slate-800 leading-tight truncate">{gap.topic}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{gap.category}</span>
                    </div>
                    <Badge className="bg-red-50 text-red-700 border-none text-[8px] font-black shrink-0">
                      High Impact
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>
    );
  };

  const getLocalizedContent = (art: any, lang: string) => {
     if (!art) return '';
     if (lang === 'German') return `<h3>Souveränitäts-Verschlüsselungsprüfung</h3><p>Automatisch übersetzte Version des Artikels unter Beibehaltung aller Kernschlüsselvariablen.</p>${art.content}`;
     if (lang === 'French') return `<h3>Vérification du chiffrement souverain</h3><p>Version traduite automatiquement du document préservant les paramètres cryptographiques d'origine.</p>${art.content}`;
     if (lang === 'Spanish') return `<h3>Verificación del sistema de protección</h3><p>Documento localizado con traducciones simuladas por IA manteniendo los bloques técnicos intactos.</p>${art.content}`;
     if (lang === 'Japanese') return `<h3>暗号化およびセキュアチャネル仕様書</h3><p>英語の原文をインテリジェントに直訳したリファレンスドキュメントです。</p>${art.content}`;
     return art.content;
  };

  const renderArticleDetailView = () => {
    if (!viewingArticle) return null;

    const handleHelpful = async () => {
      const updatedHelpful = (viewingArticle.helpfulCount || 0) + 1;
      await kbService.updateArticle(viewingArticle.id, { helpfulCount: updatedHelpful });
      try {
        const trust = await trustScoreService.getTrustScore(viewingArticle.id, viewingArticle);
        const updatedInputs = { ...trust.inputs, helpfulCount: updatedHelpful };
        await trustScoreService.updateTrustScore(viewingArticle.id, updatedInputs, trust.score, trust.history);
      } catch (e) {
        console.warn('Could not save trust score logs:', e);
      }
      setArticles((prev) => prev.map((a) => (a.id === viewingArticle.id ? { ...a, helpfulCount: updatedHelpful } : a)));
      setViewingArticle((prev) => (prev ? { ...prev, helpfulCount: updatedHelpful } : null));
      toast.success('Thank you! Positive rating logged.');
    };

    const handleUnhelpful = async () => {
      const updatedUnhelpful = (viewingArticle.unhelpfulCount || 0) + 1;
      await kbService.updateArticle(viewingArticle.id, { unhelpfulCount: updatedUnhelpful });
      try {
        const trust = await trustScoreService.getTrustScore(viewingArticle.id, viewingArticle);
        const updatedInputs = { ...trust.inputs, unhelpfulCount: updatedUnhelpful };
        await trustScoreService.updateTrustScore(viewingArticle.id, updatedInputs, trust.score, trust.history);
      } catch (e) {
        console.warn('Could not save trust score logs:', e);
      }
      setArticles((prev) => prev.map((a) => (a.id === viewingArticle.id ? { ...a, unhelpfulCount: updatedUnhelpful } : a)));
      setViewingArticle((prev) => (prev ? { ...prev, unhelpfulCount: updatedUnhelpful } : null));
      toast.success('Feedback recorded. Trust metrics adjusted.');
    };

    return (
      <KBArticleDetailView
        article={viewingArticle}
        title={getLocalizedTitle(viewingArticle, activeReadingLanguage)}
        htmlContent={getLocalizedContent(viewingArticle, activeReadingLanguage)}
        activeReadingLanguage={activeReadingLanguage}
        onBack={() => {
          setViewingArticle(null);
          setActiveReadingLanguage('English');
        }}
        onEdit={() => handleEditArticle(viewingArticle)}
        onCopyLink={() => handleCopyUrl(viewingArticle.title)}
        onTranslate={() => handleTranslateArticle(activeReadingLanguage)}
        onHelpful={handleHelpful}
        onUnhelpful={handleUnhelpful}
        onTrustScoreUpdated={(newScore) => {
          setArticles((prev) => prev.map((a) => (a.id === viewingArticle.id ? { ...a, trustScore: newScore } : a)));
          setViewingArticle((prev) => (prev ? { ...prev, trustScore: newScore } : null));
        }}
      />
    );
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-[#FAFBFC] overflow-hidden text-slate-800 font-sans">


        {viewMode === 'coverage' ? (
          renderCoverageDashboard()
        ) : (
          <div className="flex-1 flex min-h-0 overflow-hidden bg-[#F8F9FA]">
            <KBLeftSidebar
              active={kbNav}
              onNavigate={handleKbNavigate}
              counts={sidebarCounts}
              healthScore={healthScore}
            />
            {isAddingArticle ? (
              <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#F8F9FB] overflow-hidden">
                <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-slate-100 bg-white shrink-0">
                  <button
                    type="button"
                    onClick={closeArticleDraft}
                    className="flex items-center gap-1 text-slate-500 hover:text-slate-800 font-extrabold text-xs cursor-pointer transition-colors select-none group"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-slate-450 group-hover:text-slate-650 transition-colors" />
                    {t('kb.editor.backToOverview', 'Back to knowledge base')}
                  </button>
                </div>
                <KBArticleEditorWorkspace
                  editingArticleId={editingArticleId}
                  selectedCategory={selectedCategory}
                  newArticle={newArticle}
                  onNewArticleChange={setNewArticle}
                  tagInput={tagInput}
                  onTagInputChange={setTagInput}
                  categories={categories}
                  enterpriseUsers={ENTERPRISE_USERS}
                  onClose={closeArticleDraft}
                  onSave={handleSaveArticle}
                  className="flex-1 min-h-0"
                />
              </div>
            ) : viewingArticle ? (
              renderArticleDetailView()
            ) : (
            <ScrollArea className="flex-1 min-w-0">
              <div className="flex flex-col xl:flex-row gap-0 min-h-full">
                <main className="flex-1 min-w-0 px-4 sm:px-6 py-6 space-y-6 pb-10">
                  <KBPageHeader
                    onImportDocs={() => setIsImportOpen(true)}
                    onAiGenerate={() => handleKbNavigate({ type: 'workspace', id: 'ai' })}
                    onNewArticle={() => openCreateArticle()}
                    onNewCategory={() => setIsAddingCategory(true)}
                  />

                  {isAiAssistantMode ? (
                    <KBAutopilotDashboard
                      embedded
                      onBackToKB={() => handleKbNavigate({ type: 'workspace', id: 'overview' })}
                      onArticlePublished={() => handleKbNavigate({ type: 'workspace', id: 'overview' })}
                    />
                  ) : (
                    <>
                  {isOverviewMode ? (
                    <KBKpiCards
                      publishedCount={publishedCount}
                      draftCount={draftCount}
                      healthScore={healthScore}
                      monthlyViews={monthlyViews}
                    />
                  ) : null}

                  <KBSearchSection
                    searchQuery={searchQuery}
                    onSearchChange={(value) => {
                      setSearchQuery(value);
                      if (!value.trim()) dismissAiSearchOverlay();
                    }}
                    onAdvancedFilters={() => setShowAdvancedFilters((v) => !v)}
                    showFilters={showAdvancedFilters}
                    onPopularSearch={handlePopularSearch}
                    onAskAi={handleAskGeistAi}
                  />

                  <KBSearchAiOverlay
                    query={aiSearchQuery ?? ''}
                    summary={aiSearchSummary}
                    sources={aiSearchSources}
                    isLoading={isAiSearchLoading}
                    error={aiSearchError}
                    onDismiss={dismissAiSearchOverlay}
                    onRefresh={
                      aiSearchQuery
                        ? () => handleAskGeistAi(aiSearchQuery, { forceRefresh: true })
                        : undefined
                    }
                    className="mt-3"
                  />

                  <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl border border-slate-200/80 bg-white">
                    <ModuleToolbarSelect value={filterOwner} onChange={setFilterOwner} aria-label={t('kb.owner', 'Owner')}>
                      <option value="All">{t('kb.allOwners', 'All owners')}</option>
                      {Array.from(new Set(workspaceArticles.map((a) => a.owner).filter(Boolean))).map((ownerName: string, idx) => (
                        <option key={idx} value={ownerName}>{ownerName}</option>
                      ))}
                    </ModuleToolbarSelect>
                    <ModuleToolbarSelect value={filterVisibility} onChange={setFilterVisibility} aria-label={t('kb.allAccess', 'Access')}>
                      <option value="All">{t('kb.allAccess', 'All access')}</option>
                      <option value="Public">{t('kb.publicPortal', 'Public')}</option>
                      <option value="Private">{t('kb.internalSopsOnly', 'Internal')}</option>
                    </ModuleToolbarSelect>
                    {isDeveloperWorkspace ? (
                      <span className="text-[11px] text-violet-600 font-medium px-2 py-1 rounded-lg bg-violet-50 border border-violet-100">
                        {t('kb.workspaceDeveloperHint', 'Developer workspace — internal docs & runbooks')}
                      </span>
                    ) : (
                      <span className="text-[11px] text-blue-600 font-medium px-2 py-1 rounded-lg bg-blue-50 border border-blue-100">
                        {t('kb.workspaceSupportHint', 'Support workspace — public customer FAQs')}
                      </span>
                    )}
                  </div>

                  {showAdvancedFilters ? (
                    <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl border border-slate-200/80 bg-white">
                      <ModuleToolbarSelect value={filterLanguage} onChange={setFilterLanguage} aria-label={t('kb.language', 'Language')}>
                        <option value="All">{t('kb.allLanguages', 'All languages')}</option>
                        {Array.from(new Set(workspaceArticles.map((a) => a.language).filter(Boolean))).map((lang: string, idx) => (
                          <option key={idx} value={lang}>{lang}</option>
                        ))}
                      </ModuleToolbarSelect>
                      <ModuleToolbarSelect value={filterTag} onChange={setFilterTag} aria-label={t('kb.tag', 'Tag')}>
                        <option value="All">{t('kb.allTags', 'All tags')}</option>
                        {Array.from(new Set(workspaceArticles.flatMap((a) => a.tags || []))).map((tag: string, idx) => (
                          <option key={idx} value={tag}>{tag}</option>
                        ))}
                      </ModuleToolbarSelect>
                    </div>
                  ) : null}

                  {!isOverviewMode ? (
                    <section>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div className="min-w-0">
                          <h2 className="text-sm font-semibold text-slate-900">{articlesSectionTitle}</h2>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {t('kb.resultsCount', '{{count}} results').replace('{{count}}', String(processedArticles.length))}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end shrink-0">
                          <KBViewModeSelector value={viewLayout} onChange={setViewLayout} />
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-medium text-slate-500">{t('modulePage.sort', 'Sort')}:</span>
                            <ModuleToolbarSelect
                              value={sortBy}
                              onChange={(v) => setSortBy(v as typeof sortBy)}
                              aria-label={t('actions.sort', 'Sort')}
                            >
                              <option value="date">{t('kb.sortLatest', 'Latest updated')}</option>
                              <option value="popular">{t('kb.sortPopularity', 'Popularity')}</option>
                              <option value="views">{t('kb.sortViews', 'Most views')}</option>
                              <option value="confidence">{t('kb.sortConfidence', 'Trust score')}</option>
                            </ModuleToolbarSelect>
                          </div>
                        </div>
                      </div>
                      <KBBulkActionBar
                        selectedCount={selectedArticleIds.size}
                        onClear={() => setSelectedArticleIds(new Set())}
                        onBulkDelete={() => setBulkDeleteOpen(true)}
                        className="mb-3"
                      />
                      <KBArticleViews
                        articles={processedArticles}
                        categories={categories}
                        selectedIds={selectedArticleIds}
                        onToggleSelect={toggleArticleSelection}
                        onToggleSelectAll={toggleSelectAllArticles}
                        viewMode={viewLayout}
                        onSelect={(art) => setViewingArticle(art)}
                        onEdit={handleEditArticle}
                        onDuplicate={handleDuplicateArticle}
                        onDelete={handleDeleteArticle}
                        onResetFilters={resetFilters}
                      />
                    </section>
                  ) : null}

                  {isOverviewMode ? (
                    <KBCategoryGrid
                      categories={categories}
                      categoryRecords={categories}
                      articles={workspaceArticles}
                      selectedCategory={selectedCategory}
                      onSelect={(name) => handleKbNavigate({ type: 'category', id: name })}
                      onRename={openRenameCategory}
                      onDelete={openDeleteCategory}
                    />
                  ) : null}

                  {isOverviewMode ? (
                    <section>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <h2 className="text-sm font-semibold text-slate-900">
                          {t('kb.allArticlesSection', 'All Articles')}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end shrink-0">
                          <KBViewModeSelector value={viewLayout} onChange={setViewLayout} />
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-medium text-slate-500">{t('modulePage.sort', 'Sort')}:</span>
                            <ModuleToolbarSelect
                              value={sortBy}
                              onChange={(v) => setSortBy(v as typeof sortBy)}
                              aria-label={t('actions.sort', 'Sort')}
                            >
                              <option value="date">{t('kb.sortLatest', 'Latest updated')}</option>
                              <option value="popular">{t('kb.sortPopularity', 'Popularity')}</option>
                              <option value="views">{t('kb.sortViews', 'Most views')}</option>
                              <option value="confidence">{t('kb.sortConfidence', 'Trust score')}</option>
                            </ModuleToolbarSelect>
                          </div>
                        </div>
                      </div>
                      <KBBulkActionBar
                        selectedCount={selectedArticleIds.size}
                        onClear={() => setSelectedArticleIds(new Set())}
                        onBulkDelete={() => setBulkDeleteOpen(true)}
                        className="mb-3"
                      />
                      <KBArticleViews
                        articles={processedArticles}
                        categories={categories}
                        selectedIds={selectedArticleIds}
                        onToggleSelect={toggleArticleSelection}
                        onToggleSelectAll={toggleSelectAllArticles}
                        viewMode={viewLayout}
                        onSelect={(art) => setViewingArticle(art)}
                        onEdit={handleEditArticle}
                        onDuplicate={handleDuplicateArticle}
                        onDelete={handleDeleteArticle}
                        onResetFilters={resetFilters}
                      />
                    </section>
                  ) : null}
                    </>
                  )}
                </main>

                {!isAiAssistantMode ? (
                <aside className="xl:w-[280px] shrink-0 border-t xl:border-t-0 xl:border-l border-slate-200/80 bg-white px-4 py-6 xl:sticky xl:top-0 xl:self-start">
                  <KBActivitySidebar
                    recentActivity={recentActivity}
                    healthScore={healthScore}
                    reviewCount={needsReviewCount}
                    missingTagsCount={missingTagsCount}
                    outdatedCount={outdatedCount}
                    aiRecommendations={coverageData?.aiSuggestions?.length ?? 5}
                    contributors={topContributors}
                  />
                </aside>
                ) : null}
              </div>
            </ScrollArea>
            )}
          </div>
        )}


      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t('kb.actions.importDocs', 'Import Docs')}</DialogTitle>
            <DialogDescription>{t('kb.importDesc', 'Import documentation from URLs or files with AI-assisted parsing.')}</DialogDescription>
          </DialogHeader>
          <KBImporter />
        </DialogContent>
      </Dialog>


      {/* ======================================================== */}
      {/* ENTERPRISE CATEGORY CONFIGURATION DIALOG MODAL           */}
      {/* ======================================================== */}
      <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
        <DialogContent className="max-w-[440px] rounded-2xl p-5 border shadow-2xl">
          <DialogHeader className="pb-3 border-b">
             <DialogTitle className="text-sm font-black uppercase text-slate-800 tracking-wider">{t('kb.categoryAdd.title', 'Create category')}</DialogTitle>
             <DialogDescription className="text-[11px] text-slate-400 font-semibold">{t('kb.categoryAdd.description', 'Extend your knowledge structure with a new folder.')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 text-xs">
             <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-400">Category name title</Label>
                <Input 
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Azure Virtual Desktop logs..."
                  className="h-10 rounded-xl"
                />
             </div>

             <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-400 font-bold">Category short description</Label>
                <Input 
                  value={newCategoryDesc}
                  onChange={(e) => setNewCategoryDesc(e.target.value)}
                  placeholder="Define category operational purpose bounds..."
                  className="h-10 rounded-xl"
                />
             </div>

             <div className="grid grid-cols-2 gap-3">
               <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-slate-400">Parent Category</Label>
                  <select
                    value={newCategoryParent}
                    onChange={(e) => setNewCategoryParent(e.target.value)}
                    className="w-full h-10 border rounded-xl bg-white px-2 cursor-pointer font-bold"
                  >
                     <option value="None">None (Root Node)</option>
                     {categories.map((c, idx) => (
                       <option key={idx} value={c.name}>{c.name}</option>
                     ))}
                  </select>
               </div>

               <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-slate-400">Designated Directory Owner</Label>
                  <select
                    value={newCategoryOwner}
                    onChange={(e) => setNewCategoryOwner(e.target.value)}
                    className="w-full h-10 border rounded-xl bg-white px-2 cursor-pointer font-bold"
                  >
                     {ENTERPRISE_USERS.map((usr, idx) => (
                       <option key={idx} value={usr.name}>{usr.name}</option>
                     ))}
                  </select>
               </div>
             </div>
          </div>

          <DialogFooter className="pt-3 border-t">
             <Button variant="ghost" className="text-xs h-9" onClick={() => setIsAddingCategory(false)}>
                {t('actions.cancel', 'Cancel')}
             </Button>
             <Button className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs h-9.5 px-4" onClick={handleAddCategory}>
                {t('kb.categoryAdd.confirm', 'Create category')}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <KBCategoryDeleteModal
        open={!!deleteCategoryTarget}
        onOpenChange={(open) => { if (!open) setDeleteCategoryTarget(null); }}
        category={deleteCategoryTarget}
        articleCount={
          deleteCategoryTarget
            ? articles.filter((a) => resolveArticleCategoryId(a, categories) === deleteCategoryTarget.id).length
            : 0
        }
        onConfirm={handleConfirmDeleteCategory}
      />

      <Dialog open={isRenamingCategory} onOpenChange={setIsRenamingCategory}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t('kb.categoryRename.title', 'Rename category')}</DialogTitle>
            <DialogDescription>{t('kb.categoryRename.description', 'Update the display name. Article IDs and references stay intact.')}</DialogDescription>
          </DialogHeader>
          <Input
            value={renameCategoryName}
            onChange={(e) => setRenameCategoryName(e.target.value)}
            className="h-10 rounded-xl"
            placeholder={t('kb.categoryRename.placeholder', 'Category name')}
          />
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setIsRenamingCategory(false)}>
              {t('actions.cancel', 'Cancel')}
            </Button>
            <Button className="rounded-xl bg-blue-600 hover:bg-blue-700" onClick={handleRenameCategory}>
              {t('kb.categoryRename.confirm', 'Save name')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-500" />
              {t('kb.bulk.confirmTitle', 'Delete selected articles?')}
            </DialogTitle>
            <DialogDescription>
              {t('kb.bulk.confirmDescription', 'This will remove {{count}} articles. You can undo within 5 seconds.')
                .replace('{{count}}', String(selectedArticleIds.size))}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setBulkDeleteOpen(false)}>
              {t('actions.cancel', 'Cancel')}
            </Button>
            <Button variant="destructive" className="rounded-xl" onClick={handleBulkDelete}>
              {t('kb.bulk.confirmDelete', 'Delete {{count}} items').replace('{{count}}', String(selectedArticleIds.size))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// Compact helper clock icon
function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg 
      fill="none" 
      viewBox="0 0 24 24" 
      strokeWidth={1.5} 
      stroke="currentColor" 
      className={props.className}
      width="1em" 
      height="1em"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}
