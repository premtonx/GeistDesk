import React, { useState, useEffect } from 'react';
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
  RefreshCw
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
import { ModuleCreateButton } from '../ui/ModuleCreateButton';
import {
  ModulePageHeader,
  ModulePageTabs,
  ModuleKpiGrid,
  ModuleToolbar,
  type ModuleTabItem,
} from '../ui/module-page';
import { RichTextEditor } from '../RichTextEditor';
import { KBAutopilotDashboard } from '../KBAutopilotDashboard';
import { KBArticle } from '../../types';
import { KBArticleTrustPanel } from '../KBArticleTrustPanel';
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
    title: "Getting Started with GeistDesk",
    category: "Getting Started",
    subCategory: "Workspace Setup",
    content: "<h2>1. General Interface Overview</h2><p>Welcome to GeistDesk! The enterprise dashboard allows support professionals to leverage automated ticket response loops, live workspace updates, and credential payloads encryption from a single terminal interface.</p><h2>2. Setup Teams & Roles</h2><p>Navigate to Settings > Roles and assign permissions recursively to guarantee proper compartmentalization of ticketing nodes and credential dropzones.</p>",
    tags: ["onboarding", "setup", "basics"],
    authorId: "admin",
    owner: "Sarah James",
    reviewer: "Mike Chen",
    lastEditor: "Sarah James",
    approvalStatus: "Approved",
    reviewDueDate: "2026-09-01",
    status: "Published",
    visibility: "Public",
    views: 1420,
    helpfulCount: 224,
    unhelpfulCount: 4,
    avgReadTime: "3m 15s",
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
  const [searchParams, setSearchParams] = useSearchParams();
  
  // States
  const [firestoreArticles, setFirestoreArticles] = useState<KBArticle[]>([]);
  const [articles, setArticles] = useState<any[]>(ENTERPRISE_SEED_ARTICLES);
  const [selectedCategory, setSelectedCategory] = useState<string>('Getting Started');

  // AI Knowledge Coverage Map states
  const [viewMode, setViewMode] = useState<'standard' | 'coverage' | 'autopilot'>('standard');
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
  const [activeSubTab, setActiveSubTab] = useState<string>('All'); // All, Published, Drafts, Needs Review, Archived, Outdated, Internal Only
  const [viewLayout, setViewLayout] = useState<'table' | 'card' | 'tree'>('table');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'views' | 'confidence'>('date');
  
  // Custom interactive layout filters
  const [filterOwner, setFilterOwner] = useState<string>('All');
  const [filterVisibility, setFilterVisibility] = useState<string>('All');
  const [filterLanguage, setFilterLanguage] = useState<string>('All');
  const [filterTag, setFilterTag] = useState<string>('All');
  
  // Advanced side panels & creation states
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [newCategoryOwner, setNewCategoryOwner] = useState('Sarah James');
  const [newCategoryParent, setNewCategoryParent] = useState('None');
  
  const [isAddingArticle, setIsAddingArticle] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [viewingArticle, setViewingArticle] = useState<any>(null);
  
  // Collapsible left sidebar sections (closed by default)
  const [isAiContentCenterOpen, setIsAiContentCenterOpen] = useState(false);
  const [isEliteArticlesOpen, setIsEliteArticlesOpen] = useState(false);
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  
  const handleSelectArticleByTitle = (title: string) => {
    const matched = articles.find(a => a.title.toLowerCase() === title.toLowerCase());
    if (matched) {
      setViewingArticle(matched);
    }
  };
  const [activeReadingLanguage, setActiveReadingLanguage] = useState<string>('English');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  
  const [newArticle, setNewArticle] = useState({
    title: '',
    content: '',
    category: 'Getting Started',
    subCategory: 'Workspace Setup',
    visibility: 'Public' as 'Public' | 'Private',
    tags: [] as string[],
    owner: 'Sarah James',
    reviewer: 'Mike Chen',
    lastEditor: 'Sarah James',
    status: 'Published' as string,
    avgReadTime: '3m 00s'
  });
  const [tagInput, setTagInput] = useState('');
  
  // AI Interactive Simulator tools
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [aiGeneratorWorkflow, setAiGeneratorWorkflow] = useState<string | null>(null);
  const [aiPromptInput, setAiPromptInput] = useState<string>('');
  const [aiOutputStream, setAiOutputStream] = useState<string>('');

  // Default internal structures
  const [categories, setCategories] = useState([
    { name: 'Getting Started', subCategory: 'Workspace Setup', desc: 'Onboarding tools, basic walk-throughs, and quick guides for setting up core nodes.', owner: 'Sarah James', updated: '2 days ago', icon: BookOpen, order: 1 },
    { name: 'Billing', subCategory: 'Invoicing Methods', desc: 'Invoices troubleshooting, subscription models, and finance integration configurations.', owner: 'John Doe', updated: '5 days ago', icon: FileText, order: 2 },
    { name: 'API Documentation', subCategory: 'Authentication', desc: 'Developer integration guidelines, dynamic webhooks, API tokens, and sandbox tools.', owner: 'Anna Bell', updated: 'Yesterday', icon: FileJson, order: 3 },
    { name: 'Integrations', subCategory: 'Slack Integrations', desc: 'Third-party notification setups, Slack pipelines, and Teams live synchronization.', owner: 'Anna Bell', updated: '1 week ago', icon: Link, order: 4 },
    { name: 'Troubleshooting', subCategory: 'VPN Configuration Issues', desc: 'Diagnostic flowcharts, DNS routing remedies, and customer hardware alignment SOPs.', owner: 'Will Coyote', updated: 'Today', icon: Wrench, order: 5 },
    { name: 'Internal SOPs', subCategory: 'SOC2 Incident Playbooks', desc: 'Rigorous standard operating procedures for SOC2 sanitization audits and security operations.', owner: 'Mike Chen', updated: '6 days ago', icon: ShieldCheck, order: 6 }
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
      if (!categories.find(c => c.name === newCategoryName)) {
        setCategories([...categories, { 
          name: newCategoryName, 
          subCategory: newCategoryParent !== 'None' ? `${newCategoryParent} Child` : 'General Node',
          desc: newCategoryDesc || 'Enterprise custom knowledge structures pipeline.', 
          owner: newCategoryOwner, 
          updated: 'Just now', 
          icon: BookOpen,
          order: categories.length + 1
        }]);
        setNewCategoryName('');
        setNewCategoryDesc('');
        setIsAddingCategory(false);
        toast.success(`Category "${newCategoryName}" registered under "${newCategoryParent}" scope successfully.`);
      } else {
        toast.error("Category node already configured in workspace.");
      }
    }
  };

  const openCreateArticle = (category = selectedCategory || 'Getting Started') => {
    setNewArticle({
      title: '',
      content: '',
      category,
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
      category: article.category,
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
    toast.success("Article shifted to secure archive partition.");
  };

  const handleDeleteArticle = (id: string) => {
    setArticles(p => p.filter(a => a.id !== id));
    toast.warning("Article shredded from physical databases.");
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

  const simulateAIGeneration = (type: string) => {
    setAiGeneratorWorkflow(type);
    setIsGeneratingAI(true);
    setAiOutputStream('');
    
    let content = '';
    let title = '';
    
    if (type === 'vpn-ticket') {
       title = "OSX & Windows DNS Leak Resolvers SOP";
       content = `<h2>Overview of OSX Tunnel Fix</h2><p>This automated procedure resolves local router conflicts causing DNS queries to leak outside authenticated TLS tunnels during remote IPSec sessions.</p><h3>Pre-requisites</h3><ul><li>Terminal Administrator credentials.</li><li>GeistExchange active profile.</li></ul><h3>Step-by-step Actions</h3><p>Run the following command script to isolate routing priority tables:</p><pre><code>scutil --dns | grep -i internal</code></pre><p>Confirm all outbound queries route through fallback loops to bypass local isp tracking variables.</p>`;
    } else if (type === 'sop') {
       title = "Standard Operating Procedure: Live Telemetry sanitization";
       content = `<h2>Production Server Log Sanity SOP</h2><p>Provides standardized telemetry cleanup tasks complying with SOC2 standards for data containment.</p><h3>Task Outline</h3><ol><li>Verify support logs are decrypted strictly in Sandbox mode.</li><li>Perform daily entropy check on key storage partitions.</li></ol>`;
    } else if (type === 'faq') {
       title = "Frequently Asked Questions: API Gateway throttling rules";
       content = `<h2>API Throttling Guidelines</h2><h3>Q: What is the default rate threshold?</h3><p>We restrict API endpoints to 150 requests per minute under standard licenses to guarantee optimal latency speeds.</p><h3>Q: How do I handle 429 response buffers?</h3><p>Check the Retry-After header mapping to configure progressive backoff delays automatically.</p>`;
    } else if (type === 'troubleshooting') {
       title = "Remediation Playbook: Azure AD SSO SAML invalid handshake";
       content = `<h2>Azure Active Directory Token Mismatch Remediation</h2><p>This playbook targets common security certificate mismatches occurring on corporate SSO nodes.</p><h3>Remediation Method</h3><p>Verify that your SAML sign-on certificate metadata fingerprint is registered inside GeistDesk settings.</p>`;
    }

    let i = 0;
    const interval = setInterval(() => {
      if (i < content.length) {
        setAiOutputStream(prev => prev + content.substr(i, 8));
        i += 8;
      } else {
        clearInterval(interval);
        setIsGeneratingAI(false);
        // Pre-fill editor values
        setNewArticle({
          title: title,
          content: content,
          category: selectedCategory,
          subCategory: 'Workspace Setup',
          visibility: 'Public',
          tags: ["ai-drafted", "automated"],
          owner: 'Sarah James',
          reviewer: 'Mike Chen',
          lastEditor: 'Gemini Assistant',
          status: 'AI Generated',
          avgReadTime: '2m 15s'
        });
        setTagInput('ai-drafted, automated');
        toast.success("AI generated content loaded directly into document buffer!");
      }
    }, 30);
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

  // KPI Dashboard calculator
  const filteredCategoryArticles = articles.filter(a => a.category === selectedCategory);
  
  const totalArticlesInCategory = filteredCategoryArticles.length;
  const totalViewsInCategory = filteredCategoryArticles.reduce((acc, obj) => acc + (obj.views || 0), 0);
  const helpRatingInCategory = filteredCategoryArticles.length > 0 
    ? Math.round((filteredCategoryArticles.reduce((acc, obj) => acc + (obj.helpfulCount || 0), 0) / 
    Math.max(1, filteredCategoryArticles.reduce((acc, obj) => acc + (obj.helpfulCount || 0) + (obj.unhelpfulCount || 0), 0))) * 100) 
    : 92;

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

  const processedArticles = withConfidence.filter((art) => {
    // 1. Category check
    if (art.category !== selectedCategory) return false;

    // 2. Tab Filter check (Active workflows mapping)
    if (activeSubTab === 'Published' && art.status !== 'Published') return false;
    if (activeSubTab === 'Drafts' && art.status !== 'Draft') return false;
    if (activeSubTab === 'Needs Review' && art.status !== 'Needs Review') return false;
    if (activeSubTab === 'Archived' && art.status !== 'Archived') return false;
    if (activeSubTab === 'Outdated' && art.status !== 'Outdated') return false;
    if (activeSubTab === 'Internal Only' && art.visibility !== 'Private') return false;

    // 3. Custom selectors
    if (filterOwner !== 'All' && art.owner !== filterOwner) return false;
    if (filterVisibility !== 'All' && art.visibility !== filterVisibility) return false;
    if (filterLanguage !== 'All' && art.language !== filterLanguage) return false;
    if (filterTag !== 'All' && !(art.tags && art.tags.includes(filterTag))) return false;

    // 4. Search query parsing
    if (searchNormalized) {
      const titleMatch = art.title?.toLowerCase().includes(searchNormalized);
      const contentMatch = art.content?.toLowerCase().includes(searchNormalized);
      const categoryMatch = art.category?.toLowerCase().includes(searchNormalized);
      const ownerMatch = art.owner?.toLowerCase().includes(searchNormalized);
      const tagMatch = art.tags?.some((t: string) => t.toLowerCase().includes(searchNormalized));
      return titleMatch || contentMatch || categoryMatch || ownerMatch || tagMatch;
    }

    return true;
  });

  // Sort articles according to the select state
  processedArticles.sort((a, b) => {
    if (sortBy === 'confidence') {
      return (b.trustScore || 0) - (a.trustScore || 0);
    } else if (sortBy === 'views') {
      return (b.views || 0) - (a.views || 0);
    } else {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
      return dateB.getTime() - dateA.getTime();
    }
  });

  // Calculate distinct stats for left sidebar widget
  const publishedCount = articles.filter(a => a.status === 'Published').length;
  const draftCount = articles.filter(a => a.status === 'Draft').length;
  const needsReviewCount = articles.filter(a => a.status === 'Needs Review' || a.status === 'Under Revision').length;
  const outdatedCount = articles.filter(a => a.status === 'Outdated').length;
  const archivedCount = articles.filter(a => a.status === 'Archived').length;
  const totalLibraryCount = articles.length;
  const knowledgeCoveragePct = 94; // Custom ML metric

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

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-slate-50 overflow-hidden text-slate-800 font-sans">
      
      {/* ======================================================== */}
      {/* COLUMN 1: LEFT SIDEBAR - KNOWLEDGE STRUCTURE            */}
      {/* ======================================================== */}
      <aside className="w-full lg:w-[320px] bg-white border-r border-slate-200/80 p-5 flex flex-col shrink-0 overflow-y-auto custom-scroll space-y-6">

        {/* AI Knowledge Coverage Map CTA */}
        <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-[1.25rem] space-y-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
            <h3 className="text-[9px] font-black uppercase text-slate-400 tracking-wider">AI Quality Auditing</h3>
          </div>
          <button
            onClick={() => {
              if (viewMode === 'coverage') {
                setViewMode('standard');
              } else {
                setViewMode('coverage');
                fetchCoverageData();
              }
            }}
            className={cn(
              "w-full flex items-center justify-between px-3.5 py-3 rounded-xl border text-xs font-black transition-all hover:scale-[1.01] active:scale-95 cursor-pointer",
              viewMode === 'coverage'
                ? "bg-indigo-600 border-indigo-650 text-white shadow-md shadow-indigo-600/10"
                : "bg-white border-slate-200/80 text-indigo-950 hover:bg-slate-50"
            )}
          >
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>AI Coverage Map</span>
            </div>
            {viewMode === 'coverage' ? (
              <ChevronRight className="w-3.5 h-3.5 text-white" />
            ) : (
              <Badge className="bg-indigo-50 text-indigo-600 hover:bg-indigo-50 border-none px-1 text-[8px] font-black h-4.5">AI Engine</Badge>
            )}
          </button>

          {/* Ticket-to-Knowledge Autopilot Button */}
          <button
            onClick={() => {
              if (viewMode === 'autopilot') {
                setViewMode('standard');
              } else {
                setViewMode('autopilot');
              }
            }}
            className={cn(
              "w-full flex items-center justify-between px-3.5 py-3 rounded-xl border text-xs font-black transition-all hover:scale-[1.01] active:scale-95 cursor-pointer",
              viewMode === 'autopilot'
                ? "bg-indigo-600 border-indigo-650 text-white shadow-md shadow-indigo-650/10"
                : "bg-white border-slate-200/80 text-indigo-950 hover:bg-slate-50"
            )}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500 shrink-0 select-none" />
              <span>KB Autopilot</span>
            </div>
            {viewMode === 'autopilot' ? (
              <ChevronRight className="w-3.5 h-3.5 text-white" />
            ) : (
              <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border-none px-1.5 text-[8px] font-black h-4.5">Active</Badge>
            )}
          </button>
        </div>

        {/* Knowledge Structure Categories Section */}
        <div>
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-indigo-500" />
              <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{t('kb.structure', 'Knowledge Structure')}</h2>
            </div>
            <button 
              onClick={() => setIsAddingCategory(true)}
              className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-all"
              title={t('kb.addCategoryTooltip', 'Add Enterprise Category Parent/Child')}
            >
              <PlusCircle className="w-4 h-4" />
            </button>
          </div>

          <nav className="space-y-1">
            {categories.map((cat, i) => {
              const catArticles = articles.filter(a => a.category === cat.name);
              const drafts = catArticles.filter(a => a.status === 'Draft').length;
              const pendingReviews = catArticles.filter(a => a.status === 'Needs Review' || a.status === 'Under Revision').length;
              const catKey = cat.name.replace(/\s+/g, '_').toLowerCase();
              
              return (
                <div key={i} className="group relative">
                  <button 
                    onClick={() => {
                      setSelectedCategory(cat.name);
                      setViewingArticle(null);
                    }}
                    className={cn(
                      "w-full flex flex-col gap-1.5 px-3 py-3 rounded-xl text-left transition-all relative border",
                      selectedCategory === cat.name 
                        ? "bg-indigo-50/80 text-indigo-950 border-indigo-100 shadow-sm" 
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "p-1.5 rounded-lg border",
                          selectedCategory === cat.name 
                            ? "bg-white text-indigo-600 border-indigo-100 shadow-sm" 
                            : "bg-slate-100 text-slate-400 group-hover:text-slate-600 border-transparent"
                        )}>
                          <cat.icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold tracking-tight">{t(`kb.categories.${catKey}.name`, cat.name)}</span>
                      </div>
                      
                      <Badge variant="outline" className="text-[10px] font-extrabold bg-slate-50 text-slate-500 border-none px-2 py-0">
                         {catArticles.length}
                      </Badge>
                    </div>

                    {/* Subcategories visual breadcrumb count footer */}
                    <div className="flex items-center justify-between text-[9px] text-slate-400 ml-8 font-semibold">
                      <span>{t(`kb.categories.${catKey}.subCategory`, cat.subCategory || 'General Node')}</span>
                      <div className="flex gap-2">
                        {drafts > 0 && <span className="text-amber-500">{drafts}D</span>}
                        {pendingReviews > 0 && <span className="text-blue-500">{pendingReviews}R</span>}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Content Health Widget */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-[16px] p-4 space-y-3 shadow-none">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-500" /> {t('kb.contentHealth', 'Content Health')}
            </h3>
            <Badge className="bg-emerald-500/10 text-emerald-700 font-extrabold border-none text-[8px] h-4.5 px-1.5">
              {t('kb.scoreLabel', 'SCORE: 92/100')}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-600">
            <div className="bg-white border p-2 rounded-xl flex flex-col">
              <span className="text-slate-400 text-[9px] uppercase">{t('kb.published', 'Published')}</span>
              <span className="text-xs font-black text-slate-800">{publishedCount} {t('kb.articlesLabel', 'Articles')}</span>
            </div>
            <div className="bg-white border p-2 rounded-xl flex flex-col">
              <span className="text-slate-400 text-[9px] uppercase">{t('kb.draftsPool', 'Drafts Pool')}</span>
              <span className="text-xs font-black text-slate-800">{draftCount} {t('kb.pendingLabel', 'Pending')}</span>
            </div>
            <div className="bg-white border p-2 rounded-xl flex flex-col">
              <span className="text-slate-400 text-[9px] uppercase">{t('kb.needsReview', 'Needs Review')}</span>
              <span className="text-xs font-black text-slate-800">{needsReviewCount} {t('kb.queueLabel', 'Queue')}</span>
            </div>
            <div className="bg-white border p-2 rounded-xl flex flex-col">
              <span className="text-slate-400 text-[9px] uppercase">{t('kb.outdatedArc', 'Outdated / Arc')}</span>
              <span className="text-xs font-black text-slate-800">{outdatedCount + archivedCount} {t('kb.filesLabel', 'Files')}</span>
            </div>
          </div>

          <div className="pt-2">
            <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
              <span>{t('kb.knowledgeCoverage', 'Knowledge Coverage')}</span>
              <span>{knowledgeCoveragePct}%</span>
            </div>
            <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
               <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${knowledgeCoveragePct}%` }} />
            </div>
          </div>
        </div>

        {/* AI Knowledge Assistant persistent sidebar */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-[16px] p-4.5 space-y-3.5 relative overflow-hidden shadow-md">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[30px] rounded-full -mr-16 -mt-16" />
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h3 className="text-[12px] font-bold uppercase tracking-wider text-indigo-200">{t('kb.aiAssistant', 'AI ASSISTANT')}</h3>
            </div>
            <Badge className="bg-indigo-500/25 text-indigo-300 border border-indigo-400/30 text-[8px] font-extrabold uppercase tracking-widest px-1.5 h-4.5">{t('kb.geistLlm', 'GEIST-LLM')}</Badge>
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed font-medium relative z-10">{t('kb.aiAssistantDesc', 'Optimize libraries, generate SOP handbooks, merge duplicates, or scan content security.')}</p>
          
          <div className="space-y-1 relative z-10 text-[11px] font-bold text-slate-200">
            <button 
              onClick={() => simulateAIGeneration('vpn-ticket')}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-all text-left text-indigo-200 hover:text-white"
            >
              <Ticket className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t('kb.generateFromTickets', 'Generate From Tickets')}</span>
            </button>
            <button 
              onClick={() => simulateAIGeneration('faq')}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-all text-left text-indigo-200 hover:text-white"
            >
              <FileQuestion className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t('kb.suggestMissingArticles', 'Suggest Missing Articles')}</span>
            </button>
            <button 
              onClick={() => simulateAIGeneration('troubleshooting')}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-all text-left text-indigo-200 hover:text-white"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t('kb.findContentGaps', 'Find Content Gaps')}</span>
            </button>
            <button 
              onClick={() => {
                toast.info("AI scanned database. Found duplicate: 'Inviting and Managing Team Members' and 'Onboard Agents SOP'. Triggered auto-merge protocols.");
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-all text-left text-indigo-200 hover:text-white"
            >
              <Split className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t('kb.mergeDuplicateArticles', 'Merge Duplicate Articles')}</span>
            </button>
            <button 
              onClick={() => simulateAIGeneration('sop')}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-all text-left text-indigo-200 hover:text-white"
            >
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t('kb.generateSopDocument', 'Generate SOP Document')}</span>
            </button>
          </div>
        </div>

        {/* COLLAPSIBLE REGION: AI CONTENT CENTER */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-3xs">
          <button 
            onClick={() => setIsAiContentCenterOpen(!isAiContentCenterOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100/85 transition-all font-black text-slate-700 text-xs text-left cursor-pointer"
          >
            <span className="flex items-center gap-1.5 uppercase tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" /> 
              {t('kb.aiContentCenter', 'AI CONTENT CENTER')}
            </span>
            <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-200", isAiContentCenterOpen && "rotate-180")} />
          </button>
          {isAiContentCenterOpen && (
            <div className="p-4 space-y-3 border-t border-slate-150 text-xs animate-in slide-in-from-top-1 duration-150 bg-slate-50/20">
              <div className="p-3 bg-white border border-slate-150 rounded-xl space-y-1.5 shadow-2xs hover:border-slate-350 transition-all">
                <div className="flex justify-between items-center text-[10px] uppercase font-black text-slate-400">
                  <span>{t('kb.ticketExtractionQueue', 'Ticket extraction queue')}</span>
                  <Badge className="bg-red-50 text-red-600 px-1 hover:bg-red-50 border-none h-4 text-[8px] font-extrabold">{t('kb.solvedLabel', '{{count}} solved').replace('{{count}}', '43')}</Badge>
                </div>
                <p className="font-extrabold text-[#1E293B] leading-tight text-[11px]">{t('kb.ticketExtractionDesc', '43 tickets solved for Enterprise VPN Tunnel issue.')}</p>
                <button 
                  onClick={() => simulateAIGeneration('vpn-ticket')}
                  className="text-[10px] uppercase font-black text-indigo-650 hover:text-indigo-800 flex items-center gap-1 mt-1 text-left"
                >
                  {t('kb.draftTroubleshooting', 'Draft Troubleshooting Article ›')}
                </button>
              </div>

              <div className="p-3 bg-white border border-slate-150 rounded-xl space-y-1.5 shadow-2xs hover:border-slate-350 transition-all animate-in zoom-in-95">
                <div className="flex justify-between items-center text-[10px] uppercase font-black text-slate-400">
                  <span>{t('kb.missingGapsIdentified', 'Missing gaps identified')}</span>
                  <Badge className="bg-amber-50 text-amber-600 px-1 border-none h-4 text-[8px] font-extrabold">{t('kb.queriesLabel', '{{count}} queries').replace('{{count}}', '18')}</Badge>
                </div>
                <p className="font-extrabold text-[#1E293B] leading-tight text-[11px]">{t('kb.missingGapsDesc', 'Outlook calendar sync validation failures.')}</p>
                <button 
                  onClick={() => simulateAIGeneration('faq')}
                  className="text-[10px] uppercase font-black text-indigo-650 hover:text-indigo-800 flex items-center gap-1 mt-1 text-left"
                >
                  {t('kb.autoGenerateFaq', 'Auto-Generate FAQ Guide ›')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* COLLAPSIBLE REGION: ELITE ARTICLES */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-3xs">
          <button 
            onClick={() => setIsEliteArticlesOpen(!isEliteArticlesOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100/85 transition-all font-black text-slate-700 text-xs text-left cursor-pointer"
          >
            <span className="flex items-center gap-1.5 uppercase tracking-wide">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
              {t('kb.eliteArticles', 'Elite Articles')}
            </span>
            <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-200", isEliteArticlesOpen && "rotate-180")} />
          </button>
          {isEliteArticlesOpen && (
            <div className="p-4 space-y-3 border-t border-slate-150 text-xs animate-in slide-in-from-top-1 duration-150 bg-slate-50/20">
              <div className="space-y-3">
                {articles.slice(0, 3).map((art, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs font-semibold text-slate-700 gap-2">
                    <div className="space-y-0.5 max-w-[150px]">
                      <span className="font-black text-slate-800 line-clamp-1 hover:text-indigo-600 cursor-pointer text-xs block" onClick={() => setViewingArticle(art)}>
                        {art.title}
                      </span>
                      <div className="flex gap-1.5 text-[9px] text-slate-400">
                        <span className="flex items-center gap-0.5 text-slate-500"><Eye className="w-2.5 h-2.5" /> {art.views}</span>
                        <span className="text-emerald-650 font-black">&#10003; 96%</span>
                      </div>
                    </div>

                    {/* SVG mini trend sparkline */}
                    <svg className="w-10 h-5 text-emerald-500 stroke-2 overflow-visible shrink-0" fill="none" viewBox="0 0 100 100">
                      <path 
                        d={idx === 0 ? "M 0 80 Q 25 30 50 50 T 100 20" : idx === 1 ? "M 0 60 Q 25 70 50 30 T 100 10" : "M 0 90 Q 25 40 50 60 T 100 15"} 
                        stroke="currentColor" 
                      />
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* COLLAPSIBLE REGION: RELATIONSHIP GRAPH 2.0 */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-3xs">
          <button 
            onClick={() => setIsGraphOpen(!isGraphOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100/85 transition-all font-black text-slate-700 text-xs text-left cursor-pointer"
          >
            <span className="flex items-center gap-1.5 uppercase tracking-wide">
              <Network className="w-3.5 h-3.5 text-indigo-500" />
              {t('kb.knowledgeRelationshipsGraph', 'Knowledge Graph 2.0')}
            </span>
            <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-200", isGraphOpen && "rotate-180")} />
          </button>
          {isGraphOpen && (
            <div className="p-4 border-t border-slate-150 animate-in slide-in-from-top-1 duration-150 bg-slate-50/20">
              <AIRelationshipGraph2 
                currentArticle={viewingArticle}
                onSelectArticle={handleSelectArticleByTitle}
                miniMode={true}
              />
            </div>
          )}
        </div>

        {/* COLLAPSIBLE REGION: TAGS CLOUD */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-3xs">
          <button 
            onClick={() => setIsTagsOpen(!isTagsOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100/85 transition-all font-black text-slate-700 text-xs text-left cursor-pointer"
          >
            <span className="flex items-center gap-1.5 uppercase tracking-wide">
              <Tag className="w-3.5 h-3.5" />
              {t('kb.tagsAndMetadataWeights', 'Tags Cloud')}
            </span>
            <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-200", isTagsOpen && "rotate-180")} />
          </button>
          {isTagsOpen && (
            <div className="p-4 border-t border-slate-150 animate-in slide-in-from-top-1 duration-150 bg-slate-50/20">
              <div className="flex flex-wrap gap-1.5">
                {Array.from(new Set(articles.flatMap(a => a.tags || []))).map((t: any, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSearchQuery(t);
                      toast.success(`Filter switched mapping tag #${t}`);
                    }}
                    className="text-[10.5px] font-black text-slate-600 hover:text-indigo-600 bg-white hover:bg-slate-100 px-2.5 py-1 rounded-lg border flex items-center gap-1 leading-none shadow-3xs text-left cursor-pointer"
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* COLLAPSIBLE REGION: AUDIT LOG & RECENT CHANGES */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-3xs">
          <button 
            onClick={() => setIsAuditLogOpen(!isAuditLogOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100/85 transition-all font-black text-slate-700 text-xs text-left cursor-pointer"
          >
            <span className="flex items-center gap-1.5 uppercase tracking-wide">
              <History className="w-3.5 h-3.5 text-indigo-500" />
              {t('kb.auditLog', 'Audit log & recent changes')}
            </span>
            <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-200", isAuditLogOpen && "rotate-180")} />
          </button>
          {isAuditLogOpen && (
            <div className="p-4 space-y-3.5 border-t border-slate-150 text-xs animate-in slide-in-from-top-1 duration-150 bg-slate-50/20">
               <div className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div className="flex flex-col">
                     <strong className="text-slate-700">{t('kb.audit.sarah_updated', 'Sarah James updated "Getting Started Docs"')}</strong>
                     <span className="text-[10px] text-slate-400 font-bold">{t('kb.audit.sarah_meta', '2 hours ago • Verified SOC2 Audit logs')}</span>
                  </div>
               </div>
               
               <div className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <div className="flex flex-col">
                     <strong className="text-slate-700">{t('kb.audit.anna_rotated', 'Anna Bell rotated Bearer Token specifications')}</strong>
                     <span className="text-[10px] text-slate-400 font-bold">{t('kb.audit.anna_meta', 'Yesterday • API Authentication')}</span>
                  </div>
               </div>

               <div className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <div className="flex flex-col">
                     <strong className="text-slate-700">{t('kb.audit.will_submitted', 'Will Coyote submitted "MFA playbooks" for review')}</strong>
                     <span className="text-[10px] text-slate-400 font-bold">{t('kb.audit.will_meta', 'In Draft pool queue • MFA Debugging')}</span>
                  </div>
               </div>
            </div>
          )}
        </div>

      </aside>

      {/* ======================================================== */}
      {/* COLUMN 2: CENTER WORKSPACE - CONTENT MANAGEMENT          */}
      {/* ======================================================== */}
      <section className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC] overflow-y-auto custom-scroll">
        
        {/* VIEWING ARTICLE DETAILED VIEW PANEL */}
        {viewMode === 'coverage' ? (
          renderCoverageDashboard()
        ) : viewMode === 'autopilot' ? (
          <KBAutopilotDashboard 
            onBackToKB={() => setViewMode('standard')} 
            onArticlePublished={() => setViewMode('standard')}
          />
        ) : viewingArticle ? (
          <div className="flex-1 bg-white flex flex-col animate-in fade-in duration-250">
            {/* Header / Breadcrumb navigation */}
            <div className="px-8 pt-8 pb-4 border-b border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => {
                    setViewingArticle(null);
                    setActiveReadingLanguage('English');
                  }}
                  className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Category List</span>
                </button>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-emerald-100 bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5">
                    {viewingArticle.status}
                  </Badge>
                  <Badge className="bg-slate-150 text-slate-600 border-none px-2 py-0.5 font-bold uppercase tracking-widest text-[9px]">
                    {viewingArticle.visibility}
                  </Badge>
                  {viewingArticle.language !== 'English' && (
                    <Badge variant="outline" className="bg-indigo-50 border-indigo-150 text-indigo-600 px-2 py-0.5 text-[9px]">
                       {viewingArticle.language}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <span className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400">{viewingArticle.category} &rsaquo; {viewingArticle.subCategory || 'Workspace Setup'}</span>
                  <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-tight mt-1">
                    {getLocalizedTitle(viewingArticle, activeReadingLanguage)}
                  </h1>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="h-9 px-4 rounded-xl border-slate-200 hover:border-slate-300 font-bold text-xs gap-1.5"
                    onClick={() => handleEditArticle(viewingArticle)}
                  >
                    <PenLine className="w-3.5 h-3.5" />
                    Edit Draft
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-9 px-3 rounded-xl border-slate-200"
                    onClick={() => handleCopyUrl(viewingArticle.title)}
                  >
                    <Copy className="w-4 h-4 text-slate-400" />
                  </Button>
                  <Button 
                    variant="outline"
                    className="h-9 px-3 rounded-xl border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-100"
                    onClick={() => {
                      handleDeleteArticle(viewingArticle.id);
                      setViewingArticle(null);
                    }}
                  >
                     <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Ownership system metadata info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2 text-xs font-semibold text-slate-600 border-t border-slate-100/60 mt-4 pt-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-[10px] text-indigo-600 shadow-xs">
                     {viewingArticle.owner ? viewingArticle.owner.charAt(0) : 'O'}
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[9px] uppercase tracking-wider text-slate-400">Owner</span>
                     <span className="text-slate-700">{viewingArticle.owner || 'Unassigned'}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <User className="w-4.5 h-4.5 text-slate-300" />
                  <div className="flex flex-col">
                     <span className="text-[9px] uppercase tracking-wider text-slate-400">Reviewer Assign</span>
                     <span className="text-slate-700">{viewingArticle.reviewer || 'Mike Chen'}</span>
                  </div>
                </div>

                <div className="flex flex-col">
                   <span className="text-[9px] uppercase tracking-wider text-slate-400">Last Revised</span>
                   <span className="text-slate-700 flex items-center gap-1.5 mt-0.5 font-bold">
                     <History className="w-3 h-3 text-slate-400" /> {viewingArticle.updatedAt?.toDate ? viewingArticle.updatedAt.toDate().toLocaleDateString() : 'Yesterday'}
                   </span>
                </div>

                <div className="flex flex-col">
                   <span className="text-[9px] uppercase tracking-wider text-slate-400">Review Due</span>
                   <span className="text-amber-600 flex items-center gap-1.5 mt-0.5 font-bold">
                     <ClockIcon className="w-3 h-3 text-amber-500" /> {viewingArticle.reviewDueDate || '2026-11-01'}
                   </span>
                </div>
              </div>

               {/* Multi-lingual localization selections */}
               <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 mt-1.5">
                  <span className="text-[10px] uppercase font-black text-slate-400 mr-2 flex items-center gap-1">
                     <Languages className="w-3 h-3 text-indigo-500" /> Translate Article:
                  </span>
                  {['English', 'German', 'French', 'Spanish', 'Japanese'].map((lang, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleTranslateArticle(lang)}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all",
                        activeReadingLanguage === lang
                          ? "bg-indigo-600 text-white border-indigo-650"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {lang}
                    </button>
                  ))}
                  {isTranslating && (
                    <span className="text-[10px] text-slate-400 animate-pulse ml-2 font-semibold">Regen translation...</span>
                  )}
               </div>

            </div>

            {/* Split Column Layout for content mapping + Trust Score */}
            <div className="flex-1 px-8 py-6 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Read Canvas & Helpful Feed */}
              <div className="lg:col-span-7 space-y-8">
                <div className="prose prose-indigo max-w-none prose-h2:text-lg prose-h2:font-black prose-p:text-slate-600 prose-p:leading-relaxed text-sm bg-white p-6 rounded-2xl border border-slate-100">
                  <div dangerouslySetInnerHTML={{ __html: getLocalizedContent(viewingArticle, activeReadingLanguage) }} />
                </div>

                {/* Was This Helpful Interactive Feed */}
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                   <div>
                     <h4 className="text-xs font-black text-slate-800 uppercase">Was this technical documentation helpful?</h4>
                     <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Your responses directly compute real-time confidence scores and update models.</p>
                   </div>
                   <div className="flex gap-2 shrink-0">
                      <Button 
                        variant="outline" 
                        className="bg-white hover:bg-emerald-50 hover:text-emerald-700 h-9 rounded-xl font-bold text-xs gap-1.5 border-slate-200"
                        onClick={async () => {
                          const updatedHelpful = (viewingArticle.helpfulCount || 0) + 1;
                          await kbService.updateArticle(viewingArticle.id, {
                            helpfulCount: updatedHelpful
                          });
                          
                          try {
                            const trust = await trustScoreService.getTrustScore(viewingArticle.id, viewingArticle);
                            const updatedInputs = {
                              ...trust.inputs,
                              helpfulCount: updatedHelpful
                            };
                            await trustScoreService.updateTrustScore(viewingArticle.id, updatedInputs, trust.score, trust.history);
                          } catch (e) {
                            console.warn("Could not save trust score logs:", e);
                          }

                          // Trigger local state updates
                          setArticles(prev => prev.map(a => a.id === viewingArticle.id ? { ...a, helpfulCount: updatedHelpful } : a));
                          toast.success("Thank you! Positive rating logged. Article Freshness metric computed.");
                        }}
                      >
                         <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />
                         <span>Yes ({viewingArticle.helpfulCount || 0})</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="bg-white hover:bg-rose-50 hover:text-rose-700 h-9 rounded-xl font-bold text-xs gap-1.5 border-slate-200"
                        onClick={async () => {
                          const updatedUnhelpful = (viewingArticle.unhelpfulCount || 0) + 1;
                          await kbService.updateArticle(viewingArticle.id, {
                            unhelpfulCount: updatedUnhelpful
                          });

                          try {
                            const trust = await trustScoreService.getTrustScore(viewingArticle.id, viewingArticle);
                            const updatedInputs = {
                              ...trust.inputs,
                              unhelpfulCount: updatedUnhelpful
                            };
                            await trustScoreService.updateTrustScore(viewingArticle.id, updatedInputs, trust.score, trust.history);
                          } catch (e) {
                            console.warn("Could not save trust score logs:", e);
                          }

                          // Trigger local state updates
                          setArticles(prev => prev.map(a => a.id === viewingArticle.id ? { ...a, unhelpfulCount: updatedUnhelpful } : a));
                          toast.success("Negative feedback annotated. Confidence metrics adjusted.");
                        }}
                      >
                         <ThumbsDown className="w-3.5 h-3.5 text-rose-500 rotate-180" />
                         <span>No ({viewingArticle.unhelpfulCount || 0})</span>
                      </Button>
                   </div>
                </div>
              </div>

              {/* Right Column: Real-time Trust Score Dashboard panel */}
              <div className="lg:col-span-5 space-y-6">
                <KBArticleTrustPanel 
                  article={viewingArticle} 
                  onScoreUpdated={(newScore) => {
                    // Update trust score in local state arrays
                    setArticles(prev => prev.map(a => a.id === viewingArticle.id ? { ...a, trustScore: newScore } : a));
                    setViewingArticle(prev => prev ? { ...prev, trustScore: newScore } : null);
                  }}
                />
              </div>

            </div>
          </div>
        ) : (
          <>
            <ModulePageHeader
              title={t('kb.title', 'GeistKB Knowledge Base')}
              description={t(`kb.categories.${selectedCategory.replace(/\s+/g, '_').toLowerCase()}.desc`, categories.find(c => c.name === selectedCategory)?.desc || t('kb.structure', 'Manage technical articles, FAQs, and operating procedure playbooks.'))}
              trailing={
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/60">
                  <button type="button" onClick={() => setViewLayout('table')} className={cn('p-1.5 rounded-md transition-colors', viewLayout === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400')} aria-label="Table view">
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setViewLayout('card')} className={cn('p-1.5 rounded-md transition-colors', viewLayout === 'card' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400')} aria-label="Card view">
                    <LayoutGrid className="w-4 h-4 rotate-90" />
                  </button>
                  <button type="button" onClick={() => setViewLayout('tree')} className={cn('p-1.5 rounded-md transition-colors', viewLayout === 'tree' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400')} aria-label="Tree view">
                    <GitBranch className="w-4 h-4" />
                  </button>
                </div>
              }
            />
            <ModulePageTabs
              tabs={[
                { id: 'All', label: t('common.statusAll', 'All') },
                { id: 'Published', label: t('kb.published', 'Published') },
                { id: 'Drafts', label: t('kb.drafts', 'Drafts') },
                { id: 'Needs Review', label: t('kb.needsReview', 'Needs Review') },
                { id: 'Outdated', label: t('kb.outdated', 'Outdated') },
                { id: 'Internal Only', label: t('kb.internalOnly', 'Internal Only') },
              ]}
              activeId={activeSubTab}
              onChange={setActiveSubTab}
            />
            <ModuleKpiGrid
              items={[
                { id: 'articles', label: t('kb.articlesNode', 'Articles'), value: totalArticlesInCategory },
                { id: 'views', label: t('kb.totalViews', 'Total views'), value: totalViewsInCategory, hint: '+18%' },
                { id: 'helpful', label: t('kb.helpfulScore', 'Helpful score'), value: `${helpRatingInCategory}%` },
                { id: 'read', label: t('kb.avgReadTime', 'Avg read time'), value: '3m 24s' },
                { id: 'searches', label: t('kb.relatedSearches', 'Related searches'), value: totalArticlesInCategory > 0 ? 134 : 0 },
                { id: 'gaps', label: t('kb.unansweredGaps', 'Unanswered gaps'), value: totalArticlesInCategory > 3 ? 3 : 1 },
              ]}
            />
            <ModuleToolbar
              searchPlaceholder={t('kb.searchPlaceholderAdvanced', 'Search articles, tags, topics...')}
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              filtersSlot={
                <div className="hidden lg:flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <select value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)} className="h-9 text-xs border border-slate-200/80 rounded-lg px-2 bg-slate-50/80">
                    <option value="All">{t('kb.allOwners', 'All owners')}</option>
                    {Array.from(new Set(articles.map(a => a.owner).filter(Boolean))).map((ownerName: string, idx) => (
                      <option key={idx} value={ownerName}>{ownerName}</option>
                    ))}
                  </select>
                  <select value={filterVisibility} onChange={(e) => setFilterVisibility(e.target.value)} className="h-9 text-xs border border-slate-200/80 rounded-lg px-2 bg-slate-50/80">
                    <option value="All">{t('kb.allAccess', 'All access')}</option>
                    <option value="Public">{t('kb.publicPortal', 'Public')}</option>
                    <option value="Private">{t('kb.internalSopsOnly', 'Internal')}</option>
                  </select>
                </div>
              }
              createAction={
                <ModuleCreateButton
                  ariaLabelKey="actions.createKBArticle"
                  ariaLabelDefault="Create GeistKB Article"
                  onClick={() => openCreateArticle()}
                />
              }
            />

            <div className="px-6 py-2 border-b bg-white text-[11px] font-medium text-slate-400">
              {t('kb.displayingCount', 'Displaying {{count}} matching entries').replace('{{count}}', String(processedArticles.length))}
            </div>

            {/* ARTICLES GRID CONTROL AREA */}
            <div className="p-6 max-w-7xl mx-auto w-full pb-32">
              
              {processedArticles.length === 0 ? (
                <div className="border border-slate-200/60 bg-white/60 rounded-[16px] p-12 text-center flex flex-col items-center justify-center space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center border text-slate-400 mb-1">
                     <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-700 uppercase text-sm">{t('kb.noArticlesMatched', 'No articles matched in active criteria')}</h3>
                    <p className="text-slate-400 text-xs mt-1">{t('kb.tryResetting', 'Try resetting the custom filters or matching another category.')}</p>
                  </div>
                  <Button 
                    className="bg-indigo-650 inline-flex items-center gap-1 h-9.5 text-xs text-white"
                    onClick={() => {
                      setFilterOwner('All');
                      setFilterVisibility('All');
                      setFilterTag('All');
                      setFilterLanguage('All');
                      setSearchQuery('');
                      setActiveSubTab('All');
                    }}
                  >
                     {t('kb.resetWorkspaceFilter', 'Reset Workspace Filter State')}
                  </Button>
                </div>
              ) : viewLayout === 'table' ? (
                
                /* ENTERPRISE TABLE DEFAULT VIEW */
                <div className="bg-white border border-slate-200/80 rounded-[16px] overflow-hidden shadow-xs">
                   <div className="overflow-x-auto">
                     <table className="w-full text-left text-xs border-collapse font-semibold">
                       <thead>
                         <tr className="bg-slate-50/80 border-b border-slate-150 text-[10px] uppercase font-black tracking-widest text-slate-400">
                            <th className="px-5 py-4">{t('kb.table.title', 'Title')}</th>
                            <th className="px-4 py-4">{t('kb.table.workflowStatus', 'Workflow Status')}</th>
                            <th className="px-4 py-4">Confidence</th>
                            <th className="px-4 py-4">{t('kb.table.metadataOwner', 'Metadata Owner')}</th>
                            <th className="px-4 py-4">{t('kb.table.author', 'Author')}</th>
                            <th className="px-4 py-4">{t('kb.table.views', 'Views')}</th>
                            <th className="px-4 py-4">{t('kb.table.helpfulRating', 'Helpful Rating')}</th>
                            <th className="px-4 py-4">{t('kb.table.updated', 'Updated')}</th>
                            <th className="px-5 py-4 text-right">{t('kb.table.actions', 'Actions')}</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 text-slate-700">
                         {processedArticles.map((art) => (
                           <tr 
                             key={art.id} 
                             onClick={() => setViewingArticle(art)}
                             className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                           >
                              <td className="px-5 py-3.5 max-w-[280px]">
                                <div className="space-y-1">
                                  <span className="font-black text-slate-900 group-hover:text-indigo-600 truncate block">
                                    {art.title}
                                  </span>
                                  {art.tags && art.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {art.tags.slice(0, 3).map((t: string, i: number) => (
                                        <span key={i} className="text-[9px] font-extrabold text-indigo-500 bg-indigo-50/50 border border-indigo-100/50 px-1 py-0.2 rounded-md">
                                          #{t}
                                        </span>
                                      ))}
                                      {art.tags.length > 3 && (
                                        <span className="text-[9px] font-black text-slate-400">+{art.tags.length - 3}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                              
                              <td className="px-4 py-3.5">
                                <Badge className={cn(
                                  "text-[10px] font-extrabold uppercase px-2 py-0 border-none rounded-lg",
                                  art.status === 'Published' && 'bg-emerald-500/10 text-emerald-700',
                                  art.status === 'Draft' && 'bg-amber-500/10 text-amber-700',
                                  art.status === 'Needs Review' && 'bg-blue-500/10 text-blue-700',
                                  art.status === 'Outdated' && 'bg-slate-300/15 text-slate-600',
                                  art.status === 'Archived' && 'bg-red-500/10 text-red-700',
                                  art.status === 'AI Generated' && 'bg-indigo-500/10 text-indigo-700',
                                  art.status === 'Under Revision' && 'bg-cyan-500/10 text-cyan-700'
                                )}>
                                  {art.status || 'Draft'}
                                </Badge>
                              </td>

                              <td className="px-4 py-3.5">
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-[10.5px] font-black tracking-tight border",
                                  art.trustScore >= 90 ? "bg-emerald-50 text-emerald-700 border-emerald-150" :
                                  art.trustScore >= 70 ? "bg-amber-50 text-amber-700 border-amber-150" :
                                  "bg-rose-50 text-rose-700 border-rose-150 animate-pulse"
                                )}>
                                  {art.trustScore}%
                                </span>
                              </td>

                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-5.5 h-5.5 rounded-full bg-slate-100 text-slate-600 text-[9px] font-bold border flex items-center justify-center">
                                    {art.owner ? art.owner.charAt(0) : 'O'}
                                  </div>
                                  <span className="text-slate-600 text-[11px] font-extrabold">{art.owner || 'Sarah James'}</span>
                                </div>
                              </td>

                              <td className="px-4 py-3.5 text-slate-400 text-[11px]">
                                Administrator
                              </td>

                              <td className="px-4 py-3.5 font-bold font-mono text-slate-600 text-[11px]">
                                {art.views || 0}
                              </td>

                              <td className="px-4 py-3.5 text-slate-600 font-bold">
                                <div className="flex items-center gap-1.5">
                                  <ThumbsUp className="w-3 h-3 text-emerald-500" />
                                  <span>
                                    {art.helpfulCount && (art.helpfulCount + art.unhelpfulCount) > 0
                                      ? `${Math.round((art.helpfulCount / (art.helpfulCount + art.unhelpfulCount)) * 100)}%`
                                      : '94%'}
                                  </span>
                                </div>
                              </td>

                              <td className="px-4 py-3.5 text-slate-400 text-[11px]">
                                {art.updatedAt?.toDate ? art.updatedAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'June 2'}
                              </td>

                              <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                <div className="flex justify-end items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                   <Button 
                                     variant="ghost" 
                                     size="icon" 
                                     className="h-8 w-8 text-indigo-650 hover:bg-slate-100"
                                     onClick={() => setViewingArticle(art)}
                                     title="View Article"
                                   >
                                      <Eye className="w-3.5 h-3.5" />
                                   </Button>
                                   <Button 
                                     variant="ghost" 
                                     size="icon" 
                                     className="h-8 w-8 text-amber-600 hover:bg-amber-50"
                                     onClick={() => handleEditArticle(art)}
                                     title="Edit"
                                   >
                                      <PenLine className="w-3.5 h-3.5" />
                                   </Button>
                                   <Button 
                                     variant="ghost" 
                                     size="icon" 
                                     className="h-8 w-8 text-emerald-600"
                                     onClick={() => handleDuplicateArticle(art)}
                                     title="Duplicate"
                                   >
                                      <Bookmark className="w-3.5 h-3.5" />
                                   </Button>
                                   <Button 
                                     variant="ghost" 
                                     size="icon" 
                                     className="h-8 w-8 text-[#E11D48] hover:bg-red-50"
                                     onClick={() => handleDeleteArticle(art.id)}
                                     title="Delete Article"
                                   >
                                      <Trash2 className="w-3.5 h-3.5" />
                                   </Button>
                                </div>
                              </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                </div>

              ) : viewLayout === 'card' ? (

                /* IMPROVED MODERN GRID CARD VIEW */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {processedArticles.map((art) => (
                     <div 
                       key={art.id}
                       onClick={() => setViewingArticle(art)}
                       className="border border-slate-200/80 hover:border-slate-300 rounded-[16px] p-5 bg-white flex flex-col justify-between hover:shadow-md transition-all h-[190px] cursor-pointer group"
                     >
                       <div className="space-y-2">
                         <div className="flex justify-between items-center">
                           <Badge variant="outline" className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50/50 border-none">
                              {art.subCategory || 'General Setup'}
                           </Badge>
                           <Badge className="bg-slate-100 text-slate-500 text-[8px] font-black tracking-widest leading-none px-1.5 h-4 border-none">
                              {art.status}
                           </Badge>
                         </div>
                         
                         <h3 className="font-extrabold text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors line-clamp-2">
                           {art.title}
                         </h3>
                         
                         <p className="text-[11.5px] text-slate-400 font-semibold line-clamp-2">
                            {stripHtml(art.content)}
                         </p>
                       </div>

                       <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                         <div className="flex items-center gap-2">
                           <div className="w-5.5 h-5.5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[9px]">
                             {art.owner ? art.owner.charAt(0) : 'S'}
                           </div>
                           <span className="text-[11px] text-slate-500 font-bold">{art.owner || 'Sarah James'}</span>
                         </div>

                         <div className="flex items-center gap-3 text-[10.5px] text-slate-400" onClick={(e) => e.stopPropagation()}>
                           <button 
                             onClick={() => handleCopyUrl(art.title)}
                             className="hover:text-indigo-600 transition-colors"
                           >
                             <Copy className="w-3.5 h-3.5" />
                           </button>
                           <button 
                             onClick={() => handleArchiveArticle(art.id)}
                             className="hover:text-slate-600"
                             title="Shift to Archive"
                           >
                             <History className="w-3.5 h-3.5" />
                           </button>
                         </div>
                       </div>
                     </div>
                   ))}
                </div>

              ) : (

                /* Collapsible Category Node Knowledge Tree View */
                <div className="space-y-4 bg-white border border-slate-200/80 rounded-[16px] p-6 shadow-xs">
                   <div className="border-b pb-3 mb-3">
                     <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Hierarchical Workspace Tree Map</span>
                   </div>

                   <div className="space-y-2 text-xs font-semibold text-slate-600">
                     <div className="flex items-center gap-1.5 p-2 bg-slate-100 text-slate-700 rounded-lg">
                        <Folder className="w-4 h-4 text-indigo-500" />
                        <span className="font-extrabold">{selectedCategory} Category Root</span>
                     </div>

                     <div className="pl-6 space-y-4 pt-1">
                        {/* Group articles per subcategory fold */}
                        {Array.from(new Set(processedArticles.map(a => a.subCategory || 'General Setup'))).map((subKey, sidx) => {
                          const subArticles = processedArticles.filter(a => (a.subCategory || 'General Setup') === subKey);
                          
                          return (
                            <div key={sidx} className="space-y-2">
                              <div className="flex items-center gap-2 text-slate-500">
                                 <PlusCircle className="w-3.5 h-3.5 text-slate-400" />
                                 <strong className="text-slate-700 text-[11px] tracking-wide font-black uppercase text-slate-500">{subKey} Folder</strong>
                                 <Badge className="bg-slate-100 text-slate-400 py-0 text-[9px] border-none">{subArticles.length} files</Badge>
                              </div>

                              <div className="pl-6 space-y-1.5 border-l-2 border-slate-100">
                                 {subArticles.map((art) => (
                                   <div 
                                     key={art.id} 
                                     onClick={() => setViewingArticle(art)}
                                     className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-all border border-transparent hover:border-slate-150"
                                   >
                                      <div className="flex items-center gap-2">
                                         <FileText className="w-3.5 h-3.5 text-indigo-400" />
                                         <span className="font-extrabold text-[#1E293B]">{art.title}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-[10px]" onClick={(e) => e.stopPropagation()}>
                                         <Badge className="bg-slate-50 text-slate-500 text-[9px] border-none">{art.status}</Badge>
                                         <button 
                                           onClick={() => handleEditArticle(art)}
                                           className="text-amber-500 hover:text-amber-700"
                                         >
                                            Edit
                                         </button>
                                      </div>
                                   </div>
                                 ))}
                              </div>
                            </div>
                          );
                        })}
                     </div>
                   </div>
                </div>

              )}

            </div>
          </>
        )}

      </section>

      {/* ======================================================== */}
      {/* COLUMN 3: RIGHT SIDEBAR - INSIGHTS & PERFORMANCE         */}
      {/* ======================================================== */}
      <aside className="hidden">
        
        {/* RECENTLY UPDATED TIMELINE METADATA */}
        <div className="space-y-3">
          <div className="pb-1 border-b">
             <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
               <History className="w-3.5 h-3.5" /> {t('kb.auditLog', 'Audit log & recent changes')}
             </h4>
          </div>

          <div className="space-y-3.5 text-xs">
             <div className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <div className="flex flex-col">
                   <strong className="text-slate-700">{t('kb.audit.sarah_updated', 'Sarah James updated "Getting Started Docs"')}</strong>
                   <span className="text-[10px] text-slate-400 font-bold">{t('kb.audit.sarah_meta', '2 hours ago • Verified SOC2 Audit logs')}</span>
                </div>
             </div>
             
             <div className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                <div className="flex flex-col">
                   <strong className="text-slate-700">{t('kb.audit.anna_rotated', 'Anna Bell rotated Bearer Token specifications')}</strong>
                   <span className="text-[10px] text-slate-400 font-bold">{t('kb.audit.anna_meta', 'Yesterday • API Authentication')}</span>
                </div>
             </div>

             <div className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <div className="flex flex-col">
                   <strong className="text-slate-700">{t('kb.audit.will_submitted', 'Will Coyote submitted "MFA playbooks" for review')}</strong>
                   <span className="text-[10px] text-slate-400 font-bold">{t('kb.audit.will_meta', 'In Draft pool queue • MFA Debugging')}</span>
                </div>
             </div>
          </div>
        </div>

        {/* OBSOLETE MERGED COMPONENT WRAPPER (HIDDEN) */}
        <div className="hidden">
        
        {/* TOP PERFORMING ARTICLES - WITH SPARKLINE SIMULATIONS */}
        <div className="space-y-3.5">
          <div className="flex justify-between items-center pb-2 border-b">
             <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
               <TrendingUp className="w-3.5 h-3.5 text-indigo-500" /> {t('kb.eliteArticles', 'Elite Articles')}
             </h4>
             <Badge className="border-none bg-indigo-50 text-indigo-600 font-black text-[9px]">LIVELOOP</Badge>
          </div>

          <div className="space-y-3">
             {articles.slice(0, 3).map((art, idx) => (
               <div key={idx} className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <div className="space-y-0.5 max-w-[200px]">
                     <span className="font-black text-slate-800 line-clamp-1 hover:text-indigo-600 cursor-pointer" onClick={() => setViewingArticle(art)}>
                       {art.title}
                     </span>
                     <div className="flex gap-2 text-[10px] text-slate-400">
                       <span className="flex items-center gap-1 text-slate-500"><Eye className="w-2.5 h-2.5" /> {art.views} views</span>
                       <span className="text-emerald-600 font-bold">&#10003; 96% helpful</span>
                     </div>
                  </div>

                  {/* SVG mini trend sparkline */}
                  <svg className="w-14 h-7 text-emerald-500 stroke-2 overflow-visible" fill="none" viewBox="0 0 100 100">
                     <path 
                       d={idx === 0 ? "M 0 80 Q 25 30 50 50 T 100 20" : idx === 1 ? "M 0 60 Q 25 70 50 30 T 100 10" : "M 0 90 Q 25 40 50 60 T 100 15"} 
                       stroke="currentColor" 
                     />
                  </svg>
               </div>
             ))}
          </div>
        </div>

        {/* AI CONTENT CENTER DISPATCH AND REMEDIATIONS */}
        <div className="bg-slate-50/60 p-4 border rounded-[16px] space-y-4">
           <div className="flex justify-between items-center text-[10.5px] font-black uppercase tracking-widest text-[#4F46E5] pb-2 border-b">
             <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" /> {t('kb.aiContentCenter', 'AI CONTENT CENTER')}</span>
           </div>

           {/* Generate from Tickets suggestion */}
           <div className="space-y-3 text-xs">
              
              <div className="p-3 bg-white border border-slate-150 rounded-xl space-y-1.5 shadow-2xs hover:border-slate-350 transition-all">
                 <div className="flex justify-between items-center text-[10px] uppercase font-black text-slate-400">
                    <span>{t('kb.ticketExtractionQueue', 'Ticket extraction queue')}</span>
                    <Badge className="bg-red-50 text-red-600 px-1 hover:bg-red-50 text-[8px] font-extrabold border-none h-4">{t('kb.solvedLabel', '{{count}} solved').replace('{{count}}', '43')}</Badge>
                 </div>
                 <p className="font-extrabold text-[#1E293B] leading-tight">{t('kb.ticketExtractionDesc', '43 tickets solved for Enterprise VPN Tunnel issue.')}</p>
                 <button 
                   onClick={() => simulateAIGeneration('vpn-ticket')}
                   className="text-[10px] uppercase font-black text-indigo-650 hover:text-indigo-800 flex items-center gap-1 mt-1"
                 >
                    {t('kb.draftTroubleshooting', 'Draft Troubleshooting Article ›')}
                 </button>
              </div>

              <div className="p-3 bg-white border border-slate-150 rounded-xl space-y-1.5 shadow-2xs hover:border-slate-350 transition-all animate-in zoom-in-95">
                 <div className="flex justify-between items-center text-[10px] uppercase font-black text-slate-400">
                    <span>{t('kb.missingGapsIdentified', 'Missing gaps identified')}</span>
                    <Badge className="bg-amber-50 text-amber-600 px-1 text-[8px] font-extrabold border-none h-4">{t('kb.queriesLabel', '{{count}} queries').replace('{{count}}', '18')}</Badge>
                 </div>
                 <p className="font-extrabold text-[#1E293B] leading-tight">{t('kb.missingGapsDesc', 'Outlook calendar sync validation failures.')}</p>
                 <button 
                   onClick={() => simulateAIGeneration('faq')}
                   className="text-[10px] uppercase font-black text-indigo-650 hover:text-indigo-800 flex items-center gap-1 mt-1"
                 >
                    {t('kb.autoGenerateFaq', 'Auto-Generate FAQ Guide ›')}
                 </button>
              </div>

           </div>
        </div>

        {/* KNOWLEDGE RELATIONSHIPS GRAPH 2.0 - D3-FORCE ENGINE */}
        <AIRelationshipGraph2 
          currentArticle={viewingArticle}
          onSelectArticle={handleSelectArticleByTitle}
          miniMode={true}
        />

        {/* RECENTLY UPDATED TIMELINE METADATA */}
        <div className="space-y-3">
          <div className="pb-1 border-b">
             <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
               <History className="w-3.5 h-3.5" /> {t('kb.auditLog', 'Audit log & recent changes')}
             </h4>
          </div>

          <div className="space-y-3.5 text-xs">
             <div className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <div className="flex flex-col">
                   <strong className="text-slate-700">{t('kb.audit.sarah_updated', 'Sarah James updated "Getting Started Docs"')}</strong>
                   <span className="text-[10px] text-slate-400 font-bold">{t('kb.audit.sarah_meta', '2 hours ago • Verified SOC2 Audit logs')}</span>
                </div>
             </div>
             
             <div className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                <div className="flex flex-col">
                   <strong className="text-slate-700">{t('kb.audit.anna_rotated', 'Anna Bell rotated Bearer Token specifications')}</strong>
                   <span className="text-[10px] text-slate-400 font-bold">{t('kb.audit.anna_meta', 'Yesterday • API Authentication')}</span>
                </div>
             </div>

             <div className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <div className="flex flex-col">
                   <strong className="text-slate-700">{t('kb.audit.will_submitted', 'Will Coyote submitted "MFA playbooks" for review')}</strong>
                   <span className="text-[10px] text-slate-400 font-bold">{t('kb.audit.will_meta', 'In Draft pool queue • MFA Debugging')}</span>
                </div>
             </div>
          </div>
        </div>

        {/* TAGS CLOUD MANAGEMENT PANEL */}
        <div className="space-y-3">
          <div className="pb-1 border-b">
             <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
               <Tag className="w-3.5 h-3.5" /> {t('kb.tagsAndMetadataWeights', 'Tags and metadata weights')}
             </h4>
          </div>

          <div className="flex flex-wrap gap-1.5">
             {Array.from(new Set(articles.flatMap(a => a.tags || []))).map((t: any, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                     setSearchQuery(t);
                     toast.success(`Filter switched mapping tag #${t}`);
                  }}
                  className="text-[10.5px] font-black text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200/65 px-2 py-1 rounded-lg border flex items-center gap-1 leading-none shadow-3xs"
                >
                   #{t}
                </button>
             ))}
          </div>
        </div>
        </div>

      </aside>

      {/* ======================================================== */}
      {/* ENTERPRISE EDITOR DIALOG MODAL                         */}
      {/* ======================================================== */}
      <Dialog open={isAddingArticle} onOpenChange={setIsAddingArticle}>
        <DialogContent className="max-w-6xl rounded-3xl p-0 h-[85vh] flex flex-col overflow-hidden border-none shadow-2xl">
          <div className="flex h-full flex-col lg:flex-row">
            
            {/* Editor Canvas Block */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
              <DialogHeader className="px-6 py-4.5 border-b shrink-0 flex flex-row items-center justify-between">
                <div>
                  <DialogTitle className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <PenLine className="w-4.5 h-4.5 text-indigo-500" />
                    {editingArticleId ? 'Revise Article Draft Payload' : 'Create Article Draft Payload'}
                  </DialogTitle>
                  <DialogDescription className="text-[11px] text-slate-400 font-semibold mt-0.5">
                    Authoring new guidelines for selected directory: <span className="text-indigo-600 font-bold">{selectedCategory}</span>
                  </DialogDescription>
                </div>
                <button onClick={() => setIsAddingArticle(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg border">
                   <X className="w-4 h-4" />
                </button>
              </DialogHeader>

              {/* Editor Workspace scrolling area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Title */}
                <div className="space-y-1">
                   <Label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Document Master Title</Label>
                   <Input 
                     value={newArticle.title}
                     onChange={(e) => setNewArticle({...newArticle, title: e.target.value})}
                     placeholder="Enter descriptive article title, e.g. AWS SMTP Relay failover protocol..."
                     className="h-11 text-md font-bold rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-150-all placeholder:text-slate-300"
                   />
                </div>

                {/* Nested Category allocation options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Category destination</Label>
                    <select 
                      value={newArticle.category}
                      onChange={(e) => setNewArticle({...newArticle, category: e.target.value})}
                      className="w-full h-11 border border-slate-200 rounded-xl px-3 text-xs bg-slate-50 font-bold cursor-pointer"
                    >
                       {categories.map((cat, idx) => (
                         <option key={idx} value={cat.name}>{cat.name}</option>
                       ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Subcategory folder node</Label>
                    <Input 
                      value={newArticle.subCategory}
                      onChange={(e) => setNewArticle({...newArticle, subCategory: e.target.value})}
                      placeholder="e.g. Workspace Setup, RBAC, Webhooks"
                      className="h-11 text-xs font-bold rounded-xl border-slate-200 bg-slate-50"
                    />
                  </div>
                </div>

                {/* Content Editor block */}
                <div className="flex-1 flex flex-col space-y-2 min-h-[250px]">
                   <div className="flex justify-between items-center text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                      <span>Article documentation body</span>
                      <span className="flex items-center gap-1 text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md font-black">
                         <Sparkles className="w-3 h-3 animate-pulse" /> Auto-Assist Enabled
                      </span>
                   </div>

                   <RichTextEditor
                     value={newArticle.content}
                     onChange={(c) => setNewArticle({...newArticle, content: c})}
                     placeholder="Type deep formatted guide procedures using standard clean html..."
                     className="flex-1 min-h-[200px] border border-slate-200 rounded-xl overflow-hidden bg-slate-50/20"
                   />
                </div>

              </div>

              {/* Action buttons footer */}
              <div className="px-6 py-4.5 border-t bg-slate-55 flex items-center justify-between shrink-0">
                <Button 
                  variant="ghost" 
                  className="rounded-xl px-4 text-xs font-extrabold text-slate-400 hover:text-slate-600"
                  onClick={() => setIsAddingArticle(false)}
                >
                   Close Draft
                </Button>

                <Button 
                  className="bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold px-6 h-10 rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
                  onClick={handleSaveArticle}
                >
                  <Check className="w-4 h-4" />
                  <span>{editingArticleId ? 'Save Guidelines Amendments' : 'Publish Document Live'}</span>
                </Button>
              </div>

            </div>

            {/* Enterprise settings sidebar */}
            <aside className="w-full lg:w-[320px] bg-slate-50/70 border-l border-slate-150 p-6 flex flex-col gap-5 shrink-0 overflow-y-auto">
               
               <div className="flex items-center gap-2 pb-4 border-b">
                 <Settings className="w-4 h-4 text-indigo-500" />
                 <h4 className="text-xs font-black uppercase text-slate-800">Article Publishing parameters</h4>
               </div>

               {/* Access visibility */}
               <div className="space-y-2">
                 <Label className="text-[9.5px] uppercase font-black text-slate-400 tracking-wider">Access Scope Visibility</Label>
                 <div className="flex items-center justify-between p-3 bg-white border rounded-xl shadow-3xs">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-800">Public Portal access</span>
                      <span className="text-[10px] text-slate-400 font-semibold mt-0.5">Dispatched to help desk hubs</span>
                    </div>
                    <Switch 
                      checked={newArticle.visibility === 'Public'}
                      onCheckedChange={(checked) => setNewArticle({...newArticle, visibility: checked ? 'Public' : 'Private'})}
                    />
                 </div>
               </div>

               {/* Custom Owner allocator */}
               <div className="space-y-2">
                 <Label className="text-[9.5px] uppercase font-black text-slate-400 tracking-wider">Document Metadata Owner</Label>
                 <select 
                   value={newArticle.owner}
                   onChange={(e) => setNewArticle({...newArticle, owner: e.target.value})}
                   className="w-full h-10 bg-white border rounded-xl px-2.5 text-xs font-bold"
                 >
                    {ENTERPRISE_USERS.map((user, uidx) => (
                      <option key={uidx} value={user.name}>{user.name} ({user.role})</option>
                    ))}
                 </select>
               </div>

               {/* Reviewer allocator */}
               <div className="space-y-2">
                 <Label className="text-[9.5px] uppercase font-black text-slate-400 tracking-wider">Assigned Auditor Representative</Label>
                 <select 
                   value={newArticle.reviewer}
                   onChange={(e) => setNewArticle({...newArticle, reviewer: e.target.value})}
                   className="w-full h-10 bg-white border rounded-xl px-2.5 text-xs font-bold"
                 >
                    {ENTERPRISE_USERS.map((user, uidx) => (
                      <option key={uidx} value={user.name}>{user.name} ({user.role})</option>
                    ))}
                 </select>
               </div>

               {/* Publishing State Status */}
               <div className="space-y-2">
                 <Label className="text-[9.5px] uppercase font-black text-slate-400 tracking-wider">Active Workflow Status</Label>
                 <select 
                   value={newArticle.status}
                   onChange={(e) => setNewArticle({...newArticle, status: e.target.value})}
                   className="w-full h-10 bg-white border rounded-xl px-2.5 text-xs font-bold"
                 >
                    <option value="Published">Published &amp; Live</option>
                    <option value="Draft">Draft Workspace Cache</option>
                    <option value="Needs Review">Under Auditor Verification</option>
                    <option value="Outdated">Annotated Outdated Guidelines</option>
                    <option value="Archived">Secure Archive Folder</option>
                    <option value="AI Generated">Raw AI Suggested draft</option>
                    <option value="Under Revision">Active Hot-fix overhaul</option>
                 </select>
               </div>

               {/* Tags */}
               <div className="space-y-2">
                 <Label className="text-[9.5px] uppercase font-black text-slate-400 tracking-wider">Tags (comma separated)</Label>
                 <Input 
                   value={tagInput}
                   onChange={(e) => setTagInput(e.target.value)}
                   placeholder="e.g. guide, active, network"
                   className="h-10 bg-white border text-xs font-bold rounded-xl"
                 />
                 <div className="flex flex-wrap gap-1 mt-1.5">
                   {tagInput.split(',').map(t => t.trim()).filter(Boolean).map((t, idx) => (
                     <Badge key={idx} className="bg-slate-200 text-slate-600 font-extrabold uppercase text-[7.5px] py-0 px-1 border-none rounded-md">
                        #{t}
                     </Badge>
                   ))}
                 </div>
               </div>

            </aside>

          </div>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* ENTERPRISE CATEGORY CONFIGURATION DIALOG MODAL           */}
      {/* ======================================================== */}
      <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
        <DialogContent className="max-w-[440px] rounded-2xl p-5 border shadow-2xl">
          <DialogHeader className="pb-3 border-b">
             <DialogTitle className="text-sm font-black uppercase text-slate-800 tracking-wider">Create Enterprise category node</DialogTitle>
             <DialogDescription className="text-[11px] text-slate-400 font-semibold">Extend your team's knowledge mapping structure with nested directories.</DialogDescription>
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
                Dismiss
             </Button>
             <Button className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs h-9.5 px-4" onClick={handleAddCategory}>
                Instantiate Directory
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// Compact helper clock icon
function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
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
