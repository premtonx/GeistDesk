/**
 * Fail the build if any API route can leak a raw error message to clients.
 *
 * Scans src/routes/*.ts and server.ts for the common leak patterns:
 *   - { error: err.message } / { error: error.message } / { error: e.message }
 *   - { error: err } (bare error object/string in a response)
 *   - details: error.message / details: err.message
 *
 * Known safe exceptions:
 *   - onboardingRoutes.ts: deliberate domain errors (OnboardingAdminExistsError,
 *     OnboardingAlreadyCompleteError) with curated messages.
 *   - Handlers that pass the value through safeErrorMessage(...) are allowed.
 *   - { error: err } in `catch` where err is a zod/validation issue is checked
 *     separately and only flagged when it is a variable named err/error/e.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

const scanTargets = [
  path.join(repoRoot, 'src', 'routes'),
  path.join(repoRoot, 'server.ts'),
];

const SAFE_LEAK_PATTERNS = [
  // { error: err.message } / { error: error.message } / { error: e.message }
  /\b(error|details)\s*:\s*(err|error|e)\.message/g,
  // { error: err } / { error: error } bare in a response object
  /\b(error|details)\s*:\s*(err|error|e)(?=\s*[,}])/g,
  // details: error.message || String(error) style
  /\bdetails\s*:\s*(err|error|e)\.message\s*\|\|\s*String\(/g,
];

// Files where curated domain-error messages are intentionally returned as-is.
const ALLOWLISTED_FILES = new Set(['onboardingRoutes.ts']);

const offenders = [];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = [...walk(scanTargets[0])];
if (fs.existsSync(scanTargets[1])) files.push(scanTargets[1]);

for (const file of files) {
  const rel = path.relative(repoRoot, file);
  const base = path.basename(file);
  if (ALLOWLISTED_FILES.has(base)) continue;

  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const re of SAFE_LEAK_PATTERNS) {
      re.lastIndex = 0;
      const match = re.exec(line);
      if (!match) continue;
      // Skip if this line already routes through safeErrorMessage.
      if (/safeErrorMessage\s*\(/.test(line)) continue;
      offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      break;
    }
  }
}

if (offenders.length) {
  console.error('FATAL: Raw error messages may leak to clients:');
  for (const o of offenders.slice(0, 25)) console.error(`  - ${o}`);
  console.error('Wrap error responses with safeErrorMessage() or fixed strings.');
  process.exit(1);
}

console.log('OK: no raw error-message leaks detected in route sources.');
