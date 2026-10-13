/**
 * Post-build gate: ensure dist/server.cjs can load without synchronous module-init crashes.
 * Catches broken createRequire(import.meta.url) patterns in the CJS esbuild output.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.join(__dirname, '..', 'dist');
const serverPath = path.join(distRoot, 'server.cjs');

if (!fs.existsSync(serverPath)) {
  console.error('FATAL: dist/server.cjs was not generated.');
  process.exit(1);
}

const source = fs.readFileSync(serverPath, 'utf8');

if (/createRequire\)\(import_meta\.url\)/.test(source)) {
  console.error(
    'FATAL: dist/server.cjs contains createRequire(import_meta.url) — this crashes in production CJS bundles.',
  );
  process.exit(1);
}

const probe = spawnSync(
  process.execPath,
  ['-e', `require(${JSON.stringify(serverPath)})`],
  {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      JWT_SECRET: 'ci-verify-jwt-secret-minimum-32-characters',
      VAULT_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef',
      DATABASE_URL: 'postgresql://ci:ci@127.0.0.1:1/ci_probe',
      PG_DATABASE_URL: 'postgresql://ci:ci@127.0.0.1:1/ci_probe',
    },
    encoding: 'utf8',
    timeout: 15000,
  },
);

if (probe.error) {
  console.error('FATAL: Could not execute server bundle probe:', probe.error.message);
  process.exit(1);
}

const combined = `${probe.stdout || ''}${probe.stderr || ''}`;
if (/ERR_INVALID_ARG_VALUE.*createRequire/i.test(combined)) {
  console.error('FATAL: server.cjs crashes on load due to invalid createRequire filename.');
  console.error(combined);
  process.exit(1);
}

if (/Received undefined/.test(combined) && /createRequire/i.test(combined)) {
  console.error('FATAL: server.cjs createRequire bootstrap is broken.');
  console.error(combined);
  process.exit(1);
}

console.log('OK: server.cjs module bootstrap verified (no synchronous load crash).');
