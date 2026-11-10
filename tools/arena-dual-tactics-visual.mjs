import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

export async function verifyDualTactics(out = 'out/arena-dual-tactics') {
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const results = [];
  try {
    for (const width of [350, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: width === 350 ? 780 : 900 }, hasTouch: width === 350, isMobile: width === 350, locale: 'tr-TR' });
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => { localStorage.setItem('i18nextLng', 'tr'); Object.defineProperty(navigator, 'deviceMemory', { value: 2 }); });
      await page.goto(`${process.env.WEB ?? 'http://127.0.0.1:5297'}/?arena=sandbox`);
      await page.locator('.ap-launch').waitFor({ timeout: 120000 });
      await page.locator('[data-slot="1"]').click(); await page.locator('[data-tactic="illusion"]').click();
      await page.locator('[data-slot="2"]').click(); await page.locator('[data-tactic="radar"]').click();
      await page.screenshot({ path: `${out}/preflight-${width}.png` });
      await page.locator('.ap-launch').click();
      await page.locator('.ac-radar').waitFor();
      if (width > 350) await page.keyboard.press('Escape');
      const layout = await page.evaluate(() => {
        const keys = [...document.querySelectorAll('.ac-action')].map(node => { const r = node.getBoundingClientRect(); return { name: node.className, x: r.x, y: r.y, w: r.width, h: r.height }; });
        const ring = document.querySelector('.ac-stick').getBoundingClientRect();
        return { keys, stick: { x: ring.x, y: ring.y, r: 76 }, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(layout.overflow, false);
      assert.equal(layout.keys.length, 5);
      if (width === 350) {
        const second = layout.keys.find(key => key.name.includes('ac-tactic-second'));
        const dx = Math.max(second.x - layout.stick.x, 0, layout.stick.x - second.x - second.w);
        const dy = Math.max(second.y - layout.stick.y, 0, layout.stick.y - second.y - second.h);
        assert(dx * dx + dy * dy >= layout.stick.r ** 2, 'second tactic overlaps the idle joystick ring');
      }
      for (const a of layout.keys) {
        assert(a.x >= 0 && a.y >= 0 && a.x + a.w <= width, `control outside viewport: ${a.name}`);
        for (const b of layout.keys) if (a !== b) assert(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `overlapping controls: ${a.name}, ${b.name}`);
      }
      // Fly towards one of the new cover groups; use the normal action buttons from there.
      await page.evaluate(() => {
        const { world, controls } = window.__arena;
        const last = world.layout.obstacles.findLastIndex(o => o.kind === 'crystal');
        const rock = world.layout.obstacles[last + 1];
        Object.assign(world.pilot.p, { x: rock.p.x, y: rock.p.y, z: rock.p.z - 380 });
        Object.assign(world.pilot.q, { x: 0, y: 0, z: 0, w: 1 });
        controls.setThrottle(0); world.pilot.s = 0;
      });
      if (width === 350) await page.locator('.ac-illusion').tap(); else await page.locator('.ac-illusion').click();
      await page.waitForFunction(() => window.__arena.world.pilot.decoy >= 0);
      if (width === 350) await page.locator('.ac-radar').tap(); else await page.keyboard.press('c');
      await page.waitForFunction(() => window.__arena.world.pilot.scan > 0);
      const flight = await page.evaluate(() => {
        const p = window.__arena.world.pilot;
        return { tactic: p.tactic, tactic2: p.tactic2, cooldown: p.tacticCooldown, cooldown2: p.tactic2Cooldown, decoy: p.decoy, scan: p.scan };
      });
      assert(flight.cooldown > 0 && flight.cooldown2 > 0);
      await page.screenshot({ path: `${out}/flight-${width}.png` });
      assert.deepEqual(errors, []);
      results.push({ width, ...layout, ...flight });
      await context.close();
    }
    await writeFile(`${out}/proof.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  } finally { await browser.close(); }
}
