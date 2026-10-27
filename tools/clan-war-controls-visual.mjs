import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** The real clan screens with local gallery data; no player API mutations. */
export async function verifyClanWarControls(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const width of [350, 1280]) for (const language of ['tr', 'en']) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      const errors = [];
      let apiRequests = 0;
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests++; });
      await page.routeWebSocket('**', socket => socket.close());
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=clan-war&lng=${language}`);
      const add = page.getByRole('button', { name: language === 'tr' ? /^Gemi Ekle/ : /^Add ships/ });
      await add.waitFor();
      await page.evaluate(() => document.fonts.ready);
      // Replace only the gallery API's cancellation method to count intentional commits.
      await page.evaluate(async () => {
        const url = performance.getEntriesByType('resource').map(entry => entry.name)
          .findLast(resource => new URL(resource).pathname === '/src/api/client.ts');
        const { Api } = await import(url);
        window.__clanCancelCalls = 0;
        const send = Api.prototype.send;
        Api.prototype.send = function (path, ...args) {
          if (path !== '/api/clan/war/cancel') return send.call(this, path, ...args);
          window.__clanCancelCalls++;
          return new Promise(() => undefined);
        };
      });
      await add.scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(output, `room-${language}-${width}.png`) });
      await add.click();
      await page.getByRole('dialog', { name: 'VEX · Kestrel' }).waitFor();
      await page.getByRole('dialog', { name: 'VEX · Kestrel' })
        .getByRole('button', { name: language === 'tr' ? 'Kapat' : 'Close', exact: true }).click();

      const cancel = page.getByRole('button', { name: language === 'tr' ? 'Hedefi iptal et' : 'Cancel target', exact: true });
      const title = language === 'tr' ? 'Klan hedefi iptal edilsin mi?' : 'Cancel the clan target?';
      await cancel.click();
      let modal = page.getByRole('dialog', { name: title });
      await modal.waitFor();
      assert.equal(await page.evaluate(() => window.__clanCancelCalls), 0);
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(output, `confirmation-${language}-${width}.png`) });
      const geometry = await modal.evaluate(node => ({
        width: innerWidth,
        pageWidth: document.documentElement.scrollWidth,
        modal: node.getBoundingClientRect().toJSON(),
        buttons: [...node.querySelectorAll('button')].map(button => button.getBoundingClientRect().toJSON()),
      }));
      assert.ok(geometry.pageWidth <= width);
      assert.ok(geometry.modal.x >= 0 && geometry.modal.right <= width);
      assert.equal(geometry.buttons.length, 3);
      assert.ok(geometry.buttons.every(button => button.y >= 0 && button.bottom <= 900));
      await modal.getByRole('button', { name: language === 'tr' ? 'Vazgeç' : 'Go back', exact: true }).click();
      await modal.waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => window.__clanCancelCalls), 0);
      await cancel.click();
      modal = page.getByRole('dialog', { name: title });
      const commit = modal.getByRole('button', { name: language === 'tr' ? 'Evet, iptal et' : 'Yes, cancel target', exact: true });
      await commit.click();
      await page.waitForFunction(() => window.__clanCancelCalls === 1);
      await modal.locator('[data-testid="confirm-commit"]:disabled').waitFor();
      assert.equal(await commit.isDisabled(), true);
      assert.equal(apiRequests, 0);
      assert.deepEqual(errors, []);
      results.push({ language, width, geometry, cancellationCalls: 1, apiRequests, passed: true });
      await page.close();
      console.log(`PASS clan controls ${language}/${width}`);
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'results.json'), JSON.stringify(results, null, 2));
}
