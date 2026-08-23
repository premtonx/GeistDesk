/**
 * Persistence helpers for email channel configs (geistdesk_documents / email_channels).
 */

import { randomBytes } from 'crypto';
import {
  addDocDirect,
  deleteDocDirect,
  getDocDirect,
  getDocsDirect,
  setDocDirect,
  updateDocDirect,
} from '../postgres-backend.js';
import {
  EMAIL_CHANNELS_COLLECTION,
  type EmailChannelConfig,
  type EmailConnectionType,
} from './types.js';
import { ensureDomainVerificationFields } from './domain-verification.js';

const SECRET_FIELDS = [
  'imapPassword',
  'oauthClientSecret',
  'clientSecret',
  'webhookSecret',
  'oauthRefreshToken',
] as const;

/** Exclude localhost / loopback values so generated addresses never persist @localhost. */
function configuredDomain(env: string | undefined): string {
  const value = (env || '').trim();
  if (!value) return '';
  const lowered = value.toLowerCase();
  if (lowered === 'localhost' || lowered === '127.0.0.1' || lowered === '0.0.0.0') return '';
  return value;
}

function forwardingDomain(): string {
  return (
    configuredDomain(process.env.INBOUND_EMAIL_DOMAIN) ||
    configuredDomain(process.env.INBOUND_MAIL_FORWARD_DOMAIN) ||
    configuredDomain(process.env.MAIL_FORWARD_DOMAIN) ||
    'inbound.geistai.eu'
  );
}

/** Publicly-renderable forwarding domain (help-{slug}@domain) for the admin UI. */
export function getForwardingDomain(): string {
  return forwardingDomain();
}

export function buildForwardingAddress(channelId: string): string {
  const slug = channelId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16).toLowerCase() || 'channel';
  return `help-${slug}@${forwardingDomain()}`;
}

/**
 * Repair a persisted forwarding address: trailing @localhost (or loopback) is
 * swapped for the configured inbound domain so dev defaults never leak to the
 * mail host. Missing addresses are generated from the channel id.
 */
export function normalizeForwardingAddress(
  address: string | null | undefined,
  channelId?: string,
): string {
  if (!address || !address.includes('@')) {
    return channelId ? buildForwardingAddress(channelId) : '';
  }
  const at = address.lastIndexOf('@');
  const local = address.slice(0, at);
  const host = address.slice(at + 1).toLowerCase().trim();
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
    return `${local}@${forwardingDomain()}`;
  }
  return address;
}

export function generateWebhookSecret(): string {
  return randomBytes(24).toString('hex');
}

export function redactChannelSecrets(
  channel: EmailChannelConfig,
): EmailChannelConfig {
  const clone: EmailChannelConfig = { ...channel };
  for (const field of SECRET_FIELDS) {
    const value = clone[field];
    if (typeof value === 'string' && value.length > 0) {
      (clone as any)[field] = '••••••••';
      (clone as any)[`${field}Set`] = true;
    }
  }
  return clone;
}

function mergeSecrets(
  incoming: Partial<EmailChannelConfig>,
  existing: EmailChannelConfig | null,
): Partial<EmailChannelConfig> {
  const next = { ...incoming };
  for (const field of SECRET_FIELDS) {
    const value = next[field];
    if (value === '••••••••' || value === '' || value === undefined) {
      if (existing?.[field]) {
        (next as any)[field] = existing[field];
      } else {
        delete (next as any)[field];
      }
    }
  }
  return next;
}

/** Persist DNS verification material for channels created before this feature. */
async function backfillDomainVerificationIfNeeded(
  channel: EmailChannelConfig,
): Promise<EmailChannelConfig> {
  if (
    channel.verificationToken &&
    channel.dkimRecordName &&
    channel.dkimRecordValue &&
    channel.spfRecordValue
  ) {
    return channel;
  }

  const fields = ensureDomainVerificationFields(channel);
  const next: EmailChannelConfig = {
    ...channel,
    ...fields,
    dnsVerified: Boolean(channel.dnsVerified),
  };
  await updateDocDirect(EMAIL_CHANNELS_COLLECTION, channel.id, {
    ...fields,
    dnsVerified: Boolean(channel.dnsVerified),
    updatedAt: new Date().toISOString(),
  });
  return next;
}

