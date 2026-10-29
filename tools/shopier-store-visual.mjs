import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/**
 * The Shopier own-page flow in the real store and admin components, against an isolated fixture
 * API: no account, no order and no Shopier call is real. Phone and desktop, Turkish and English.
 */
export async function verifyShopierStore(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const measurements = [];
  try {
    for (const width of [350, 1280]) for (const language of ['tr', 'en']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=base-fleet&lng=${language}`);
      await page.getByRole('tab').first().waitFor();
      await page.evaluate(async language => {
        const resources = performance.getEntriesByType('resource').map(entry => entry.name);
        const moduleUrl = path => resources.findLast(name => new URL(name).pathname === path) ?? path;
        const reactUrl = resources.find(name => /\/react\.js\?/.test(name));
        const domUrl = resources.find(name => /\/react-dom_client\.js\?/.test(name));
        const queryUrl = resources.find(name => /\/@tanstack_react-query\.js\?/.test(name));
        if (!reactUrl || !domUrl || !queryUrl) throw new Error('Gallery modules not loaded');
        const [{ default: { createElement: h } }, { default: { createRoot } }, { QueryClient, QueryClientProvider },
          { Api }, { ApiProvider }, { default: SkinsScreen }, { default: AdminPanel }, { default: i18n }] = await Promise.all([
          import(reactUrl), import(domUrl), import(queryUrl), import(moduleUrl('/src/api/client.ts')),
          import(moduleUrl('/src/api/context.tsx')), import(moduleUrl('/src/screens/SkinsScreen.tsx')),
          import(moduleUrl('/src/screens/AdminPanel.tsx')), import(moduleUrl('/src/i18n/index.ts')),
        ]);
        await i18n.changeLanguage(language);
        const lira = amount => ({ formatted: `₺${amount}`, currencyCode: 'TRY', amount: amount * 100 });
        const euro = { formatted: '€2.99', currencyCode: 'EUR', amount: 299 };
        const now = new Date();
        const queue = [
          { orderId: '329289771', status: 'UNMATCHED', reason: 'ACCOUNT_MISSING', itemId: 'planet-toxic', username: null,
            note: 'komutanim_uzun_bir_isim_123', total: '99.00', currency: 'TRY', receivedAt: now, closed: false },
          { orderId: '329289772', status: 'UNMATCHED', reason: 'UNKNOWN_PRODUCT', itemId: null, username: null,
            note: '', total: '499.00', currency: 'TRY', receivedAt: now, closed: false },
          { orderId: '329289773', status: 'MATCHED', reason: null, itemId: 'ring-aurora', username: 'izci',
            note: '', total: '49.00', currency: 'TRY', receivedAt: now, closed: true },
        ];
        const review = { calls: [], unexpected: [] };
        const api = new Api({ fetch: async input => {
          const url = new URL(String(input), location.origin);
          review.calls.push(url.pathname);
          let answer;
          if (url.pathname === '/api/skins') answer = { ownedSkinIds: ['planet-lava'], ownedCosmeticIds: ['planet-lava'], equipment: {},
            clanFlagId: null, canEquipFlag: false, planets: [{ id: '00000000-0000-4000-8000-000000000009', name: 'Orion', skinId: null }] };
          else if (url.pathname === '/api/skins/polar-shop') answer = { enabled: true };
          else if (url.pathname === '/api/skins/polar-pricing') answer = { countryCode: 'TR', prices: {
            'planet-lava': lira(99), 'planet-ice': lira(99), 'planet-toxic': lira(99), 'planet-desert': lira(99), 'planet-turkey': lira(99),
            'planet-germany': euro, 'planet-france': euro, 'planet-spain': euro, 'planet-japan': euro, bundle: lira(279), 'ring-aurora': lira(49) } };
          else if (url.pathname === '/api/skins/shopier-shop') answer = { enabled: true, prices: {
            'planet-lava': 9900, 'planet-ice': 9900, 'planet-toxic': 9900, 'planet-desert': 9900, 'planet-turkey': 9900, bundle: 27900, 'ring-aurora': 4900 } };
          else if (url.pathname === '/api/skins/shopier-checkout') answer = { url: 'https://www.shopier.com/61000001', amount: 9900, currency: 'TRY',
            expiresAt: new Date(Date.now() + 48 * 3_600_000).toISOString() };
          else if (url.pathname === '/api/admin/shopier/orders') answer = { orders: queue };
          else { review.unexpected.push(url.pathname); throw new Error(`Unexpected fixture request: ${url.pathname}`); }
          return new Response(JSON.stringify(answer), { headers: { 'content-type': 'application/json' } });
        } });
        const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
        document.getElementById('root').style.display = 'none';
        const mount = document.createElement('div');
        mount.style.cssText = 'position:fixed;inset:0;z-index:100;overflow-y:auto;background:#07111a;--v2-top-h:0px;--v2-dock-h:0px';
        document.body.append(mount);
        const root = createRoot(mount);
        const wrap = child => h(QueryClientProvider, { client }, h(ApiProvider, { api }, child));
        root.render(wrap(h(SkinsScreen, { commander: 'Samet', onOpenInventory() { /* fixture */ } })));
        review.renderAdmin = () => root.render(wrap(h(AdminPanel)));
        window.__shopierReview = review;
      }, language);
      const t = language === 'tr'
        ? { pay: 'Shopier ile öde · ₺99', page: 'Sana özel ödeme sayfası', tab: 'Shopier', toxic: /Zehir/ }
        : { pay: 'Pay with Shopier · ₺99', page: 'Your own payment page', tab: 'Shopier', toxic: /Toxic/ };
      // The store's 3D stage overflows on purpose (orbit, embers); only this work's surfaces are measured.
      const measure = async name => {
        const geometry = await page.evaluate(pageTitle => {
          const mount = document.body.lastElementChild;
          const panel = mount.querySelector(`[aria-label="${pageTitle}"]`);
          const checked = [...mount.querySelectorAll('li, button, a'), ...(panel ? [panel, ...panel.querySelectorAll('*')] : [])];
          return { fits: mount.scrollWidth <= innerWidth,
            overflow: checked.filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.textContent?.slice(0, 40)) };
        }, t.page);
        assert(geometry.fits && geometry.overflow.length === 0, JSON.stringify({ width, language, name, ...geometry }));
        measurements.push({ width, language, name, ...geometry });
      };
      await page.getByRole('button', { name: t.toxic }).first().click();
      await page.getByRole('button', { name: t.pay }).waitFor();
      await measure('store');
      await page.screenshot({ path: join(output, `${width}-${language}-store.png`), fullPage: false });
      await page.getByRole('button', { name: t.pay }).click();
      const panel = page.getByRole('region', { name: t.page });
      await panel.waitFor();
      await panel.scrollIntoViewIfNeeded();
      await measure('page');
      await panel.screenshot({ path: join(output, `${width}-${language}-page-panel.png`) });
      await page.screenshot({ path: join(output, `${width}-${language}-page.png`) });
      await page.evaluate(() => { window.__shopierReview.renderAdmin(); });
      await page.getByRole('tab', { name: t.tab, exact: true }).click();
      await page.getByText('komutanim_uzun_bir_isim_123').waitFor();
      await measure('admin');
      await page.screenshot({ path: join(output, `${width}-${language}-admin.png`) });
      const unexpected = await page.evaluate(() => window.__shopierReview.unexpected);
      assert.deepEqual(unexpected, []);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(measurements, null, 2)}\n`);
  return measurements;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await verifyShopierStore(process.argv[2] ?? 'out/shopier-store');
  console.log(JSON.stringify(result));
}
