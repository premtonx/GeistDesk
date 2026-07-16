/**
 * Abstract mail ingestion provider factory.
 */

import type { EmailChannelConfig, EmailIngestionDriver } from './types.js';
import { MicrosoftGraphDriver } from './drivers/graph-driver.js';
import { ImapDriver } from './drivers/imap-driver.js';

/** Passive webhook channels do not poll; they wait for push. */
class WebhookNoopDriver implements EmailIngestionDriver {
  readonly id: string;
  readonly connectionType = 'webhook' as const;

  constructor(channel: EmailChannelConfig) {
    this.id = channel.id;
  }

  async fetchUnreadEmails() {
    return [];
  }

  async testConnection() {
    return {
      ok: true,
      message: 'Webhook channel is passive — no active poll. Use the forwarding address + webhook secret.',
    };
  }
}

export function createEmailIngestionDriver(
  channel: EmailChannelConfig,
): EmailIngestionDriver {
  switch (channel.connectionType) {
    case 'microsoft_graph':
      return new MicrosoftGraphDriver(channel);
    case 'imap_basic':
    case 'imap_oauth2':
      return new ImapDriver(channel);
    case 'webhook':
    default:
      return new WebhookNoopDriver(channel);
  }
}

export function isActivePullDriver(channel: EmailChannelConfig): boolean {
  return (
    channel.enabled !== false &&
    (channel.connectionType === 'microsoft_graph' ||
      channel.connectionType === 'imap_basic' ||
      channel.connectionType === 'imap_oauth2')
  );
}
