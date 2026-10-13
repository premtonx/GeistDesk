/** Raised when AES-GCM authentication tag verification fails (tampered ciphertext). */
export class CryptoIntegrityError extends Error {
  readonly code = 'CRYPTO_INTEGRITY_VIOLATION';

  constructor(message = 'Authenticated decryption failed: payload integrity check rejected tampered ciphertext.') {
    super(message);
    this.name = 'CryptoIntegrityError';
  }
}

export function isCryptoIntegrityError(error: unknown): error is CryptoIntegrityError {
  return error instanceof CryptoIntegrityError;
}
