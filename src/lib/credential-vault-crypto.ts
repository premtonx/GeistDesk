/**
 * Client-side zero-knowledge KEK architecture for GeistVault.
 *
 * Model:
 *   Master Password → Argon2id → Master Key (MK / KEK)
 *   New vault → getRandomValues(32) → Vault Key (VK / DEK)
 *   Personal: wrap(VK, MK) via AES-256-GCM
 *   Shared: wrap(VK, memberPublicKey) via hybrid ML-KEM-1024 + X25519
 *   Items + blob ciphertext always keyed by the vault's VK — never by MK directly
 *   for newly created vaults. Raw MK / VK / passwords never leave the browser.
 */
import { argon2id } from 'hash-wasm';
import {
  base64ToBytes,
  bytesToBase64,
  deriveHybridContentKey,
  deriveHybridKeygenSeed,
  geistHybridKem1024X25519,
} from './geist-hybrid-kem';
import {
  decryptWithWebCryptoAesGcm,
  encryptWithWebCryptoAesGcm,
} from './client-aes-gcm';

export interface VaultBlobPayload {
  credentials: Array<Record<string, unknown>>;
  categories: Array<Record<string, unknown>>;
}

/** AES-GCM wrap of VK under the owner's master key. */
export const VAULT_WRAP_ALG_MK = 'aes-256-gcm-mk' as const;
/** Hybrid KEM envelope wrapping VK for a shared vault member. */
export const VAULT_WRAP_ALG_HYBRID = 'hybrid-mlkem1024-x25519-aes-256-gcm' as const;

export type VaultKeyWrapAlgorithm = typeof VAULT_WRAP_ALG_MK | typeof VAULT_WRAP_ALG_HYBRID;

export interface WrappedVaultKey {
  recipientUserId?: string;
  recipientEmail: string;
  alg: VaultKeyWrapAlgorithm;
  /** Base64 IV||ciphertext of the 32-byte Vault Key. */
  wrappedKey: string;
  /** Present when alg is hybrid — ML-KEM + X25519 ciphertext. */
  kemCiphertext?: string;
}

export const VAULT_KEY_BYTES = 32;

export async function deriveMasterKey(password: string, salt: string): Promise<Uint8Array> {
  const result = await argon2id({
    password,
    salt,
    parallelism: 1,
    iterations: 10,
    memorySize: 65536,
    hashLength: 32,
    outputType: 'binary',
  });
  return new Uint8Array(result);
}

export function buildVaultKeySalt(userId: string): string {
  return `user-salt-${userId}`;
}

/** Cryptographically secure 256-bit Data Encryption Key for a single vault. */
export function generateVaultKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(VAULT_KEY_BYTES));
}

function bytesToBinaryString(bytes: Uint8Array): string {
  return bytesToBase64(bytes);
}

function binaryStringToBytes(value: string): Uint8Array {
  return base64ToBytes(value);
}

function wrapProvenance(kind: string, recipient: string): string {
  return `geistvault-kek:${kind}:${recipient.toLowerCase()}`;
}

/** Encrypt a UTF-8 string with AES-256-GCM (legacy helper used for item passwords). */
export async function encryptData(data: string, key: Uint8Array): Promise<string> {
  return encryptWithWebCryptoAesGcm(data, key);
}

export async function decryptData(encryptedB64: string, key: Uint8Array): Promise<string> {
  return decryptWithWebCryptoAesGcm(encryptedB64, key);
}

/** Wrap (encrypt) a vault VK under the owner's Master Key. */
export async function wrapVaultKeyWithMasterKey(
  vaultKey: Uint8Array,
  masterKey: Uint8Array,
  recipient: { userId?: string; email: string },
): Promise<WrappedVaultKey> {
  if (vaultKey.length !== VAULT_KEY_BYTES) {
    throw new Error('Vault key must be 256 bits.');
  }
  const email = recipient.email.trim().toLowerCase();
  const wrappedKey = await encryptWithWebCryptoAesGcm(
    bytesToBinaryString(vaultKey),
    masterKey,
    wrapProvenance('mk', email),
  );
  return {
    recipientUserId: recipient.userId,
    recipientEmail: email,
    alg: VAULT_WRAP_ALG_MK,
    wrappedKey,
  };
}

/** Unwrap a MK-wrapped Vault Key. */
export async function unwrapVaultKeyWithMasterKey(
  wrapper: WrappedVaultKey,
  masterKey: Uint8Array,
): Promise<Uint8Array> {
  if (wrapper.alg !== VAULT_WRAP_ALG_MK) {
    throw new Error('Expected master-key vault wrap.');
  }
  const encoded = await decryptWithWebCryptoAesGcm(
    wrapper.wrappedKey,
    masterKey,
    wrapProvenance('mk', wrapper.recipientEmail),
  );
  const vaultKey = binaryStringToBytes(encoded);
  if (vaultKey.length !== VAULT_KEY_BYTES) {
    throw new Error('Unwrapped vault key has invalid length.');
  }
  return vaultKey;
}

