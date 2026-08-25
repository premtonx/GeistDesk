import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { startOrchestratorConfigSync } from '../../lib/aiOrchestratorClient';
import { isDemoLoginEnabled } from '../../lib/runtime-env';
import { 
  Lock, 
  ArrowLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';
import {
  buildVaultKeySalt,
  decryptData,
  deriveMasterKey,
  deriveUserHybridKeyPair,
  encryptData,
  isLegacyMkEncryptedVault,
  slugifyVaultName,
} from '../../lib/credential-vault-crypto';
import {
  createVaultFolderOnServer,
  ensureDefaultPersonalVault,
  fetchAndDecryptVaults,
  migrateLegacyVaultToKek,
  PERSONAL_VAULT_SLUG,
  useVaultPersistence,
  type VaultCategory,
  type VaultCredential,
  type VaultKeyMap,
} from '../../lib/credential-vault-sync';
import {
  credentialVaultApi,
  type CredentialVaultFolder,
} from '../../services/credentialVaultApi';

async function fetchSimulationVaultCatalog(): Promise<{
  credentials: VaultCredential[];
  categories: VaultCategory[];
}> {
  try {
    const res = await fetch('/api/demo/catalog', { credentials: 'include' });
    if (!res.ok) return { credentials: [], categories: [] };
    const body = await res.json();
    return {
      credentials: Array.isArray(body.credentials) ? body.credentials : [],
      categories: Array.isArray(body.categories) ? body.categories : [],
    };
  } catch {
    return { credentials: [], categories: [] };
  }
}

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
import { ModuleToolbarSelect } from '../ui/module-page';
import { logAudit } from '../../services/auditService';

// Import GeistVault Modular Components
import { GeistVaultAIAssistant } from './geistvault/GeistVaultAIAssistant';
import { GeistVaultEmergency } from './geistvault/GeistVaultEmergency';

// Redesigned high-fidelity subcomponents
import { isShowcaseVaultCategory, isShowcaseVaultCredential } from './geistvault/DefaultData';
import { CredentialDrawer } from './geistvault/CredentialDrawer';
import { CredentialVaultCreateWizard } from '../vault/CredentialVaultCreateWizard';
import { VaultPageHeader } from '../vault/VaultPageHeader';
import { VaultKpiCards } from '../vault/VaultKpiCards';
import { VaultAiSecurityBanner } from '../vault/VaultAiSecurityBanner';
import { VaultSearchSection } from '../vault/VaultSearchSection';
import { VaultLeftSidebar, type VaultSmartFilter } from '../vault/VaultLeftSidebar';
import { VaultSecuritySidebar } from '../vault/VaultSecuritySidebar';
import { VaultViewModeSelector, type VaultAssetViewMode } from '../vault/VaultViewModeSelector';
import { VaultAssetViews } from '../vault/VaultAssetViews';
import { VaultFabMenu } from '../vault/VaultFabMenu';
import { VaultPropertiesPane } from '../vault/VaultPropertiesPane';
import { VaultExportDialog } from '../vault/VaultExportDialog';
import { VaultImportDialog, type VaultImportFormatOption } from '../vault/VaultImportDialog';
import { processVaultImportFile } from '../../lib/vault-import-processor';
import {
  ACCESS_CATEGORIES,
  VAULT_DEFINITIONS,
  resolveCredVaultId,
  isWeakCred,
  isExpiringCred,
  canManageVaultCategories,
} from '../vault/vault-utils';

// --- Database Schema ---
type Credential = VaultCredential;
type CustomCategory = VaultCategory;

// --- Main Component ---
export default function CredentialVaultPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeVaultId, setActiveVaultId] = useState<string>('local');
  const [accessCategory, setAccessCategory] = useState<string>('all');
  const [smartFilter, setSmartFilter] = useState<VaultSmartFilter | null>(null);
  const [assetViewMode, setAssetViewMode] = useState<VaultAssetViewMode>('table');
  const [vaultFolders, setVaultFolders] = useState<CredentialVaultFolder[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [isHydratingVault, setIsHydratingVault] = useState(false);
  const [vaultKeysBySlug, setVaultKeysBySlug] = useState<VaultKeyMap>(new Map());
  const { persistFolder, schedulePersistFolder } = useVaultPersistence();

  const folderBySlug = useMemo(() => {
    const map = new Map<string, CredentialVaultFolder>();
    for (const folder of vaultFolders) map.set(folder.slug, folder);
    return map;
  }, [vaultFolders]);

  const syncVaultSlug = useCallback(
    (
      slug: string,
      nextCredentials: Credential[],
      nextCategories: CustomCategory[],
    ) => {
      const folder = folderBySlug.get(slug);
      const vaultKey = vaultKeysBySlug.get(slug);
      if (!folder || !vaultKey) return;
      schedulePersistFolder(folder, nextCredentials, nextCategories, vaultKey);
    },
    [folderBySlug, vaultKeysBySlug, schedulePersistFolder],
  );

  const canManageCategoriesForVault = useCallback(
    (vaultId: string) =>
      canManageVaultCategories({
        vaultId,
        folder: folderBySlug.get(vaultId) ?? null,
        vaultDefinition: VAULT_DEFINITIONS.find((v) => v.id === vaultId) ?? null,
        userId: user?.uid,
        isPlatformAdmin: isAdmin,
      }),
    [folderBySlug, user?.uid, isAdmin],
  );

  useEffect(() => {
    startOrchestratorConfigSync();
  }, []);
  
  const [isLocked, setIsLocked] = useState(true);
  // Demo preset only when showcase login is explicitly enabled — never in production.
  const [masterPassword, setMasterPassword] = useState(
    isDemoLoginEnabled() ? 'password123' : '',
  );
  const [derivedKey, setDerivedKey] = useState<Uint8Array | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'name' | 'category'>('newest');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
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
    owner: '',
    team: '',
    department: '',
    visibility: 'private',
    linkedCompany: '',
    linkedAsset: '',
    linkedTicket: '',
    tags: [],
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

  const [rawPassword, setRawPassword] = useState('');
  const [editingCred, setEditingCred] = useState<Credential | null>(null);

  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showCreateVaultModal, setShowCreateVaultModal] = useState(false);
  const [newVaultName, setNewVaultName] = useState('');
  const [newVaultType, setNewVaultType] = useState<'personal' | 'shared'>('personal');
  const [newVaultSharedEmails, setNewVaultSharedEmails] = useState('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isImportingVault, setIsImportingVault] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('layers');

  const hydrateVaultFromServer = async (masterKey: Uint8Array) => {
    if (!user?.uid || !user.email) {
      throw new Error('Authenticated user identity is required to unlock the vault.');
    }
    const identity = { userId: user.uid, email: user.email };
    setIsHydratingVault(true);
    try {
      // Publish hybrid public key so peers can wrap shared vault keys for this user.
      const { publicKeyB64 } = deriveUserHybridKeyPair(masterKey);
      await credentialVaultApi.publishPublicKey(publicKeyB64).catch((err) => {
        console.warn('[GeistVault] failed to publish vault public key', err);
      });

      let { folders, credentials: remoteCredentials, categories: remoteCategories, vaultKeys } =
        await fetchAndDecryptVaults(masterKey, identity);

      // Migrate legacy MK-encrypted vaults onto per-vault KEK wrappers.
      for (const folder of [...folders]) {
        if (!isLegacyMkEncryptedVault(folder.keyWrappers)) continue;
        const migrated = await migrateLegacyVaultToKek({
          folder,
          credentials: remoteCredentials,
          categories: remoteCategories,
          masterKey,
          identity,
        });
        folders = folders.map((f) => (f.id === migrated.folder.id ? migrated.folder : f));
        remoteCredentials = migrated.credentials;
        vaultKeys.set(migrated.folder.slug, migrated.vaultKey);
      }

      let personalFolderResult = await ensureDefaultPersonalVault(
        masterKey,
        identity,
        folders,
        vaultKeys,
      );
      let personalFolder = personalFolderResult.folder;
      if (!folders.some((f) => f.id === personalFolder.id)) {
        folders = [personalFolder, ...folders];
      }

      let mergedCredentials = remoteCredentials;
      let mergedCategories = remoteCategories;
      const simulationCatalog = await fetchSimulationVaultCatalog();
      if (simulationCatalog.credentials.length > 0) {
        const existingIds = new Set(mergedCredentials.map((item) => String(item.id || item.label)));
        mergedCredentials = [
          ...mergedCredentials,
          ...simulationCatalog.credentials.filter((item) => !existingIds.has(String(item.id || item.label))),
        ];
      }
      if (simulationCatalog.categories.length > 0) {
        const existingCats = new Set(mergedCategories.map((cat) => cat.name));
        mergedCategories = [
          ...mergedCategories,
          ...simulationCatalog.categories.filter((cat) => !existingCats.has(cat.name)),
        ];
      }

      // Never invent demo secrets. Strip leftover showcase rows from every
      // decrypted folder — not only the personal vault — unless showcase login
      // is explicitly enabled.
      if (!isDemoLoginEnabled()) {
        const cleanedCredentials = mergedCredentials.filter((item) => !isShowcaseVaultCredential(item));
        const cleanedCategories = mergedCategories.filter((cat) => !isShowcaseVaultCategory(cat.name));
        if (
          cleanedCredentials.length !== mergedCredentials.length ||
          cleanedCategories.length !== mergedCategories.length
        ) {
          mergedCredentials = cleanedCredentials;
          mergedCategories = cleanedCategories;
          for (const folder of folders) {
            const vaultKey = vaultKeys.get(folder.slug);
            if (!vaultKey) continue;
            const updated = await persistFolder(folder, mergedCredentials, mergedCategories, vaultKey);
            folders = folders.map((f) => (f.id === updated.id ? updated : f));
            if (updated.id === personalFolder.id) personalFolder = updated;
          }
        }
      }

      setVaultFolders(folders);
      setVaultKeysBySlug(new Map(vaultKeys));
      setCredentials(mergedCredentials.sort((a, b) => b.updatedAt - a.updatedAt));
      setCustomCategories(mergedCategories);
      setIsLocked(false);
      logAudit({
        module: 'credentials',
        action: 'vault_unlocked',
        details: { vaultType: 'server_backed_zero_knowledge_kek' },
      });
      toast.success('Sovereign vault unlocked — data loaded from secure PostgreSQL storage.');
    } finally {
      setIsHydratingVault(false);
    }
  };

  const handleUnlock = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!masterPassword || !user) return;
    setIsUnlocking(true);
    try {
      const key = await deriveMasterKey(masterPassword, buildVaultKeySalt(user.uid));
      setDerivedKey(key);
      await hydrateVaultFromServer(key);
    } catch (err: any) {
      console.error('[GeistVault] unlock failed', err);
      toast.error(err?.message || 'Failed to unlock. Verify your master password.');
      setDerivedKey(null);
      setVaultKeysBySlug(new Map());
      setIsLocked(true);
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleCreateVault = async (e: FormEvent) => {
    e.preventDefault();
    if (!derivedKey || !user?.uid || !user.email || !newVaultName.trim()) {
      toast.error('Vault name is required.');
      return;
    }

    const slug = slugifyVaultName(newVaultName);
    if (vaultFolders.some((f) => f.slug === slug)) {
      toast.error('A vault with this name already exists.');
      return;
    }

    setIsSaving(true);
    try {
      const sharedWith =
        newVaultType === 'shared'
          ? newVaultSharedEmails
              .split(/[\s,;]+/)
              .map((email) => email.trim().toLowerCase())
              .filter(Boolean)
          : undefined;

      const { folder: created, vaultKey, missingEmails } = await createVaultFolderOnServer({
        name: newVaultName.trim(),
        type: newVaultType,
        emoji: newVaultType === 'shared' ? '👥' : '🔒',
        sharedWith,
        masterKey: derivedKey,
        identity: { userId: user.uid, email: user.email },
        slug,
      });

      setVaultFolders((prev) => [...prev, created]);
      setVaultKeysBySlug((prev) => {
        const next = new Map(prev);
        next.set(created.slug, vaultKey);
        return next;
      });
      setActiveVaultId(created.slug);
      setShowCreateVaultModal(false);
      setNewVaultName('');
      setNewVaultType('personal');
      setNewVaultSharedEmails('');
      toast.success(`Vault "${created.name}" created with per-vault encryption key.`);
      if (missingEmails.length > 0) {
        toast.info(
          `Shared wrap pending for: ${missingEmails.join(', ')}. They must unlock GeistVault once to publish a public key.`,
        );
      }
      logAudit({
        module: 'credentials',
        action: 'vault_folder_created',
        details: {
          name: created.name,
          type: created.type,
          slug: created.slug,
          wrappers: created.keyWrappers?.length ?? 0,
        },
      });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create vault folder.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateFolder = () => setShowCreateVaultModal(true);

  const resolveVaultKeyForCredential = (cred: Credential): Uint8Array | null => {
    const slug = resolveCredVaultId(cred);
    return vaultKeysBySlug.get(slug) || null;
  };

  // Safe Decrypt helper — uses the credential's vault VK (never MK for KEK vaults).
  const handleDecryptPassword = async (cred: Credential): Promise<string | null> => {
    const vaultKey = resolveVaultKeyForCredential(cred);
    if (!vaultKey) return null;
    try {
      const plain = await decryptData(cred.encryptedPassword, vaultKey);
      return plain;
    } catch (err) {
      return null;
    }
  };

  const handleToggleFavorite = async (cred: Credential) => {
    if (!cred.id || !derivedKey) return;
    try {
      const newFav = !cred.favorite;
      const nextCredentials = credentials.map((item) =>
        item.id === cred.id ? { ...item, favorite: newFav } : item,
      );
      setCredentials(nextCredentials);
      syncVaultSlug(resolveCredVaultId(cred), nextCredentials, customCategories);
      toast.success(newFav ? 'Added to Pinned Favorites' : 'Removed from Favorites');
    } catch (err) {
      toast.error('Could not toggle favorite status');
    }
  };

  const handleCreateCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManageCategoriesForVault(activeVaultId)) {
      toast.error(
        t(
          'vault.categories.rbacDenied',
          'Only vault administrators can manage categories in shared or corporate vaults.',
        ),
      );
      return;
    }
    if (!newCatName.trim()) {
      toast.error("Category name is required.");
      return;
    }
    const slug = newCatName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!slug) {
      toast.error("Invalid category name.");
      return;
    }

    const existingBuiltIn = ACCESS_CATEGORIES.some((c) => c.id === slug);
    const existingCustom = customCategories.some(
      (c) => c.slug === slug && (c.vaultId || PERSONAL_VAULT_SLUG) === activeVaultId,
    );

    if (existingBuiltIn || existingCustom) {
      toast.error("A category with this label or system slug already exists.");
      return;
    }

    if (!derivedKey) return;

    const folder = folderBySlug.get(activeVaultId);
    const vaultKey = vaultKeysBySlug.get(activeVaultId);
    if (!folder || !vaultKey) {
      toast.error(
        t(
          'vault.categories.storeMissing',
          'Open or create this vault’s encrypted store before managing categories.',
        ),
      );
      return;
    }

    try {
      const nextCategory: CustomCategory = {
        name: newCatName.trim(),
        slug,
        icon: newCatIcon,
        vaultId: activeVaultId,
      };
      const nextCategories = [...customCategories, nextCategory];
      // Instant visibility: append to state and select the new category immediately.
      setCustomCategories(nextCategories);
      setAccessCategory(slug);
      setSelectedType('all');
      setSmartFilter(null);
      syncVaultSlug(activeVaultId, credentials, nextCategories);
      toast.success(`Category "${newCatName.trim()}" created successfully!`);
      logAudit({
        module: 'credentials',
        action: 'category_created',
        details: { name: newCatName.trim(), slug, icon: newCatIcon, vaultId: activeVaultId },
      });
      setNewCatName('');
      setNewCatIcon('layers');
      setShowAddCategoryModal(false);
    } catch (err) {
      toast.error("Failed to write category to secure vault storage.");
    }
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (!canManageCategoriesForVault(activeVaultId)) {
      toast.error(
        t(
          'vault.categories.rbacDenied',
          'Only vault administrators can manage categories in shared or corporate vaults.',
        ),
      );
      return;
    }
    const target = customCategories.find(
      (c) => c.slug === categoryId && (c.vaultId || PERSONAL_VAULT_SLUG) === activeVaultId,
    );
    if (!target) return;
    const nextCategories = customCategories.filter(
      (c) => !(c.slug === categoryId && (c.vaultId || PERSONAL_VAULT_SLUG) === activeVaultId),
    );
    setCustomCategories(nextCategories);
    if (accessCategory === categoryId) setAccessCategory('all');
    syncVaultSlug(activeVaultId, credentials, nextCategories);
    toast.success(t('vault.categories.deleted', 'Category removed from this vault.'));
    logAudit({
      module: 'credentials',
      action: 'category_deleted',
      details: { slug: categoryId, vaultId: activeVaultId },
    });
  };

  const openVaultImport = () => {
    if (!derivedKey) {
      toast.error(t('vault.import.unlockFirst', 'Unlock the vault before importing.'));
      return;
    }
    if (!canManageCategoriesForVault(activeVaultId)) {
      toast.error(
        t(
          'vault.import.permissionDenied',
          'Only personal vault owners or vault admins can import into this vault.',
        ),
      );
      return;
    }
    if (!vaultKeysBySlug.get(activeVaultId)) {
      toast.error(
        t('vault.import.keyMissing', 'Vault encryption key is not available. Unlock again and retry.'),
      );
      return;
    }
    setShowImportDialog(true);
  };

  const handleVaultFileImport = async (file: File, format: VaultImportFormatOption) => {
    const vaultKey = vaultKeysBySlug.get(activeVaultId);
    if (!derivedKey || !vaultKey) {
      toast.error(
        t('vault.import.keyMissing', 'Vault encryption key is not available. Unlock again and retry.'),
      );
      return;
    }

    setIsImportingVault(true);
    try {
      const content = await file.text();
      const parsed = processVaultImportFile(content, file.name, format);

      const nextCategories = [...customCategories];
      const ensureCategory = (name: string): string => {
        const label = (name || 'Imported').trim() || 'Imported';
        const slug = slugifyVaultName(label) || 'imported';
        const exists = nextCategories.some(
          (c) => c.slug === slug && (c.vaultId || PERSONAL_VAULT_SLUG) === activeVaultId,
        );
        if (!exists) {
          nextCategories.push({
            name: label,
            slug,
            icon: 'layers',
            vaultId: activeVaultId,
          });
        }
        return slug;
      };

      const imported: Credential[] = [];
      const now = Date.now();
      for (let i = 0; i < parsed.length; i += 1) {
        const item = parsed[i];
        const typeSlug = ensureCategory(item.category);
        const encryptedPassword = await encryptData(item.password || '', vaultKey);
        const host = item.url.split(/\r?\n/)[0]?.trim() || '';
        imported.push({
          id: crypto.randomUUID(),
          type: typeSlug,
          label: item.name,
          username: item.username,
          encryptedPassword,
          host,
          notes: item.notes,
          updatedAt: now - i,
          lastModifiedBy: user?.email || 'Import',
          favorite: false,
          deleted: false,
          vaultId: activeVaultId,
          tags: item.tags?.length ? item.tags : ['imported'],
          securitySettings: {
            burnAfterRead: false,
            requireApproval: false,
            jitAccess: false,
            requireMfa: false,
            disableExport: false,
            disableCopy: false,
          },
        });
      }

      const nextCredentials = [...imported, ...credentials].sort((a, b) => b.updatedAt - a.updatedAt);
      setCredentials(nextCredentials);
      setCustomCategories(nextCategories);
      syncVaultSlug(activeVaultId, nextCredentials, nextCategories);

      logAudit({
        module: 'credentials',
        action: 'vault_import_local',
        details: {
          format,
          itemCount: imported.length,
          vaultId: activeVaultId,
          fileName: file.name,
          source: 'client_parse_encrypt_only',
        },
      });

      const vaultDisplayName =
        folderBySlug.get(activeVaultId)?.name ||
        (() => {
          const def = VAULT_DEFINITIONS.find((v) => v.id === activeVaultId);
          return def
            ? t(def.nameKey, def.defaultName)
            : t('vault.vaults.personal', 'Personal Vault');
        })();

      toast.success(
        t('vault.import.success', 'Imported {{count}} credentials into {{vault}}.')
          .replace('{{count}}', String(imported.length))
          .replace('{{vault}}', vaultDisplayName),
      );
      setShowImportDialog(false);
    } catch (err: any) {
      toast.error(
        err?.message ||
          t('vault.import.failed', 'Import failed. Check the file format and try again.'),
      );
    } finally {
      setIsImportingVault(false);
    }
  };

  // Create new credentials
  const handleCreateEntry = async (e: FormEvent) => {
    e.preventDefault();
    if (!newEntry.label || !newEntry.username || !rawPassword || !derivedKey) {
      toast.error("Required fields missing. Ensure label, username and password are provided.");
      return;
    }

    const targetVaultId =
      activeVaultId === PERSONAL_VAULT_SLUG ? (newEntry.vaultId || PERSONAL_VAULT_SLUG) : activeVaultId;
    const vaultKey = vaultKeysBySlug.get(targetVaultId);
    if (!vaultKey) {
      toast.error('Vault encryption key is not available for this folder.');
      return;
    }

    setIsSaving(true);
    try {
      const encryptedPassword = await encryptData(rawPassword, vaultKey);
      const toAdd: Credential = {
        id: crypto.randomUUID(),
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
        vaultId: targetVaultId,

        // Enterprise metadata
        owner: newEntry.owner || '',
        team: newEntry.team || '',
        department: newEntry.department || '',
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
          disableCopy: false
        }
      };

      const nextCredentials = [toAdd, ...credentials].sort((a, b) => b.updatedAt - a.updatedAt);
      setCredentials(nextCredentials);
      syncVaultSlug(resolveCredVaultId(toAdd), nextCredentials, customCategories);
      logAudit({ module: 'credentials', action: 'credential_created', details: { label: toAdd.label, type: toAdd.type } });
      toast.success("Secret encrypted and persisted to sovereign PostgreSQL vault!");
      
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
        owner: '',
        team: '',
        department: '',
        visibility: 'private',
        linkedCompany: '',
        linkedAsset: '',
        linkedTicket: '',
        tags: [],
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
      setShowAddModal(false);
    } catch (err) {
      toast.error("Failed to commit cryptography record");
    } finally {
      setIsSaving(false);
    }
  };

  // Modify / Save edited credentials
  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingCred || !editingCred.id || !derivedKey) return;
    const vaultKey = resolveVaultKeyForCredential(editingCred);
    if (!vaultKey) {
      toast.error('Vault encryption key is not available for this credential.');
      return;
    }
    setIsSaving(true);
    try {
      let encryptedPassword = editingCred.encryptedPassword;
      if (rawPassword) {
        encryptedPassword = await encryptData(rawPassword, vaultKey);
      }

      const nextCredentials = credentials.map((item) =>
        item.id === editingCred.id
          ? {
              ...item,
              label: editingCred.label,
              type: editingCred.type,
              username: editingCred.username,
              host: editingCred.host,
              notes: editingCred.notes,
              encryptedPassword,
              updatedAt: Date.now(),
              lastModifiedBy: 'You',
            }
          : item,
      );
      setCredentials(nextCredentials);
      syncVaultSlug(resolveCredVaultId(editingCred), nextCredentials, customCategories);

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
    if (!derivedKey) return;
    try {
      let nextCredentials: Credential[];
      if (selectedView === 'trash') {
        nextCredentials = credentials.filter((item) => item.id !== id);
        toast.success("Credential permanently erased from secure vault storage.");
        if (selectedCredential && selectedCredential.id === id) setSelectedCredential(null);
      } else {
        nextCredentials = credentials.map((item) =>
          item.id === id ? { ...item, deleted: true } : item,
        );
        toast.success("Secret moved to Trash folder.");
        if (selectedCredential && selectedCredential.id === id) setSelectedCredential(null);
      }
      setCredentials(nextCredentials);
      const changed = credentials.find((item) => item.id === id);
      if (changed) {
        syncVaultSlug(resolveCredVaultId(changed), nextCredentials, customCategories);
      }
    } catch (err) {
      toast.error("Operation failed");
    }
  };

  // Filter computations (fully reactive based on active states)
  const nonDeletedItems = credentials.filter(c => !c.deleted);
  const trashItems = credentials.filter(c => c.deleted);

  // Compute stats for overview cards
  const totalEntries = nonDeletedItems.length;
  const weakCount = nonDeletedItems.filter(c => c.notes?.toLowerCase().includes('weak') || c.label.toLowerCase().includes('database') || c.username === 'db_admin').length;
  const expiringCount = nonDeletedItems.filter(c => c.label.toLowerCase().includes('aws') || c.type === 'cloud').length;
  const sharedCount = nonDeletedItems.filter(c => c.vaultId === 'shared').length;

  const getFilteredCredentials = () => {
    let list = [...credentials];

    // Smart filter / view modes
    const effectiveView = smartFilter === 'archived' ? 'trash' : smartFilter === 'pinned' || smartFilter === 'favorites' ? 'favorites' : smartFilter === 'recently' ? 'recently' : selectedView;

    if (effectiveView === 'trash' || smartFilter === 'archived') {
      list = list.filter((c) => c.deleted);
    } else {
      list = list.filter((c) => !c.deleted);

      if (effectiveView === 'favorites' || smartFilter === 'pinned' || smartFilter === 'favorites') {
        list = list.filter((c) => c.favorite);
      } else if (effectiveView === 'recently' || smartFilter === 'recently') {
        list = list.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12);
      } else if (selectedView === 'shared') {
        list = list.filter((c) => c.vaultId === 'shared');
      }

      if (smartFilter === 'expiring') {
        list = list.filter((c) => isExpiringCred(c));
      } else if (smartFilter === 'alerts') {
        list = list.filter((c) => isWeakCred(c));
      }

      // Vault scope
      list = list.filter((c) => resolveCredVaultId(c) === activeVaultId);

      // Access category (built-in type groups or custom slug == credential type)
      if (accessCategory !== 'all') {
        const cat = ACCESS_CATEGORIES.find((x) => x.id === accessCategory);
        if (cat) {
          list = list.filter((c) => cat.types.includes(c.type));
        } else {
          list = list.filter((c) => c.type === accessCategory);
        }
      } else if (selectedType !== 'all') {
        list = list.filter((c) => c.type === selectedType);
      }
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

  const vaultCounts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const v of VAULT_DEFINITIONS) {
      acc[v.id] = nonDeletedItems.filter((c) => resolveCredVaultId(c) === v.id).length;
    }
    for (const folder of vaultFolders) {
      acc[folder.slug] = nonDeletedItems.filter((c) => resolveCredVaultId(c) === folder.slug).length;
    }
    return acc;
  }, [nonDeletedItems, vaultFolders]);

  const dynamicSidebarVaults = useMemo(
    () =>
      vaultFolders
        .filter((folder) => !VAULT_DEFINITIONS.some((v) => v.id === folder.slug))
        .map((folder) => ({
          id: folder.slug,
          emoji: folder.emoji || (folder.type === 'shared' ? '👥' : '🔒'),
          name: folder.name,
          permission: folder.layout?.permission,
        })),
    [vaultFolders],
  );

  const activeVaultItems = useMemo(
    () => nonDeletedItems.filter((c) => resolveCredVaultId(c) === activeVaultId),
    [nonDeletedItems, activeVaultId],
  );
  const activeVaultTrash = useMemo(
    () => trashItems.filter((c) => resolveCredVaultId(c) === activeVaultId),
    [trashItems, activeVaultId],
  );

  const CATEGORY_ICON_EMOJI: Record<string, string> = {
    layers: '🧩',
    server: '🖥',
    terminal: '💻',
    monitor: '🖥',
    globe: '🌐',
    database: '🗄',
    key: '🔑',
    shield: '🛡',
    cloud: '☁',
  };

  const sidebarCategories = useMemo(() => {
    const builtIn = ACCESS_CATEGORIES.map((cat) => ({
      id: cat.id,
      emoji: cat.emoji,
      label: t(cat.nameKey, cat.defaultName),
      count: activeVaultItems.filter((c) => cat.types.includes(c.type)).length,
      isCustom: false,
    })).filter((cat) => cat.count > 0 || cat.id === accessCategory);

    const customs = customCategories
      .filter((c) => (c.vaultId || PERSONAL_VAULT_SLUG) === activeVaultId)
      .map((c) => ({
        id: c.slug,
        emoji: CATEGORY_ICON_EMOJI[c.icon] || '📁',
        label: c.name,
        count: activeVaultItems.filter((item) => item.type === c.slug).length,
        isCustom: true,
      }));

    // Prefer custom labels when slug collides; otherwise concatenate unique ids.
    const byId = new Map<string, (typeof builtIn)[number]>();
    for (const cat of builtIn) byId.set(cat.id, cat);
    for (const cat of customs) byId.set(cat.id, cat);
    return Array.from(byId.values());
  }, [activeVaultItems, customCategories, activeVaultId, accessCategory, t]);

  const sidebarSmartFilters = useMemo(() => {
    const vaultPinned = activeVaultItems.filter((c) => c.favorite).length;
    const vaultExpiring = activeVaultItems.filter((c) => isExpiringCred(c)).length;
    const vaultAlerts = activeVaultItems.filter((c) => isWeakCred(c)).length;
    const vaultRecent = Math.min(12, activeVaultItems.length);
    const vaultArchived = activeVaultTrash.length;

    const all = [
      {
        id: 'favorites' as const,
        emoji: '⭐',
        label: t('vault.filters.favorites', 'Favorites'),
        count: vaultPinned,
      },
      {
        id: 'recently' as const,
        emoji: '🕒',
        label: t('vault.filters.recentlyUsed', 'Recently Used'),
        count: vaultRecent,
      },
      {
        id: 'pinned' as const,
        emoji: '📌',
        label: t('vault.filters.pinned', 'Pinned'),
        count: vaultPinned,
      },
      {
        id: 'expiring' as const,
        emoji: '⚠',
        label: t('vault.filters.expiringSoon', 'Expiring Soon'),
        count: vaultExpiring,
      },
      {
        id: 'alerts' as const,
        emoji: '🚨',
        label: t('vault.filters.securityAlerts', 'Security Alerts'),
        count: vaultAlerts,
      },
      {
        id: 'archived' as const,
        emoji: '🗑',
        label: t('vault.filters.archived', 'Archived'),
        count: vaultArchived,
      },
    ];

    return all.filter((f) => f.count > 0 || smartFilter === f.id);
  }, [activeVaultItems, activeVaultTrash, smartFilter, t]);

  const canManageActiveVaultCategories = canManageCategoriesForVault(activeVaultId);

  const healthScore = Math.max(0, 100 - Math.min(40, weakCount * 12) - Math.min(20, expiringCount * 8));
  const securityScore = Math.min(99, healthScore + 8);
  const strengthPercent = Math.round(((nonDeletedItems.length - weakCount) / Math.max(nonDeletedItems.length, 1)) * 100);

  const activeVaultFolder = folderBySlug.get(activeVaultId);
  const activeVaultDefinition = VAULT_DEFINITIONS.find((v) => v.id === activeVaultId);
  const isPersonalVaultView =
    activeVaultId === PERSONAL_VAULT_SLUG ||
    activeVaultFolder?.type === 'personal' ||
    activeVaultDefinition?.scope === 'personal';
  const activeVaultDisplayName =
    activeVaultFolder?.name ||
    (activeVaultDefinition
      ? t(activeVaultDefinition.nameKey, activeVaultDefinition.defaultName)
      : t('vault.vaults.personal', 'Personal Vault'));
  const personalExportCredentials = useMemo(
    () => nonDeletedItems.filter((c) => resolveCredVaultId(c) === activeVaultId),
    [nonDeletedItems, activeVaultId],
  );

  const openNewAsset = (type: string) => {
    setNewEntry((prev) => ({ ...prev, type, vaultId: activeVaultId === PERSONAL_VAULT_SLUG ? PERSONAL_VAULT_SLUG : activeVaultId }));
    setShowAddModal(true);
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
              {t('vault.lockSubtitle', 'Zero-Knowledge Architecture: credentials are encrypted locally with Argon2id + AES-GCM, then persisted as ciphertext in PostgreSQL. Clearing browser cache does not erase your vault.')}
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
              {isDemoLoginEnabled() ? (
                <p className="text-[10px] text-center text-slate-400 mt-1 select-none font-semibold">
                  {t('vault.passwordTip', 'Tip: Default password is set to password123')}
                </p>
              ) : null}
            </div>
            
            <Button 
              type="submit" 
              disabled={isUnlocking}
              className="w-full bg-[#1A73E8] hover:bg-[#155fc0] text-white font-semibold text-xs h-11 rounded-xl shadow-md transition-all flex items-center justify-center gap-1"
            >
              {isUnlocking || isHydratingVault ? t('vault.derivingKeys', 'Deriving keys locally...') : t('vault.unlockButton', 'Unlock Vault Node')}
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
            activeVaultId={activeVaultId}
            visibleVaultIds={['local', ...vaultFolders.map((folder) => folder.slug)]}
            onVaultChange={(id) => {
              setActiveVaultId(id);
              setSmartFilter(null);
              setAccessCategory('all');
              setSelectedType('all');
              setSelectedView('all');
            }}
            vaultCounts={vaultCounts}
            dynamicVaults={dynamicSidebarVaults}
            onCreateVault={handleCreateFolder}
            categories={sidebarCategories}
            selectedCategory={accessCategory}
            onCategoryChange={(id) => {
              setAccessCategory(id);
              setSelectedType('all');
              setSmartFilter(null);
            }}
            canManageCategories={canManageActiveVaultCategories}
            onCreateCategory={() => setShowAddCategoryModal(true)}
            onDeleteCategory={handleDeleteCategory}
            smartFilters={sidebarSmartFilters}
            smartFilter={smartFilter}
            onSmartFilterChange={(f) => {
              setSmartFilter(f);
              setAccessCategory('all');
              if (f === 'archived') setSelectedView('trash');
              else setSelectedView('all');
            }}
          />

          <main className="flex-1 min-w-0 w-full">
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
                  <VaultFabMenu onNewAsset={openNewAsset} onImport={openVaultImport} />
                </div>
              </div>

              <VaultKpiCards
                totalAssets={totalEntries}
                healthScore={healthScore}
                sharedSecrets={sharedCount}
                securityScore={securityScore}
              />

              <VaultAiSecurityBanner
                rotateCount={weakCount}
                expiringKeys={expiringCount}
                mfaCoverage={0}
                isEmpty={nonDeletedItems.length === 0}
              />

              <VaultPropertiesPane
                vaultName={activeVaultDisplayName}
                vaultEmoji={
                  activeVaultFolder?.emoji ||
                  activeVaultDefinition?.emoji ||
                  '🔒'
                }
                itemCount={personalExportCredentials.length}
                isPersonal={isPersonalVaultView}
                canImport={canManageActiveVaultCategories}
                onExportData={() => setShowExportDialog(true)}
                onImportData={openVaultImport}
              />

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
                </p>
                <VaultViewModeSelector value={assetViewMode} onChange={setAssetViewMode} />
              </div>

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
          </main>

          <VaultSecuritySidebar
            strengthPercent={nonDeletedItems.length === 0 ? 0 : strengthPercent}
            mfaCoverage={0}
            rotationDue={weakCount + expiringCount}
            recentViewed={nonDeletedItems.slice(0, 4)}
            recentModified={[...nonDeletedItems].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4)}
            sharedItems={nonDeletedItems.filter((c) => c.vaultId === 'shared').slice(0, 4)}
            auditEventCount={0}
          />
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
      <CredentialVaultCreateWizard
        open={showAddModal}
        onOpenChange={setShowAddModal}
        newEntry={newEntry}
        setNewEntry={setNewEntry}
        vaultFolders={vaultFolders}
        rawPassword={rawPassword}
        setRawPassword={setRawPassword}
        isSaving={isSaving}
        onSubmit={handleCreateEntry}
      />

      {user?.uid ? (
        <VaultExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          userId={user.uid}
          vaultName={activeVaultDisplayName}
          credentials={personalExportCredentials}
          decryptPassword={handleDecryptPassword}
          verifyMasterPassword={async (password) => {
            if (!derivedKey || !user?.uid) return false;
            const candidate = await deriveMasterKey(password, buildVaultKeySalt(user.uid));
            if (candidate.length !== derivedKey.length) return false;
            let mismatch = 0;
            for (let i = 0; i < candidate.length; i += 1) {
              mismatch |= candidate[i] ^ derivedKey[i];
            }
            candidate.fill(0);
            return mismatch === 0;
          }}
        />
      ) : null}

      <VaultImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleVaultFileImport}
        isImporting={isImportingVault}
        vaultName={activeVaultDisplayName}
      />

      {/* Create Personal / Shared Vault Folder */}
      <Dialog open={showCreateVaultModal} onOpenChange={setShowCreateVaultModal}>
        <DialogContent className="sm:max-w-[480px] rounded-[32px] border-[#DADCE0] p-0 overflow-hidden bg-[#F8F9FA]">
          <form onSubmit={handleCreateVault}>
            <DialogHeader className="bg-white border-b border-[#F1F3F4] px-8 py-6">
              <DialogTitle className="text-xl font-bold text-slate-800">Create Secure Vault Folder</DialogTitle>
              <DialogDescription className="text-xs text-slate-400 font-medium">
                Zero-knowledge: credentials are encrypted in your browser before PostgreSQL persistence. The server stores ciphertext only.
              </DialogDescription>
            </DialogHeader>

            <div className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1">Vault Name</label>
                <Input
                  placeholder="e.g. Platform Ops Shared"
                  value={newVaultName}
                  onChange={(e) => setNewVaultName(e.target.value)}
                  className="bg-white border-[#DADCE0] rounded-xl h-10 text-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1">Vault Type</label>
                <Select value={newVaultType} onValueChange={(val) => setNewVaultType(val as 'personal' | 'shared')}>
                  <SelectTrigger className="bg-white border-[#DADCE0] rounded-xl text-sm h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal Vault</SelectItem>
                    <SelectItem value="shared">Shared Team Vault</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newVaultType === 'shared' ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest pl-1">Share With (emails)</label>
                  <Textarea
                    placeholder="ops@company.com, admin@company.com"
                    value={newVaultSharedEmails}
                    onChange={(e) => setNewVaultSharedEmails(e.target.value)}
                    className="bg-white border-[#DADCE0] rounded-xl text-sm min-h-[72px]"
                  />
                </div>
              ) : null}
            </div>

            <DialogFooter className="bg-white border-t border-[#F1F3F4] px-8 py-5">
              <Button type="button" variant="ghost" onClick={() => setShowCreateVaultModal(false)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-[#1A73E8] hover:bg-blue-700 text-white rounded-xl text-xs h-10 px-6">
                {isSaving ? 'Encrypting & Saving...' : 'Create Vault'}
              </Button>
            </DialogFooter>
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
  );
}
