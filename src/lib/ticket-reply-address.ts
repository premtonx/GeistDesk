/**
 * Reply header helpers: never append @client.com to an address that already
 * has a domain, and prefer real From / customerEmail values.
 */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PLACEHOLDER_FROM = new Set([
  'support@geistdesk.support',
  'support@geistdesk.ai',
  'noreply@localhost',
]);

export function extractBareEmail(raw: unknown): string {
  const text = String(raw || '').trim();
  if (!text) return '';
  const angle = text.match(/<([^>]+)>/);
  const candidate = (angle?.[1] || text).trim();
  const match = candidate.match(EMAIL_RE);
  if (match?.[0]) return match[0].toLowerCase();
  // Already a complete address without extras
  if (candidate.includes('@') && !candidate.endsWith('@') && !candidate.includes(' ')) {
    const lower = candidate.toLowerCase();
    if (EMAIL_RE.test(lower)) return lower;
  }
  return '';
}

export function resolveTicketCustomerEmail(ticket: {
  customerEmail?: string | null;
  from_email?: string | null;
  contactEmail?: string | null;
  customerId?: string | null;
}): string {
  for (const value of [ticket.customerEmail, ticket.from_email, ticket.contactEmail, ticket.customerId]) {
    const email = extractBareEmail(value);
    if (email) return email;
  }
  return '';
}

function titleCaseLocalPart(local: string): string {
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function resolveTicketCustomerName(
  ticket: { customerName?: string | null },
  email: string,
): string {
  const raw = String(ticket.customerName || '').trim();
  const local = email.includes('@') ? email.split('@')[0] : '';
  if (raw && extractBareEmail(raw) !== email.toLowerCase() && raw.toLowerCase() !== local.toLowerCase()) {
    return raw;
  }
  if (raw && raw.toLowerCase() !== email.toLowerCase() && /[A-Z]/.test(raw) && raw.includes(' ')) {
    return raw;
  }
  if (raw && raw.includes(' ')) return raw;
  return titleCaseLocalPart(local || raw);
}

/** `Name <email@domain>` for the composer An: row. */
export function formatReplyRecipientLabel(ticket: {
  customerName?: string | null;
  customerEmail?: string | null;
  from_email?: string | null;
  contactEmail?: string | null;
  customerId?: string | null;
}): string {
  const email = resolveTicketCustomerEmail(ticket);
  const name = resolveTicketCustomerName(ticket, email);
  if (!email) return name || '';
  if (name && name.toLowerCase() !== email.toLowerCase()) {
    return `${name} <${email}>`;
  }
  return email;
}

export function isPlaceholderFromAddress(address: string): boolean {
  return PLACEHOLDER_FROM.has(address.trim().toLowerCase());
}

export function resolveComposerFromAddress(params: {
  ticketMailbox?: string | null;
  channels?: Array<{
    isPrimary?: boolean;
    enabled?: boolean;
    forwardingAddress?: string | null;
    email?: string | null;
    mailbox?: string | null;
  }>;
  moduleSupportEmail?: string | null;
  mailFromAddress?: string | null;
}): string {
  const channels = (params.channels || []).filter((ch) => ch && ch.enabled !== false);
  const mailbox = extractBareEmail(params.ticketMailbox);

  const channelAddress = (ch: (typeof channels)[number] | undefined): string => {
    if (!ch) return '';
    return extractBareEmail(ch.forwardingAddress) || extractBareEmail(ch.email) || extractBareEmail(ch.mailbox);
  };

  if (mailbox) {
    const matched = channels.find((ch) => {
      const addresses = [
        extractBareEmail(ch.forwardingAddress),
        extractBareEmail(ch.email),
        extractBareEmail(ch.mailbox),
      ];
      return addresses.includes(mailbox);
    });
    const fromMatched = channelAddress(matched);
    if (fromMatched) return fromMatched;
    return mailbox;
  }

  const primary = channels.find((ch) => ch.isPrimary) || channels[0];
  const fromPrimary = channelAddress(primary);
  if (fromPrimary) return fromPrimary;

  const envFrom = extractBareEmail(params.mailFromAddress);
  if (envFrom && !isPlaceholderFromAddress(envFrom)) return envFrom;

  const moduleFrom = extractBareEmail(params.moduleSupportEmail);
  if (moduleFrom && !isPlaceholderFromAddress(moduleFrom)) return moduleFrom;

  return '';
}