/** Derive a deterministic hybrid KEM keypair from the user's Master Key (never stored). */
export function deriveUserHybridKeyPair(masterKey: Uint8Array): {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
  publicKeyB64: string;
} {
  const seed = deriveHybridKeygenSeed(masterKey);
  const { publicKey, secretKey } = geistHybridKem1024X25519.keygen(seed);
  return {
    publicKey,
    secretKey,
    publicKeyB64: bytesToBase64(publicKey),
  };
}

/** Wrap a Vault Key for a shared member using their published hybrid public key. */
export async function wrapVaultKeyForRecipient(
  vaultKey: Uint8Array,
  recipientPublicKeyB64: string,
  recipient: { userId?: string; email: string },
): Promise<WrappedVaultKey> {
  if (vaultKey.length !== VAULT_KEY_BYTES) {
    throw new Error('Vault key must be 256 bits.');
  }
  const email = recipient.email.trim().toLowerCase();
  const publicKey = base64ToBytes(recipientPublicKeyB64);
  const { cipherText: kemCiphertext, sharedSecret } = geistHybridKem1024X25519.encapsulate(publicKey);
  const contentKey = deriveHybridContentKey(sharedSecret);
  const wrappedKey = await encryptWithWebCryptoAesGcm(
    bytesToBinaryString(vaultKey),
    contentKey,
    wrapProvenance('hybrid', email),
  );
  return {
    recipientUserId: recipient.userId,
    recipientEmail: email,
    alg: VAULT_WRAP_ALG_HYBRID,
    wrappedKey,
    kemCiphertext: bytesToBase64(kemCiphertext),
  };
}

/** Unwrap a hybrid-wrapped Vault Key with the member's private KEM key. */
export async function unwrapVaultKeyWithHybrid(
  wrapper: WrappedVaultKey,
  secretKey: Uint8Array,
): Promise<Uint8Array> {
  if (wrapper.alg !== VAULT_WRAP_ALG_HYBRID || !wrapper.kemCiphertext) {
    throw new Error('Expected hybrid vault wrap.');
  }
  const sharedSecret = geistHybridKem1024X25519.decapsulate(
    base64ToBytes(wrapper.kemCiphertext),
    secretKey,
  );
  const contentKey = deriveHybridContentKey(sharedSecret);
  const encoded = await decryptWithWebCryptoAesGcm(
    wrapper.wrappedKey,
    contentKey,
    wrapProvenance('hybrid', wrapper.recipientEmail),
  );
  const vaultKey = binaryStringToBytes(encoded);
  if (vaultKey.length !== VAULT_KEY_BYTES) {
    throw new Error('Unwrapped vault key has invalid length.');
  }
  return vaultKey;
}

/**
 * Resolve the Vault Key for the current user from the keyWrappers array.
 * Prefers MK wrap for the owner, then hybrid wrap for the current email/userId.
 */
export async function unwrapVaultKeyForUser(
  wrappers: WrappedVaultKey[],
  masterKey: Uint8Array,
  identity: { userId: string; email: string },
): Promise<Uint8Array> {
  const email = identity.email.trim().toLowerCase();
  const mkWrap = wrappers.find(
    (w) =>
      w.alg === VAULT_WRAP_ALG_MK &&
      (w.recipientUserId === identity.userId || w.recipientEmail.toLowerCase() === email),
  );
  if (mkWrap) {
    return unwrapVaultKeyWithMasterKey(mkWrap, masterKey);
  }

  const hybridWrap = wrappers.find(
    (w) =>
      w.alg === VAULT_WRAP_ALG_HYBRID &&
      (w.recipientUserId === identity.userId || w.recipientEmail.toLowerCase() === email),
  );
  if (hybridWrap) {
    const { secretKey } = deriveUserHybridKeyPair(masterKey);
    return unwrapVaultKeyWithHybrid(hybridWrap, secretKey);
  }

  throw new Error('No vault key wrapper available for the current user.');
}

export async function encryptVaultBlob(payload: VaultBlobPayload, vaultKey: Uint8Array): Promise<string> {
  return encryptData(JSON.stringify(payload), vaultKey);
}

export async function decryptVaultBlob(encryptedBlob: string, vaultKey: Uint8Array): Promise<VaultBlobPayload> {
  const plaintext = await decryptData(encryptedBlob, vaultKey);
  const parsed = JSON.parse(plaintext) as VaultBlobPayload;
  return {
    credentials: Array.isArray(parsed.credentials) ? parsed.credentials : [],
    categories: Array.isArray(parsed.categories) ? parsed.categories : [],
  };
}

export function slugifyVaultName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return base || `vault-${Date.now()}`;
}

/** True when a vault row still uses the legacy single-MK blob scheme (no KEK wrappers). */
export function isLegacyMkEncryptedVault(wrappers: WrappedVaultKey[] | null | undefined): boolean {
  return !Array.isArray(wrappers) || wrappers.length === 0;
}
