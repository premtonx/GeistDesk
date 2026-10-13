/**
 * Fail the build if the beta auto-admin bypass is reachable at runtime.
 *
 * The source hard-gates isBetaAutoAdminEnabled() to `false` when
 * import.meta.env.PROD is set (Vite inlines this at build time). When the gate
 * works, the production bundle contains:
 *   - NO `VITE_BETA_AUTO_ADMIN` env-flag reference, and
 *   - NO `applyBetaAdminSession` / `applyGuestAdminSession` auto-grant call
 *     (their payload-builder functions may survive as dead code; that is inert).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.join(__dirname, '..', 'dist');
const indexHtmlPath = path.join(distRoot, 'index.html');

if (!fs.existsSync(indexHtmlPath)) {
  console.error('FATAL: dist/index.html was not generated.');
  process.exit(1);
}

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const bundleMatch = indexHtml.match(/assets\/(index-[^"']+\.js)/);
if (!bundleMatch) {
  console.error('FATAL: Could not locate hashed JS bundle reference in dist/index.html');
  process.exit(1);
}

const bundlePath = path.join(distRoot, 'assets', path.basename(bundleMatch[1]));
if (!fs.existsSync(bundlePath)) {
  console.error(`FATAL: Referenced bundle missing on disk: dist/${path.basename(bundlePath)}`);
  process.exit(1);
}

const bundleSource = fs.readFileSync(bundlePath, 'utf8');

// The env flag and the auto-grant entry points are the actual reachable bypass.
// A production bundle must contain none of them.
const REACHABLE_BYPASS_SIGNATURES = [
  'VITE_BETA_AUTO_ADMIN',
  'applyBetaAdminSession',
  'applyGuestAdminSession',
];

const hits = REACHABLE_BYPASS_SIGNATURES.filter((sig) => bundleSource.includes(sig));

if (hits.length) {
  console.error('FATAL: Beta auto-admin bypass is reachable in the production bundle:');
  for (const hit of hits) console.error(`  - "${hit}"`);
  console.error('The bypass must be unreachable in production. Check src/lib/beta-admin-bypass.ts.');
  process.exit(1);
}

console.log('OK: beta auto-admin bypass is unreachable in the production bundle.');
