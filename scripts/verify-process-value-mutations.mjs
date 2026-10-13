/**
 * Regression: updateDocDirect must not crash when replacing null encryptedShares.
 */
import { processValueMutations } from '../src/lib/postgres-backend.ts';

const existing = {
  id: 'secret-ref',
  encryptedShares: null,
  encryptedContent: null,
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const encryptedShares = [
  { v: 1, alg: 'AES-256-GCM', iv: 'a', tag: 'b', data: 'c' },
  { v: 1, alg: 'AES-256-GCM', iv: 'd', tag: 'e', data: 'f' },
];
const encryptedContent = { v: 1, alg: 'AES-256-GCM', iv: 'g', tag: 'h', data: 'i' };

let merged;
try {
  merged = { ...existing, ...processValueMutations({ encryptedShares, encryptedContent }, existing) };
} catch (err) {
  console.error('FATAL: processValueMutations crashed on null encryptedShares:', err);
  process.exit(1);
}

if (!Array.isArray(merged.encryptedShares) || merged.encryptedShares.length !== 2) {
  console.error('FATAL: encryptedShares not persisted in merge result:', merged.encryptedShares);
  process.exit(1);
}
if (!merged.encryptedContent || merged.encryptedContent.v !== 1) {
  console.error('FATAL: encryptedContent not persisted in merge result:', merged.encryptedContent);
  process.exit(1);
}

console.log('OK: processValueMutations handles null encryptedShares.');
