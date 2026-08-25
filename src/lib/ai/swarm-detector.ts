/**
 * 3-Tier Agentic Graph — Tier 3: Swarm Outage Cluster Detector.
 *
 * Groups incoming unassigned tickets from the last 15 minutes by shared
 * root error / intent (category + keyword overlap). When 5+ tickets share the
 * same root cause, an `ai_incident_clusters` row is created and the Ticket
 * view shows a dismissible emergency banner.
 *
 * Runs on a background interval (see startSwarmDetector) and can also be
 * triggered manually via POST /api/ai/incident-clusters/scan.
 */

import { queryDb } from '../postgres-backend.js';
import { getOrchestratorConfig } from '../ai-orchestrator-store.js';
import { createIncidentCluster } from '../ai-orchestrator-store.js';
import {
  enqueueJob,
  leaseNextJob,
  completeJob,
  failJob,
  recoverOrphanedJobs,
} from '../job-queue.js';

export const SWARM_WINDOW_MINUTES = 15;
export const SWARM_MIN_TICKETS = 5;

interface IncomingTicket {
  id: string;
  subject: string;
  description: string;
  type?: string;
  category?: string;
  tags?: string[];
}

const ROOT_CAUSE_KEYWORDS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(outage|down|unavailable|not loading|downtime)\b/i, label: 'Outage / Service Down' },
  { pattern: /\b(auth|login|oauth|sso|2fa|sign-in|sign in|entra)\b/i, label: 'Authentication & Login' },
  { pattern: /\b(payment|billing|charge|invoice|refund)\b/i, label: 'Billing & Payments' },
  { pattern: /\b(ssl|tls|certificate|expired cert|handshake)\b/i, label: 'SSL / Certificate' },
  { pattern: /\b(500|502|503|504|gateway|server error|internal error)\b/i, label: 'Server Errors (5xx)' },
  { pattern: /\b(sync|synchronization|not syncing|stale)\b/i, label: 'Synchronization' },
  { pattern: /\b(email|mail|delivery|bounce|smtp)\b/i, label: 'Email Delivery' },
  { pattern: /\b(api|webhook|integration|rate.limit)\b/i, label: 'API / Integration' },
  { pattern: /\b(permission|access denied|forbidden|unauthorized)\b/i, label: 'Permission / Access' },
];

function detectRootCause(ticket: IncomingTicket): string | null {
  const haystack = `${ticket.subject ?? ''} ${ticket.description ?? ''} ${(ticket.tags ?? []).join(' ')}`;
  for (const { pattern, label } of ROOT_CAUSE_KEYWORDS) {
    if (pattern.test(haystack)) return label;
  }
  return null;
}

/** Extracts recent unassigned tickets (last 15 min) from the document store. */
async function fetchRecentUnassignedTickets(workspaceId: string): Promise<IncomingTicket[]> {
  const cutoff = new Date(Date.now() - SWARM_WINDOW_MINUTES * 60_000).toISOString();
  try {
    const res = await queryDb(
      `SELECT id, data
       FROM geistdesk_documents
       WHERE collection = 'tickets'
         AND data->>'createdAt' >= $1
         AND COALESCE(data->>'agentId', '') = ''
         AND COALESCE(data->>'status', '') NOT IN ('resolved', 'closed', 'spam', 'trash', 'deleted', 'merged')
       ORDER BY data->>'createdAt' DESC
       LIMIT 200`,
      [cutoff],
    );
    return res.rows.map((row) => {
      const d = (row.data ?? {}) as Record<string, unknown>;
      return {
        id: String(row.id),
        subject: String(d.subject ?? ''),
        description: String(d.description ?? ''),
        type: typeof d.type === 'string' ? d.type : undefined,
        category: typeof d.category === 'string' ? d.category : undefined,
        tags: Array.isArray(d.tags) ? (d.tags as string[]) : undefined,
      };
    });
  } catch (e: unknown) {
    console.warn('[AI Swarm] Recent tickets lookup skipped:', e instanceof Error ? e.message : String(e));
    return [];
  }
}

