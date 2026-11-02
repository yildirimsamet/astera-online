import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { randomBytes } from 'node:crypto';

/** Actual controls, clocks, picking and reports. No world fixtures or clock jumps. */
export async function verifyFlightSchool(out) {
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const viewport = process.argv.includes('--short-phone') ? { width: 350, height: 600 } : { width: 390, height: 844 };
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, storageState: process.env.ASTERA_VISUAL_STATE });
  // This walkthrough exercises manual entry; --first-visit covers automatic entry.
  await context.addInitScript(() => { localStorage.setItem('astera.training-entry.dismissed', '1'); });
  const page = await context.newPage(); page.setDefaultTimeout(25_000);
  browser.on('disconnected', () => { console.log('BROWSER DISCONNECTED'); });
  page.on('crash', () => { console.log('PAGE CRASHED'); });
  const errors = [], journal = [];
  page.on('pageerror', error => { errors.push(error.message); });
  const snap = async (name) => { await page.screenshot({ path: `${out}/${name}.png`, timeout: 60_000 }); };
  const point = async (selector) => {
    await page.waitForFunction(selector => {
      const target = document.querySelector(selector);
      if (!target) return false;
      const box = target.getBoundingClientRect();
      const body = target.closest('[data-sheet-body], [data-sheet-scroll]');
      const port = body?.getBoundingClientRect();
      const top = Math.max(0, (port?.top ?? 0) + (body?.querySelector('[data-category-bar]')?.getBoundingClientRect().height ?? 0));
      const bottom = Math.min(innerHeight, port?.bottom ?? innerHeight);
      return box.width > 0 && box.height > 0 && Math.min(box.bottom, bottom) - Math.max(box.top, top) >= Math.min(box.height - 1, bottom - top - 16);
    }, selector);
    const point = await page.locator(selector).evaluate(target => {
      const box = target.getBoundingClientRect(), body = target.closest('[data-sheet-body], [data-sheet-scroll]'), port = body?.getBoundingClientRect();
      const top = Math.max(0, box.top, (port?.top ?? 0) + (body?.querySelector('[data-category-bar]')?.getBoundingClientRect().height ?? 0));
      const bottom = Math.min(innerHeight, box.bottom, port?.bottom ?? innerHeight);
      return { x: box.x + box.width / 2, y: (top + bottom) / 2 };
    });
    await page.mouse.click(point.x, point.y);
  };
  const seeQueue = async (scene) => {
    await page.waitForFunction(() => {
      const lane = document.querySelector('[data-queue-lane] [data-progress]')?.closest('[data-queue-lane]');
      const box = lane?.getBoundingClientRect();
      const port = lane?.closest('[data-sheet-body]')?.getBoundingClientRect();
      return box && box.top >= (port?.top ?? 0) && box.bottom <= Math.min(innerHeight, port?.bottom ?? innerHeight);
    }, undefined, { timeout: 2500 });
    journal.push({ scene: `${scene}-queue-visible`, at: new Date().toISOString() });
  };
  const orderIds = { core: 'CORE', refinery: 'REFINERY', extractor: 'EXTRACTOR', uplink: 'UPLINK', telescope: 'TELESCOPE', shipyard: 'SHIPYARD', hangar: 'HANGAR', radar: 'RADAR', aegis: 'AEGIS' };
  const hullIds = { miner: 'PROSPECTOR', darts: 'DART', couriers: 'COURIER', guns: 'THORN' };
  const reads = ['resources', 'coreResult', 'production', 'sight', 'sightWorlds', 'sightCompare', 'traffic', 'mineResult', 'probeReport', 'incoming', 'warning', 'shield'];
  try {
    await page.goto(process.env.ASTERA_VISUAL_URL ?? 'http://127.0.0.1:5193/tr/');
    const privacy = page.locator('[data-consent-notice]');
    if (await privacy.isVisible()) await privacy.getByRole('button', { name: 'Reddet', exact: true }).click();
    await page.getByRole('button', { name: 'Oynamaya başla', exact: true }).click();
    await page.locator('[data-school-scene]').waitFor({ timeout: 60_000 });
    await page.locator('canvas').first().waitFor({ timeout: 60_000 });
    await page.locator('[data-loading-screen]').waitFor({ state: 'hidden', timeout: 60_000 });
    for (let index = 0; index < 60; index++) {
      const scene = await page.locator('[data-school-scene]').getAttribute('data-school-scene');
      if (scene === 'sight') {
        await page.waitForTimeout(450);
        await snap('telescope-before');
        await page.waitForTimeout(5000);
        await snap('telescope-after');
        const names = await page.locator('[data-school-world][data-known=true]').allTextContents();
        if (!['Lyra', 'Vega', 'Altair'].every(name => names.includes(name))) throw new Error('Telescope failed to reveal neighbouring worlds');
      }
      // Let the instructor speak. Reading and every result need an explicit action.
      await page.locator('.school-reveal').waitFor({ state: 'hidden', timeout: 30_000 });
      await page.waitForTimeout(['sight', 'sightWorlds', 'sightCompare', 'traffic', 'range', 'shield', 'warning'].includes(scene) ? 2200 : 400);
      journal.push({ scene, at: new Date().toISOString(), text: await page.locator('[data-school-coach] .school-line').innerText() });
      console.log(`PLAY ${scene}`);
      if (['welcome', 'resources', 'sight', 'sightWorlds', 'sightCompare', 'traffic', 'probeReport', 'warning', 'shield', 'departure'].includes(scene)) {
        await snap(scene);
        if (['resources', 'shield'].includes(scene)) {
          await page.setViewportSize({ width: 350, height: 600 }); await page.waitForTimeout(700);
          await snap(`${scene}-350x600`);
          await page.setViewportSize(viewport); await page.waitForTimeout(700);
        }
      }
      if (scene === 'welcome') await point('[data-academy-home]');
      else if (reads.includes(scene)) await page.locator('[data-school-next]').click();
      else if (scene === 'range') { await snap(`range-${index}`); await page.locator('[data-school-next]').click(); }
      else if (['collect', 'collectOre'].includes(scene)) await page.locator('[data-works-line]').click();
      else if (orderIds[scene]) {
        await page.waitForFunction(() => document.querySelector('[data-school-highlight]')?.getAttribute('style')?.includes('visibility: visible'));
        await point(`#row-${orderIds[scene]} [data-open-item]`);
        await page.locator('[data-item-sheet] [data-act] button').click();
        await seeQueue(scene);
      } else if (hullIds[scene]) {
        await page.waitForFunction(() => document.querySelector('[data-school-highlight]')?.getAttribute('style')?.includes('visibility: visible'));
        await point(`#row-${hullIds[scene]} [data-open-item]`);
        if (scene === 'darts') { await snap('darts-order'); await page.setViewportSize({ width: 350, height: 600 }); await snap('darts-order-350x600'); await page.setViewportSize(viewport); }
        await page.locator('[data-build-sheet] [data-commit] button').click();
        await seeQueue(scene);
      } else if (['watch', 'mine', 'probe', 'raid'].includes(scene)) {
        await point('[data-academy-tap-target]');
        // A mistaken close must leave a real way to select the target again.
        if (scene !== 'mine') {
          await page.locator('[data-focus-rail]').getByRole('button', { name: 'Seçimi bırak', exact: true }).click();
          await point('[data-academy-tap-target]');
        }
        if (scene === 'watch' || scene === 'mine') await page.locator('[data-focus-rail] button[aria-expanded=false]').first().click();
        if (scene === 'watch') await page.getByRole('button', { name: '1. yuvayı çevir', exact: true }).click();
        if (scene === 'mine') { await snap('mine-choice'); await page.locator('[data-focus-rail] [data-primary]').click(); }
        if (scene === 'probe') await page.getByRole('button', { name: /^Sonda/ }).click();
        if (scene === 'raid') {
          await page.locator('[data-focus-rail] [data-attack]').click();
          const max = page.locator('[data-count-max] button');
          if (await max.count() !== 2) throw new Error('Expected the taught two-hull fleet');
          await point('[data-hull-row=DART] [data-count-max] button');
          if (await page.locator('[data-launch-commit] button').last().isEnabled()) throw new Error('Launch enabled without Couriers');
          await point('[data-hull-row=COURIER] [data-count-max] button');
          await snap('raid-choice');
          const button = page.locator('[data-launch-commit] button').last(), box = await button.boundingBox();
          if (!box) throw new Error('Launch control missing');
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(850); await page.mouse.up();
          await page.waitForTimeout(8000); await snap('raid-battle');
        }
      } else if (scene === 'defend') {
        await page.locator('[data-school-next]').click(); await page.waitForTimeout(8500); await snap('defence-battle');
      } else if (scene === 'raidReport' || scene === 'defenseReport') {
        await page.locator('[data-school-next]').click(); await page.waitForTimeout(500); await snap(scene);
        await page.locator('[data-sheet-panel]').getByRole('button', { name: 'Kapat', exact: true }).click();
      } else if (scene === 'departure') {
        await page.locator('[data-school-next]').click(); await snap('commander-name');
        await page.getByLabel('Komutan adı', { exact: true }).fill(`Review${Date.now().toString().slice(-8)}`);
        await page.getByRole('button', { name: 'Bu adla devam et', exact: true }).click(); await snap('commander-password');
        await page.getByLabel('Parola', { exact: true }).fill(randomBytes(24).toString('base64url'));
        await page.getByRole('checkbox').check();
        const claimResponse = page.waitForResponse(response => response.url().includes('/api/onboarding/claim') && response.request().method() === 'POST');
        await page.getByRole('button', { name: 'Galaksiye katıl', exact: true }).click();
        const response = await claimResponse, claimed = await response.json();
        if (!response.ok()) throw new Error(`Claim refused: ${response.status()}`);
        const opening = claimed.planet;
        if (opening.planet.alloy !== 1500 || opening.planet.crystal !== 400 || opening.planet.deuterium !== 50 || opening.buildings.CORE !== 1 || Object.values(opening.fleet).some(n => n > 0) || Object.values(opening.ground).some(n => n > 0)) throw new Error('Training leaked into the normal opening');
        journal.push({ scene: 'verified-opening', core: opening.buildings.CORE, alloy: opening.planet.alloy, crystal: opening.planet.crystal, deuterium: opening.planet.deuterium, fleet: opening.fleet, ground: opening.ground });
        await page.locator('[data-school-scene]').waitFor({ state: 'hidden', timeout: 60_000 });
        const join = page.getByRole('button', { name: 'Katıl', exact: true });
        if (await join.count()) { await snap('galaxy-choice'); await join.first().click(); }
        await page.locator('[data-loading-screen]').waitFor({ state: 'hidden', timeout: 60_000 });
        await page.locator('[data-works-line]').waitFor({ timeout: 60_000 });
        await snap('normal-galaxy');
        journal.push({ scene: 'normal-galaxy', at: new Date().toISOString(), text: (await page.locator('body').innerText()).slice(0, 2500) });
        console.log('ENTERED NORMAL GALAXY'); break;
      } else throw new Error(`Unhandled scene: ${scene}`);
      if (scene !== 'range') await page.waitForFunction(previous => document.querySelector('[data-school-scene]')?.getAttribute('data-school-scene') !== previous, scene, { timeout: 60_000 });
      await context.storageState({ path: `${out}/browser-state.json` });
    }
    if (errors.length) throw new Error(errors.join('\n'));
    if (!journal.some(entry => entry.scene === 'normal-galaxy')) throw new Error('Journey did not reach the real galaxy');
    await context.storageState({ path: `${out}/browser-state.json` });
  } catch (error) {
    console.error('PLAY FAILED', error);
    await context.storageState({ path: `${out}/browser-state.json` }).catch(() => undefined);
    await snap('failure').catch(() => undefined);
    await writeFile(`${out}/failure.txt`, `${String(error)}\n${await page.locator('body').innerText().catch(() => 'Browser unavailable')}`);
    throw error;
  } finally {
    await writeFile(`${out}/journey.json`, JSON.stringify({ journal, errors }, null, 2));
    await browser.close();
  }
}
