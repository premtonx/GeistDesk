import type { VaultItem } from '../types';

export const DROPZONE_VAULT_KIND = 'dropzone_upload_bucket' as const;

export function isDropzoneVaultItem(
  item: Pick<VaultItem, 'type'> & { metadata?: VaultItem['metadata'] } | null | undefined,
): boolean {
  if (!item) return false;
  return item.type === 'request' || item.metadata?.vaultKind === DROPZONE_VAULT_KIND;
}

const PRESET_UPLOAD_LIMIT_MB: Record<string, number> = {
  '100MB': 100,
  '500MB': 500,
  '2GB': 2048,
  '10GB': 10240,
};

export function parseUploadLimitMb(uploadLimit: string, customUploadLimitMb: string): number {
  if (uploadLimit === 'Custom') {
    const parsed = Number.parseInt(customUploadLimitMb, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 512;
  }
  return PRESET_UPLOAD_LIMIT_MB[uploadLimit] ?? 2048;
}

export function formatUploadLimitLabel(uploadLimit: string, customUploadLimitMb?: string): string {
  if (uploadLimit === 'Custom' && customUploadLimitMb) {
    return `${customUploadLimitMb} MB Limit`;
  }
  if (uploadLimit === '2GB') return '2 GB Limit';
  if (uploadLimit === '10GB') return '10 GB Limit';
  return `${uploadLimit} Limit`;
}

export function getAllowedFileExtensions(metadata: VaultItem['metadata'] | undefined): string[] {
  if (!metadata) return [];
  return metadata.allowedTypes ?? metadata.acceptedTypes ?? [];
}

export function fileMatchesAllowedTypes(fileName: string, allowedTypes: string[]): boolean {
  if (allowedTypes.length === 0) return true;
  const ext = fileName.split('.').pop()?.toUpperCase() ?? '';
  return allowedTypes.some((type) => type.toUpperCase() === ext);
}

export interface DropzoneFormSnapshot {
  requestName: string;
  requestDescription: string;
  dropzoneTicketId: string;
  dropzoneCompanyId: string;
  dropzoneAssetId: string;
  acceptedTypes: string[];
  uploadLimit: string;
  customUploadLimitMb: string;
  virusScan: boolean;
  malwareScan: boolean;
  retentionPolicy: string;
}

export function buildDropzoneMetadata(form: DropzoneFormSnapshot) {
  const maxSizeMb = parseUploadLimitMb(form.uploadLimit, form.customUploadLimitMb);

  return {
    vaultKind: DROPZONE_VAULT_KIND,
    isQuantumSafe: true,
    pqcLevel: 3,
    requestName: form.requestName,
    description: form.requestDescription,
    relatedTicketId: form.dropzoneTicketId || undefined,
    relatedCompanyId: form.dropzoneCompanyId || undefined,
    relatedAssetId: form.dropzoneAssetId,
    allowedTypes: form.acceptedTypes,
    acceptedTypes: form.acceptedTypes,
    uploadLimit: form.uploadLimit === 'Custom' ? `${maxSizeMb}MB` : form.uploadLimit,
    maxSizeMb,
    antivirusScan: form.virusScan,
    blockMaliciousHashes: form.malwareScan,
    virusScan: form.virusScan,
    malwareScan: form.malwareScan,
    retentionPolicy: form.retentionPolicy,
  };
}
