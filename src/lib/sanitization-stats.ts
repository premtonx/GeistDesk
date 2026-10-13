/**
 * Persistent PII sanitization counters. Starts at zero; incremented only when
 * the PII shield actually redacts matches. Never seeded with demo telemetry.
 */

import type { SanitizationCounts } from '../types/headerTelemetry.js';
import { queryDb } from './postgres-backend.js';

export const SANITIZATION_STATS_COLLECTION = 'sanitization_stats';
export const SANITIZATION_STATS_ID = 'global';

export type { SanitizationCounts };

export const EMPTY_SANITIZATION_COUNTS: SanitizationCounts = {
  emails: 0,
  passwords: 0,
  apiKeys: 0,
  ipAddresses: 0,
};

function asCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function normalizeSanitizationCounts(
  raw?: Partial<SanitizationCounts> | Record<string, unknown> | null,
): SanitizationCounts {
  return {
    emails: asCount(raw?.emails),
    passwords: asCount(raw?.passwords),
    apiKeys: asCount(raw?.apiKeys),
    ipAddresses: asCount(raw?.ipAddresses),
  };
}

export function hasSanitizationDelta(delta: SanitizationCounts): boolean {
  return delta.emails + delta.passwords + delta.apiKeys + delta.ipAddresses > 0;
}

export async function getSanitizationStats(): Promise<SanitizationCounts> {
  const result = await queryDb(
    `SELECT data FROM geistdesk_documents
      WHERE collection = $1 AND id = $2
      LIMIT 1`,
    [SANITIZATION_STATS_COLLECTION, SANITIZATION_STATS_ID],
  );
  const data = result.rows[0]?.data;
  if (!data) return { ...EMPTY_SANITIZATION_COUNTS };
  const parsed =
    typeof data === 'string' ? (JSON.parse(data) as Record<string, unknown>) : (data as Record<string, unknown>);
  return normalizeSanitizationCounts(parsed);
}

export async function recordSanitizationCounts(delta: Partial<SanitizationCounts>): Promise<void> {
  const next = normalizeSanitizationCounts(delta);
  if (!hasSanitizationDelta(next)) return;

  await queryDb(
    `INSERT INTO geistdesk_documents (collection, id, data)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (collection, id) DO UPDATE
       SET data = jsonb_build_object(
             'emails', COALESCE((geistdesk_documents.data->>'emails')::int, 0) + $4,
             'passwords', COALESCE((geistdesk_documents.data->>'passwords')::int, 0) + $5,
             'apiKeys', COALESCE((geistdesk_documents.data->>'apiKeys')::int, 0) + $6,
             'ipAddresses', COALESCE((geistdesk_documents.data->>'ipAddresses')::int, 0) + $7,
             'updatedAt', to_jsonb(NOW()::text)
           ),
           updated_at = NOW()`,
    [
      SANITIZATION_STATS_COLLECTION,
      SANITIZATION_STATS_ID,
      JSON.stringify({ ...next, updatedAt: new Date().toISOString() }),
      next.emails,
      next.passwords,
      next.apiKeys,
      next.ipAddresses,
    ],
  );
}