/**
 * Repair @localhost forwarding addresses that were persisted from dev defaults.
 * Returns the channel with a corrected address and persists the fix so the
 * mail host never sees a loopback destination.
 */
async function repairForwardingAddressIfNeeded(
  channel: EmailChannelConfig,
): Promise<EmailChannelConfig> {
  if (channel.connectionType !== 'webhook') return channel;

  const raw = channel.forwardingAddress || '';
  const normalized = normalizeForwardingAddress(raw, channel.id);
  if (normalized === raw) return channel;

  const next: EmailChannelConfig = { ...channel, forwardingAddress: normalized };
  await updateDocDirect(EMAIL_CHANNELS_COLLECTION, channel.id, {
    forwardingAddress: normalized,
    updatedAt: new Date().toISOString(),
  }).catch((err) => {
    console.warn('[channel-store] failed to repair forwarding address:', err?.message || err);
  });
  return next;
}

export async function listEmailChannels(): Promise<EmailChannelConfig[]> {
  const docs = await getDocsDirect(EMAIL_CHANNELS_COLLECTION, []);
  const channels: EmailChannelConfig[] = [];
  const domain = getForwardingDomain();
  for (const doc of docs) {
    const base = { id: doc.id, ...doc, forwardingDomain: domain } as EmailChannelConfig;
    const ensured = await backfillDomainVerificationIfNeeded(base);
    const repaired = await repairForwardingAddressIfNeeded(ensured);
    channels.push(redactChannelSecrets(repaired));
  }
  return channels;
}

export async function getEmailChannel(
  id: string,
  opts?: { includeSecrets?: boolean },
): Promise<EmailChannelConfig | null> {
  const doc = await getDocDirect(EMAIL_CHANNELS_COLLECTION, id);
  if (!doc) return null;
  const ensured = await backfillDomainVerificationIfNeeded({
    id: doc.id,
    ...doc,
    forwardingDomain: getForwardingDomain(),
  } as EmailChannelConfig);
  const repaired = await repairForwardingAddressIfNeeded(ensured);
  return opts?.includeSecrets ? repaired : redactChannelSecrets(repaired);
}

/** IMAP / Graph server fields are unused for webhook channels — persist as null. */
function clearActivePullFields(channel: EmailChannelConfig): void {
  channel.imapHost = null;
  channel.imapPort = null;
  channel.imapUser = null;
  channel.imapPassword = null;
  channel.imapTls = null;
  channel.oauthClientId = null;
  channel.oauthClientSecret = null;
  channel.oauthTokenUrl = null;
  channel.oauthRefreshToken = null;
  channel.oauthScope = null;
  channel.tenantId = null;
  channel.clientId = null;
  channel.clientSecret = null;
  channel.mailbox = null;
}

