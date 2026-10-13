/**
 * 60-second polling daemon for active-pull email channels (Graph / IMAP).
 * Webhook channels are skipped (passive push only).
 *
 * Each channel poll is a durable `EMAIL_POLL` job so horizontal scale-out
 * never double-polls a mailbox and restarts re-lease in-flight polls.
 */

import {
  getDocsDirect,
  updateDocDirect,
} from '../postgres-backend.js';
import { createEmailIngestionDriver, isActivePullDriver } from './factory.js';
import { ingestNormalizedEmail } from './ingest-pipeline.js';
import {
  enqueueJob,
  leaseNextJob,
  completeJob,
  failJob,
  recoverOrphanedJobs,
  type BackgroundJobRow,
} from '../job-queue.js';
import {
  EMAIL_CHANNELS_COLLECTION,
  type EmailChannelConfig,
} from './types.js';

const DEFAULT_INTERVAL_MS = 60_000;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
let workerStarted = false;

async function loadEnabledChannels(): Promise<EmailChannelConfig[]> {
  const docs = await getDocsDirect(EMAIL_CHANNELS_COLLECTION, []);
  return (docs || []).map((doc: any) => ({
    id: doc.id,
    ...doc,
  })) as EmailChannelConfig[];
}

/** Enqueue one durable EMAIL_POLL job per enabled active-pull channel. */
export async function enqueueEmailPollJobs(): Promise<number> {
  const channels = await loadEnabledChannels();
  const active = channels.filter(isActivePullDriver);
  for (const channel of active) {
    await enqueueJob('EMAIL_POLL', { channelId: channel.id, tenantId: channel.tenantId || 'default' })
      .catch((err) => {
        console.warn(`[email-ingestion] enqueue channel=${channel.id} failed:`, err?.message || err);
      });
  }
  return active.length;
}

/** Poll one channel (leased EMAIL_POLL job body). */
export async function pollEmailChannelOnce(
  row: BackgroundJobRow,
): Promise<{ emails: number; blocked: number }> {
  const payload = (row.payload ?? {}) as { channelId?: string };
  const channelId = String(payload.channelId || '');
  if (!channelId) throw new Error('EMAIL_POLL job missing channelId.');
  const channels = await loadEnabledChannels();
  const channel = channels.find((c) => c.id === channelId);
  if (!channel) throw new Error(`Email channel ${channelId} not found.`);

  const driver = createEmailIngestionDriver(channel);
  let emails = 0;
  let blocked = 0;
  try {
    const fetched = await driver.fetchUnreadEmails();
    for (const email of fetched) {
      const result = await ingestNormalizedEmail({
        ...email,
        mailbox: email.mailbox || channel.email,
      });
      emails += 1;
      if (result.blocked) {
        blocked += 1;
        console.info(
          `[email-ingestion] dropped blacklisted mail on channel=${channel.id}`,
        );
      }
    }
    await updateDocDirect(EMAIL_CHANNELS_COLLECTION, channel.id, {
      lastPolledAt: new Date().toISOString(),
      lastError: null,
      status: channel.status === 'disabled' ? 'disabled' : 'active',
    });
  } catch (err: any) {
    const message = err?.message || 'poll failed';
    await updateDocDirect(EMAIL_CHANNELS_COLLECTION, channel.id, {
      lastPolledAt: new Date().toISOString(),
      lastError: message,
      status: 'failed',
    }).catch(() => undefined);
    throw err;
  }
  return { emails, blocked };
}

/** Drain leased EMAIL_POLL jobs — the durable worker body. */
export async function drainEmailPollQueue(): Promise<void> {
  const workerId = `email-poll-${process.pid}`;
  for (let leased = 0; leased < 25; leased += 1) {
    const row = await leaseNextJob(workerId, ['EMAIL_POLL']);
    if (!row) break;
    try {
      await pollEmailChannelOnce(row);
      await completeJob(row.id);
    } catch (err: any) {
      console.error(`[email-ingestion] job ${row.id} failed:`, err?.message || 'poll failed');
      await failJob(row.id, err);
    }
  }
}

export async function pollEmailIngestionDriversOnce(): Promise<void> {
  if (running) {
    console.warn('[email-ingestion] previous poll still running — skipping tick');
    return;
  }
  running = true;
  try {
    const enqueued = await enqueueEmailPollJobs();
    if (enqueued > 0) await drainEmailPollQueue();
  } finally {
    running = false;
  }
}

export function startEmailIngestionScheduler(intervalMs = DEFAULT_INTERVAL_MS): void {
  if (timer) return;
  const ms = Number(process.env.EMAIL_INGESTION_INTERVAL_MS || intervalMs) || DEFAULT_INTERVAL_MS;

  void recoverOrphanedJobs('email-poll').then((recovered) => {
    if (recovered > 0) console.log(`[email-ingestion] recovered ${recovered} orphaned poll(s)`);
  });

  void pollEmailIngestionDriversOnce().catch((err) =>
    console.error('[email-ingestion] initial poll failed:', err),
  );

  timer = setInterval(() => {
    void pollEmailIngestionDriversOnce().catch((err) =>
      console.error('[email-ingestion] poll failed:', err),
    );
  }, ms);

  console.log(`[email-ingestion] scheduler started (interval=${ms}ms)`);
}

export function stopEmailIngestionScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
