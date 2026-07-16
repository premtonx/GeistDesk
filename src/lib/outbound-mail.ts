/**
 * Best-effort outbound mail for ticket agent replies.
 * Missing SMTP configuration must never fail the reply write path.
 *
 * Domain verification gate:
 *   - dnsVerified channel → From: "Support Name <support@domain.com>"
 *   - otherwise → system-default From on the GeistDesk mail domain
 */

import {
  buildSystemDefaultFromHeader,
  buildVerifiedFromHeader,
} from './email-ingestion/domain-verification.js';
import type { EmailChannelConfig } from './email-ingestion/types.js';

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
 * Attempt to dispatch a customer-facing reply email.
 * When no SMTP host/user is configured (typical showcase / self-host without mail),
 * returns `{ delivered: false }` without throwing.
 */
export async function trySendTicketReplyEmail(params: {
  ticketId: string;
  to?: string | null;
  subject?: string | null;
  body: string;
  agentName?: string | null;
  /** Ingestion / support channel used to pick the From: header. */
  channel?: EmailChannelConfig | null;
}): Promise<OutboundMailResult> {
  if (!smtpConfigured()) {
    return {
      delivered: false,
      reason: 'SMTP not configured (SMTP_HOST / SMTP_USER missing). Reply saved to database only.',
    };
  }

  try {
    // Lightweight SMTP hand-off without a mandatory nodemailer dependency:
    // integrations can plug a real transporter behind this env gate later.
    const endpoint = (process.env.MAIL_DISPATCH_URL || '').trim();
    if (!endpoint) {
      return {
        delivered: false,
        reason: 'MAIL_DISPATCH_URL not set. Reply saved to database only.',
      };
    }

    const fromResolution = resolveOutboundFrom(params.channel);
    let body = params.body;
    if (!fromResolution.domainVerified && fromResolution.warning) {
      // Keep the customer body clean; surface the warning to the dispatcher + delivery audit.
      body = params.body;
    }

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
        replyTo: params.channel?.email || null,
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
