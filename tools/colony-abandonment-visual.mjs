/** Actual colony management and confirmation, fixture API, phone and desktop. No game writes. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

export async function verifyColonyAbandonment(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [];
  try {
    for (const width of [350, 1280]) {
      for (const language of ['tr', 'en', 'de', 'fr', 'es', 'ja']) {
        const page = await browser.newPage({ viewport: { width, height: 812 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        // Other edits in the shared workspace must not reload this fixture mount.
        await page.routeWebSocket('**/*', () => undefined);
        await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=base-fleet&lng=${language}`);
        await page.getByRole('tab').first().waitFor();
        const labels = await page.evaluate(async language => {
          const resources = performance.getEntriesByType('resource').map(entry => entry.name);
          const reactUrl = resources.find(name => /\/react\.js\?/.test(name));
          const domUrl = resources.find(name => /\/react-dom_client\.js\?/.test(name));
          const queryUrl = resources.find(name => /\/@tanstack_react-query\.js\?/.test(name));
          if (!reactUrl || !domUrl || !queryUrl) throw new Error('Gallery modules not loaded');
          // Reuse the gallery's exact module identities, including Vite timestamps.
          const moduleUrl = path => resources.findLast(name => new URL(name).pathname === path) ?? path;
          const [
            { default: { createElement: h } }, { default: { createRoot } },
            { QueryClient, QueryClientProvider }, { Api }, { ApiProvider }, { WorldProvider },
            { keys }, { PlanetScreen }, { Sheet }, { ToastProvider }, { planetView }, { default: i18n },
          ] = await Promise.all([
            import(reactUrl), import(domUrl), import(queryUrl), import(moduleUrl('/src/api/client.ts')),
            import(moduleUrl('/src/api/context.tsx')), import(moduleUrl('/src/api/world.tsx')), import(moduleUrl('/src/api/keys.ts')),
            import(moduleUrl('/src/screens/PlanetScreen.tsx')), import(moduleUrl('/src/v2/kit/Sheet.tsx')),
            import(moduleUrl('/src/ui/Toast.tsx')), import(moduleUrl('/test/fixtures.ts')), import(moduleUrl('/src/i18n/index.ts')),
          ]);
          await i18n.changeLanguage(language);
          const homeId = '00000000-0000-4000-8000-000000000001';
          const colonyId = '00000000-0000-4000-8000-000000000003';
          const stock = { alloy: 40_000, crystal: 3000, deuterium: 900 };
          const development = {
            buildings: { CORE: 6, REFINERY: 5, EXTRACTOR: 5, VAULT: 2, SHIPYARD: 4, HANGAR: 3 },
            academyStep: null, rulesetVersion: 14, loyalty: { value: 100, minutesLeft: null },
          };
          const capital = planetView(development, { ...stock, id: homeId, name: 'Kestrel', kind: 'CAPITAL' });
          const colony = planetView(development, { ...stock, id: colonyId, name: 'Haven', kind: 'COLONY' });
          const list = { playerId: 'owner', seasonId: 'season', capitalPlanetId: homeId, planets: [capital, colony] };
          const storageKey = 'astera:world:v1:season:owner';
          localStorage.setItem(storageKey, colonyId);
          const review = { reasons: [], requests: [], abandoned: false, homeId, colonyId, storageKey };
          window.__abandonReview = review;
          const api = new Api({ fetch: async (input, init) => {
            const url = String(input);
            review.requests.push({ url, method: init?.method ?? 'GET', body: init?.body ?? null });
            let body;
            if (url.endsWith('/abandon')) {
              if (init?.method === 'POST') {
                if (review.reasons.length) throw new Error('Disabled action sent a POST');
                review.abandoned = true;
                body = { abandonedPlanetId: colonyId, capital };
              } else body = { planetId: colonyId, allowed: review.reasons.length === 0, reasons: review.reasons };
            } else if (url.endsWith('/api/planets')) {
              body = { ...list, planets: review.abandoned ? [capital] : list.planets };
            } else if (url.endsWith(homeId) || url.endsWith('/api/planet')) body = capital;
            else if (url.endsWith(colonyId)) body = colony;
            else throw new Error(`Unexpected fixture request: ${url}`);
            return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
          } });
          const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
          client.setQueryData(keys.planets, list);
          client.setQueryData(keys.planetById(homeId), capital);
          client.setQueryData(keys.planetById(colonyId), colony);
          document.getElementById('root').style.display = 'none';
          const mount = document.createElement('div');
          mount.style.cssText = '--v2-top-h:64px;--v2-dock-h:56px';
          document.body.append(mount);
          createRoot(mount).render(h(ApiProvider, { api }, h(QueryClientProvider, { client },
            h(WorldProvider, null, h(ToastProvider, null,
              h(Sheet, { title: 'Haven', quietTitle: true, detents: ['full'], placement: 'page', bleed: true, onClose: () => undefined },
                h(PlanetScreen, { focusGroup: 'grow' })),
            )),
          )));
          return Object.fromEntries(['action', 'title', 'cancel', 'confirm', 'recheck', 'blocked'].map(key => [key, i18n.t(`planet.abandon.${key}`)]));
        }, language);
        const action = page.getByRole('button', { name: labels.action, exact: true });
        await action.waitFor().catch(async error => {
          await page.screenshot({ path: join(output, `${language}-${width}-setup-failure.png`) });
          console.error(JSON.stringify({ errors, state: await page.evaluate(() => ({
            review: window.__abandonReview, text: document.body.innerText,
          })) }, null, 2));
          throw error;
        });
        await page.screenshot({ path: join(output, `${language}-${width}-management.png`) });
        await action.click();
        const dialog = page.getByRole('dialog', { name: labels.title, exact: true });
        const confirm = dialog.getByRole('button', { name: labels.confirm, exact: true });
        await confirm.waitFor();
        await page.waitForFunction(label => [...document.querySelectorAll('button')].some(button => button.textContent === label && !button.disabled), labels.confirm);
        assert.equal(await dialog.getByText('Haven', { exact: true }).count(), 1);
        const measure = () => dialog.evaluate(panel => ({
          fits: panel.scrollWidth <= panel.clientWidth && document.documentElement.scrollWidth <= innerWidth,
          titleFits: panel.querySelector('h2').scrollWidth <= panel.querySelector('h2').clientWidth,
          buttons: [...panel.querySelectorAll('button')].filter(button => button.textContent.trim()).map(button => {
            const rect = button.getBoundingClientRect();
            return { height: rect.height, inView: rect.top >= 0 && rect.bottom <= innerHeight, fits: button.scrollWidth <= button.clientWidth };
          }),
        }));
        const eligible = await measure();
        await page.screenshot({ path: join(output, `${language}-${width}-eligible.png`) });
        assert(eligible.fits && eligible.titleFits, `${language}/${width}: confirmation overflow ${JSON.stringify(eligible)}`);
        assert(eligible.buttons.every(button => button.height >= 44 && button.inView && button.fits));
        await dialog.getByRole('button', { name: labels.cancel, exact: true }).click();
        assert.equal(await page.evaluate(() => window.__abandonReview.requests.filter(request => request.method === 'POST').length), 0);
        await page.evaluate(() => { window.__abandonReview.reasons = ['FLIGHT', 'CLAN_SUPPORT', 'MINING']; });
        await action.click();
        await dialog.getByRole('alert').waitFor();
        assert.equal(await dialog.getByRole('alert').locator('li').count(), 3);
        assert.equal(await confirm.isDisabled(), true);
        const blocked = await measure();
        assert(blocked.fits && blocked.buttons.every(button => button.inView && button.fits));
        await page.screenshot({ path: join(output, `${language}-${width}-blocked.png`) });
        await page.evaluate(() => { window.__abandonReview.reasons = []; });
        await dialog.getByRole('button', { name: labels.recheck, exact: true }).click();
        await page.waitForFunction(label => [...document.querySelectorAll('button')].some(button => button.textContent === label && !button.disabled), labels.confirm);
        await confirm.click();
        await dialog.waitFor({ state: 'detached' });
        await action.waitFor({ state: 'detached' });
        const result = await page.evaluate(() => {
          const review = window.__abandonReview;
          return { posts: review.requests.filter(request => request.method === 'POST'), selection: localStorage.getItem(review.storageKey), homeId: review.homeId };
        });
        assert.equal(result.posts.length, 1);
        assert.deepEqual(JSON.parse(result.posts[0].body), { confirm: true });
        assert.equal(result.selection, result.homeId);
        assert.deepEqual(errors, []);
        results.push({ language, width, fixture: true, eligible, blocked, posts: result.posts.length, selection: result.selection, errors });
        console.log(`PASS ${language} ${width}px: confirmation, three blockers, recheck and capital selection`);
        await page.close();
      }
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
}
