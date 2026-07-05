/**
 * GeistDesk hybrid post-quantum KEM: ML-KEM-1024 + X25519 with HKDF-SHA-256 combiner.
 * Asymmetric work is confined to the key-exchange envelope; bulk data uses AES-GCM.
 */
import { createKitchenSink, ecdhKem } from '@noble/post-quantum/hybrid.js';
import { ml_kem1024 } from '@noble/post-quantum/ml-kem.js';
import { x25519 } from '@noble/curves/ed25519.js';
import { shake256 } from '@noble/hashes/sha3.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hkdf } from '@noble/hashes/hkdf.js';

const textEncoder = new TextEncoder();

function hkdfInfo(label: string): Uint8Array {
  return textEncoder.encode(label);
}

export const HYBRID_KEM_LABEL = 'GeistDesk-KEM(ML-KEM-1024,X25519)-HKDF-SHA-256-v1';
export const HYBRID_CONTENT_KEY_INFO = 'geistdesk-hybrid-content-aes-v1';
export const HYBRID_VAULT_KEYPAIR_INFO = 'geistdesk-vault-hybrid-keypair-v1';

export const geistHybridKem1024X25519 = createKitchenSink(
  HYBRID_KEM_LABEL,
  ml_kem1024,
  ecdhKem(x25519),
  shake256,
  sha256,
);

export function deriveHybridContentKey(sharedSecret: Uint8Array, binding?: Uint8Array): Uint8Array {
  const ikm = binding?.length
    ? new Uint8Array(sharedSecret.length + binding.length)
    : sharedSecret;
  if (binding?.length) {
    ikm.set(sharedSecret, 0);
    ikm.set(binding, sharedSecret.length);
  }
  return hkdf(sha256, ikm, undefined, hkdfInfo(HYBRID_CONTENT_KEY_INFO), 32);
}

export function deriveHybridKeygenSeed(masterMaterial: Uint8Array): Uint8Array {
  return hkdf(sha256, masterMaterial, undefined, hkdfInfo(HYBRID_VAULT_KEYPAIR_INFO), 32);
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'));
  }
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}
