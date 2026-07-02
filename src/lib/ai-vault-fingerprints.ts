import { getDocDirect, getDocsDirect } from './postgres-backend.js';
import { decryptString, decryptStringArray, type EncryptedPayload } from './crypto.js';

const VAULT_ITEMS = 'vault_items';
const VAULT_SECRETS = 'vault_item_secrets';

const fingerprintCache = new Map<string, { expiresAt: number; fingerprints: string[] }>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_FINGERPRINTS = 250;
const MIN_FINGERPRINT_LENGTH = 8;

function collectFingerprint(target: Set<string>, value: unknown): void {
  if (typeof value !== 'string') return;
  const trimmed = value.trim();
  if (trimmed.length >= MIN_FINGERPRINT_LENGTH) {
    target.add(trimmed);
  }
}

function collectFromObject(target: Set<string>, obj: unknown, depth = 0): void {
  if (depth > 4 || obj == null) return;
  if (typeof obj === 'string') {
    collectFingerprint(target, obj);
    return;
  }
  if (Array.isArray(obj)) {
    for (const entry of obj) collectFromObject(target, entry, depth + 1);
    return;
  }
  if (typeof obj === 'object') {
    for (const value of Object.values(obj as Record<string, unknown>)) {
      collectFromObject(target, value, depth + 1);
    }
  }
}

async function loadExchangeVaultFingerprints(): Promise<string[]> {
  const fingerprints = new Set<string>();

  try {
    const items = await getDocsDirect(VAULT_ITEMS, []);
    for (const item of items.slice(0, 120)) {
      if (item?.metadata) collectFromObject(fingerprints, item.metadata);
      if (!item?.secretRef) continue;

      try {
        const secretDoc = await getDocDirect(VAULT_SECRETS, item.secretRef);
        if (!secretDoc) continue;

        if (Array.isArray(secretDoc.encryptedShares) && secretDoc.encryptedShares.length > 0) {
          const shares = decryptStringArray(secretDoc.encryptedShares as EncryptedPayload[]);
          for (const share of shares) collectFingerprint(fingerprints, share);
        }

        if (secretDoc.encryptedContent) {
          const content = decryptString(secretDoc.encryptedContent as EncryptedPayload);
          collectFingerprint(fingerprints, content);
        }
      } catch {
        /* skip undecryptable rows — scrubbing still applies regex heuristics */
      }
    }
  } catch {
    return [];
  }

  return [...fingerprints]
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_FINGERPRINTS);
}

async function loadModuleWorkspaceName(): Promise<string | undefined> {
  try {
    const doc = await getDocDirect('module_config', 'global');
    if (!doc || typeof doc !== 'object') return undefined;
    const record = doc as Record<string, unknown>;
    const email = record.email as Record<string, unknown> | undefined;
    const candidates = [
      record.companyName,
      record.workspaceName,
      record.organizationName,
      email?.senderName,
      email?.supportEmail,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length >= 2) {
        return candidate.trim();
      }
    }
  } catch {
    /* optional enrichment */
  }
  return undefined;
}

/** Load GeistVault / exchange secret fingerprints for outbound cloud scrubbing. */
export async function loadVaultFingerprintsForWorkspace(
  workspaceId: string,
  skipPersistence = false,
): Promise<string[]> {
  if (skipPersistence) return [];

  const cacheKey = workspaceId || 'default';
  const cached = fingerprintCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.fingerprints;
  }

  const fingerprints = await loadExchangeVaultFingerprints();
  fingerprintCache.set(cacheKey, {
    fingerprints,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return fingerprints;
}

/** Resolve the corporate workspace label used for anonymization. */
export async function resolveWorkspaceNameForScrubbing(
  workspaceId: string,
  metadata?: Record<string, unknown>,
  skipPersistence = false,
): Promise<string | undefined> {
  if (typeof metadata?.workspaceName === 'string' && metadata.workspaceName.trim()) {
    return metadata.workspaceName.trim();
  }
  if (skipPersistence) return undefined;
  return loadModuleWorkspaceName();
}

/** Test helper — purge cached vault fingerprints. */
export function resetVaultFingerprintCache(): void {
  fingerprintCache.clear();
}
