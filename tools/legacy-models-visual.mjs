/** Actual profile/shelf/collection/detail surfaces, using the development-only gallery data. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

export async function verifyLegacyModels(out) {
  await mkdir(out, { recursive: true });
  const web = process.env.WEB ?? 'http://127.0.0.1:5188';
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [], missing = [], requested = new Set(), strategic = new Set(), frames = [];
  try {
    const page = await browser.newPage({ viewport: { width: 350, height: 812 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(60_000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().includes('/assets/legacy/models/strategic-v1/') && response.url().endsWith('.glb')) {
        strategic.add(response.url().split('/').at(-1));
        if (!response.ok()) missing.push(response.url());
      }
      if (response.url().includes('/assets/legacy/models/meshy-v1/')) {
        requested.add(response.url().split('/').at(-1));
        if (!response.ok()) missing.push(response.url());
      }
    });
    // Captures run on software WebGL: advance the same turntable at 4 fps while photographing.
    await page.addInitScript(() => {
      performance.setResourceTimingBufferSize(5000);
      const interval = window.setInterval;
      window.setInterval = (callback, delay, ...args) => interval(callback, Math.max(delay ?? 0, 250), ...args);
    });
    const url = `${web}/v2-gallery.html?view=legacy-profile&self=1&lng=tr`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-legacy-shelf]').waitFor();
    await page.waitForFunction(() => performance.getEntriesByType('resource').filter(entry => entry.name.includes('/meshy-v1/') && entry.name.includes('.glb')).length >= 6);
    await page.waitForTimeout(1500);
    console.log('Six shelf assets loaded');
    assert.equal(await page.locator('[data-legacy-plate]').count(), 6);
    assert.equal(await page.locator('[data-legacy-shelf] canvas').count(), 1);
    await page.screenshot({ path: `${out}/profile-350.png`, timeout: 60_000 });
    frames.push('profile-350.png');
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    assert.ok(noOverflow, '350px profile must not overflow horizontally');

    console.log('Mobile shelf captured');
    await page.getByRole('tab', { name: 'Koleksiyon', exact: true }).click();
    const earned = page.locator('[data-legacy-tile]:not([data-locked])');
    const count = await earned.count();
    assert.ok(count >= 36, 'all four metals of nine families must be inspectable');
    await page.waitForFunction(() => {
      const tiles = [...document.querySelectorAll('[data-legacy-tile]:not([data-locked])')];
      return tiles.length >= 36 && tiles.every(tile => tile.querySelector('img')?.complete);
    }, undefined, { timeout: 120_000 });
    console.log('Collection thumbnails ready:', count);
    for (const rarity of ['COMMON', 'RARE', 'EPIC', 'LEGENDARY']) {
      assert.ok(await earned.locator(`xpath=self::*[@data-rarity="${rarity}"]`).count() > 0, `${rarity} is visible in the collection`);
    }
    await page.screenshot({ path: `${out}/collection-350.png`, timeout: 60_000 });
    frames.push('collection-350.png');
    await page.getByRole('button', { name: 'Korsan Avcısı IV', exact: true }).click();
    await page.locator('[data-legacy-stage]').waitFor();
    await page.waitForTimeout(1500);
    assert.ok(await page.getByText('Efsanevi', { exact: true }).count() > 0);
    assert.ok(await page.getByText('Bütün kademeler tamam', { exact: true }).count() > 0, 'earned final tier must not show itself as the next goal');
    await page.screenshot({ path: `${out}/pirate-detail-350.png`, timeout: 60_000 });
    frames.push('pirate-detail-350.png');

    await page.goto(`${url}&awards=new`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-legacy-shelf]').waitFor();
    await page.waitForFunction(() => performance.getEntriesByType('resource').filter(entry =>
      /(?:radyasyon|silah_arkadasi|anit_tutma)\.glb/.test(entry.name)).length >= 6);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/new-awards-shelf-350.png`, timeout: 60_000 });
    frames.push('new-awards-shelf-350.png');
    for (const name of ['Radyasyon Ustası IV', 'Silah Arkadaşı III', 'Anıt Bekçisi II']) {
      const shelf = page.locator('[data-legacy-shelf]');
      const piece = shelf.getByRole('button', { name: new RegExp(name) });
      assert.equal(await piece.count(), 1, `${name} is on its own shelf slot`);
    }
    await page.locator('[data-legacy-shelf]').getByRole('button', { name: /Radyasyon Ustası IV/ }).click();
    await page.locator('[data-legacy-stage]').waitFor();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${out}/radiation-detail-350.png`, timeout: 60_000 });
    frames.push('radiation-detail-350.png');

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-legacy-shelf]').waitFor();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/profile-1280.png`, timeout: 60_000 });
    frames.push('profile-1280.png');
    assert.equal(missing.length, 0, missing.join('\n'));
    assert.equal(errors.length, 0, errors.join('\n'));
    assert.equal(requested.size, 36, 'every mapped GLB must load through the actual application');
    assert.equal(strategic.size, 4, 'all Death Star metals load through the real award builder');
    const result = { url, viewports: ['350×812', '1280×900'], frames, collectionPieces: count,
      modelFilesLoaded: [...requested].sort(), strategicFilesLoaded: [...strategic].sort(), errors, missing, softwareCaptureFps: 4,
      note: 'Visual validation on software WebGL; not a measurement of physical mobile-device frame time.' };
    await writeFile(`${out}/report.json`, JSON.stringify(result, null, 2) + '\n');
    console.log(`Legacy visual checks passed: ${requested.size} models; ${count} collection pieces; ${frames.length} captures.`);
  } finally { await browser.close(); }
}
