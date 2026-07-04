/**
 * Verifies dropzone post-upload lifecycle against a running GeistDesk deployment.
 *
 * Usage:
 *   node scripts/verify-dropzone-lifecycle.mjs \
 *     --base-url https://app.premtonx.cloud \
 *     --dropzone-id 734209f5-6d97-4f2c-bfd2-db5c267bc0ad \
 *     --email demo@geistdesk.com \
 *     --password GeistDeskDemo2026
 */
import { writeFileSync } from 'node:fs';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    const value = argv[i + 1];
    if (key && value) args[key] = value;
  }
  return args;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const {
    'base-url': baseUrl = 'https://app.premtonx.cloud',
    'dropzone-id': dropzoneId,
    email = 'demo@geistdesk.com',
    password = 'GeistDeskDemo2026',
  } = parseArgs(process.argv);

  if (!dropzoneId) {
    throw new Error('--dropzone-id is required');
  }

  const metadataRes = await fetch(`${baseUrl}/api/vault/secrets/${encodeURIComponent(dropzoneId)}`);
  assert(metadataRes.ok, `Metadata fetch failed (${metadataRes.status})`);
  const metadata = await metadataRes.json();

  assert(metadata.dropzone === true, 'Item is not a dropzone');
  assert((metadata.metadata?.uploadCount ?? 0) > 0, 'Dropzone metadata.uploadCount is not > 0');
  assert(Boolean(metadata.metadata?.filename), 'Dropzone metadata.filename is missing');

  console.log('OK metadata:', {
    id: metadata.id,
    uploadCount: metadata.metadata.uploadCount,
    filename: metadata.metadata.filename,
    viewCount: metadata.viewCount,
  });

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert(loginRes.ok, `Login failed (${loginRes.status})`);
  const { token } = await loginRes.json();
  assert(token, 'Login response missing token');

  const downloadRes = await fetch(
    `${baseUrl}/api/vault/dropzones/download?id=${encodeURIComponent(dropzoneId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  assert(downloadRes.ok, `Download failed (${downloadRes.status})`);

  const buffer = Buffer.from(await downloadRes.arrayBuffer());
  const disposition = downloadRes.headers.get('content-disposition') || '';
  const contentType = downloadRes.headers.get('content-type') || '';
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
  const filename = filenameMatch?.[1] || 'unknown.bin';

  assert(buffer.length > 0, 'Downloaded payload is empty');
  assert(
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47,
    'Downloaded payload is not a PNG file',
  );

  const outPath = `/tmp/verify-dropzone-${dropzoneId}.${filename.split('.').pop() || 'bin'}`;
  writeFileSync(outPath, buffer);

  console.log('OK download:', {
    filename,
    contentType,
    bytes: buffer.length,
    savedTo: outPath,
  });
  console.log('PASS: dropzone lifecycle verified');
}

main().catch((error) => {
  console.error('FAIL:', error.message || error);
  process.exit(1);
});
