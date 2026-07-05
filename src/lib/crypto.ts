// Server-side cryptographic primitives for GeistDesk.
// - Password hashing/verification via Argon2id (hash-wasm, cross-platform, no native build).
// - Authenticated symmetric encryption of secret assets via AES-256-GCM (Node native crypto).
// - Hybrid ML-KEM-1024 + X25519 envelope (HKDF-SHA-256) for post-quantum resilient vault/exchange payloads.
//
// IMPORTANT: This module is server-only. Do not import it into browser bundles.

import { randomBytes, createCipheriv, createDecipheriv, createHash } from "crypto";
import { argon2id, argon2Verify } from "hash-wasm";
import { CryptoIntegrityError } from "./crypto-integrity.js";
import {
  type AnyEncryptedPayload,
  type HybridEncryptedPayload,
  isHybridEncryptedPayload,
  isLegacyEncryptedPayload,
} from "./crypto-payload.js";
import {
  base64ToBytes,
  bytesToBase64,
  deriveHybridContentKey,
  deriveHybridKeygenSeed,
  geistHybridKem1024X25519,
} from "./geist-hybrid-kem.js";

// -----------------------------------------------------------------------------
// PASSWORD HASHING (Argon2id)
// -----------------------------------------------------------------------------

/**
 * Hash a plaintext password using Argon2id and return a self-describing
 * encoded string (PHC format: $argon2id$v=19$m=...,t=...,p=...$salt$hash).
 * The salt is embedded in the output, so it can be verified without any
 * external state.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  if (!plaintext || typeof plaintext !== "string") {
    throw new Error("Cannot hash an empty or non-string password.");
  }
  const salt = randomBytes(16);
  return argon2id({
    password: plaintext,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536, // 64 MiB
    hashLength: 32,
    outputType: "encoded"
  });
}

/**
 * Constant-time verification of a plaintext password against a stored
 * Argon2id encoded hash. Returns false on any malformed input rather than
 * throwing, so callers can treat it as a pure boolean check.
 */
export async function verifyPassword(plaintext: string, encodedHash: string): Promise<boolean> {
  if (!plaintext || !encodedHash || typeof encodedHash !== "string") {
    return false;
  }
  try {
    return await argon2Verify({ password: plaintext, hash: encodedHash });
  } catch {
    return false;
  }
}

/** Heuristic to detect an already-hashed (PHC encoded) value. */
export function isHashedPassword(value: unknown): boolean {
  return typeof value === "string" && value.startsWith("$argon2");
}

// -----------------------------------------------------------------------------
// SECRET ENCRYPTION AT REST (AES-256-GCM)
// -----------------------------------------------------------------------------

const AES_ALGO = "aes-256-gcm";

export type { AnyEncryptedPayload, HybridEncryptedPayload } from "./crypto-payload.js";
export { CryptoIntegrityError, isCryptoIntegrityError } from "./crypto-integrity.js";

export interface EncryptedPayload {
  v: 1;
  alg: "AES-256-GCM";
  iv: string; // base64
  authTag: string; // base64
  ciphertext: string; // base64
}

let cachedVaultHybridKeys: { publicKey: Uint8Array; secretKey: Uint8Array } | null = null;

function getVaultHybridKeyPair(): { publicKey: Uint8Array; secretKey: Uint8Array } {
  if (cachedVaultHybridKeys) return cachedVaultHybridKeys;
  const seed = deriveHybridKeygenSeed(getVaultKey());
  cachedVaultHybridKeys = geistHybridKem1024X25519.keygen(seed);
  return cachedVaultHybridKeys;
}

function buildProvenanceDigest(provenance?: string): Buffer | undefined {
  if (!provenance?.trim()) return undefined;
  return createHash("sha256").update(provenance.trim(), "utf8").digest();
}

/**
 * Resolve the 32-byte master encryption key from the environment.
 * Accepts either a 64-char hex string or a base64 string that decodes to
 * exactly 32 bytes. Throws loudly if missing/invalid so secrets are never
 * silently written with a weak or absent key.
 */
function getVaultKey(): Buffer {
  const raw = process.env.VAULT_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "VAULT_ENCRYPTION_KEY is not configured. Refusing to process vault secrets without a 256-bit key. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    key = Buffer.from(raw, "base64");
  }
  if (key.length !== 32) {
    throw new Error("VAULT_ENCRYPTION_KEY must decode to exactly 32 bytes (256 bits).");
  }
  return key;
}

