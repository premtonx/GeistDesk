/**
 * Converts React.* namespace usage to named hook/API imports so production
 * bundles never throw "React is not defined" when the JSX runtime is automatic.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, '..', 'src');

const HOOK_MAP = {
  useMemo: 'useMemo',
  useState: 'useState',
  useEffect: 'useEffect',
  useCallback: 'useCallback',
  useRef: 'useRef',
  useContext: 'useContext',
  useReducer: 'useReducer',
  useLayoutEffect: 'useLayoutEffect',
  useId: 'useId',
  forwardRef: 'forwardRef',
  createElement: 'createElement',
  Fragment: 'Fragment',
  memo: 'memo',
  lazy: 'lazy',
  Suspense: 'Suspense',
};

const TYPE_MAP = {
  ReactNode: 'ReactNode',
  FC: 'FC',
  ComponentProps: 'ComponentProps',
  ComponentPropsWithoutRef: 'ComponentPropsWithoutRef',
  ElementRef: 'ElementRef',
  HTMLAttributes: 'HTMLAttributes',
  CSSProperties: 'CSSProperties',
  FormEvent: 'FormEvent',
  ChangeEvent: 'ChangeEvent',
  MouseEvent: 'MouseEvent',
  KeyboardEvent: 'KeyboardEvent',
};

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function parseExistingReactImport(content) {
  const match = content.match(
    /^import\s+(type\s+)?(?:\*\s+as\s+React|\{([^}]+)\}|React(?:\s*,\s*\{([^}]+)\})?)\s+from\s+['"]react['"];?\s*$/m,
  );
  if (!match) return { named: new Set(), hasDefault: false, hasNamespace: false, isTypeOnly: false };

  if (match[0].includes('* as React')) {
    return { named: new Set(), hasDefault: false, hasNamespace: true, isTypeOnly: !!match[1] };
  }
  if (match[2]) {
    const names = match[2]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim());
    return { named: new Set(names), hasDefault: false, hasNamespace: false, isTypeOnly: !!match[1] };
  }
  const named = match[3]
    ? match[3]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim())
    : [];
  return { named: new Set(named), hasDefault: true, hasNamespace: false, isTypeOnly: false };
}

function collectNeeded(content) {
  const runtime = new Set();
  const types = new Set();

  for (const [from, to] of Object.entries(HOOK_MAP)) {
    const re = new RegExp(`\\bReact\\.${from}\\b`, 'g');
    if (re.test(content)) runtime.add(to);
  }

  for (const [from, to] of Object.entries(TYPE_MAP)) {
    const re = new RegExp(`\\bReact\\.${from}\\b`, 'g');
    if (re.test(content)) types.add(to);
  }

  return { runtime, types };
}

function replaceReactNamespace(content) {
  let next = content;
  for (const [from, to] of Object.entries(HOOK_MAP)) {
    next = next.replace(new RegExp(`\\bReact\\.${from}\\b`, 'g'), to);
  }
  for (const [from, to] of Object.entries(TYPE_MAP)) {
    next = next.replace(new RegExp(`\\bReact\\.${from}\\b`, 'g'), to);
  }
  return next;
}

function buildReactImport(existing, runtime, types) {
  const named = new Set([...existing.named, ...runtime]);
  const typeNames = new Set(types);

  for (const t of typeNames) named.delete(t);

  const valueParts = [...named].sort();
  const typeParts = [...typeNames].sort().map((t) => `type ${t}`);

  if (valueParts.length === 0 && typeParts.length === 0) return null;

  const chunks = [];
  if (valueParts.length) chunks.push(valueParts.join(', '));
  if (typeParts.length) chunks.push(typeParts.join(', '));
  return `import { ${chunks.join(', ')} } from 'react';`;
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  if (!/\bReact\./.test(original)) return false;

  const existing = parseExistingReactImport(original);
  let content = replaceReactNamespace(original);
  const { runtime, types } = collectNeeded(original);

  const newImport = buildReactImport(existing, runtime, types);
  const importRe =
    /^import\s+(?:type\s+)?(?:\*\s+as\s+React|\{[^}]+\}|React(?:\s*,\s*\{[^}]+\})?)\s+from\s+['"]react['"];?\s*\n/m;

  if (importRe.test(content)) {
    if (newImport) content = content.replace(importRe, `${newImport}\n`);
    else content = content.replace(importRe, '');
  } else if (newImport) {
    content = `${newImport}\n${content}`;
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  return false;
}

let changed = 0;
for (const file of walk(srcRoot)) {
  if (processFile(file)) {
    changed += 1;
    console.log('updated', path.relative(srcRoot, file));
  }
}
console.log(`Done. Updated ${changed} files.`);