function groupByRootCause(tickets: IncomingTicket[]): Map<string, IncomingTicket[]> {
  const groups = new Map<string, IncomingTicket[]>();
  for (const ticket of tickets) {
    const root = detectRootCause(ticket);
    if (!root) continue;
    const bucket = groups.get(root) ?? [];
    bucket.push(ticket);
    groups.set(root, bucket);
  }
  return groups;
}

export interface SwarmDetectionResult {
  scanned: number;
  clustersCreated: number;
  clusters: Array<{ title: string; ticketCount: number; sampleTicketIds: string[] }>;
}

/**
 * Runs one detection pass. `force` bypasses the background-debounce so an
 * admin-triggered scan always re-evaluates.
 */
export async function runSwarmDetectionOnce(options: { force?: boolean } = {}): Promise<SwarmDetectionResult> {
  try {
    const config = await getOrchestratorConfig('default');
    if (!config.enableSwarmDetection && !options.force) {
      return { scanned: 0, clustersCreated: 0, clusters: [] };
    }
  } catch {
    // Config read failures fall back to enabled — detection is read-only.
  }

  const tickets = await fetchRecentUnassignedTickets('default');
  const groups = groupByRootCause(tickets);
  const result: SwarmDetectionResult = {
    scanned: tickets.length,
    clustersCreated: 0,
    clusters: [],
  };

  for (const [title, group] of groups) {
    if (group.length < SWARM_MIN_TICKETS) continue;
    const sampleTicketIds = group.slice(0, 8).map((t) => t.id);
    const id = await createIncidentCluster({ clusterTitle: title, sampleTicketIds });
    if (id) {
      result.clustersCreated += 1;
      result.clusters.push({ title, ticketCount: group.length, sampleTicketIds });
    }
  }

  if (result.clustersCreated > 0) {
    console.info(
      `[AI Swarm] Detected ${result.clustersCreated} outage cluster(s) across ${result.scanned} recent tickets.`,
    );
  }

  return result;
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let lastRunAt = 0;
const MIN_INTERVAL_MS = 60_000;

/**
 * Enqueue one durable SWARM_DETECTION job. Deduped by the background ticker,
 * so admin-triggered scans (force) stay synchronous while background runs are
 * lease-guarded against concurrent duplicates.
 */
export function enqueueSwarmDetection(workspaceId = 'default'): Promise<void> {
  return enqueueJob('SWARM_DETECTION', { workspaceId }, { maxAttempts: 2 }).then(() => undefined);
}

/** Drain leased SWARM_DETECTION jobs — the durable worker body. */
export async function drainSwarmDetectionQueue(): Promise<void> {
  const workerId = `swarm-${process.pid}`;
  for (let leased = 0; leased < 5; leased += 1) {
    const row = await leaseNextJob(workerId, ['SWARM_DETECTION']);
    if (!row) break;
    try {
      await runSwarmDetectionOnce();
      await completeJob(row.id);
    } catch (err: any) {
      console.warn(
        `[AI Swarm] job ${row.id} failed (attempt ${row.attempts + 1}):`,
        err?.message || String(err),
      );
      await failJob(row.id, err);
    }
  }
}

/** One scheduled pass: enqueue a detection job, then drain leased jobs. */
async function runSwarmPass(): Promise<void> {
  await enqueueSwarmDetection('default');
  await drainSwarmDetectionQueue();
}

/**
 * Starts the background swarm detector. Runs immediately once, then every N
 * minutes. Safe to call multiple times (single interval guard).
 */
export function startSwarmDetector(intervalMinutes = 5): void {
  if (intervalHandle) return;
  const run = () => {
    const now = Date.now();
    if (now - lastRunAt < MIN_INTERVAL_MS) return;
    lastRunAt = now;
    void runSwarmPass().catch((e: unknown) =>
      console.warn('[AI Swarm] Background pass failed:', e instanceof Error ? e.message : String(e)),
    );
  };
  void recoverOrphanedJobs('swarm').then((recovered) => {
    if (recovered > 0) console.log(`[AI Swarm] recovered ${recovered} orphaned job(s)`);
  });
  run();
  intervalHandle = setInterval(run, Math.max(intervalMinutes, 1) * 60_000);
  // Keep the process alive-friendly: don't hold the event loop open in tests.
  if (typeof intervalHandle.unref === 'function') intervalHandle.unref();
}

export function stopSwarmDetector(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
