/**
 * In-memory per-sender-domain rate limiter for inbound mail.
 *
 * Protects against spam floods hitting help-{slug}@inbound.geistai.eu: a burst
 * of e.g. 5,000 messages from one domain is capped before any LLM call or
 * ticket creation. State lives in process memory — it resets on restart, which
 * is acceptable at mailbox scale; a Redis-backed variant is a future option.
 */

import { extractEmailAddress } from '../global-blacklist.js';

const DEFAULT_MAX_PER_WINDOW = 10;
const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

let maxPerWindow = DEFAULT_MAX_PER_WINDOW;
let windowMsValue = DEFAULT_WINDOW_MS;

function readEnv(): void {
  const rawMax = Number(process.env.INBOUND_PER_SENDER_RATE_LIMIT || '0');
  const rawWindow = Number(process.env.INBOUND_PER_SENDER_WINDOW_MS || '0');
  if (Number.isFinite(rawMax) && rawMax > 0) maxPerWindow = rawMax;
  if (Number.isFinite(rawWindow) && rawWindow > 0) windowMsValue = rawWindow;
}

readEnv();

export interface SenderRateLimitResult {
  allowed: boolean;
  domain: string;
  count: number;
  max: number;
}

interface WindowEntry {
  timestamps: number[];
}

const windows = new Map<string, WindowEntry>();

function pruneWindow(entry: WindowEntry, now: number): void {
  while (entry.timestamps.length > 0 && entry.timestamps[0] <= now - windowMsValue) {
    entry.timestamps.shift();
  }
}

/** Domain key for a sender address (lowercased, no @). */
export function senderDomain(sender: string): string {
  const email = extractEmailAddress(sender || '').toLowerCase();
  if (!email.includes('@')) return email;
  return email.split('@')[1] || email;
}

/** Check whether a sender is within its per-domain budget. */
export function checkSenderRateLimit(sender: string): SenderRateLimitResult {
  const domain = senderDomain(sender);
  const now = Date.now();

  const entry = windows.get(domain) || { timestamps: [] };
  pruneWindow(entry, now);
  entry.timestamps.push(now);
  windows.set(domain, entry);

  const count = entry.timestamps.length;
  const allowed = count <= maxPerWindow;
  if (!allowed) {
    console.warn(
      `[sender-rate-limiter] domain ${domain} exceeded ${maxPerWindow}/window (count=${count}) — dropping`,
    );
  }
  return { allowed, domain, count, max: maxPerWindow };
}

/** Test-only reset. */
export function resetSenderRateLimiter(): void {
  windows.clear();
}
