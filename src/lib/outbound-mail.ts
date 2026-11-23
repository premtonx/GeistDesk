/**
 * Best-effort outbound mail for ticket agent replies.
 * Missing mail configuration must never fail the reply write path.
 *
 * Dispatch order:
 *   1. Org Send-As Microsoft Graph channel (when healthy + sendAsEnabled)
 *   2. Hubcom global Graph channel fallback
 *   3. SMTP / MAIL_DISPATCH_URL fallback for classic SMTP setups
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
  isHealthySendAsGraph,
  listGlobalEmailChannels,
} from './email-ingestion/channel-store.js';

export interface OutboundMailResult {
  delivered: boolean;
  reason?: string;
  from?: string;
  domainVerified?: boolean;
  /** Which channel identity was used (org Send-As vs Hubcom fallback). */
  via?: 'org_send_as' | 'hubcom_fallback' | 'smtp' | 'none';
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
    return { delivered: false, reason: 'Microsoft Graph channel could not be loaded.', via: 'none' };
  }

  const driver = createEmailIngestionDriver(channel);
  if (!(driver instanceof MicrosoftGraphDriver) || typeof driver.sendMail !== 'function') {
    return {
      delivered: false,
      reason: 'Resolved channel is not a Microsoft Graph driver.',
      via: 'none',
    };
  }

  const to = String(params.to || '').trim();
  if (!to) {
    return {
      delivered: false,
      reason: 'Ticket has no customer email — reply saved to database only.',
      from: channel.mailbox || channel.email || undefined,
      domainVerified: Boolean(channel.dnsVerified),
      via: 'none',
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
      via: 'none',
    };
  }

  const orgId = channel.organizationId || channel.organization_id || null;
  return {
    delivered: true,
    from,
    domainVerified: Boolean(channel.dnsVerified),
    reason: `Sent via Microsoft Graph as ${from || 'mailbox'}`,
    via: orgId ? 'org_send_as' : 'hubcom_fallback',
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
 *   1. Client org Graph channel with sendAsEnabled (healthy only)
 *   2. Caller-provided preferred channel (if it belongs to the org or is global)
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
    if (orgChannel && isHealthySendAsGraph(orgChannel)) {
      return orgChannel;
    }
  }

  if (params.preferredChannel) {
    const preferredOrg =
      params.preferredChannel.organizationId ||
      params.preferredChannel.organization_id ||
      null;
    // Never use another client's channel as preferred.
    if (orgId && preferredOrg && preferredOrg !== orgId) {
      /* skip */
    } else if (isGraphChannel(params.preferredChannel)) {
      if (!preferredOrg || isHealthySendAsGraph(params.preferredChannel)) {
        return resolveGraphChannelWithSecrets(params.preferredChannel);
      }
    } else {
      return params.preferredChannel;
    }
  }

  return findGlobalDefaultEmailChannel({ includeSecrets: true });
}

async function trySendViaSmtp(params: {
  ticketId: string;
  to?: string | null;
  subject?: string | null;
  body: string;
  agentName?: string | null;
  channel?: EmailChannelConfig | null;
}): Promise<OutboundMailResult> {
  if (!smtpConfigured()) {
    return {
      delivered: false,
      reason:
        'No Microsoft Graph Send-As channel matched this ticket and SMTP is not configured (SMTP_HOST / SMTP_USER missing). Reply saved to database only.',
      via: 'none',
    };
  }

  try {
    const endpoint = (process.env.MAIL_DISPATCH_URL || '').trim();
    if (!endpoint) {
      return {
        delivered: false,
        reason: 'MAIL_DISPATCH_URL not set. Reply saved to database only.',
        via: 'none',
      };
    }

    const fromResolution = resolveOutboundFrom(params.channel);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketId: params.ticketId,
        to: params.to,
        subject: params.subject,
        body: params.body,
        agentName: params.agentName,
        from: fromResolution.from,
        domainVerified: fromResolution.domainVerified,
        unverifiedDomainWarning: fromResolution.warning || null,
        replyTo: params.channel?.email || null,
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
        via: 'smtp',
      };
    }

    return {
      delivered: true,
      from: fromResolution.from,
      domainVerified: fromResolution.domainVerified,
      reason: fromResolution.warning,
      via: 'smtp',
    };
  } catch (err: any) {
    return {
      delivered: false,
      reason: err?.message || 'Mail dispatch threw unexpectedly',
      via: 'none',
    };
  }
}

