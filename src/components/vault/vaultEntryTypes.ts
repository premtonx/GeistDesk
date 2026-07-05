export interface VaultEntryDraft {
  id?: number | string;
  type: string;
  label: string;
  username: string;
  encryptedPassword?: string;
  host?: string;
  port?: string;
  domain?: string;
  gateway?: string;
  configData?: string;
  notes?: string;
  updatedAt?: number;
  icon?: string;
  iconType?: 'preset' | 'custom';
  lastModifiedBy?: string;
  favorite?: boolean;
  deleted?: boolean;
  vaultId?: string;
  folderId?: string | null;
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

export interface VaultCustomCategory {
  id?: number;
  name: string;
  slug: string;
  icon: string;
}
