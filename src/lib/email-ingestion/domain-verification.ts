/**
 * Domain ownership verification for support aliases (TXT + DKIM).
 * Prevents agents from sending From: support@customer.com until DNS proves control.
 */

import { generateKeyPairSync, randomBytes } from 'crypto';
import { promises as dns } from 'dns';
import type { EmailChannelConfig } from './types.js';

export const VERIFICATION_TXT_PREFIX = 'geist-verification=';
export const DEFAULT_DKIM_SELECTOR = 'geist';

export function mailForwardDomain(): string {
  return (
    process.env.INBOUND_MAIL_FORWARD_DOMAIN ||
    process.env.MAIL_FORWARD_DOMAIN ||
    'app.premtonx.cloud'
  ).trim();
}

export function generateVerificationToken(): string {
  return randomBytes(16).toString('hex');
}

export function buildSpfRecordValue(includeDomain = mailForwardDomain()): string {
  return `v=spf1 include:${includeDomain} ~all`;
}

export function buildDkimRecordName(selector = DEFAULT_DKIM_SELECTOR): string {
  return `${selector}._domainkey`;
}

/** Generate a DKIM public-key TXT value (private key stays with the mail dispatcher). */
export function generateDkimPublicRecord(selector = DEFAULT_DKIM_SELECTOR): {
  dkimRecordName: string;
  dkimRecordValue: string;
} {
  const fromEnv = (process.env.MAIL_DKIM_TXT_VALUE || '').trim();
  if (fromEnv) {
    return {
      dkimRecordName: buildDkimRecordName(
        (process.env.MAIL_DKIM_SELECTOR || selector).trim() || selector,
      ),
      dkimRecordValue: fromEnv,
    };
  }

  const { publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const p = publicKey
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '');

  return {
    dkimRecordName: buildDkimRecordName(selector),
    dkimRecordValue: `v=DKIM1; k=rsa; p=${p}`,
  };
}

export function extractEmailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const match = String(email).trim().toLowerCase().match(/@([^>\s]+)$/);
  if (!match?.[1]) return null;
  return match[1].replace(/\.$/, '');
}

export function verificationTxtValue(token: string): string {
  return `${VERIFICATION_TXT_PREFIX}${token}`;
}

async function resolveTxtFlat(hostname: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(hostname);
    return records.map((chunks) => chunks.join('').trim());
  } catch (err: any) {
    const code = err?.code || '';
    if (code === 'ENODATA' || code === 'ENOTFOUND' || code === 'ETIMEOUT' || code === 'ESERVFAIL') {
      return [];
    }
    throw err;
  }
}

