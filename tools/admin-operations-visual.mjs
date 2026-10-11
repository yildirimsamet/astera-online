import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Real admin/chat components with isolated browser fixtures; no moderation of real accounts. */
export async function verifyAdminOperations(output) {
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
          { Api }, { ApiProvider }, { default: AdminPanel }, { ChatHost }, { default: i18n }] = await Promise.all([
          import(reactUrl), import(domUrl), import(queryUrl), import(moduleUrl('/src/api/client.ts')),
          import(moduleUrl('/src/api/context.tsx')), import(moduleUrl('/src/screens/AdminPanel.tsx')),
          import(moduleUrl('/src/v2/shell/ChatHost.tsx')), import(moduleUrl('/src/i18n/index.ts')),
        ]);
        await i18n.changeLanguage(language);
        const now = new Date();
        const seasonId = '00000000-0000-4000-8000-000000000001';
        const clans = ['Orion', 'Lyra'].map((name, index) => ({ id: `00000000-0000-4000-8000-00000000000${index + 2}`,
          name, tag: name.slice(0, 3).toUpperCase(), seasonId, galaxy: 'Andromeda', galaxyCode: 'andromeda' }));
        const review = { calls: [], unexpected: [] };
        const api = new Api({ fetch: async (input, init) => {
          const url = new URL(String(input), location.origin);
          const body = init?.body ? JSON.parse(init.body) : undefined;
          review.calls.push({ path: url.pathname, body });
          let answer;
          if (url.pathname === '/api/admin/players') answer = { measuredAt: now, onlineWindowMinutes: 5, nextBefore: null,
            players: ['İzci', 'AndromedaCommanderWithALongName'].map((displayName, index) => ({ playerId: `player-${index}`, username: `commander${index}`, displayName,
              seasonId, galaxy: 'Andromeda', galaxyCode: 'andromeda', lastActiveAt: now, mutes: [],
              resources: { storage: { alloy: 1234567890, crystal: 987654, deuterium: 54321 }, buffer: { alloy: 1234, crystal: 567, deuterium: 89 } },
              activity: { asteroidDispatches: 12, minersSent: 600, pirateDispatches: 5, pirateShipsSent: 240 } })) };
          else if (url.pathname === '/api/admin/clans') answer = { clans, galaxies: [{ seasonId, name: 'Andromeda', code: 'andromeda' }] };
          else if (url.pathname === '/api/admin/chat/mute') answer = { ...body, expiresAt: new Date(now.getTime() + 15 * 60_000) };
          else if (url.pathname === '/api/admin/chat/mask') answer = { masked: 3 };
          else if (url.pathname.includes('/api/admin/clans/')) answer = { messages: [{ id: 'clan-message', authorPlayerId: 'other', username: 'İzci',
            clanTag: 'ORI', content: url.pathname.includes(clans[1].id) ? 'Lyra room' : 'Orion room', createdAt: now, self: false }], nextBefore: null };
          else if (url.pathname === '/api/chat/messages') answer = { messages: [], nextBefore: null };
          else if (url.pathname === '/api/clan/badge') answer = { available: true, membership: null, attention: false, attentionCount: 0, clanChatUnread: 0 };
          else if (url.pathname.endsWith('/unread')) answer = { count: 0 };
          else { review.unexpected.push(url.pathname); throw new Error(`Unexpected fixture request: ${url.pathname}`); }
          return new Response(JSON.stringify(answer), { headers: { 'content-type': 'application/json' } });
        } });
        const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
        document.getElementById('root').style.display = 'none';
        const mount = document.createElement('div');
        mount.style.cssText = 'position:fixed;inset:0;z-index:100;background:#07111a;padding:8px;--v2-top-h:0px;--v2-dock-h:0px';
        document.body.append(mount);
        const root = createRoot(mount);
        const wrap = child => h(QueryClientProvider, { client }, h(ApiProvider, { api }, child));
        root.render(wrap(h(AdminPanel)));
        review.renderChat = () => root.render(wrap(h(ChatHost, { isAdmin: true, channel: 'clan',
          onClose() { /* Fixture stays open for measurements. */ },
          onFocusPlanet() { /* No galaxy navigation in this isolated fixture. */ },
        })));
        window.__adminOperationsReview = review;
      }, language);
      await page.getByRole('tab', { name: language === 'tr' ? 'Oyuncular' : 'Players' }).click();
      await page.getByText('İzci', { exact: true }).waitFor();
      const measure = async name => {
        const geometry = await page.evaluate(() => ({ fits: document.documentElement.scrollWidth <= innerWidth,
          overflow: [...document.querySelectorAll('article')].some(element => element.scrollWidth > element.clientWidth + 1) }));
        assert(geometry.fits && !geometry.overflow, JSON.stringify({ width, language, name, ...geometry }));
        measurements.push({ width, language, name, ...geometry });
        await page.screenshot({ path: join(output, `${width}-${language}-${name}.png`) });
      };
      await measure('players');
      await page.getByLabel(language === 'tr' ? 'Komutan kullanıcı adı' : 'Commander username').fill('commander0');
      await page.getByRole('checkbox', { name: language === 'tr' ? 'Klan' : 'Clan', exact: true }).check();
      await page.getByRole('checkbox', { name: 'DM', exact: true }).check();
      await page.getByLabel(language === 'tr' ? 'Mute süresi' : 'Mute duration').selectOption('15m');
      await page.getByRole('button', { name: language === 'tr' ? 'Oyuncuyu mutele' : 'Mute player', exact: true }).click();
      await page.getByRole('status').waitFor();
      await measure('moderation');
      const mute = await page.evaluate(() => window.__adminOperationsReview.calls.find(call => call.path === '/api/admin/chat/mute'));
      assert.deepEqual(mute.body.channels, ['general', 'clan', 'dm']);
      await page.evaluate(() => window.__adminOperationsReview.renderChat());
      await page.getByText('Orion room', { exact: true }).waitFor();
      await page.getByLabel(language === 'tr' ? 'Klan kanalı' : 'Clan channel').selectOption('00000000-0000-4000-8000-000000000003');
      await page.getByText('Lyra room', { exact: true }).waitFor();
      await measure('clan-chat');
      const unexpected = await page.evaluate(() => window.__adminOperationsReview.unexpected);
      assert.deepEqual({ errors, unexpected }, { errors: [], unexpected: [] });
      console.log(`PASS admin operations: ${width}px ${language}, checkbox mute and selected clan`);
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(measurements, null, 2)}\n`);
}
