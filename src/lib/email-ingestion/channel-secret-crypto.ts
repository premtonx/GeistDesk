/**
 * AES-256-GCM encryption for email channel client secrets at rest.
 *
 * Key resolution (first match wins):
 *   1. EMAIL_CHANNEL_SECRET_KEY (preferred, dedicated)
 *   2. VAULT_ENCRYPTION_KEY (shared fallback)
 *
 * Migration: plaintext secrets still decrypt/pass-through. On next write they
 * are re-encrypted when a key is available. Generate a key with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { safeLog } from '../safe-log.js';

const AES_ALGO = 'aes-256-gcm';
const ENC_PREFIX = 'enc:v1:';

export interface EmailSecretPayload {
  v: 1;
  alg: 'AES-256-GCM';
  iv: string;
  authTag: string;
  ciphertext: string;
}

function normalizeKeyMaterial(raw: string | undefined): string {
  if (!raw) return '';
  return raw.trim().replace(/^['"]|['"]$/g, '');
}

function resolveKey(): Buffer | null {
  const raw =
    normalizeKeyMaterial(process.env.EMAIL_CHANNEL_SECRET_KEY) ||
    normalizeKeyMaterial(process.env.VAULT_ENCRYPTION_KEY);
  if (!raw) return null;
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else {
    key = Buffer.from(raw, 'base64');
  }
  if (key.length !== 32) {
    throw new Error(
      'EMAIL_CHANNEL_SECRET_KEY / VAULT_ENCRYPTION_KEY must decode to exactly 32 bytes (256 bits).',
    );
  }
  return key;
}

export function isEmailChannelSecretKeyConfigured(): boolean {
  try {
    return Boolean(resolveKey());
  } catch {
    return false;
  }
}

export function isEncryptedEmailSecret(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX);
}

/** Encrypt plaintext for storage. Falls back to plaintext if no key (with warning). */
export function encryptEmailChannelSecret(plaintext: string): string {
  const trimmed = String(plaintext || '');
  if (!trimmed) return '';
  if (isEncryptedEmailSecret(trimmed) || trimmed === '••••••••') return trimmed;

  const key = resolveKey();
  if (!key) {
    safeLog(
      'warn',
      '[email-secrets] EMAIL_CHANNEL_SECRET_KEY / VAULT_ENCRYPTION_KEY missing — storing client secret in plaintext. ' +
        'Set EMAIL_CHANNEL_SECRET_KEY to a 32-byte hex key to encrypt at rest.',
    );
    return trimmed;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(AES_ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()]);
  const payload: EmailSecretPayload = {
    v: 1,
    alg: 'AES-256-GCM',
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
  return ENC_PREFIX + Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

/** Decrypt stored value. Passes through plaintext / empty / masked placeholders. */
export function decryptEmailChannelSecret(stored: string | null | undefined): string {
  const value = String(stored || '');
  if (!value || value === '••••••••') return value;
  if (!isEncryptedEmailSecret(value)) return value;

  const key = resolveKey();
  if (!key) {
    throw new Error(
      'Encrypted email channel secret cannot be decrypted — EMAIL_CHANNEL_SECRET_KEY / VAULT_ENCRYPTION_KEY is not configured.',
    );
  }

  const raw = Buffer.from(value.slice(ENC_PREFIX.length), 'base64').toString('utf8');
  const payload = JSON.parse(raw) as EmailSecretPayload;
  if (!payload || payload.alg !== 'AES-256-GCM') {
    throw new Error('Malformed encrypted email channel secret.');
  }
  const decipher = createDecipheriv(AES_ALGO, key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
