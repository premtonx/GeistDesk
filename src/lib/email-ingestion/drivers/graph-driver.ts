/**
 * Driver A — Microsoft Graph API (client credentials, unread mail pull).
 */

import axios from 'axios';
import { extractEmailAddress } from '../../global-blacklist.js';
import { plainTextToEmailHtml } from '../../email-plain-html.js';
import type {
  EmailChannelConfig,
  EmailIngestionDriver,
  InboundAttachment,
  NormalizedInboundEmail,
} from '../types.js';

async function acquireGraphToken(channel: EmailChannelConfig): Promise<string> {
  const tenantId = channel.tenantId?.trim();
  const clientId = channel.clientId?.trim();
  const clientSecret = channel.clientSecret?.trim();
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Microsoft Graph requires tenantId, clientId, and clientSecret.');
  }

  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await axios.post(tokenUrl, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 20_000,
  });

  const token = res.data?.access_token;
  if (!token) throw new Error('Graph token response missing access_token.');
  return String(token);
}

function bufferToBase64(data: unknown): string | undefined {
  if (!data) return undefined;
  if (Buffer.isBuffer(data)) return data.toString('base64');
  if (typeof data === 'string') return data;
  return undefined;
}

export class MicrosoftGraphDriver implements EmailIngestionDriver {
  readonly id: string;
  readonly connectionType = 'microsoft_graph' as const;

  constructor(private readonly channel: EmailChannelConfig) {
    this.id = channel.id;
  }

  private mailbox(): string {
    return (this.channel.mailbox || this.channel.email || '').trim();
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const token = await acquireGraphToken(this.channel);
      const mailbox = this.mailbox();
      if (!mailbox) throw new Error('Target support email (mailbox) is required.');
      const headers = { Authorization: `Bearer ${token}` };

      // 1) Mail.Read — inbox reachable
      await axios.get(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/mailFolders/inbox`,
        { headers, timeout: 20_000 },
      );

      // 2) Mail.ReadWrite — create + delete a draft (proves write access for outbound prep)
      let draftOk = false;
      try {
        const draftRes = await axios.post(
          `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages`,
          {
            subject: '[GeistDesk] connection test — safe to delete',
            body: { contentType: 'Text', content: 'Automated Graph channel test.' },
            toRecipients: [{ emailAddress: { address: mailbox } }],
          },
          { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 20_000 },
        );
        const draftId = draftRes.data?.id;
        if (draftId) {
          await axios
            .delete(
              `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(draftId)}`,
              { headers, timeout: 15_000 },
            )
            .catch(() => undefined);
          draftOk = true;
        }
      } catch {
        draftOk = false;
      }

      if (!draftOk) {
        return {
          ok: false,
          message:
            `Inbox OK for ${mailbox}, but creating a draft failed. Grant application permission ` +
            `Mail.ReadWrite (+ admin consent) so replies can be prepared/sent.`,
        };
      }

      return {
        ok: true,
        message:
          `Microsoft Graph handshake OK for ${mailbox} (Mail.Read + Mail.ReadWrite). ` +
          `Ensure Mail.Send is also granted with admin consent for ticket replies.`,
      };
    } catch (err: any) {
      const detail =
        err?.response?.data?.error?.message ||
        err?.response?.data?.error_description ||
        err?.message ||
        'Graph connection failed';
      return { ok: false, message: String(detail) };
    }
  }

  async fetchUnreadEmails(): Promise<NormalizedInboundEmail[]> {
    const token = await acquireGraphToken(this.channel);
    const mailbox = this.mailbox();
    if (!mailbox) throw new Error('Target support email (mailbox) is required.');

    const listUrl =
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/mailFolders/inbox/messages` +
      `?$filter=isRead eq false&$top=25&$select=id,subject,body,from,hasAttachments,internetMessageId`;

    const listRes = await axios.get(listUrl, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30_000,
    });

    const messages: any[] = Array.isArray(listRes.data?.value) ? listRes.data.value : [];
    const normalized: NormalizedInboundEmail[] = [];

    for (const msg of messages) {
      const fromRaw =
        msg.from?.emailAddress?.address ||
        msg.from?.emailAddress?.name ||
        '';
      const fromName = String(msg.from?.emailAddress?.name || '').trim();
      const sender = extractEmailAddress(String(fromRaw)) || String(fromRaw);
      const subject = String(msg.subject || '(no subject)');
      const html =
        msg.body?.contentType === 'html'
          ? String(msg.body?.content || '')
          : plainTextToEmailHtml(String(msg.body?.content || ''));

      const attachments: InboundAttachment[] = [];
      if (msg.hasAttachments && msg.id) {
        try {
          const attRes = await axios.get(
            `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(msg.id)}/attachments`,
            {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 30_000,
            },
          );
          for (const att of attRes.data?.value || []) {
            if (att['@odata.type'] && String(att['@odata.type']).includes('itemAttachment')) {
              continue;
            }
            attachments.push({
              filename: att.name || 'attachment',
              contentType: att.contentType || 'application/octet-stream',
              size: Number(att.size) || 0,
              contentBase64: bufferToBase64(att.contentBytes),
              contentId: att.contentId,
            });
          }
        } catch (err) {
          console.warn('[graph-driver] attachment download failed', err);
        }
      }

      const orgId =
        this.channel.organizationId || this.channel.organization_id || undefined;

      normalized.push({
        sender,
        from_email: sender,
        from_name: fromName && !fromName.includes('@') ? fromName : undefined,
        subject,
        title: subject,
        html_content: html,
        text_content: msg.body?.contentType === 'text' ? String(msg.body?.content || '') : undefined,
        attachments,
        externalMessageId: msg.internetMessageId || msg.id,
        mailbox,
        source: 'microsoft_graph',
        organizationId: orgId || undefined,
        channelId: this.channel.id,
      });

      // Mark as read so subsequent polls skip it.
      try {
        await axios.patch(
          `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(msg.id)}`,
          { isRead: true },
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15_000,
          },
        );
      } catch (err) {
        console.warn('[graph-driver] mark-as-read failed', err);
      }
    }

    return normalized;
  }

  /**
   * Send an outbound message as the configured mailbox via application
   * permissions (`Mail.Send`). Used by ticket agent replies (Send As).
   */
  async sendMail(params: {
    to: string;
    subject: string;
    body: string;
    contentType?: 'HTML' | 'Text';
  }): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      const to = String(params.to || '').trim();
      if (!to || !to.includes('@')) {
        return { ok: false, message: 'Outbound recipient email is missing or invalid.' };
      }
      const token = await acquireGraphToken(this.channel);
      const mailbox = this.mailbox();
      if (!mailbox) {
        return {
          ok: false,
          message: 'Target support email (mailbox) is required for Graph sendMail.',
        };
      }

      const contentType = params.contentType || 'HTML';
      const content =
        contentType === 'HTML'
          ? plainTextToEmailHtml(String(params.body || ''))
          : String(params.body || '');

      await axios.post(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`,
        {
          message: {
            subject: String(params.subject || '(no subject)').slice(0, 998),
            body: { contentType, content },
            toRecipients: [{ emailAddress: { address: to } }],
          },
          saveToSentItems: true,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30_000,
        },
      );
      return { ok: true };
    } catch (err: any) {
      const detail =
        err?.response?.data?.error?.message ||
        err?.response?.data?.error_description ||
        err?.message ||
        'Graph sendMail failed';
      return { ok: false, message: String(detail) };
    }
  }
}
