/**
 * Reproduces GeistExchange secret create against a running GeistDesk instance.
 *
 * Usage:
 *   node scripts/test-vault-secret-create.mjs \
 *     --base-url https://app.premtonx.cloud \
 *     --email premtonxh@gmail.com \
 *     --password 'ChangeMe_Admin#2026'
 */
import { split } from 'shamir-secret-sharing';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    const value = argv[i + 1];
    if (key && value) args[key] = value;
  }
  return args;
}

async function buildShares(secret) {
  const encoder = new TextEncoder();
  const uint8Shares = await split(encoder.encode(secret), 5, 3);
  return uint8Shares.map((share) => {
    const binary = Array.from(share)
      .map((b) => String.fromCharCode(b))
      .join('');
    return Buffer.from(binary, 'binary').toString('base64');
  });
}

async function main() {
  const {
    'base-url': baseUrl = 'https://app.premtonx.cloud',
    email = 'premtonxh@gmail.com',
    password = 'ChangeMe_Admin#2026',
  } = parseArgs(process.argv);

  const secret = 'TestSecret#2026';
  const splitShares = await buildShares(secret);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  console.log('1) Login...');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok) {
    throw new Error(`Login failed (${loginRes.status}): ${JSON.stringify(loginBody)}`);
  }
  const cookie = loginRes.headers.getSetCookie?.()?.join('; ') || '';
  console.log('   Login OK, cookies:', cookie ? 'present' : 'MISSING');

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(cookie ? { Cookie: cookie } : {}),
  };

  console.log('2) Create dropzone (control)...');
  const dropRes = await fetch(`${baseUrl}/api/vault/secrets`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      type: 'request',
      expirationType: 'time',
      expiresAt,
      maxViews: 1000,
      metadata: {
        vaultKind: 'dropzone_upload_bucket',
        requestName: 'CI probe dropzone',
        acceptedTypes: ['PNG'],
        maxSizeMb: 10,
      },
    }),
  });
  const dropBody = await dropRes.json().catch(() => ({}));
  console.log('   Dropzone:', dropRes.status, dropBody);

  console.log('3) Create secret (shares + content)...');
  const secretPayload = {
    type: 'secret',
    content: secret,
    shares: splitShares,
    threshold: 3,
    expirationType: 'quota',
    expiresAt,
    maxViews: 1,
    metadata: {
      isQuantumSafe: true,
      pqcLevel: 3,
      secretType: 'password',
      deliveryOption: 'copy_link',
      targetRecipient: 'internal',
      maxViews: 1,
      expirationPreset: '24h',
      shareViaEmail: false,
      recipientEmails: [],
      notifyOnView: false,
      ipRestrictionEnabled: false,
      passphraseEnabled: false,
      domainWhitelistEnabled: false,
      mfaRequired: false,
    },
  };

  const secretRes = await fetch(`${baseUrl}/api/vault/secrets`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(secretPayload),
  });
  const secretBody = await secretRes.json().catch(() => ({}));
  console.log('   Secret:', secretRes.status, JSON.stringify(secretBody, null, 2));

  if (!secretRes.ok) {
    process.exit(1);
  }

  console.log('4) Reveal secret...');
  const revealRes = await fetch(`${baseUrl}/api/vault/secrets/${secretBody.id}/reveal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-GeistDesk-Read-Intent': 'commit',
    },
    body: JSON.stringify({}),
  });
  const revealBody = await revealRes.json().catch(() => ({}));
  console.log('   Reveal:', revealRes.status, {
    hasContent: Boolean(revealBody.content),
    shareCount: revealBody.shares?.length ?? 0,
    burned: revealBody.burned,
  });

  console.log('PASS');
}

main().catch((err) => {
  console.error('FAIL:', err.message || err);
  process.exit(1);
});
