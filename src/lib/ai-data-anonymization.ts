/**
 * Zero-leak data anonymization for public cloud AI egress.
 * Reversible placeholder tokens are held only in ephemeral per-request memory.
 */

export interface ScrubSensitiveDataOptions {
  /** Corporate workspace / tenant display name to redact from outbound prompts. */
  workspaceName?: string;
  /** Plaintext fingerprints sourced from GeistVault and credential stores. */
  vaultFingerprints?: string[];
}

export interface ScrubSensitiveDataResult {
  scrubbedText: string;
  /** Maps immutable placeholder token → original sensitive value. */
  tokenMap: Record<string, string>;
  wasScrubbed: boolean;
  tokenCount: number;
}

export interface RehydrateResponseDataResult {
  rehydratedText: string;
  replacements: number;
}

const EPHEMERAL_TOKEN_STORE = new Map<string, Record<string, string>>();

const IPV4_REGEX =
  /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
const HOSTNAME_REGEX =
  /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:local|internal|corp|lan|net|com|io|cloud|dev|prod|staging)\b/gi;
const DATABASE_URL_REGEX =
  /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|mssql):\/\/[^\s"'<>]+/gi;
const CREDENTIAL_KV_REGEX =
  /(password|secret|token|passwd|private_key|api_key|apikey)\s*[:=]\s*["']?([^\s"'<>]{8,})["']?/gi;
const BEARER_REGEX = /\bbearer\s+([a-zA-Z0-9_\-+=/.]{12,})\b/gi;
const CLOUD_TOKEN_REGEX =
  /\b(xoxb-[0-9]{11,13}-[0-9]{11,13}-[a-zA-Z0-9]{24}|ghp_[a-zA-Z0-9]{36}|AIzaSy[a-zA-Z0-9_\-]{33}|sk-[a-zA-Z0-9]{20,})\b/gi;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function nextPlaceholder(category: string, counters: Record<string, number>): string {
  counters[category] = (counters[category] ?? 0) + 1;
  return `{{GD_TOKEN_${category}_${counters[category]}}}`;
}

function replaceAllLiteral(
  text: string,
  original: string,
  placeholder: string,
): string {
  if (!original || original.length < 2) return text;
  return text.split(original).join(placeholder);
}

function tokenizeRegexMatches(
  text: string,
  regex: RegExp,
  category: string,
  tokenMap: Record<string, string>,
  counters: Record<string, number>,
  mapValue?: (match: string, ...groups: string[]) => string,
): string {
  return text.replace(regex, (...args) => {
    const match = args[0] as string;
    const groups = args.slice(1, -2) as string[];
    const original = mapValue ? mapValue(match, ...groups) : match;
    if (!original || original.length < 2) return match;

    const existing = Object.entries(tokenMap).find(([, value]) => value === original)?.[0];
    const placeholder = existing ?? nextPlaceholder(category, counters);
    if (!existing) tokenMap[placeholder] = original;

    if (mapValue) {
      return match.replace(original, placeholder);
    }
    return placeholder;
  });
}

/**
 * Detect and replace sensitive corporate fingerprints with immutable placeholder tokens.
 * Longest vault fingerprints are applied first to avoid partial collisions.
 */
export function scrubSensitiveData(
  promptText: string,
  options: ScrubSensitiveDataOptions = {},
): ScrubSensitiveDataResult {
  if (!promptText || typeof promptText !== 'string') {
    return { scrubbedText: '', tokenMap: {}, wasScrubbed: false, tokenCount: 0 };
  }

  const tokenMap: Record<string, string> = {};
  const counters: Record<string, number> = {};
  let scrubbedText = promptText;

  const vaultPrints = [...(options.vaultFingerprints ?? [])]
    .filter((value) => typeof value === 'string' && value.trim().length >= 4)
    .sort((a, b) => b.length - a.length);

  for (const fingerprint of vaultPrints) {
    const trimmed = fingerprint.trim();
    if (!trimmed || !scrubbedText.includes(trimmed)) continue;
    const existing = Object.entries(tokenMap).find(([, value]) => value === trimmed)?.[0];
    const placeholder = existing ?? nextPlaceholder('VAULT', counters);
    if (!existing) tokenMap[placeholder] = trimmed;
    scrubbedText = replaceAllLiteral(scrubbedText, trimmed, placeholder);
  }

  if (options.workspaceName?.trim()) {
    const name = options.workspaceName.trim();
    const nameRegex = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi');
    scrubbedText = tokenizeRegexMatches(scrubbedText, nameRegex, 'COMPANY', tokenMap, counters);
  }

  scrubbedText = tokenizeRegexMatches(scrubbedText, DATABASE_URL_REGEX, 'DBURL', tokenMap, counters);
  scrubbedText = tokenizeRegexMatches(scrubbedText, IPV4_REGEX, 'IP', tokenMap, counters);
  scrubbedText = tokenizeRegexMatches(scrubbedText, HOSTNAME_REGEX, 'HOST', tokenMap, counters);
  scrubbedText = scrubbedText.replace(CREDENTIAL_KV_REGEX, (match, prefix, secret) => {
    const existing = Object.entries(tokenMap).find(([, value]) => value === secret)?.[0];
    const placeholder = existing ?? nextPlaceholder('PASS', counters);
    if (!existing) tokenMap[placeholder] = secret;
    return `${prefix}: ${placeholder}`;
  });
  scrubbedText = scrubbedText.replace(BEARER_REGEX, (match, token) => {
    const existing = Object.entries(tokenMap).find(([, value]) => value === token)?.[0];
    const placeholder = existing ?? nextPlaceholder('BEARER', counters);
    if (!existing) tokenMap[placeholder] = token;
    return `Bearer ${placeholder}`;
  });
  scrubbedText = tokenizeRegexMatches(scrubbedText, CLOUD_TOKEN_REGEX, 'TOKEN', tokenMap, counters);

  const tokenCount = Object.keys(tokenMap).length;
  return {
    scrubbedText,
    tokenMap,
    wasScrubbed: tokenCount > 0,
    tokenCount,
  };
}

/**
 * Swap placeholder tokens in a model response back to original corporate values.
 */
export function rehydrateResponseData(
  aiResponseText: string,
  tokenMap: Record<string, string>,
): RehydrateResponseDataResult {
  if (!aiResponseText || typeof aiResponseText !== 'string' || !tokenMap) {
    return { rehydratedText: aiResponseText ?? '', replacements: 0 };
  }

  const placeholders = Object.keys(tokenMap).sort((a, b) => b.length - a.length);
  let rehydratedText = aiResponseText;
  let replacements = 0;

  for (const placeholder of placeholders) {
    const original = tokenMap[placeholder];
    if (!original) continue;
    const parts = rehydratedText.split(placeholder);
    if (parts.length > 1) {
      replacements += parts.length - 1;
      rehydratedText = parts.join(original);
    }
  }

  return { rehydratedText, replacements };
}

/** Bind a placeholder dictionary to an active lifecycle request UUID. */
export function storeRequestTokenMap(requestId: string, tokenMap: Record<string, string>): void {
  if (!requestId || Object.keys(tokenMap).length === 0) return;
  EPHEMERAL_TOKEN_STORE.set(requestId, { ...tokenMap });
}

/** Read the active token map without removing it (approval / multi-step flows). */
export function peekRequestTokenMap(requestId: string): Record<string, string> | undefined {
  const map = EPHEMERAL_TOKEN_STORE.get(requestId);
  return map ? { ...map } : undefined;
}

/** Consume and purge the token map for a completed request. */
export function consumeRequestTokenMap(requestId: string): Record<string, string> | undefined {
  const map = peekRequestTokenMap(requestId);
  EPHEMERAL_TOKEN_STORE.delete(requestId);
  return map;
}

/** Explicitly purge token material from runtime memory. */
export function clearRequestTokenMap(requestId: string): void {
  EPHEMERAL_TOKEN_STORE.delete(requestId);
}

/** Test-only helper to reset ephemeral stores between dry-runs. */
export function resetEphemeralTokenStores(): void {
  EPHEMERAL_TOKEN_STORE.clear();
}
