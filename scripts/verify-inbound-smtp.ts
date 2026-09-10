/**
 * Protocol + MIME + allowlist checks for the embedded inbound SMTP listener.
 * Does not require Postgres or a full app boot.
 */
import net from 'node:net';
import { startInboundSmtpServer } from '../src/lib/email-ingestion/inbound-smtp-server.ts';
import { parseRfc822ToNormalizedEmail } from '../src/lib/email-ingestion/smtp-mime-parser.ts';
import {
  isAllowedInboundSmtpRecipient,
  listInboundSmtpAcceptDomains,
} from '../src/lib/email-ingestion/inbound-smtp-domains.ts';
import { isOwnSupportAddressForChannel } from '../src/lib/email-ingestion/loop-guard.ts';
import { composeHelpForwardingAddress } from '../src/lib/email-forwarding-address.ts';
import { formatReplyRecipientLabel, resolveComposerFromAddress } from '../src/lib/ticket-reply-address.ts';
import { prepareInboundContent } from '../src/lib/email-ingestion/inbound-content.ts';

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

async function readReply(socket: net.Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = '';
    const onData = (chunk: Buffer) => {
      buf += chunk.toString('utf8');
      const lines = buf.split(/\r?\n/).filter((line) => line.length > 0);
      const last = lines[lines.length - 1];
      if (last && /^\d{3} /.test(last)) {
        socket.off('data', onData);
        socket.off('error', onErr);
        resolve(buf);
      }
    };
    const onErr = (err: Error) => reject(err);
    socket.on('data', onData);
    socket.on('error', onErr);
  });
}

async function smtpSession(
  port: number,
  commands: string[],
): Promise<string[]> {
  const socket = net.connect({ host: '127.0.0.1', port });
  const replies: string[] = [await readReply(socket)];
  for (const command of commands) {
    socket.write(command.endsWith('\r\n') ? command : `${command}\r\n`);
    replies.push(await readReply(socket));
  }
  socket.end();
  return replies;
}

function assertCode(replies: string[], index: number, code: string, label: string) {
  const reply = replies[index] || '';
  if (!reply.includes(code)) {
    fail(`${label}: expected ${code} in reply, got ${JSON.stringify(reply)}`);
  }
}

