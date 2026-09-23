/**
 * PHOTOGRAPH THE GÖZLEMEVİ SHELL IN THE REAL GAME.
 *
 * `tools/visual.mjs` drives the old disc controls and the world `<select>`, which
 * the v2 shell replaced. This walks the new shell instead: it signs a fresh
 * commander up (the same door `visual.mjs` uses), then photographs the galaxy and
 * every dock tab, the bell's three tabs, the View sheet and the commander page.
 * Each run registers one commander — mind the signup limit.
 *
 *   docker exec astera-pg psql -U astera -d astera -c "create database astera_ui_v2"   (once)
 *   DATABASE_URL=postgres://astera:astera@localhost:5433/astera_ui_v2 npx tsx apps/server/src/cli/migrate.ts
 *   DATABASE_URL=… PORT=3199 npx tsx apps/server/src/index.ts
 *   ASTERA_API=http://localhost:3199 pnpm --filter @astera/web exec vite --port 5199 --strictPort --host 127.0.0.1
 *   node tools/v2-shell.mjs out/shell [lng]
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const WEB = process.env.WEB ?? 'http://127.0.0.1:5199';
const OUT = process.argv[2] ?? 'out/shell';
const LNG = process.argv[3] ?? 'en';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({
  viewport: { width: 350, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const problems = [];
page.on('pageerror', (e) => problems.push(`page error: ${e.message.slice(0, 160)}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('401')) problems.push(`console: ${m.text().slice(0, 160)}`);
});

const settle = (ms) => page.waitForTimeout(ms);
const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${LNG}-${name}.png` });
  console.log(`  · ${LNG}-${name}.png`);
};
const closeAll = async () => {
  for (let i = 0; i < 4; i += 1) {
    const close = page.getByRole('button', { name: /^close$|^kapat$/i }).first();
    if (!(await close.isVisible().catch(() => false))) return;
    await close.click({ force: true }).catch(() => undefined);
    await settle(500);
  }
};

await page.addInitScript((lng) => { try { localStorage.setItem('i18nextLng', lng); } catch { /* private mode */ } }, LNG);
await page.goto(WEB, { waitUntil: 'domcontentloaded' });

const COMMANDER = `shell${String(Date.now()).slice(-8)}`;
const trainingDoor = page.getByRole('button', { name: /check your planet|start a new commander|gezegenine bak|yeni komutan/i }).first();
const commanderField = page.getByLabel(/commander name|komutan adı/i);
for (let attempt = 0; attempt < 3 && !(await commanderField.isVisible().catch(() => false)); attempt += 1) {
  try {
    await trainingDoor.waitFor({ timeout: 40_000 });
  } catch (error) {
    if (attempt === 2) throw error;
    await page.reload({ waitUntil: 'domcontentloaded' });
    continue;
  }
  await trainingDoor.click({ noWaitAfter: true });
  const skip = page.getByRole('button', { name: /^skip$|^geç$/i });
  await skip.waitFor({ timeout: 30_000 });
  await skip.click({ noWaitAfter: true });
  await settle(1500);
}
await commanderField.waitFor({ timeout: 20_000 });
await commanderField.fill(COMMANDER);
await page.getByRole('button', { name: /^continue$|^devam$/i }).click();
await page.getByLabel(/password|şifre|parola/i).fill('correct-horse-battery');
await page.getByRole('button', { name: /^claim the planet$|gezegeni al/i }).click();
await page.waitForSelector('canvas', { timeout: 60_000 });
await settle(6000);
await closeAll();
await shot('01-galaxy');

const dock = page.getByRole('navigation').last();
const tab = async (name, file) => {
  await dock.getByRole('button', { name }).first().click({ force: true });
  await settle(1500);
  await shot(file);
};
await tab(/^(Base|Üs)/, '02-base');
await tab(/^(Fleet|Filo)/, '03-fleet');
await tab(/^(Intel|İstihbarat)/, '04-intel');
await tab(/^(Clan|Klan)/, '05-clan');
await tab(/^(Galaxy|Galaksi)/, '06-galaxy-again');

await page.getByRole('button', { name: /^(Signals|Sinyaller)/ }).first().click({ force: true });
await settle(1200);
await shot('07-bell-signals');
await page.getByRole('tab', { name: /^(Chronicle|Kronik)/ }).click({ force: true });
await settle(1200);
await shot('08-bell-chronicle');
await page.getByRole('tab', { name: /^(Chat|Sohbet)/ }).click({ force: true });
await settle(1500);
await shot('09-bell-chat');
await closeAll();

await page.getByRole('button', { name: /^(View|Görünüm)$/ }).click({ force: true });
await settle(1000);
await shot('10-view');
await closeAll();

await page.getByRole('button', { name: /^(Commander|Komutan)/ }).first().click({ force: true });
await settle(1200);
await shot('11-commander');
await closeAll();

await page.getByRole('button', { name: /^(Alloy|Alaşım)/ }).first().click({ force: true });
await settle(1500);
await shot('12-economy');

console.log(problems.length ? `problems:\n${problems.join('\n')}` : 'no page errors');
await browser.close();
