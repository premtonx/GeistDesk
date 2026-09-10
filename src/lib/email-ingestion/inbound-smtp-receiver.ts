/**
 * Production wiring for the embedded inbound SMTP daemon:
 * domain allowlist → MIME parse → ingestNormalizedEmail → channel auto-activate.
 */

import { extractEmailAddress } from '../global-blacklist.js';
import { safeLog } from '../safe-log.js';
import {
  findChannelForWebhook,
  markWebhookChannelLiveFromInbound,
} from './channel-store.js';
import { ingestNormalizedEmail } from './ingest-pipeline.js';
import {
  inboundSmtpHostname,
  isAllowedInboundSmtpRecipient,
  isInboundSmtpEnabled,
  parseInboundSmtpMaxBytes,
  parseInboundSmtpPort,
} from './inbound-smtp-domains.js';
import { startInboundSmtpServer, type InboundSmtpHandle } from './inbound-smtp-server.js';
import { parseRfc822ToNormalizedEmail } from './smtp-mime-parser.js';

let handle: InboundSmtpHandle | null = null;

async function deliverSmtpMessage(params: {
  mailFrom: string;
  rcptTo: string[];
  raw: Buffer;
  remoteAddress: string;
}): Promise<{ ok: boolean; smtpCode?: number; smtpMessage?: string }> {
  const recipients = [...new Set(params.rcptTo.map((r) => extractEmailAddress(r)).filter(Boolean))];
  if (recipients.length === 0) {
    return { ok: false, smtpCode: 550, smtpMessage: '5.1.1 no valid recipients' };
  }

  let matched = 0;
  let lastError: string | null = null;

  for (const recipient of recipients) {
    const channel = await findChannelForWebhook({ recipient });
    if (!channel) continue;

    const normalized = await parseRfc822ToNormalizedEmail(params.raw, {
      mailFrom: params.mailFrom,
      rcptTo: [recipient],
    });
    if (!normalized) {
      lastError = '5.6.1 message parse failed';
      continue;
    }

    const result = await ingestNormalizedEmail({
      ...normalized,
      mailbox: channel.forwardingAddress || channel.email || recipient,
      source: 'smtp',
    });

    try {
      await markWebhookChannelLiveFromInbound(channel, result);
    } catch (statusErr) {
      safeLog('warn', '[inbound-smtp] failed to update channel status:', statusErr);
    }

    if (!result.success && !result.blocked) {
      lastError = '4.3.0 ingest failed';
      continue;
    }
    matched += 1;
  }

  if (matched > 0) {
    return { ok: true };
  }
  if (lastError?.startsWith('4.')) {
    return { ok: false, smtpCode: 451, smtpMessage: lastError };
  }
  if (lastError) {
    return { ok: false, smtpCode: 550, smtpMessage: lastError };
  }
  return { ok: false, smtpCode: 550, smtpMessage: '5.1.1 mailbox unavailable' };
}

export async function startInboundSmtpReceiver(): Promise<InboundSmtpHandle | null> {
  if (handle) return handle;
  if (!isInboundSmtpEnabled()) {
    safeLog('info', '[inbound-smtp] disabled (INBOUND_SMTP_ENABLED=false)');
    return null;
  }

  const port = parseInboundSmtpPort(process.env.INBOUND_SMTP_PORT, 25);
  const host = (process.env.INBOUND_SMTP_BIND || '0.0.0.0').trim() || '0.0.0.0';
  const hostname = inboundSmtpHostname();
  const maxBytes = parseInboundSmtpMaxBytes(process.env.INBOUND_SMTP_MAX_BYTES);

  try {
    handle = await startInboundSmtpServer({
      port,
      host,
      hostname,
      maxBytes,
      isAllowedRecipient: async (address) => {
        if (isAllowedInboundSmtpRecipient(address)) return true;
        const channel = await findChannelForWebhook({ recipient: extractEmailAddress(address) });
        return Boolean(channel);
      },
      onMessage: (message) => deliverSmtpMessage(message),
    });
    safeLog(
      'info',
      `[inbound-smtp] listening on ${host}:${handle.port} hostname=${handle.hostname} maxBytes=${maxBytes}`,
    );
    return handle;
  } catch (err: any) {
    const code = err?.code || '';
    safeLog(
      'warn',
      `[inbound-smtp] could not bind ${host}:${port} (${code || err?.message || err}). HTTP gateway will continue.`,
    );
    handle = null;
    return null;
  }
}

export async function stopInboundSmtpReceiver(): Promise<void> {
  if (!handle) return;
  const current = handle;
  handle = null;
  await current.close().catch(() => undefined);
}