async function main() {
  process.env.INBOUND_EMAIL_DOMAIN = 'inbound.geistai.eu';
  process.env.INBOUND_SMTP_ACCEPT_DOMAINS = 'mail.example.test';

  const domains = listInboundSmtpAcceptDomains();
  if (!domains.includes('inbound.geistai.eu') || !domains.includes('mail.example.test')) {
    fail(`allowlist missing expected domains: ${domains.join(',')}`);
  }
  if (!isAllowedInboundSmtpRecipient('help-abc@inbound.geistai.eu')) {
    fail('expected inbound.geistai.eu recipient to be allowed');
  }
  if (isAllowedInboundSmtpRecipient('anyone@gmail.com')) {
    fail('gmail.com must not be an open relay target');
  }

  const preview = composeHelpForwardingAddress('user@gmail.com', 'inbound.geistai.eu');
  if (preview !== 'help-user@inbound.geistai.eu') {
    fail(`slug preview mismatch: ${preview}`);
  }

  const gmailTest = isOwnSupportAddressForChannel({
    sender: 'user@gmail.com',
    recipient: 'help-user@inbound.geistai.eu',
    systemFrom: 'noreply@inbound.geistai.eu',
    channel: {
      email: 'user@gmail.com',
      forwardingAddress: 'help-user@inbound.geistai.eu',
      mailbox: 'user@gmail.com',
      connectionType: 'webhook',
    },
  });
  if (gmailTest) fail('webhook test mail from channel.email to forwarding alias must not be dropped');

  const outboundLoop = isOwnSupportAddressForChannel({
    sender: 'noreply@inbound.geistai.eu',
    recipient: 'help-user@inbound.geistai.eu',
    systemFrom: 'noreply@inbound.geistai.eu',
    channel: {
      email: 'user@gmail.com',
      forwardingAddress: 'help-user@inbound.geistai.eu',
      connectionType: 'webhook',
    },
  });
  if (!outboundLoop) fail('MAIL_FROM_ADDRESS must still be treated as a loop');

  const imapLoop = isOwnSupportAddressForChannel({
    sender: 'support@company.com',
    recipient: 'support@company.com',
    channel: {
      email: 'support@company.com',
      mailbox: 'support@company.com',
      connectionType: 'imap_basic',
    },
  });
  if (!imapLoop) fail('IMAP self-send must still be treated as a loop');

  const rfc822 = Buffer.from(
    [
      'From: Alice <alice@example.com>',
      'To: help-abc@inbound.geistai.eu',
      'Subject: Printer jam',
      'Message-ID: <smtp-verify@example.com>',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'The 3rd floor printer is jammed.',
      '',
    ].join('\r\n'),
  );
  const parsed = await parseRfc822ToNormalizedEmail(rfc822, {
    mailFrom: 'alice@example.com',
    rcptTo: ['help-abc@inbound.geistai.eu'],
  });
  if (!parsed) fail('MIME parse returned null');
  if (parsed.sender !== 'alice@example.com') fail(`sender ${parsed.sender}`);
  if (parsed.subject !== 'Printer jam') fail(`subject ${parsed.subject}`);
  if (!parsed.text_content?.includes('printer')) fail('body missing');
  if (parsed.source !== 'smtp') fail(`source ${parsed.source}`);
  if (/<pre[\s>]/i.test(parsed.html_content || '')) fail('plaintext inbound HTML must not use <pre>');
  if (!/<p>/i.test(parsed.html_content || '')) fail('plaintext inbound HTML should use paragraphs');
  if (parsed.from_name !== 'Alice') fail(`from_name ${parsed.from_name}`);

  const prepared = prepareInboundContent({
    subject: 'Callback',
    title: 'Callback',
    html_content:
      '<p>Please call Jane at +1-555-010-1234 or jane.doe@example.com</p><script>alert(1)</script>',
    text_content: 'Please call Jane at +1-555-010-1234 or jane.doe@example.com',
  });
  if (prepared.html.includes('<script')) fail('stored HTML must still strip scripts');
  if (prepared.html.includes('[REDACTED')) fail('stored HTML must not be PII-redacted');
  if (prepared.textFallback.includes('[REDACTED')) fail('stored plaintext must not be PII-redacted');
  if (!prepared.textFallback.includes('jane.doe@example.com')) {
    fail('agent plaintext must keep the customer email');
  }
  if (!prepared.textFallback.includes('555-010-1234')) {
    fail('agent plaintext must keep the callback number');
  }
  if (!prepared.bodyForAi.includes('[REDACTED_EMAIL]')) fail('AI context must redact emails');
  if (!prepared.bodyForAi.includes('[REDACTED_PHONE]')) fail('AI context must redact phones');
  if (prepared.bodyForAi.includes('jane.doe@example.com')) fail('AI context leaked email');

  const toLabel = formatReplyRecipientLabel({
    customerName: 'Premton Xhafa',
    customerEmail: 'premtonx@gmail.com',
    customerId: 'premtonx@gmail.com',
  });
  if (toLabel.includes('@client.com')) fail(`recipient must not append @client.com: ${toLabel}`);
  if (toLabel !== 'Premton Xhafa <premtonx@gmail.com>') fail(`recipient label ${toLabel}`);

  const fromAlias = resolveComposerFromAddress({
    ticketMailbox: 'help-premtonx@inbound.geistai.eu',
    channels: [
      {
        enabled: true,
        forwardingAddress: 'help-premtonx@inbound.geistai.eu',
        email: 'premtonx@gmail.com',
      },
    ],
    mailFromAddress: 'support@geistdesk.support',
  });
  if (fromAlias !== 'help-premtonx@inbound.geistai.eu') {
    fail(`composer From should use channel forwardingAddress, got ${fromAlias}`);
  }

  const fromEnv = resolveComposerFromAddress({
    moduleSupportEmail: 'support@geistdesk.support',
    mailFromAddress: 'noreply@inbound.geistai.eu',
  });
  if (fromEnv !== 'noreply@inbound.geistai.eu') {
    fail(`composer From should fall back to MAIL_FROM_ADDRESS, got ${fromEnv}`);
  }

  const doubled = formatReplyRecipientLabel({
    customerName: 'premtonx',
    customerId: 'premtonx@gmail.com',
  });
  if (doubled.includes('@client.com')) fail(`customerId must not get @client.com: ${doubled}`);
  if (!doubled.includes('premtonx@gmail.com') || doubled.includes('gmail.com@')) {
    fail(`expected clean gmail address, got ${doubled}`);
  }

  let accepted: { mailFrom: string; rcptTo: string[] } | null = null;
  const server = await startInboundSmtpServer({
    port: 0,
    host: '127.0.0.1',
    hostname: 'inbound.geistai.eu',
    maxBytes: 256 * 1024,
    isAllowedRecipient: (address) => isAllowedInboundSmtpRecipient(address),
    onMessage: async (message) => {
      accepted = { mailFrom: message.mailFrom, rcptTo: message.rcptTo };
      return { ok: true };
    },
  });

  try {
    const relay = await smtpSession(server.port, [
      'EHLO test.local',
      'MAIL FROM:<spammer@evil.test>',
      'RCPT TO:<victim@gmail.com>',
    ]);
    assertCode(relay, 0, '220', 'banner');
    assertCode(relay, 1, '250', 'EHLO');
    assertCode(relay, 2, '250', 'MAIL FROM');
    assertCode(relay, 3, '550', 'open-relay RCPT');

    const ok = await smtpSession(server.port, [
      'EHLO test.local',
      'MAIL FROM:<alice@example.com>',
      'RCPT TO:<help-abc@inbound.geistai.eu>',
      'DATA',
      'From: Alice <alice@example.com>\r\nSubject: Hello\r\n\r\nBody\r\n.',
      'QUIT',
    ]);
    assertCode(ok, 3, '250', 'allowed RCPT');
    assertCode(ok, 4, '354', 'DATA prompt');
    assertCode(ok, 5, '250', 'DATA accepted');
    if (!accepted) fail('onMessage was not called');
    if (accepted.rcptTo[0] !== 'help-abc@inbound.geistai.eu') {
      fail(`envelope rcpt ${accepted.rcptTo.join(',')}`);
    }
  } finally {
    await server.close();
  }

  console.log('OK: inbound SMTP allowlist, MIME parse, and protocol checks passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
