import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Craft sheets against the existing isolated gallery; never place a real order. */
export async function verifySpecialShips(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const measurements = [];
  try {
    for (const width of [350, 1280]) for (const language of ['tr', 'en']) {
      for (const hull of ['NULLIFIER', 'GARBAGE_COLLECTOR']) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=base-fleet&lng=${language}`);
        await page.getByRole('tab').first().waitFor();
        const family = page.locator('[data-hull-family-group="SPECIALIST"]');
        await family.scrollIntoViewIfNeeded();
        const collapsed = family.getByRole('button', { expanded: false });
        if (await collapsed.count()) await collapsed.click();
        await family.scrollIntoViewIfNeeded();
        await page.locator(`#row-${hull}`).getByRole('button').first().click();
        const role = page.locator('[data-special-role]');
        await role.waitFor();
        const layout = await role.evaluate(element => {
          const rect = element.getBoundingClientRect();
          const sheet = element.closest('[data-build-sheet]');
          const how = [...sheet.querySelectorAll('button[aria-expanded]')][0];
          const matchup = sheet.querySelector('[data-counter-cycle]');
          return { width: rect.width, top: rect.top, bottom: rect.bottom,
            visible: rect.top >= 0 && rect.bottom <= innerHeight,
            fits: document.documentElement.scrollWidth <= innerWidth && element.scrollWidth <= element.clientWidth + 1,
            bordered: getComputedStyle(element).borderTopWidth !== '0px',
            ordered: !!(how.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
              && !!(element.compareDocumentPosition(matchup) & Node.DOCUMENT_POSITION_FOLLOWING),
            collapsedDetail: !sheet.querySelector('[data-item-detail]'), text: element.textContent };
        });
        assert(layout.visible && layout.fits && layout.bordered && layout.ordered && layout.collapsedDetail, JSON.stringify(layout));
        assert.match(layout.text, hull === 'NULLIFIER' ? /Aegis.*×5/ : language === 'tr' ? /7\.500/ : /7,500/);
        assert.deepEqual(errors, []);
        await page.screenshot({ path: join(output, `${width}-${language}-${hull}.png`) });
        measurements.push({ width, language, hull, ...layout });
        console.log(`PASS special role: ${width}px ${language} ${hull}, visible without expanding detail`);
        await page.close();
      }
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(measurements, null, 2)}\n`);
}
