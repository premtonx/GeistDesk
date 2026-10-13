/**
 * Verifies GeistExchange secret shamir + hybrid encrypt roundtrip (no DB).
 */
import { split, combine } from 'shamir-secret-sharing';
import { encryptPayloadPreferred, decryptPayloadAuto } from '../src/lib/crypto.ts';

if (!process.env.VAULT_ENCRYPTION_KEY) {
  process.env.VAULT_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
}
if (!/^[0-9a-fA-F]{64}$/.test(process.env.VAULT_ENCRYPTION_KEY)) {
  console.error('FATAL: VAULT_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  process.exit(1);
}

const secret = 'MySuperSecretPassword#2026';
const encoder = new TextEncoder();
const uint8Shares = await split(encoder.encode(secret), 5, 3);
const splitShares = uint8Shares.map((share) => {
  const binary = Array.from(share)
    .map((b) => String.fromCharCode(b))
    .join('');
  return btoa(binary);
});

const provenance = 'exchange:user-admin:item-123';
const encryptedShares = splitShares.map((share) => encryptPayloadPreferred(share, provenance));
const decrypted = encryptedShares.map((payload) => decryptPayloadAuto(payload));

const uint8 = decrypted.slice(0, 3).map((shareB64) => {
  const binary = atob(shareB64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
});

const combined = new TextDecoder().decode(await combine(uint8));
if (combined !== secret) {
  console.error('FATAL: shamir + hybrid roundtrip mismatch');
  process.exit(1);
}

console.log('OK: exchange secret crypto roundtrip verified.');
