// Server-side cryptographic primitives for GeistDesk.
// - Password hashing/verification via Argon2id (hash-wasm, cross-platform, no native build).
// - Authenticated symmetric encryption of secret assets via AES-256-GCM (Node native crypto).
//
// IMPORTANT: This module is server-only. Do not import it into browser bundles.

import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { argon2id, argon2Verify } from "hash-wasm";

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

export interface EncryptedPayload {
  v: 1;
  alg: "AES-256-GCM";
  iv: string; // base64
  authTag: string; // base64
  ciphertext: string; // base64
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
  const decipher = createDecipheriv(AES_ALGO, getVaultKey(), Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final()
  ]);
  return plaintext.toString("utf8");
}

/** Encrypt an array of strings (e.g. Shamir shares) individually. */
export function encryptStringArray(values: string[]): EncryptedPayload[] {
  return values.map(encryptString);
}

/** Decrypt an array of {@link EncryptedPayload}. */
export function decryptStringArray(payloads: EncryptedPayload[]): string[] {
  return payloads.map(decryptString);
}
