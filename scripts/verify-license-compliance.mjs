/**
 * Open-source compliance gate: LICENSE, README notice, and PII/address audit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const licensePath = path.join(root, 'LICENSE');
if (!fs.existsSync(licensePath)) {
  console.error('FATAL: Missing root LICENSE file.');
  process.exit(1);
}

const license = read('LICENSE');
const requiredLicenseMarkers = [
  'GNU AFFERO GENERAL PUBLIC LICENSE',
  'Version 3, 19 November 2007',
  'Copyright (C) 2026 Premton Xhafa',
  'GeistDesk is free software: you can redistribute it and/or modify',
];

for (const marker of requiredLicenseMarkers) {
  if (!license.includes(marker)) {
    console.error(`FATAL: LICENSE missing required marker: ${marker}`);
    process.exit(1);
  }
}

const readme = read('README.md');
if (!/##\s+License/i.test(readme)) {
  console.error('FATAL: README.md missing ## License section.');
  process.exit(1);
}
if (!readme.includes('AGPL-3.0') || !readme.includes('Copyright (C) 2026 Premton Xhafa')) {
  console.error('FATAL: README.md License section missing AGPL-3.0 or copyright notice.');
  process.exit(1);
}

/** Scan tracked project files for personal home-address patterns (not demo CRM fixtures). */
const scanRoots = ['README.md', 'LICENSE', 'package.json', 'FEATURES_MANIFEST.md'];
const homeAddressPattern =
  /\b(?:home\s+address|residential\s+address|\d{1,5}\s+[A-Za-z0-9.'-]+\s+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Lane|Ln\.?|Drive|Dr\.?|Boulevard|Blvd\.?))\b/i;

const personalAddressDenylist = [
  /premton\s+xhafa[\s\S]{0,80}(?:street|avenue|road|drive|lane|blvd)/i,
];

for (const rel of scanRoots) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) continue;
  const content = fs.readFileSync(full, 'utf8');
  if (homeAddressPattern.test(content)) {
    console.error(`FATAL: Possible physical address detected in ${rel}`);
    process.exit(1);
  }
  for (const rule of personalAddressDenylist) {
    if (rule.test(content)) {
      console.error(`FATAL: Personal address pattern detected in ${rel}`);
      process.exit(1);
    }
  }
}

console.log('OK: AGPL-3.0 LICENSE, README notice, and address audit passed.');
