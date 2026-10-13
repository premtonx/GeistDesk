/**
 * Minimal SMTP listener for MX ingestion (unauthenticated public MTAs).
 * Not an open relay: RCPT TO is gated by the caller before DATA is accepted.
 */

import net from 'node:net';
import { extractEmailAddress } from '../global-blacklist.js';

export interface SmtpEnvelopeMessage {
  mailFrom: string;
  rcptTo: string[];
  raw: Buffer;
  remoteAddress: string;
}

export interface InboundSmtpServerOptions {
  port: number;
  host?: string;
  hostname: string;
  maxBytes: number;
  maxConnections?: number;
  idleTimeoutMs?: number;
  isAllowedRecipient: (address: string) => boolean | Promise<boolean>;
  onMessage: (
    message: SmtpEnvelopeMessage,
  ) => Promise<{ ok: boolean; smtpCode?: number; smtpMessage?: string }>;
}

export interface InboundSmtpHandle {
  close: () => Promise<void>;
  port: number;
  hostname: string;
}

const DEFAULT_MAX_CONNECTIONS = 32;
const MAX_RCPT = 50;
const MAX_COMMAND_BYTES = 512;
const CRLF_DOT_CRLF = Buffer.from('\r\n.\r\n');
const LF_DOT_LF = Buffer.from('\n.\n');
const DOT_CRLF = Buffer.from('.\r\n');
const DOT_LF = Buffer.from('.\n');

type SessionPhase = 'command' | 'data';

class SmtpSession {
  private buf = Buffer.alloc(0);
  private phase: SessionPhase = 'command';
  private dataBuf = Buffer.alloc(0);
  private dataTooLarge = false;
  private greeted = false;
  private mailIssued = false;
  private mailFrom = '';
  private rcptTo: string[] = [];
  private closed = false;

