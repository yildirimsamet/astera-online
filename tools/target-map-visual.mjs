import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Run alone, with the real renderer on a small known/remembered/unknown map. */
export async function verifyTargetMap(output) {
  await mkdir(output, { recursive: true });
  const web = process.env.WEB ?? 'http://localhost:5173';
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const observations = [];
  let page;
  try {
    for (const [name, viewport] of [['mobile', { width: 350, height: 812 }], ['desktop', { width: 1360, height: 900 }]]) {
      const context = await browser.newContext({ viewport, locale: 'tr-TR', deviceScaleFactor: 1 });
      // SwiftShader is a CPU renderer. Keep this functional/layout check light.
      await context.addInitScript(() => {
        localStorage.setItem('astera.quality', 'low');
        window.requestAnimationFrame = callback => window.setTimeout(() => callback(performance.now()), 100);
        window.cancelAnimationFrame = id => window.clearTimeout(id);
      });
      page = await context.newPage();
      page.setDefaultTimeout(30_000);
      const errors = [];
      page.on('pageerror', error => { errors.push(error.message); });
      await page.goto(`${web}/target-map-preview.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__galaxy && document.querySelector('[data-world-label]'));
      await page.waitForTimeout(1000);

      const aim = async (range, x = 22, z = 0) => {
        await page.evaluate(({ range, x, z }) => {
          const state = window.__galaxy;
          state.controls.target.set(x, 0, z);
          // Keep a viewable inclination, clear of the orbit control's polar clamp.
          state.camera.position.set(x, range * 0.8, z + range * 0.6);
          state.camera.lookAt(x, 0, z);
          state.camera.updateMatrixWorld();
          state.controls.update();
          state.invalidate();
        }, { range, x, z });
        await page.waitForTimeout(1200);
      };
      const labels = () => page.locator('[data-world-label]').evaluateAll(elements => elements
        .filter(element => getComputedStyle(element).visibility === 'visible')
        .map(element => {
          const box = element.getBoundingClientRect();
          return { id: element.getAttribute('data-world-label'), text: element.textContent,
            flags: [...element.querySelectorAll('img')].map(flag => ({ country: flag.alt, loaded: flag.complete && flag.naturalWidth > 0,
              width: flag.getBoundingClientRect().width, height: flag.getBoundingClientRect().height })),
            fontSizes: [...element.querySelectorAll('span')]
              .filter(span => [...span.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim()))
              .map(span => parseFloat(getComputedStyle(span).fontSize)),
            left: box.left, top: box.top, width: box.width, height: box.height };
        }));

      await aim(30);
      // Html uses a separate React root. Wait for its first committed projection,
      // including the asset decode/compile work on the CPU renderer's first frame.
      await page.waitForFunction(() => ['vega', 'kestrel', 'memory'].every(id => {
        const element = document.querySelector(`[data-world-label="${id}"]`);
        return element && getComputedStyle(element).visibility === 'visible';
      }));
      const nearby = await labels();
      await writeFile(join(output, `${name}-nearby.json`), JSON.stringify(nearby, null, 2) + '\n');
      assert.ok(nearby.some(label => label.id === 'vega'), `${name}: untapped ordinary planet is unnamed`);
      assert.ok(nearby.some(label => label.id === 'kestrel'), `${name}: second ordinary planet is unnamed`);
      assert.ok(nearby.find(label => label.id === 'vega')?.flags.some(flag => flag.country === 'Japonya' && flag.loaded), `${name}: commander's flag missing/unloaded`);
      assert.equal(nearby.some(label => label.id === 'unknown'), false, `${name}: unknown identity leaked`);
      assert.equal(await page.locator('[data-map-preview-focus]').getAttribute('data-map-preview-focus'), '');
      const remembered = nearby.find(label => label.id === 'memory');
      assert.ok(remembered && /kayıt/i.test(remembered.text), `${name}: remembered name has no record age`);
      assert.ok(await page.locator('[data-world-record-age]').evaluate(element => element.scrollWidth <= element.clientWidth), `${name}: remembered record age is truncated`);
      assert.equal(nearby.find(label => label.id === 'neutral')?.flags.length, 0, `${name}: neutral world has a commander flag`);
      assert.ok(nearby.length <= 32);
      for (const label of nearby) {
        assert.ok(label.fontSizes.every(size => size <= 10), `${name}: map text has not been reduced`);
        for (const flag of label.flags) {
          assert.equal(flag.width, 10, `${name}: flag is not half width`);
          assert.equal(flag.height, 6, `${name}: flag is not half height`);
        }
        assert.ok(label.left >= 0 && label.left + label.width <= viewport.width + 1 && label.top >= 0 && label.top + label.height <= viewport.height + 1,
          `${name}: ${label.id} clipped at viewport edge`);
      }
      for (let i = 0; i < nearby.length; i += 1) for (let j = i + 1; j < nearby.length; j += 1) {
        const a = nearby[i]; const b = nearby[j];
        assert.ok(!(a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top),
          `${name}: ${a.id} and ${b.id} labels collide`);
      }
      observations.push({ name, scenario: 'nearby', labels: nearby });
      await page.screenshot({ path: join(output, `${name}-nearby.png`) });

      await aim(95);
      await page.waitForFunction(() => [...document.querySelectorAll('[data-world-label]')].every(element => getComputedStyle(element).visibility === 'hidden'));
      assert.equal((await labels()).length, 0, `${name}: labels remain at overview range`);
      await page.screenshot({ path: join(output, `${name}-overview.png`) });
      observations.push({ name, scenario: 'overview', labels: [] });

      // Return and prove that fixed pixel type remains readable when zooming in.
      await aim(14, 17, -9);
      await page.waitForFunction(() => {
        const element = document.querySelector('[data-world-label="vega"]');
        return element && getComputedStyle(element).visibility === 'visible';
      });
      const close = await labels();
      assert.ok(close.some(label => label.id === 'vega'));
      const vega = close.find(label => label.id === 'vega');
      assert.equal(Math.round(vega.width), Math.round(nearby.find(label => label.id === 'vega').width));
      await page.screenshot({ path: join(output, `${name}-close.png`) });
      observations.push({ name, scenario: 'close', labels: close });
      assert.deepEqual(errors, [], `${name}: runtime errors`);
      await context.close();
      console.log(`PASS ${name}: untapped names, loaded country flags, dated memories, fog, zoom, bounds and collisions`);
    }
  } catch (error) {
    if (page && !page.isClosed()) await page.screenshot({ path: join(output, 'failure.png') }).catch(() => undefined);
    throw error;
  } finally { await browser.close(); }
  await writeFile(join(output, 'observations.json'), JSON.stringify(observations, null, 2) + '\n');
}
