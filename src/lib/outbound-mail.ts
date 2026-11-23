/**
 * Best-effort outbound mail for ticket agent replies.
 * Missing mail configuration must never fail the reply write path.
 *
 * Dispatch order:
 *   1. Microsoft Graph sendMail when the resolved channel is `microsoft_graph`
 *      (client-credentials app with Mail.Send) — preferred for Graph mailboxes /
 *      per-client Send-As.
 *   2. SMTP / MAIL_DISPATCH_URL fallback for classic SMTP setups.
 *
 * Domain verification gate (SMTP path):
 *   - dnsVerified channel → From: "Support Name <support@domain.com>"
 *   - otherwise → system-default From on the GeistDesk mail domain
 */

import {
  buildSystemDefaultFromHeader,
  buildVerifiedFromHeader,
} from './email-ingestion/domain-verification.js';
import { createEmailIngestionDriver } from './email-ingestion/factory.js';
import { MicrosoftGraphDriver } from './email-ingestion/drivers/graph-driver.js';
import type { EmailChannelConfig } from './email-ingestion/types.js';
import {
  findGlobalDefaultEmailChannel,
  findOrganizationEmailChannel,
  getEmailChannel,
} from './email-ingestion/channel-store.js';

export interface OutboundMailResult {
  delivered: boolean;
  reason?: string;
  from?: string;
  domainVerified?: boolean;
}

function smtpConfigured(): boolean {
  const host = (process.env.SMTP_HOST || process.env.MAIL_SMTP_HOST || '').trim();
  const user = (process.env.SMTP_USER || process.env.MAIL_SMTP_USER || '').trim();
  return Boolean(host && user);
}

function isGraphChannel(channel?: EmailChannelConfig | null): boolean {
  return channel?.connectionType === 'microsoft_graph';
}

async function resolveGraphChannelWithSecrets(
  channel?: EmailChannelConfig | null,
): Promise<EmailChannelConfig | null> {
  if (!channel?.id) return channel || null;
  const secret = String(channel.clientSecret || '');
  if (secret && secret !== '••••••••') return channel;
  try {
    return (await getEmailChannel(channel.id, { includeSecrets: true })) || channel;
  } catch {
    return channel;
  }
}

async function trySendViaMicrosoftGraph(params: {
  ticketId: string;
  to?: string | null;
  subject?: string | null;
  body: string;
  agentName?: string | null;
  channel: EmailChannelConfig;
}): Promise<OutboundMailResult> {
  const channel = await resolveGraphChannelWithSecrets(params.channel);
  if (!channel) {
    return { delivered: false, reason: 'Microsoft Graph channel could not be loaded.' };
  }

  const driver = createEmailIngestionDriver(channel);
  if (!(driver instanceof MicrosoftGraphDriver) || typeof driver.sendMail !== 'function') {
    return {
      delivered: false,
      reason: 'Resolved channel is not a Microsoft Graph driver.',
    };
  }

  const to = String(params.to || '').trim();
  if (!to) {
    return {
      delivered: false,
      reason: 'Ticket has no customer email — reply saved to database only.',
      from: channel.mailbox || channel.email || undefined,
      domainVerified: Boolean(channel.dnsVerified),
    };
  }

  const result = await driver.sendMail({
    to,
    subject: params.subject || `Re: Ticket ${params.ticketId}`,
    body: params.body,
    contentType: 'HTML',
  });

  const from = channel.mailbox || channel.email || undefined;
  if (result.ok === false) {
    return {
      delivered: false,
      reason: result.message || 'Graph sendMail failed',
      from,
      domainVerified: Boolean(channel.dnsVerified),
    };
  }

  return {
    delivered: true,
    from,
    domainVerified: Boolean(channel.dnsVerified),
    reason: `Sent via Microsoft Graph as ${from || 'mailbox'}`,
  };
}

export function resolveOutboundFrom(channel?: EmailChannelConfig | null): {
  from: string;
  domainVerified: boolean;
  warning?: string;
} {
  if (channel?.dnsVerified && channel.email?.includes('@')) {
    return {
      from: buildVerifiedFromHeader(channel),
      domainVerified: true,
    };
  }

  const systemFrom = buildSystemDefaultFromHeader();
  const alias = channel?.email?.trim();
  return {
    from: systemFrom,
    domainVerified: false,
    warning: alias
      ? `Domain unverified for ${alias} — sent via system From (${systemFrom}). Complete DNS verification to use the support alias.`
      : `No verified support channel — sent via system From (${systemFrom}).`,
  };
}

