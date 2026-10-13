/**
 * Capture documentation screenshots from the running app.
 * Usage: npm run screenshots   (app must be running on BASE_URL)
 */

import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = resolve(process.cwd(), 'docs/screenshots');

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1.5,
  reducedMotion: 'reduce',
});
const page = await context.newPage();

console.log('→ login');
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({
  path: resolve(OUT, '01-login.png'),
  fullPage: true,
});

await page.fill('#email', 'alice@eco.com');
await page.fill('#password', 'password123');
await Promise.all([
  page.waitForURL('**/dashboard', { timeout: 20_000 }),
  page.getByRole('button', { name: /^Sign in$/ }).click(),
]);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1400);

console.log('→ dashboard');
await page.screenshot({
  path: resolve(OUT, '02-dashboard.png'),
  fullPage: true,
});

console.log('→ reports');
await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({
  path: resolve(OUT, '03-reports.png'),
  fullPage: true,
});

console.log('→ reports · cap breach tab');
await page.getByRole('button', { name: /Cap breaches/ }).click();
await page.waitForTimeout(400);
await page.screenshot({
  path: resolve(OUT, '04-reports-cap-breaches.png'),
  fullPage: true,
});

console.log('→ search · full-text');
await page.goto(`${BASE}/search`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.getByLabel('Search vendor reports').fill('GHG Protocol');
await Promise.all([
  page.waitForResponse(
    (response) =>
      response.url().includes('/api/search') &&
      response.request().method() === 'POST',
  ),
  page.getByRole('button', { name: /^Search$/ }).click(),
]);
await page.waitForTimeout(600);
await page.screenshot({
  path: resolve(OUT, '05-search-text.png'),
  fullPage: true,
});

console.log('→ search · pgvector semantic');
await page.getByRole('button', { name: /^Semantic/ }).click();
await page.getByLabel('Search vendor reports').fill('carbon accounting standard');
await Promise.all([
  page.waitForResponse(
    (response) =>
      response.url().includes('/api/search') &&
      response.request().method() === 'POST',
  ),
  page.getByRole('button', { name: /^Search$/ }).click(),
]);
await page.waitForTimeout(600);
await page.screenshot({
  path: resolve(OUT, '06-search-vector.png'),
  fullPage: true,
});

console.log('→ upload modal');
await page.getByRole('button', { name: /Upload vendor report/ }).first().click();
await page.waitForTimeout(400);
await page.screenshot({
  path: resolve(OUT, '07-upload-modal.png'),
  fullPage: false,
});
await page.keyboard.press('Escape');

console.log('→ mobile dashboard');
const cookies = await context.cookies();
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  reducedMotion: 'reduce',
  storageState: { cookies },
});
const mobilePage = await mobile.newPage();
await mobilePage.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
await mobilePage.waitForTimeout(1000);
await mobilePage.screenshot({
  path: resolve(OUT, '08-dashboard-mobile.png'),
  fullPage: true,
});
await mobile.close();

await browser.close();
console.log(`\nScreenshots written to ${OUT}`);
