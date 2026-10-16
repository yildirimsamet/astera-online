import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Real clan surfaces with local fixtures; no game API mutations. */
export async function verifyClanEntry(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [];
  try {
    for (const width of [350, 1280]) for (const language of ['tr', 'en']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.routeWebSocket('**', socket => socket.close());
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=base-fleet&lng=${language}`);
      await page.getByRole('tab').first().waitFor();
      const border = await page.evaluate(() => {
        const style = selector => getComputedStyle(document.querySelector(selector));
        return ['#row-SHIPYARD [data-layout="card"]', '#row-HANGAR [data-layout="card"]', '#row-REPAIR_STATION']
          .map(selector => ({ color: style(selector).borderColor, width: style(selector).borderWidth }));
      });
      assert.deepEqual(border[2], border[0]);
      assert.deepEqual(border[1], border[0]);
      await page.evaluate(() => Promise.all([...document.querySelectorAll('#row-REPAIR_STATION img')]
        .map(image => image.decode().catch(() => undefined))));
      await page.locator('#row-REPAIR_STATION').scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(output, `repair-border-${language}-${width}.png`) });
      const labels = await page.evaluate(async language => {
        const urls = performance.getEntriesByType('resource').map(entry => entry.name);
        const moduleUrl = path => urls.findLast(url => new URL(url).pathname === path) ?? path;
        const [{ default: { createElement: h } }, { default: { createRoot } }, { QueryClient, QueryClientProvider },
          { Api }, { ApiProvider }, { keys }, { ClanScreen }, { default: i18n }] = await Promise.all([
          import(urls.find(url => /\/react\.js\?/.test(url))), import(urls.find(url => /\/react-dom_client\.js\?/.test(url))),
          import(urls.find(url => /\/@tanstack_react-query\.js\?/.test(url))),
          import(moduleUrl('/src/api/client.ts')), import(moduleUrl('/src/api/context.tsx')),
          import(moduleUrl('/src/api/keys.ts')), import(moduleUrl('/src/screens/ClanScreen.tsx')), import(moduleUrl('/src/i18n/index.ts')),
        ]);
        await i18n.changeLanguage(language);
        const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
        const api = new Api();
        const outside = { state: 'OUTSIDE', requests: [], depot: { alloy: 0, crystal: 0, deuterium: 0 },
          creation: { capitalPlanetId: 'me', coreLevel: 7, requiredCoreLevel: 7,
            cost: { alloy: 2000, crystal: 1000, deuterium: 0 }, affordable: true, unlockedAt: null } };
        const now = new Date();
        const clan = { id: 'crew', name: 'Yörünge Muhafızları', tag: 'ORB', description: 'Birlikte uç, birlikte dön.',
          recruiting: true, score: 840, role: 'LEADER', mature: true, matureAt: now, aidEnabled: true };
        const member = { state: 'MEMBER', clan, requests: [], members: [{ playerId: 'me', username: 'Vantage', role: 'LEADER',
          slot: 0, joinedAt: now, matureAt: now, mature: true, aidEnabled: true, lastActiveAt: now, activeRecently: true }] };
        let home = outside;
        api.clanHome = async () => home;
        api.markClanSeen = async () => ({ seen: true });
        api.clanDepot = async () => ({ resources: outside.depot, purseRemaining: outside.depot });
        api.clans = async () => ({ clans: [], total: 0 });
        api.clanEvents = async () => ({ events: [], nextBefore: null });
        api.clanLeaderboard = async () => ({ clans: [] });
        api.galaxy = async () => ({ you: { planetId: 'me', playerId: 'me', capitalPlanetId: 'me', planetIds: ['me'] }, planets: [] });
        document.getElementById('root').style.display = 'none';
        const mount = document.createElement('main');
        mount.style.cssText = 'max-width:480px;margin:12px auto;background:var(--color-v2-void)';
        document.body.append(mount);
        const root = createRoot(mount);
        client.setQueryData(keys.clanHome, home);
        root.render(h(QueryClientProvider, { client }, h(ApiProvider, { api }, h(ClanScreen))));
        window.__clanMember = () => { home = member; client.setQueryData(keys.clanHome, home); };
        return { join: i18n.t('clan.outside.joinAction'), found: i18n.t('clan.outside.foundAction'),
          support: i18n.t('clan.benefits.supportTitle'), war: i18n.t('clan.benefits.warTitle'), monument: i18n.t('clan.benefits.monumentTitle') };
      }, language);
      for (const heading of [labels.support, labels.war, labels.monument]) await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: join(output, `clan-outside-${language}-${width}.png`), fullPage: true });
      for (const [label, target] of [[labels.join, 'clan-directory-search'], [labels.found, 'clan-found-name']]) {
        await page.getByRole('link', { name: label }).click();
        assert.equal(await page.evaluate(() => document.activeElement.id), target);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.evaluate(() => window.__clanMember());
      await page.getByRole('heading', { name: 'Yörünge Muhafızları' }).waitFor();
      for (const heading of [labels.support, labels.war, labels.monument]) assert.equal(await page.getByRole('heading', { name: heading, exact: true }).count(), 1);
      await page.screenshot({ path: join(output, `clan-member-${language}-${width}.png`), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      results.push({ width, language, border, passed: true });
      await page.close();
      console.log(`PASS clan entry, member benefits and repair border: ${language}/${width}`);
    }
    const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.routeWebSocket('**', socket => socket.close());
    await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=planet-selection&lng=tr`);
    await page.locator('[data-selection-review] canvas').waitFor();
    const radii = await page.evaluate(async () => {
      const urls = performance.getEntriesByType('resource').map(entry => entry.name);
      const moduleUrl = path => urls.findLast(url => new URL(url).pathname === path) ?? path;
      const [{ default: { createElement: h, Suspense } }, { default: { createRoot } }, { Canvas }, { galaxySchema },
        { planetNodes }, { PlanetField }] = await Promise.all([
        import(urls.find(url => /\/react\.js\?/.test(url))), import(urls.find(url => /\/react-dom_client\.js\?/.test(url))),
        import(urls.find(url => /\/@react-three_fiber\.js\?/.test(url))), import(moduleUrl('/src/api/schemas.ts')),
        import(moduleUrl('/src/galaxy/scene.ts')), import(moduleUrl('/src/galaxy/PlanetField.tsx')),
      ]);
      const nodes = planetNodes(galaxySchema.parse({ you: { planetId: 'none', playerId: 'none' }, sensors: [],
        planets: [1, 11, 22].map((coreLevel, index) => ({ id: `scale-${coreLevel}`, name: `Core ${coreLevel}`,
          owner: 'Orion', position: { x: (index - 1) * 150, y: 0, z: 0 }, intel: 'RESOLVED', isSelf: false,
          isOwned: true, coreLevel, kind: 'CAPITAL' })) }).planets);
      document.getElementById('root').style.display = 'none';
      const mount = document.createElement('main');
      mount.style.cssText = 'height:440px;background:var(--color-v2-void)';
      document.body.append(mount);
      createRoot(mount).render(h(Canvas, { orthographic: true, camera: { position: [0, 0, 10], zoom: 90 }, dpr: 1 },
        h('ambientLight', { intensity: 1.4 }), h('directionalLight', { position: [-3, 4, 6], intensity: 2 }),
        h(Suspense, { fallback: null }, h(PlanetField, { nodes, selectedId: null, rivals: [], onSelect: () => undefined }))));
      return nodes.map(node => node.radius);
    });
    const previous = [0.4708628461043143, 0.8775, 1.49815575];
    for (const [index, radius] of radii.entries()) assert(Math.abs(radius - previous[index] * .8) < .00001);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(output, 'planet-scales.png') });
    assert.deepEqual(errors, []);
    results.push({ radii, passed: true });
    await page.close();
    console.log('PASS all three actual planet scales: 20% smaller');
  } finally { await browser.close(); }
  await writeFile(join(output, 'results.json'), JSON.stringify(results, null, 2));
}
