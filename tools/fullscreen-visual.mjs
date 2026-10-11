import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Isolated masthead over a game panel; real native API and mocked unsupported API. */
export async function verifyFullscreen(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const measurements = [];
  try {
    for (const width of [350, 1280]) for (const language of ['tr', 'en', 'de', 'es', 'fr', 'ja']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=base-fleet&lng=${language}`);
        await page.getByRole('tab').first().waitFor();
        await page.evaluate(async language => {
          const resources = performance.getEntriesByType('resource').map(entry => entry.name);
          const moduleUrl = path => resources.findLast(name => new URL(name).pathname === path) ?? path;
          const reactUrl = resources.find(name => /\/react\.js\?/.test(name));
          const domUrl = resources.find(name => /\/react-dom_client\.js\?/.test(name));
          if (!reactUrl || !domUrl) throw new Error('Gallery modules not loaded');
          const [{ default: { createElement: h } }, { default: { createRoot } }, { BrandMasthead }, { default: i18n }] = await Promise.all([
            import(reactUrl), import(domUrl), import(moduleUrl('/src/brand/Identity.tsx')), import(moduleUrl('/src/i18n/index.ts')),
          ]);
          await i18n.changeLanguage(language);
          document.getElementById('root').style.display = 'none';
          const mount = document.createElement('div');
          mount.className = 'v2-shell relative z-10 flex h-dvh flex-col overflow-hidden bg-v2-void';
          mount.style.cssText = 'position:fixed;inset:0;--v2-top-h:44px;--v2-dock-h:0px';
          document.body.append(mount);
          createRoot(mount).render(h('div', null,
            h(BrandMasthead, { onShop() { /* Only the fullscreen control is exercised here. */ } }),
            h('div', { 'data-game-panel': '', style: { position: 'fixed', inset: '44px 0 0', zIndex: 20,
              background: '#07111a', padding: 24, color: '#8bafbb' } }, 'Astera Online'),
          ));
        }, language);
        const button = page.locator('[data-fullscreen-button]');
        await button.waitFor();
        const geometry = await button.evaluate(element => {
          const bounds = element.getBoundingClientRect();
          const shop = element.previousElementSibling;
          return { width: bounds.width, height: bounds.height, right: bounds.right,
            fits: document.documentElement.scrollWidth <= innerWidth, shop: shop.hasAttribute('data-shop-button'),
            compact: !shop.querySelector('[data-icon="i-spark"]'), shopWidth: shop.getBoundingClientRect().width };
        });
        assert(geometry.fits && geometry.shop && geometry.compact && geometry.width >= 44 && geometry.height >= 44 && geometry.right <= width, JSON.stringify(geometry));
        await page.screenshot({ path: join(output, `${width}-${language}-topbar.png`) });
        await button.click();
        await page.waitForFunction(() => document.fullscreenElement === document.documentElement);
        await page.waitForFunction(() => document.querySelector('[data-fullscreen-button]').getAttribute('aria-pressed') === 'true');
        assert(await page.locator('[data-game-panel]').isVisible(), 'Whole-document fullscreen must include sibling panels');
        await button.click();
        await page.waitForFunction(() => !document.fullscreenElement && document.querySelector('[data-fullscreen-button]').getAttribute('aria-pressed') === 'false');
        // The browser can exit independently of the component (Esc/swipe use the same event).
        await button.click();
        await page.waitForFunction(() => !!document.fullscreenElement);
        await page.evaluate(() => document.exitFullscreen());
        await page.waitForFunction(() => document.querySelector('[data-fullscreen-button]').getAttribute('aria-pressed') === 'false');
        await page.evaluate(() => {
          Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: undefined });
          Object.defineProperty(document.documentElement, 'webkitRequestFullscreen', { configurable: true, value: undefined });
          Object.defineProperty(navigator, 'userAgent', { configurable: true,
            value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile Safari/604.1' });
          // Avoid Linux client hints selecting desktop instructions in iPhone emulation.
          Object.defineProperty(navigator, 'userAgentData', { configurable: true, value: undefined });
          window.dispatchEvent(new Event('focus'));
        });
        await button.click();
        const dialog = page.getByRole('dialog');
        await dialog.waitFor();
        const help = await dialog.evaluate(element => {
          const bounds = element.getBoundingClientRect();
          const topmost = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
          return { fits: bounds.x >= 0 && bounds.right <= innerWidth && element.scrollWidth <= element.clientWidth + 1,
            visible: bounds.y >= 0 && bounds.bottom <= innerHeight, topmost: !!topmost && element.contains(topmost),
            centered: Math.abs((bounds.y + bounds.bottom) / 2 - innerHeight / 2) < 1,
            insideMasthead: !!element.closest('.brand-masthead'), text: element.textContent };
        });
        await page.screenshot({ path: join(output, `${width}-${language}-iphone-help.png`) });
        assert(help.topmost && !help.insideMasthead && help.fits && help.visible && help.centered, JSON.stringify(help));
        assert(await dialog.locator('ol li').count() === 3, 'Show the actionable Home Screen steps');
        await dialog.locator('header button').last().click();
        await dialog.waitFor({ state: 'hidden' });
        assert.deepEqual(errors, []);
        measurements.push({ width, language, ...geometry, help });
        console.log(`PASS fullscreen: ${width}px ${language}, native enter/exit, external exit, visible iPhone guide`);
      } catch (error) {
        await page.screenshot({ path: join(output, `${width}-${language}-failure.png`) }).catch(() => undefined);
        throw error;
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(measurements, null, 2)}\n`);
}
