/**
 * Driver B — IMAP with legacy password or OAuth2 (XOAUTH2) authentication.
 */

import { createRequire } from 'module';
import { simpleParser } from 'mailparser';
import { extractEmailAddress } from '../../global-blacklist.js';
import type {
  EmailChannelConfig,
  EmailIngestionDriver,
  InboundAttachment,
  NormalizedInboundEmail,
} from '../types.js';

const require = createRequire(
  typeof import.meta !== 'undefined' && import.meta.url
    ? import.meta.url
    : typeof __filename !== 'undefined'
      ? __filename
      : process.cwd(),
);
// imap-simple is CommonJS; load via createRequire for esbuild/CJS interop.
const imaps = require('imap-simple') as {
  connect: (options: any) => Promise<any>;
  getParts: (struct: any) => any[];
};

async function fetchOAuthAccessToken(channel: EmailChannelConfig): Promise<string> {
  const clientId = channel.oauthClientId?.trim();
  const clientSecret = channel.oauthClientSecret?.trim();
  const tokenUrl = channel.oauthTokenUrl?.trim();
  if (!clientId || !clientSecret || !tokenUrl) {
    throw new Error('IMAP OAuth2 requires oauthClientId, oauthClientSecret, and oauthTokenUrl.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: channel.oauthRefreshToken ? 'refresh_token' : 'client_credentials',
  });
  if (channel.oauthRefreshToken) {
    params.set('refresh_token', channel.oauthRefreshToken);
  }
  if (channel.oauthScope) {
    params.set('scope', channel.oauthScope);
  } else if (!channel.oauthRefreshToken) {
    params.set('scope', 'https://outlook.office365.com/.default');
  }

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`OAuth token exchange failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('OAuth token response missing access_token.');
  return data.access_token;
}

function buildXoauth2Token(user: string, accessToken: string): string {
  const authString = [`user=${user}`, `auth=Bearer ${accessToken}`, '', ''].join('\x01');
  return Buffer.from(authString).toString('base64');
}

async function connectImap(channel: EmailChannelConfig): Promise<any> {
  const host = channel.imapHost?.trim();
  const user = (channel.imapUser || channel.email || '').trim();
  const port = Number(channel.imapPort || 993);
  const tls = channel.imapTls !== false;
  if (!host || !user) {
    throw new Error('IMAP requires host and email/user.');
  }

  const config: any = {
    imap: {
      user,
      host,
      port,
      tls,
      authTimeout: 20_000,
      tlsOptions: { rejectUnauthorized: process.env.IMAP_TLS_INSECURE === 'true' ? false : true },
    },
  };

  if (channel.connectionType === 'imap_oauth2') {
    const accessToken = await fetchOAuthAccessToken(channel);
    config.imap.xoauth2 = buildXoauth2Token(user, accessToken);
    // Some servers reject password when xoauth2 is set; leave password unset.
  } else {
    if (!channel.imapPassword) {
      throw new Error('IMAP (Standard) requires a password.');
    }
    config.imap.password = channel.imapPassword;
  }

  return imaps.connect(config);
}

export class ImapDriver implements EmailIngestionDriver {
  readonly id: string;
  readonly connectionType: 'imap_basic' | 'imap_oauth2';

  constructor(private readonly channel: EmailChannelConfig) {
    this.id = channel.id;
    this.connectionType =
      channel.connectionType === 'imap_oauth2' ? 'imap_oauth2' : 'imap_basic';
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    let connection: any;
    try {
      connection = await connectImap(this.channel);
      await connection.openBox('INBOX');
      return {
        ok: true,
        message: `IMAP handshake OK (${this.connectionType}) for ${this.channel.imapUser || this.channel.email}`,
      };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'IMAP connection failed' };
    } finally {
      try {
        connection?.end?.();
      } catch {
        /* ignore */
      }
    }
  }

  async fetchUnreadEmails(): Promise<NormalizedInboundEmail[]> {
    let connection: any;
    try {
      connection = await connectImap(this.channel);
      await connection.openBox('INBOX');

      const searchCriteria = ['UNSEEN'];
      const fetchOptions = {
        bodies: [''],
        markSeen: true,
        struct: true,
      };

      const results = await connection.search(searchCriteria, fetchOptions);
      const normalized: NormalizedInboundEmail[] = [];

      for (const item of results || []) {
        const all = item.parts?.find((p: any) => p.which === '');
        const raw = all?.body;
        if (!raw) continue;

        const parsed = await simpleParser(raw);
        const fromText =
          parsed.from?.value?.[0]?.address ||
          parsed.from?.text ||
          '';
        const sender = extractEmailAddress(String(fromText)) || String(fromText);
        const subject = String(parsed.subject || '(no subject)');
        const html =
          typeof parsed.html === 'string' && parsed.html
            ? parsed.html
            : `<pre>${String(parsed.text || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')}</pre>`;

        const attachments: InboundAttachment[] = [];
        for (const att of parsed.attachments || []) {
          attachments.push({
            filename: att.filename || 'attachment',
            contentType: att.contentType || 'application/octet-stream',
            size: att.size || (att.content ? att.content.length : 0),
            contentBase64: att.content ? Buffer.from(att.content).toString('base64') : undefined,
            contentId: att.contentId,
          });
        }

        normalized.push({
          sender,
          from_email: sender,
          subject,
          title: subject,
          html_content: html,
          text_content: parsed.text || undefined,
          attachments,
          externalMessageId: parsed.messageId || undefined,
          mailbox: this.channel.email,
          source: this.connectionType,
          rawHeaders: {
            'auto-submitted': String(parsed.headers?.get?.('auto-submitted') || ''),
            'x-autoreply': String(parsed.headers?.get?.('x-autoreply') || ''),
            'x-auto-response-suppress': String(parsed.headers?.get?.('x-auto-response-suppress') || ''),
            precedence: String(parsed.headers?.get?.('precedence') || ''),
            'list-unsubscribe': String(parsed.headers?.get?.('list-unsubscribe') || ''),
          },
        });
      }

      return normalized;
    } finally {
      try {
        connection?.end?.();
      } catch {
        /* ignore */
      }
    }
  }
}
