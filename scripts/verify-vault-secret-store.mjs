/**
 * Simulates POST /api/vault/secrets encryption + JSON persistence shape (no DB).
 * Catches hybrid payload serialization issues before production deploy.
 */
import { split } from 'shamir-secret-sharing';
import { encryptExchangeAtRest } from '../src/lib/crypto.ts';

if (!process.env.VAULT_ENCRYPTION_KEY) {
  process.env.VAULT_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
}

const secret = 'ChangeMe_Admin#2026';
const encoder = new TextEncoder();
const uint8Shares = await split(encoder.encode(secret), 5, 3);
const splitShares = uint8Shares.map((share) => {
  const binary = Array.from(share)
    .map((b) => String.fromCharCode(b))
    .join('');
  return btoa(binary);
});

const provenance = 'exchange:test:item-1';
const encryptedShares = splitShares.map((share) => encryptExchangeAtRest(share, provenance));
const encryptedContent = encryptExchangeAtRest(secret, provenance);

const payload = { encryptedShares, encryptedContent };
const serialized = JSON.stringify(payload);
const roundtrip = JSON.parse(serialized);

if (!Array.isArray(roundtrip.encryptedShares) || roundtrip.encryptedShares.length !== 5) {
  console.error('FATAL: encryptedShares did not round-trip through JSON');
  process.exit(1);
}
if (!roundtrip.encryptedContent || roundtrip.encryptedContent.v !== 2) {
  console.error('FATAL: encryptedContent did not round-trip through JSON');
  process.exit(1);
}
if (roundtrip.encryptedShares[0]?.alg !== 'HYBRID-MLKEM1024-X25519-AES-256-GCM') {
  console.error('FATAL: encryptedShares are not hybrid ML-KEM payloads');
  process.exit(1);
}

console.log('OK: vault secret store payload verified (' + serialized.length + ' bytes JSON).');
