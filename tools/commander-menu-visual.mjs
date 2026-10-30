import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Real menu/profile and navigation; only the unrelated WebGL background is omitted. */
export async function verifyCommanderMenu(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const [width, height, language, state = 'normal'] of [[350, 812, 'tr'], [350, 640, 'de'], [1280, 900, 'tr'], [390, 844, 'ja'], [350, 812, 'en'], [350, 812, 'fr'], [350, 812, 'es'], [350, 812, 'tr', 'waiting']]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', error => { errors.push(error.message); });
      await page.route('**/src/galaxy/GalaxyCanvas.tsx*', async route => {
        const response = await route.fetch();
        const source = await response.text();
        const react = source.match(/from\s+["']([^"']*\/react\.js[^"']*)["']/);
        assert(react);
        await route.fulfill({ response, body: `import React from ${JSON.stringify(react[1])}; export function GalaxyCanvas({ onReady }) { React.useEffect(onReady, [onReady]); return null; }` });
      });
      await page.goto(`${process.env.WEB ?? 'http://127.0.0.1:5173'}/v2-gallery.html?view=store-discovery&panel=menu&lng=${language}&menu-state=${state}`, { waitUntil: 'domcontentloaded' });
      const menu = page.locator('[data-v2-commander-menu]');
      await menu.waitFor();
      await page.locator('[data-loading-screen]').waitFor({ state: 'hidden', timeout: 60_000 });
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await menu.locator('[data-menu-category]').count(), 5);
      assert.equal(await menu.getByRole('slider').count(), 0);
      assert.equal(await menu.locator('canvas').count(), 0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false);
      const identity = menu.locator('[data-menu-identity]');
      const entryStyle = await identity.evaluate(element => {
        const style = getComputedStyle(element);
        return { outline: style.outlineStyle, bottom: style.borderBottomWidth, top: style.borderTopWidth, paddingLeft: style.paddingLeft, paddingRight: style.paddingRight };
      });
      assert.deepEqual(entryStyle, { outline: 'none', bottom: '1px', top: '0px', paddingLeft: '4px', paddingRight: '4px' });
      const support = menu.locator('[data-menu-category="donate"]');
      assert(await support.evaluate(element => element.nextElementSibling?.getAttribute('data-menu-category') === 'settings'));
      await page.screenshot({ path: join(output, `${width}-${language}-${state === 'waiting' ? 'waiting' : 'home'}.png`) });
      const homeSize = await menu.boundingBox();
      // On a standard phone, the complete normal menu fits without scrolling.
      if (height >= 812 && state === 'normal') {
        assert(await menu.evaluate(element => {
          const parent = element.parentElement;
          return parent.scrollHeight <= parent.clientHeight + 1;
        }), 'The normal menu must fit its sheet');
      }
      if (state === 'waiting') {
        assert.equal(await menu.locator('[data-menu-row]').count(), 1);
        assert(await menu.locator('[data-menu-category="community"]').innerText().then(value => value.includes('1')));
        results.push({ width, height, language, state, homeSize, overflow, waitingRewards: 3, unread: 1, longName: true, errors });
        await page.close();
        continue;
      }
      await support.click();
      const supportPage = page.locator('[data-support-page]');
      await supportPage.waitFor();
      assert.equal(await supportPage.locator('details[open]').count(), 0);
      assert.equal(await supportPage.getByRole('link').count(), 4);
      await page.screenshot({ path: join(output, `${width}-${language}-support.png`) });
      await supportPage.locator('summary').click();
      assert.equal(await supportPage.locator('details[open]').count(), 1);
      await page.getByRole('dialog').last().locator('header button').first().click();
      await menu.waitFor();
      for (const category of ['season', 'academy', 'community', 'settings']) {
        await menu.locator(`[data-menu-category="${category}"]`).click();
        await page.locator(`[data-menu-page="${category}"]`).waitFor();
        await menu.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => undefined))));
        assert.equal(await menu.locator('[data-menu-category]').count(), 0);
        await page.screenshot({ path: join(output, `${width}-${language}-${category}.png`) });
        const dialog = page.getByRole('dialog').last();
        await dialog.locator('header button').first().click();
        await page.locator('[data-menu-page="home"]').waitFor();
        assert(await menu.locator(`[data-menu-category="${category}"]`).evaluate(element => element === document.activeElement));
      }
      // Following a destination's Back restores its category rather than losing the place.
      await menu.locator('[data-menu-category="community"]').click();
      await menu.locator('[data-menu-tile]').first().click();
      await menu.waitFor({ state: 'hidden' });
      await page.getByRole('dialog').last().locator('header button').first().click();
      await page.locator('[data-menu-page="community"]').waitFor();
      await page.getByRole('dialog').last().locator('header button').first().click();
      await menu.locator('[data-menu-category="settings"]').click();
      await page.getByRole('dialog').last().locator('header button').last().click();
      await menu.waitFor({ state: 'hidden' });
      await page.locator('[data-menu-button]').click();
      await page.locator('[data-menu-page="home"]').waitFor();
      await menu.locator('[data-menu-identity]').click();
      await page.locator('[data-profile-page]').waitFor();
      assert.equal(new URL(page.url()).pathname, '/profile');
      const profile = page.locator('[data-profile-page]');
      assert(await profile.evaluate(element => element === document.activeElement));
      const top = await page.locator('.v2-shell > div').first().boundingBox();
      const profileFrame = await profile.evaluate(element => {
        const rect = element.closest('[role="dialog"]').getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom };
      });
      assert(top && profileFrame.top >= top.y + top.height - 1, 'The profile must stay below the live TopBar');
      assert(await page.locator('.v2-shell').isVisible());
      await page.screenshot({ path: join(output, `${width}-${language}-profile.png`) });
      await page.locator('[data-profile-page] > button').first().click();
      const accountDialog = page.getByRole('dialog').last();
      await accountDialog.waitFor();
      // Portaled account sheets must stay above the standalone profile surface.
      await accountDialog.locator('header button').last().click({ timeout: 3_000 });
      assert(await page.locator('[data-profile-page]').isVisible());
      await page.goBack();
      await menu.waitFor();
      assert.deepEqual(errors, []);
      results.push({ width, height, language, homeSize, overflow, categories: 4, supportEntry: true, profileUrl: '/profile', profileFrame, topBar: top, browserBack: true, entryStyle, errors, galaxyStubbed: true });
      await page.close();
      console.log(`PASS ${width}px ${language}: menu, categories, restored navigation, /profile and browser Back`);
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
}
