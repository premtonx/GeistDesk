import { CryptoIntegrityError } from './crypto-integrity';

function encodeAad(provenance?: string): Uint8Array | undefined {
  if (!provenance?.trim()) return undefined;
  return new TextEncoder().encode(provenance.trim());
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Browser-native AES-256-GCM with mandatory auth-tag verification.
 * Optional provenance is bound as AAD so tampered server payloads fail closed.
 */
export async function encryptWithWebCryptoAesGcm(
  plaintext: string,
  key: Uint8Array,
  provenance?: string,
): Promise<string> {
  const normalizedKey = new Uint8Array(key instanceof Uint8Array ? key : key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(plaintext);
  const cryptoKey = await crypto.subtle.importKey('raw', normalizedKey, { name: 'AES-GCM' }, false, [
    'encrypt',
  ]);
  const aad = encodeAad(provenance);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad as BufferSource | undefined },
    cryptoKey,
    encodedData,
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return bytesToBase64(combined);
}

export async function decryptWithWebCryptoAesGcm(
  encryptedB64: string,
  key: Uint8Array,
  provenance?: string,
): Promise<string> {
  const normalizedKey = new Uint8Array(key instanceof Uint8Array ? key : key);
  const combined = base64ToBytes(encryptedB64);
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const cryptoKey = await crypto.subtle.importKey('raw', normalizedKey, { name: 'AES-GCM' }, false, [
    'decrypt',
  ]);
  const aad = encodeAad(provenance);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: aad as BufferSource | undefined },
      cryptoKey,
      data,
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new CryptoIntegrityError(
      'GeistVault credential block failed AES-GCM authentication — integrity violation detected.',
    );
  }
}

/** Bind GeistVault item keys to the local user credential + portfolio context. */
export function buildVaultProvenance(userId: string, scope: string, itemId?: string): string {
  return `geistvault:${userId}:${scope}:${itemId ?? 'portfolio'}`;
}
