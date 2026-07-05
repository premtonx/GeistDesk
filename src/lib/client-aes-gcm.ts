import { CryptoIntegrityError } from './crypto-integrity';

function encodeAad(provenance?: string): Uint8Array | undefined {
  if (!provenance?.trim()) return undefined;
  return new TextEncoder().encode(provenance.trim());
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
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(plaintext);
  const cryptoKey = await crypto.subtle.importKey('raw', key as unknown as BufferSource, { name: 'AES-GCM' }, false, [
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
  return btoa(String.fromCharCode(...combined));
}

export async function decryptWithWebCryptoAesGcm(
  encryptedB64: string,
  key: Uint8Array,
  provenance?: string,
): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedB64), (char) => char.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const cryptoKey = await crypto.subtle.importKey('raw', key as unknown as BufferSource, { name: 'AES-GCM' }, false, [
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