/** Encrypt a UTF-8 string with AES-256-GCM using a fresh random IV. */
export function encryptString(plaintext: string): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv(AES_ALGO, getVaultKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    v: 1,
    alg: "AES-256-GCM",
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64")
  };
}

/** Decrypt an {@link EncryptedPayload} produced by {@link encryptString}. */
export function decryptString(payload: EncryptedPayload): string {
  if (!payload || payload.alg !== "AES-256-GCM" || !payload.iv || !payload.authTag || !payload.ciphertext) {
    throw new Error("Malformed AES-256-GCM payload.");
  }
  try {
    const decipher = createDecipheriv(AES_ALGO, getVaultKey(), Buffer.from(payload.iv, "base64"));
    decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64")),
      decipher.final()
    ]);
    return plaintext.toString("utf8");
  } catch {
    throw new CryptoIntegrityError(
      "Legacy vault payload failed AES-GCM authentication — possible server-side tampering detected.",
    );
  }
}

/**
 * Encrypt with hybrid ML-KEM-1024 + X25519 envelope and AES-256-GCM content key.
 * Optional provenance string is hashed into AAD to bind ciphertext to user/item context.
 */
export function encryptStringHybrid(plaintext: string, provenance?: string): HybridEncryptedPayload {
  const vaultKeys = getVaultHybridKeyPair();
  const { cipherText: kemCiphertext, sharedSecret } = geistHybridKem1024X25519.encapsulate(vaultKeys.publicKey);
  const provenanceDigest = buildProvenanceDigest(provenance);
  const contentKey = deriveHybridContentKey(
    sharedSecret,
    provenanceDigest ? new Uint8Array(provenanceDigest) : undefined,
  );

  const iv = randomBytes(12);
  const cipher = createCipheriv(AES_ALGO, Buffer.from(contentKey), iv);
  if (provenanceDigest) cipher.setAAD(provenanceDigest);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    v: 2,
    alg: "HYBRID-MLKEM1024-X25519-AES-256-GCM",
    kemCiphertext: bytesToBase64(kemCiphertext),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    provenance: provenanceDigest ? provenanceDigest.toString("base64") : undefined,
  };
}

/** Decrypt a hybrid v2 payload. Throws {@link CryptoIntegrityError} on tag mismatch. */
export function decryptStringHybrid(payload: HybridEncryptedPayload): string {
  if (!isHybridEncryptedPayload(payload)) {
    throw new Error("Malformed hybrid encrypted payload.");
  }

  const vaultKeys = getVaultHybridKeyPair();
  const kemCiphertext = base64ToBytes(payload.kemCiphertext);
  const sharedSecret = geistHybridKem1024X25519.decapsulate(kemCiphertext, vaultKeys.secretKey);
  const provenanceDigest = payload.provenance ? Buffer.from(payload.provenance, "base64") : undefined;
  const contentKey = deriveHybridContentKey(
    sharedSecret,
    provenanceDigest ? new Uint8Array(provenanceDigest) : undefined,
  );

  try {
    const decipher = createDecipheriv(AES_ALGO, Buffer.from(contentKey), Buffer.from(payload.iv, "base64"));
    if (provenanceDigest) decipher.setAAD(provenanceDigest);
    decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    throw new CryptoIntegrityError(
      "Hybrid vault payload failed AES-GCM authentication — malicious-server tampering detected.",
    );
  }
}

/** Decrypt v2 hybrid payloads with automatic v1 legacy fallback. */
export function decryptPayloadAuto(payload: AnyEncryptedPayload): string {
  if (isHybridEncryptedPayload(payload)) return decryptStringHybrid(payload);
  if (isLegacyEncryptedPayload(payload)) return decryptString(payload);
  throw new Error("Unsupported encrypted payload format.");
}

/** Prefer hybrid encryption for all newly written vault/exchange secret material. */
export function encryptPayloadPreferred(plaintext: string, provenance?: string): AnyEncryptedPayload {
  return encryptStringHybrid(plaintext, provenance);
}

/** Encrypt an array of strings (e.g. Shamir shares) individually. */
export function encryptStringArray(values: string[], provenance?: string): AnyEncryptedPayload[] {
  return values.map((value) => encryptPayloadPreferred(value, provenance));
}

/** Decrypt an array of encrypted payloads (hybrid or legacy). */
export function decryptStringArray(payloads: AnyEncryptedPayload[]): string[] {
  return payloads.map(decryptPayloadAuto);
}
