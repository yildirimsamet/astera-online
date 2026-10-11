import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/** Real personal-flight components in the fixture gallery; no game actions or API writes. */
export async function verifyPaceFuel(out) {
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch();
  const measurements = [];
  try {
    for (const width of [350, 1188]) for (const language of ['tr', 'en', 'de', 'es', 'fr', 'ja']) {
      for (const surface of ['launch', 'transfer']) {
        const page = await browser.newPage({ viewport: { width, height: 812 }, locale: language });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=${surface}&lng=${language}`);
          await page.getByRole('dialog').waitFor();
          await page.evaluate(() => document.fonts.ready);
          const quantity = page.locator('[data-hull-row="DART"] input').first();
          await quantity.fill('40');
          await quantity.blur();
          const control = page.locator(surface === 'launch' ? '[data-launch-pace]' : '[data-transfer-pace]');
          await control.scrollIntoViewIfNeeded();
          const readNumber = async locator => Number((await locator.innerText()).replace(/[^0-9]/g, ''));
          const fuel = control.locator('[data-pace-fuel]');
          const fullFuel = await readNumber(fuel);
          assert(fullFuel > 0, `${surface}: full-speed fixture must burn fuel`);
          const fullTime = await control.locator('[data-pace-time]').innerText();
          await page.screenshot({ path: `${out}/${language}-${width}-${surface}-full.png` });
          await control.getByRole('radio', { name: '50%', exact: true }).click();
          await control.scrollIntoViewIfNeeded();
          const slowFuel = await readNumber(fuel);
          const saved = await readNumber(control.locator('[data-pace-saving] span').last());
          assert(slowFuel < fullFuel, `${surface}: selected speed must reduce fixture fuel`);
          assert.equal(slowFuel + saved, fullFuel, `${surface}: exact displayed savings must reconcile`);
          assert.notEqual(await control.locator('[data-pace-time]').innerText(), fullTime);
          assert((await control.locator('[data-pace-delay]').innerText()).trim().length > 0);
          const overflow = await control.evaluate(element => [...element.querySelectorAll('*')]
            .filter(child => child.clientWidth > 0 && child.scrollWidth > child.clientWidth + 1)
            .map(child => child.textContent?.slice(0, 80)));
          assert.deepEqual(overflow, [], `${language} ${width} ${surface}: speed comparison must fit`);
          const bounds = await control.boundingBox();
          assert(bounds && bounds.x >= -1 && bounds.x + bounds.width <= width + 1);
          assert.deepEqual(errors, [], `${language} ${surface}: no rendering errors`);
          await page.screenshot({ path: `${out}/${language}-${width}-${surface}-half.png` });
          await control.screenshot({ path: `${out}/${language}-${width}-${surface}-comparison.png` });
          measurements.push({ language, width, surface, fullFuel, slowFuel, saved, overflow });
          console.log(`PASS ${language} ${width}px ${surface}: fuel ${fullFuel} → ${slowFuel}, saved ${saved}`);
        } finally {
          await page.close();
        }
      }
    }
    await writeFile(`${out}/measurements.json`, JSON.stringify(measurements, null, 2));
  } finally {
    await browser.close();
  }
}
