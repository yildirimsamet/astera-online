import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

export async function verifyRadiationForge(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const checks = [];
  try {
    for (const width of [350, 1280]) for (const language of ['tr', 'en', 'de', 'fr', 'es', 'ja']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.routeWebSocket('**/*', () => undefined);
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=leaderboard&lng=${language}`);
      await page.locator('[data-v2-leaderboard]').waitFor();
      await page.evaluate(async () => {
        const resources = performance.getEntriesByType('resource').map(entry => entry.name);
        const moduleUrl = path => resources.findLast(name => new URL(name).pathname === path) ?? path;
        const [{ default: { createElement: h } }, { default: { createRoot } }, { RadiationBombForge }, { planetView }] = await Promise.all([
          import(resources.find(name => /\/react\.js\?/.test(name))),
          import(resources.find(name => /\/react-dom_client\.js\?/.test(name))),
          import(moduleUrl('/src/screens/RadiationBombControls.tsx')), import(moduleUrl('/test/fixtures.ts')),
        ]);
        document.getElementById('root').style.display = 'none';
        const mount = document.createElement('div');
        mount.style.cssText = 'width:min(100%,700px);margin:auto;padding:8px;box-sizing:border-box';
        document.body.append(mount);
        const root = createRoot(mount);
        window.__forgeReview = state => {
          const now = Date.now();
          const world = planetView({ radiationBombsAvailable: true, buildings: { CORE: state === 'LOCKED' ? 12 : 13, SHIPYARD: 5 },
            radiationBombs: ['EMPTY', 'LOCKED'].includes(state) ? [] : [1, 2, 3].map(level => ({
              id: `review-${level}`, level, status: state, readyAt: state === 'BUILDING' ? new Date(now + 60000) : null,
              remainingSeconds: state === 'BUILDING' || state === 'PAUSED' ? 60 : 0,
            })),
          });
          root.render(h(RadiationBombForge, { planet: world, held: { alloy: 500000, crystal: 500000, deuterium: 500000 }, now, pending: false, onBuild() { /* Visual captures never submit production. */ } }));
        };
      });
      const states = ['EMPTY', ...(['tr', 'en'].includes(language) ? ['READY', 'BUILDING', 'PAUSED', 'LAUNCHED', 'LOCKED'] : [])];
      for (const state of states) {
        await page.evaluate(state => { window.__forgeReview(state); }, state);
        const forge = page.locator('body > div:last-child .radiation-forge');
        await forge.waitFor();
        await page.waitForFunction(state => document.querySelector('body > div:last-child .radiation-product')?.getAttribute('data-state') === (state === 'LOCKED' ? 'EMPTY' : state), state);
        for (const image of await forge.locator('img').all()) {
          await image.scrollIntoViewIfNeeded();
          await image.evaluate(node => node.decode());
        }
        const measured = await forge.evaluate(node => ({
          fits: document.documentElement.scrollWidth <= innerWidth && [...node.querySelectorAll('article, button')].every(part => part.scrollWidth <= part.clientWidth + 1),
          scenes: node.querySelectorAll('.radiation-product__scene img').length,
          uncropped: [...node.querySelectorAll('.radiation-product__scene img')].every(image => {
            const box = image.getBoundingClientRect();
            return Math.abs(box.width / box.height - image.naturalWidth / image.naturalHeight) < .02;
          }),
          translated: !/planet\.radiationBomb\./.test(node.textContent),
          locked: [...node.querySelectorAll('button')].every(button => button.disabled),
          buttons: node.querySelectorAll('button').length,
          stock: [...node.querySelectorAll('[data-tally]')].map(tally => ({ used: tally.getAttribute('data-used'), total: tally.getAttribute('data-total'), cell: tally.querySelector('[data-cell]')?.getAttribute('data-cell') })),
          levels: [...node.querySelectorAll('[data-radiation-level]')].map(badge => badge.querySelectorAll('svg').length),
        }));
        assert(measured.fits, `${language}/${width}/${state}: overflow`);
        assert.equal(measured.scenes, 3);
        assert.deepEqual(measured.levels, [1, 2, 3]);
        const expectedCell = { EMPTY: 'empty', LOCKED: 'empty', READY: 'ready', BUILDING: 'loading', PAUSED: 'paused', LAUNCHED: 'flight' }[state];
        assert(measured.stock.every(slot => slot.total === '1' && slot.used === (['EMPTY', 'LOCKED'].includes(state) ? '0' : '1') && slot.cell === expectedCell));
        assert(measured.uncropped, `${language}/${width}/${state}: missile artwork is cropped`);
        assert(measured.translated);
        assert.equal(measured.buttons, ['EMPTY', 'LOCKED'].includes(state) ? 3 : 0);
        if (state === 'LOCKED') assert(measured.locked);
        await forge.screenshot({ path: `${output}/${language}-${width}-${state.toLowerCase()}.png` });
        checks.push({ language, width, state, ...measured });
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(`${output}/checks.json`, JSON.stringify(checks, null, 2));
  console.log(JSON.stringify({ output, states: checks.length, passed: true }));
}
