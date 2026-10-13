/**
 * Global sender blacklist for inbound mail pre-filtering.
 * Stores email addresses and/or domains that must never create tickets.
 */

import { queryDb } from './postgres-backend.js';

export interface BlacklistEntry {
  id: string;
  blocked_value: string;
  blocked_by: string | null;
  createdAt: string;
}

/** Normalize "Name <user@host>" / bare addresses to lowercase email. */
export function extractEmailAddress(raw: string): string {
  const text = String(raw || '').trim();
  if (!text) return '';
  const angle = text.match(/<([^>]+)>/);
  const candidate = (angle?.[1] || text).trim();
  const emailMatch = candidate.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return (emailMatch?.[0] || candidate).toLowerCase();
}

export function emailDomain(email: string): string {
  const normalized = extractEmailAddress(email);
  const at = normalized.lastIndexOf('@');
  if (at < 0) return '';
  return normalized.slice(at + 1).toLowerCase();
}

/**
 * Returns true when the sender email (or its domain) is on the global blacklist.
 * Domain rows may be stored as `example.com` or `@example.com`.
 */
export async function isSenderBlacklisted(rawSender: string): Promise<boolean> {
  const email = extractEmailAddress(rawSender);
  if (!email) return false;
  const domain = emailDomain(email);
  const domainAt = domain ? `@${domain}` : '';

  const result = await queryDb(
    `SELECT id FROM global_blacklist
     WHERE lower(blocked_value) = $1
        OR ($2 <> '' AND lower(blocked_value) IN ($2, $3))
     LIMIT 1`,
    [email, domain, domainAt],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Insert a blocked value (email or domain). Idempotent on case-insensitive value.
 */
export async function addToGlobalBlacklist(params: {
  blockedValue: string;
  blockedBy: string;
}): Promise<BlacklistEntry> {
  const value = extractEmailAddress(params.blockedValue) || String(params.blockedValue).trim().toLowerCase();
  if (!value) {
    throw new Error('blocked_value is required');
  }

  const result = await queryDb(
    `INSERT INTO global_blacklist (blocked_value, blocked_by)
     VALUES ($1, $2)
     ON CONFLICT (blocked_value) DO UPDATE
       SET blocked_by = COALESCE(EXCLUDED.blocked_by, global_blacklist.blocked_by)
     RETURNING id::text, blocked_value, blocked_by, "createdAt"`,
    [value, params.blockedBy || null],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    blocked_value: row.blocked_value,
    blocked_by: row.blocked_by,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

export async function logBlacklistDrop(params: {
  sender: string;
  subject?: string;
  reason: string;
}): Promise<void> {
  console.warn(
    `[InboundMail] Dropped blacklisted sender=${extractEmailAddress(params.sender) || params.sender} reason=${params.reason} subject=${JSON.stringify(params.subject || '')}`,
  );
}
