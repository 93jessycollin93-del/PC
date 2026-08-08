/**
 * Drives the built shell in a real browser against a live eye-hostd — the
 * same pair the booted image runs, so this exercises the host VFS backend
 * rather than the localStorage fallback.
 *
 * This exists because it caught something a unit test would not have. Windows
 * focus on pointerdown; when focusing also reordered the DOM, the browser
 * stopped delivering the subsequent `click`, and Minimize on an unfocused
 * window silently did nothing. Only a real browser dispatching a real gesture
 * shows that.
 *
 * Usage:
 *   npm run build
 *   node test/browser-smoke.mjs            # starts its own hostd
 *   BASE=http://127.0.0.1:7788 node test/browser-smoke.mjs   # use a running one
 *
 * Needs Playwright's chromium. If the sandbox already ships one, point at it:
 *   PLAYWRIGHT_CHROMIUM=/path/to/chrome node test/browser-smoke.mjs
 *
 * Playwright is deliberately not in package.json: it would be pulled on every
 * `make image`, and its postinstall downloads a browser the image build has no
 * use for. Install it when you want to run this.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'This test needs Playwright:\n' +
      '  npm install --no-save playwright && npx playwright install chromium\n' +
      'Already have a chromium? Set PLAYWRIGHT_CHROMIUM to its path.',
  );
  process.exit(2);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const SHELL_DIR = resolve(HERE, '..');
const PROJECT = resolve(SHELL_DIR, '..');
const PORT = Number(process.env.PORT ?? 7799);
const BASE = process.env.BASE ?? `http://127.0.0.1:${PORT}`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

let hostd = null;
let filesRoot = null;

// Start a host agent unless BASE points at one already running.
if (!process.env.BASE) {
  filesRoot = mkdtempSync(join(tmpdir(), 'eye-vfs-'));
  hostd = spawn(
    'python3',
    [join(PROJECT, 'image/overlay/opt/eye-os/bin/eye-hostd')],
    {
      env: {
        ...process.env,
        EYE_STATIC: join(SHELL_DIR, 'dist'),
        EYE_FILES: filesRoot,
        EYE_PORT: String(PORT),
      },
      stdio: 'ignore',
    },
  );
  // Poll rather than sleep — the agent binds in well under a second, and a
  // fixed wait is either wasted time or a flake depending on the machine.
  for (let i = 0; i < 50; i++) {
    try {
      const response = await fetch(`${BASE}/api/fs/health`);
      if (response.ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

const cleanup = () => {
  hostd?.kill();
  if (filesRoot) rmSync(filesRoot, { recursive: true, force: true });
};

const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
  args: ['--no-sandbox'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // A 404 from /api/fs/read is how "this file does not exist" is spelled,
    // and first boot reads three files that legitimately do not exist yet.
    if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) {
      errors.push(m.text());
    }
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.desktop', { timeout: 15000 });
  check('desktop renders', true);
  check('boot splash removed', (await page.locator('#boot-splash').count()) === 0);

  const icons = await page.locator('.icon').count();
  check('every registered app has an icon', icons === 5, `found ${icons}`);

  // The VFS probe is the seam that makes the shell portable; assert it picked
  // the host backend rather than silently falling back to localStorage.
  await page.click('.taskbar__start');
  await page.waitForSelector('.launcher');
  await page.click('.launcher__item:has-text("System Info")');
  await page.waitForSelector('.sysinfo', { timeout: 15000 });
  const backend = await page
    .locator('.sysinfo__table tr', { hasText: 'Storage backend' })
    .locator('td')
    .innerText();
  check('host filesystem backend won the probe', backend.includes('host filesystem'), backend);

  await page.click('.taskbar__start');
  await page.click('.launcher__item:has-text("Terminal")');
  await page.waitForSelector('.term__input', { timeout: 15000 });
  await page.fill('.term__input', 'write /home/smoke.txt written by the smoke test');
  await page.press('.term__input', 'Enter');
  await page.waitForTimeout(600);
  check(
    'terminal wrote through the VFS',
    (await page.locator('.term__scroll').innerText()).includes('wrote'),
  );

  // Files and Terminal share a VFS and a bus and import neither each other
  // nor any common app module — this is what proves it at runtime.
  await page.click('.taskbar__start');
  await page.click('.launcher__item:has-text("Files")');
  await page.waitForSelector('.files', { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.click('.files__open:has-text("home")');
  await page.waitForTimeout(500);
  check(
    'Files sees what Terminal wrote',
    (await page.locator('.files__list').innerText()).includes('smoke.txt'),
  );

  // The regression this file exists for: Minimize on a window that is not
  // currently focused must work on the first click.
  const unfocused = page.locator('.window:has(.window__title:text-is("Terminal"))');
  await unfocused.locator('.window__btn[aria-label="Minimize"]').click();
  await page.waitForTimeout(400);
  check('minimize works on an unfocused window', (await page.locator('.window:visible').count()) === 2);

  await page.click('.taskbar__task:has-text("Terminal")');
  await page.waitForTimeout(400);
  check('taskbar restores a minimized window', (await page.locator('.window:visible').count()) === 3);

  await page.click('.taskbar__task:has-text("System Info")');
  await page.waitForTimeout(400);
  const trace = await page.locator('.sysinfo__trace').innerText();
  check('IPC trace recorded window events', trace.includes('window-opened'));
  check('IPC trace recorded filesystem events', trace.includes('vfs-changed'));

  await page.click('.taskbar__start');
  await page.click('.launcher__item:has-text("Settings")');
  await page.waitForSelector('.settings', { timeout: 15000 });
  await page.click('.swatch:has-text("Terminal")');
  await page.waitForTimeout(400);
  check('theme tokens applied to :root', (await page.getAttribute(':root', 'data-theme')) === 'terminal');

  check('no uncaught errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  cleanup();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
