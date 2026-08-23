/**
 * PII Shield - Privacy Proxy Middleware for GeistDesk
 * Scans for sensitive data patterns and redacts them.
 */

export const PII_PATTERNS = {
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  CREDIT_CARD: /\b(?:\d[ -]*?){13,16}\b/g,
  PHONE: /\b(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/g,
  NAME: /\b(?:Mr\.|Ms\.|Mrs\.|Dr\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g, // Simple name detection
  // Secrets / tokens / credentials — redacted before content enters the vector store.
  PASSWORD_KEY_VALUE: /\b(?:password|passwd|pwd)\b\s*[:=]\s*\S+/gi,
  API_KEY_VALUE: /\b(?:api[_-]?key|apikey|secret(?:[_-]?key)?|client[_-]?secret|access[_-]?token)\b\s*[:=]\s*\S+/gi,
  BEARER_TOKEN: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi,
  JWT_TOKEN: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/gi,
  AWS_CREDENTIAL: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  PRIVATE_KEY_BLOCK: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
};

export function redactPII(text: string): string {
  let redacted = text;

  redacted = redacted.replace(PII_PATTERNS.PASSWORD_KEY_VALUE, (match) => {
    const key = match.split(/[:=]/)[0];
    return `${key}: [REDACTED_SECRET]`;
  });
  redacted = redacted.replace(PII_PATTERNS.API_KEY_VALUE, (match) => {
    const key = match.split(/[:=]/)[0];
    return `${key}: [REDACTED_SECRET]`;
  });
  redacted = redacted.replace(PII_PATTERNS.PRIVATE_KEY_BLOCK, '[REDACTED_PRIVATE_KEY]');
  redacted = redacted.replace(PII_PATTERNS.JWT_TOKEN, '[REDACTED_TOKEN]');
  redacted = redacted.replace(PII_PATTERNS.BEARER_TOKEN, '[REDACTED_TOKEN]');
  redacted = redacted.replace(PII_PATTERNS.AWS_CREDENTIAL, '[REDACTED_KEY]');
  redacted = redacted.replace(PII_PATTERNS.EMAIL, '[REDACTED_EMAIL]');
  redacted = redacted.replace(PII_PATTERNS.CREDIT_CARD, '[REDACTED_CARD]');
  redacted = redacted.replace(PII_PATTERNS.PHONE, '[REDACTED_PHONE]');
  redacted = redacted.replace(PII_PATTERNS.NAME, '[REDACTED_NAME]');

  return redacted;
}

export function isTextSensitive(text: string): boolean {
  return Object.values(PII_PATTERNS).some(pattern => pattern.test(text));
}
