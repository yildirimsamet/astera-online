import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Real components, fixture API: exercise narrow screens without changing a live galaxy. */
export async function verifyVacation(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [];
  try {
    for (const width of [1280, 350]) for (const language of ['tr', 'en', 'de', 'fr', 'es', 'ja']) {
      const page = await browser.newPage({ viewport: { width, height: 812 } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.routeWebSocket('**/*', () => undefined);
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=base-fleet&lng=${language}`);
      // The fixture uses the gallery's module instances, not a particular view's
      // tab layout. Wait for those dependencies even if gallery UI changes.
      await page.waitForFunction(() => {
        const names = performance.getEntriesByType('resource').map(e => e.name);
        return [/\/react\.js\?/, /\/react-dom_client\.js\?/, /\/@tanstack_react-query\.js\?/].every(pattern => names.some(name => pattern.test(name)));
      });
      const labels = await page.evaluate(async ({ language, rulesUrl }) => {
        const resources = performance.getEntriesByType('resource').map(e => e.name);
        const moduleUrl = path => resources.findLast(name => new URL(name).pathname === path) ?? path;
        const reactUrl = resources.find(name => /\/react\.js\?/.test(name));
        const domUrl = resources.find(name => /\/react-dom_client\.js\?/.test(name));
        const queryUrl = resources.find(name => /\/@tanstack_react-query\.js\?/.test(name));
        if (!reactUrl || !domUrl || !queryUrl) throw new Error('Gallery modules unavailable');
        const [{ default: { createElement: h } }, { default: { createRoot } }, { QueryClient, QueryClientProvider },
          { Api }, { ApiProvider }, { WorldProvider }, { keys }, { VacationSheet }, { PlanetScreen },
          { planetView }, { ToastProvider }, { default: i18n }, rules] = await Promise.all([
          import(reactUrl), import(domUrl), import(queryUrl), import(moduleUrl('/src/api/client.ts')),
          import(moduleUrl('/src/api/context.tsx')), import(moduleUrl('/src/api/world.tsx')),
          import(moduleUrl('/src/api/keys.ts')), import(moduleUrl('/src/screens/VacationSheet.tsx')),
          import(moduleUrl('/src/screens/PlanetScreen.tsx')), import(moduleUrl('/test/fixtures.ts')),
          import(moduleUrl('/src/ui/Toast.tsx')), import(moduleUrl('/src/i18n/index.ts')),
          import(rulesUrl),
        ]);
        await i18n.changeLanguage(language);
        const id = '00000000-0000-4000-8000-000000000001';
        const worlds = [
          { id, name: 'Asterion', kind: 'CAPITAL', coreLevel: 17 },
          { id: 'colony-1', name: 'Kestrel Observatory', kind: 'COLONY', coreLevel: 12 },
          { id: 'colony-2', name: 'Andromeda', kind: 'COLONY', coreLevel: 15 },
          { id: 'colony-3', name: '遠い星の観測基地', kind: 'COLONY', coreLevel: 9 },
        ];
        const review = { active: null, posts: [], worlds, blocked: false };
        window.__vacationReview = review;
        const data = days => ({ active: review.active, days, maxDays: 3, worlds,
          seasonEndsAt: new Date(Date.now() + 10 * 86400000), price: rules.vacationCost(days, worlds.map(w => ({ id: w.id, coreLevel: w.coreLevel, capital: w.kind === 'CAPITAL' }))),
          store: review.blocked ? 0 : 1000, buffer: review.blocked ? 0 : 40000,
          blocker: review.blocked ? 'VACATION_FLIGHTS' : null,
          reasons: review.blocked ? ['VACATION_FLEET', 'VACATION_PROBES', 'VACATION_MINING', 'VACATION_PIRATES',
            'VACATION_TRADE', 'VACATION_CONVOY', 'VACATION_SUPPORT_SENT', 'VACATION_SUPPORT_HOSTED',
            'VACATION_CLAN_FLEET', 'VACATION_CLAN_OPERATION', 'VACATION_MONUMENT_FLEET',
            'VACATION_MONUMENT_PROBES', 'VACATION_STRATEGIC', 'VACATION_FUNDS'] : [], fingerprint: 'a'.repeat(64) });
        const base = planetView({ buildings: { CORE: 9, REFINERY: 9, EXTRACTOR: 9, VAULT: 9, SHIPYARD: 4 },
          academyStep: null, queues: { CONSTRUCTION: [], YARD: [] } },
        { id, name: 'Asterion', alloy: 1000000, crystal: 1000000, deuterium: 1000000,
          alloyCap: 2000000, crystalCap: 2000000, deuteriumCap: 2000000 });
        const list = { playerId: 'owner', seasonId: 'season', capitalPlanetId: id, planets: [base] };
        const api = new Api({ fetch: async (input, init) => {
          const url = new URL(String(input), location.origin);
          if (init?.method === 'POST') review.posts.push(url.pathname);
          let body;
          if (url.pathname === '/api/vacation') body = data(Number(url.searchParams.get('days') ?? 1));
          else if (url.pathname === '/api/planets') body = list;
          else if (url.pathname.startsWith('/api/planets/')) body = base;
          else throw new Error(`Unexpected fixture request ${url.pathname}`);
          return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
        } });
        const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
        client.setQueryData(keys.planets, list);
        client.setQueryData(keys.planetById(id), base);
        document.getElementById('root').style.display = 'none';
        const mount = document.createElement('div');
        document.body.append(mount);
        const root = createRoot(mount);
        const wrap = child => h(ApiProvider, { api }, h(QueryClientProvider, { client }, h(ToastProvider, null, child)));
        const vacation = () => root.render(wrap(h(VacationSheet, { onClose: () => undefined })));
        window.__vacationBlocked = () => {
          review.blocked = true;
          client.setQueryData([...keys.vacation, 1], data(1));
        };
        window.__vacationActive = () => {
          review.blocked = false;
          review.active = { id: 'vacation-1', startedAt: new Date(), endsAt: new Date(Date.now() + 86400000), days: 1, cost: 999 };
          client.setQueryData([...keys.vacation, 1], data(1));
          vacation();
        };
        window.__vacationCore = () => root.render(wrap(h(WorldProvider, null, h(PlanetScreen, { focusGroup: 'grow' }))));
        vacation();
        return { ...Object.fromEntries(['title', 'end', 'coreTitle', 'coreBack', 'blockersTitle'].map(key => [key, i18n.t(`vacation.${key}`)])),
          start: i18n.t('vacation.start', { count: 1 }) };
      }, { language, rulesUrl: `/@fs${new URL('../packages/rules/src/index.ts', import.meta.url).pathname}` });
      const measure = async state => {
        await page.waitForTimeout(350);
        const panel = page.getByRole('dialog').last();
        const bounds = await panel.boundingBox();
        assert(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 813, `${language}/${width}/${state}: modal leaves the viewport`);
        const fits = await panel.evaluate(node => node.scrollWidth <= node.clientWidth && document.documentElement.scrollWidth <= innerWidth);
        assert(fits, `${language}/${width}/${state}: horizontal overflow`);
        const buttons = await panel.locator(':scope > div:last-child button').evaluateAll(nodes => nodes.map(n => ({
          fits: n.scrollWidth <= n.clientWidth, visible: n.getBoundingClientRect().bottom <= innerHeight,
        })));
        assert(buttons.every(b => b.fits && b.visible), `${language}/${width}/${state}: clipped footer`);
        await page.screenshot({ path: join(output, `${language}-${width}-${state}.png`) });
        results.push({ language, width, state, fits, buttons });
      };
      await page.locator('[data-vacation-sheet]').waitFor();
      await measure('quote');
      await page.evaluate(() => window.__vacationBlocked());
      const blockers = page.getByRole('region', { name: labels.blockersTitle });
      await blockers.waitFor();
      assert.equal(await blockers.locator('li').count(), 14);
      assert(await page.getByRole('button', { name: labels.start, exact: true }).isDisabled());
      await measure('blocked');
      await page.evaluate(() => window.__vacationActive());
      await page.getByRole('button', { name: labels.end, exact: true }).click();
      await measure('early-return');
      await page.evaluate(() => window.__vacationCore());
      try { await page.locator('#row-CORE button[data-open-item]').click(); }
      catch (error) {
        await page.screenshot({ path: join(output, `${language}-${width}-core-error.png`) });
        throw new Error(`${language}/${width}: Core mount failed; ${errors.join('; ')}; ${await page.locator('body').innerText()}`, { cause: error });
      }
      const raise = page.getByRole('dialog').last().getByRole('button').filter({ hasText: /10/ }).last();
      await raise.click();
      await page.getByRole('heading', { name: labels.coreTitle, exact: true }).waitFor();
      await measure('core-warning');
      assert.deepEqual(await page.evaluate(() => window.__vacationReview.posts), []);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`PASS ${language}/${width}: vacation quote, early return and Core warning`);
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
}