  constructor(
    private readonly socket: net.Socket,
    private readonly opts: InboundSmtpServerOptions,
  ) {
    this.socket.setTimeout(opts.idleTimeoutMs ?? 120_000);
    this.socket.on('data', (chunk) => void this.onChunk(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    this.socket.on('timeout', () => {
      this.reply(421, '4.4.2 idle timeout');
      this.end();
    });
    this.socket.on('error', () => this.end());
    this.socket.on('close', () => {
      this.closed = true;
    });
    this.reply(220, `${opts.hostname} ESMTP GeistDesk inbound`);
  }

  private reply(code: number, text: string | string[]): void {
    if (this.closed || this.socket.destroyed) return;
    const lines = Array.isArray(text) ? text : [text];
    let payload = '';
    for (let i = 0; i < lines.length; i += 1) {
      const sep = i === lines.length - 1 ? ' ' : '-';
      payload += `${code}${sep}${lines[i]}\r\n`;
    }
    this.socket.write(payload);
  }

  private resetTransaction(): void {
    this.mailIssued = false;
    this.mailFrom = '';
    this.rcptTo = [];
    this.dataBuf = Buffer.alloc(0);
    this.dataTooLarge = false;
    this.phase = 'command';
  }

  private end(): void {
    if (this.closed) return;
    this.closed = true;
    this.socket.end();
  }

  private async onChunk(chunk: Buffer): Promise<void> {
    if (this.closed) return;
    if (this.phase === 'data') {
      await this.consumeData(chunk);
      return;
    }
    this.buf = Buffer.concat([this.buf, chunk]);
    if (this.buf.length > 64 * 1024) {
      this.reply(500, '5.5.3 command line too long');
      this.end();
      return;
    }
    await this.drainCommands();
  }

  private async drainCommands(): Promise<void> {
    while (this.phase === 'command' && !this.closed) {
      const idx = indexOfLineEnd(this.buf);
      if (!idx) break;
      const { end, skip } = idx;
      const line = this.buf.subarray(0, end).toString('utf8');
      this.buf = this.buf.subarray(end + skip);
      await this.handleCommand(line);
    }
  }

  private async consumeData(chunk: Buffer): Promise<void> {
    this.dataBuf = Buffer.concat([this.dataBuf, chunk]);
    if (this.dataBuf.length > this.opts.maxBytes + 1024) {
      this.dataTooLarge = true;
    }
    if (this.dataBuf.length > this.opts.maxBytes * 2) {
      this.reply(552, '5.3.4 message too large');
      this.resetTransaction();
      this.buf = Buffer.alloc(0);
      return;
    }
    const term = indexOfDataTerminator(this.dataBuf);
    if (!term) return;

    const rawStuffed = this.dataBuf.subarray(0, term.index);
    const remainder = this.dataBuf.subarray(term.index + term.length);
    this.phase = 'command';
    this.buf = remainder;

    if (this.dataTooLarge || rawStuffed.length > this.opts.maxBytes) {
      this.reply(552, '5.3.4 message too large');
      this.resetTransaction();
      await this.drainCommands();
      return;
    }

    const raw = unstuffDots(rawStuffed);
    try {
      const result = await this.opts.onMessage({
        mailFrom: this.mailFrom,
        rcptTo: [...this.rcptTo],
        raw,
        remoteAddress: this.socket.remoteAddress || '',
      });
      if (result.ok) {
        this.reply(250, '2.0.0 OK queued');
      } else {
        this.reply(result.smtpCode || 451, result.smtpMessage || '4.3.0 processing failed');
      }
    } catch {
      this.reply(451, '4.3.0 internal error');
    }
    this.resetTransaction();
    await this.drainCommands();
  }

  private async handleCommand(rawLine: string): Promise<void> {
    const line = rawLine.replace(/\r$/, '');
    if (Buffer.byteLength(line, 'utf8') > MAX_COMMAND_BYTES) {
      this.reply(500, '5.5.3 command line too long');
      return;
    }
    const verb = line.split(/\s+/, 1)[0]?.toUpperCase() || '';
    const rest = line.slice(verb.length).trim();

    switch (verb) {
      case 'HELO':
        this.greeted = true;
        this.resetTransaction();
        this.reply(250, this.opts.hostname);
        return;
      case 'EHLO':
        this.greeted = true;
        this.resetTransaction();
        this.reply(250, [
          `${this.opts.hostname} greets`,
          `SIZE ${this.opts.maxBytes}`,
          '8BITMIME',
          'ENHANCEDSTATUSCODES',
          'HELP',
        ]);
        return;
      case 'NOOP':
        this.reply(250, '2.0.0 OK');
        return;
      case 'RSET':
        this.resetTransaction();
        this.reply(250, '2.1.5 flushed');
        return;
      case 'QUIT':
        this.reply(221, '2.0.0 closing');
        this.end();
        return;
      case 'VRFY':
      case 'EXPN':
        this.reply(502, '5.5.1 command not implemented');
        return;
      case 'STARTTLS':
      case 'AUTH':
        this.reply(502, '5.7.0 authentication not offered');
        return;
      case 'HELP':
        this.reply(214, 'HELO EHLO MAIL RCPT DATA RSET NOOP QUIT');
        return;
      case 'MAIL':
        this.handleMailFrom(rest);
        return;
      case 'RCPT':
        await this.handleRcptTo(rest);
        return;
      case 'DATA':
        await this.handleData();
        return;
      default:
        this.reply(500, '5.5.1 unrecognized command');
    }
  }

  private handleMailFrom(rest: string): void {
    if (!this.greeted) {
      this.reply(503, '5.5.1 send HELO/EHLO first');
      return;
    }
    const match = rest.match(/^FROM:\s*(.*)$/i);
    if (!match) {
      this.reply(501, '5.5.4 syntax: MAIL FROM:<address>');
      return;
    }
    const sizeMatch = match[1].match(/SIZE=(\d+)/i);
    if (sizeMatch && Number(sizeMatch[1]) > this.opts.maxBytes) {
      this.reply(552, '5.3.4 message too large');
      return;
    }
    const addrPart = match[1].replace(/\s+SIZE=\d+/i, '').trim();
    this.mailFrom = addrPart === '<>' ? '' : extractEmailAddress(addrPart);
    this.rcptTo = [];
    this.mailIssued = true;
    this.reply(250, '2.1.0 sender OK');
  }

  private async handleRcptTo(rest: string): Promise<void> {
    if (!this.greeted) {
      this.reply(503, '5.5.1 send HELO/EHLO first');
      return;
    }
    if (!this.mailIssued) {
      this.reply(503, '5.5.1 send MAIL FROM first');
      return;
    }
    const match = rest.match(/^TO:\s*(.*)$/i);
    if (!match) {
      this.reply(501, '5.5.4 syntax: RCPT TO:<address>');
      return;
    }
    if (this.rcptTo.length >= MAX_RCPT) {
      this.reply(452, '4.5.3 too many recipients');
      return;
    }
    const address = extractEmailAddress(match[1]);
    if (!address) {
      this.reply(501, '5.1.3 malformed address');
      return;
    }
    let allowed = false;
    try {
      allowed = await this.opts.isAllowedRecipient(address);
    } catch {
      this.reply(451, '4.3.0 recipient lookup failed');
      return;
    }
    if (!allowed) {
      this.reply(550, '5.7.1 relay not permitted');
      return;
    }
    this.rcptTo.push(address);
    this.reply(250, '2.1.5 recipient OK');
  }

  private async handleData(): Promise<void> {
    if (!this.mailIssued || this.rcptTo.length === 0) {
      this.reply(503, '5.5.1 need MAIL FROM and RCPT TO first');
      return;
    }
    this.phase = 'data';
    this.dataBuf = this.buf;
    this.buf = Buffer.alloc(0);
    this.dataTooLarge = false;
    this.reply(354, 'end data with <CR><LF>.<CR><LF>');
    if (this.dataBuf.length) {
      await this.consumeData(Buffer.alloc(0));
    }
  }
}

function indexOfLineEnd(buf: Buffer): { end: number; skip: number } | null {
  for (let i = 0; i < buf.length; i += 1) {
    if (buf[i] === 0x0d && buf[i + 1] === 0x0a) return { end: i, skip: 2 };
    if (buf[i] === 0x0a) return { end: i, skip: 1 };
  }
  return null;
}

function indexOfDataTerminator(buf: Buffer): { index: number; length: number } | null {
  if (buf.length >= 3 && buf.subarray(0, 3).equals(DOT_CRLF)) {
    return { index: 0, length: 3 };
  }
  if (buf.length >= 2 && buf.subarray(0, 2).equals(DOT_LF)) {
    return { index: 0, length: 2 };
  }
  const crlf = buf.indexOf(CRLF_DOT_CRLF);
  if (crlf >= 0) return { index: crlf, length: 5 };
  const lf = buf.indexOf(LF_DOT_LF);
  if (lf >= 0) return { index: lf, length: 3 };
  return null;
}

function unstuffDots(buf: Buffer): Buffer {
  const text = buf.toString('binary');
  const lines = text.split(/\r\n|\n/);
  const out: string[] = [];
  for (const line of lines) {
    out.push(line.startsWith('.') ? line.slice(1) : line);
  }
  return Buffer.from(out.join('\r\n'), 'binary');
}

export function startInboundSmtpServer(opts: InboundSmtpServerOptions): Promise<InboundSmtpHandle> {
  const maxConnections = opts.maxConnections ?? DEFAULT_MAX_CONNECTIONS;
  let active = 0;

  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      if (active >= maxConnections) {
        socket.write(Buffer.from('421 4.3.2 too many connections\r\n'));
        socket.end();
        return;
      }
      active += 1;
      socket.on('close', () => {
        active -= 1;
      });
      new SmtpSession(socket, opts);
    });

    server.on('error', (err) => reject(err));
    server.listen(opts.port, opts.host || '0.0.0.0', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : opts.port;
      resolve({
        hostname: opts.hostname,
        port,
        close: () =>
          new Promise((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
          }),
      });
    });
  });
}
