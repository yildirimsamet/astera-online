/** Real rewards/transfer surfaces in isolated gallery data. No accounts or API writes. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

export async function verifyRewards(output) {
  await mkdir(output, { recursive: true });
  const web = process.env.WEB ?? 'http://localhost:5173';
  const browser = await chromium.launch();
  const results = [];
  const cases = [
    ...['tr', 'en', 'de', 'fr', 'es', 'ja'].map((language) => ({ language, state: '', width: 350, height: 812 })),
    ...['ready', 'complete', 'empty'].map((state) => ({ language: 'tr', state, width: 350, height: 667 })),
    ...[{ width: 430, height: 932 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]
      .map((viewport) => ({ language: 'tr', state: 'ready', ...viewport })),
  ];
  const fit = async (page) => {
    const measured = await page.locator('[data-v2-rewards]').evaluate((surface) => {
      const bounds = surface.getBoundingClientRect();
      const panel = document.querySelector('[data-sheet-panel]').getBoundingClientRect();
      return {
        pageFits: document.documentElement.scrollWidth <= window.innerWidth,
        sheetFits: document.querySelector('[data-sheet-body]').scrollWidth <= document.querySelector('[data-sheet-body]').clientWidth + 1,
        sheetOnScreen: panel.top >= -1 && panel.bottom <= window.innerHeight + 1,
        controlsFit: [...surface.querySelectorAll('button, a')].every((element) => element.scrollWidth <= element.clientWidth + 1),
        contentFits: [...surface.querySelectorAll('h3, p, button, a, [data-reward-tier]')].every((element) => {
          const box = element.getBoundingClientRect();
          return box.left >= bounds.left - 1 && box.right <= bounds.right + 1;
        }),
        imagesLoaded: [...surface.querySelectorAll('img')].every((img) => img.complete && img.naturalWidth > 0),
        chains: surface.querySelectorAll('[data-reward-chain]').length,
        claims: surface.querySelectorAll('[data-reward-claim]').length,
      };
    });
    assert.equal(measured.pageFits, true, 'page width');
    assert.equal(measured.sheetFits, true, 'sheet width');
    assert.equal(measured.sheetOnScreen, true, 'sheet height');
    assert.equal(measured.controlsFit, true, 'control text');
    assert.equal(measured.contentFits, true, 'content bounds');
    assert.equal(measured.imagesLoaded, true, 'resource art');
    return measured;
  };
  try {
    for (const { language, state, width, height } of cases) {
      const page = await browser.newPage({ viewport: { width, height } });
      page.setDefaultNavigationTimeout(60_000);
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await page.goto(`${web}/v2-gallery.html?view=rewards${state ? `-${state}` : ''}&lng=${language}`, { waitUntil: 'domcontentloaded' });
        await page.locator('[data-v2-rewards]').waitFor();
        await page.evaluate(() => document.fonts.ready);
        const measured = await fit(page);
        assert.equal(measured.chains, state === 'empty' ? 0 : 13);
        if (state === 'complete' || state === 'empty') assert.equal(measured.claims, 0);
        else assert(measured.claims > 0);
        if (state === 'ready') assert.equal(await page.locator('[data-reward-chain="SOCIAL"] [data-reward-claim]').count(), 1);
        const prefix = `${language}-${width}x${height}-${state || 'waiting'}`;
        await page.screenshot({ path: join(output, `${prefix}-top.png`) });
        if (state !== 'empty') {
          const core = page.locator('[data-reward-chain="CORE"]');
          await core.scrollIntoViewIfNeeded();
          await page.screenshot({ path: join(output, `${prefix}-goals.png`) });
          const open = core.getByRole('button', { expanded: false });
          await open.click();
          assert.equal(await core.getByRole('button', { expanded: true }).count(), 1);
          assert.equal(await core.locator('[data-reward-tier]').count(), 5);
          await fit(page);
          await page.screenshot({ path: join(output, `${prefix}-expanded.png`) });
          if (language === 'tr' && state === '' && width === 350) {
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.locator('[data-v2-rewards]').waitFor();
            assert.equal(await page.locator('[data-reward-chain="CORE"]').getByRole('button', { expanded: true }).count(), 1);
          }
        }
        assert.deepEqual(errors, []);
        results.push({ language, state: state || 'waiting', width, height, ...measured, errors });
        console.log(`PASS rewards ${prefix}: text, resources, controls and persisted ladder fit`);
      } catch (error) {
        await page.screenshot({ path: join(output, 'failure.png') }).catch(() => undefined);
        throw error;
      } finally { await page.close(); }
    }

    const page = await browser.newPage({ viewport: { width: 350, height: 812 } });
    page.setDefaultNavigationTimeout(60_000);
    try {
      await page.goto(`${web}/v2-gallery.html?view=transfer-radiation&lng=tr`, { waitUntil: 'domcontentloaded' });
      await page.locator('[data-transfer-return-plan]').waitFor();
      await page.locator('input[name="transfer-cargoShips"][value="STAY"]').check();
      await page.locator('input[name="transfer-otherShips"][value="RETURN"]').check();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('[data-transfer-return-plan]').waitFor();
      assert.equal(await page.locator('input[name="transfer-cargoShips"][value="STAY"]').isChecked(), true);
      assert.equal(await page.locator('input[name="transfer-otherShips"][value="RETURN"]').isChecked(), true);
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('astera.transfer-return.v1'))), { cargoShips: 'STAY', otherShips: 'RETURN' });
      await page.locator('[data-transfer-return-plan]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(output, 'tr-transfer-saved.png') });
      results.push({ fixture: 'transfer-radiation', persisted: { cargoShips: 'STAY', otherShips: 'RETURN' } });
      console.log('PASS transfer: only return choices survive a browser reload');
    } finally { await page.close(); }
  } finally {
    await browser.close();
    await writeFile(join(output, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
  }
}
