import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/** Isolated opening review: real bootstrap + React, mobile ratios and CPU throttling. */
export async function verifyLoading(out) {
  await mkdir(out, { recursive: true });
  const web = process.env.WEB ?? 'http://localhost:5173';
  const browser = await chromium.launch();
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 350, height: 812 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${web}/brand-preview.html`);
    await page.locator('.opening-stage').waitFor();
    await page.waitForLoadState('networkidle');
    for (const [width, height] of [[320, 568], [350, 812], [390, 844], [768, 1024], [1440, 900], [812, 375], [568, 320]]) {
      await page.setViewportSize({ width, height });
      // Resize the actual mounted screen instead of repeatedly importing Vite's
      // development module graph, which exhausts Chromium's request budget.
      await page.waitForTimeout(300);
      const boxes = await page.evaluate(() => {
        const rect = selector => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
        };
        return ['.opening-stage', '.brand-loading-name', '.brand-loading-status', '.brand-loading-address'].map(rect);
      });
      for (const box of boxes) assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.bottom <= height, `Clipped content at ${width}x${height}`);
      assert(boxes[1].bottom < boxes[2].y, 'Brand overlaps progress');
      assert(boxes[2].bottom < boxes[3].y, 'Progress overlaps address');
      assert.equal(await page.locator('.brand-loading-corner, .opening-orbit-plane, canvas, video').count(), 0);
      assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), null);
      await page.screenshot({ path: `${out}/${width}x${height}.png` });
    }
    await page.setViewportSize({ width: 350, height: 812 });
    await page.goto(`${web}/brand-preview.html?progress=0.38`);
    await page.getByRole('progressbar').waitFor();
    assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), '38');
    await page.screenshot({ path: `${out}/measured.png` });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    const performance = await page.evaluate(async () => {
      const fleet = document.querySelector('.opening-orbit-outer');
      const before = getComputedStyle(fleet).transform;
      const frames = [];
      const start = window.performance.now();
      let previous = start;
      await new Promise(resolve => {
        const frame = now => {
          frames.push(now - previous); previous = now;
          if (now - start < 2500) requestAnimationFrame(frame); else resolve();
        };
        requestAnimationFrame(frame);
      });
      frames.sort((a, b) => a - b);
      return { frames: frames.length, p95Ms: frames[Math.floor(frames.length * .95)], moves: before !== getComputedStyle(fleet).transform };
    });
    assert(performance.moves, 'Orbital motion stopped');
    assert(performance.p95Ms < 50, 'Animation exceeds 50ms at the 95th percentile under 6x CPU throttling');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    // Pause only the app script so the actual first HTML can be inspected independently.
    await page.route(/\/src\/main\.tsx(?:\?|$)/, route => route.abort());
    await page.goto(web);
    await page.locator('#brand-boot .opening-stage').waitFor();
    assert.equal(await page.locator('#brand-boot .brand-loading-wordmark svg').count(), 1);
    assert.equal(await page.locator('#brand-boot .brand-loading-corner').count(), 0);
    await page.screenshot({ path: `${out}/bootstrap.png` });
    assert.deepEqual(errors, []);
    await writeFile(`${out}/metrics.json`, JSON.stringify({ cpuThrottling: 6, ...performance }, null, 2));
    console.log('PASS: seven viewport ratios, real bootstrap, honest progress, moving orbits and 6x CPU check', performance);
  } finally { await browser.close(); }
}
