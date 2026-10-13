/**
 * Smoke test: GeistVault /credentials must render without crashing when
 * useLiveQuery folder data is still undefined on first paint.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { setTimeout as sleep } from 'node:timers/promises';

const PREVIEW_PORT = 4173;
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`;

const mockUser = {
  uid: 'vault-test-user',
  email: 'vault.test@geistdesk.local',
  displayName: 'Vault Tester',
  photoURL: null,
  emailVerified: true,
  isAnonymous: false,
};

async function waitForServer(url, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await sleep(500);
  }
  throw new Error(`Preview server did not start at ${url}`);
}

async function main() {
  const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT)], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  let previewLog = '';
  preview.stdout?.on('data', (chunk) => {
    previewLog += chunk.toString();
  });
  preview.stderr?.on('data', (chunk) => {
    previewLog += chunk.toString();
  });

  let browser;
  try {
    await waitForServer(PREVIEW_URL);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        pageErrors.push(msg.text());
      }
    });

    await page.addInitScript(({ user, token }) => {
      localStorage.setItem('geistdesk_auth_user', JSON.stringify(user));
      localStorage.setItem('geistdesk_token', token);
    }, { user: mockUser, token: 'vault-smoke-test-token' });

    await page.goto(`${PREVIEW_URL}/credentials`, { waitUntil: 'networkidle', timeout: 60000 });

    // Auto-unlock runs on mount; allow Argon2 + Dexie seed to finish.
    await page.waitForFunction(() => {
      const text = document.body?.innerText || '';
      return (
        text.includes('Alle Einträge') ||
        text.includes('Ordner erstellen') ||
        text.includes('Unlock GeistVault') ||
        text.includes('Master Password')
      );
    }, { timeout: 45000 });

    const bodyText = await page.locator('body').innerText();
    const hasUnlockUi = bodyText.includes('Unlock GeistVault') || bodyText.includes('Master Password');
    const hasVaultUi =
      bodyText.includes('Ordner erstellen') ||
      bodyText.includes('Alle Einträge') ||
      bodyText.includes('Personal Vault');

    const filterCrash = pageErrors.some((err) => err.includes("Cannot read properties of undefined (reading 'filter')"));

    if (filterCrash) {
      throw new Error(`Vault page crashed with filter error:\n${pageErrors.join('\n')}`);
    }

    if (!hasVaultUi && !hasUnlockUi) {
      throw new Error(`Vault UI not detected. Page errors:\n${pageErrors.join('\n')}\nBody:\n${bodyText.slice(0, 500)}`);
    }

    console.log('PASS: GeistVault /credentials rendered without filter crash.');
    console.log(`Vault UI markers: unlock=${hasUnlockUi}, main=${hasVaultUi}`);
    if (pageErrors.length > 0) {
      console.log('Non-fatal console errors:', pageErrors.slice(0, 5).join('\n'));
    }
  } finally {
    if (browser) await browser.close();
    preview.kill('SIGTERM');
    await sleep(300);
    if (preview.exitCode === null) preview.kill('SIGKILL');
  }
}

main().catch((err) => {
  console.error('FAIL:', err.message || err);
  process.exit(1);
});
