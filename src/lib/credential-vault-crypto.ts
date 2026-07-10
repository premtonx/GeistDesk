/**
 * Client-side zero-knowledge crypto for GeistVault credential folders.
 * Master password never leaves the browser; server stores ciphertext only.
 */
import { argon2id } from 'hash-wasm';

export interface VaultBlobPayload {
  credentials: Array<Record<string, unknown>>;
  categories: Array<Record<string, unknown>>;
}

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

export async function encryptData(data: string, key: Uint8Array): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(data);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encodedData);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptData(encryptedB64: string, key: Uint8Array): Promise<string> {
  const combined = new Uint8Array(atob(encryptedB64).split('').map((c) => c.charCodeAt(0)));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
  return new TextDecoder().decode(decrypted);
}

export async function encryptVaultBlob(payload: VaultBlobPayload, key: Uint8Array): Promise<string> {
  return encryptData(JSON.stringify(payload), key);
}

export async function decryptVaultBlob(encryptedBlob: string, key: Uint8Array): Promise<VaultBlobPayload> {
  const plaintext = await decryptData(encryptedBlob, key);
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
