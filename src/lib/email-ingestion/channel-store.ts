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

const SECRET_FIELDS = [
  'imapPassword',
  'oauthClientSecret',
  'clientSecret',
  'webhookSecret',
  'oauthRefreshToken',
] as const;

function forwardingDomain(): string {
  return (
    process.env.INBOUND_MAIL_FORWARD_DOMAIN ||
    process.env.MAIL_FORWARD_DOMAIN ||
    'app.premtonx.cloud'
  ).trim();
}

export function buildForwardingAddress(channelId: string): string {
  const slug = channelId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16).toLowerCase() || 'channel';
  return `ticket-${slug}@${forwardingDomain()}`;
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

export async function listEmailChannels(): Promise<EmailChannelConfig[]> {
  const docs = await getDocsDirect(EMAIL_CHANNELS_COLLECTION, []);
  return docs.map((doc: any) => redactChannelSecrets({ id: doc.id, ...doc }));
}

export async function getEmailChannel(
  id: string,
  opts?: { includeSecrets?: boolean },
): Promise<EmailChannelConfig | null> {
  const doc = await getDocDirect(EMAIL_CHANNELS_COLLECTION, id);
  if (!doc) return null;
  const channel = { id: doc.id, ...doc } as EmailChannelConfig;
  return opts?.includeSecrets ? channel : redactChannelSecrets(channel);
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
  const forwardingAddress = input.forwardingAddress || buildForwardingAddress(id);

  await updateDocDirect(EMAIL_CHANNELS_COLLECTION, id, {
    webhookSecret,
    forwardingAddress,
    updatedAt: now,
  });

  return redactChannelSecrets({
    id,
    ...created.data,
    webhookSecret,
    forwardingAddress,
  });
}

export async function updateEmailChannel(
  id: string,
  input: Partial<EmailChannelConfig>,
): Promise<EmailChannelConfig | null> {
  const existing = await getDocDirect(EMAIL_CHANNELS_COLLECTION, id);
  if (!existing) return null;

  const merged = mergeSecrets(input, existing as EmailChannelConfig);
  const now = new Date().toISOString();
  const next: EmailChannelConfig = {
    ...(existing as EmailChannelConfig),
    ...merged,
    id,
    updatedAt: now,
  };

  if (next.connectionType === 'webhook') {
    next.webhookSecret = next.webhookSecret || generateWebhookSecret();
    next.forwardingAddress = next.forwardingAddress || buildForwardingAddress(id);
    // Explicitly clear pull-driver fields so nulls persist (spread of undefined is a no-op).
    clearActivePullFields(next);
  }

  await setDocDirect(EMAIL_CHANNELS_COLLECTION, id, next);
  return redactChannelSecrets(next);
}

export async function deleteEmailChannel(id: string): Promise<boolean> {
  const existing = await getDocDirect(EMAIL_CHANNELS_COLLECTION, id);
  if (!existing) return false;
  await deleteDocDirect(EMAIL_CHANNELS_COLLECTION, id);
  return true;
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
    if (channel.connectionType !== 'webhook' && channel.connectionType) {
      // Still allow secret match for hybrid setups
    }
    if (secret && channel.webhookSecret && channel.webhookSecret === secret) {
      return channel;
    }
    if (
      recipient &&
      channel.forwardingAddress &&
      channel.forwardingAddress.toLowerCase() === recipient
    ) {
      return channel;
    }
  }
  return null;
}