function normalizeTxt(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

function txtIncludesExpected(records: string[], expected: string): boolean {
  const needle = normalizeTxt(expected);
  return records.some((record) => normalizeTxt(record).includes(needle));
}

export interface DomainDnsCheckResult {
  ok: boolean;
  domain: string;
  verificationTxtFound: boolean;
  dkimFound: boolean;
  spfFound: boolean;
  details: {
    verificationHost: string;
    verificationExpected: string;
    dkimHost: string;
    dkimExpected: string;
    spfExpected: string;
    apexTxt: string[];
    dkimTxt: string[];
  };
  message: string;
}

export async function checkDomainDnsRecords(channel: EmailChannelConfig): Promise<DomainDnsCheckResult> {
  const domain = extractEmailDomain(channel.email);
  if (!domain) {
    return {
      ok: false,
      domain: '',
      verificationTxtFound: false,
      dkimFound: false,
      spfFound: false,
      details: {
        verificationHost: '@',
        verificationExpected: '',
        dkimHost: '',
        dkimExpected: '',
        spfExpected: '',
        apexTxt: [],
        dkimTxt: [],
      },
      message: 'Channel has no valid support email domain to verify.',
    };
  }

  const token = (channel.verificationToken || '').trim();
  if (!token) {
    return {
      ok: false,
      domain,
      verificationTxtFound: false,
      dkimFound: false,
      spfFound: false,
      details: {
        verificationHost: '@',
        verificationExpected: '',
        dkimHost: channel.dkimRecordName || buildDkimRecordName(),
        dkimExpected: channel.dkimRecordValue || '',
        spfExpected: channel.spfRecordValue || buildSpfRecordValue(),
        apexTxt: [],
        dkimTxt: [],
      },
      message: 'Channel is missing a verification token. Re-save the channel to generate one.',
    };
  }

  const verificationExpected = verificationTxtValue(token);
  const dkimHostRelative = (channel.dkimRecordName || buildDkimRecordName()).replace(/\.$/, '');
  const dkimFqdn = dkimHostRelative.includes(domain)
    ? dkimHostRelative
    : `${dkimHostRelative}.${domain}`;
  const dkimExpected = (channel.dkimRecordValue || '').trim();
  const spfExpected = (channel.spfRecordValue || buildSpfRecordValue()).trim();

  const [apexTxt, dkimTxt] = await Promise.all([
    resolveTxtFlat(domain),
    resolveTxtFlat(dkimFqdn),
  ]);

  const verificationTxtFound = txtIncludesExpected(apexTxt, verificationExpected);
  const dkimFound = dkimExpected
    ? txtIncludesExpected(dkimTxt, dkimExpected)
    : dkimTxt.some((r) => /v=dkim1/i.test(r) && /p=/i.test(r));
  const spfFound = txtIncludesExpected(apexTxt, 'v=spf1');

  const ok = verificationTxtFound && dkimFound;
  let message: string;
  if (ok) {
    message = spfFound
      ? `Domain ${domain} verified (TXT + DKIM). SPF record detected.`
      : `Domain ${domain} verified (TXT + DKIM). Add SPF for better deliverability: ${spfExpected}`;
  } else if (!verificationTxtFound && !dkimFound) {
    message = `Missing verification TXT and DKIM records for ${domain}.`;
  } else if (!verificationTxtFound) {
    message = `Missing TXT record "${verificationExpected}" on ${domain}.`;
  } else {
    message = `Missing or mismatched DKIM TXT on ${dkimFqdn}.`;
  }

  return {
    ok,
    domain,
    verificationTxtFound,
    dkimFound,
    spfFound,
    details: {
      verificationHost: '@',
      verificationExpected,
      dkimHost: dkimHostRelative,
      dkimExpected,
      spfExpected,
      apexTxt,
      dkimTxt,
    },
    message,
  };
}

export function ensureDomainVerificationFields(
  channel: Partial<EmailChannelConfig>,
): Pick<
  EmailChannelConfig,
  | 'dnsVerified'
  | 'verificationToken'
  | 'dkimRecordName'
  | 'dkimRecordValue'
  | 'spfRecordValue'
> {
  const token = channel.verificationToken || generateVerificationToken();
  const dkim =
    channel.dkimRecordName && channel.dkimRecordValue
      ? {
          dkimRecordName: channel.dkimRecordName,
          dkimRecordValue: channel.dkimRecordValue,
        }
      : generateDkimPublicRecord();

  return {
    dnsVerified: Boolean(channel.dnsVerified),
    verificationToken: token,
    dkimRecordName: dkim.dkimRecordName,
    dkimRecordValue: dkim.dkimRecordValue,
    spfRecordValue: channel.spfRecordValue || buildSpfRecordValue(),
  };
}

export function buildVerifiedFromHeader(channel: EmailChannelConfig): string {
  const address = (channel.email || '').trim();
  const display = (channel.name || 'Support').trim().replace(/[\r\n"]/g, '');
  return `${display} <${address}>`;
}

export function buildSystemDefaultFromHeader(): string {
  const domain = mailForwardDomain();
  const address = (process.env.MAIL_FROM_ADDRESS || `noreply@${domain}`).trim();
  const display = (process.env.MAIL_FROM_NAME || 'GeistDesk Support').trim().replace(/[\r\n"]/g, '');
  return `${display} <${address}>`;
}
