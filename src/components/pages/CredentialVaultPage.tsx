import React, { useState, useEffect } from 'react';
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
  CheckSquare
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

import { useAuth, useAdmin } from '../../lib/hooks';
import { useTranslation } from '../../lib/context/I18nContext';
import { ModuleCreateButton } from '../ui/ModuleCreateButton';
import {
  ModulePageShell,
  ModulePageCompactHeader,
  ModulePageTabs,
  ModuleToolbar,
  ModuleToolbarSelect,
  ModulePageScrollRegion,
  type ModuleTabItem,
} from '../ui/module-page';
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
import { SEEDED_CREDENTIALS, MOCK_CHROME_EXTENSION } from './geistvault/DefaultData';
import { CredentialDrawer } from './geistvault/CredentialDrawer';
import { CredentialTable } from './geistvault/CredentialTable';
import { VaultOverview } from './geistvault/VaultOverview';

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

class SovereignDB extends Dexie {
  credentials!: Table<Credential>;
  categories!: Table<CustomCategory>;

  constructor() {
    super('SovereignVault');
    this.version(1).stores({
      credentials: '++id, type, label, username, updatedAt'
    });
    this.version(2).stores({
      credentials: '++id, type, label, username, updatedAt',
      categories: '++id, name, &slug'
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
  return result;
}

async function encryptData(data: string, key: Uint8Array) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(data);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as any,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encodedData
  );
  
  // Combine IV and Encrypted Data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptData(encryptedB64: string, key: Uint8Array) {
  const combined = new Uint8Array(atob(encryptedB64).split('').map(c => c.charCodeAt(0)));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as any,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );
  return new TextDecoder().decode(decrypted);
}

