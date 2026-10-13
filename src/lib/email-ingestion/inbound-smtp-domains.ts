/**
 * Recipient-domain allowlist for the embedded inbound SMTP listener.
 * Rejects relay attempts: MAIL is only accepted for configured inbound domains.
 */

import { emailDomain, extractEmailAddress } from '../global-blacklist.js';
import { mailForwardDomain } from './domain-verification.js';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function normalizeHostname(value: string | undefined | null): string {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (!raw || LOOPBACK.has(raw)) return '';
  try {
    if (raw.includes('://')) {
      const host = new URL(raw).hostname.toLowerCase();
      return LOOPBACK.has(host) ? '' : host;
    }
  } catch {
    /* not a URL */
  }
  return raw;
}

/**
 * Domains this appliance will accept RCPT TO for.
 * Always includes the configured inbound forwarding domain; extras come from
 * `INBOUND_SMTP_ACCEPT_DOMAINS` (comma-separated).
 */
export function listInboundSmtpAcceptDomains(): string[] {
  const extras = String(process.env.INBOUND_SMTP_ACCEPT_DOMAINS || '')
    .split(/[,;\s]+/)
    .map((part) => normalizeHostname(part))
    .filter(Boolean);

  const configured = [
    normalizeHostname(process.env.INBOUND_EMAIL_DOMAIN),
    normalizeHostname(process.env.INBOUND_MAIL_FORWARD_DOMAIN),
    normalizeHostname(process.env.MAIL_FORWARD_DOMAIN),
    normalizeHostname(mailForwardDomain()),
    ...extras,
  ].filter(Boolean);

  return [...new Set(configured)];
}

export function inboundSmtpHostname(): string {
  return (
    normalizeHostname(process.env.INBOUND_SMTP_HOSTNAME) ||
    normalizeHostname(process.env.INBOUND_EMAIL_DOMAIN) ||
    normalizeHostname(process.env.DOMAIN_NAME) ||
    mailForwardDomain() ||
    'inbound.local'
  );
}

export function isAllowedInboundSmtpRecipient(rawAddress: string): boolean {
  const address = extractEmailAddress(rawAddress);
  if (!address || !address.includes('@')) return false;
  const domain = emailDomain(address);
  if (!domain) return false;
  const allowed = listInboundSmtpAcceptDomains();
  return allowed.includes(domain);
}

export function parseInboundSmtpPort(raw: string | undefined, fallback = 25): number {
  const parsed = Number.parseInt(String(raw ?? fallback), 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) return fallback;
  return parsed;
}

export function parseInboundSmtpMaxBytes(raw: string | undefined): number {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 25 * 1024 * 1024;
  return parsed;
}

export function isInboundSmtpEnabled(): boolean {
  const flag = String(process.env.INBOUND_SMTP_ENABLED ?? 'true').trim().toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off' || flag === 'no') return false;
  return true;
}
