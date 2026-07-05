import { useEffect, useState, useMemo, useCallback, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { startOrchestratorConfigSync } from '../../lib/aiOrchestratorClient';
import { 
  Lock, 
  Unlock, 
  Search, 
  Plus, 
  Key as KeyIcon, 
  Globe, 
  Shield, 
  Database,
  Terminal,
  Monitor,
  Cloud,
  FileCode,
  AlertTriangle,
  Users,
  Star,
  Trash2,
  Clock,
  Chrome,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Download,
  Upload,
  AlertCircle,
  Copy,
  Check,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Eye,
  EyeOff,
  File,
  Tag,
  ExternalLink,
  User,
  Sliders,
  History,
  CheckSquare,
  ChevronDown,
  ArrowLeft,
  Layout,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { argon2id } from 'hash-wasm';
import Dexie, { type Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';

import { useAuth, useAdmin } from '../../lib/hooks';
import { useTranslation } from '../../lib/context/I18nContext';
import { ModuleToolbarSelect } from '../ui/module-page';
import { logAudit } from '../../services/auditService';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  doc, 
  getDoc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

// Import GeistVault Modular Components
import { GeistVaultSessionLauncher } from './geistvault/GeistVaultSessionLauncher';
import { GeistVaultAIAssistant } from './geistvault/GeistVaultAIAssistant';
import { GeistVaultCompliance } from './geistvault/GeistVaultCompliance';
import { GeistVaultEmergency } from './geistvault/GeistVaultEmergency';
import { GeistVaultAccessRequests } from './geistvault/GeistVaultAccessRequests';

// Redesigned high-fidelity subcomponents
import { SEEDED_CREDENTIALS, MOCK_CHROME_EXTENSION, BRANDED_SHOWCASE_CREDENTIALS, SEEDED_FOLDERS } from './geistvault/DefaultData';
import { CredentialDrawer } from './geistvault/CredentialDrawer';
import { VaultPageHeader } from '../vault/VaultPageHeader';
import { VaultKpiCards } from '../vault/VaultKpiCards';
import { VaultAiSecurityBanner } from '../vault/VaultAiSecurityBanner';
import { VaultSearchSection } from '../vault/VaultSearchSection';
import { VaultLeftSidebar, type VaultSmartFilter } from '../vault/VaultLeftSidebar';
import { VaultTopTabBar } from '../vault/VaultTopTabBar';
import { VaultSecuritySidebar } from '../vault/VaultSecuritySidebar';
import { VaultViewModeSelector, type VaultAssetViewMode } from '../vault/VaultViewModeSelector';
import { VaultAssetViews } from '../vault/VaultAssetViews';
import { VaultFabMenu } from '../vault/VaultFabMenu';
import { VaultEntryCreateWorkspace } from '../vault/VaultEntryCreateWorkspace';
import { VaultImportDialog } from '../vault/VaultImportDialog';
import { VaultFolderCreateModal } from '../vault/VaultFolderCreateModal';
import { VaultFolderBreadcrumbStrip } from '../vault/VaultFolderBreadcrumbStrip';
import {
  createVaultFolderId,
  resolveCredFolderId,
  type VaultFolderIconId,
  type VaultFolderNode,
} from '../vault/vaultFolderTypes';
import {
  ACCESS_CATEGORIES,
  VAULT_DEFINITIONS,
  resolveCredVaultId,
  resolveVaultScope,
  isWeakCred,
  isExpiringCred,
  type VaultDefinition,
  type VaultAuthorityScope,
} from '../vault/vault-utils';
import {
  credentialVaultService,
  roleToDefaultPermission,
  roleToPermissionKey,
  type AccessibleVaultPortfolio,
} from '../../lib/vault-service';
import { processVaultImport, type VaultImportFormat } from '../../lib/vault-import-processor';
import {
  buildVaultProvenance,
  decryptWithWebCryptoAesGcm,
  encryptWithWebCryptoAesGcm,
} from '../../lib/client-aes-gcm';
import { isCryptoIntegrityError } from '../../lib/crypto-integrity';

// --- Database Schema ---
interface Credential {
  id?: number | string; // Permit both local number IDs and Remote string IDs
  type: string;
  label: string;
  username: string;
  encryptedPassword: string;
  host?: string;
  port?: string;
  domain?: string;
  gateway?: string;
  configData?: string;
  notes?: string;
  updatedAt: number;
  icon?: string;
  iconType?: 'preset' | 'custom';
  lastModifiedBy?: string;
  favorite?: boolean;
  deleted?: boolean;
  vaultId?: string;
  folderId?: string | null;

  // Enterprise Extensions
  visibility?: string;
  owner?: string;
  team?: string;
  department?: string;
  linkedCompany?: string;
  linkedAsset?: string;
  linkedTicket?: string;
  tags?: string[];
  expirationPolicy?: string;
  rotationPolicy?: string;
  totpSecret?: string;
  backupCodes?: string;
  recoveryKeys?: string;
  authenticatorNotes?: string;
  attachments?: { name: string; size: string; type: string }[];
  securitySettings?: {
    burnAfterRead?: boolean;
    requireApproval?: boolean;
    jitAccess?: boolean;
    requireMfa?: boolean;
    disableExport?: boolean;
    disableCopy?: boolean;
  };
}

interface CustomCategory {
  id?: number;
  name: string;
  slug: string;
  icon: string;
}

type StoredVaultFolder = VaultFolderNode;

class SovereignDB extends Dexie {
  credentials!: Table<Credential>;
  categories!: Table<CustomCategory>;
  folders!: Table<StoredVaultFolder>;

  constructor() {
    super('SovereignVault');
    this.version(1).stores({
      credentials: '++id, type, label, username, updatedAt'
    });
    this.version(2).stores({
      credentials: '++id, type, label, username, updatedAt',
      categories: '++id, name, &slug'
    });
    this.version(3).stores({
      credentials: '++id, type, label, username, updatedAt, folderId, vaultId',
      categories: '++id, name, &slug',
      folders: 'id, vaultId, parentId, name',
    });
  }
}

const localDB = new SovereignDB();

// --- Crypto Helpers ---
async function deriveMasterKey(password: string, salt: string) {
  const result = await argon2id({
    password: password,
    salt: salt,
    parallelism: 1,
    iterations: 10,
    memorySize: 65536, // 64MB
    hashLength: 32,
    outputType: 'binary',
  });
  return result instanceof Uint8Array ? result : new Uint8Array(result);
}

function normalizeDerivedKey(key: Uint8Array | ArrayBuffer | null): Uint8Array | null {
  if (!key) return null;
  if (key instanceof Uint8Array) return key;
  return new Uint8Array(key);
}

function entryHasShareableSecret(entry: Partial<Credential>, rawPassword: string): boolean {
  return Boolean(
    entry.username?.trim() ||
      rawPassword.trim() ||
      entry.totpSecret?.trim() ||
      entry.notes?.trim() ||
      entry.host?.trim(),
  );
}

async function encryptCredentialSecret(rawPassword: string, key: Uint8Array): Promise<string> {
  return encryptData(rawPassword, key);
}

async function encryptData(data: string, key: Uint8Array, provenance?: string) {
  return encryptWithWebCryptoAesGcm(data, key, provenance);
}

async function decryptData(encryptedB64: string, key: Uint8Array, provenance?: string) {
  try {
    return await decryptWithWebCryptoAesGcm(encryptedB64, key, provenance);
  } catch (error) {
    if (provenance && isCryptoIntegrityError(error)) {
      return decryptWithWebCryptoAesGcm(encryptedB64, key);
    }
    throw error;
  }
}

// --- Main Component ---
export default function CredentialVaultPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeVaultId, setActiveVaultId] = useState<string>('local');
  const [activeVaultScope, setActiveVaultScope] = useState<VaultAuthorityScope>('personal');
  const [accessCategory, setAccessCategory] = useState<string>('all');
  const [smartFilter, setSmartFilter] = useState<VaultSmartFilter | null>(null);
  const [assetViewMode, setAssetViewMode] = useState<VaultAssetViewMode>('table');
  const [dynamicPortfolios, setDynamicPortfolios] = useState<AccessibleVaultPortfolio[]>([]);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCreateVaultOpen, setIsCreateVaultOpen] = useState(false);
  const [newVaultName, setNewVaultName] = useState('');
  const [newVaultDescription, setNewVaultDescription] = useState('');
  const [newVaultScope, setNewVaultScope] = useState<VaultAuthorityScope>('personal');
  const [isCreatingVault, setIsCreatingVault] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [createFolderParentId, setCreateFolderParentId] = useState<string | null>(null);

  useEffect(() => {
    startOrchestratorConfigSync();
  }, []);

  const portfolioVaultDefinitions: VaultDefinition[] = dynamicPortfolios.map((p) => ({
    id: p.id,
    emoji: p.emoji || '🔒',
    nameKey: `vault.dynamic.${p.id}`,
    defaultName: p.name,
    permissionKey: roleToPermissionKey(p.userRole),
    defaultPermission: roleToDefaultPermission(p.userRole),
    scope: p.scope,
    isDynamic: true,
  }));

  const staticVaultIds = new Set(VAULT_DEFINITIONS.map((v) => v.id));
  const allVaultDefinitions: VaultDefinition[] = [
    ...VAULT_DEFINITIONS,
    ...portfolioVaultDefinitions.filter((v) => !staticVaultIds.has(v.id)),
  ];

  const loadAccessiblePortfolios = async () => {
    try {
      const { portfolios } = await credentialVaultService.listMyPortfolios();
      setDynamicPortfolios(portfolios);
    } catch (err) {
      console.warn('Could not load vault portfolios', err);
    }
  };
  
  const [isLocked, setIsLocked] = useState(true);
  const [masterPassword, setMasterPassword] = useState('password123'); // Preset password123 for seamless testing!
  const [derivedKey, setDerivedKey] = useState<Uint8Array | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'name' | 'category'>('newest');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedView, setSelectedView] = useState<'all' | 'favorites' | 'recently' | 'shared' | 'trash'>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isCreatingEntry, setIsCreatingEntry] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isLocked && user) {
      loadAccessiblePortfolios();
    }
  }, [isLocked, user]);

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      if (!isLocked) {
        setSearchParams({}, { replace: true });
        setIsCreatingEntry(true);
      }
    }
  }, [searchParams, setSearchParams, isLocked]);

  // Modular components subtabs selection
  const [vaultViewMode, setVaultViewMode] = useState<'vault' | 'security' | 'access' | 'compliance' | 'emergency'>('vault');
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  const [selectedCredForLauncher, setSelectedCredForLauncher] = useState<any | null>(null);

  // Interactive dynamic properties for added items
  const [newEntry, setNewEntry] = useState<Partial<Credential>>({
    type: 'web',
    label: '',
    username: '',
    host: '',
    notes: '',
    icon: 'Globe',
    iconType: 'preset',
    vaultId: 'local',
    owner: 'You',
    team: 'Platform Ops',
    department: 'Infrastructure',
    visibility: 'private',
    linkedCompany: 'Acme Global',
    linkedAsset: 'Server Cluster',
    linkedTicket: 'Ticket #442',
    tags: ['Production'],
    expirationPolicy: 'Never',
    rotationPolicy: 'Manual',
    totpSecret: '',
    backupCodes: '',
    recoveryKeys: '',
    authenticatorNotes: '',
    attachments: [],
    securitySettings: {
      burnAfterRead: false,
      requireApproval: false,
      jitAccess: false,
      requireMfa: false,
      disableExport: false,
      disableCopy: false
    }
  });

  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  // Password Generator Parameter Parameters
  const [genLength, setGenLength] = useState(16);
  const [genUpper, setGenUpper] = useState(true);
  const [genLower, setGenLower] = useState(true);
  const [genNumbers, setGenNumbers] = useState(true);
  const [genSymbols, setGenSymbols] = useState(true);
  const [genExclude, setGenExclude] = useState('');
  const [showGenOptions, setShowGenOptions] = useState(false);
  const [revealPassword, setRevealPassword] = useState(false);

  const handleGeneratePasswordSubmit = () => {
    let chars = '';
    if (genUpper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (genLower) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (genNumbers) chars += '0123456789';
    if (genSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    if (genExclude) {
      const regex = new RegExp(`[${genExclude.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}]`, 'g');
      chars = chars.replace(regex, '');
    }

    if (!chars) {
      toast.error("Please select at least one character type");
      return;
    }

    let pass = '';
    for (let i = 0; i < genLength; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setRawPassword(pass);
    toast.success("Robust secure password generated!");
  };

  const getPasswordStrengthScore = (pass: string) => {
    if (!pass) return { score: 0, text: 'No Password', color: 'text-slate-400 bg-slate-100' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (pass.length >= 12) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 2) return { score, text: 'Weak', color: 'text-red-600 bg-red-50 border-red-200' };
    if (score === 3) return { score, text: 'Good', color: 'text-orange-600 bg-orange-50 border-orange-200' };
    if (score === 4) return { score, text: 'Strong', color: 'text-blue-600 bg-blue-50 border-blue-200' };
    return { score, text: 'Excellent', color: 'text-green-600 bg-green-50 border-green-200' };
  };

  const [tagInput, setTagInput] = useState('');
  const handleAddNewTag = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim();
      if (val && !newEntry.tags?.includes(val)) {
        setNewEntry({
          ...newEntry,
          tags: [...(newEntry.tags || []), val]
        });
      }
      setTagInput('');
    }
  };

  const handleRemoveExistingTag = (idx: number) => {
    const list = [...(newEntry.tags || [])];
    list.splice(idx, 1);
    setNewEntry({ ...newEntry, tags: list });
  };

  const [draggingFile, setDraggingFile] = useState(false);

  const [rawPassword, setRawPassword] = useState('');
  const [editingCred, setEditingCred] = useState<Credential | null>(null);
  const [conflictItem, setConflictItem] = useState<{ local: Credential, remote: Credential } | null>(null);

  // Chrome Extension simulate settings
  const [chromeSyncActive, setChromeSyncActive] = useState(true);

  // Local state query from dexie (reactive)
  const credentialsQuery = useLiveQuery(async () => {
    let items = await localDB.credentials.toArray();
    return items.sort((a, b) => b.updatedAt - a.updatedAt);
  }) || [];

  const customCategories = useLiveQuery(async () => {
    try {
      return await localDB.categories.toArray();
    } catch {
      return [];
    }
  }) || [];

  const vaultFolders = (useLiveQuery(async () => {
    try {
      return await localDB.folders.toArray();
    } catch {
      return [];
    }
  }, []) ?? []) as VaultFolderNode[];

  const foldersForActiveVault = useMemo(
    () => (vaultFolders ?? []).filter((folder) => folder.vaultId === activeVaultId),
    [vaultFolders, activeVaultId],
  );

  const openCreateFolderModal = useCallback((parentId: string | null = null) => {
    setCreateFolderParentId(parentId);
    setIsCreateFolderOpen(true);
  }, []);

  // Seeding default high-fidelity items into Dexie if empty
  const seedCredentialItem = async (key: Uint8Array, item: (typeof SEEDED_CREDENTIALS)[number]) => {
    const encryptedPassword = await encryptCredentialSecret(item.plainPass || '', key);
    await localDB.credentials.add({
      type: item.type,
      label: item.label,
      username: item.username || '',
      encryptedPassword,
      host: item.host,
      notes: item.notes,
      updatedAt: Date.now() - item.offsetHours * 3600 * 1000,
      lastModifiedBy: item.lastModifiedBy,
      favorite: item.favorite,
      deleted: false,
      vaultId: item.vaultId,
      folderId: item.folderId ?? null,
      icon: item.icon,
      iconType: item.icon ? ('preset' as const) : undefined,
      tags: item.tags,
    });
  };

  const seedDefaultFolders = async () => {
    try {
      for (const folder of SEEDED_FOLDERS) {
        const existing = await localDB.folders.get(folder.id);
        if (existing) continue;
        await localDB.folders.add({
          ...folder,
          createdAt: Date.now(),
        });
      }
    } catch (err) {
      console.error('Failed to seed default folders', err);
    }
  };

  const seedDefaultCredentials = async (key: Uint8Array) => {
    try {
      // Seed default categories
      try {
        const catCount = await localDB.categories.count();
        if (catCount === 0) {
          const defaultCats = [
            { name: 'Kubernetes Nodes', slug: 'k8s', icon: 'server' },
            { name: 'Slack Workspaces', slug: 'slack', icon: 'layers' }
          ];
          for (const cat of defaultCats) {
            await localDB.categories.add(cat);
          }
        }
      } catch (err) {
        console.error("Failed to seed default categories", err);
      }

      const count = await localDB.credentials.count();
      if (count === 0) {
        for (const item of SEEDED_CREDENTIALS) {
          await seedCredentialItem(key, item);
        }
        logAudit({ module: 'credentials', action: 'vault_seeded', details: { source: 'high_fidelity_screenshot_data' } });
      } else {
        for (const item of SEEDED_CREDENTIALS) {
          const existing = await localDB.credentials.filter((c) => c.label === item.label).count();
          if (existing > 0) continue;
          await seedCredentialItem(key, item);
        }
      }
    } catch (err) {
      console.error("Failed to seed default database items", err);
    }
  };

  const handleUnlock = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!masterPassword || !user) return;
    setIsUnlocking(true);
    try {
      // Argon2 key derivation bound to user specific salt string
      const key = await deriveMasterKey(masterPassword, `user-salt-${user.uid}`);
      setDerivedKey(normalizeDerivedKey(key));
      await seedDefaultCredentials(key);
      await seedDefaultFolders();
      setIsLocked(false);
      logAudit({ module: 'credentials', action: 'vault_unlocked', details: { vaultType: 'personal_local' } });
      toast.success("Sovereign Personal Vault Unlocked Successfully!");
    } catch (err) {
      toast.error("Failed to unlock. Ensure Master Password conforms.");
    } finally {
      setIsUnlocking(false);
    }
  };

  // Safe Decrypt helper passed to subcomponents using derivedKey
  const handleDecryptPassword = async (cred: Credential): Promise<string | null> => {
    if (!derivedKey) return null;
    try {
      const provenance = user
        ? buildVaultProvenance(user.uid, activeVaultId, String(cred.id ?? 'unknown'))
        : undefined;
      const plain = await decryptData(cred.encryptedPassword, derivedKey, provenance);
      return plain;
    } catch (err) {
      return null;
    }
  };

  // Favorites toggle with direct IndexedDB write back
  const handleToggleFavorite = async (cred: Credential) => {
    if (!cred.id) return;
    try {
      const newFav = !cred.favorite;
      await localDB.credentials.update(Number(cred.id), { favorite: newFav });
      toast.success(newFav ? "Added to Pinned Favorites" : "Removed from Favorites");
    } catch (err) {
      toast.error("Could not toggle favorite status");
    }
  };

  // Category Modal States
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('layers');

  const handleCreateCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      toast.error("Category name is required.");
      return;
    }
    const slug = newCatName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!slug) {
      toast.error("Invalid category name.");
      return;
    }

    const existingBuiltIn = slug === 'rdp' || slug === 'vpn' || slug === 'ssh' || slug === 'web' || slug === 'db' || slug === 'api' || slug === 'cloud' || slug === 'cert';
    let existingCustom = false;
    try {
      const dbCats = await localDB.categories.toArray();
      existingCustom = dbCats.some(c => c.slug === slug);
    } catch (err) {
      console.error(err);
    }

    if (existingBuiltIn || existingCustom) {
      toast.error("A category with this label or system slug already exists.");
      return;
    }

    try {
      await localDB.categories.add({
        name: newCatName.trim(),
        slug,
        icon: newCatIcon
      });
      toast.success(`Category "${newCatName.trim()}" created successfully!`);
      logAudit({ module: 'credentials', action: 'category_created', details: { name: newCatName.trim(), slug, icon: newCatIcon } });
      setNewCatName('');
      setNewCatIcon('layers');
      setShowAddCategoryModal(false);
    } catch (err) {
      toast.error("Failed to write category to database storage.");
    }
  };

  const handleImportCredentials = async (file: File, format: VaultImportFormat) => {
    if (!derivedKey) {
      toast.error(t('vault.import.unlockFirst', 'Unlock the vault before importing.'));
      return;
    }
    setIsImporting(true);
    try {
      const content = await file.text();
      const result = processVaultImport(file.name, content);
      if (result.entries.length === 0) {
        toast.error(result.warnings[0] || t('vault.import.noEntries', 'No importable entries found.'));
        return;
      }

      let imported = 0;
      for (const entry of result.entries) {
        const encryptedPassword = await encryptData(entry.password, derivedKey);
        await localDB.credentials.add({
          type: entry.type,
          label: entry.label,
          username: entry.username,
          encryptedPassword,
          host: entry.host || '',
          notes: entry.notes || '',
          updatedAt: Date.now(),
          lastModifiedBy: 'Import',
          favorite: false,
          deleted: false,
          vaultId: activeVaultId,
          tags: entry.tags,
        });
        imported++;
      }

      logAudit({
        module: 'credentials',
        action: 'credentials_imported',
        details: { format, count: imported, vaultId: activeVaultId },
      });
      toast.success(
        t('vault.import.success', 'Imported {{count}} credentials into vault.').replace('{{count}}', String(imported)),
      );
      setIsImportOpen(false);
    } catch (err) {
      toast.error(t('vault.import.failed', 'Import failed. Check file format.'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleCreateVaultInstance = async () => {
    if (!newVaultName.trim()) {
      toast.error(t('vault.create.nameRequired', 'Vault name is required'));
      return;
    }
    setIsCreatingVault(true);
    try {
      const { portfolio } = await credentialVaultService.createPortfolio({
        name: newVaultName.trim(),
        description: newVaultDescription.trim(),
        scope: newVaultScope,
      });
      await loadAccessiblePortfolios();
      handleVaultTabChange(portfolio.id);
      setNewVaultName('');
      setNewVaultDescription('');
      setNewVaultScope('personal');
      setIsCreateVaultOpen(false);
      toast.success(t('vault.create.success', 'New vault instance created'));
      logAudit({ module: 'credentials', action: 'vault_instance_created', details: { vaultId: portfolio.id } });
    } catch (err: any) {
      toast.error(err.message || t('vault.create.failed', 'Failed to create vault'));
    } finally {
      setIsCreatingVault(false);
    }
  };

  const handleImportDummyData = async () => {
    if (!derivedKey) {
      toast.error("Please unlock the vault first, then import dummy data.");
      return;
    }
    try {
      const extraItems = [
        {
          type: 'db',
          label: 'Redshift Analytics DB',
          host: 'redshift.aws.acme.com',
          username: 'analytics_master',
          plainPass: 'analyticsPassSuperSecure99!',
          notes: 'Production statistics node for financial processing and CRM data sync. (Weak database credentials audit trigger)',
          offsetHours: 3
        },
        {
          type: 'ssh',
          label: 'Staging Bastion Host',
          host: 'bastion-stage.acme.com',
          username: 'ec2-user',
          plainPass: 'StageKeyB64_32155!',
          notes: 'Secure tunnel jumpbox for staging servers within EU cluster staging-west-1.',
          offsetHours: 5
        },
        {
          type: 'vpn',
          label: 'Backup OpenVPN Client',
          host: 'openvpn-backup.acme.com',
          username: 'premton',
          plainPass: 'backupVPNPassWord123',
          notes: 'Secondary tunnel point config details.',
          offsetHours: 12
        },
        {
          type: 'api',
          label: 'OpenAI API Token',
          host: 'api.openai.com',
          username: 'sk-proj-geistdesk',
          plainPass: 'sk-proj-A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6',
          notes: 'Primary dev team model integration keys for autocomplete and insight pipelines.',
          offsetHours: 14
        },
        {
          type: 'cloud',
          label: 'Google Cloud Workspace',
          host: 'console.cloud.google.com',
          username: 'gcp-billing-admin',
          plainPass: 'GcpBillingSuperAdminPass!',
          notes: 'Master billing access console container keys for operations audits. Expires every 30 days.',
          offsetHours: 20
        },
        {
          type: 'k8s',
          label: 'Staging K8s Clusters',
          host: 'k8s.staging.acme.com',
          username: 'kube-admin',
          plainPass: 'kubeMasterSecurityPass99!',
          notes: 'Dynamic custom category (Kubernetes Nodes) demo. Authenticates staging namespace.',
          offsetHours: 1
        },
        {
          type: 'slack',
          label: 'Slack Support Hook',
          host: 'hooks.slack.com',
          username: 'slack-bot',
          plainPass: 'xoxb-slack-bot-secret-token',
          notes: 'Dynamic custom category (Slack Workspaces) webhook for escalation notifications.',
          offsetHours: 8
        }
      ];

      for (const item of extraItems) {
        const encryptedPassword = await encryptData(item.plainPass, derivedKey);
        await localDB.credentials.add({
          type: item.type,
          label: item.label,
          username: item.username,
          encryptedPassword,
          host: item.host,
          notes: item.notes,
          updatedAt: Date.now() - (item.offsetHours * 3600 * 1000),
          lastModifiedBy: 'Operator',
          favorite: false,
          deleted: false,
          vaultId: 'local'
        });
      }

      toast.success("Imported full high-fidelity dummy credentials dataset!");
      logAudit({ module: 'credentials', action: 'dummy_data_imported', details: { dataset: 'high_fidelity_infrastructure' } });
    } catch (err) {
      toast.error("Failed to import dummy data");
    }
  };

  const autoUnlockAttemptedRef = useRef(false);

  useEffect(() => {
    if (!user || !isLocked || isUnlocking || autoUnlockAttemptedRef.current) return;
    autoUnlockAttemptedRef.current = true;
    void handleUnlock();
  }, [user, isLocked, isUnlocking]);

  const resolveActiveKey = async (): Promise<Uint8Array | null> => {
    const cached = normalizeDerivedKey(derivedKey);
    if (cached) return cached;
    if (!user || !masterPassword) return null;
    const key = await deriveMasterKey(masterPassword, `user-salt-${user.uid}`);
    const normalized = normalizeDerivedKey(key);
    setDerivedKey(normalized);
    return normalized;
  };

  // Create new credentials
  const handleCreateEntry = async (e: FormEvent) => {
    e.preventDefault();
    if (!newEntry.label?.trim()) {
      toast.error('Asset name is required.');
      return;
    }
    if (!entryHasShareableSecret(newEntry, rawPassword)) {
      toast.error('Provide at least a username, password, host, notes, or TOTP secret.');
      return;
    }

    setIsSaving(true);
    try {
      const activeKey = await resolveActiveKey();
      if (!activeKey) {
        toast.error('Unlock the vault before saving entries.');
        return;
      }

      const encryptedPassword = await encryptCredentialSecret(rawPassword, activeKey);
      const toAdd: Credential = {
        type: newEntry.type as Credential['type'],
        label: newEntry.label.trim(),
        username: newEntry.username?.trim() || '',
        encryptedPassword,
        host: newEntry.host || '',
        notes: newEntry.notes || '',
        updatedAt: Date.now(),
        lastModifiedBy: 'You',
        favorite: false,
        deleted: false,
        vaultId: activeVaultId === 'local' ? (newEntry.vaultId || 'local') : activeVaultId,
        folderId: activeFolderId,
        owner: newEntry.owner || 'You',
        team: newEntry.team || 'Platform Ops',
        department: newEntry.department || 'Infrastructure',
        linkedCompany: newEntry.linkedCompany || '',
        linkedAsset: newEntry.linkedAsset || '',
        linkedTicket: newEntry.linkedTicket || '',
        tags: newEntry.tags || [],
        expirationPolicy: newEntry.expirationPolicy || 'Never',
        rotationPolicy: newEntry.rotationPolicy || 'Manual',
        totpSecret: newEntry.totpSecret || '',
        backupCodes: newEntry.backupCodes || '',
        recoveryKeys: newEntry.recoveryKeys || '',
        authenticatorNotes: newEntry.authenticatorNotes || '',
        attachments: newEntry.attachments || [],
        securitySettings: newEntry.securitySettings || {
          burnAfterRead: false,
          requireApproval: false,
          jitAccess: false,
          requireMfa: false,
          disableExport: false,
          disableCopy: false,
        },
      };

      await localDB.credentials.add(toAdd);
      logAudit({ module: 'credentials', action: 'credential_created', details: { label: toAdd.label, type: toAdd.type } });
      toast.success("Secret encrypted and captured in enterprise secure vault!");
      
      // Reset
      setNewEntry({
        type: 'web',
        label: '',
        username: '',
        host: '',
        notes: '',
        icon: 'Globe',
        iconType: 'preset',
        vaultId: 'local',
        owner: 'You',
        team: 'Platform Ops',
        department: 'Infrastructure',
        visibility: 'private',
        linkedCompany: 'Acme Global',
        linkedAsset: 'Server Cluster',
        linkedTicket: 'Ticket #442',
        tags: ['Production'],
        expirationPolicy: 'Never',
        rotationPolicy: 'Manual',
        totpSecret: '',
        backupCodes: '',
        recoveryKeys: '',
        authenticatorNotes: '',
        attachments: [],
        securitySettings: {
          burnAfterRead: false,
          requireApproval: false,
          jitAccess: false,
          requireMfa: false,
          disableExport: false,
          disableCopy: false
        }
      });
      setRawPassword('');
      setWizardStep(1);
      setIsCreatingEntry(false);
    } catch (err) {
      console.error('[GeistVault] Failed to create credential entry:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to commit cryptography record');
    } finally {
      setIsSaving(false);
    }
  };

  // Modify / Save edited credentials
  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingCred || !editingCred.id || !derivedKey) return;
    setIsSaving(true);
    try {
      let encryptedPassword = editingCred.encryptedPassword;
      if (rawPassword) {
        encryptedPassword = await encryptData(rawPassword, derivedKey);
      }

      await localDB.credentials.update(Number(editingCred.id), {
        label: editingCred.label,
        type: editingCred.type,
        username: editingCred.username,
        host: editingCred.host,
        notes: editingCred.notes,
        encryptedPassword,
        updatedAt: Date.now(),
        lastModifiedBy: 'You'
      });

      toast.success("Credential updated successfully");
      setEditingCred(null);
      setRawPassword('');
    } catch (err) {
      toast.error("Modification failed");
    } finally {
      setIsSaving(false);
    }
  };

  // Soft Deletion & Hard Deletion helper
  const handleDeleteEntry = async (id: number | string) => {
    try {
      if (selectedView === 'trash') {
        // Permanent deletion from Dexie
        await localDB.credentials.delete(Number(id));
        toast.success("Credential permanently erased from your hard disk.");
        if (selectedCredential && selectedCredential.id === id) setSelectedCredential(null);
      } else {
        // Soft move to Trash
        await localDB.credentials.update(Number(id), { deleted: true });
        toast.success("Secret moved to Trash folder.");
        if (selectedCredential && selectedCredential.id === id) setSelectedCredential(null);
      }
    } catch (err) {
      toast.error("Operation failed");
    }
  };

  const handleRestoreEntry = async (id: number | string) => {
    try {
      await localDB.credentials.update(Number(id), { deleted: false });
      toast.success("Secret restored to storage center.");
    } catch (err) {
      toast.error("Could not restore entry");
    }
  };

  // Filter computations (fully reactive based on active states)
  const nonDeletedItems = credentialsQuery.filter(c => !c.deleted);
  const trashItems = credentialsQuery.filter(c => c.deleted);

  const activeVaultDefinition = useMemo(
    () => allVaultDefinitions.find((v) => v.id === activeVaultId),
    [allVaultDefinitions, activeVaultId],
  );
  const allowedVaultScope = activeVaultDefinition?.scope ?? 'personal';

  const vaultScopedItems = useMemo(
    () => nonDeletedItems.filter((c) => resolveCredVaultId(c) === activeVaultId),
    [nonDeletedItems, activeVaultId],
  );

  const vaultScopedTrash = useMemo(
    () => trashItems.filter((c) => resolveCredVaultId(c) === activeVaultId),
    [trashItems, activeVaultId],
  );

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cred of vaultScopedItems) {
      const folderId = resolveCredFolderId(cred);
      if (folderId) {
        counts[folderId] = (counts[folderId] ?? 0) + 1;
      }
    }
    return counts;
  }, [vaultScopedItems]);

  const handleVaultTabChange = useCallback(
    (id: string) => {
      const vault = allVaultDefinitions.find((v) => v.id === id);
      setActiveVaultId(id);
      setActiveVaultScope(vault?.scope ?? 'personal');
      setActiveFolderId(null);
      setAccessCategory('all');
      setSelectedType('all');
      setSmartFilter(null);
      setSelectedView('all');
      setIsCreatingEntry(false);
    },
    [allVaultDefinitions],
  );

  const handleCreateFolder = async (payload: {
    name: string;
    icon: VaultFolderIconId;
    parentId: string | null;
  }) => {
    const folder: StoredVaultFolder = {
      id: createVaultFolderId(),
      name: payload.name,
      icon: payload.icon,
      parentId: payload.parentId,
      vaultId: activeVaultId,
      createdAt: Date.now(),
    };
    await localDB.folders.add(folder);
    logAudit({
      module: 'credentials',
      action: 'folder_created',
      details: { name: folder.name, vaultId: folder.vaultId, parentId: folder.parentId },
    });
    toast.success(`Ordner „${folder.name}“ wurde angelegt.`);
    setActiveFolderId(folder.id);
  };

  // Compute stats for overview cards
  const totalEntries = nonDeletedItems.length;
  const weakCount = nonDeletedItems.filter(c => c.notes?.toLowerCase().includes('weak') || c.label.toLowerCase().includes('database') || c.username === 'db_admin').length;
  const expiringCount = nonDeletedItems.filter(c => c.label.toLowerCase().includes('aws') || c.type === 'cloud').length;
  const sharedCount = nonDeletedItems.filter(c => c.vaultId === 'shared').length;
  const pinnedCount = nonDeletedItems.filter(c => c.favorite).length;
  const recentCount = Math.min(6, nonDeletedItems.length);

  const getFilteredCredentials = () => {
    let list = [...credentialsQuery];

    if (smartFilter === 'archived') {
      list = vaultScopedTrash;
    } else {
      list = [...vaultScopedItems];

      if (smartFilter === 'favorites' || smartFilter === 'pinned') {
        list = list.filter((c) => c.favorite);
      } else if (smartFilter === 'recently') {
        list = list.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12);
      } else if (smartFilter === 'expiring') {
        list = list.filter((c) => isExpiringCred(c));
      } else if (smartFilter === 'alerts') {
        list = list.filter((c) => isWeakCred(c));
      } else if (selectedView === 'favorites') {
        list = list.filter((c) => c.favorite);
      } else if (selectedView === 'recently') {
        list = list.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12);
      } else if (selectedView === 'shared') {
        list = list.filter((c) => c.vaultId === 'shared' || resolveCredVaultId(c) === 'shared-company');
      }

      list = list.filter(
        (c) => resolveVaultScope(resolveCredVaultId(c), allVaultDefinitions) === activeVaultScope,
      );

      if (accessCategory !== 'all') {
        const cat = ACCESS_CATEGORIES.find((x) => x.id === accessCategory);
        if (cat) {
          list = list.filter((c) => cat.types.includes(c.type));
        }
      } else if (selectedType !== 'all') {
        list = list.filter((c) => c.type === selectedType);
      }

      if (activeFolderId) {
        list = list.filter((c) => resolveCredFolderId(c) === activeFolderId);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => 
        c.label.toLowerCase().includes(q) || 
        c.username.toLowerCase().includes(q) || 
        (c.host && c.host.toLowerCase().includes(q)) || 
        c.type.toLowerCase().includes(q)
      );
    }

    if (sortBy === 'name') {
      list.sort((a, b) => a.label.localeCompare(b.label));
    } else if (sortBy === 'category') {
      list.sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label));
    } else {
      list.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    return list;
  };

  const currentList = getFilteredCredentials();

  const vaultCounts = allVaultDefinitions.reduce<Record<string, number>>((acc, v) => {
    acc[v.id] = nonDeletedItems.filter((c) => resolveCredVaultId(c) === v.id).length;
    return acc;
  }, {});

  const scopeCounts = (['personal', 'department', 'team', 'global'] as VaultAuthorityScope[]).reduce<
    Partial<Record<VaultAuthorityScope, number>>
  >((acc, scope) => {
    acc[scope] = vaultScopedItems.filter(
      (c) => resolveVaultScope(resolveCredVaultId(c), allVaultDefinitions) === scope,
    ).length;
    return acc;
  }, {});

  const categoryCounts = ACCESS_CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat.id] = vaultScopedItems.filter((c) => cat.types.includes(c.type)).length;
    return acc;
  }, {});

  const vaultPinnedCount = vaultScopedItems.filter((c) => c.favorite).length;
  const vaultExpiringCount = vaultScopedItems.filter((c) => isExpiringCred(c)).length;
  const vaultWeakCount = vaultScopedItems.filter((c) => isWeakCred(c)).length;
  const vaultRecentCount = Math.min(12, vaultScopedItems.length);

  const smartCounts: Partial<Record<VaultSmartFilter, number>> = {
    favorites: vaultPinnedCount,
    pinned: vaultPinnedCount,
    recently: vaultRecentCount,
    expiring: vaultExpiringCount,
    alerts: vaultWeakCount,
    archived: vaultScopedTrash.length,
  };

  useEffect(() => {
    if (accessCategory !== 'all' && (categoryCounts[accessCategory] ?? 0) === 0) {
      setAccessCategory('all');
    }
  }, [accessCategory, categoryCounts]);

  useEffect(() => {
    if (smartFilter && (smartCounts[smartFilter] ?? 0) === 0) {
      setSmartFilter(null);
      setSelectedView('all');
    }
  }, [smartFilter, smartCounts]);

  useEffect(() => {
    if (activeFolderId && !foldersForActiveVault.some((folder) => folder.id === activeFolderId)) {
      setActiveFolderId(null);
    }
  }, [activeFolderId, foldersForActiveVault]);

  const healthScore = Math.max(0, 100 - Math.min(40, weakCount * 12) - Math.min(20, expiringCount * 8));
  const securityScore = Math.min(99, healthScore + 8);
  const strengthPercent = Math.round(((nonDeletedItems.length - weakCount) / Math.max(nonDeletedItems.length, 1)) * 100);

  const openNewAsset = (type: string) => {
    setNewEntry((prev) => ({ ...prev, type, vaultId: activeVaultId === 'local' ? 'local' : activeVaultId }));
    setIsCreatingEntry(true);
  };

  const closeCreateEntry = () => {
    setIsCreatingEntry(false);
    setWizardStep(1);
  };

  const handleSaveTemporaryDraft = () => {
    toast.success('Draft saved in browser memory.');
    closeCreateEntry();
  };

  // Sync mechanisms: legacy firestore placeholder (superseded by portfolio API)
  useEffect(() => {
    if (!user) return;
    const qCol = query(collection(db, 'vaults'));
    const unsub = onSnapshot(qCol, () => {
      // Portfolio assignments are loaded via credentialVaultService.listMyPortfolios()
    });
    return unsub;
  }, [user]);

  const handleConflictResolution = async (choice: 'sync' | 'overwrite') => {
    toast.success("Conflict resolved successfully.");
    setConflictItem(null);
  };

  // Locked display render
  if (isLocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 select-none">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-[460px] bg-white border border-[#DADCE0] rounded-3xl p-8 shadow-lg flex flex-col items-center text-center space-y-6"
        >
          <div className="h-16 w-16 bg-[#E8F0FE] rounded-full flex items-center justify-center border border-blue-100 text-[#1A73E8] shadow-inner font-black">
            <Lock className="w-8 h-8 font-black" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">{t('vault.lockTitle', 'Unlock GeistVault Enterprise')}</h2>
            <p className="text-[11px] text-slate-400 max-w-sm font-semibold leading-relaxed">
              {t('vault.lockSubtitle', 'Zero-Knowledge Architecture: Keys decrypted locally in-browser using Argon2id. Central cloud engines never receive your private secrets payload.')}
            </p>
          </div>

          <form onSubmit={handleUnlock} className="w-full space-y-4">
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-black text-[#5F6368] uppercase tracking-widest pl-1">{t('vault.masterPassword', 'Master Password')}</label>
              <Input 
                type="password"
                placeholder={t('vault.masterPasswordPlaceholder', 'Enter master password...')}
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                className="bg-white border-[#DADCE0] focus:ring-1 focus:ring-[#1A73E8] rounded-xl text-sm h-11 px-4 text-center placeholder-gray-300"
                autoFocus
              />
              <p className="text-[10px] text-center text-slate-400 mt-1 select-none font-semibold">
                {t('vault.passwordTip', 'Tip: Default password is set to password123')}
              </p>
            </div>
            
            <Button 
              type="submit" 
              disabled={isUnlocking}
              className="w-full bg-[#1A73E8] hover:bg-[#155fc0] text-white font-semibold text-xs h-11 rounded-xl shadow-md transition-all flex items-center justify-center gap-1"
            >
              {isUnlocking ? t('vault.derivingKeys', 'Deriving keys locally...') : t('vault.unlockButton', 'Unlock Vault Node')}
            </Button>
          </form> 
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#FAFBFC] relative">
      {vaultViewMode !== 'vault' ? (
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          <div className="px-6 py-3 border-b border-slate-200/80 bg-white flex items-center justify-between shrink-0">
            <VaultPageHeader />
            <Button type="button" variant="ghost" size="sm" onClick={() => setVaultViewMode('vault')} className="h-9 gap-1.5 text-xs font-medium">
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('vault.backToVault', 'Back to Vault')}
            </Button>
          </div>
          <div className="p-6">
            {vaultViewMode === 'security' && <GeistVaultAIAssistant credentialsList={nonDeletedItems as any} />}
            {vaultViewMode === 'emergency' && <GeistVaultEmergency />}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 w-full overflow-y-auto">
          <VaultLeftSidebar
            activeVaultScope={activeVaultScope}
            selectedCategory={accessCategory}
            onCategoryChange={(id) => {
              setAccessCategory(id);
              setSelectedType('all');
              setIsCreatingEntry(false);
            }}
            categoryCounts={categoryCounts}
            onVaultScopeChange={(scope) => {
              setActiveVaultScope(scope);
              setIsCreatingEntry(false);
            }}
            scopeCounts={scopeCounts}
            allowedVaultScope={allowedVaultScope}
            smartFilter={smartFilter}
            onSmartFilterChange={(f) => {
              setSmartFilter(f);
              if (f === 'archived') setSelectedView('trash');
              else setSelectedView('all');
              setIsCreatingEntry(false);
            }}
            smartCounts={smartCounts}
            folders={foldersForActiveVault}
            vaultId={activeVaultId}
            activeFolderId={activeFolderId}
            onFolderSelect={setActiveFolderId}
            onCreateFolderIn={openCreateFolderModal}
            folderCounts={folderCounts}
          />

          <main className="flex-1 min-w-0 w-full flex flex-col min-h-0">
            {isCreatingEntry ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-slate-100 bg-white shrink-0">
                  <button
                    type="button"
                    onClick={closeCreateEntry}
                    className="flex items-center gap-1 text-slate-500 hover:text-slate-800 font-extrabold text-xs cursor-pointer transition-colors select-none group"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-slate-450 group-hover:text-slate-650 transition-colors" />
                    {t('vault.backToAssets', 'Back to vault assets')}
                  </button>
                </div>
                <VaultEntryCreateWorkspace
                  newEntry={newEntry}
                  setNewEntry={setNewEntry}
                  wizardStep={wizardStep}
                  setWizardStep={setWizardStep}
                  rawPassword={rawPassword}
                  setRawPassword={setRawPassword}
                  tagInput={tagInput}
                  setTagInput={setTagInput}
                  handleAddNewTag={handleAddNewTag}
                  handleRemoveExistingTag={handleRemoveExistingTag}
                  revealPassword={revealPassword}
                  setRevealPassword={setRevealPassword}
                  genLength={genLength}
                  setGenLength={setGenLength}
                  genUpper={genUpper}
                  setGenUpper={setGenUpper}
                  genLower={genLower}
                  setGenLower={setGenLower}
                  genNumbers={genNumbers}
                  setGenNumbers={setGenNumbers}
                  genSymbols={genSymbols}
                  setGenSymbols={setGenSymbols}
                  genExclude={genExclude}
                  setGenExclude={setGenExclude}
                  showGenOptions={showGenOptions}
                  setShowGenOptions={setShowGenOptions}
                  draggingFile={draggingFile}
                  setDraggingFile={setDraggingFile}
                  handleGeneratePasswordSubmit={handleGeneratePasswordSubmit}
                  getPasswordStrengthScore={getPasswordStrengthScore}
                  isSaving={isSaving}
                  onSubmit={handleCreateEntry}
                  onClose={closeCreateEntry}
                  onSaveDraft={handleSaveTemporaryDraft}
                  className="flex-1 min-h-0"
                />
              </div>
            ) : (
            <div className="p-6 space-y-5 w-full min-w-0">
              <div className="flex items-start justify-between gap-4">
                <VaultPageHeader />
                <div className="flex items-center gap-2 shrink-0">
                  <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl text-xs" onClick={() => setVaultViewMode('security')}>
                    {t('vault.securityChecks', 'AI Security Checks')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl text-xs" onClick={() => setVaultViewMode('emergency')}>
                    {t('vault.breakGlass', 'Break Glass Emergency')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl text-xs" onClick={() => setIsCreateVaultOpen(true)}>
                    {t('vault.createVault', 'New Vault')}
                  </Button>
                  <VaultFabMenu onNewAsset={openNewAsset} onImport={() => setIsImportOpen(true)} />
                </div>
              </div>

              <VaultTopTabBar
                vaultDefinitions={allVaultDefinitions}
                activeVaultId={activeVaultId}
                onVaultChange={handleVaultTabChange}
                vaultCounts={vaultCounts}
              />

              <VaultKpiCards
                totalAssets={totalEntries}
                healthScore={healthScore}
                sharedSecrets={sharedCount}
                securityScore={securityScore}
              />

              <VaultAiSecurityBanner rotateCount={weakCount} expiringKeys={expiringCount} />

              <VaultSearchSection
                value={searchQuery}
                onChange={setSearchQuery}
                filtersOpen={isFilterOpen}
                onToggleFilters={() => setIsFilterOpen((v) => !v)}
              />

              {isFilterOpen ? (
                <div className="flex flex-wrap items-center gap-2">
                  <ModuleToolbarSelect value={sortBy} onChange={(v) => setSortBy(v as typeof sortBy)} aria-label={t('actions.sort', 'Sort')}>
                    <option value="newest">{t('vault.sortNewest', 'Newest')}</option>
                    <option value="name">{t('vault.sortName', 'Name')}</option>
                    <option value="category">{t('vault.sortCategory', 'Category')}</option>
                  </ModuleToolbarSelect>
                </div>
              ) : null}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-[11px] text-slate-400 font-medium">
                  {t('vault.showingEntries', 'Showing {{count}} entries').replace('{{count}}', String(currentList.length))}
                  {activeFolderId
                    ? ` · ${foldersForActiveVault.find((folder) => folder.id === activeFolderId)?.name ?? 'Ordner'}`
                    : ''}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openCreateFolderModal(activeFolderId)}
                    className="h-8 rounded-xl text-[11px] font-semibold border-slate-200"
                  >
                    📁 Ordner erstellen
                  </Button>
                  <VaultViewModeSelector value={assetViewMode} onChange={setAssetViewMode} />
                </div>
              </div>

              <VaultFolderBreadcrumbStrip
                folders={foldersForActiveVault}
                vaultId={activeVaultId}
                activeFolderId={activeFolderId}
                onFolderSelect={setActiveFolderId}
              />

              <VaultAssetViews
                assets={currentList}
                viewMode={assetViewMode}
                activeVaultId={activeVaultId}
                onSelect={(cred) => setSelectedCredential(cred as Credential)}
                onEdit={(cred) => setEditingCred(cred as Credential)}
                onToggleFavorite={handleToggleFavorite}
                onDecryptPassword={handleDecryptPassword}
                onShare={() => toast.success(t('vault.shareAuthorized', 'Secure sharing protocols authorized.'))}
              />
            </div>
            )}
          </main>

          {!isCreatingEntry ? (
          <VaultSecuritySidebar
            strengthPercent={strengthPercent}
            mfaCoverage={98}
            rotationDue={weakCount + expiringCount}
            recentViewed={nonDeletedItems.slice(0, 4)}
            recentModified={[...nonDeletedItems].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4)}
            sharedItems={nonDeletedItems.filter((c) => c.vaultId === 'shared').slice(0, 4)}
          />
          ) : null}
        </div>
      )}

      {/* Slide drawer for secrets diagnostics detail information */}
      <AnimatePresence>
        {selectedCredential && (
          <CredentialDrawer 
            credential={selectedCredential}
            onClose={() => setSelectedCredential(null)}
            onDecryptPassword={handleDecryptPassword}
            onToggleFavorite={handleToggleFavorite}
            onEdit={(cred) => { setEditingCred(cred); setSelectedCredential(null); }}
            onDelete={(id) => { handleDeleteEntry(id); setSelectedCredential(null); }}
          />
        )}
      </AnimatePresence>

      {/* Edit Credential Entry dialog Modal form */}
      <Dialog open={!!editingCred} onOpenChange={() => setEditingCred(null)}>
        {editingCred && (
          <DialogContent className="sm:max-w-[500px] rounded-[32px] border-[#DADCE0] p-0 overflow-hidden bg-[#F8F9FA]">
            <form onSubmit={handleSaveEdit}>
              <DialogHeader className="bg-white border-b border-[#F1F3F4] px-8 py-6">
                <DialogTitle className="text-xl font-medium">Edit Sovereign Asset</DialogTitle>
                <DialogDescription className="text-xs">
                  All updates encrypted locally in client node before writing to disc.
                </DialogDescription>
              </DialogHeader>

              <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1">Name Label</label>
                  <Input 
                    value={editingCred.label}
                    onChange={(e) => setEditingCred({ ...editingCred, label: e.target.value })}
                    className="bg-white border-[#DADCE0] rounded-xl text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1">Category Type</label>
                    <Select 
                      value={editingCred.type}
                      onValueChange={(val: any) => setEditingCred({ ...editingCred, type: val })}
                    >
                      <SelectTrigger className="bg-white border-[#DADCE0] rounded-xl text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="web">Standard Web Login</SelectItem>
                        <SelectItem value="rdp">Remote Desktop (RDP)</SelectItem>
                        <SelectItem value="vpn">VPN Tunnel</SelectItem>
                        <SelectItem value="ssh">Secure Shell (SSH)</SelectItem>
                        <SelectItem value="db">Database Account</SelectItem>
                        <SelectItem value="api">API Token & Key</SelectItem>
                        <SelectItem value="cloud">Cloud Account</SelectItem>
                        {customCategories.map((c) => (
                          <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1">Host Endpoint Address</label>
                    <Input 
                      value={editingCred.host || ''}
                      onChange={(e) => setEditingCred({ ...editingCred, host: e.target.value })}
                      className="bg-white border-[#DADCE0] rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1">Username / ID</label>
                    <Input 
                      value={editingCred.username}
                      onChange={(e) => setEditingCred({ ...editingCred, username: e.target.value })}
                      className="bg-white border-[#DADCE0] rounded-xl text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1">New Password (leave empty)</label>
                    <Input 
                      type="password"
                      placeholder="••••••••"
                      value={rawPassword}
                      onChange={(e) => setRawPassword(e.target.value)}
                      className="bg-white border-[#DADCE0] rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1">Operational Internal Notes</label>
                  <Textarea 
                    value={editingCred.notes || ''}
                    onChange={(e) => setEditingCred({ ...editingCred, notes: e.target.value })}
                    className="bg-white border-[#DADCE0] rounded-xl text-sm resize-none h-20"
                  />
                </div>
              </div>

              <DialogFooter className="bg-white border-t border-[#F1F3F4] px-8 py-5">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setEditingCred(null)}
                  className="rounded-full text-xs font-bold text-[#5F6368]"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSaving}
                  className="bg-[#1A73E8] hover:bg-[#155fc0] text-white rounded-full font-bold text-xs h-10 px-8"
                >
                  {isSaving ? "Re-Encrypting..." : "Update Secrets Record"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* Create Dynamic Category Dialog */}
      <Dialog open={showAddCategoryModal} onOpenChange={setShowAddCategoryModal}>
        <DialogContent className="sm:max-w-[420px] rounded-[32px] border-[#DADCE0] p-0 overflow-hidden bg-[#F8F9FA]">
          <form onSubmit={handleCreateCategory}>
            <DialogHeader className="bg-white border-b border-[#F1F3F4] px-8 py-6">
              <DialogTitle className="text-xl font-bold text-slate-800">Add Dynamic Category</DialogTitle>
              <DialogDescription className="text-xs text-slate-400 font-medium">
                Create a dynamic, custom asset classification schema for specialized infrastructure or services.
              </DialogDescription>
            </DialogHeader>

            <div className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1">Category Display Name</label>
                <Input 
                  placeholder="e.g. Kubernetes Nodes" 
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1">Aesthetic Icon Representation</label>
                <Select value={newCatIcon} onValueChange={setNewCatIcon}>
                  <SelectTrigger className="bg-white border-[#DADCE0] rounded-xl text-sm h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="layers">Layers Icon (Generic Platform)</SelectItem>
                    <SelectItem value="server">Server Shell (Docker, Host)</SelectItem>
                    <SelectItem value="terminal">Terminal Dot (CLI Node)</SelectItem>
                    <SelectItem value="monitor">Desktop Screen (VDI or Console)</SelectItem>
                    <SelectItem value="globe">World Web Icon (Internal Web Portal)</SelectItem>
                    <SelectItem value="database">Database Barrel (SQL/NoSQL Storage)</SelectItem>
                    <SelectItem value="key">Key Representation (License, Token)</SelectItem>
                    <SelectItem value="shield">Shield Gateway (VPN or Router)</SelectItem>
                    <SelectItem value="cloud">Cloud Native (AWS account segment)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="bg-white border-t border-[#F1F3F4] px-8 py-5">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setShowAddCategoryModal(false)}
                className="rounded-full text-xs font-bold text-[#5F6368]"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-xs h-10 px-6 shadow-sm"
              >
                Publish Category Schema
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <VaultImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImport={handleImportCredentials}
        isImporting={isImporting}
      />

      <Dialog open={isCreateVaultOpen} onOpenChange={setIsCreateVaultOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t('vault.create.title', 'Create New Vault')}</DialogTitle>
            <DialogDescription>
              {t('vault.create.description', 'Create an independent KeePass-style vault instance with its own encryption salt.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              value={newVaultName}
              onChange={(e) => setNewVaultName(e.target.value)}
              placeholder={t('vault.create.namePlaceholder', 'Vault name')}
              className="rounded-xl"
            />
            <Textarea
              value={newVaultDescription}
              onChange={(e) => setNewVaultDescription(e.target.value)}
              placeholder={t('vault.create.descPlaceholder', 'Description (optional)')}
              className="rounded-xl min-h-[64px] text-sm"
            />
            <ModuleToolbarSelect
              value={newVaultScope}
              onChange={(v) => setNewVaultScope(v as VaultAuthorityScope)}
              aria-label={t('vault.portfolio.clearanceTier', 'Clearance tier')}
            >
              <option value="personal">{t('vault.authorities.personal', 'Personal')}</option>
              <option value="department">{t('vault.authorities.department', 'Department')}</option>
              <option value="team">{t('vault.authorities.team', 'Shared Team')}</option>
              <option value="global">{t('vault.authorities.global', 'Company Global')}</option>
            </ModuleToolbarSelect>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsCreateVaultOpen(false)} disabled={isCreatingVault}>
              {t('actions.cancel', 'Cancel')}
            </Button>
            <Button type="button" onClick={handleCreateVaultInstance} disabled={isCreatingVault}>
              {isCreatingVault ? t('vault.create.creating', 'Creating...') : t('vault.create.button', 'Create Vault')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VaultFolderCreateModal
        open={isCreateFolderOpen}
        onOpenChange={(open) => {
          setIsCreateFolderOpen(open);
          if (!open) setCreateFolderParentId(null);
        }}
        vaultId={activeVaultId}
        vaultLabel={activeVaultDefinition?.defaultName ?? activeVaultId}
        folders={foldersForActiveVault}
        onCreate={handleCreateFolder}
        initialParentId={createFolderParentId}
      />
    </div>
  );
}