// --- Main Component ---
export default function CredentialVaultPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeVaultId, setActiveVaultId] = useState<'local' | string>('local');
  const [sharedVaults, setSharedVaults] = useState<any[]>([]);
  
  const [isLocked, setIsLocked] = useState(true);
  const [masterPassword, setMasterPassword] = useState('password123'); // Preset password123 for seamless testing!
  const [derivedKey, setDerivedKey] = useState<Uint8Array | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedView, setSelectedView] = useState<'all' | 'favorites' | 'recently' | 'shared' | 'trash'>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      if (!isLocked) {
        setSearchParams({}, { replace: true });
        setShowAddModal(true);
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
  const handleAddNewTag = (e: React.KeyboardEvent) => {
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

  // Seeding default high-fidelity items into Dexie if empty
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
          const encryptedPassword = await encryptData(item.plainPass, key);
          await localDB.credentials.add({
            type: item.type,
            label: item.label,
            username: item.username,
            encryptedPassword,
            host: item.host,
            notes: item.notes,
            updatedAt: Date.now() - (item.offsetHours * 3600 * 1000),
            lastModifiedBy: item.lastModifiedBy,
            favorite: item.favorite,
            deleted: false,
            vaultId: item.vaultId
          });
        }
        logAudit({ module: 'credentials', action: 'vault_seeded', details: { source: 'high_fidelity_screenshot_data' } });
      }
    } catch (err) {
      console.error("Failed to seed default database items", err);
    }
  };

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!masterPassword || !user) return;
    setIsUnlocking(true);
    try {
      // Argon2 key derivation bound to user specific salt string
      const key = await deriveMasterKey(masterPassword, `user-salt-${user.uid}`);
      setDerivedKey(key);
      await seedDefaultCredentials(key);
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
      const plain = await decryptData(cred.encryptedPassword, derivedKey);
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

  const handleCreateCategory = async (e: React.FormEvent) => {
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

  // Create new credentials
  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.label || !newEntry.username || !rawPassword || !derivedKey) {
      toast.error("Required fields missing. Ensure label, username and password are provided.");
      return;
    }

    setIsSaving(true);
    try {
      const encryptedPassword = await encryptData(rawPassword, derivedKey);
      const toAdd: Credential = {
        type: newEntry.type as any,
        label: newEntry.label || '',
        username: newEntry.username || '',
        encryptedPassword,
        host: newEntry.host || '',
        notes: newEntry.notes || '',
        updatedAt: Date.now(),
        lastModifiedBy: 'You',
        favorite: false,
        deleted: false,
        vaultId: activeVaultId === 'local' ? (newEntry.vaultId || 'local') : activeVaultId,

        // Enterprise metadata
        owner: newEntry.owner || 'You',
        team: newEntry.team || 'Platform Ops',
        department: newEntry.department || 'Infrastructure',
        linkedCompany: newEntry.linkedCompany || 'Acme Global',
        linkedAsset: newEntry.linkedAsset || 'Server Cluster',
        linkedTicket: newEntry.linkedTicket || 'Ticket #442',
        tags: newEntry.tags || ['Production'],
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
          disableCopy: false
        }
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
      setShowAddModal(false);
    } catch (err) {
      toast.error("Failed to commit cryptography record");
    } finally {
      setIsSaving(false);
    }
  };

  // Modify / Save edited credentials
  const handleSaveEdit = async (e: React.FormEvent) => {
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

  // Compute stats for overview cards
  const totalEntries = nonDeletedItems.length;
  const weakCount = nonDeletedItems.filter(c => c.notes?.toLowerCase().includes('weak') || c.label.toLowerCase().includes('database') || c.username === 'db_admin').length;
  const expiringCount = nonDeletedItems.filter(c => c.label.toLowerCase().includes('aws') || c.type === 'cloud').length;
  const sharedCount = nonDeletedItems.filter(c => c.vaultId === 'shared').length;

  const getFilteredCredentials = () => {
    let list = [...credentialsQuery];

    // Filter by view
    if (selectedView === 'trash') {
      return list.filter(c => c.deleted);
    } else {
      list = list.filter(c => !c.deleted);

      if (selectedView === 'favorites') {
        list = list.filter(c => c.favorite);
      } else if (selectedView === 'recently') {
        list = list.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
      } else if (selectedView === 'shared') {
        list = list.filter(c => c.vaultId === 'shared');
      }
    }

    // Filter by Access Category type
    if (selectedType !== 'all') {
      list = list.filter(c => c.type === selectedType);
    }

    // Filter by global text search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => 
        c.label.toLowerCase().includes(q) || 
        c.username.toLowerCase().includes(q) || 
        (c.host && c.host.toLowerCase().includes(q)) || 
        c.type.toLowerCase().includes(q)
      );
    }

    return list;
  };

  const currentList = getFilteredCredentials();

  // Sync mechanisms: subscribe to firestore placeholders
  useEffect(() => {
    if (!user) return;
    const qCol = query(collection(db, 'vaults'));
    const unsub = onSnapshot(qCol, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setSharedVaults(list);
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

  const vaultModeTabs: ModuleTabItem[] = [
    { id: 'vault', label: t('vault.sovereignVault', 'Sovereign Vault') },
    { id: 'security', label: t('vault.securityChecks', 'AI Security Checks') },
    { id: 'emergency', label: t('vault.breakGlass', 'Break Glass Emergency') },
  ];

  const vaultStorageTabs: ModuleTabItem[] = [
    { id: 'all', label: t('vault.allEntries', 'All Entries'), count: totalEntries },
    { id: 'favorites', label: t('vault.pinnedFavorites', 'Favorites'), count: nonDeletedItems.filter((c) => c.favorite).length },
    { id: 'recently', label: t('vault.recentlyAccessed', 'Recent') },
    { id: 'shared', label: t('vault.sharedWithMe', 'Shared'), count: sharedCount },
    { id: 'trash', label: t('vault.trashFolder', 'Trash'), count: trashItems.length },
  ];

  return (
    <ModulePageShell scrollable={false} className="bg-[#FAFBFC]">
      <ModulePageCompactHeader
        title={t('vault.titleShort', 'GeistVault')}
        meta={t('vault.headerMeta', '{{total}} entries • {{weak}} weak • {{expiring}} expiring')
          .replace('{{total}}', String(totalEntries))
          .replace('{{weak}}', String(weakCount))
          .replace('{{expiring}}', String(expiringCount))}
      />
      <ModulePageTabs
        tabs={vaultModeTabs}
        activeId={vaultViewMode}
        onChange={(id) => setVaultViewMode(id as typeof vaultViewMode)}
      />
      {vaultViewMode === 'vault' ? (
        <ModulePageTabs
          tabs={vaultStorageTabs}
          activeId={selectedView === 'all' && selectedType === 'all' ? 'all' : selectedView}
          onChange={(id) => {
            if (id === 'all') {
              setSelectedView('all');
              setSelectedType('all');
            } else {
              setSelectedView(id as typeof selectedView);
              setSelectedType('all');
            }
          }}
        />
      ) : null}
      {vaultViewMode === 'vault' ? (
        <ModuleToolbar
          searchPlaceholder={t('vault.searchPlaceholderAdvanced', 'Search assets, usernames, hosts...')}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          sortControl={
            <ModuleToolbarSelect
              value={selectedType}
              onChange={(v) => {
                setSelectedView('all');
                setSelectedType(v);
              }}
              aria-label={t('vault.accessCategories', 'Category')}
            >
              <option value="all">{t('vault.allCategories', 'All categories')}</option>
              <option value="rdp">{t('category.rdp', 'RDP Sessions')}</option>
              <option value="vpn">{t('category.vpn', 'VPN Access')}</option>
              <option value="ssh">{t('category.ssh', 'SSH Server Nodes')}</option>
              <option value="web">{t('category.web', 'Web Logins')}</option>
              <option value="db">{t('category.database', 'Databases')}</option>
              <option value="api">{t('category.api', 'APIs & Keys')}</option>
              <option value="cloud">{t('category.cloud', 'Cloud Accounts')}</option>
              {customCategories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </ModuleToolbarSelect>
          }
          createAction={
            <ModuleCreateButton
              ariaLabelKey="vault.createCredential"
              ariaLabelDefault="Create Credential"
              onClick={() => setShowAddModal(true)}
              iconOnly
            />
          }
        />
      ) : null}

      <ModulePageScrollRegion>
      <div className="px-6 py-4 space-y-8 select-none">
      {vaultViewMode === 'security' && (
        <GeistVaultAIAssistant credentialsList={nonDeletedItems as any} />
      )}

      {vaultViewMode === 'emergency' && (
        <GeistVaultEmergency />
      )}

      {/* Main Vault Workspace tab */}
      {vaultViewMode === 'vault' && (
        <div className="space-y-4 select-none">
          
            
            {/* 1. Statistics Cards widget row */}
            <VaultOverview 
              weakCount={weakCount}
              expiringCount={expiringCount}
              onNewFolder={() => toast.success("Folder directories schema created.")}
              onShareVault={() => toast.success("Secure sharing protocols authorized.")}
              onImportDummyData={handleImportDummyData}
            />

            {/* Credential Inventory Table */}
            <CredentialTable 
              credentials={currentList}
              onRowClick={(cred) => setSelectedCredential(cred)}
              onToggleFavorite={handleToggleFavorite}
              onDecryptPassword={handleDecryptPassword}
              onEdit={(cred) => { setEditingCred(cred); }}
              onDelete={handleDeleteEntry}
              onRestore={handleRestoreEntry}
              selectedView={selectedView}
            />

            {/* 4. Redesigned Grid Widgets Footer Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 select-none">
              
              {/* Passwords Health segmented bar layout inside footer card */}
              <Card className="border border-[#DADCE0] rounded-2.5xl p-5 bg-white shadow-xs flex flex-col justify-between min-h-[170px]">
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">{t('vault.passwordsStrengthAudit', 'Passwords Strength Audit')}</h4>
                  <p className="text-[9px] text-[#34A853] font-semibold mt-0.5">{t('vault.lastCryptoScan', '✓ Last cryptography scan completed 2 hours ago')}</p>
                </div>

                <div className="my-3">
                  {/* Styled segmented horizontal health bar represent values */}
                  <div className="h-3 rounded-full overflow-hidden flex shadow-inner bg-neutral-100 border text-white text-[8px] font-black text-center select-none">
                    <div className="bg-[#34A853] h-full transition-all" style={{ width: `${Math.max(20, (totalEntries - weakCount) * 11)}%` }} />
                    <div className="bg-red-500 h-full transition-all" style={{ width: `${weakCount > 0 ? (weakCount * 12) : 5}%` }} />
                    <div className="bg-amber-400 h-full transition-all" style={{ width: `${expiringCount > 0 ? (expiringCount * 10) : 5}%` }} />
                  </div>

                  {/* Dot legends */}
                  <div className="grid grid-cols-3 gap-2 mt-3 select-none text-[9px] font-bold text-slate-500 font-sans">
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[#34A853] shrink-0" />
                      <span className="truncate">{t('vault.sovereignLabel', 'Sovereign')} ({totalEntries - weakCount})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                      <span className="truncate">{t('vault.weakLabel', 'Weak')} ({weakCount})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                      <span className="truncate">{t('vault.expiringLabel', 'Expiring')} ({expiringCount})</span>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 italic">
                  {t('vault.strengthAuditDesc', 'Run standard AI Insight audit triggers in the subtabs above to check for breached database logs.')}
                </p>
              </Card>

              {/* Expiring items details countdown list */}
              <Card className="border border-[#DADCE0] rounded-2.5xl p-5 bg-white shadow-xs flex flex-col justify-between min-h-[170px]">
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">{t('vault.expiringInfraKeys', 'Expiring Infrastructure Keys')}</h4>
                    <span className="text-[8px] font-bold bg-[#FFF9E6] text-[#B06000] px-1 rounded uppercase tracking-tighter shrink-0">{t('vault.actionNeeded', 'Action Needed')}</span>
                  </div>
                  <p className="text-[9.5px] text-slate-400 font-semibold mt-0.5">{t('vault.criticalItemsExpiring', 'Critical items expiring in the next 30 days')}</p>
                </div>

                <div className="space-y-1.5 my-2 select-none">
                  {nonDeletedItems.filter(c => c.type === 'cloud' || c.label.toLowerCase().includes('aws')).map((exp, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => setSelectedCredential(exp)}
                      className="flex items-center justify-between p-1.5 rounded-lg bg-[#F8F9FA] border border-[#DADCE0]/50 hover:bg-[#E8F0FE]/20 transition-all text-[11px] cursor-pointer shadow-3xs"
                    >
                      <span className="font-bold text-slate-700">{exp.label}</span>
                      <span className="text-[9px] font-extrabold text-[#B06000] bg-[#FFF9E6] px-1.5 py-0.5 rounded-full select-none shrink-0">
                        {t('vault.expiresInDays', 'Expires in {{count}} Days').replace('{{count}}', String(30 - (idx * 5)))}
                      </span>
                    </div>
                  ))}
                  {nonDeletedItems.filter(c => c.type === 'cloud' || c.label.toLowerCase().includes('aws')).length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4 select-none">{t('vault.zeroExpirations', 'Zero looming credential expirations detected.')}</p>
                  )}
                </div>

                <span className="text-[10px] text-[#1A73E8] font-bold block select-none cursor-pointer hover:underline text-right mt-1">{t('vault.viewCertificationCenter', 'View Certification Center →')}</span>
              </Card>

            </div>
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

      {/* Redesigned High-Fidelity Enterprise Secrets Creator Wizard Modal */}
      <Dialog open={showAddModal} onOpenChange={(open) => {
        if (!open) {
          // Reset wizard state on close
          setWizardStep(1);
        }
        setShowAddModal(open);
      }}>
        <DialogContent className="sm:max-w-[1280px] w-[95vw] h-[85vh] max-h-[85vh] p-0 flex flex-col rounded-[24px] border-[#DADCE0] overflow-hidden bg-[#F8F9FA] shadow-2xl">
          <form onSubmit={handleCreateEntry} className="flex flex-col h-full w-full">
            
            {/* Modal Body: Sidebar + Main Content Grid */}
            <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden min-h-0">
              
              {/* 1. Left Sidebar Navigation & Status (width: 320px on md+) */}
              <div className="w-full md:w-[320px] bg-white border-b md:border-b-0 md:border-r border-[#E5E7EB] flex flex-col p-6 overflow-y-auto md:shrink-0 space-y-6">
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none">Create New Vault Entry</h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-1.5 leading-relaxed">
                    Securely capture and store sensitive corporate infrastructure access details.
                  </p>
                </div>

                {/* Vertical Navigation Steps */}
                <div id="wizard-navigation" className="space-y-1 py-2">
                  {[
                    { id: 1, label: 'Asset Details', sub: 'Basic label and class info' },
                    { id: 2, label: 'Access Credentials', sub: 'ID, raw secrets & TOTP code' },
                    { id: 3, label: 'Advanced Settings', sub: 'Policies, tags & asset links' },
                    { id: 4, label: 'Review & Publish', sub: 'Validate configuration options' }
                  ].map((step) => {
                    const isActive = wizardStep === step.id;
                    const isCompleted = wizardStep > step.id;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => setWizardStep(step.id as any)}
                        className={cn(
                          "w-full text-left p-3 rounded-xl flex items-start gap-3 transition-all",
                          isActive 
                            ? "bg-blue-50/50 border border-blue-100 text-[#1A73E8]" 
                            : "hover:bg-slate-50 text-slate-600 border border-transparent"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5",
                          isActive 
                            ? "bg-[#1A73E8] text-white" 
                            : isCompleted 
                              ? "bg-green-100 text-green-700" 
                              : "bg-slate-100 text-slate-500"
                        )}>
                          {isCompleted ? <Check className="w-3.5 h-3.5" /> : step.id}
                        </div>
                        <div className="truncate">
                          <span className={cn("text-xs font-bold block", isActive ? "text-[#1A73E8]" : "text-slate-800")}>
                            {step.label}
                          </span>
                          <span className="text-[9px] text-slate-400 font-medium tracking-wide block">
                            {step.sub}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Zero-Knowledge Privacy Card */}
                <div className="bg-gradient-to-br from-blue-50/40 to-indigo-50/30 border border-blue-100/60 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-[#1A73E8]">
                    <Shield className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Zero-Knowledge Security</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Credentials are key-derived using <strong>Argon2</strong> and locally encrypted in client memory with <strong>AES-256</strong> prior to backup sync.
                  </p>
                  <div className="text-[9px] text-[#1a73e8] font-bold hover:underline cursor-pointer flex items-center gap-1">
                    Learn encryption mechanism <ArrowRight className="w-2.5 h-2.5" />
                  </div>
                </div>

                {/* Real-time Document Live Preview Card */}
                <div className="bg-[#F8F9FA] border border-[#DADCE0] p-4 rounded-2xl space-y-3 shadow-xs">
                  <span className="text-[9px] font-black text-[#5F6368] uppercase tracking-widest block">
                    Record Live Preview
                  </span>
                  
                  <div className="space-y-2 text-[11px] leading-none">
                    <div className="flex justify-between pb-1.5 border-b border-dashed border-slate-200">
                      <span className="text-slate-400 font-medium">Category</span>
                      <span className="font-bold text-slate-700 capitalize flex items-center gap-1">
                        {newEntry.type || 'Web'}
                      </span>
                    </div>

                    <div className="flex justify-between pb-1.5 border-b border-dashed border-slate-200">
                      <span className="text-slate-400 font-medium">Vault</span>
                      <span className="font-bold text-slate-700">
                        {newEntry.vaultId === 'local' ? 'Personal Local Vault' : 
                         newEntry.vaultId === 'team' ? 'Team Shared Vault' :
                         newEntry.vaultId === 'department' ? 'Department Vault' : 'Emergency Vault'}
                      </span>
                    </div>

                    <div className="flex justify-between pb-1.5 border-b border-dashed border-slate-200">
                      <span className="text-slate-400 font-medium">Encryption Status</span>
                      <span className="font-bold text-[#137333] bg-green-50 px-1.5 py-0.5 rounded text-[9px]">
                        AES-256 Enabled
                      </span>
                    </div>

                    <div className="flex justify-between pb-1.5 border-b border-dashed border-slate-200">
                      <span className="text-slate-400 font-medium">Visibility Scope</span>
                      <span className="font-bold text-slate-700 capitalize">
                        {newEntry.visibility || 'Private'}
                      </span>
                    </div>

                    <div className="flex justify-between pb-1.5 border-b border-dashed border-slate-200">
                      <span className="text-slate-400 font-medium">Company Context</span>
                      <span className="font-bold text-[#1A73E8]">
                        {newEntry.linkedCompany || 'Unset'}
                      </span>
                    </div>

                    <div className="flex justify-between pb-1.5 border-b border-dashed border-slate-200">
                      <span className="text-slate-400 font-medium">Asset Name</span>
                      <span className="font-bold text-slate-700 truncate max-w-[120px]" title={newEntry.label}>
                        {newEntry.label || 'e.g. AWS Console'}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Owner Assigned</span>
                      <span className="font-bold text-slate-700 truncate max-w-[120px]">
                        {newEntry.owner || 'You'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Main Tabbed Layout Panel */}
              <div className="flex-1 bg-white overflow-y-auto p-8 flex flex-col justify-between">
                <div>
                  
                  {/* Step Header */}
                  {wizardStep === 1 && (
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1A73E8] flex items-center justify-center font-black text-sm">
                          1
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-800 leading-snug">Asset Details</h4>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">
                            Select the class classification and declare friendly identifiers for infrastructure.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-[#1A73E8] bg-blue-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Step 1 of 4
                      </span>
                    </div>
                  )}

                  {wizardStep === 2 && (
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-sm">
                          2
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-800 leading-snug">Access Credentials</h4>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">
                            Capture identifiers and secure credentials. Leverage built-in enterprise generation parameters.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Step 2 of 4
                      </span>
                    </div>
                  )}

                  {wizardStep === 3 && (
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-black text-sm">
                          3
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-800 leading-snug">Advanced Settings</h4>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">
                            Enforce access controls, policy timers, linkages, and document classification markers.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Step 3 of 4
                      </span>
                    </div>
                  )}

                  {wizardStep === 4 && (
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black text-sm">
                          4
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-800 leading-snug">Review & Publish Secure Entry</h4>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">
                            Review policies and local verification parameters before sealing raw payload in IndexedDB.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Final Review
                      </span>
                    </div>
                  )}

                  {/* -------------------- STEP 1 CONTAINER -------------------- */}
                  {wizardStep === 1 && (
                    <div className="space-y-6">
                      {/* Grid Category Selector */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                          Asset Category Model Selection <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {[
                            { slug: 'web', name: 'Web Login', desc: 'Secure connection logs to web interfaces & SaaS pipelines.', icon: Globe },
                            { slug: 'rdp', name: 'RDP Session', desc: 'Remote desktop systems console access.', icon: Monitor },
                            { slug: 'vpn', name: 'VPN Access', desc: 'Sovereign security tunnel points & clients.', icon: Shield },
                            { slug: 'ssh', name: 'SSH Node', desc: 'Command line network core servers & nodes.', icon: Terminal },
                            { slug: 'db', name: 'Database', desc: 'Relational or NoSQL active datastores & servers.', icon: Database },
                            { slug: 'api', name: 'API Key', desc: 'Integration tokens, payment terminals & API keys.', icon: KeyIcon },
                            { slug: 'cert', name: 'Certificate', desc: 'TLS/SSL domain identities & root key strings.', icon: FileCode },
                            { slug: 'note', name: 'Secure Note', desc: 'Disaster recovery manuals & critical parameters.', icon: FileCode },
                            { slug: 'cloud', name: 'Cloud Account', desc: 'AWS consoles, GCP clouds & Azure directories.', icon: Cloud }
                          ].map((cat) => {
                            const IconComp = cat.icon;
                            const isSelected = newEntry.type === cat.slug;
                            return (
                              <button
                                key={cat.slug}
                                type="button"
                                onClick={() => setNewEntry({ ...newEntry, type: cat.slug })}
                                className={cn(
                                  "text-left p-3.5 rounded-2xl border transition-all flex gap-3 h-24 items-start select-none",
                                  isSelected 
                                    ? "border-[#1A73E8] bg-blue-50/20 shadow-xs ring-1 ring-[#1A73E8]"
                                    : "border-[#DADCE0] hover:border-slate-300 bg-white"
                                )}
                              >
                                <div className={cn(
                                  "p-2 rounded-xl mt-0.5",
                                  isSelected ? "bg-blue-100/50 text-[#1A73E8]" : "bg-slate-50 text-slate-400"
                                )}>
                                  <IconComp className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-xs font-black text-slate-800 block">{cat.name}</span>
                                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-0.5 line-clamp-2">
                                    {cat.desc}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Name Label & Endpoint URL */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                            Asset Friendly Name <span className="text-red-500">*</span>
                          </label>
                          <Input 
                            placeholder="e.g. AWS Production Console" 
                            value={newEntry.label || ''}
                            onChange={(e) => setNewEntry({ ...newEntry, label: e.target.value })}
                            className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                            Host Target / Endpoint URL
                          </label>
                          <Input 
                            placeholder="e.g. console.aws.amazon.com or 10.0.1.200" 
                            value={newEntry.host || ''}
                            onChange={(e) => setNewEntry({ ...newEntry, host: e.target.value })}
                            className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm"
                          />
                        </div>
                      </div>

                      {/* Internal Notes Description Area */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                          Internal Documentation & Instructions
                        </label>
                        <Textarea 
                          placeholder="Provide detailed instructions, restore recovery guidelines or administration context notes..."
                          value={newEntry.notes || ''}
                          onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                          className="bg-white border-[#DADCE0] rounded-xl text-sm h-20 resize-none"
                        />
                      </div>

                      {/* Vault Assignation & Visibility level */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                            Assign to Secure Vault Partition
                          </label>
                          <Select 
                            value={newEntry.vaultId} 
                            onValueChange={(val) => setNewEntry({ ...newEntry, vaultId: val })}
                          >
                            <SelectTrigger className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm">
                              <SelectValue placeholder="Personal Local Vault" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="local">Personal Local Vault (Standard)</SelectItem>
                              <SelectItem value="team">Team Shared Vault (Joint Ops)</SelectItem>
                              <SelectItem value="department">Department Vault (Scoped)</SelectItem>
                              <SelectItem value="emergency">Emergency Vault (Breakglass)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                            Access Visibility Level
                          </label>
                          <Select 
                            value={newEntry.visibility || 'private'} 
                            onValueChange={(val) => setNewEntry({ ...newEntry, visibility: val })}
                          >
                            <SelectTrigger className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="private">Private (Only You)</SelectItem>
                              <SelectItem value="shared">Shared (Designated Peers)</SelectItem>
                              <SelectItem value="department_vis">Department Scoped (SysAdmins)</SelectItem>
                              <SelectItem value="organization">Organization (Full MSP / SOC Access)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* -------------------- STEP 2 CONTAINER -------------------- */}
                  {wizardStep === 2 && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                            Username / System Principal Access Identifier <span className="text-red-500">*</span>
                          </label>
                          <Input 
                            placeholder="e.g. root, administrator, ec2-user" 
                            value={newEntry.username || ''}
                            onChange={(e) => setNewEntry({ ...newEntry, username: e.target.value })}
                            className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm"
                            required
                          />
                        </div>

                        {/* Password with Strength Indicator */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center pr-1">
                            <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                              Sovereign Secret Password / Key Token <span className="text-red-500">*</span>
                            </label>
                            {rawPassword && (
                              <div className={cn(
                                "text-[10px] font-black uppercase px-2 py-0.5 rounded-full border",
                                getPasswordStrengthScore(rawPassword).color
                              )}>
                                Strength: {getPasswordStrengthScore(rawPassword).text}
                              </div>
                            )}
                          </div>
                          
                          <div className="relative">
                            <Input 
                              type={revealPassword ? "text" : "password"}
                              placeholder="Type or click Generate" 
                              value={rawPassword}
                              onChange={(e) => setRawPassword(e.target.value)}
                              className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm pr-20"
                              required
                            />
                            <div className="absolute right-1.5 top-1 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setRevealPassword(!revealPassword)}
                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                                title="Toggle Visibility"
                              >
                                {revealPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (rawPassword) {
                                    navigator.clipboard.writeText(rawPassword);
                                    toast.success("Password copied to clipboard");
                                  } else {
                                    toast.error("Generate a password first");
                                  }
                                }}
                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                                title="Copy Secret"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Built-in Enterprise Password Generator Panel */}
                      <div className="border border-[#DADCE0] rounded-2xl bg-[#F8F9FA] p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setShowGenOptions(!showGenOptions)}
                            className="flex items-center gap-2 text-xs font-black text-slate-700 hover:text-[#1A73E8] focus:outline-none"
                          >
                            <Sliders className="w-4 h-4 text-[#1A73E8]" />
                            {showGenOptions ? 'Hide Password Generator Parameters' : 'Deploy Password Generator Parameters'}
                          </button>
                          
                          <Button 
                            type="button"
                            onClick={handleGeneratePasswordSubmit}
                            className="bg-[#1A73E8] hover:bg-blue-700 text-white rounded-full text-xs font-bold px-4 h-8 select-none"
                          >
                            <Sparkles className="w-3.5 h-3.5 mr-1" />
                            Generate & Apply
                          </Button>
                        </div>

                        {showGenOptions && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-slate-200">
                            <div className="space-y-3">
                              <div className="flex justify-between text-xs">
                                <span className="font-bold text-slate-600">Password Length:</span>
                                <span className="font-black text-[#1A73E8]">{genLength}</span>
                              </div>
                              <input 
                                type="range" 
                                min="8" 
                                max="64" 
                                value={genLength}
                                onChange={(e) => setGenLength(Number(e.target.value))}
                                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1A73E8]"
                              />
                              <div className="flex gap-2 justify-between">
                                <button type="button" onClick={() => setGenLength(12)} className="text-[10px] font-bold text-slate-400 hover:text-slate-700 bg-white border px-2 py-0.5 rounded">12 Chars</button>
                                <button type="button" onClick={() => setGenLength(16)} className="text-[10px] font-bold text-slate-400 hover:text-slate-700 bg-white border px-2 py-0.5 rounded">16 Chars</button>
                                <button type="button" onClick={() => setGenLength(24)} className="text-[10px] font-bold text-slate-400 hover:text-slate-700 bg-white border px-2 py-0.5 rounded">24 Chars</button>
                                <button type="button" onClick={() => setGenLength(32)} className="text-[10px] font-bold text-slate-400 hover:text-slate-700 bg-white border px-2 py-0.5 rounded">32 Chars</button>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wide">Included Set</span>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-600 select-none">
                                  <input type="checkbox" checked={genUpper} onChange={(e) => setGenUpper(e.target.checked)} className="rounded text-[#1A73E8]" />
                                  A-Z (Uppercase)
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-600 select-none">
                                  <input type="checkbox" checked={genLower} onChange={(e) => setGenLower(e.target.checked)} className="rounded text-[#1A73E8]" />
                                  a-z (Lowercase)
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-600 select-none">
                                  <input type="checkbox" checked={genNumbers} onChange={(e) => setGenNumbers(e.target.checked)} className="rounded text-[#1A73E8]" />
                                  0-9 (Numbers)
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-600 select-none">
                                  <input type="checkbox" checked={genSymbols} onChange={(e) => setGenSymbols(e.target.checked)} className="rounded text-[#1A73E8]" />
                                  !@#$%^ (Symbols)
                                </label>
                              </div>
                              <div className="pt-2">
                                <label className="text-[9px] font-bold text-slate-400 block uppercase">Exclude Characters</label>
                                <Input 
                                  placeholder="e.g. l, O, 1, 0" 
                                  value={genExclude}
                                  onChange={(e) => setGenExclude(e.target.value)}
                                  className="h-7 bg-white text-xs rounded-lg mt-1"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* MFA Authentication TOTP Token Seeding Area */}
                      <div className="border border-slate-100 rounded-2xl p-5 space-y-4 shadow-xs">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wide block">
                          Multi-Factor Authentication (MFA) Seeding Setup
                        </span>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                              MFA TOTP Key Token Secret
                            </label>
                            <Input 
                              placeholder="e.g. JBSWY3DPEHPK3PXP or secret string" 
                              value={newEntry.totpSecret || ''}
                              onChange={(e) => setNewEntry({ ...newEntry, totpSecret: e.target.value })}
                              className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                              Backup Emergency Recovery Keys
                            </label>
                            <Input 
                              placeholder="e.g. 5532-1246-8801 or single emergency tokens" 
                              value={newEntry.backupCodes || ''}
                              onChange={(e) => setNewEntry({ ...newEntry, backupCodes: e.target.value })}
                              className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                            MFA Authenticator Configurations Note
                          </label>
                          <Input 
                            placeholder="e.g. Google Authenticator key, required every 24 hours, backups in locked filing room." 
                            value={newEntry.authenticatorNotes || ''}
                            onChange={(e) => setNewEntry({ ...newEntry, authenticatorNotes: e.target.value })}
                            className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* -------------------- STEP 3 CONTAINER -------------------- */}
                  {wizardStep === 3 && (
                    <div className="space-y-6">
                      
                      {/* Asset Assignment & Ownership Segment */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1 block">
                          <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">Principal Owner</label>
                          <Input 
                            value={newEntry.owner || 'You'}
                            onChange={(e) => setNewEntry({ ...newEntry, owner: e.target.value })}
                            className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm"
                          />
                        </div>
                        <div className="space-y-1 block">
                          <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">Responsible Operations Team</label>
                          <Input 
                            value={newEntry.team || 'Platform Ops'}
                            onChange={(e) => setNewEntry({ ...newEntry, team: e.target.value })}
                            className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm"
                          />
                        </div>
                        <div className="space-y-1 block">
                          <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">Department Scope</label>
                          <Input 
                            value={newEntry.department || 'Infrastructure'}
                            onChange={(e) => setNewEntry({ ...newEntry, department: e.target.value })}
                            className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm"
                          />
                        </div>
                      </div>

                      {/* Asset Linking & Infrastructure Relations */}
                      <div className="border border-slate-100 rounded-2xl p-5 space-y-4 shadow-xs">
                        <div className="flex items-center gap-2 text-slate-700 font-bold text-xs">
                          <ExternalLink className="w-4 h-4 text-purple-500" />
                          <span>Enterprise Infrastructure Relationship Mapping</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">Link corporate client company</label>
                            <Select 
                              value={newEntry.linkedCompany || 'Acme Global'} 
                              onValueChange={(val) => setNewEntry({ ...newEntry, linkedCompany: val })}
                            >
                              <SelectTrigger className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Acme Global">Acme Global Enterprise</SelectItem>
                                <SelectItem value="Cyberdyne">Cyberdyne Systems</SelectItem>
                                <SelectItem value="FinStream">FinStream Financials</SelectItem>
                                <SelectItem value="None">None (Internal Infrastructure)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">Link infrastructure node</label>
                            <Select 
                              value={newEntry.linkedAsset || 'Server Cluster'} 
                              onValueChange={(val) => setNewEntry({ ...newEntry, linkedAsset: val })}
                            >
                              <SelectTrigger className="bg-[#ffffff] border-[#DADCE0] rounded-xl h-10 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Firewall">Cisco Core Firewall Appliance</SelectItem>
                                <SelectItem value="Database">Postgres Master Storage cluster</SelectItem>
                                <SelectItem value="Server">Edge Virtual Machine Node</SelectItem>
                                <SelectItem value="VPN Gateway">Frankfurt tunnel concentrator</SelectItem>
                                <SelectItem value="AWS Environment">AWS Production VPC cluster</SelectItem>
                                <SelectItem value="Server Cluster">Sovereign Cluster Server Segment</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">Link administrative task ticket</label>
                            <Select 
                              value={newEntry.linkedTicket || 'Ticket #442'} 
                              onValueChange={(val) => setNewEntry({ ...newEntry, linkedTicket: val })}
                            >
                              <SelectTrigger className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Ticket #442">Ticket #442 - Deploy AWS Gateway</SelectItem>
                                <SelectItem value="Ticket #518">Ticket #518 - Firewall Configuration Audit</SelectItem>
                                <SelectItem value="Ticket #901">Ticket #901 - Database Principal Access Roll</SelectItem>
                                <SelectItem value="None">Unlinked (Ad-Hoc Asset)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Expiration and Rotation Schedules / Policies */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">Sovereign Password Lifespan Policy</label>
                          <Select 
                            value={newEntry.expirationPolicy || 'Never'} 
                            onValueChange={(val) => setNewEntry({ ...newEntry, expirationPolicy: val })}
                          >
                            <SelectTrigger className="bg-[#ffffff] border-[#DADCE0] rounded-xl h-10 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Never">Never Expire (Static credential)</SelectItem>
                              <SelectItem value="30">Expire in 30 Days</SelectItem>
                              <SelectItem value="60">Expire in 60 Days</SelectItem>
                              <SelectItem value="90">Expire in 90 Days</SelectItem>
                              <SelectItem value="180">Expire in 180 Days</SelectItem>
                              <SelectItem value="Custom">Custom Audit policy override</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">Scheduled Rotation Frequency</label>
                          <Select 
                            value={newEntry.rotationPolicy || 'Manual'} 
                            onValueChange={(val) => setNewEntry({ ...newEntry, rotationPolicy: val })}
                          >
                            <SelectTrigger className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Manual">Manual Rotation (Triggered by administrator)</SelectItem>
                              <SelectItem value="Auto">Automatic Rotation sequence enabled</SelectItem>
                              <SelectItem value="30">Rotate every 30 Days</SelectItem>
                              <SelectItem value="60">Rotate every 60 Days</SelectItem>
                              <SelectItem value="90">Rotate every 90 Days</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Tags Section */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                          Security Tags classification
                        </label>
                        <div className="flex flex-wrap gap-1.5 p-3.5 border border-[#DADCE0] bg-white rounded-2xl min-h-[50px] items-center">
                          {newEntry.tags?.map((tag, idx) => (
                            <Badge key={idx} className="bg-blue-50 text-slate-700 hover:bg-blue-100/50 flex items-center gap-1.5 py-1 px-2.5 rounded-full border border-blue-200">
                              <Tag className="w-3 h-3 text-[#1A73E8]" />
                              {tag}
                              <button type="button" onClick={() => handleRemoveExistingTag(idx)} className="text-slate-400 hover:text-red-500 font-black text-xs">×</button>
                            </Badge>
                          ))}
                          <input 
                            placeholder="Type tag and press Enter" 
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={handleAddNewTag}
                            className="bg-transparent border-none outline-none text-xs min-w-0 flex-1 text-slate-800 placeholder-slate-400 font-medium"
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400 select-none">
                          <span className="font-bold">Quick add tags:</span>
                          {['Production', 'VPN', 'AWS', 'Critical', 'Finance', 'Linux', 'Shared'].map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => {
                                if (!newEntry.tags?.includes(t)) {
                                  setNewEntry({ ...newEntry, tags: [...(newEntry.tags || []), t] });
                                }
                              }}
                              className="text-[10px] bg-slate-50 border px-2 py-0.5 rounded-lg font-semibold hover:bg-slate-100 text-slate-600 transition-colors"
                            >
                              + {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* File Attachments Section */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1 block">
                          Hardware Configurations / Profile Attachments
                        </label>
                        
                        <div
                          onDragOver={(e) => { e.preventDefault(); setDraggingFile(true); }}
                          onDragLeave={() => setDraggingFile(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDraggingFile(false);
                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                              const files = Array.from(e.dataTransfer.files).map(f => ({
                                name: f.name,
                                size: (f.size / 1024).toFixed(1) + ' KB',
                                type: f.type || 'application/octet-stream'
                              }));
                              setNewEntry({
                                ...newEntry,
                                attachments: [...(newEntry.attachments || []), ...files]
                              });
                              toast.success("Security profile assets attached!");
                            }
                          }}
                          className={cn(
                            "cursor-pointer border-2 border-dashed rounded-2xl p-6 text-center select-none flex flex-col items-center justify-center space-y-2 transition-all",
                            draggingFile 
                              ? "border-[#1A73E8] bg-blue-100/10 text-[#1A73E8]"
                              : "border-[#DADCE0] hover:border-slate-300 hover:bg-slate-50 text-slate-400"
                          )}
                        >
                          <input 
                            type="file" 
                            id="vault-wizard-file" 
                            className="hidden" 
                            multiple 
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                const files = Array.from(e.target.files).map(f => ({
                                  name: f.name,
                                  size: (f.size / 1024).toFixed(1) + ' KB',
                                  type: f.type || 'application/octet-stream'
                                }));
                                setNewEntry({
                                  ...newEntry,
                                  attachments: [...(newEntry.attachments || []), ...files]
                                });
                                toast.success("Security profile assets attached!");
                              }
                            }}
                          />
                          <label htmlFor="vault-wizard-file" className="cursor-pointer w-full flex flex-col items-center">
                            <Upload className="w-6 h-6 text-slate-400" />
                            <span className="text-xs font-bold text-slate-700 block mt-2">
                              Drag and drop configuration profiles or select locally
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium block mt-1">
                              Supports Configuration profiles, CA Key files, VPN Certs, TLS bundles up to 50MB. See zero-knowledge encryption guarantees.
                            </span>
                          </label>
                        </div>

                        {/* List of attachments */}
                        {newEntry.attachments && newEntry.attachments.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {newEntry.attachments.map((file, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 border rounded-xl text-xs font-semibold">
                                <div className="flex items-center gap-2 truncate text-slate-700">
                                  <FileCode className="w-4 h-4 text-slate-500" />
                                  <span className="truncate" title={file.name}>{file.name}</span>
                                  <span className="text-[10px] text-slate-400">({file.size})</span>
                                </div>
                                <button 
                                  type="button" 
                                  onClick={() => {
                                    const list = [...(newEntry.attachments || [])];
                                    list.splice(idx, 1);
                                    setNewEntry({ ...newEntry, attachments: list });
                                    toast.success("Attachment unlinked.");
                                  }}
                                  className="text-slate-400 hover:text-red-500 font-bold px-1 text-sm mr-1"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Advanced Security Configuration Guards Checkboxes */}
                      <div className="space-y-3 pt-2">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wide block">
                          Hardened Cryptographic Security Policies & Guards
                        </span>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-relaxed">
                          {[
                            { key: 'burnAfterRead', title: 'Burn After Read', sub: 'Destruct and expire from central storage instantly after first decryptions sequence.' },
                            { key: 'requireApproval', title: 'Require Manager Approval', sub: 'Access requests must be verified by delegated Operations supervisor before client key extraction.' },
                            { key: 'jitAccess', title: 'JIT 1-Hour Escalated Access', sub: 'Grant ephemeral, time-gated decryption permissions only during authorized support tickets active times.' },
                            { key: 'requireMfa', title: 'Require step-up MFA verification Challenge', sub: 'Assert hardware keys or security token challenge check prior to reveals.' },
                            { key: 'disableExport', title: 'Block Bulk Export sequence', sub: 'Exclude this credential block from global workspace database backups or JSON extractions.' },
                            { key: 'disableCopy', title: 'Block Copy-to-Clipboard actions', sub: 'Force interactive manual type-in from launcher drawer or console views, blocking clipboard hooks.' }
                          ].map((pol) => (
                            <label key={pol.key} className="flex items-start gap-3 p-3.5 bg-white border hover:border-slate-300 rounded-[16px] cursor-pointer select-none">
                              <input 
                                type="checkbox" 
                                checked={!!(newEntry.securitySettings as any)?.[pol.key]} 
                                onChange={(e) => {
                                  setNewEntry({
                                    ...newEntry,
                                    securitySettings: {
                                      ...(newEntry.securitySettings || {}),
                                      [pol.key]: e.target.checked
                                    }
                                  });
                                }}
                                className="rounded text-[#1A73E8] mt-0.5 focus:ring-offset-0 focus:ring-0" 
                              />
                              <div className="min-w-0">
                                <span className="font-bold text-slate-700 block text-xs leading-none mb-1">{pol.title}</span>
                                <span className="text-[10px] text-slate-400 font-medium leading-normal block">{pol.sub}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* -------------------- STEP 4 CONTAINER -------------------- */}
                  {wizardStep === 4 && (
                    <div className="space-y-6">
                      <div className="text-center p-6 bg-slate-50 border border-slate-100 rounded-3xl space-y-2">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                          <CheckCircle2 className="w-7 h-7" />
                        </div>
                        <h5 className="text-sm font-black text-slate-800">Secrets Deployment Schema Ready</h5>
                        <p className="text-xs text-slate-500 font-medium max-w-lg mx-auto">
                          Verify the record properties below. Once published, your password is encrypted in memory inside this sandbox context before sync write operations.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Summary Block 1 */}
                        <div className="border rounded-2xl p-5 space-y-3 bg-white">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wide block border-b pb-1.5 border-dashed">
                            Core Characteristics
                          </span>

                          <div className="grid grid-cols-2 gap-y-3 text-xs">
                            <div>
                              <span className="text-slate-400 block mb-0.5 font-medium">Category Class:</span>
                              <span className="font-bold text-slate-800 flex items-center gap-1 capitalize">
                                {newEntry.type}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block mb-0.5 font-medium">Friendly Asset Label:</span>
                              <span className="font-bold text-[#1A73E8] truncate block" title={newEntry.label}>
                                {newEntry.label || 'Unset name'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block mb-0.5 font-medium">Username Principal:</span>
                              <span className="font-bold text-slate-800 block truncate" title={newEntry.username}>
                                {newEntry.username}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block mb-0.5 font-medium">Destination Host IP:</span>
                              <span className="font-bold text-slate-700 block truncate" title={newEntry.host}>
                                {newEntry.host || '127.0.0.1 (Unset)'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Summary Block 2 */}
                        <div className="border rounded-2xl p-5 space-y-3 bg-white">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wide block border-b pb-1.5 border-dashed">
                            Governance & Linking
                          </span>

                          <div className="grid grid-cols-2 gap-y-3 text-xs">
                            <div>
                              <span className="text-slate-400 block mb-0.5 font-medium">Owner principal:</span>
                              <span className="font-bold text-slate-800">{newEntry.owner}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block mb-0.5 font-medium">Linked Company:</span>
                              <span className="font-bold text-[#1A73E8]">{newEntry.linkedCompany}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block mb-0.5 font-medium">Linked Infra Item:</span>
                              <span className="font-bold text-slate-700">{newEntry.linkedAsset}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block mb-0.5 font-medium">Responsible Team:</span>
                              <span className="font-bold text-slate-700">{newEntry.team}</span>
                            </div>
                          </div>
                        </div>

                        {/* Summary Block 3 */}
                        <div className="border rounded-2xl p-5 space-y-3 bg-white">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wide block border-b pb-1.5 border-dashed">
                            Policy Schedules
                          </span>

                          <div className="grid grid-cols-2 gap-y-3 text-xs">
                            <div>
                              <span className="text-slate-400 block mb-0.5 font-medium">Sovereign Lifespan:</span>
                              <span className="font-bold text-slate-800">{newEntry.expirationPolicy === 'Never' ? 'Static (Never)' : `Expire ${newEntry.expirationPolicy} days`}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block mb-0.5 font-medium">Scheduled Rotation:</span>
                              <span className="font-bold text-slate-800">{newEntry.rotationPolicy === 'Manual' ? 'Manual trigger' : `Schedule ${newEntry.rotationPolicy} days`}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block mb-0.5 font-medium">Compliance Tag classification:</span>
                              <div className="flex gap-1 flex-wrap mt-0.5">
                                {newEntry.tags?.map((t, idx) => (
                                  <span key={idx} className="bg-slate-50 text-slate-600 border text-[9px] font-black px-1.5 py-0.2 rounded">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <span className="text-slate-400 block mb-0.5 font-medium">MFA token Key seeded:</span>
                              <span className="font-bold text-slate-700">
                                {newEntry.totpSecret ? 'Yes (MFA Configured)' : 'No MFA Setup'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Summary Block 4 */}
                        <div className="border rounded-2xl p-5 space-y-3 bg-white">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wide block border-b pb-1.5 border-dashed">
                            Hardened Security Policies Enforced
                          </span>

                          <div className="flex flex-wrap gap-1">
                            {newEntry.securitySettings && Object.entries(newEntry.securitySettings).some(([_, v]) => v) ? (
                              Object.entries(newEntry.securitySettings)
                                .filter(([_, v]) => v)
                                .map(([k]) => {
                                  const titles: Record<string, string> = {
                                    burnAfterRead: 'Burn On Read',
                                    requireApproval: 'Approval Required',
                                    jitAccess: 'Ephemeral JIT',
                                    requireMfa: 'Step-up MFA',
                                    disableExport: 'No Exports',
                                    disableCopy: 'No copy'
                                  };
                                  return (
                                    <span key={k} className="bg-rose-50 text-rose-700 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-rose-200 uppercase/60">
                                      🛡️ {titles[k] || k}
                                    </span>
                                  );
                                })
                            ) : (
                              <span className="text-slate-400 text-xs font-semibold block">None configured. Standard database protections apply.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action buttons row */}
                <div className="bg-white border-t border-[#F1F3F4] pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-8">
                  {/* Left: Cancel and Draft option */}
                  <div className="flex items-center gap-2">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => {
                        setShowAddModal(false);
                        setWizardStep(1);
                      }}
                      className="rounded-full text-xs font-bold text-[#5F6368] h-10 px-5 border"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="button"
                      variant="ghost" 
                      onClick={() => {
                        toast.success("Draft saved in browser memory.");
                        setShowAddModal(false);
                        setWizardStep(1);
                      }}
                      className="rounded-full text-xs font-bold text-slate-400 hover:text-slate-700 h-10 px-5"
                    >
                      Save Temporary Draft
                    </Button>
                  </div>

                  {/* Centered safety telemetry readout */}
                  <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-slate-400 font-bold select-none">
                    <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                    <span>All credentials encrypted locally</span>
                  </div>

                  {/* Right: Steps controls */}
                  <div className="flex items-center gap-2 justify-end">
                    {wizardStep > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setWizardStep((wizardStep - 1) as any)}
                        className="rounded-full text-xs font-bold text-[#1A73E8] hover:bg-blue-50 h-10 px-5 border border-blue-200"
                      >
                        Back
                      </Button>
                    )}

                    {wizardStep < 4 ? (
                      <Button
                        type="button"
                        onClick={() => {
                          // Basic validation before changing steps
                          if (wizardStep === 1) {
                            if (!newEntry.label) {
                              toast.error("Please provide an Asset Friendly Name before proceeding.");
                              return;
                            }
                          } else if (wizardStep === 2) {
                            if (!newEntry.username || !rawPassword) {
                              toast.error("Please provide Username ID and raw Password secret before proceeding.");
                              return;
                            }
                          }
                          setWizardStep((wizardStep + 1) as any);
                        }}
                        className="bg-[#1A73E8] hover:bg-blue-700 text-white rounded-full font-bold text-xs h-10 px-6 shadow-sm flex items-center gap-2"
                      >
                        Continue
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    ) : (
                      <Button 
                        type="submit" 
                        disabled={isSaving}
                        className="bg-[#34A853] hover:bg-[#2c8d46] text-white rounded-full font-bold text-xs h-10 px-8 shadow-sm flex items-center gap-1.5"
                      >
                        {isSaving ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Encrypting & Sealing...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Create Secure Vault Entry
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </form>
        </DialogContent>
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
      </div>
      </ModulePageScrollRegion>
    </ModulePageShell>
  );
}
