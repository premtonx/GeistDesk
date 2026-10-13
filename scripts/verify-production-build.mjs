/**
 * Post-build gate: reject legacy bundles and known production crash signatures.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.join(__dirname, '..', 'dist');
const indexHtmlPath = path.join(distRoot, 'index.html');

const LEGACY_BROKEN_BUNDLE = 'index-PNcfVvbc.js';
const FORBIDDEN_SNIPPETS = [
  'Firebase initialized for project',
  'React is not defined',
  LEGACY_BROKEN_BUNDLE,
];

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

const bundleRel = bundleMatch[1];
const bundlePath = path.join(distRoot, 'assets', path.basename(bundleRel));

if (!fs.existsSync(bundlePath)) {
  console.error(`FATAL: Referenced bundle missing on disk: dist/${bundleRel}`);
  process.exit(1);
}

if (bundleRel.includes(LEGACY_BROKEN_BUNDLE)) {
  console.error(`FATAL: Legacy broken bundle still referenced: ${bundleRel}`);
  process.exit(1);
}

const bundleSource = fs.readFileSync(bundlePath, 'utf8');
for (const snippet of FORBIDDEN_SNIPPETS) {
  if (bundleSource.includes(snippet)) {
    console.error(`FATAL: Bundle contains forbidden production signature: "${snippet}"`);
    process.exit(1);
  }
}

const assetsDir = path.join(distRoot, 'assets');
const assetFiles = fs.readdirSync(assetsDir);
console.log(`OK: production bundle verified (${bundleRel}, ${assetFiles.length} assets).`);
