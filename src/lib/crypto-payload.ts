export type LegacyEncryptedPayload = {
  v: 1;
  alg: 'AES-256-GCM';
  iv: string;
  authTag: string;
  ciphertext: string;
};

export type HybridEncryptedPayload = {
  v: 2;
  alg: 'HYBRID-MLKEM1024-X25519-AES-256-GCM';
  kemCiphertext: string;
  iv: string;
  authTag: string;
  ciphertext: string;
  /** Optional base64 binding digest (user/item provenance) included in GCM AAD. */
  provenance?: string;
};

export type AnyEncryptedPayload = LegacyEncryptedPayload | HybridEncryptedPayload;

export function isHybridEncryptedPayload(payload: unknown): payload is HybridEncryptedPayload {
  if (!payload || typeof payload !== 'object') return false;
  const record = payload as HybridEncryptedPayload;
  return record.v === 2 && record.alg === 'HYBRID-MLKEM1024-X25519-AES-256-GCM';
}

export function isLegacyEncryptedPayload(payload: unknown): payload is LegacyEncryptedPayload {
  if (!payload || typeof payload !== 'object') return false;
  const record = payload as LegacyEncryptedPayload;
  return record.v === 1 && record.alg === 'AES-256-GCM';
}