export async function createEmailChannel(
  input: Partial<EmailChannelConfig>,
): Promise<EmailChannelConfig> {
  const now = new Date().toISOString();
  const connectionType = (input.connectionType || 'webhook') as EmailConnectionType;
  const isWebhook = connectionType === 'webhook';

  const created = await addDocDirect(EMAIL_CHANNELS_COLLECTION, {
    name: input.name || 'Support Channel',
    email: input.email || '',
    group: input.group || '',
    status: input.status || 'pending',
    connectionType,
    enabled: input.enabled !== false,
    isPrimary: Boolean(input.isPrimary),
    provider: input.provider || 'custom',
    // Webhook / passive forwarding: leave IMAP server fields null (not required).
    imapHost: isWebhook ? null : input.imapHost || null,
    imapPort: isWebhook ? null : (input.imapPort ?? 993),
    imapUser: isWebhook ? null : (input.imapUser || input.email || null),
    imapPassword: isWebhook ? null : input.imapPassword || null,
    imapTls: isWebhook ? null : input.imapTls !== false,
    oauthClientId: isWebhook ? null : input.oauthClientId || null,
    oauthClientSecret: isWebhook ? null : input.oauthClientSecret || null,
    oauthTokenUrl: isWebhook ? null : input.oauthTokenUrl || null,
    oauthRefreshToken: isWebhook ? null : input.oauthRefreshToken || null,
    oauthScope: isWebhook ? null : input.oauthScope || null,
    tenantId: connectionType === 'microsoft_graph' ? input.tenantId || null : null,
    clientId: connectionType === 'microsoft_graph' ? input.clientId || null : null,
    clientSecret: connectionType === 'microsoft_graph' ? input.clientSecret || null : null,
    mailbox:
      connectionType === 'microsoft_graph'
        ? input.mailbox || input.email || null
        : null,
    createdAt: now,
    updatedAt: now,
  });

  const id = created.id as string;
  const webhookSecret = input.webhookSecret || generateWebhookSecret();
  const forwardingAddress = normalizeForwardingAddress(input.forwardingAddress, id);
  const domainFields = ensureDomainVerificationFields({
    ...input,
    dnsVerified: false,
  });

  await updateDocDirect(EMAIL_CHANNELS_COLLECTION, id, {
    webhookSecret,
    forwardingAddress,
    ...domainFields,
    dnsVerified: false,
    dnsVerifiedAt: null,
    updatedAt: now,
  });

  return redactChannelSecrets({
    id,
    ...created.data,
    webhookSecret,
    forwardingAddress,
    forwardingDomain: getForwardingDomain(),
    ...domainFields,
    dnsVerified: false,
    dnsVerifiedAt: null,
  });
}

export async function updateEmailChannel(
  id: string,
  input: Partial<EmailChannelConfig>,
): Promise<EmailChannelConfig | null> {
  const existing = await getDocDirect(EMAIL_CHANNELS_COLLECTION, id);
  if (!existing) return null;

  // Domain verification is server-authoritative — never trust client dnsVerified=true.
  const safeInput: Partial<EmailChannelConfig> = { ...input };
  delete (safeInput as any).dnsVerified;
  delete (safeInput as any).dnsVerifiedAt;
  // Preserve generated DNS material unless explicitly regenerating via verify flow.
  if (!safeInput.verificationToken) delete (safeInput as any).verificationToken;
  if (!safeInput.dkimRecordName) delete (safeInput as any).dkimRecordName;
  if (!safeInput.dkimRecordValue) delete (safeInput as any).dkimRecordValue;
  if (!safeInput.spfRecordValue) delete (safeInput as any).spfRecordValue;

  const merged = mergeSecrets(safeInput, existing as EmailChannelConfig);
  const now = new Date().toISOString();
  const next: EmailChannelConfig = {
    ...(existing as EmailChannelConfig),
    ...merged,
    id,
    updatedAt: now,
    dnsVerified: Boolean((existing as EmailChannelConfig).dnsVerified),
    dnsVerifiedAt: (existing as EmailChannelConfig).dnsVerifiedAt ?? null,
  };

  if (next.connectionType === 'webhook') {
    next.webhookSecret = next.webhookSecret || generateWebhookSecret();
    next.forwardingAddress = normalizeForwardingAddress(next.forwardingAddress, id);
    // Explicitly clear pull-driver fields so nulls persist (spread of undefined is a no-op).
    clearActivePullFields(next);
  }

  // Always ensure DNS verification material exists (backfill older channels).
  const domainFields = ensureDomainVerificationFields(next);
  next.verificationToken = domainFields.verificationToken;
  next.dkimRecordName = domainFields.dkimRecordName;
  next.dkimRecordValue = domainFields.dkimRecordValue;
  next.spfRecordValue = domainFields.spfRecordValue;
  next.dnsVerified = Boolean(next.dnsVerified);

  // Changing the support email invalidates prior DNS verification.
  const priorEmail = String((existing as EmailChannelConfig).email || '').toLowerCase();
  const nextEmail = String(next.email || '').toLowerCase();
  if (priorEmail && nextEmail && priorEmail !== nextEmail) {
    next.dnsVerified = false;
    next.dnsVerifiedAt = null;
  }

  await setDocDirect(EMAIL_CHANNELS_COLLECTION, id, next);
  return redactChannelSecrets({
    ...next,
    forwardingDomain: getForwardingDomain(),
  });
}

