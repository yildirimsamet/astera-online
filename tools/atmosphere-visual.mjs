/** Capture actual components, without preview CSS or substituted image routes. */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

export async function captureAtmosphere(output) {
  await mkdir(output, { recursive: true });
  // These are DOM/image surfaces. A software WebGL compositor is unnecessary here.
  const browser = await chromium.launch();
  const records = [];
  const issues = [];
  const views = ['menu', 'base-production', 'base-fleet', 'base-research', 'intel', 'clan', 'clan-war', 'fleet', 'fleet-home', 'rewards', 'leaderboard', 'away', 'strategic-forge', 'report'];
  const web = process.env.WEB ?? 'http://127.0.0.1:5176';
  try {
    for (const width of [350, 585, 1280]) {
      for (const view of views) {
        // Close each gallery context before opening the next: image/audio caches from
        // repeated document navigation otherwise exhaust Chromium's resource pool.
        const page = await browser.newPage({ viewport: { width, height: width === 585 ? 1266 : 812 }, locale: 'tr-TR' });
        page.on('pageerror', error => issues.push({ url: page.url(), error: error.message }));
        page.on('response', response => {
          if (response.status() >= 400 && response.url().includes('/assets/images/atmosphere/')) issues.push({ url: response.url(), status: response.status() });
        });
        await page.goto(`${web}/v2-gallery.html?view=${view}&lng=tr`, { waitUntil: 'networkidle' });
        if (['base-production', 'base-fleet'].includes(view)) await page.locator('[data-layout="card"]').first().scrollIntoViewIfNeeded();
        await page.evaluate(async () => {
          // Offscreen lazy images are intentionally not fetched yet. Decoding those
          // waits forever on long catalogs; inspect only the images being captured.
          const visible = [...document.querySelectorAll('img[data-atmosphere-image], img[data-complete-scene]')].filter(image => {
            const bounds = image.getBoundingClientRect();
            return bounds.bottom > 0 && bounds.top < innerHeight && bounds.right > 0 && bounds.left < innerWidth;
          });
          await Promise.all(visible.map(image => image.decode().catch(() => undefined)));
        });
        await page.waitForTimeout(350);
        await page.screenshot({ path: join(output, `${view}-${width}.png`) });
        const layout = await page.evaluate(() => ({
          viewport: innerWidth, width: document.documentElement.scrollWidth,
          headerHeight: document.querySelector('.sheet-art-head')?.getBoundingClientRect().height ?? null,
          completeScenes: document.querySelectorAll('[data-complete-scene]').length,
          brokenImages: [...document.images].filter(image => image.complete && image.naturalWidth === 0).map(image => image.getAttribute('src')),
        }));
        if (view === 'base-production') {
          const art = page.locator('[data-complete-scene]').first();
          const measure = () => art.evaluate(image => {
            const bounds = image.getBoundingClientRect();
            const style = getComputedStyle(image);
            const door = image.closest('[data-layout="card"]')?.querySelector('[data-open-item]');
            return { width: bounds.width, height: bounds.height, transform: style.transform, scale: style.scale,
              filter: style.filter, doorColor: door ? getComputedStyle(door).backgroundColor : null };
          });
          const before = await measure();
          await page.locator('[data-layout="card"]').first().hover();
          await page.waitForTimeout(400);
          const after = await measure();
          layout.hoverUnchanged = JSON.stringify(before) === JSON.stringify(after);
          if (!layout.hoverUnchanged) issues.push({ view, width, hover: { before, after } });
          await page.mouse.move(width - 1, 1);
        }
        if (view === 'base-research') {
          const art = page.locator('[data-constellation-card] > img[data-atmosphere-image]');
          layout.researchArt = await art.evaluate(image => ({ width: image.getBoundingClientRect().width,
            height: image.getBoundingClientRect().height, mask: getComputedStyle(image).maskImage }));
          if (layout.researchArt.mask !== 'none' || layout.researchArt.width <= 0) issues.push({ view, width, research: layout.researchArt });
          const projects = await page.locator('[data-star]').evaluateAll(stars => stars.map(star => star.getAttribute('data-star')));
          layout.researchProjects = [];
          for (const id of projects) {
            await page.locator(`[data-star="${id}"]`).click();
            const card = page.locator(`[data-constellation-card="${id}"]`);
            await card.locator('img[data-atmosphere-image]').evaluate(image => image.decode());
            // Wait for the actual component's smooth scroll, never scroll the card in the harness.
            await page.waitForTimeout(350);
            const measured = await card.evaluate(node => {
              const bounds = node.getBoundingClientRect();
              const image = node.querySelector('img[data-atmosphere-image]');
              const actions = node.querySelector('[data-research-footer] > .grid');
              const primary = node.querySelector('[data-primary]:not(:disabled)');
              return { id: node.getAttribute('data-constellation-card'), top: bounds.top, bottom: bounds.bottom,
                image: image.getAttribute('src'), landscape: image.naturalWidth > image.naturalHeight,
                footerInset: actions ? bounds.bottom - actions.getBoundingClientRect().bottom : null,
                buttonColor: primary ? getComputedStyle(primary).color : null,
                expectedButtonColor: primary ? getComputedStyle(primary).getPropertyValue('--color-v2-self-ink').trim() : null };
            });
            layout.researchProjects.push(measured);
            if (!measured.landscape || measured.footerInset > 18 || measured.bottom > (width === 585 ? 1266 : 812) || measured.top < 0) issues.push({ view, width, researchProject: measured });
            if (['INDUSTRIAL', 'PROSPECTOR_HOLDS', 'ISOTOPE_SPECTROMETRY', 'DENSE_FUEL_CELLS', 'GRAVITIC_CHARGES', 'DEUTERIUM_SYNTHESIS'].includes(id)) await page.screenshot({ path: join(output, `research-${id.toLowerCase()}-${width}.png`) });
          }
          await page.locator('[data-constellation-card] [data-open-item]').click();
          const portrait = page.locator('[data-research-portrait] > img');
          await portrait.evaluate(image => image.decode());
          layout.researchDetail = await portrait.evaluate(image => ({ mask: getComputedStyle(image).maskImage, fit: getComputedStyle(image).objectFit }));
          if (layout.researchDetail.mask !== 'none') issues.push({ view, width, researchDetail: layout.researchDetail });
          await page.screenshot({ path: join(output, `research-details-${width}.png`) });
        }
        if (view === 'base-fleet') {
          for (const family of ['OFFENSIVE', 'DEFENSIVE', 'SPECIALIST', 'CARGO']) {
            const band = page.locator(`[data-hull-family-group="${family}"] > button`);
            if (await band.getAttribute('aria-expanded') !== 'true') await band.click();
            const cards = page.locator(`[data-hull-family-group="${family}"] [data-summary="hull"]`);
            await cards.first().scrollIntoViewIfNeeded();
            await cards.locator('img[data-complete-scene]').evaluateAll(async images => {
              const visible = images.filter(image => {
                const bounds = image.getBoundingClientRect();
                return bounds.bottom > 0 && bounds.top < innerHeight;
              });
              await Promise.all(visible.map(image => image.decode()));
            });
            const measured = await cards.evaluateAll(nodes => nodes.map(node => {
              const image = node.querySelector('img[data-complete-scene]');
              const well = node.querySelector('[data-art]').getBoundingClientRect();
              const copy = node.querySelector('[data-card-copy]').getBoundingClientRect();
              const grid = getComputedStyle(node.parentElement.parentElement);
              return { image: image.getAttribute('src'), fit: getComputedStyle(image).objectFit,
                imageRatio: well.width / well.height, overlap: well.bottom - copy.top, columnGap: grid.columnGap, rowGap: grid.rowGap };
            }));
            for (const ship of measured) if (ship.fit !== 'contain' || Math.abs(ship.imageRatio - 1.5) > 0.02 || ship.overlap > 1 || ship.columnGap !== '12px' || ship.rowGap !== '12px') issues.push({ view, width, family, ship });
            await page.screenshot({ path: join(output, `ships-${family.toLowerCase()}-${width}.png`) });
            const first = cards.first();
            await first.locator('[data-open-item]').click();
            await page.locator('[data-build-scene] img[data-complete-scene]').evaluate(image => image.decode());
            await page.screenshot({ path: join(output, `ship-detail-${family.toLowerCase()}-${width}.png`) });
            await page.locator('[data-sheet-panel]').last().getByRole('button', { name: /^(Kapat|Close)$/ }).click();
          }
        }
        if (view === 'away') {
          layout.headerInset = await page.locator('[data-sheet-panel]').evaluate(panel =>
            panel.querySelector('.sheet-art-head').getBoundingClientRect().top - panel.getBoundingClientRect().top);
          if (layout.headerInset > 2) issues.push({ view, width, headerInset: layout.headerInset });
        }
        records.push({ view, width, layout });
        if (layout.width > width || layout.brokenImages.length) issues.push({ view, width, layout });
        if (view === 'base-production' && width === 350) {
          await page.locator('[data-layout="card"]').nth(2).scrollIntoViewIfNeeded();
          await page.screenshot({ path: join(output, 'production-lower-350.png') });
          for (const [tab, label] of [['orbit', 'Bilgi'], ['defend', 'Savunma']]) {
            await page.getByRole('tab', { name: label, exact: true }).click();
            await page.locator('[data-layout="card"]').first().scrollIntoViewIfNeeded();
            await page.screenshot({ path: join(output, `${tab}-350.png`) });
          }
        }
        await page.close();
      }
      const page = await browser.newPage({ viewport: { width, height: width === 585 ? 1266 : 812 } });
      await page.goto(`${web}/v2-gallery.html?lng=tr`, { waitUntil: 'networkidle' });
      for (const [label, name] of [['B1 · top bar', 'topbar'], ['B4 · dock', 'dock']]) {
        await page.locator('section').filter({ has: page.getByText(label, { exact: true }) }).screenshot({ path: join(output, `${name}-${width}.png`) });
      }
      await page.close();
      console.log(`Atmosphere ${width}px complete`);
    }
    for (const language of ['tr', 'en', 'de', 'fr', 'es', 'ja']) {
      for (const view of ['menu', 'base-production', 'fleet', 'clan', 'base-research']) {
        const page = await browser.newPage({ viewport: { width: 350, height: 812 } });
        page.on('pageerror', error => issues.push({ view, language, error: error.message }));
        await page.goto(`${web}/v2-gallery.html?view=${view}&lng=${language}`, { waitUntil: 'networkidle' });
        if (view === 'base-production') await page.locator('[data-layout="card"]').first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: join(output, `${view}-${language}-350.png`) });
        const width = await page.evaluate(() => document.documentElement.scrollWidth);
        if (width > 350) issues.push({ view, language, width });
        await page.close();
      }
      console.log(`Atmosphere ${language} complete`);
    }
  } finally {
    await browser.close();
    await writeFile(join(output, 'review.json'), JSON.stringify({ records, issues, renderer: 'Headless Chromium; actual device FPS not measured.' }, null, 2));
  }
  if (issues.length) throw Error(`Atmosphere visual review found ${issues.length} issues; see review.json`);
}
