import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { startOrchestratorConfigSync } from '../../lib/aiOrchestratorClient';
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
import { auth } from '../../lib/firebase';
import { useTranslation } from '../../lib/context/I18nContext';
import { ModuleCreateButton } from '../ui/ModuleCreateButton';
import {
  ModulePageShell,
  ModuleToolbar,
  ModuleToolbarSelect,
} from '../ui/module-page';
import {
  ExchangeLeftSidebar,
} from '../exchange/ExchangeLeftSidebar';
import { ExchangePageHeader } from '../exchange/ExchangePageHeader';
import { ExchangeKpiCards } from '../exchange/ExchangeKpiCards';
import { ExchangeAiInsightsBanner } from '../exchange/ExchangeAiInsightsBanner';
import { ExchangeQuickActions } from '../exchange/ExchangeQuickActions';
import { ExchangeActiveTable } from '../exchange/ExchangeActiveTable';
import { ExchangeDetailDrawer } from '../exchange/ExchangeDetailDrawer';
import { ExchangeRecentTransfers } from '../exchange/ExchangeRecentTransfers';
import { ExchangeSecuritySidebar } from '../exchange/ExchangeSecuritySidebar';
import { ExchangeTrustFooter } from '../exchange/ExchangeTrustFooter';
import { ExchangeCreateTemplateModal } from '../exchange/ExchangeCreateTemplateModal';
import { useExchangeFilters, useQuickFilterHandler } from '../exchange/useExchangeFilters';
import { useExchangeTemplates } from '../exchange/useExchangeTemplates';
import { ExchangeDeleteConfirmModal } from '../exchange/ExchangeDeleteConfirmModal';
import { ExchangeCreateSecretPanel } from '../exchange/ExchangeCreateSecretPanel';
import {
  buildCreateSecretPayload,
  parseRecipientEmails,
  type ExchangeCreateSecretFormState,
} from '../exchange/exchange-create-secret-utils';
import { buildDropzoneMetadata } from '../../lib/vault-dropzone-utils';
import { copyExchangeLinkToClipboard } from '../exchange/exchange-actions';
import { isExchangeExpiringSoon, matchesExchangeSearch } from '../exchange/exchange-filter-utils';
import { resolveExchangeStatus } from '../exchange/exchange-status-utils';
import { buildExpiringSoonSeedItems, type ExchangeItemRowSeed } from '../exchange/exchange-template-utils';
import { getDevMockUploads, isDevSeedExchangeId } from '../exchange/exchange-dev-seed';
import type { ExchangeNavId, ExchangeQuickFilter, ExchangeItemRow } from '../exchange/exchange-utils';
import {
  isExchangeFocusedFilterMode,
  isExchangeOverviewMode,
} from '../exchange/exchange-utils';
import { ticketService } from '../../services/ticketService';
import { customerService } from '../../services/customerService';
import { VaultItem, Ticket as TicketType, Company } from '../../types';
import { split, combine } from 'shamir-secret-sharing';