/**
 * Attempt to dispatch a customer-facing reply email.
 * Prefer healthy org Send-As Graph → Hubcom global Graph → SMTP.
 * Graph failures fall through to the next option; missing config never throws.
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
  const orgId = (params.organizationId || '').trim() || null;

  // 1) Healthy org Send-As
  let orgChannel: EmailChannelConfig | null = null;
  if (orgId) {
    orgChannel = await findOrganizationEmailChannel(orgId, {
      includeSecrets: true,
      requireSendAs: true,
    });
    if (orgChannel && isHealthySendAsGraph(orgChannel)) {
      const orgResult = await trySendViaMicrosoftGraph({
        ticketId: params.ticketId,
        to: params.to,
        subject: params.subject,
        body: params.body,
        agentName: params.agentName,
        channel: orgChannel,
      });
      if (orgResult.delivered) {
        return { ...orgResult, via: 'org_send_as' };
      }
      // Fall through to Hubcom on Graph failure.
    }
  }

  // 2) Hubcom global Graph — try preferred channel first, then every global Graph channel.
  const graphFailures: string[] = [];
  if (orgChannel && !isHealthySendAsGraph(orgChannel)) {
    graphFailures.push(
      `Org Send-As channel disabled/unhealthy (${orgChannel.email || orgChannel.id})`,
    );
  } else if (orgId && orgChannel) {
    // org path already attempted above; keep last reason if any by re-reading is awkward —
    // failures are recorded below when we fall through.
  }

  const preferredGlobal =
    params.channel &&
    !(params.channel.organizationId || params.channel.organization_id) &&
    isGraphChannel(params.channel)
      ? params.channel
      : null;

  const globals = await listGlobalEmailChannels({ includeSecrets: true });
  const graphCandidates: EmailChannelConfig[] = [];
  if (preferredGlobal) graphCandidates.push(preferredGlobal);
  for (const ch of globals) {
    if (!isGraphChannel(ch)) continue;
    if (graphCandidates.some((c) => c.id === ch.id)) continue;
    graphCandidates.push(ch);
  }

  // Prefer explicitly healthy channels, but still attempt others (status may be stale).
  graphCandidates.sort((a, b) => {
    const ah = isHealthySendAsGraph(a) ? 0 : 1;
    const bh = isHealthySendAsGraph(b) ? 0 : 1;
    return ah - bh;
  });

  let lastGraph: OutboundMailResult | null = null;
  for (const channel of graphCandidates) {
    const hubcomResult = await trySendViaMicrosoftGraph({
      ticketId: params.ticketId,
      to: params.to,
      subject: params.subject,
      body: params.body,
      agentName: params.agentName,
      channel,
    });
    if (hubcomResult.delivered) {
      return { ...hubcomResult, via: 'hubcom_fallback' };
    }
    lastGraph = hubcomResult;
    const label = channel.mailbox || channel.email || channel.id;
    graphFailures.push(`${label}: ${hubcomResult.reason || 'Graph sendMail failed'}`);
  }

  // 3) SMTP
  const smtpResult = await trySendViaSmtp({
    ticketId: params.ticketId,
    to: params.to,
    subject: params.subject,
    body: params.body,
    agentName: params.agentName,
    channel:
      graphCandidates[0] ||
      (await findGlobalDefaultEmailChannel({ includeSecrets: true })) ||
      params.channel ||
      null,
  });
  if (smtpResult.delivered) return smtpResult;

  // Surface Graph errors first — SMTP-missing is expected on Graph-only setups.
  const combinedReason = [
    ...graphFailures,
    smtpResult.reason,
    lastGraph && !graphFailures.length ? lastGraph.reason : null,
  ]
    .filter(Boolean)
    .join(' | ');

  return {
    delivered: false,
    reason:
      combinedReason ||
      'No Microsoft Graph channel could send this reply and SMTP is not configured.',
    from: lastGraph?.from || smtpResult.from,
    domainVerified: lastGraph?.domainVerified ?? smtpResult.domainVerified,
    via: 'none',
  };
}