/**
 * Resolve the outbound channel for a ticket reply:
 *   1. Client org Graph channel with sendAsEnabled
 *   2. Caller-provided / mailbox-matched channel
 *   3. Hubcom global default Graph/IMAP channel
 */
export async function resolveSendAsChannel(params: {
  organizationId?: string | null;
  preferredChannel?: EmailChannelConfig | null;
}): Promise<EmailChannelConfig | null> {
  const orgId = (params.organizationId || '').trim();
  if (orgId) {
    const orgChannel = await findOrganizationEmailChannel(orgId, {
      includeSecrets: true,
      requireSendAs: true,
    });
    if (
      orgChannel &&
      orgChannel.connectionType === 'microsoft_graph' &&
      (orgChannel.status === 'connected' ||
        orgChannel.status === 'verified' ||
        orgChannel.status === 'active' ||
        orgChannel.lastTestOk === true)
    ) {
      return orgChannel;
    }
  }

  if (params.preferredChannel) {
    if (isGraphChannel(params.preferredChannel)) {
      return resolveGraphChannelWithSecrets(params.preferredChannel);
    }
    return params.preferredChannel;
  }

  return findGlobalDefaultEmailChannel({ includeSecrets: true });
}

/**
 * Attempt to dispatch a customer-facing reply email.
 * Prefer Microsoft Graph when the ticket's channel is Graph-backed; otherwise
 * fall back to SMTP / MAIL_DISPATCH_URL. Missing config never throws.
 */
export async function trySendTicketReplyEmail(params: {
  ticketId: string;
  to?: string | null;
  subject?: string | null;
  body: string;
  agentName?: string | null;
  /** Ingestion / support channel used to pick the From: header. */
  channel?: EmailChannelConfig | null;
  /** Ticket organization — enables per-client Send-As when configured. */
  organizationId?: string | null;
}): Promise<OutboundMailResult> {
  const channel =
    (await resolveSendAsChannel({
      organizationId: params.organizationId,
      preferredChannel: params.channel || null,
    })) || params.channel || null;

  if (isGraphChannel(channel)) {
    return trySendViaMicrosoftGraph({
      ticketId: params.ticketId,
      to: params.to,
      subject: params.subject,
      body: params.body,
      agentName: params.agentName,
      channel: channel!,
    });
  }

  if (!smtpConfigured()) {
    return {
      delivered: false,
      reason:
        'No Microsoft Graph Send-As channel matched this ticket and SMTP is not configured (SMTP_HOST / SMTP_USER missing). Reply saved to database only.',
    };
  }

  try {
    const endpoint = (process.env.MAIL_DISPATCH_URL || '').trim();
    if (!endpoint) {
      return {
        delivered: false,
        reason: 'MAIL_DISPATCH_URL not set. Reply saved to database only.',
      };
    }

    const fromResolution = resolveOutboundFrom(channel);
    const body = params.body;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketId: params.ticketId,
        to: params.to,
        subject: params.subject,
        body,
        agentName: params.agentName,
        from: fromResolution.from,
        domainVerified: fromResolution.domainVerified,
        unverifiedDomainWarning: fromResolution.warning || null,
        replyTo: channel?.email || null,
        autoSubmitted: 'no',
        inReplyTo: params.ticketId ? `geistdesk-ticket-${params.ticketId}` : undefined,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return {
        delivered: false,
        reason: `Mail dispatch failed (${res.status}): ${detail.slice(0, 200)}`,
        from: fromResolution.from,
        domainVerified: fromResolution.domainVerified,
      };
    }

    return {
      delivered: true,
      from: fromResolution.from,
      domainVerified: fromResolution.domainVerified,
      reason: fromResolution.warning,
    };
  } catch (err: any) {
    return {
      delivered: false,
      reason: err?.message || 'Mail dispatch threw unexpectedly',
    };
  }
}
