/**
 * Redact secrets before writing to application logs.
 */

const SECRET_PATTERNS: Array<{ re: RegExp; replace: string }> = [
  // Connection strings
  { re: /(postgres(?:ql)?:\/\/)([^:@\s]+):([^@\s]+)@/gi, replace: '$1$2:***@' },
  { re: /(mongodb(?:\+srv)?:\/\/)([^:@\s]+):([^@\s]+)@/gi, replace: '$1$2:***@' },
  // Bearer / basic auth headers
  { re: /(authorization\s*[:=]\s*["']?Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, replace: '$1***' },
  { re: /(authorization\s*[:=]\s*["']?Basic\s+)[A-Za-z0-9+/]+=*/gi, replace: '$1***' },
  // Common env / secret key=value forms
  {
    re: /\b(GEISTDESK_DATABASE_URL|DATABASE_URL|PG_DATABASE_URL|JWT_SECRET|OPENAI_API_KEY|AZURE_OPENAI_API_KEY|GEMINI_API_KEY|ANTHROPIC_API_KEY|INBOUND_MAIL_WEBHOOK_SECRET|MICROSOFT_PROVIDER_CLIENT_SECRET|CLIENT_SECRET|SMTP_PASS(?:WORD)?|IMAP_PASS(?:WORD)?|GRAPH_CLIENT_STATE)\b\s*[:=]\s*["']?([^\s"',;]+)/gi,
    replace: '$1=***',
  },
  // Lonely JWT-looking tokens
  { re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, replace: '***JWT***' },
  // API key-ish prefixes
  { re: /\b(sk-[A-Za-z0-9]{8,})\b/g, replace: 'sk-***' },
  { re: /\b(AIza[0-9A-Za-z\-_]{20,})\b/g, replace: 'AIza***' },
  // OAuth form bodies echoed back by providers (client_secret, refresh_token, code, grant)
  {
    re: /\b(client_secret|client_secret_value|refresh_token|access_token|id_token|code)\b\s*[:=]\s*["']?([^\s"',;&]+)/gi,
    replace: '$1=***',
  },
];

export function redactSecrets(input: unknown): string {
  let text: string;
  if (input == null) return '';
  if (typeof input === 'string') text = input;
  else if (input instanceof Error) text = input.message || String(input);
  else {
    try {
      text = JSON.stringify(input);
    } catch {
      text = String(input);
    }
  }

  let out = text;
  for (const { re, replace } of SECRET_PATTERNS) {
    out = out.replace(re, replace);
  }
  return out;
}

/** Safe message for console / API error responses (never dump full Error objects). */
export function safeErrorMessage(err: unknown, fallback = 'Unexpected error'): string {
  if (err instanceof Error) return redactSecrets(err.message) || fallback;
  if (typeof err === 'string') return redactSecrets(err) || fallback;
  return fallback;
}

export function safeLog(level: 'log' | 'info' | 'warn' | 'error', prefix: string, ...parts: unknown[]): void {
  const cleaned = parts.map((p) => redactSecrets(p));
  // eslint-disable-next-line no-console
  console[level](prefix, ...cleaned);
}
