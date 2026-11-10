import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Real screens with isolated API fixtures; keyboard geometry is simulated, no game writes. */
export async function verifyDominanceChat(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const [width, language] of [[350, 'tr'], [390, 'en'], [350, 'ja'], [699, 'tr'], [700, 'en'], [1280, 'tr']]) {
      const page = await browser.newPage({ viewport: { width, height: 812 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=leaderboard&lng=${language}`);
      await page.locator('[data-v2-leaderboard]:visible').waitFor();
      await page.evaluate(async language => {
        const resources = performance.getEntriesByType('resource').map(entry => entry.name);
        const url = path => resources.findLast(name => new URL(name).pathname === path) ?? path;
        const react = resources.find(name => /\/react\.js\?/.test(name));
        const dom = resources.find(name => /\/react-dom_client\.js\?/.test(name));
        const query = resources.find(name => /\/@tanstack_react-query\.js\?/.test(name));
        if (!react || !dom || !query) throw new Error('Missing gallery runtime');
        const [{ default: { createElement: h } }, { default: { createRoot } }, { QueryClient, QueryClientProvider },
          { Api }, { ApiProvider }, { keys }, { ChatHost }, { LeaderboardScreen }, { GalaxyCommanderName },
          { planetNodes }, { default: i18n }] = await Promise.all([
          import(react), import(dom), import(query), import(url('/src/api/client.ts')), import(url('/src/api/context.tsx')),
          import(url('/src/api/keys.ts')), import(url('/src/v2/shell/ChatHost.tsx')), import(url('/src/screens/LeaderboardScreen.tsx')),
          import(url('/src/galaxy/GalaxyCanvas.tsx')), import(url('/src/galaxy/scene.ts')), import(url('/src/i18n/index.ts')),
        ]);
        await i18n.changeLanguage(language);
        localStorage.setItem('astera.chat.language.v1', language);
        const now = new Date();
        const messages = Array.from({ length: 20 }, (_, index) => ({
          id: `message-${index}`, authorPlayerId: index % 2 ? 'me' : 'rival', username: index % 2 ? 'Kestrel' : 'Mira',
          content: index % 2 ? 'Filo birazdan hedefe varacak.' : 'Galaksinin yeni sezonuna hazırız.',
          createdAt: new Date(now.getTime() - (20 - index) * 60_000), self: index % 2 === 1, language,
        }));
        const badge = { available: true, membership: { clanId: 'nova', name: 'Nova', tag: 'NOVA', role: 'MEMBER',
          matureAt: now, mature: true }, attention: false, attentionCount: 0, clanChatUnread: 0 };
        const review = { unexpected: [], posts: [], closed: 0 };
        window.__dominanceChatReview = review;
        const api = new Api({ fetch: async (input, init) => {
          const path = new URL(String(input), location.origin).pathname;
          let body;
          if (path.endsWith('/read')) body = { ok: true, readAt: now };
          else if (path === '/api/chat/messages' && init?.method === 'POST') {
            const posted = JSON.parse(init.body);
            review.posts.push(posted);
            body = { message: { ...messages.at(-1), id: `sent-${review.posts.length}`, content: posted.content } };
          } else if (path === '/api/chat/messages' || path === '/api/clan/chat/messages') body = { messages, nextBefore: null };
          else if (path === '/api/dm/conversations') body = client.getQueryData(keys.dmConversations);
          else if (path === '/api/dm/conversations/dm/messages') body = { messages, nextBefore: null, canSend: true, unavailableReason: null };
          else if (path === '/api/clan/badge') body = badge;
          else if (path.endsWith('/unread')) body = { count: 0 };
          else { review.unexpected.push(path); throw new Error(`Unexpected fixture request: ${path}`); }
          return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
        } });
        const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
        client.setQueryData(keys.communityPolicy, { version: '2026-10-19', acceptedAt: now });
        client.setQueryData(keys.chatMessagesFor(language), { pages: [{ messages, nextBefore: null }], pageParams: [null] });
        client.setQueryData(keys.chatUnreadFor(language), { count: 0 });
        client.setQueryData(keys.clanBadge, badge);
        client.setQueryData(keys.clanChat, { pages: [{ messages, nextBefore: null }], pageParams: [null] });
        client.setQueryData(keys.dmUnread, { count: 0 });
        client.setQueryData(keys.dmConversations, { conversations: [{ id: 'dm', peer: { playerId: 'rival', username: 'Mira', country: 'TR' },
          lastMessage: messages.at(-1), unreadCount: 0, blockedByMe: false, canSend: true, unavailableReason: null }], totalUnread: 0 });
        client.setQueryData(keys.dmMessagesFor('dm'), { pages: [{ messages, nextBefore: null, canSend: true, unavailableReason: null }], pageParams: [null] });
        const rows = [1, 2, 3].map(rank => ({ playerId: `rank-${rank}`, username: `Commander ${rank}`, country: 'TR', skinId: null,
          score: (4 - rank) * 10_000_000, honor: (4 - rank) * 10_000_000, dominion: (4 - rank) * 100, rank }));
        client.setQueryData(keys.leaderboard, { ranking: 'HONOR', honorEnabled: true, ladder: rows, you: rows[0], honorReward: null });
        client.setQueryData(['leaderboard', 'DOMINION'], { ranking: 'DOMINION', honorEnabled: true,
          ladder: rows.map(row => ({ ...row, score: row.dominion })), you: null, honorReward: null });
        client.setQueryData(keys.season, { status: 'live', endsAt: new Date(Date.now() + 86_400_000) });
        document.getElementById('root').style.display = 'none';
        const mount = document.createElement('div');
        mount.className = 'v2-shell font-v2-ui';
        mount.style.cssText = 'position:fixed;inset:0;--v2-top-h:100px;--v2-dock-h:56px';
        document.body.append(mount);
        const root = createRoot(mount);
        const noop = () => undefined;
        window.__dominanceChatShow = screen => {
          const content = screen === 'leaderboard' ? h(LeaderboardScreen, { onFocusPlanet: noop })
            : screen === 'podium' ? h('div', { className: 'grid gap-6 p-6', 'data-podium-review': '' }, ...[1, 2, 3].map(rank =>
              h(GalaxyCommanderName, { key: rank, node: planetNodes([{ id: `world-${rank}`, name: 'Kestrel', owner: `Commander ${rank}`,
                country: 'TR', kind: 'CAPITAL', intel: 'RESOLVED', state: { kind: 'NORMAL' }, position: { x: 0, y: 0, z: 0 },
                isSelf: false, honorRanking: true, honorRank: rank, dominionRank: 4 - rank }])[0] })))
            : h(ChatHost, { key: screen, channel: screen === 'admin' ? 'general' : screen, isAdmin: screen === 'admin', onClose() { review.closed++; }, onFocusPlanet: noop });
          root.render(h(QueryClientProvider, { client }, h(ApiProvider, { api }, content)));
        };
        window.__dominanceChatShow('general');
      }, language);

      const panel = page.locator('[data-chat-host] [data-sheet-panel]').first();
      const composer = page.locator('textarea');
      const geometry = () => panel.evaluate(element => {
        const box = element.getBoundingClientRect();
        const field = element.querySelector('textarea').getBoundingClientRect();
        const log = element.querySelector('[role="log"]').getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, height: box.height, fieldBottom: field.bottom,
          logHeight: log.height, fits: document.documentElement.scrollWidth <= innerWidth };
      });
      await composer.waitFor();
      for (const [index, channel] of ['general', 'clan', 'dm'].entries()) {
        await page.locator('[data-chat-controls] [role="tab"]').nth(index).click();
        await page.waitForFunction(channel => document.querySelector(`.chat-type[data-chat-room="${channel}"] textarea`), channel);
        const resting = await geometry();
        await composer.fill(`Draft ${channel}`);
        await page.waitForTimeout(350);
        const focused = await geometry();
        assert(focused.fits && resting.fits);
        if (width < 700) {
          assert(focused.top <= 1 && focused.bottom >= 811, JSON.stringify({ width, channel, focused }));
          // Android resize: the whole window loses height while the keyboard is present.
          await page.setViewportSize({ width, height: 380 });
          await page.waitForTimeout(350);
          const keyboard = await geometry();
          assert(keyboard.top <= 1 && keyboard.fieldBottom <= 380 && keyboard.logHeight >= (channel === 'dm' ? 60 : 140), JSON.stringify({ width, channel, keyboard }));
          assert(await page.getByRole('log').evaluate(log => log.scrollHeight - log.scrollTop - log.clientHeight < 2), 'Keyboard must keep the latest message visible');
          await page.screenshot({ path: join(output, `${width}-${language}-${channel}-keyboard.png`) });
          await page.setViewportSize({ width, height: 812 });
          // iOS resize/pan: only the visual viewport changes; layout viewport stays tall.
          await page.evaluate(() => {
            Object.defineProperty(visualViewport, 'height', { configurable: true, value: 360 });
            Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, value: 70 });
            visualViewport.dispatchEvent(new Event('resize'));
            visualViewport.dispatchEvent(new Event('scroll'));
          });
          const panned = await geometry();
          assert(Math.abs(panned.top - 70) <= 1 && panned.fieldBottom <= 430, JSON.stringify(panned));
          await page.evaluate(() => {
            delete visualViewport.height; delete visualViewport.offsetTop;
            visualViewport.dispatchEvent(new Event('resize'));
          });
        } else assert(Math.abs(resting.top - focused.top) <= 1 && Math.abs(resting.height - focused.height) <= 1);
        await composer.evaluate(element => element.blur());
        await page.waitForTimeout(350);
        const restored = await geometry();
        assert(Math.abs(restored.top - resting.top) <= 1 && Math.abs(restored.height - resting.height) <= 1, JSON.stringify({ resting, restored }));
        assert.equal(await composer.inputValue(), `Draft ${channel}`);
        await page.screenshot({ path: join(output, `${width}-${language}-${channel}-resting.png`) });
        results.push({ width, language, channel, resting, focused, restored });
      }
      await page.locator('[data-chat-controls] [role="tab"]').first().click();
      assert.equal(await composer.inputValue(), 'Draft general');
      await composer.fill('Gönderim testi');
      await composer.press('Enter');
      await page.waitForFunction(() => window.__dominanceChatReview.posts.length === 1);
      await page.waitForFunction(() => document.querySelector('textarea')?.value === '');
      assert.equal(await composer.inputValue(), '');
      if (width < 700) {
        await page.evaluate(() => window.__dominanceChatShow('admin'));
        await page.locator('input[type="file"]').waitFor({ state: 'attached' });
        await composer.focus();
        await page.setViewportSize({ width, height: 380 });
        await page.waitForTimeout(350);
        const admin = await geometry();
        assert(admin.top <= 1 && admin.fieldBottom <= 380 && admin.logHeight > 100, JSON.stringify(admin));
        assert(await page.getByRole('log').evaluate(log => log.scrollHeight - log.scrollTop - log.clientHeight < 2), 'Admin keyboard must keep the latest message visible');
        await page.screenshot({ path: join(output, `${width}-${language}-admin-keyboard.png`) });
        await page.setViewportSize({ width, height: 812 });
      }
      await page.evaluate(() => window.__dominanceChatShow('podium'));
      await page.locator('[data-podium-review]').waitFor();
      assert.equal(await page.locator('[data-podium-review] .rank-badge').count(), 6);
      await page.screenshot({ path: join(output, `${width}-${language}-podium.png`) });
      await page.evaluate(() => window.__dominanceChatShow('leaderboard'));
      await page.locator('[data-v2-leaderboard]:visible').waitFor();
      assert.equal(await page.getByRole('button', { name: 'Honor', exact: true }).getAttribute('aria-pressed'), 'true');
      const dominionName = await page.evaluate(() => import('/src/i18n/index.ts').then(({ default: i18n }) => i18n.t('leaderboard.score')));
      const tab = page.getByRole('button', { name: dominionName, exact: true });
      assert.equal(await tab.locator('svg').count(), 1);
      await tab.click();
      await page.screenshot({ path: join(output, `${width}-${language}-leaderboard.png`) });
      const review = await page.evaluate(() => window.__dominanceChatReview);
      assert.deepEqual(review.unexpected, []);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px ${language}: three chat rooms, focus/blur, draft/send, both podiums and Dominion tab`);
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
}
