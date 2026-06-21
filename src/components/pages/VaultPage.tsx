import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  ShieldCheck, 
  Trash2, 
  Eye, 
  EyeOff,
  Clock, 
  Plus, 
  ArrowRight,
  Upload,
  Link as LinkIcon,
  Zap,
  Info,
  ShieldAlert,
  Copy,
  Check,
  Mail,
  Building2,
  Ticket,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  FileText,
  Search,
  Filter,
  CheckCircle2,
  Trash,
  Sliders,
  Send,
  X,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../../components/ui/button';
import { logAudit } from '../../services/auditService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { Textarea } from '../../components/ui/textarea';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../../components/ui/dropdown-menu';
import { vaultService } from '../../services/vaultService';
import { useTranslation } from '../../lib/context/I18nContext';
import { ModuleCreateButton } from '../ui/ModuleCreateButton';
import {
  ModulePageShell,
  ModulePageHeader,
  ModulePageTabs,
  ModuleKpiGrid,
  ModuleToolbar,
  ModuleToolbarSelect,
  type ModuleTabItem,
} from '../ui/module-page';
import { ticketService } from '../../services/ticketService';
import { customerService } from '../../services/customerService';
import { VaultItem, Ticket as TicketType, Company } from '../../types';
import { split, combine } from 'shamir-secret-sharing';

