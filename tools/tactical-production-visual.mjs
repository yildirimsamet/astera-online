import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

export async function verifyTacticalProduction(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const checks = [];
  try {
    for (const width of [350, 1280].filter(value => !process.env.ASTERA_VISUAL_WIDTHS || process.env.ASTERA_VISUAL_WIDTHS.split(',').includes(String(value)))) for (const language of ['tr', 'en', 'de', 'fr', 'es', 'ja'].filter(value => !process.env.ASTERA_VISUAL_LANGS || process.env.ASTERA_VISUAL_LANGS.split(',').includes(value))) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => { errors.push(error.message); console.error(`${language}/${width}: ${error.message}`); });
      await page.routeWebSocket('**/*', () => undefined);
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=leaderboard&lng=${language}`);
      await page.locator('[data-v2-leaderboard]').waitFor();
      await page.addStyleTag({ content: '.sticky { position: static !important; }' });
      await page.evaluate(async () => {
        const resources = performance.getEntriesByType('resource').map(entry => entry.name);
        const url = path => resources.findLast(name => new URL(name).pathname === path) ?? path;
        const [{ default: { createElement: h } }, { default: { createRoot } }, { QueryClient, QueryClientProvider },
          { Api }, { ApiProvider }, { ToastProvider }, { PlanetScreen }, { planetView }, { keys }] = await Promise.all([
          import(resources.find(name => /\/react\.js\?/.test(name))), import(resources.find(name => /\/react-dom_client\.js\?/.test(name))),
          import(resources.find(name => /\/@tanstack_react-query\.js\?/.test(name))), import(url('/src/api/client.ts')),
          import(url('/src/api/context.tsx')), import(url('/src/ui/Toast.tsx')), import(url('/src/screens/PlanetScreen.tsx')),
          import(url('/test/fixtures.ts')), import(url('/src/api/keys.ts')),
        ]);
        document.getElementById('root').style.display = 'none';
        const mount = document.createElement('div');
        mount.style.cssText = 'width:min(100%,700px);margin:auto;box-sizing:border-box';
        document.body.append(mount);
        const root = createRoot(mount);
        const api = new Api({ fetch: async () => new Response('{}', { status: 200 }) });
        window.__tacticalReview = (state, group) => {
          const busy = ['BUILDING', 'PAUSED'].includes(state) ? state : 'READY';
          const asset = (id, status) => ({ id, status, readyAt: status === 'BUILDING' ? new Date(Date.now() + 60000) : null, remainingSeconds: 60 });
          const empty = ['EMPTY', 'LOCKED'].includes(state);
          const deathStars = empty ? [] : state === 'MIXED' ? [asset('ds-1', 'READY'), asset('ds-2', 'PAUSED')] : [asset('ds-1', busy)];
          const interceptors = empty ? [] : state === 'MIXED' ? [asset('ab-1', 'READY'), asset('ab-2', 'BUILDING'), asset('ab-3', 'PAUSED')] : [asset('ab-1', busy)];
          const radiationBombs = empty ? [] : [1, 2, 3].map(level => ({ ...asset(`rb-${level}`, state === 'MIXED' ? ['READY', 'PAUSED', 'LAUNCHED'][level - 1] : state === 'LAUNCHED' ? state : busy), level }));
          const world = planetView({ radiationBombsAvailable: true, deathStars, interceptors, radiationBombs,
            buildings: { CORE: state === 'LOCKED' ? 12 : 13, SHIPYARD: 5, REFINERY: 4, EXTRACTOR: 4, VAULT: 2 },
            instruments: { RADAR: state === 'LOCKED' ? 0 : 3 }, orbit: state === 'LOCKED' ? [] : ['UPLINK'],
          }, { alloy: 500000, crystal: 500000, deuterium: 500000 });
          world.research = world.research.map(project => project.id === 'STRATEGIC_STOCKPILE'
            ? { ...project, level: state === 'MIXED' ? 1 : 0, discovered: true }
            : project.id === 'INTERCEPTION_GRID' ? { ...project, level: 1, discovered: true } : project);
          const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
          client.setQueryData(keys.planet, world);
          root.render(h(QueryClientProvider, { client }, h(ApiProvider, { api }, h(ToastProvider, null, h(PlanetScreen, { key: `${state}-${group}`, focusGroup: group })))));
        };
      });
      const states = ['EMPTY', 'READY', ...(['tr', 'en'].includes(language) ? ['BUILDING', 'PAUSED', 'LAUNCHED', 'MIXED', 'LOCKED'] : [])]
        .filter(value => !process.env.ASTERA_VISUAL_STATES || process.env.ASTERA_VISUAL_STATES.split(',').includes(value));
      for (const state of states) for (const group of ['tactical', 'defend']) {
        await page.evaluate(({ state, group }) => { window.__tacticalReview(state, group); }, { state, group });
        const scope = page.locator(`[data-base-surface="${group}"]`);
        await scope.waitFor({ timeout: 60000 });
        const card = scope.locator(group === 'tactical' ? '[data-strategic-state]' : '[data-interceptor-state]');
        await card.waitFor({ timeout: 60000 });
        for (const image of await scope.locator('.tactical-production__scene img').all()) {
          await image.scrollIntoViewIfNeeded();
          await image.evaluate(node => node.decode());
        }
        const measured = await scope.evaluate(node => ({
          fits: [...node.querySelectorAll('.tactical-production, .tactical-stock, .tactical-production button')].every(part => part.scrollWidth <= part.clientWidth + 1 && part.getBoundingClientRect().right <= innerWidth + 1),
          documentFits: document.documentElement.scrollWidth <= innerWidth,
          overflow: [...node.querySelectorAll('.tactical-production, .tactical-stock, .tactical-production button')].filter(part => part.scrollWidth > part.clientWidth + 1).map(part => ({ tag: part.tagName, class: part.className, text: part.textContent, width: part.clientWidth, content: part.scrollWidth })),
          documentWidth: document.documentElement.scrollWidth,
          outside: [...document.querySelectorAll('body *')].filter(part => part.getBoundingClientRect().right > innerWidth + 1).slice(-8).map(part => ({ tag: part.tagName, class: part.getAttribute('class'), text: part.textContent?.slice(0, 100) })),
          translated: !/planet\.(?:tacticalStock|deathStar|radiationBomb|interceptor)\.|focus\.planet\.deathStar/.test(node.textContent),
          tally: [...node.querySelectorAll('[data-tally]')].map(tally => ({ used: Number(tally.getAttribute('data-used')), total: Number(tally.getAttribute('data-total')), cells: [...tally.querySelectorAll('[data-cell]')].map(cell => cell.getAttribute('data-cell')) })),
          levels: [...node.querySelectorAll('[data-radiation-level]')].map(badge => badge.querySelectorAll('svg').length),
          scenes: node.querySelectorAll('.tactical-production__scene img').length,
        }));
        assert(measured.fits, `${language}/${width}/${state}/${group}: overflow ${JSON.stringify({ local: measured.overflow, documentWidth: measured.documentWidth, outside: measured.outside })}`);
        if (!measured.documentFits) console.log(JSON.stringify({ language, width, state, group, unrelatedOverflow: measured.outside }));
        assert(measured.translated);
        assert.equal(measured.scenes, group === 'tactical' ? 4 : 1);
        const occupied = ['EMPTY', 'LOCKED'].includes(state) ? 0 : state === 'MIXED' ? group === 'tactical' ? 2 : 3 : 1;
        assert.equal(measured.tally[0].used, occupied);
        assert.equal(measured.tally[0].total, group === 'tactical' ? state === 'MIXED' ? 2 : 1 : 4);
        if (state === 'MIXED') assert.deepEqual(measured.tally[0].cells, group === 'tactical' ? ['ready', 'paused'] : ['ready', 'loading', 'paused', 'empty']);
        if (group === 'tactical') {
          assert.deepEqual(measured.levels, [1, 2, 3]);
          assert(measured.tally.slice(1).every(tally => tally.total === 1 && tally.used === (['EMPTY', 'LOCKED'].includes(state) ? 0 : 1)));
        }
        await (group === 'tactical' ? scope : card).screenshot({ path: `${output}/${language}-${width}-${state.toLowerCase()}-${group}.png` });
        checks.push({ language, width, state, group, ...measured });
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(`${output}/checks.json`, JSON.stringify(checks, null, 2));
  console.log(JSON.stringify({ output, states: checks.length, passed: true }));
}
