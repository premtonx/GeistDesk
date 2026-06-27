/**
 * Fail the build if any source file uses the React namespace without a safe import.
 * Automatic JSX runtime does NOT inject React for React.useMemo / React.createElement.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, '..', 'src');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function hasReactImport(content) {
  return /^import\s+(?:type\s+)?(?:\*\s+as\s+React|React(?:\s*,|\s+from)|\{[^}]*\})\s+from\s+['"]react['"]/m.test(content);
}

const offenders = [];

for (const file of walk(srcRoot)) {
  const content = fs.readFileSync(file, 'utf8');
  if (!/\bReact\./.test(content)) continue;
  if (!hasReactImport(content)) {
    offenders.push(path.relative(srcRoot, file));
  }
}

if (offenders.length) {
  console.error('FATAL: React namespace used without React import in:');
  for (const file of offenders) console.error(`  - src/${file}`);
  process.exit(1);
}

console.log('OK: no unsafe React.* namespace usage detected.');
