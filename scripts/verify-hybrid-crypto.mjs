/**
 * Verifies hybrid ML-KEM-1024 + X25519 KEM, v2 vault payloads, and legacy v1 fallback.
 *
 * Usage: VAULT_ENCRYPTION_KEY=<64-hex-chars> node scripts/verify-hybrid-crypto.mjs
 */
import { createHash, randomBytes } from 'node:crypto';
import { createKitchenSink, ecdhKem } from '@noble/post-quantum/hybrid.js';
import { ml_kem1024 } from '@noble/post-quantum/ml-kem.js';
import { x25519 } from '@noble/curves/ed25519.js';
import { shake256 } from '@noble/hashes/sha3.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hkdf } from '@noble/hashes/hkdf.js';

if (!process.env.VAULT_ENCRYPTION_KEY) {
  process.env.VAULT_ENCRYPTION_KEY = randomBytes(32).toString('hex');
}

const { encryptString, decryptString, encryptStringHybrid, decryptPayloadAuto, CryptoIntegrityError } =
  await import('../src/lib/crypto.ts');

const hybridKem = createKitchenSink(
  'GeistDesk-Verify-MLKEM1024-X25519',
  ml_kem1024,
  ecdhKem(x25519),
  shake256,
  sha256,
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log('1) Hybrid KEM roundtrip (ML-KEM-1024 + X25519 + HKDF-SHA-256)...');
const keys = hybridKem.keygen();
const enc = hybridKem.encapsulate(keys.publicKey);
const dec = hybridKem.decapsulate(enc.cipherText, keys.secretKey);
assert(Buffer.from(enc.sharedSecret).equals(Buffer.from(dec)), 'Hybrid KEM shared secrets must match');

console.log('2) Legacy v1 AES-256-GCM roundtrip...');
const legacy = encryptString('legacy-secret-payload');
const legacyPlain = decryptPayloadAuto(legacy);
assert(legacyPlain === 'legacy-secret-payload', 'Legacy decrypt failed');

console.log('3) Hybrid v2 payload roundtrip with provenance binding...');
const provenance = 'exchange:user-demo-admin:item-123';
const hybridPayload = encryptStringHybrid('quantum-safe-payload', provenance);
assert(hybridPayload.v === 2, 'Expected v2 hybrid payload');
const hybridPlain = decryptPayloadAuto(hybridPayload);
assert(hybridPlain === 'quantum-safe-payload', 'Hybrid decrypt failed');

console.log('4) Legacy fallback via decryptPayloadAuto...');
const fallbackPlain = decryptPayloadAuto(legacy);
assert(fallbackPlain === 'legacy-secret-payload', 'Auto legacy fallback failed');

console.log('5) GCM integrity failure must throw CryptoIntegrityError...');
let integrityThrown = false;
try {
  const tampered = { ...hybridPayload, authTag: Buffer.from('bad-tag-000000000000000000000000').toString('base64') };
  decryptPayloadAuto(tampered);
} catch (error) {
  integrityThrown = error instanceof CryptoIntegrityError;
}
assert(integrityThrown, 'Tampered payload must throw CryptoIntegrityError');

console.log('PASS: hybrid crypto verification complete');