export async function deleteEmailChannel(id: string): Promise<boolean> {
  const existing = await getDocDirect(EMAIL_CHANNELS_COLLECTION, id);
  if (!existing) return false;
  await deleteDocDirect(EMAIL_CHANNELS_COLLECTION, id);
  return true;
}

/**
 * Persist a channel test/verification result through the store so redaction,
 * domain backfill, and status transitions stay centralized. Driver error
 * messages must be redacted by the caller before passing them in.
 */
export async function updateEmailChannelStatus(
  id: string,
  patch: {
    status:
      | 'verified'
      | 'failed'
      | 'pending'
      | 'active'
      | 'disabled'
      | 'connected'
      | 'auth_error';
    lastTestOk: boolean;
    lastTestAt: string;
    lastError?: string | null;
  },
): Promise<EmailChannelConfig | null> {
  const existing = await getDocDirect(EMAIL_CHANNELS_COLLECTION, id);
  if (!existing) return null;

  const merged: EmailChannelConfig = {
    ...(existing as EmailChannelConfig),
    id,
    status: patch.status,
    lastTestOk: patch.lastTestOk,
    lastTestAt: patch.lastTestAt,
    lastError: patch.lastError ?? null,
    updatedAt: new Date().toISOString(),
  };

  await setDocDirect(EMAIL_CHANNELS_COLLECTION, id, merged);
  return redactChannelSecrets({
    ...merged,
    forwardingDomain: getForwardingDomain(),
  });
}

/** Resolve a channel for outbound From: selection (mailbox / support email / forwarding). */
export async function findChannelForOutbound(params: {
  mailbox?: string | null;
  supportEmail?: string | null;
}): Promise<EmailChannelConfig | null> {
  const docs = await getDocsDirect(EMAIL_CHANNELS_COLLECTION, []);
  const mailbox = (params.mailbox || '').toLowerCase().trim();
  const supportEmail = (params.supportEmail || '').toLowerCase().trim();

  for (const doc of docs) {
    const channel = { id: doc.id, ...doc } as EmailChannelConfig;
    const email = (channel.email || '').toLowerCase();
    const forwarding = (channel.forwardingAddress || '').toLowerCase();
    if (mailbox && (mailbox === email || mailbox === forwarding || mailbox === (channel.mailbox || '').toLowerCase())) {
      return channel;
    }
    if (supportEmail && supportEmail === email) {
      return channel;
    }
  }

  // Fallback: match by domain of mailbox against a verified channel email domain.
  const domain = mailbox.includes('@') ? mailbox.split('@')[1] : '';
  if (domain) {
    for (const doc of docs) {
      const channel = { id: doc.id, ...doc } as EmailChannelConfig;
      const emailDomain = (channel.email || '').toLowerCase().split('@')[1];
      if (channel.dnsVerified && emailDomain && emailDomain === domain) {
        return channel;
      }
    }
  }

  return null;
}

/** Resolve channel by forwarding alias or webhook secret (for inbound push). */
export async function findChannelForWebhook(params: {
  recipient?: string;
  webhookSecret?: string;
}): Promise<EmailChannelConfig | null> {
  const docs = await getDocsDirect(EMAIL_CHANNELS_COLLECTION, []);
  const recipient = (params.recipient || '').toLowerCase().trim();
  const secret = params.webhookSecret || '';

  for (const doc of docs) {
    const channel = { id: doc.id, ...doc } as EmailChannelConfig;
    if (secret && channel.webhookSecret && channel.webhookSecret === secret) {
      return channel;
    }
    if (recipient && channel.forwardingAddress) {
      const stored = channel.forwardingAddress.toLowerCase().trim();
      const normalized = normalizeForwardingAddress(stored, channel.id).toLowerCase().trim();
      if (stored === recipient || normalized === recipient) {
        return channel;
      }
    }
  }
  return null;
}
