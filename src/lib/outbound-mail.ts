/**
 * Best-effort outbound mail for ticket agent replies.
 * Missing SMTP configuration must never fail the reply write path.
 */

export interface OutboundMailResult {
  delivered: boolean;
  reason?: string;
}

function smtpConfigured(): boolean {
  const host = (process.env.SMTP_HOST || process.env.MAIL_SMTP_HOST || '').trim();
  const user = (process.env.SMTP_USER || process.env.MAIL_SMTP_USER || '').trim();
  return Boolean(host && user);
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

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketId: params.ticketId,
        to: params.to,
        subject: params.subject,
        body: params.body,
        agentName: params.agentName,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return {
        delivered: false,
        reason: `Mail dispatch failed (${res.status}): ${detail.slice(0, 200)}`,
      };
    }

    return { delivered: true };
  } catch (err: any) {
    return {
      delivered: false,
      reason: err?.message || 'Mail dispatch threw unexpectedly',
    };
  }
}