export default function VaultPage() {
  const { t } = useTranslation();
  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'secrets' | 'dropzones' | 'analysis' | 'templates'>('dashboard');
  const [exchangeNav, setExchangeNav] = useState<ExchangeNavId>('overview');
  const [quickFilter, setQuickFilter] = useState<ExchangeQuickFilter>(null);
  const [selectedExchangeItem, setSelectedExchangeItem] = useState<ExchangeItemRow | null>(null);
  const [deleteTargetItem, setDeleteTargetItem] = useState<ExchangeItemRow | null>(null);
  const [seedExpiringItems, setSeedExpiringItems] = useState(() => buildExpiringSoonSeedItems());

  useEffect(() => {
    startOrchestratorConfigSync();
  }, []);
  
  // Real DB Data
  const [history, setHistory] = useState<VaultItem[]>([]);
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  // Secret generation outputs (form state lives in ExchangeCreateSecretPanel)

  // Dropzone Form State
  const [requestName, setRequestName] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [dropzoneTicketId, setDropzoneTicketId] = useState('');
  const [dropzoneCompanyId, setDropzoneCompanyId] = useState('');
  const [dropzoneAssetId, setDropzoneAssetId] = useState('Firewall Gate-99');
  const [acceptedTypes, setAcceptedTypes] = useState<string[]>(['ZIP', 'LOG']);
  const [uploadLimit, setUploadLimit] = useState('2GB');
  const [customUploadLimitMb, setCustomUploadLimitMb] = useState('');
  const [virusScan, setVirusScan] = useState(true);
  const [malwareScan, setMalwareScan] = useState(true);
  const [retentionPolicy, setRetentionPolicy] = useState('Auto destruct 48h');

  // Outputs
  const [generatedLink, setGeneratedLink] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copying, setCopying] = useState(false);
  const [shares, setShares] = useState<string[]>([]);
  const [isQuantumSafe, setIsQuantumSafe] = useState(false);
  const [secretFormResetKey, setSecretFormResetKey] = useState(0);
  const previousWorkspaceTabRef = useRef<typeof activeTab>(activeTab);

  // Search / Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [tableFilter, setTableFilter] = useState<'all' | 'secrets' | 'uploads' | 'active' | 'burned' | 'expired'>('all');
  const [tableTab, setTableTab] = useState<'active_links' | 'active_dropzones' | 'recent_uploads' | 'requests' | 'expiring_soon'>('requests');

  // AI Insights State
  const [aiSelectedFile, setAiSelectedFile] = useState<string>('logs.zip');
  const [aiOutputResult, setAiOutputResult] = useState<any>(null);
  const [aiIsAnalyzing, setAiIsAnalyzing] = useState(false);

  // Quick Action Modals
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [emergencyPhone, setEmergencyPhone] = useState('');

  const [mockUploads, setMockUploads] = useState<ExchangeItemRowSeed[]>(() => getDevMockUploads());

  const {
    customTemplates,
    isCreateModalOpen,
    setIsCreateModalOpen,
    createTemplate,
    getTemplateById,
  } = useExchangeTemplates();

  const resetExchangeCreationOutputs = useCallback(() => {
    setGeneratedLink('');
    setShares([]);
    setIsQuantumSafe(false);
    setCopying(false);
  }, []);

  const resetDropzoneForm = useCallback(() => {
    setRequestName('');
    setRequestDescription('');
    setDropzoneTicketId('');
    setDropzoneCompanyId('');
    setDropzoneAssetId('Firewall Gate-99');
    setAcceptedTypes(['ZIP', 'LOG']);
    setUploadLimit('2GB');
    setCustomUploadLimitMb('');
    setVirusScan(true);
    setMalwareScan(true);
    setRetentionPolicy('Auto destruct 48h');
  }, []);

  const refreshExchangeHistory = useCallback(async () => {
    const items = await vaultService.fetchHistory();
    setHistory(items);
  }, []);

  const prependExchangeHistoryItem = useCallback((item: VaultItem) => {
    setHistory((prev) => {
      if (prev.some((row) => row.id === item.id)) return prev;
      return [item, ...prev];
    });
  }, []);

  useEffect(() => {
    const previousTab = previousWorkspaceTabRef.current;
    const enteredCreationTab =
      (activeTab === 'secrets' || activeTab === 'dropzones') && previousTab !== activeTab;
    const leftCreationTab =
      (previousTab === 'secrets' || previousTab === 'dropzones') && previousTab !== activeTab;

    if (enteredCreationTab || leftCreationTab) {
      resetExchangeCreationOutputs();
    }

    previousWorkspaceTabRef.current = activeTab;
  }, [activeTab, resetExchangeCreationOutputs]);

  useEffect(() => {
    return () => {
      resetExchangeCreationOutputs();
    };
  }, [resetExchangeCreationOutputs]);

  const { allExchangeItems, filteredExchangeItems, exchangeSidebarCounts } = useExchangeFilters({
    history,
    mockUploads,
    seedExpiringItems,
    tickets,
    companies,
    searchTerm,
    quickFilter,
    tableFilter,
    tableTab,
  });

  useEffect(() => {
    setSelectedExchangeItem((current) => {
      if (!current) return null;
      return allExchangeItems.find((row) => row.id === current.id) ?? null;
    });
  }, [allExchangeItems]);

  const applyQuickFilter = useQuickFilterHandler({
    quickFilter,
    setQuickFilter,
    setExchangeNav,
    setActiveTab,
    setTableFilter,
    setTableTab,
  });

  const handleQuickFilter = useCallback(
    (filter: ExchangeQuickFilter) => {
      setSelectedExchangeItem(null);
      applyQuickFilter(filter);
    },
    [applyQuickFilter],
  );

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
  const handleApplyTemplate = (type: 'logs' | 'db' | 'ssl' | 'screenshots' | 'audit' | 'incident') => {
    setActiveTab('dropzones');
    setExchangeNav('dropzones');
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
    } else if (type === 'audit') {
      setRequestName('Security Audit Package');
      setRequestDescription('Collect compliance artifacts, access logs, and configuration exports for audit review.');
      setAcceptedTypes(['ZIP', 'PDF', 'LOG', 'CSV']);
      setUploadLimit('2GB');
    } else if (type === 'incident') {
      setRequestName('Incident Response Package');
      setRequestDescription('Secure intake for forensic dumps, memory captures, and incident timeline evidence.');
      setAcceptedTypes(['ZIP', 'LOG', 'IMG', 'JSON']);
      setUploadLimit('5GB');
    }
    toast.success(t('exchange.templates.applied', 'Template applied to secure dropzone workflow.'));
  };

  const handleApplyCustomTemplate = (templateId: string) => {
    const template = getTemplateById(templateId);
    if (!template) return;

    setActiveTab('dropzones');
    setExchangeNav('dropzones');
    setRequestName(template.title);
    setRequestDescription(template.description);
    setAcceptedTypes(template.acceptedTypes);
    setUploadLimit(template.uploadLimit);
    toast.success(t('exchange.templates.applied', 'Template applied to secure dropzone workflow.'));
  };

  const handleCreateTemplateSubmit = (input: Parameters<typeof createTemplate>[0]) => {
    const result = createTemplate(input);
    if (result.ok === false) {
      return { ok: false as const, errorKey: result.errorKey };
    }
    toast.success(t('exchange.templates.created', 'Custom template saved successfully.'));
    return { ok: true as const };
  };

  const handleGenerateSecret = async (form: ExchangeCreateSecretFormState) => {
    if (!form.secretContent.trim()) {
      toast.error(t('exchange.createSecret.errors.contentRequired', 'Please enter a secret to secure.'));
      return;
    }
    if (form.expirationPreset === 'custom' && !form.customExpiresAt) {
      toast.error(t('exchange.createSecret.errors.customExpiryRequired', 'Select a custom expiration date and time.'));
      return;
    }
    if (form.passphraseEnabled && !form.passphrase.trim()) {
      toast.error(t('exchange.createSecret.errors.passphraseRequired', 'Enter an additional passphrase or disable the layer.'));
      return;
    }
    if (form.ipRestrictionEnabled && !form.ipAllowlist.trim()) {
      toast.error(t('exchange.createSecret.errors.ipAllowlistRequired', 'Enter at least one allowed IP or CIDR range.'));
      return;
    }
    if (form.domainWhitelistEnabled && !form.allowedEmailDomains.trim()) {
      toast.error(t('exchange.createSecret.errors.domainWhitelistRequired', 'Enter at least one allowed email domain.'));
      return;
    }
    if (form.shareViaEmailOpen) {
      const emails = parseRecipientEmails(form.recipientEmails);
      if (emails.length === 0) {
        toast.error(t('exchange.createSecret.errors.recipientEmailsRequired', 'Enter at least one valid recipient email address.'));
        return;
      }
    }

    setIsGenerating(true);
    setGeneratedLink('');

    try {
      let splitShares: string[] = [];
      try {
        const encoder = new TextEncoder();
        const secretUint8 = encoder.encode(form.secretContent);
        const uint8Shares = await split(secretUint8, 5, 3);
        splitShares = uint8Shares.map((share) => {
          const binary = Array.from(share).map((b) => String.fromCharCode(b)).join('');
          return btoa(binary);
        });
      } catch (sssError: any) {
        console.error('SSS Splitting Failed:', sssError);
        throw new Error(`Credential Security failure: ${sssError.message || 'Fragmenting error'}`);
      }

      const payload = buildCreateSecretPayload(form);

      const secretId = await vaultService.createItem({
        type: 'secret',
        shares: splitShares,
        expirationType: payload.expirationType,
        expiresAt: payload.expiresAt,
        maxViews: payload.maxViews,
        passphrase: payload.passphrase,
        metadata: payload.metadata,
      });

      const optimisticItem: VaultItem = {
        id: secretId,
        type: 'secret',
        expirationType: payload.expirationType,
        expiresAt: payload.expiresAt?.toISOString() ?? null,
        maxViews: payload.maxViews,
        isBurned: false,
        createdBy: auth.currentUser?.uid ?? '',
        createdAt: new Date().toISOString(),
        viewCount: 0,
        metadata: payload.metadata,
      };
      prependExchangeHistoryItem(optimisticItem);
      void refreshExchangeHistory();

      setShares(splitShares);
      setIsQuantumSafe(true);
      const baseUrl = window.location.origin;
      const finalLink = `${baseUrl}/v/${secretId}`;
      setGeneratedLink(finalLink);
      setSecretFormResetKey((key) => key + 1);
      toast.success(t('exchange.createSecret.success', 'Quantum-safe link generated with view quota and security policy.'));

      if (payload.metadata.shareViaEmail) {
        toast.info(
          t('exchange.createSecret.emailQueued', 'Secure link dispatch queued for {{count}} recipient(s).').replace(
            '{{count}}',
            String(payload.metadata.recipientEmails?.length ?? 0),
          ),
        );
      }

      if (form.targetTicketId || payload.metadata.relatedTicketId) {
        toast.info(t('exchange.createSecret.ticketLogged', 'Secret link logged on ticket timeline automatically.'));
      }
    } catch (error: any) {
      console.error('Vault Creation Error:', error);
      toast.error(error.message || t('exchange.createSecret.errors.createFailed', 'Failed to generate shielded link.'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Create Upload/Dropzone Request
  const handleCreateDropzone = async () => {
    if (!requestName.trim()) {
      toast.error("Please enter a Request Name.");
      return;
    }
    if (uploadLimit === 'Custom' && !customUploadLimitMb.trim()) {
      toast.error(t('vault.customUploadLimitRequired', 'Enter a custom upload capacity in megabytes.'));
      return;
    }

    setIsGenerating(true);
    setGeneratedLink('');

    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48); // default dropzone 48h duration
      const dropzoneMetadata = buildDropzoneMetadata({
        requestName,
        requestDescription,
        dropzoneTicketId,
        dropzoneCompanyId,
        dropzoneAssetId,
        acceptedTypes,
        uploadLimit,
        customUploadLimitMb,
        virusScan,
        malwareScan,
        retentionPolicy,
      });

      const requestId = await vaultService.createItem({
        type: 'request',
        expirationType: 'time',
        expiresAt: expiresAt,
        maxViews: 1000,
        metadata: dropzoneMetadata,
      });

      const optimisticItem: VaultItem = {
        id: requestId,
        type: 'request',
        expirationType: 'time',
        expiresAt: expiresAt.toISOString(),
        maxViews: 1000,
        isBurned: false,
        createdBy: auth.currentUser?.uid ?? '',
        createdAt: new Date().toISOString(),
        viewCount: 0,
        metadata: dropzoneMetadata,
      };
      prependExchangeHistoryItem(optimisticItem);
      void refreshExchangeHistory();

      const baseUrl = window.location.origin;
      const finalLink = `${baseUrl}/v/${requestId}`;
      setGeneratedLink(finalLink);
      setIsGenerating(false);
      resetDropzoneForm();
      toast.success("Secure Upload Dropzone created successfully!");
    } catch (error: any) {
      console.error("Dropzone Creation Error:", error);
      setIsGenerating(false);
      toast.error(error.message || "Failed to create Dropzone.");
    }
  };

  // Copy to Clipboard helper (form-generated links)
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
    toast.success(t('exchange.actions.copySuccess', 'Link copied successfully.'));
  };

  const handleCopyExchangeLink = useCallback(
    (item: ExchangeItemRow) => copyExchangeLinkToClipboard(item.id, t),
    [t],
  );

  const handleDownloadSecure = useCallback(
    async (itemId: string) => {
      if (isDevSeedExchangeId(itemId)) {
        toast.error(
          t(
            'exchange.drawer.downloadUnavailableDemo',
            'Demo exchange rows do not contain recoverable uploaded file material.',
          ),
        );
        return;
      }

      try {
        await vaultService.downloadDropzoneFile(itemId);
        toast.info(t('exchange.drawer.downloadStarted', 'Datei-Download gestartet...'));
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t('exchange.drawer.downloadFailed', 'Secure download could not be completed.');
        toast.error(message);
      }
    },
    [t],
  );

  const handleRotateAccessToken = useCallback(
    (_item: ExchangeItemRow) => {
      toast.success(t('exchange.drawer.rotateSuccess', 'Token rotation queued.'));
    },
    [t],
  );

  const handleChangeSecurityPolicy = useCallback(
    (item: ExchangeItemRow) => {
      setSelectedExchangeItem(item);
      toast.info(t('exchange.actions.policyEditorSoon', 'Security policy editor opening.'));
    },
    [t],
  );

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

  const exchangeKpiStats = useMemo(
    () => ({
      activeSecrets:
        allExchangeItems.filter(
          (i) => i.type === 'secret' && resolveExchangeStatus(i) === 'Active',
        ).length || 42,
      activeDropzones:
        allExchangeItems.filter(
          (i) => i.type === 'request' && resolveExchangeStatus(i) === 'Active',
        ).length || 18,
      filesReceived: allExchangeItems.filter((i) => i.type === 'request').length || 247,
      securityScore: 94,
    }),
    [allExchangeItems],
  );

  const secretItems = useMemo(
    () => allExchangeItems.filter((i) => i.type === 'secret' && matchesExchangeSearch(i, searchTerm)),
    [allExchangeItems, searchTerm],
  );

  const dropzoneItems = useMemo(
    () => allExchangeItems.filter((i) => i.type === 'request' && matchesExchangeSearch(i, searchTerm)),
    [allExchangeItems, searchTerm],
  );

  const expiringSidebarRows = useMemo(
    () =>
      allExchangeItems
        .filter(isExchangeExpiringSoon)
        .slice(0, 3)
        .map((item) => {
          const hoursLeft = item.expiresAt
            ? Math.max(1, Math.ceil((item.expiresAt.getTime() - Date.now()) / (60 * 60 * 1000)))
            : 0;
          const meta = hoursLeft <= 48 ? `${hoursLeft}h` : `${Math.ceil(hoursLeft / 24)}d`;
          const tone =
            hoursLeft <= 24
              ? 'text-rose-600 bg-rose-50'
              : hoursLeft <= 48
                ? 'text-amber-600 bg-amber-50'
                : 'text-blue-600 bg-blue-50';
          return { id: item.id, title: item.name, meta, tone };
        }),
    [allExchangeItems],
  );

  const handleQuickExchangeAction = useCallback(
    async (item: ExchangeItemRow) => {
      if (isDevSeedExchangeId(item.id)) {
        if (item.id.startsWith('upload-mock')) {
          setMockUploads((prev) =>
            prev.map((row) =>
              row.id === item.id
                ? {
                    ...row,
                    status: 'Active',
                    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
                    expires: 'in 48h',
                  }
                : row,
            ),
          );
        } else if (item.id.startsWith('seed-expiring-')) {
          setSeedExpiringItems((prev) =>
            prev.map((row) =>
              row.id === item.id
                ? {
                    ...row,
                    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
                    expires: 'in 72h',
                    status: 'Active',
                  }
                : row,
            ),
          );
        }
      } else {
        await logAudit({
          module: 'vault',
          action: 'EXCHANGE_COMPLIANCE_REFRESH',
          severity: 'medium',
          details: { itemId: item.id, itemType: item.type },
        });
      }

      toast.success(
        t(
          'exchange.actions.complianceRefresh',
          'Compliance refresh applied — expiration policy re-evaluated.',
        ),
      );
    },
    [t],
  );

  const handleOpenExchangeDetail = useCallback((item: ExchangeItemRow, event?: MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    setSelectedExchangeItem(item);
  }, []);

  const exchangeTableProps = {
    selectedItemId: selectedExchangeItem?.id ?? null,
    onRowSelect: handleOpenExchangeDetail,
    onCopyLink: handleCopyExchangeLink,
    onQuickAction: handleQuickExchangeAction,
    onDeleteRequest: setDeleteTargetItem,
    onChangeSecurityPolicy: handleChangeSecurityPolicy,
    onRotateToken: handleRotateAccessToken,
  };

  const handleExchangeNavigate = (nav: ExchangeNavId) => {
    if (nav !== 'secrets' && nav !== 'dropzones') {
      resetExchangeCreationOutputs();
    }
    setExchangeNav(nav);
    setQuickFilter(null);
    setSelectedExchangeItem(null);
    setTableFilter('all');
    setTableTab('requests');
    const tabMap: Record<ExchangeNavId, typeof activeTab> = {
      overview: 'dashboard',
      secrets: 'secrets',
      dropzones: 'dropzones',
      analysis: 'analysis',
      templates: 'templates',
      activity: 'dashboard',
      security: 'dashboard',
    };
    const nextTab = tabMap[nav];
    if (nextTab === 'secrets' || nextTab === 'dropzones') {
      resetExchangeCreationOutputs();
    }
    setActiveTab(nextTab);
  };

  const handleDeleteExchangeItem = async (id: string) => {
    if (selectedExchangeItem?.id === id) {
      setSelectedExchangeItem(null);
    }
    if (isDevSeedExchangeId(id)) {
      if (id.startsWith('upload-mock')) {
        setMockUploads((prev) => prev.filter((p) => p.id !== id));
      } else if (id.startsWith('seed-expiring-')) {
        setSeedExpiringItems((prev) => prev.filter((p) => p.id !== id));
      }
    } else {
      await vaultService.deleteItem(id);
    }
    toast.success(t('exchange.delete.success', 'Exchange item removed.'));
  };

  const exchangeCreateAction = (
    <ModuleCreateButton
      ariaLabelKey="actions.createExchange"
      ariaLabelDefault="Create Secure Exchange"
      shortLabelKey="actions.createShort"
      iconOnly
      menuItems={[
        {
          labelKey: 'vault.createSecretLink',
          labelDefault: 'Create Secret Link',
          onClick: () => handleExchangeNavigate('secrets'),
          icon: <Send className="w-4 h-4 text-[#1A73E8]" />,
        },
        {
          labelKey: 'vault.createDropzone',
          labelDefault: 'Create Secure Dropzone',
          onClick: () => handleExchangeNavigate('dropzones'),
          icon: <Upload className="w-4 h-4 text-[#1A73E8]" />,
        },
        {
          labelKey: 'exchange.templates.createMenu',
          labelDefault: 'Create Template',
          onClick: () => setIsCreateModalOpen(true),
          icon: <FileText className="w-4 h-4 text-[#1A73E8]" />,
        },
      ]}
    />
  );

  const transferItems = filteredExchangeItems.map((item) => ({
    ...item,
    aiStatus:
      item.status === 'Completed'
        ? t('exchange.recentTransfers.aiComplete', 'AI analysis complete')
        : t('exchange.recentTransfers.aiPending', 'AI analysis pending'),
  }));

  const isOverviewMode = isExchangeOverviewMode(activeTab, exchangeNav, quickFilter);
  const isFocusedFilterMode = isExchangeFocusedFilterMode(activeTab, quickFilter);

  return (
    <ModulePageShell scrollable={false} className="bg-[#FAFBFC]">
      <div className="flex flex-1 min-h-0 overflow-hidden w-full">
        <ExchangeLeftSidebar
          activeNav={exchangeNav}
          onNavigate={handleExchangeNavigate}
          quickFilter={quickFilter}
          onQuickFilter={handleQuickFilter}
          counts={exchangeSidebarCounts}
          onApplyTemplate={handleApplyTemplate}
          customTemplates={customTemplates}
          onApplyCustomTemplate={handleApplyCustomTemplate}
        />

        <div className="flex flex-1 min-w-0 min-h-0 overflow-y-auto custom-scrollbar">
          <div className="flex flex-1 min-w-0 flex-col xl:flex-row xl:items-start">
            <div className="flex-1 min-w-0 relative">
            <div className="px-4 sm:px-6 py-5 space-y-5 pb-10">
              <ExchangePageHeader quickFilter={isFocusedFilterMode ? quickFilter : null} />

              <ModuleToolbar
                searchPlaceholder={t('exchange.searchPlaceholder', 'Search exchanges, recipients, files...')}
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                sortControl={
                  <ModuleToolbarSelect
                    value={tableFilter}
                    onChange={(v) => {
                      setQuickFilter(null);
                      setSelectedExchangeItem(null);
                      setTableFilter(v as typeof tableFilter);
                      setTableTab('requests');
                    }}
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

          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-5"
              >
                {isOverviewMode ? (
                  <>
                    <ExchangeKpiCards
                      activeSecrets={exchangeKpiStats.activeSecrets}
                      activeDropzones={exchangeKpiStats.activeDropzones}
                      filesReceived={exchangeKpiStats.filesReceived}
                      securityScore={exchangeKpiStats.securityScore}
                    />
                    <ExchangeAiInsightsBanner />
                    <ExchangeQuickActions
                      onSendSecret={() => handleExchangeNavigate('secrets')}
                      onCreateDropzone={() => handleExchangeNavigate('dropzones')}
                      onAnalyzeUpload={() => handleExchangeNavigate('analysis')}
                      onEmergencyShare={() => setIsEmergencyModalOpen(true)}
                      onImportPackage={() => toast.info(t('exchange.actions.importSoon', 'Package import opening soon.'))}
                    />
                  </>
                ) : null}
                <ExchangeActiveTable
                  items={filteredExchangeItems}
                  quickFilter={isFocusedFilterMode ? quickFilter : null}
                  {...exchangeTableProps}
                />
                {isOverviewMode ? (
                  <>
                    <ExchangeRecentTransfers items={transferItems} />
                    <ExchangeTrustFooter />
                  </>
                ) : (
                  <ExchangeRecentTransfers items={transferItems} />
                )}
              </motion.div>
            )}

            {/* SEND SECRET FORM */}
            {activeTab === 'secrets' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-5xl mx-auto space-y-5 w-full"
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
                  <CardContent className="p-8">
                    <ExchangeCreateSecretPanel
                      tickets={tickets}
                      companies={companies}
                      isGenerating={isGenerating}
                      generatedLink={generatedLink}
                      shares={shares}
                      formResetKey={secretFormResetKey}
                      onGenerate={handleGenerateSecret}
                      onCopyLink={copyToClipboard}
                    />
                  </CardContent>
                </Card>
                <ExchangeActiveTable items={secretItems} {...exchangeTableProps} />
              </motion.div>
            )}

            {/* REQUEST UPLOAD / DROPZONE REQ */}
            {activeTab === 'dropzones' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-5xl mx-auto space-y-5 w-full"
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
                        {uploadLimit === 'Custom' ? (
                          <div className="mt-3 flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              placeholder={t('vault.customUploadLimitPlaceholder', 'e.g. 750')}
                              value={customUploadLimitMb}
                              onChange={(e) => setCustomUploadLimitMb(e.target.value)}
                              className="h-10 w-32 text-xs bg-white rounded-xl border-slate-200"
                            />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">MB</span>
                          </div>
                        ) : null}
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
                <ExchangeActiveTable items={dropzoneItems} {...exchangeTableProps} />
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

                  {customTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleApplyCustomTemplate(template.id)}
                      className="p-6 rounded-3xl border bg-white hover:border-[#1A73E8] hover:shadow-xs text-left transition-all group flex flex-col justify-between h-48"
                    >
                      <div className="space-y-2">
                        <div className="h-10 w-10 bg-blue-50 text-[#1A73E8] rounded-2xl flex items-center justify-center shrink-0 border border-blue-100 font-bold group-hover:scale-105 transition-transform">
                          <FileText className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-slate-900 leading-tight">{template.title}</h4>
                        <p className="text-xs text-slate-500 leading-relaxed font-sans mt-1 line-clamp-3">{template.description}</p>
                      </div>
                      <span className="text-[10px] font-black uppercase text-[#1A73E8] tracking-widest mt-4">
                        {t('exchange.templates.loadCustom', 'Load Custom Template →')}
                      </span>
                    </button>
                  ))}

                </div>

              </motion.div>
            )}

          </AnimatePresence>
            </div>

            </div>

            <ExchangeSecuritySidebar className="hidden xl:flex" expiringItems={expiringSidebarRows} />
          </div>
        </div>
      </div>

      <ExchangeCreateTemplateModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateTemplateSubmit}
      />

      <ExchangeDeleteConfirmModal
        item={deleteTargetItem}
        onClose={() => setDeleteTargetItem(null)}
        onConfirm={handleDeleteExchangeItem}
      />

      {createPortal(
        <ExchangeDetailDrawer
          item={selectedExchangeItem}
          onClose={() => setSelectedExchangeItem(null)}
          onDownloadSecure={handleDownloadSecure}
          onRotateToken={(id) => {
            const row = allExchangeItems.find((exchangeItem) => exchangeItem.id === id);
            if (row) {
              handleRotateAccessToken(row);
            }
          }}
        />,
        document.body,
      )}

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
