/**
 * PII Shield - Privacy Proxy Middleware for GeistDesk
 * Scans for sensitive data patterns and redacts them.
 */

export const PII_PATTERNS = {
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  CREDIT_CARD: /\b(?:\d[ -]*?){13,16}\b/g,
  PHONE: /\b(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/g,
  NAME: /\b(?:Mr\.|Ms\.|Mrs\.|Dr\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g, // Simple name detection
};

export function redactPII(text: string): string {
  let redacted = text;
  
  redacted = redacted.replace(PII_PATTERNS.EMAIL, "[REDACTED_EMAIL]");
  redacted = redacted.replace(PII_PATTERNS.CREDIT_CARD, "[REDACTED_CARD]");
  redacted = redacted.replace(PII_PATTERNS.PHONE, "[REDACTED_PHONE]");
  redacted = redacted.replace(PII_PATTERNS.NAME, "[REDACTED_NAME]");
  
  return redacted;
}

export function isTextSensitive(text: string): boolean {
  return Object.values(PII_PATTERNS).some(pattern => pattern.test(text));
}
