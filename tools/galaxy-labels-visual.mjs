import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/** Real map, camera gestures and DOM measurements; only API state comes from fixtures. */
export async function verifyGalaxyLabels(out = 'out/galaxy-labels') {
  await mkdir(out, { recursive: true });
  const web = process.env.WEB ?? 'http://127.0.0.1:5297';
  const manifest = await (await fetch(`${web}/__ref/dist/v2/manifest-lite.json`)).json();
  const models = Object.fromEntries(Object.entries(manifest.ships.classes).map(([id, ship]) => [id,
    { url: ship.model, engines: ship.engines, nozzle: ship.nozzle, ktx2: false }]));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const evidence = [];
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };
  try {
    const page = await browser.newPage({ viewport: { width: 350, height: 812 }, locale: 'tr-TR' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/src/v2/gallery/CosmeticTrialGallery.tsx*', async route => {
      const response = await route.fetch(); const source = await response.text();
      const needle = 'seed(keys.planets,'; assert(source.includes(needle));
      const fixture = `seed(['galaxy-ship-models'], ${JSON.stringify(models)});
        seed(keys.commanderShip, {capitalPlanetId:'trial-home',rulesetVersion:19,ship:{class:'muhafiz',level:3,status:'ready',readyAt:null}});
        seed(keys.universe, {galaxies:[{ordinal:1,ships:13}],mine:null}); ${needle}`;
      await route.fulfill({ response, body: source.replace(needle, fixture) });
    });
    await page.route('**/src/v2/gallery/StoreDiscoveryGallery.tsx*', async route => {
      const response = await route.fetch(); const source = await response.text();
      assert(source.includes('showGuidance: false'));
      await route.fulfill({ response, body: source.replace('showGuidance: false', 'showGuidance: true')
        .replace('const [api] = useState', 'window.__labelClient = client; const [api] = useState') });
    });
    await page.goto(`${web}/v2-gallery.html?view=store-discovery&lng=tr`);
    console.log('Loaded map fixture; waiting for commander model');
    await page.waitForFunction(() => window.__galaxy?.scene.getObjectByName('commander-drive'), null, { timeout: 120000 });
    console.log('Commander model mounted; waiting for opening');
    await page.locator('[data-loading-screen]').waitFor({ state: 'hidden', timeout: 90000 });
    const aim = async distance => {
      await page.evaluate(distance => {
        const g = window.__galaxy;
        g.controls.dispatchEvent({ type: 'start' });
        g.controls.target.set(10.4, 0, 8.4);
        g.camera.position.set(10.4, distance * 0.5, 8.4 + distance * Math.sqrt(0.75));
        g.controls.update(); g.camera.updateMatrixWorld(); g.invalidate();
      }, distance);
      await page.waitForTimeout(500);
    };
    const tag = page.locator('[data-part="commander-ship-tag"]').first();
    for (const width of [350, 1165]) {
      await page.setViewportSize({ width, height: 812 });
      const sizes = [];
      for (const distance of [6, 16, 23, 24, 100, 6]) {
        await aim(distance);
        const measured = await tag.evaluate(element => ({ width: element.getBoundingClientRect().width, visible: getComputedStyle(element).display !== 'none' }));
        sizes.push({ distance, ...measured });
        console.log(`${width}px distance ${distance}: ${JSON.stringify(measured)}`);
        check(measured.visible === (distance < 24), `${width}px: tag visibility at distance ${distance}`);
        if ([6, 16, 100].includes(distance)) await page.screenshot({ path: `${out}/${width}-distance-${distance}.png` });
      }
      check(sizes[1].width < sizes[0].width * 0.8, `${width}px: ship tag must shrink while zooming out`);
      check(Math.abs(sizes[5].width - sizes[0].width) < 2, `${width}px: approaching must restore the tag`);
      evidence.push({ width, sizes });

      for (const ranked of [false, true]) for (const owner of ['WWWWWWWWWWWWWWWWWWWW', 'ABCDEFGHIJKLMNOPQRST', 'İstanbulKomutanı12345', '宇宙指揮官星間艦隊銀河守護者探索者英雄王']) {
        await page.evaluate(({ owner, ranked }) => {
          window.__labelClient.setQueryData(['galaxy'], old => ({ ...old, planets: old.planets.map(world => ({
            ...world, owner, country: 'TR', clan: { id: 'strk', tag: 'STRK', name: 'Strike' },
            isOwned: ranked, isSelf: ranked && world.id === 'trial-home',
            honorRanking: ranked, honorRank: ranked ? 1 : undefined, dominionRank: ranked ? 2 : undefined,
          })) }));
        }, { owner, ranked });
        await aim(12);
        const label = page.locator('[data-world-label="trial-home"]');
        await label.waitFor({ state: 'visible' });
        await page.waitForFunction(owner => document.querySelector('[data-world-label="trial-home"] .name')?.textContent.includes(owner), owner);
        await page.evaluate(() => document.fonts.ready);
        const measured = await label.evaluate(element => {
          const text = element.querySelector('.name .truncate');
          const box = element.getBoundingClientRect();
          return { text: text.textContent, shown: text.clientWidth, needed: text.scrollWidth, left: box.left, right: box.right };
        });
        check(measured.shown >= measured.needed, `${width}px ranked=${ranked}: clan tag and 20-character name clipped: ${owner}`);
        check(measured.left >= 0 && measured.right <= width, `${width}px: label must fit the viewport`);
        evidence.push({ width, ranked, owner, ...measured });
      }
      await page.screenshot({ path: `${out}/${width}-identities.png` });
    }
    await page.evaluate(() => {
      const g = window.__galaxy; const distance = g.controls.maxDistance;
      g.controls.target.set(10.4, 0, 8.4); g.camera.position.set(10.4, distance * .5, 8.4 + distance * Math.sqrt(.75));
      g.controls.update(); g.invalidate();
    });
    await page.locator('[data-universe-chip]').click();
    check(await page.locator('[data-part="commander-ship-tag"]').count() === 0, 'universe mode must unmount ship labels immediately');
    await page.screenshot({ path: `${out}/universe.png` });
    await page.locator('[data-universe-chip]').click();
    await aim(6);
    await tag.waitFor({ state: 'visible' });
    check(errors.length === 0, `browser errors: ${errors.join('; ')}`);
    await writeFile(`${out}/measurements.json`, JSON.stringify({ evidence, failures, errors }, null, 2));
    assert.deepEqual(failures, []);
    console.log('PASS: ship label zoom/return/universe, clan tags and 20-character names at 350px and 1165px');
  } finally { await browser.close(); }
}
