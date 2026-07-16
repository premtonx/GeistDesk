/**
 * Unified email ingestion types for Graph / IMAP / Webhook drivers.
 */

export type EmailConnectionType =
  | 'webhook'
  | 'imap_basic'
  | 'imap_oauth2'
  | 'microsoft_graph';

export interface InboundAttachment {
  filename: string;
  contentType: string;
  size: number;
  /** Base64 payload when persisted (size-capped by ingest pipeline). */
  contentBase64?: string;
  contentId?: string;
}

/** Native internal layout produced by every driver before ticket creation. */
export interface NormalizedInboundEmail {
  sender: string;
  from_email: string;
  subject: string;
  title: string;
  html_content: string;
  text_content?: string;
  attachments: InboundAttachment[];
  /** Optional provider message id for dedupe. */
  externalMessageId?: string;
  /** Channel / mailbox that received the mail. */
  mailbox?: string;
  /** Driver that produced this message. */
  source: EmailConnectionType | 'webhook';
  rawHeaders?: Record<string, string>;
}

export interface EmailIngestionDriver {
  readonly id: string;
  readonly connectionType: EmailConnectionType;
  /** Active-pull drivers implement this. Webhook driver returns []. */
  fetchUnreadEmails(): Promise<NormalizedInboundEmail[]>;
  /** Optional credential handshake used by "Verbindung testen". */
  testConnection?(): Promise<{ ok: boolean; message: string }>;
}

export interface EmailChannelConfig {
  id: string;
  name: string;
  email: string;
  group?: string;
  status: 'verified' | 'pending' | 'failed' | 'active' | 'disabled';
  connectionType: EmailConnectionType;
  enabled: boolean;
  isPrimary?: boolean;
  provider?: 'gmail' | 'outlook' | 'custom' | 'microsoft' | 'google';

  // Webhook / forwarding
  webhookSecret?: string | null;
  forwardingAddress?: string | null;

  /**
   * Domain ownership verification (support alias From: header).
   * When dnsVerified is true, agents may send as channel.email (e.g. support@domain.com).
   */
  dnsVerified?: boolean;
  verificationToken?: string | null;
  dkimRecordName?: string | null;
  dkimRecordValue?: string | null;
  spfRecordValue?: string | null;
  dnsVerifiedAt?: string | null;

  // IMAP — nullable so webhook / passive channels can omit server credentials
  imapHost?: string | null;
  imapPort?: number | string | null;
  imapUser?: string | null;
  imapPassword?: string | null;
  imapTls?: boolean | null;
  oauthClientId?: string | null;
  oauthClientSecret?: string | null;
  oauthTokenUrl?: string | null;
  oauthRefreshToken?: string | null;
  oauthScope?: string | null;

  // Microsoft Graph
  tenantId?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
  mailbox?: string | null;

  lastPolledAt?: string | null;
  lastError?: string | null;
  lastTestAt?: string | null;
  lastTestOk?: boolean | null;
  createdAt?: string;
  updatedAt?: string;
}

export const EMAIL_CHANNELS_COLLECTION = 'email_channels';
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB per file persisted
export const MAX_ATTACHMENTS_PER_MESSAGE = 10;
