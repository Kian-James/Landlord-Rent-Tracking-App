#!/usr/bin/env node
/**
 * Screenshots every page in the app with a single command:
 *
 *   npm run screenshots
 *
 * What it does:
 *   1. Starts the Vite dev server (unless one is already running on the
 *      configured port).
 *   2. Screenshots the public pages (login, register) straight away.
 *   3. If TEST_EMAIL / TEST_PASSWORD are set (in .env or the shell), logs in
 *      through the real login form and screenshots every protected page too.
 *   4. Saves everything to client/screenshots/ and shuts the dev server back
 *      down if this script was the one that started it.
 *
 * Config (env vars, all optional):
 *   SCREENSHOT_BASE_URL   default http://localhost:5173
 *   SCREENSHOT_OUT_DIR    default ./screenshots
 *   SCREENSHOT_VIEWPORT   e.g. "1440x900" (default)
 *   TEST_EMAIL / TEST_PASSWORD  a real Supabase user to log in as, so the
 *                               protected pages get screenshotted too. If
 *                               unset, only the public pages are captured.
 *
 * Note: protected pages call the API (proxied to http://localhost:3000).
 * Start the server (`npm run dev` in ../server) first if you want them to
 * show real data instead of loading/error states.
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = path.resolve(__dirname, '..');

loadDotEnv(path.join(CLIENT_ROOT, '.env'));

const BASE_URL = process.env.SCREENSHOT_BASE_URL || 'http://localhost:5173';
const OUT_DIR = path.resolve(CLIENT_ROOT, process.env.SCREENSHOT_OUT_DIR || 'screenshots');
const [VP_WIDTH, VP_HEIGHT] = (process.env.SCREENSHOT_VIEWPORT || '1440x900')
  .split('x')
  .map(Number);

const PUBLIC_PAGES = [
  { name: 'login', path: '/login' },
  { name: 'register', path: '/register' },
];

const PROTECTED_PAGES = [
  { name: 'dashboard', path: '/' },
  { name: 'properties', path: '/properties' },
  { name: 'tenants', path: '/tenants' },
  { name: 'bills', path: '/bills' },
  { name: 'calendar', path: '/calendar' },
  { name: 'settings', path: '/settings' },
];

function loadDotEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match || line.trim().startsWith('#')) continue;
    const key = match[1];
    let value = (match[2] || '').trim();
    if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function isUp(url) {
  try {
    const res = await fetch(url, { method: 'GET' });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isUp(url)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function startDevServerIfNeeded() {
  if (await isUp(BASE_URL)) {
    console.log(`Dev server already running at ${BASE_URL}`);
    return null;
  }

  console.log('Starting Vite dev server...');
  const isWin = process.platform === 'win32';
  const child = spawn('npm', ['run', 'dev'], {
    cwd: CLIENT_ROOT,
    stdio: 'ignore',
    // shell:true lets Windows resolve npm.cmd; on POSIX, detached puts npm
    // and everything it spawns (vite, esbuild) in their own process group
    // so we can kill the whole tree by its group id afterwards.
    shell: true,
    detached: !isWin,
  });
  child.on('error', (err) => {
    console.error('Could not start the dev server:', err.message);
  });

  const ready = await waitForServer(BASE_URL);
  if (!ready) {
    stopDevServer(child);
    throw new Error(`Dev server did not come up at ${BASE_URL} in time.`);
  }
  console.log(`Dev server ready at ${BASE_URL}`);
  return child;
}

function stopDevServer(child) {
  if (!child || child.pid == null) return;
  if (process.platform === 'win32') {
    // shell:true means child.pid is cmd.exe's pid; /t kills its whole tree
    // (cmd -> npm -> vite -> esbuild).
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
}

async function screenshotPage(page, { name, path: routePath }, dir) {
  await page.goto(`${BASE_URL}${routePath}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300); // let any post-load animations/skeletons settle
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  saved ${path.relative(CLIENT_ROOT, file)}`);
}

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const startedServer = await startDevServerIfNeeded();
  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: VP_WIDTH, height: VP_HEIGHT },
    });
    const page = await context.newPage();

    console.log('\nPublic pages:');
    for (const p of PUBLIC_PAGES) {
      await screenshotPage(page, p, OUT_DIR);
    }

    const { TEST_EMAIL, TEST_PASSWORD } = process.env;
    if (TEST_EMAIL && TEST_PASSWORD) {
      console.log('\nLogging in as', TEST_EMAIL);
      await login(page, TEST_EMAIL, TEST_PASSWORD);

      console.log('Protected pages:');
      for (const p of PROTECTED_PAGES) {
        await screenshotPage(page, p, OUT_DIR);
      }
    } else {
      console.log(
        '\nSkipping protected pages: set TEST_EMAIL and TEST_PASSWORD (in client/.env or your shell) ' +
          'to a real Supabase login to also capture dashboard, properties, tenants, bills, calendar and settings.'
      );
    }

    console.log(`\nDone. Screenshots saved to ${path.relative(CLIENT_ROOT, OUT_DIR)}/`);
  } finally {
    if (browser) await browser.close();
    stopDevServer(startedServer);
  }
}

main().catch((err) => {
  console.error('\nScreenshot run failed:', err.message);
  process.exit(1);
});
