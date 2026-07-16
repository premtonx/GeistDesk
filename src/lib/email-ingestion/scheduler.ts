/**
 * 60-second polling daemon for active-pull email channels (Graph / IMAP).
 * Webhook channels are skipped (passive push only).
 */

import {
  getDocsDirect,
  updateDocDirect,
} from '../postgres-backend.js';
import { createEmailIngestionDriver, isActivePullDriver } from './factory.js';
import { ingestNormalizedEmail } from './ingest-pipeline.js';
import {
  EMAIL_CHANNELS_COLLECTION,
  type EmailChannelConfig,
} from './types.js';

const DEFAULT_INTERVAL_MS = 60_000;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function loadEnabledChannels(): Promise<EmailChannelConfig[]> {
  const docs = await getDocsDirect(EMAIL_CHANNELS_COLLECTION, []);
  return (docs || []).map((doc: any) => ({
    id: doc.id,
    ...doc,
  })) as EmailChannelConfig[];
}

export async function pollEmailIngestionDriversOnce(): Promise<void> {
  if (running) {
    console.warn('[email-ingestion] previous poll still running — skipping tick');
    return;
  }
  running = true;
  try {
    const channels = await loadEnabledChannels();
    const active = channels.filter(isActivePullDriver);

    for (const channel of active) {
      const driver = createEmailIngestionDriver(channel);
      try {
        const emails = await driver.fetchUnreadEmails();
        for (const email of emails) {
          const result = await ingestNormalizedEmail({
            ...email,
            mailbox: email.mailbox || channel.email,
          });
          if (result.blocked) {
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
        console.error(`[email-ingestion] channel=${channel.id} error:`, message);
        await updateDocDirect(EMAIL_CHANNELS_COLLECTION, channel.id, {
          lastPolledAt: new Date().toISOString(),
          lastError: message,
          status: 'failed',
        }).catch(() => undefined);
      }
    }
  } finally {
    running = false;
  }
}

export function startEmailIngestionScheduler(intervalMs = DEFAULT_INTERVAL_MS): void {
  if (timer) return;
  const ms = Number(process.env.EMAIL_INGESTION_INTERVAL_MS || intervalMs) || DEFAULT_INTERVAL_MS;

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