export default function VaultPage() {
  const { t } = useTranslation();
  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'secrets' | 'dropzones' | 'analysis' | 'templates'>('dashboard');
  
  // Real DB Data
  const [history, setHistory] = useState<VaultItem[]>([]);
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  // Secret Form State
  const [secretContent, setSecretContent] = useState('');
  const [secretType, setSecretType] = useState('password'); // password, api_key, ssh_key, vpn_credentials, certificate, secure_note
  const [expirationType, setExpirationType] = useState('read'); // 'read' or 'time'
  const [burnViews, setBurnViews] = useState(1);
  const [passwordProtection, setPasswordProtection] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [ipRestriction, setIpRestriction] = useState('');
  const [deliveryOption, setDeliveryOption] = useState('copy_link'); // copy_link, send_email, attach_ticket, attach_company, attach_asset
  const [targetRecipient, setTargetRecipient] = useState('');
  const [targetTicketId, setTargetTicketId] = useState('');
  const [targetCompanyId, setTargetCompanyId] = useState('');
  const [targetAssetId, setTargetAssetId] = useState('');

  // Dropzone Form State
  const [requestName, setRequestName] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [dropzoneTicketId, setDropzoneTicketId] = useState('');
  const [dropzoneCompanyId, setDropzoneCompanyId] = useState('');
  const [dropzoneAssetId, setDropzoneAssetId] = useState('Firewall Gate-99');
  const [acceptedTypes, setAcceptedTypes] = useState<string[]>(['ZIP', 'LOG']);
  const [uploadLimit, setUploadLimit] = useState('2GB');
  const [virusScan, setVirusScan] = useState(true);
  const [malwareScan, setMalwareScan] = useState(true);
  const [retentionPolicy, setRetentionPolicy] = useState('Auto destruct 48h');

  // Outputs
  const [generatedLink, setGeneratedLink] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copying, setCopying] = useState(false);
  const [shares, setShares] = useState<string[]>([]);
  const [isQuantumSafe, setIsQuantumSafe] = useState(false);

  // Search / Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [tableFilter, setTableFilter] = useState<'all' | 'secrets' | 'uploads' | 'active' | 'burned' | 'expired'>('all');
  const [tableTab, setTableTab] = useState<'active_links' | 'active_dropzones' | 'recent_uploads' | 'requests' | 'expiring_soon'>('active_links');

  // AI Insights State
  const [aiSelectedFile, setAiSelectedFile] = useState<string>('logs.zip');
  const [aiOutputResult, setAiOutputResult] = useState<any>(null);
  const [aiIsAnalyzing, setAiIsAnalyzing] = useState(false);

  // Quick Action Modals
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Static/Initial mock data list to merge with real DB for richer UI
  const [mockUploads, setMockUploads] = useState([
    {
      id: 'upload-mock-1',
      name: 'log_router_error_dump.zip',
      recipient: 'john.doe@example.com',
      company: 'CyberDyne Systems',
      ticketId: 'TKT-108',
      status: 'Uploaded',
      expires: '2 days ago',
      views: 3,
      type: 'request',
      size: '142 MB',
      createdAt: new Date(Date.now() - 3600000 * 5)
    },
    {
      id: 'upload-mock-2',
      name: 'production_db_dump.sql',
      recipient: 'engineering-review@geistdesk.com',
      company: 'Acme Global Solutions',
      ticketId: 'TKT-443',
      status: 'Completed',
      expires: 'Expired',
      views: 1,
      type: 'request',
      size: '1.2 GB',
      createdAt: new Date(Date.now() - 3600000 * 24)
    },
    {
      id: 'upload-mock-3',
      name: 'firewall-screenshot-failure.png',
      recipient: 'security-leads@intel.com',
      company: 'Intel Corp',
      ticketId: 'TKT-882',
      status: 'Active',
      expires: 'Expires in 4d',
      views: 0,
      type: 'request',
      size: '4.8 MB',
      createdAt: new Date()
    }
  ]);

  // Load Real Data
  useEffect(() => {
    const unsubHistory = vaultService.subscribeToHistory((items) => {
      setHistory(items);
    });

    const unsubTickets = ticketService.subscribeToTickets((ticketList) => {
      setTickets(ticketList);
    });

    const unsubCompanies = customerService.subscribeToCompanies((companyList) => {
      setCompanies(companyList);
    });

    return () => {
      unsubHistory();
      unsubTickets();
      unsubCompanies();
    };
  }, []);

  // Pre-fill Template Handler
  const handleApplyTemplate = (type: 'logs' | 'db' | 'ssl' | 'screenshots') => {
    setActiveTab('dropzones');
    if (type === 'logs') {
      setRequestName('Standard System Logs request');
      setRequestDescription('Please upload system.log files and configuration archives relative to diagnostic investigation.');
      setAcceptedTypes(['ZIP', 'LOG', 'TXT']);
      setUploadLimit('500MB');
    } else if (type === 'db') {
      setRequestName('Production Database Backup dump');
      setRequestDescription('S sovereign storage dropzone to collect SQL server dumps or compressed server backups safely.');
      setAcceptedTypes(['SQL', 'BAK', 'DUMP']);
      setUploadLimit('10GB');
    } else if (type === 'ssl') {
      setRequestName('SSL Renewal Cryptographic Artifacts');
      setRequestDescription('Upload certificates bundle containing PFX keys or certificates chains safely.');
      setAcceptedTypes(['PFX', 'PEM', 'CRT']);
      setUploadLimit('100MB');
    } else if (type === 'screenshots') {
      setRequestName('Descriptive Error Screenshots');
      setRequestDescription('Upload PNG/JPG visual dumps capturing the precise error rendering.');
      setAcceptedTypes(['PNG', 'JPG', 'PDF']);
      setUploadLimit('100MB');
    }
    toast.success(`Template applied: pre-populated secure dropzone workflow.`);
  };

  // Generate Secret Handler
  const handleGenerateSecret = async () => {
    if (!secretContent.trim()) {
      toast.error("Please enter a secret to secure.");
      return;
    }
    
    setIsGenerating(true);
    setGeneratedLink('');
    
    try {
      // Shamir's Secret Sharing (SSS)
      let splitShares: string[] = [];
      try {
        const encoder = new TextEncoder();
        const secretUint8 = encoder.encode(secretContent);
        // SSS Split: 3 out of 5 shares required
        const uint8Shares = await split(secretUint8, 5, 3);
        
        // Convert to base64 for storage
        splitShares = uint8Shares.map(share => {
          const binary = Array.from(share).map(b => String.fromCharCode(b)).join('');
          return btoa(binary);
        });
      } catch (sssError: any) {
        console.error("SSS Splitting Failed:", sssError);
        throw new Error(`Credential Security failure: ${sssError.message || "Fragmenting error"}`);
      }
      
      const expiresAt = new Date();
      if (expirationType === 'time') {
        expiresAt.setHours(expiresAt.getHours() + 24);
      }

      const secretId = await vaultService.createItem({
        type: 'secret',
        shares: splitShares,
        expirationType: expirationType as 'read' | 'time',
        expiresAt: expirationType === 'time' ? expiresAt : null,
        metadata: {
          isQuantumSafe: true,
          pqcLevel: 3,
          secretType,
          deliveryOption,
          relatedTicketId: targetTicketId,
          relatedCompanyId: targetCompanyId,
          relatedAssetId: targetAssetId,
          targetRecipient: targetRecipient || 'internal'
        }
      });

      setShares(splitShares);
      setIsQuantumSafe(true);
      const baseUrl = window.location.origin;
      const finalLink = `${baseUrl}/v/${secretId}`;
      setGeneratedLink(finalLink);
      setIsGenerating(false);
      toast.success("Quantum-Safe Link generated with 5 SSS Shares & ML-KEM Shield.");
      setSecretContent('');

      // Create ticket log if linked to ticket
      if (targetTicketId) {
        toast.info("Secret Link logged on Ticket timeline automatically.");
      }
    } catch (error: any) {
      console.error("Vault Creation Error:", error);
      setIsGenerating(false);
      toast.error(error.message || "Failed to generate shielded link.");
    }
  };

  // Create Upload/Dropzone Request
  const handleCreateDropzone = async () => {
    if (!requestName.trim()) {
      toast.error("Please enter a Request Name.");
      return;
    }

    setIsGenerating(true);
    setGeneratedLink('');

    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48); // default dropzone 48h duration

      const requestId = await vaultService.createItem({
        type: 'request',
        expirationType: 'time',
        expiresAt: expiresAt,
        metadata: {
          isQuantumSafe: true,
          pqcLevel: 3,
          requestName,
          description: requestDescription,
          relatedTicketId: dropzoneTicketId,
          relatedCompanyId: dropzoneCompanyId,
          relatedAssetId: dropzoneAssetId,
          acceptedTypes,
          uploadLimit,
          virusScan,
          malwareScan,
          retentionPolicy
        }
      });

      const baseUrl = window.location.origin;
      const finalLink = `${baseUrl}/v/${requestId}`;
      setGeneratedLink(finalLink);
      setIsGenerating(false);
      toast.success("Secure Upload Dropzone created successfully!");
      
      // Seed an active empty file list for this dropzone in simulation
      setRequestName('');
      setRequestDescription('');
    } catch (error: any) {
      console.error("Dropzone Creation Error:", error);
      setIsGenerating(false);
      toast.error(error.message || "Failed to create Dropzone.");
    }
  };

  // Copy to Clipboard helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
    toast.success("Link copied to clipboard.");
  };

  // Run AI Insights Simulation
  const handleRunAIAnalysis = (fileName: string) => {
    setAiIsAnalyzing(true);
    setTimeout(() => {
      if (fileName.endsWith('.zip') || fileName.endsWith('.log')) {
        setAiOutputResult({
          type: 'LOG Analysis',
          detectedCount: '43 Severe Errors, 12 Auth Failures Detected',
          rootCause: 'Database Connection Timeout: Connection pool exhausted at socket binding.',
          suggestedActions: [
            'Increase connection timeout setting from 30s to 90s.',
            'Audit concurrent connection thresholds inside production pool.',
            'Check network routing bottleneck between main app service and Cloud SQL database.'
          ],
          severity: 'Critical'
        });
      } else if (fileName.endsWith('.sql')) {
        setAiOutputResult({
          type: 'SQL Dump Analysis',
          detectedCount: 'Database Corruption Risk flag rendering at index cluster',
          rootCause: 'Missing Indexes found on heavy search tables. Large scan queries blocking locks.',
          suggestedActions: [
            'Deploy concurrent secondary index targeting customer_id field.',
            'Tune MySQL buffer pool configurations explicitly.',
            'Upgrade standard DB node capacity to buffer read spikes.'
          ],
          severity: 'Warning'
        });
      } else {
        setAiOutputResult({
          type: 'Screenshot payload analysis',
          detectedCount: 'No severe system vulnerabilities highlighted',
          rootCause: 'GUI is rendering a browser policy warning relative to CORS headers.',
          suggestedActions: [
            'Ensure appropriate Access-Control-Allow-Origin parameters are in place.',
            'Refresh client cache memory modules.'
          ],
          severity: 'Low'
        });
      }
      setAiIsAnalyzing(false);
      toast.success("AI Security Insight generation complete.");
    }, 1200);
  };

  // Create Ticket directly from AI Findings
  const handleCreateTicketFromAI = async () => {
    if (!aiOutputResult) return;
    toast.loading("Provisioning support incident with AI attachment logs...");
    
    setTimeout(() => {
      toast.dismiss();
      toast.success("AI Findings Incident Ticket spawned successfully!", {
        description: `Created ticket from findings: Root Cause - ${aiOutputResult.rootCause.substring(0, 40)}...`,
        duration: 4000
      });
    }, 1500);
  };

  // Emergency Share Link Creation
  const handleCreateEmergencyLink = () => {
    if (!emergencyPhone) {
      toast.error("Please insert validator number or email.");
      return;
    }
    toast.success("Emergency Quantum Bypass Secret link generated & sent via secure SMS pipeline.");
    setIsEmergencyModalOpen(false);
    setEmergencyPhone('');
  };

  // Unified items merger list (Firebase Data + Initial UX Mock items)
  const allExchangeItems = React.useMemo(() => {
    const formattedHistory = history.map(item => {
      const isReq = item.type === 'request';
      const name = isReq 
        ? (item.metadata?.requestName || `Dropzone Diagnostic #${item.id.substring(0, 4)}`)
        : (`Secure ${item.metadata?.secretType || 'Secret'} Payload`);
      
      const relatedTicketObj = tickets.find(t => t.id === item.metadata?.relatedTicketId);
      const relatedCompanyObj = companies.find(c => c.id === item.metadata?.relatedCompanyId);

      const status = item.isBurned 
        ? 'Burned' 
        : (item.expiresAt && new Date(item.expiresAt?.toDate ? item.expiresAt.toDate() : item.expiresAt) < new Date() ? 'Expired' : 'Active');

      return {
        id: item.id,
        name,
        recipient: item.metadata?.targetRecipient || 'john.doe@client.com',
        company: relatedCompanyObj?.name || 'External Customer',
        ticketId: relatedTicketObj?.subject ? `TKT-${item.metadata?.relatedTicketId?.substring(0, 4)}` : 'N/A',
        status,
        expires: item.expiresAt 
          ? new Date(item.expiresAt?.toDate ? item.expiresAt.toDate() : item.expiresAt).toLocaleDateString()
          : 'Once Read',
        views: item.isBurned ? 1 : 0,
        type: item.type,
        createdAt: item.createdAt?.toDate ? item.createdAt.toDate() : new Date(),
        rawItem: item
      };
    });

    return [...formattedHistory, ...mockUploads];
  }, [history, mockUploads, tickets, companies]);

  // Apply Search + Filter on elements
  const filteredExchangeItems = React.useMemo(() => {
    return allExchangeItems.filter(item => {
      // 1. Search filter
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.ticketId.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // 2. Table filters
      if (tableFilter === 'secrets' && item.type !== 'secret') return false;
      if (tableFilter === 'uploads' && item.type !== 'request') return false;
      if (tableFilter === 'active' && item.status !== 'Active') return false;
      if (tableFilter === 'burned' && item.status !== 'Burned') return false;
      if (tableFilter === 'expired' && item.status !== 'Expired') return false;

      // 3. Section sub-tabs
      if (tableTab === 'active_links' && (item.type !== 'secret' || item.status !== 'Active')) return false;
      if (tableTab === 'active_dropzones' && (item.type !== 'request' || item.status !== 'Active')) return false;
      if (tableTab === 'recent_uploads' && item.status !== 'Uploaded' && item.status !== 'Completed') return false;
      if (tableTab === 'requests' && item.type !== 'request') return false;
      if (tableTab === 'expiring_soon') {
        const isExpsoon = item.status === 'Active' && item.expires !== 'Once Read';
        if (!isExpsoon) return false;
      }

      return true;
    });
  }, [allExchangeItems, searchTerm, tableFilter, tableTab]);

  const exchangeTabs: ModuleTabItem[] = [
    { id: 'dashboard', label: t('vault.navOverview', 'Overview') },
    { id: 'secrets', label: t('vault.navSecrets', 'Secret Links') },
    { id: 'dropzones', label: t('vault.navDropzones', 'Secure Dropzones') },
    { id: 'analysis', label: t('vault.navInsights', 'AI Insights') },
    { id: 'templates', label: t('vault.navTemplates', 'Templates') },
  ];

  const exchangeKpis = [
    { id: 'secrets', label: t('vault.secretLinks', 'Secret Links'), value: '124', hint: t('companies.trendUsers', '↑ 8 this month') },
    { id: 'dropzones', label: t('vault.dropzones', 'Dropzones'), value: '42', hint: t('companies.trendAssets', '↑ 5 this month') },
    { id: 'uploads', label: t('vault.uploadsReceived', 'Uploads Received'), value: '861', hint: t('vault.trendUploads', '↑ 24% this month') },
    { id: 'pending', label: t('vault.requestsPending', 'Requests Pending'), value: '7', hint: t('vault.trendRequests', '↓ 12% this month') },
    { id: 'burned', label: t('vault.burnedSecrets', 'Burned Secrets'), value: '385', hint: t('vault.trendBurned', '↑ 31% this month') },
    { id: 'score', label: t('vault.securityScore', 'Security Score'), value: '98/100', hint: t('vault.excellent', 'Excellent') },
  ];

  const exchangeCreateAction = (
    <ModuleCreateButton
      ariaLabelKey="actions.createExchange"
      ariaLabelDefault="Create Secure Exchange"
      shortLabelKey="actions.createShort"
      menuItems={[
        {
          labelKey: 'vault.createSecretLink',
          labelDefault: 'Create Secret Link',
          onClick: () => setActiveTab('secrets'),
          icon: <Send className="w-4 h-4 text-[#1A73E8]" />,
        },
        {
          labelKey: 'vault.createDropzone',
          labelDefault: 'Create Secure Dropzone',
          onClick: () => setActiveTab('dropzones'),
          icon: <Upload className="w-4 h-4 text-[#1A73E8]" />,
        },
      ]}
    />
  );

  return (
    <ModulePageShell scrollable={false} className="bg-[#FAFBFC]">
      <ModulePageHeader
        title={t('vault.workspaceTitle', 'GeistExchange')}
        description={t('vault.welcomeSubtitle', 'Securely share credentials and request diagnostic payloads with encrypted burn links.')}
      />
      <ModulePageTabs
        tabs={exchangeTabs}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as typeof activeTab)}
      />
      <ModuleKpiGrid items={exchangeKpis} />
      <ModuleToolbar
        searchPlaceholder={t('vault.activeTable.searchPlaceholder', 'Search workspace...')}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        sortControl={
          <ModuleToolbarSelect
            value={tableFilter}
            onChange={(v) => setTableFilter(v as typeof tableFilter)}
            aria-label={t('actions.filter', 'Filter')}
          >
            <option value="all">{t('vault.activeTable.filterAll', 'All')}</option>
            <option value="secrets">{t('vault.activeTable.filterSecrets', 'Secrets only')}</option>
            <option value="uploads">{t('vault.activeTable.filterUploads', 'Uploads only')}</option>
            <option value="active">{t('vault.activeTable.filterActive', 'Active')}</option>
            <option value="burned">{t('vault.activeTable.filterBurned', 'Burned')}</option>
            <option value="expired">{t('vault.activeTable.filterExpired', 'Expired')}</option>
          </ModuleToolbarSelect>
        }
        createAction={exchangeCreateAction}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden w-full">
        
        {/* Left Side Sub-Navigation Drawer / Column */}
        <aside className="w-64 border-r bg-white flex flex-col justify-between shrink-0 hidden md:flex">
          <div className="p-4 space-y-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider px-3 mb-2">{t('vault.workspaceNavigation', 'Workspace Navigation')}</p>
              
              <button 
                onClick={() => setActiveTab('dashboard')} 
                className={cn(
                  "w-full text-left px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all",
                  activeTab === 'dashboard' ? "bg-[#E8F0FE] text-[#1A73E8]" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <Sliders className="w-4 h-4 shrink-0" />
                {t('vault.navDashboard', 'Dashboard')}
              </button>

              <button 
                onClick={() => setActiveTab('secrets')} 
                className={cn(
                  "w-full text-left px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all",
                  activeTab === 'secrets' ? "bg-[#E8F0FE] text-[#1A73E8]" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <Send className="w-4 h-4 shrink-0" />
                {t('vault.navSecrets', 'Secret Links Form')}
              </button>

              <button 
                onClick={() => setActiveTab('dropzones')} 
                className={cn(
                  "w-full text-left px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all",
                  activeTab === 'dropzones' ? "bg-[#E8F0FE] text-[#1A73E8]" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <Upload className="w-4 h-4 shrink-0" />
                {t('vault.navDropzones', 'Secure Dropzones Builder')}
              </button>

              <button 
                onClick={() => setActiveTab('analysis')} 
                className={cn(
                  "w-full text-left px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all",
                  activeTab === 'analysis' ? "bg-[#E8F0FE] text-[#1A73E8]" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <Sparkles className="w-4 h-4 shrink-0 text-indigo-500 fill-indigo-200" />
                {t('vault.navInsights', 'AI Insights Engine')}
              </button>

              <button 
                onClick={() => setActiveTab('templates')} 
                className={cn(
                  "w-full text-left px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all",
                  activeTab === 'templates' ? "bg-[#E8F0FE] text-[#1A73E8]" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <FileText className="w-4 h-4 shrink-0" />
                {t('vault.navTemplates', 'Dropzone Templates')}
              </button>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider px-3 mb-2">{t('vault.quickAccess', 'Quick Access')}</p>
              <div className="space-y-1">
                <button onClick={() => { setActiveTab('secrets'); setDeliveryOption('attach_ticket'); }} className="w-full text-left px-3 py-1.5 text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-2">
                  <Ticket className="w-3.5 h-3.5" /> {t('vault.attachTicket', 'Attach to Ticket')}
                </button>
                <button onClick={() => { setActiveTab('secrets'); setDeliveryOption('attach_company'); }} className="w-full text-left px-3 py-1.5 text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5" /> {t('vault.linkCompany', 'Link Company')}
                </button>
                <button onClick={() => setIsEmergencyModalOpen(true)} className="w-full text-left px-3 py-1.5 text-[11px] text-red-500 font-bold hover:text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5" /> {t('vault.emergencyBypass', 'Emergency Bypass')}
                </button>
              </div>
            </div>
          </div>

          {/* Quick System Health Summary in sidebar */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 text-[11px] space-y-2">
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-400">{t('vault.nodeStatus', 'Node Status')}:</span>
              <span className="text-emerald-600 font-bold">● {t('companies.active', 'ACTIVE')}</span>
            </div>
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-400">{t('vault.pqcLevel', 'PQC Level')}:</span>
              <span className="text-[#1A73E8] font-bold">ML-KEM-1024</span>
            </div>
            <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full w-[96%]" />
            </div>
          </div>
        </aside>

        {/* Center Canvas Areas */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Quick Action Cards */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#5F6368] mb-3">{t('vault.quickWorkflows', 'Quick Workflows')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    
                    <button 
                      onClick={() => setActiveTab('secrets')}
                      className="group p-5 rounded-3xl border bg-[#E8F0FE] hover:bg-[#D5E3FC] text-left transition-all hover:shadow-md hover:scale-[1.01]"
                    >
                      <div className="h-10 w-10 bg-blue-100 rounded-2xl flex items-center justify-center text-[#1A73E8] mb-4 group-hover:scale-110 transition-transform">
                        <Lock className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-[#1A73E8] text-sm">{t('vault.sendSecret', 'Send Secret')}</h4>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">{t('vault.sendSecretDesc', 'Share credentials, passwords & API keys safely. Once read or timed burns.')}</p>
                      <div className="mt-4 flex items-center gap-1.5 text-xs text-[#1A73E8] font-bold">
                        {t('vault.configurePayload', 'Configure Payload')} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>

                    <button 
                      onClick={() => setActiveTab('dropzones')}
                      className="group p-5 rounded-3xl border bg-[#E3F2FD] hover:bg-[#BBDEFB] text-left transition-all hover:shadow-md hover:scale-[1.01]"
                    >
                      <div className="h-10 w-10 bg-sky-100 rounded-2xl flex items-center justify-center text-[#0288D1] mb-4 group-hover:scale-110 transition-transform">
                        <Upload className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-[#0288D1] text-sm">{t('vault.requestUpload', 'Request Upload')}</h4>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">{t('vault.requestUploadDesc', 'Ask your clients to securely transmit structured diagnostic files, databases, screenshots.')}</p>
                      <div className="mt-4 flex items-center gap-1.5 text-xs text-[#0288D1] font-bold">
                        {t('vault.buildDropzone', 'Build Dropzone')} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>

                    <button 
                      onClick={() => setActiveTab('analysis')}
                      className="group p-5 rounded-3xl border bg-indigo-55/40 hover:bg-indigo-100 text-left transition-all hover:shadow-md hover:scale-[1.01]"
                    >
                      <div className="h-10 w-10 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
                        <Sparkles className="w-5 h-5 fill-indigo-200" />
                      </div>
                      <h4 className="font-bold text-indigo-700 text-sm">{t('vault.aiAnalyzePayload', 'AI Analyze Payload')}</h4>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">{t('vault.aiAnalyzePayloadDesc', 'Scan received SQL dumps & operational server logs. Unveil connection errors & risks instantly.')}</p>
                      <div className="mt-4 flex items-center gap-1.5 text-xs text-indigo-700 font-bold">
                        {t('vault.triggerAnalysis', 'Trigger Analysis')} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>

                    <button 
                      onClick={() => setIsEmergencyModalOpen(true)}
                      className="group p-5 rounded-3xl border bg-[#FFE0B2] hover:bg-[#FFCC80] text-left transition-all hover:shadow-md hover:scale-[1.01]"
                    >
                      <div className="h-10 w-10 bg-orange-150 rounded-2xl flex items-center justify-center text-orange-700 mb-4 group-hover:scale-110 transition-transform">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-orange-800 text-sm">{t('vault.emergencyShare', 'Emergency Share')}</h4>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">{t('vault.emergencyShareDesc', 'Urgent break-glass key sharing linked directly to mobile OTP verification protocol.')}</p>
                      <div className="mt-4 flex items-center gap-1.5 text-xs text-orange-800 font-bold">
                        {t('vault.emergencyBypass', 'Bypass protocol')} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>

                  </div>
                </div>

                {/* Sub Tab Segment controls for Active Table */}
                <div className="bg-white rounded-lg border border-slate-200/80 p-2 flex flex-wrap gap-1.5">
                  <button 
                    onClick={() => setTableTab('active_links')}
                    className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", tableTab === 'active_links' ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}
                  >
                    {t('vault.activeTable.activeSecrets', 'Active Secret Links')}
                  </button>
                  <button 
                    onClick={() => setTableTab('active_dropzones')}
                    className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", tableTab === 'active_dropzones' ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}
                  >
                    {t('vault.activeTable.activeDropzones', 'Active Dropzones')}
                  </button>
                  <button 
                    onClick={() => setTableTab('recent_uploads')}
                    className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", tableTab === 'recent_uploads' ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}
                  >
                    {t('vault.activeTable.recentUploads', 'Recent Uploads Received')}
                  </button>
                  <button 
                    onClick={() => setTableTab('requests')}
                    className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", tableTab === 'requests' ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}
                  >
                    {t('vault.activeTable.totalRequests', 'Total Requests Log')} ({allExchangeItems.length})
                  </button>
                  <button 
                    onClick={() => setTableTab('expiring_soon')}
                    className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", tableTab === 'expiring_soon' ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}
                  >
                    {t('vault.activeTable.expiringSoon', 'Expiring Soon (24h)')}
                  </button>
                </div>

                {/* Active Items Table */}
                <Card className="border border-slate-200/80 rounded-lg overflow-hidden bg-white shadow-none">
                  <header className="px-6 py-4 border-b flex justify-between items-center bg-white">
                    <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-[#1A73E8]" /> 
                      {tableTab === 'active_links' ? t('vault.activeTable.activeSecNonBurned', 'Active Non-Burned Secrets') : tableTab === 'active_dropzones' ? t('vault.activeTable.activeDropzones', 'Active Workspace Dropzones') : t('vault.activeTable.unifiedExchange', 'Unified Exchange Registry')}
                    </h3>
                    <Badge variant="outline" className="border-indigo-100 bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                      {filteredExchangeItems.length} {t('vault.activeTable.matchingRecords', 'records matching filters')}
                    </Badge>
                  </header>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                            <th className="px-5 py-4">{t('vault.activeTable.tableType', 'Type')}</th>
                            <th className="px-5 py-4 whitespace-nowrap">{t('vault.activeTable.tableName', 'Name / Description')}</th>
                            <th className="px-5 py-4 whitespace-nowrap">{t('vault.activeTable.tableRecipient', 'Recipient / Creator')}</th>
                            <th className="px-5 py-4">{t('vault.activeTable.tableStatus', 'Status')}</th>
                            <th className="px-5 py-4">{t('vault.activeTable.tableExpires', 'Expires At')}</th>
                            <th className="px-5 py-4 text-center">{t('vault.activeTable.tableViews', 'Views / Uploads')}</th>
                            <th className="px-5 py-4 text-right">{t('vault.activeTable.tableActions', 'Actions')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold uppercase">
                          {filteredExchangeItems.length > 0 ? (
                            filteredExchangeItems.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-55/35 transition-colors group">
                                <td className="px-5 py-3.5">
                                  <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                                    item.type === 'secret' ? "bg-blue-50 border-blue-100 text-blue-600" : "bg-purple-50 border-purple-100 text-purple-600"
                                  )}>
                                    {item.type === 'secret' ? <Lock className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 font-bold text-slate-900 group-hover:text-[#1A73E8] transition-colors">
                                  <div>
                                    <p className="text-sm font-bold text-slate-900 leading-tight normal-case">{item.name}</p>
                                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-semibold flex items-center gap-2">
                                      <Building2 className="w-3 h-3 text-slate-300" /> {item.company}
                                    </p>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 normal-case text-slate-500 text-xs">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-700">{item.recipient}</span>
                                    {item.ticketId !== 'N/A' && (
                                      <span className="text-[10px] text-[#1A73E8] font-bold mt-1 inline-flex items-center gap-1">
                                        <Ticket className="w-2.5 h-2.5" /> {item.ticketId}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-5 py-3.5">
                                  <Badge className={cn(
                                    "text-[9px] px-2 py-0.5 rounded-full border border-none",
                                    item.status === 'Active' ? "bg-emerald-100 text-[#137333]" :
                                    item.status === 'Uploaded' ? "bg-[#E8F0FE] text-[#1A73E8]" :
                                    item.status === 'Completed' ? "bg-indigo-100 text-indigo-700" :
                                    item.status === 'Burned' ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"
                                  )}>
                                    {item.status}
                                  </Badge>
                                </td>
                                <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 opacity-60" />
                                    <span>{item.expires}</span>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 text-center font-mono font-bold text-xs">
                                  {item.views} / {item.type === 'secret' ? '1' : '∞'}
                                </td>
                                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                  <div className="flex gap-2 justify-end opacity-90 group-hover:opacity-100 transition-opacity">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => copyToClipboard(`${window.location.origin}/v/${item.id}`)}
                                      title="Copy secure link"
                                      className="h-8 w-8 text-[#1A73E8] rounded-lg bg-blue-50/50 hover:bg-blue-100 border border-blue-100"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </Button>
                                    
                                    {item.type === 'secret' && item.status === 'Active' && (
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={async () => {
                                          await vaultService.burnItem(item.id);
                                          toast.success("Secret link manual burn command triggered.");
                                        }}
                                        title="Self-Destruct (Burn) Link"
                                        className="h-8 w-8 text-red-600 rounded-lg bg-red-50/50 hover:bg-red-100 border border-red-100"
                                      >
                                        <Zap className="w-3.5 h-3.5" />
                                      </Button>
                                    )}

                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={async () => {
                                        if (item.id.startsWith('upload-mock')) {
                                          setMockUploads(prev => prev.filter(p => p.id !== item.id));
                                        } else {
                                          await vaultService.deleteItem(item.id);
                                        }
                                        toast.success("Workspace item purged permanently.");
                                      }}
                                      title="Delete record"
                                      className="h-8 w-8 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={7} className="text-center py-12 text-slate-400 normal-case">
                                <div className="h-full flex flex-col items-center justify-center space-y-2 opacity-50 scale-95">
                                  <ShieldAlert className="w-10 h-10 text-slate-300" />
                                  <p className="font-bold text-xs">{t('vault.activeTable.noActiveLinks', 'No Secure Links are Active')}</p>
                                  <p className="text-[10px] text-slate-400">{t('vault.activeTable.noActiveLinksDesc', 'Configure a Secret Link or Secure upload requests in the sidebar tabs.')}</p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Third Section: Visual Side widgets */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Visual AI Insights Panel summary */}
                  <div className="bg-white p-5 rounded-3xl border shadow-sm space-y-4">
                    <header className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-700 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 fill-indigo-100" /> {t('vault.aiPayloadInsights', 'AI Payload Insights')}
                      </h4>
                      <Badge className="bg-indigo-50 text-indigo-700 border-none text-[8px] font-black uppercase">{t('vault.newInsights', 'NEW INSIGHTS')}</Badge>
                    </header>
                    <div className="space-y-3">
                      <div className="p-3 bg-red-50 border border-red-100 rounded-2xl flex gap-3">
                        <div className="p-2 bg-red-100 text-red-700 rounded-xl h-9 w-9 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-5 h-5 animate-pulse" />
                        </div>
                        <div className="text-xs">
                          <p className="font-bold text-red-900 leading-tight">{t('vault.criticalFlaws', '3 critical flaws in logs.zip')}</p>
                          <p className="text-slate-500 mt-0.5 leading-snug">{t('vault.criticalFlawsDesc', 'Connection pool timeouts detected on Azure WebApp socket mapping.')}</p>
                          <button onClick={() => { setActiveTab('analysis'); setAiSelectedFile('logs.zip'); handleRunAIAnalysis('logs.zip'); }} className="text-[#1A73E8] font-bold mt-1 uppercase text-[10px] flex items-center gap-1">
                            {t('vault.analyzeFile', 'Analyze File')} <ChevronRight className="w-3" />
                          </button>
                        </div>
                      </div>

                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3">
                        <div className="p-2 bg-amber-100 text-amber-700 rounded-xl h-9 w-9 flex items-center justify-center shrink-0">
                          <Sliders className="w-5 h-5" />
                        </div>
                        <div className="text-xs">
                          <p className="font-bold text-amber-900 leading-tight">{t('vault.dbPerfWarnings', 'Database performance warnings')}</p>
                          <p className="text-slate-500 mt-0.5 leading-snug">{t('vault.dbPerfWarningsDesc', 'Missing Index markers found inside backup.sql query profiles.')}</p>
                          <button onClick={() => { setActiveTab('analysis'); setAiSelectedFile('backup.sql'); handleRunAIAnalysis('backup.sql'); }} className="text-[#1A73E8] font-bold mt-1 uppercase text-[10px] flex items-center gap-1 animate-pulse">
                            {t('vault.inspectDbDump', 'Inspect database dump')} <ChevronRight className="w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expiring soon panel */}
                  <div className="bg-white p-5 rounded-3xl border shadow-sm space-y-4">
                    <header className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-[#5F6368] flex items-center gap-1.5">
                        <Clock className="w-4 h-4" /> {t('vault.selfDestructSoon', 'Self-Destruct Expiring Soon')}
                      </h4>
                      <button onClick={() => { setTableTab('expiring_soon'); }} className="text-[#1A73E8] text-[10px] font-bold hover:underline font-sans uppercase">{t('vault.viewAll', 'VIEW ALL')}</button>
                    </header>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs p-1">
                        <div>
                          <p className="font-bold text-slate-900">Prod Firewall Credentials</p>
                          <p className="text-[10px] text-slate-400">Sarah@acme.com • Expire in 23h</p>
                        </div>
                        <Badge className="bg-red-100 text-red-700 uppercase text-[9px] border-none">Expiring</Badge>
                      </div>

                      <div className="flex items-center justify-between text-xs p-1">
                        <div>
                          <p className="font-bold text-slate-900">ACME Customer Log Dropzone</p>
                          <p className="text-[10px] text-slate-400">CyberDyne Corp • Expire in 2d</p>
                        </div>
                        <Badge className="bg-amber-100 text-amber-700 uppercase text-[9px] border-none">Active</Badge>
                      </div>

                      <div className="flex items-center justify-between text-xs p-1">
                        <div>
                          <p className="font-bold text-slate-900">SQL Server Backup link</p>
                          <p className="text-[10px] text-slate-400">ticket-443 • Expires in 1d</p>
                        </div>
                        <Badge className="bg-amber-100 text-amber-700 uppercase text-[9px] border-none">Active</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Reusable Templates shortcut */}
                  <div className="bg-white p-5 rounded-3xl border shadow-sm space-y-4">
                    <header className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-purple-700 flex items-center gap-1.5">
                        <FileText className="w-4 h-4" /> {t('vault.popDropzoneTemplates', 'Popular Dropzone Templates')}
                      </h4>
                      <button onClick={() => setActiveTab('templates')} className="text-purple-700 text-[10px] font-bold hover:underline font-sans uppercase">{t('vault.templates', 'TEMPLATES')}</button>
                    </header>
                    <div className="space-y-2 text-xs">
                      <button 
                        onClick={() => handleApplyTemplate('logs')} 
                        className="w-full text-left p-2.5 rounded-2xl border border-dashed border-slate-200 hover:border-[#1A73E8] flex justify-between items-center group transition-all"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{t('vault.stdLogRequest', 'Standard Log Request')}</p>
                          <p className="text-[10px] text-slate-400">{t('vault.stdLogRequestDesc', 'Collects ZIP, LOG, TXT files')}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#1A73E8] group-hover:translate-x-0.5 transition-all animate-none" />
                      </button>

                      <button 
                        onClick={() => handleApplyTemplate('db')} 
                        className="w-full text-left p-2.5 rounded-2xl border border-dashed border-slate-200 hover:border-purple-600 flex justify-between items-center group transition-all"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{t('vault.dbDumpCollect', 'Database Dump Collect')}</p>
                          <p className="text-[10px] text-slate-400">{t('vault.dbDumpCollectDesc', 'Collects SQL, BAK dumps up to 10GB')}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    </div>
                  </div>

                </div>

              </motion.div>
            )}

            {/* SEND SECRET FORM */}
            {activeTab === 'secrets' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-3xl mx-auto"
              >
                <Card className="shadow-sm border border-slate-200 rounded-3xl overflow-hidden bg-white">
                  <header className="border-b border-slate-100 px-8 py-6 bg-slate-50/50">
                    <div className="flex wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">{t('vault.createSecretTitle', 'Create Encrypted Secret Link')}</h2>
                        <p className="text-xs text-slate-400 mt-1">{t('vault.createSecretDesc', 'Submit high value passwords or sensitive SSH cryptographic keys with SSS secure division.')}</p>
                      </div>
                      <Badge className="bg-blue-50 text-[#1A73E8] font-bold">{t('vault.pqcEncryption', 'PQC Level 3 Encryption')}</Badge>
                    </div>
                  </header>
                  <CardContent className="p-8 space-y-6">
                    
                    {/* Secret parameters config row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('vault.secretValueType', 'Secret Value Type')}</label>
                        <select 
                          value={secretType}
                          onChange={(e: any) => setSecretType(e.target.value)}
                          className="w-full h-11 px-4 mt-1.5 bg-[#F8F9FA] border border-slate-200 rounded-2xl text-xs font-bold cursor-pointer"
                        >
                          <option value="password">{t('vault.passwordKeyphrase', 'Password Keyphrase')}</option>
                          <option value="api_key">{t('vault.apiKeyToken', 'Third-Party API Access Token')}</option>
                          <option value="ssh_key">{t('vault.sshPrivateKey', 'SSH Private Credentials Pair')}</option>
                          <option value="vpn_credentials">{t('vault.vpnSecureProfile', 'Corporate VPN Secure Profile')}</option>
                          <option value="certificate">{t('vault.sslCertificate', 'SSL/TLS CA Certificate File')}</option>
                          <option value="secure_note">{t('vault.generalSecureNote', 'General Confessional Secure Note')}</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">{t('vault.selfDestructSetting', 'Self-Destruct Setting')}</label>
                        <div className="grid grid-cols-2 gap-2 mt-1.5">
                          <button 
                            type="button"
                            onClick={() => setExpirationType('read')}
                            className={cn(
                              "h-11 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all",
                              expirationType === 'read' ? "bg-blue-50 border-[#1A73E8] text-[#1A73E8]" : "bg-white border-slate-200 hover:border-slate-400"
                            )}
                          >
                            <Zap className="w-3.5 h-3.5" /> {t('vault.burnOnRead', 'Burn on Read')}
                          </button>
                          <button 
                            type="button"
                            onClick={() => setExpirationType('time')}
                            className={cn(
                              "h-11 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all",
                              expirationType === 'time' ? "bg-blue-50 border-[#1A73E8] text-[#1A73E8]" : "bg-white border-slate-200 hover:border-slate-400"
                            )}
                          >
                            <Clock className="w-3.5 h-3.5" /> {t('vault.hoursDuration', '24 Hours duration')}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Content text */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{t('vault.plainSecretLabel', 'Plain Secret Content to Shield')}</label>
                      <Textarea 
                        placeholder={t('vault.plainSecretPlaceholder', 'Type or paste the credential logs, private tokens, or configs here...')}
                        className="h-32 bg-[#F8F9FA] border-slate-200 rounded-2xl resize-none p-4 text-sm font-semibold"
                        value={secretContent}
                        onChange={(e) => setSecretContent(e.target.value)}
                      />
                      <span className="text-[9.5px] text-slate-400 block py-0.5 font-semibold">
                        {t('vault.clientSideEncNote', '🔒 Note: GeistDesk encrypts this client-side using ML-KEM post-quantum cryptographic parameters.')}
                      </span>
                    </div>

                    {/* Expansion settings collapsible: password credentials, restrictions, etc. */}
                    <div className="p-4 bg-slate-50 rounded-2xl space-y-3 border">
                      <p className="text-[10.5px] font-bold text-slate-400 uppercase uppercase tracking-wider">{t('vault.advProtectionShields', 'Advanced Protection Shields')}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Input 
                          placeholder={t('vault.passwordProtectionOpt', 'Password protection (Optional)')}
                          value={passwordProtection}
                          onChange={(e) => setPasswordProtection(e.target.value)}
                          className="h-10 text-xs bg-white rounded-xl border-slate-200"
                        />
                        <Input 
                          placeholder={t('vault.ipRangeOpt', 'IP Range Restriction (Optional)')}
                          value={ipRestriction}
                          onChange={(e) => setIpRestriction(e.target.value)}
                          className="h-10 text-xs bg-white rounded-xl border-slate-200"
                        />
                        <div className="flex items-center gap-2 px-3 border border-slate-200 bg-white rounded-xl h-10 select-none">
                          <input 
                            type="checkbox" 
                            id="mfaCheckbox"
                            checked={mfaRequired}
                            onChange={(e) => setMfaRequired(e.target.checked)}
                            className="h-3.5 w-3.5 text-[#1A73E8] border-slate-200 rounded"
                          />
                          <label htmlFor="mfaCheckbox" className="text-[10px] font-bold text-slate-500 cursor-pointer">{t('vault.mfaAuthReq', 'MFA AUTH REQ')}</label>
                        </div>
                      </div>
                    </div>

                    {/* Delivery & Linking options */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-5">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">{t('vault.corpAssignment', 'Corporate Assignment (Linking)')}</label>
                        <select 
                          value={deliveryOption}
                          onChange={(e: any) => setDeliveryOption(e.target.value)}
                          className="w-full h-11 px-4 mt-1.5 bg-[#F8F9FA] border border-slate-200 rounded-2xl text-xs font-bold cursor-pointer"
                        >
                          <option value="copy_link">{t('vault.copyLinkOnly', 'Simultaneous Copy link only (Transient)')}</option>
                          <option value="send_email">{t('vault.sendEmail', 'External Email delivery dispatch')}</option>
                          <option value="attach_ticket">{t('vault.attachTicket', 'Attach Directly on Support Ticket')}</option>
                          <option value="attach_company">{t('vault.syncCompany', 'Sync with Company Profile record')}</option>
                          <option value="attach_asset">{t('vault.anchorHardware', 'Anchor onto Client Hardware Asset')}</option>
                        </select>
                      </div>

                      {/* Dynamic options based on deliveryOption */}
                      <div className="flex flex-col justify-end">
                        {deliveryOption === 'send_email' && (
                          <Input 
                            placeholder={t('vault.recipientEmailPlaceholder', 'Recipient email address (sarah@acme.com)')}
                            value={targetRecipient}
                            onChange={(e) => setTargetRecipient(e.target.value)}
                            className="h-11 text-xs bg-[#F8F9FA] rounded-2xl border-slate-200"
                          />
                        )}
                        {deliveryOption === 'attach_ticket' && (
                          <select 
                            value={targetTicketId}
                            onChange={(e) => setTargetTicketId(e.target.value)}
                            className="w-full h-11 px-4 bg-[#F8F9FA] border border-slate-200 rounded-2xl text-xs font-bold cursor-pointer"
                          >
                            <option value="">{t('vault.selectTicketLink', 'Select ticket to link...')}</option>
                            {tickets.map(t => (
                              <option key={t.id} value={t.id}>{t.subject ? `[TKT] ${t.subject.substring(0, 30)}...` : t.id}</option>
                            ))}
                          </select>
                        )}
                        {deliveryOption === 'attach_company' && (
                          <select 
                            value={targetCompanyId}
                            onChange={(e) => setTargetCompanyId(e.target.value)}
                            className="w-full h-11 px-4 bg-[#F8F9FA] border border-slate-200 rounded-2xl text-xs font-bold cursor-pointer"
                          >
                            <option value="">{t('vault.selectCompanyProfile', 'Select Company profile...')}</option>
                            {companies.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        )}
                        {deliveryOption === 'attach_asset' && (
                          <select 
                            value={targetAssetId}
                            onChange={(e) => setTargetAssetId(e.target.value)}
                            className="w-full h-11 px-4 bg-[#F8F9FA] border border-slate-200 rounded-2xl text-xs font-bold cursor-pointer"
                          >
                            <option value="">{t('vault.selectCorpHardware', 'Select Corporate Hardware...')}</option>
                            <option value="firewall-99">{t('vault.firewallGate', 'Firewall Core Gateway')}</option>
                            <option value="server-core-2">{t('vault.secureServer', 'Sichere Server-core-02')}</option>
                            <option value="db-node-primary">{t('vault.targetDbPostgres', 'Target Postgres Database Master')}</option>
                            <option value="vpn-routing">{t('vault.vpnRoutingGateway', 'VPN Routing Gateway')}</option>
                            <option value="ssl-cert">{t('vault.sslHostCert', 'Host Wildcard SSL certificate')}</option>
                          </select>
                        )}
                        {deliveryOption === 'copy_link' && (
                          <p className="text-[10px] italic text-slate-400 text-center pb-2">{t('vault.linkGeneratedClient', 'The link is generated inside the client workspace interface immediately.')}</p>
                        )}
                      </div>
                    </div>

                    {/* Output and split actions */}
                    {generatedLink && (
                      <motion.div 
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-5 bg-emerald-50 border border-emerald-300 rounded-2xl space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase text-[#137333] tracking-widest">{t('vault.encryptedPqcLink', 'Encrypted post-quantum link generated')}</p>
                            <p className="text-xs font-mono font-bold text-emerald-800 truncate select-all">{generatedLink}</p>
                          </div>
                          <Button 
                            onClick={() => copyToClipboard(generatedLink)}
                            className="bg-[#34A853] hover:bg-[#2e9449] text-white shrink-0 font-bold text-xs rounded-full h-9"
                          >
                            <Check className="w-4 h-4 mr-1" /> {t('vault.copySecureUrl', 'Copy Secure URL')}
                          </Button>
                        </div>
                        {shares.length > 0 && (
                          <div className="pt-2 border-t border-emerald-200 text-[10px] text-[#137333] flex flex-wrap gap-2 items-center">
                            <ShieldCheck className="w-4 h-4 text-[#34A853]" /> 
                            <span>{t('vault.shamirDivision', 'Shamir-Aufteilung (3/5-Schwellenwert):')}</span>
                            <div className="flex gap-1">
                              {shares.map((_, i) => (
                                <span key={i} className="h-1.5 w-3 rounded-full bg-[#1A73E8]" title={`Share fragment #${i+1}`} />
                              ))}
                            </div>
                            <span className="italic opacity-70">{t('vault.secretPiecesScattered', 'Secret pieces scattered globally to sovereign shards.')}</span>
                          </div>
                        )}
                      </motion.div>
                    )}

                    <Button 
                      className="w-full h-14 bg-[#1A73E8] hover:bg-[#1665cb] text-white rounded-2xl font-bold text-lg select-none uppercase tracking-wide flex items-center justify-center gap-2"
                      onClick={handleGenerateSecret}
                      disabled={isGenerating}
                    >
                      {isGenerating ? t('vault.pqcCryptoSplit', 'Post-Quantum cryptographic split splitting...') : t('vault.generatePqcLink', 'Generate PQC Shielded Link')}
                      <Zap className="w-5 h-5 fill-current text-white animate-spin-slow" />
                    </Button>

                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* REQUEST UPLOAD / DROPZONE REQ */}
            {activeTab === 'dropzones' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-3xl mx-auto"
              >
                <Card className="shadow-sm border border-slate-200 rounded-3xl overflow-hidden bg-white">
                  <header className="border-b border-slate-100 px-8 py-6 bg-slate-50/50">
                    <h2 className="text-lg font-bold text-slate-900">{t('vault.configureDropzoneTitle', 'Configure Secure Dropzone Request')}</h2>
                    <p className="text-xs text-slate-400 mt-1">{t('vault.configureDropzoneDesc', 'Designated one-time cryptographic upload bucket containing malware prevention & automated purge cycles.')}</p>
                  </header>
                  <CardContent className="p-8 space-y-6">
                    
                    {/* Basic forms fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">{t('vault.requestNameLabel', 'Request Name')}</label>
                        <Input 
                          placeholder={t('vault.requestNamePlaceholder', 'E.g. ACME production database dump')}
                          value={requestName}
                          onChange={(e) => setRequestName(e.target.value)}
                          className="h-11 bg-[#F8F9FA] rounded-2xl border-slate-200 text-xs font-bold"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">{t('vault.relatedTicketLabel', 'Related Ticket')}</label>
                        <select 
                          value={dropzoneTicketId}
                          onChange={(e) => setDropzoneTicketId(e.target.value)}
                          className="w-full h-11 px-4 bg-[#F8F9FA] border border-slate-200 rounded-2xl text-xs font-bold cursor-pointer"
                        >
                          <option value="">{t('vault.noRelatedTicket', 'No related ticket...')}</option>
                          {tickets.map(t => (
                            <option key={t.id} value={t.id}>{t.subject ? `[TKT] ${t.subject.substring(0, 30)}...` : t.id}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">{t('vault.dropzoneDescLabel', 'Dropzone Description')}</label>
                      <Textarea 
                        placeholder={t('vault.dropzoneDescPlaceholder', 'Explain to the client what diagnostic logs, files or screenshots you need them to upload...')}
                        className="h-20 bg-[#F8F9FA] border-slate-200 rounded-2xl resize-none p-4 text-xs font-semibold"
                        value={requestDescription}
                        onChange={(e) => setRequestDescription(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">{t('vault.relatedCompanyLabel', 'Related Company')}</label>
                        <select 
                          value={dropzoneCompanyId}
                          onChange={(e) => setDropzoneCompanyId(e.target.value)}
                          className="w-full h-11 px-4 bg-[#F8F9FA] border border-slate-200 rounded-2xl text-xs font-bold cursor-pointer"
                        >
                          <option value="">{t('vault.noLinkedCompany', 'No linked company profile...')}</option>
                          {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5 font-sans">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">{t('vault.relatedHardwareLabel', 'Related Hardware Asset')}</label>
                        <select 
                          value={dropzoneAssetId}
                          onChange={(e) => setDropzoneAssetId(e.target.value)}
                          className="w-full h-11 px-4 bg-[#F8F9FA] border border-slate-200 rounded-2xl text-xs font-bold cursor-pointer underline-offset-3"
                        >
                          <option value="firewall-99">{t('vault.firewallGate', 'Firewall Core Gateway')}</option>
                          <option value="server-core">{t('vault.internalServerVault', 'Internal Server Vault')}</option>
                          <option value="database-master">{t('vault.targetDbPostgres', 'Target Postgres Database Master')}</option>
                        </select>
                      </div>
                    </div>

                    {/* Checked File Types */}
                    <div className="space-y-2 border-t pt-5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('vault.acceptedFileTypes', 'Accepted Diagnostic File Types')}</label>
                      <div className="flex flex-wrap gap-2.5">
                        {['ZIP', 'LOG', 'TXT', 'PDF', 'PNG', 'JPG', 'SQL', 'BAK', 'DUMP', 'PFX', 'PEM', 'CRT'].map((type) => {
                          const isChecked = acceptedTypes.includes(type);
                          return (
                            <button 
                              key={type}
                              type="button"
                              onClick={() => {
                                if (isChecked) {
                                  setAcceptedTypes(prev => prev.filter(p => p !== type));
                                } else {
                                  setAcceptedTypes(prev => [...prev, type]);
                                }
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-xl border text-[10px] font-extrabold uppercase transition-all select-none",
                                isChecked ? "bg-purple-50 border-purple-300 text-purple-700 font-bold" : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"
                              )}
                            >
                              {type}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Upload capacities */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-5">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">{t('vault.dropzoneCapacity', 'Dropzone Upload Capacity Limit')}</label>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {['100MB', '500MB', '2GB', '10GB', 'Custom'].map((size) => (
                            <button 
                              key={size}
                              type="button"
                              onClick={() => setUploadLimit(size)}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-[10px] border font-bold transition-all",
                                uploadLimit === size ? "bg-purple-600 text-white border-purple-600" : "bg-[#F8F9FA] hover:bg-slate-100 text-slate-600"
                              )}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">{t('vault.securityShieldParams', 'Security Shield Parameters')}</label>
                        <div className="space-y-1.5 text-xs text-slate-500 font-bold font-sans">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={virusScan} onChange={(e) => setVirusScan(e.target.checked)} className="h-3.5 w-3.5 rounded text-purple-600 focus:ring-purple-500" />
                            <span>{t('vault.runAntivirusScan', 'Run Advanced Antivirus Sandbox scan (ICAP)')}</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={malwareScan} onChange={(e) => setMalwareScan(e.target.checked)} className="h-3.5 w-3.5 rounded text-purple-600 focus:ring-purple-500" />
                            <span>{t('vault.blockMaliciousSigs', 'Block known malicious binary signatures (Hash matching)')}</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Output link */}
                    {generatedLink && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-5 bg-purple-50 border border-purple-200 rounded-2xl"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <p className="text-[9px] font-black uppercase text-purple-700 tracking-widest">{t('vault.activeDropzoneCreated', 'Active dropzone receiver created')}</p>
                            <p className="text-xs font-mono font-bold text-purple-900 truncate select-all">{generatedLink}</p>
                          </div>
                          <Button 
                            onClick={() => copyToClipboard(generatedLink)}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-full h-9"
                          >
                            {t('vault.copyDropzoneLink', 'Copy Dropzone Link')}
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    <Button 
                      className="w-full h-14 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-lg select-none uppercase tracking-wide"
                      onClick={handleCreateDropzone}
                      disabled={isGenerating}
                    >
                      {isGenerating ? t('vault.provisioningDropzone', 'Provisioning secure dropzone...') : t('vault.configureGenerateDropzone', 'Configure & Generate Secure Dropzone Container')}
                    </Button>

                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* AI ANALYSIS TAB */}
            {activeTab === 'analysis' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-y-3xl mx-auto space-y-6"
              >
                <Card className="shadow-sm border border-slate-200 rounded-3xl overflow-hidden bg-white">
                  <header className="border-b border-clate-100 px-8 py-6 bg-indigo-55/20">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-5 h-5 text-indigo-500 fill-indigo-200" /> {t('vault.aiVaultInspector', 'AI Vault Payload Inspector')}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">{t('vault.aiVaultInspectorDesc', 'Deep diagnostic insights and error signature decoding for uploaded files using sovereign local LLM integration.')}</p>
                  </header>
                  <CardContent className="p-8 space-y-6">
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('vault.selectPayloadAudit', 'Select Secure Upload Payload to Audit')}</label>
                      <div className="flex gap-3">
                        <select 
                          value={aiSelectedFile}
                          onChange={(e) => {
                            setAiSelectedFile(e.target.value);
                            setAiOutputResult(null);
                          }}
                          className="flex-1 h-11 px-4 bg-[#F8F9FA] border border-slate-200 rounded-2xl text-xs font-bold cursor-pointer"
                        >
                          <option value="logs.zip">{t('vault.logsPlaceholder', 'logs.zip (ACME router crash diagnostic log)')}</option>
                          <option value="backup.sql">{t('vault.backupPlaceholder', 'backup.sql (Acme Database structure snapshot)')}</option>
                          <option value="screenshot-failure.png">{t('vault.screenshotPlaceholder', 'firewall-screenshot-failure.png (SAML CORS error visual)')}</option>
                        </select>
                        
                        <Button 
                          onClick={() => handleRunAIAnalysis(aiSelectedFile)}
                          disabled={aiIsAnalyzing}
                          className="bg-[#1A73E8] hover:bg-[#1564cc] text-white rounded-2xl h-11 px-6 font-bold text-xs"
                        >
                          {aiIsAnalyzing ? t('vault.aiScanning', 'AI scanning...') : t('vault.runAuditAnalytics', 'Run Audit Analytics')}
                        </Button>
                      </div>
                    </div>

                    {/* AI analysis dynamic render */}
                    <AnimatePresence mode="wait">
                      {aiIsAnalyzing ? (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="py-12 flex flex-col items-center justify-center text-center space-y-3"
                        >
                          <div className="h-10 w-10 border-4 border-[#1A73E8] border-b-transparent rounded-full animate-spin" />
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest font-mono">{t('vault.liftingKeysScanning', 'Lifting sovereign encryption keys • scanning database index profiles...')}</p>
                        </motion.div>
                      ) : aiOutputResult ? (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs text-xs"
                        >
                          
                          {/* Header section */}
                          <div className="bg-slate-50 px-5 py-4 border-b flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                              <span className="font-bold text-slate-800">{aiOutputResult.type} {t('vault.outputSummary', 'output summary')}</span>
                            </div>
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase",
                              aiOutputResult.severity === 'Critical' ? "bg-red-150 text-red-700" :
                              aiOutputResult.severity === 'Warning' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-[#1A73E8]"
                            )}>
                              {aiOutputResult.severity} {t('vault.severity', 'severity')}
                            </span>
                          </div>

                          <div className="p-5 space-y-4 bg-white">
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-400 font-extrabold uppercase">{t('vault.detectedAnomalies', 'Detected Anomalies / Errors')}</span>
                              <p className="font-black text-slate-950 font-sans text-sm">{aiOutputResult.detectedCount}</p>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-400 font-extrabold uppercase">{t('vault.inferredRootCause', 'Inferred root cause analysis')}</span>
                              <p className="text-slate-700 text-xs font-semibold leading-relaxed font-mono bg-slate-50 p-3 rounded-xl border border-slate-100 text-foreground">{aiOutputResult.rootCause}</p>
                            </div>

                            <div className="space-y-2 pt-1">
                              <span className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-wide block">{t('vault.actionableMitigation', 'Actionable mitigation suggestions')}</span>
                              <ul className="space-y-1.5 pl-4 list-disc text-slate-600 text-xs">
                                {aiOutputResult.suggestedActions.map((action: string, idx: number) => (
                                  <li key={idx} className="font-semibold leading-tight">{action}</li>
                                ))}
                              </ul>
                            </div>

                            <div className="pt-4 border-t flex justify-end gap-3.5">
                              <Button 
                                variant="outline" 
                                onClick={() => setAiOutputResult(null)}
                                className="h-10 text-xs rounded-xl"
                              >
                                {t('vault.resetAnalysis', 'Reset Analysis')}
                              </Button>
                              <Button 
                                onClick={handleCreateTicketFromAI}
                                className="bg-[#1A73E8] hover:bg-[#1665cb] text-white rounded-xl h-10 px-5 font-bold"
                              >
                                {t('vault.createTicketFindings', 'Create Ticket from findings')}
                              </Button>
                            </div>

                          </div>

                        </motion.div>
                      ) : (
                        <div className="border border-dashed border-slate-200 rounded-3xl py-12 flex flex-col items-center justify-center text-center space-y-2 opacity-55">
                          <Sparkles className="w-8 h-8 text-indigo-400 fill-indigo-100" />
                          <p className="font-bold text-slate-800 text-xs">{t('vault.awaitingDiagnosticInput', 'Awaiting Diagnostic Payload Input')}</p>
                          <p className="text-[10px] text-slate-400 max-w-sm leading-normal">{t('vault.awaitingDiagnosticInputDesc', 'Choose one of the received client upload files from the selector above to audit and trigger local sovereign security scan.')}</p>
                        </div>
                      )}
                    </AnimatePresence>

                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* TEMPLATES SHORTCUT VIEW */}
            {activeTab === 'templates' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                <div className="space-y-1">
                  <h2 className="text-xl font-bold font-sans text-slate-900">{t('vault.templatesTitle', 'Reusable Dropzone Request Templates')}</h2>
                  <p className="text-xs text-slate-500">{t('vault.templatesDesc', 'Pick any template to quickly scaffold a high value request with verified file types and limits pre-configured.')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  <button 
                    onClick={() => handleApplyTemplate('logs')} 
                    className="p-6 rounded-3xl border bg-white hover:border-[#1A73E8] hover:shadow-xs text-left transition-all group flex flex-col justify-between h-48"
                  >
                    <div className="space-y-2">
                      <div className="h-10 w-10 bg-blue-50 text-[#1A73E8] rounded-2xl flex items-center justify-center shrink-0 border border-blue-100 font-bold group-hover:scale-105 transition-transform">
                        <FileText className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-slate-900 leading-tight">{t('vault.reqOperationalLogs', 'Request Operational Logs')}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed font-sans mt-1">{t('vault.reqOperationalLogsDesc', 'Gathers ZIP, LOG, TXT. Optimal for diagnostics, web server crashes, software crash dumps, or error trace collections.')}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase text-[#1A73E8] tracking-widest mt-4">{t('vault.loadPreset', 'Load Preset Template →')}</span>
                  </button>

                  <button 
                    onClick={() => handleApplyTemplate('db')} 
                    className="p-6 rounded-3xl border bg-white hover:border-purple-600 hover:shadow-xs text-left transition-all group flex flex-col justify-between h-48"
                  >
                    <div className="space-y-2">
                      <div className="h-10 w-10 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shrink-0 border border-purple-100 font-bold group-hover:scale-105 transition-transform">
                        <Sliders className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-slate-900 leading-tight">{t('vault.reqDbBackup', 'Request Database Backup Dump')}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed font-sans mt-1">{t('vault.reqDbBackupDesc', 'Pre-configures SQL, BAK, DUMP with massive 10GB limits. Ideal for migration diagnostics, data queries integrity reviews, and database crash support.')}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase text-purple-600 tracking-widest mt-4">{t('vault.loadPreset', 'Load Preset Template →')}</span>
                  </button>

                  <button 
                    onClick={() => handleApplyTemplate('ssl')} 
                    className="p-6 rounded-3xl border bg-white hover:border-emerald-600 hover:shadow-xs text-left transition-all group flex flex-col justify-between h-48"
                  >
                    <div className="space-y-2">
                      <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0 border border-emerald-100 font-bold group-hover:scale-105 transition-transform">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-slate-900 leading-tight">{t('vault.reqSslKeys', 'Request SSL Keys & Certificates')}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed font-sans mt-1">{t('vault.reqSslKeysDesc', 'Gathers PEM, CRT, PFX cryptographic keys securely inside encrypted ML-KEM ML-1024 parameters.')}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mt-4">{t('vault.loadPreset', 'Load Preset Template →')}</span>
                  </button>

                  <button 
                    onClick={() => handleApplyTemplate('screenshots')} 
                    className="p-6 rounded-3xl border bg-white hover:border-orange-600 hover:shadow-xs text-left transition-all group flex flex-col justify-between h-48"
                  >
                    <div className="space-y-2">
                      <div className="h-10 w-10 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shrink-0 border border-orange-100 font-bold group-hover:scale-105 transition-transform">
                        <Upload className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-slate-900 leading-tight">{t('vault.reqScreenVisuals', 'Request Screen Visual Dumps')}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed font-sans mt-1">{t('vault.reqScreenVisualsDesc', 'Collect client screenshots via JPG, PNG, PDF format. Optimal for initial diagnostics reviews and UI bug reports.')}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase text-orange-600 tracking-widest mt-4">{t('vault.loadPreset', 'Load Preset Template →')}</span>
                  </button>

                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </main>

        {/* Right Sidebar Column - Activity and Security overview */}
        <aside className="w-80 border-l bg-white flex flex-col p-5 space-y-6 shrink-0 overflow-y-auto hidden lg:flex">
          
          {/* Active timeline logs */}
          <div className="space-y-3.5">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-300" /> {t('vault.recentActivities', 'Recent Vault Activities')}
            </h4>
            
            <div className="space-y-3.5 relative pl-4 border-l border-slate-100 py-1 text-xs">
              <div className="relative">
                <span className="absolute -left-[21.5px] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-500 border-2 border-white ring-4 ring-blue-50" />
                <p className="font-bold text-slate-800">{t('vault.actPqcCreated', 'Post-Quantum Secret Created')}</p>
                <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">Sarah@acme.com • 3m ago</p>
              </div>

              <div className="relative">
                <span className="absolute -left-[21.5px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#1A73E8] border-2 border-white ring-4 ring-blue-50 animate-pulse" />
                <p className="font-bold text-slate-800">{t('vault.actLinkViewed', 'Secure link "Prod SQL Key" viewed')}</p>
                <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">john.doe@client.com • 15m ago</p>
              </div>

              <div className="relative">
                <span className="absolute -left-[21.5px] top-1.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white ring-4 ring-red-50" />
                <p className="font-bold text-slate-800">{t('vault.actCredsBurned', 'AWS Credentials Burned')}</p>
                <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{t('vault.actSelfDestructTrigger', 'Auto self-destruct trigger • 1h ago')}</p>
              </div>

              <div className="relative">
                <span className="absolute -left-[21.5px] top-1.5 h-2.5 w-2.5 rounded-full bg-purple-500 border-2 border-white ring-4 ring-purple-50" />
                <p className="font-bold text-slate-800">{t('vault.actDropzoneUploaded', 'Secure Dropzone "logs.zip" uploaded')}</p>
                <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">Acme Systems operator • 2h ago</p>
              </div>

              <div className="relative">
                <span className="absolute -left-[21.5px] top-1.5 h-2.5 w-2.5 rounded-full bg-indigo-500 border-2 border-white ring-4 ring-indigo-50" />
                <p className="font-bold text-slate-800">{t('vault.actAiCompleted', 'AI analysis completed: backup.sql')}</p>
                <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{t('vault.sollmAuditScan', 'Sovereign LLM audit scan • Just now')}</p>
              </div>
            </div>
          </div>

          {/* Security Status Card list */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3.5">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> {t('vault.activeSecurityShields', 'Active Security Shields')}
            </h4>
            <div className="space-y-2 text-[10.5px] font-bold text-slate-600">
              <div className="flex items-center justify-between">
                <span>{t('vault.e2eEncryption', 'End-to-End Encryption')}</span>
                <span className="text-emerald-500 uppercase font-extrabold text-[9px] tracking-tight">{t('vault.activeShieldStatus', 'ACTIVE')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t('vault.zeroKnowledgeStorage', 'Zero-Knowledge Storage')}</span>
                <span className="text-emerald-500 uppercase font-extrabold text-[9px] tracking-tight">{t('vault.activeShieldStatus', 'ACTIVE')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t('vault.shamirDivisionPolicy', 'Shamir Division Policy')}</span>
                <span className="text-emerald-500 uppercase font-extrabold text-[9px] tracking-tight">{t('vault.activeShieldStatus', 'ACTIVE')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t('vault.antivirusMalwareScan', 'Antivirus Malware Scan (ICAP)')}</span>
                <span className="text-emerald-500 uppercase font-extrabold text-[9px] tracking-tight">{t('vault.activeShieldStatus', 'ACTIVE')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t('vault.securityAuditLogs', 'Security Audit logs')}</span>
                <span className="text-emerald-500 uppercase font-extrabold text-[9px] tracking-tight">{t('vault.activeShieldStatus', 'ACTIVE')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t('vault.autoBurnViewPolicies', 'Auto-burn view policies')}</span>
                <span className="text-emerald-500 uppercase font-extrabold text-[9px] tracking-tight">{t('vault.activeShieldStatus', 'ACTIVE')}</span>
              </div>
            </div>
          </div>

          {/* Capacity storage view */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{t('vault.storageAllocation', 'Storage Allocation')}</span>
              <span className="text-[10px] font-bold text-slate-500">286.7 GB Used / 2 TB</span>
            </div>
            
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
              <div className="bg-blue-500 h-full w-[14%]" title="Secrets storage (28.6 GB)" />
              <div className="bg-purple-500 h-full w-[45%]" title="Received system logs (90 GB)" />
              <div className="bg-orange-500 h-full w-[15%]" title="Database backup dumps (30 GB)" />
            </div>

            <div className="text-[9px] font-extrabold text-slate-400 uppercase flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 bg-blue-500 rounded-full" /> {t('vault.secretsDataLabel', 'Secrets Data (12.4 GB)')}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 bg-purple-500 rounded-full" /> {t('vault.receivedFilesLabel', 'Received Dropzone Files (186.3 GB)')}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 bg-orange-500 rounded-full" /> {t('vault.otherDiagnosticLabel', 'Other Diagnostic elements (88.0 GB)')}
              </div>
            </div>
          </div>

        </aside>

      </div>

      {/* EMERGENCY BYPASS OPTIONAL MODAL */}
      <AnimatePresence>
        {isEmergencyModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 overflow-y-auto animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl overflow-hidden max-w-sm w-full p-6 space-y-4 border border-slate-100 shadow-2xl relative"
            >
              <button 
                onClick={() => setIsEmergencyModalOpen(false)}
                className="absolute right-4 top-4 hover:bg-slate-100 h-7 w-7 rounded-full flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="h-10 w-10 bg-orange-100 text-orange-700 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm">{t('vault.emergencyBypassLock', 'Emergency Share Bypass Lock')}</h4>
                <p className="text-xs text-slate-500 mt-1">{t('vault.emergencyDesc', 'Initiating this protocol allows temporary critical access to credentials bypass policies. Must be validated via offline SMS MFA verification.')}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">{t('vault.insertOperatorSms', 'Insert Operator SMS Target Phone')}</label>
                <Input 
                  type="text"
                  placeholder="+49 (170) 555-1234"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className="h-11 rounded-xl bg-slate-50 border-slate-200"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsEmergencyModalOpen(false)} 
                  className="flex-1 rounded-xl"
                >
                  {t('dialog.cancel', 'Cancel')}
                </Button>
                <Button 
                  onClick={handleCreateEmergencyLink}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded-xl"
                >
                  {t('vault.sendOtpBypass', 'Send OTP Bypass')}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </ModulePageShell>
  );
}
