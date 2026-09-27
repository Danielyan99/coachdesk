// Takes the README screenshots from the running app (npm run db:dev + npm run dev), using the Chrome or Edge
// that is already installed (puppeteer-core downloads no browser). Each shot starts a fresh demo sandbox in a
// separate headless profile. Run with: npm run screenshots [base-url]
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const BASE = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '');
const OUT = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const browsers = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean);
const executablePath = browsers.find((p) => existsSync(p));
if (!executablePath) throw new Error('No Chrome or Edge found. Set CHROME_PATH.');

const browser = await puppeteer.launch({ executablePath, headless: true });

async function page({ width, height, mobile = false }) {
  const context = await browser.createBrowserContext(); // own cookies: a fresh sandbox per shot
  const p = await context.newPage();
  await p.setViewport({ width, height, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  return p;
}

async function startDemo(p, role) {
  await p.goto(BASE, { waitUntil: 'networkidle0' });
  const label = role === 'trainer' ? 'Try as a trainer' : 'Try as a client';
  const [button] = await p.$$(`xpath/.//button[normalize-space()='${label}']`);
  await button.click();
  await p.waitForFunction((path) => location.pathname === path, {}, role === 'trainer' ? '/app' : '/me');
  await p.waitForNetworkIdle();
}

async function shot(p, name, { fullPage = false } = {}) {
  await new Promise((r) => setTimeout(r, 400)); // let transitions finish
  await p.screenshot({ path: `${OUT}${name}.png`, fullPage });
  console.log(`docs/screenshots/${name}.png`);
}

async function clickText(p, text) {
  const [el] = await p.$$(`xpath/.//*[self::a or self::button][normalize-space()='${text}']`);
  await el.click();
  await p.waitForNetworkIdle();
}

// Landing page
{
  const p = await page({ width: 1280, height: 800 });
  await p.goto(BASE, { waitUntil: 'networkidle0' });
  await shot(p, 'landing');
}

// Trainer: dashboard, client detail, template editor
{
  const p = await page({ width: 1280, height: 860 });
  await startDemo(p, 'trainer');
  await shot(p, 'dashboard');

  const [sofia] = await p.$$(`xpath/.//a[.//p[normalize-space()='Sofia Rossi']]`);
  await sofia.click();
  await p.waitForNetworkIdle();
  await shot(p, 'client-detail');

  await clickText(p, 'Templates');
  const [template] = await p.$$(`xpath/.//a[normalize-space()='Beginner strength (3 days)']`);
  await template.click();
  await p.waitForNetworkIdle();
  await shot(p, 'template-editor');
}

// Client on a phone: Today and Week
{
  const p = await page({ width: 390, height: 844, mobile: true });
  await startDemo(p, 'client');
  await shot(p, 'client-today');
  await clickText(p, 'Week');
  await shot(p, 'client-week');
}

await browser.close();
