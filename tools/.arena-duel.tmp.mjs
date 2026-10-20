import { chromium } from 'playwright';
const out = process.argv[2];
const browser = await chromium.launch({ channel: 'chromium', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=vulkan', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
const open = async name => {
  const context = await browser.newContext({ viewport: { width: 350, height: 812 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', e => console.log(name, 'pageerror', e.message.slice(0, 200)));
  await page.addInitScript(() => localStorage.setItem('astera.language', 'tr'));
  await page.goto('http://localhost:5198/?arena=sandbox&mode=online');
  await page.waitForSelector('[data-screen="preflight"]', { timeout: 180000 });
  await page.click('.ap-launch');
  await page.waitForFunction(() => window.__arena?.network?.connected, null, { timeout: 30000 });
  return page;
};
const a = await open('A'); const b = await open('B');
const state = page => page.evaluate(() => { const p = window.__arena.world.pilot; return { id: p.id, phase: p.phase, hull: +p.hull.toFixed(1), hold: p.hold.map(v => +v.toFixed(1)), shield: p.shield, cargo: p.cargo }; });
await a.waitForTimeout(1500);
await b.evaluate(() => { const n = window.__arena.network; n.dev('position', 0, { x: 600, y: 0, z: 1650 }); n.dev('cargo', 30); });
await a.evaluate(() => { const n = window.__arena.network; n.dev('position', 0, { x: 600, y: 0, z: 1600 }); });
await b.keyboard.down('Space'); await b.waitForTimeout(300); await b.keyboard.up('Space'); // drops B's spawn shield
await a.waitForTimeout(600);
console.log('A', JSON.stringify(await state(a))); console.log('B', JSON.stringify(await state(b)));
const seen = await a.evaluate(() => window.__arena.world.drones.map(d => [d.id, Math.round(d.p.x), Math.round(d.p.z), d.phase]));
console.log('A sees', JSON.stringify(seen));
await a.keyboard.down('Space');
for (let i = 0; i < 12; i++) { await a.waitForTimeout(500); const s = await state(b); if (s.phase !== 'flying') { console.log('B down after', (i + 1) * 0.5, 's', JSON.stringify(s)); break; } }
await a.keyboard.up('Space');
await a.screenshot({ path: `${out}/70-duel-kill.png` });
await a.waitForTimeout(400);
const drops = await a.evaluate(() => window.__arena.world.cargoDrops.filter(d => d.active && !d.field).map(d => [Math.round(d.p.x), Math.round(d.p.z), +d.amount.toFixed(1), d.kind]));
console.log('wreck drops seen by A', JSON.stringify(drops));
await a.screenshot({ path: `${out}/71-duel-drops.png` });
await a.evaluate(() => window.__arena.controls.setThrottle(0.35));
await a.waitForTimeout(3500);
await a.evaluate(() => window.__arena.controls.setThrottle(0));
console.log('A after sweep', JSON.stringify(await state(a)));
await b.screenshot({ path: `${out}/72-duel-victim.png` });
console.log('B screen', await b.evaluate(() => document.querySelector('[data-screen]')?.getAttribute('data-screen')));
await browser.close();
