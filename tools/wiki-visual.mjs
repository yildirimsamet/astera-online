import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** The public journey requires no script, account or API. The room uses the real ui-v2 sheet. */
export async function verifyWiki(output) {
  await mkdir(output, { recursive: true });
  const web = process.env.WEB ?? 'http://127.0.0.1:5188';
  const browser = await chromium.launch();
  const measurements = [];
  try {
    for (const [label, viewport, language] of [
      ['desktop-en', { width: 1360, height: 960 }, 'en'],
      ['mobile-en', { width: 350, height: 812 }, 'en'],
      ['mobile-tr', { width: 350, height: 812 }, 'tr'],
    ]) {
      const context = await browser.newContext({ viewport, javaScriptEnabled: false });
      const page = await context.newPage();
      const requests = []; const errors = [];
      page.on('request', request => { requests.push(request.url()); });
      page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      const base = language === 'tr' ? '/wiki/tr' : '/wiki';
      for (const [name, path] of [['home', base], ['fleet', `${base}/fleet`], ['dart', `${base}/fleet/dart`], ['research', `${base}/research/gravitic-charges`], ['storage', `${base}/buildings/vault`]]) {
        const response = await page.goto(web + path, { waitUntil: 'networkidle' });
        assert.equal(response.status(), 200);
        assert.equal(await page.locator('h1').count(), 1);
        assert.ok((await page.locator('main').textContent()).length > 200);
        const layout = await page.evaluate(() => ({ fits: document.documentElement.scrollWidth <= innerWidth, bodyHeight: document.body.scrollHeight, viewport: innerWidth }));
        assert.ok(layout.fits, `${label} ${name} has horizontal overflow`);
        measurements.push({ label, name, ...layout });
        await page.screenshot({ path: join(output, `${label}-${name}.png`), fullPage: true });
      }
      if (viewport.width === 350) {
        const menu = page.locator('.wiki-mobile-menu');
        await menu.locator('summary').click();
        await menu.locator(`a[href="${base}/fleet"]`).click();
        assert.equal(await menu.getAttribute('open'), null);
        const heading = await page.locator('h1').boundingBox();
        assert.ok(heading && heading.y > 0 && heading.y + heading.height < viewport.height, `${label} category heading is below the fold`);
        await page.getByRole('link', { name: language === 'en' ? 'Dart' : 'Ok', exact: true }).click();
        const articleHeading = await page.locator('h1').boundingBox();
        assert.ok(articleHeading && articleHeading.y + articleHeading.height < viewport.height, `${label} article is hidden below the menu`);
        measurements.push({ label, name: 'native-category-navigation', collapsed: true, headingTop: articleHeading.y });
      }
      assert.ok(!requests.some(url => /\/api\/|\.(?:js|tsx)(?:\?|$)/.test(url)), 'Public Wiki fetched game JavaScript or the API');
      assert.deepEqual(errors, []);
      const missing = await page.goto(web + `${base}/fleet/no-such-ship`);
      assert.equal(missing.status(), 404);
      assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex,follow');
      await context.close();
      const roomContext = await browser.newContext({ viewport });
      const room = await roomContext.newPage();
      const roomErrors = [];
      room.on('pageerror', error => { roomErrors.push(error.message); });
      await room.goto(`${web}/v2-gallery.html?view=wiki&lng=${language}`, { waitUntil: 'networkidle' });
      const dialog = room.getByRole('dialog');
      await dialog.getByRole('searchbox').fill('Dart');
      await dialog.getByRole('link', { name: language === 'en' ? 'Dart' : 'Ok', exact: true }).click();
      await dialog.getByRole('heading', { name: language === 'en' ? 'Dart' : 'Ok', exact: true }).waitFor();
      await room.screenshot({ path: join(output, `${label}-sheet.png`) });
      const roomLayout = await dialog.evaluate(element => ({ fits: element.scrollWidth <= element.clientWidth, pageFits: document.documentElement.scrollWidth <= innerWidth }));
      assert.ok(roomLayout.fits && roomLayout.pageFits, `${label} Wiki sheet overflow`);
      await dialog.getByRole('link', { name: language === 'en' ? /^Shipyard(?: level \d+)?$/ : /^Tersane(?: \d+\. seviye)?$/ }).click();
      await dialog.getByRole('heading', { name: language === 'en' ? 'Shipyard' : 'Tersane', exact: true }).waitFor();
      await dialog.getByRole('button', { name: language === 'en' ? /Dart/ : /Ok/ }).click();
      await dialog.getByRole('heading', { name: language === 'en' ? 'Dart' : 'Ok', exact: true }).waitFor();
      const roomMenu = dialog.locator('.wiki-room-menu');
      await roomMenu.locator('summary').click();
      await roomMenu.locator(`a[href="${base}/fleet"]`).click();
      assert.equal(await roomMenu.getAttribute('open'), null);
      const headingPosition = await dialog.locator('h1').boundingBox();
      const toolbarPosition = await dialog.locator('.wiki-room-tools').boundingBox();
      assert.ok(headingPosition && toolbarPosition && headingPosition.y >= toolbarPosition.y + toolbarPosition.height && headingPosition.y + headingPosition.height < viewport.height, `${label} selected content is hidden by navigation`);
      await room.screenshot({ path: join(output, `${label}-sheet-category.png`) });
      assert.deepEqual(roomErrors, []);
      measurements.push({ label, name: 'sheet', ...roomLayout });
      await roomContext.close();
      console.log(`PASS ${label}: static HTML without JavaScript; shared Wiki sheet, search, links and back`);
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), JSON.stringify(measurements, null, 2) + '\n');
}
