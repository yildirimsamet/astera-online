/** Exercise the real chat host with browser-only message fixtures; no server messages or blocks. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

export async function verifyPersonalChatMutes(output) {
  await mkdir(output, { recursive: true });
  const web = process.env.WEB ?? 'http://localhost:5176';
  const browser = await chromium.launch();
  const records = [];
  try {
    for (const width of [350, 1280]) for (const language of ['tr', 'en', 'de', 'fr', 'es', 'ja']) {
      const page = await browser.newPage({ viewport: { width, height: 812 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${web}/v2-gallery.html?view=base-fleet&lng=${language}`);
      await page.getByRole('tab').first().waitFor();
      await page.evaluate(async language => {
        const resources = performance.getEntriesByType('resource').map(entry => entry.name);
        const dependency = name => resources.find(url => new URL(url).pathname.endsWith(`/${name}.js`));
        const react = dependency('react'), dom = dependency('react-dom_client'), query = dependency('@tanstack_react-query');
        if (!react || !dom || !query) throw new Error('Gallery dependencies missing');
        const module = path => resources.findLast(url => new URL(url).pathname === path) ?? path;
        const [{ default: { createElement: h } }, { default: { createRoot } }, { QueryClient, QueryClientProvider },
          { Api }, { ApiProvider }, { keys }, { ChatHost }, { default: i18n }] = await Promise.all([
          import(react), import(dom), import(query), import(module('/src/api/client.ts')),
          import(module('/src/api/context.tsx')), import(module('/src/api/keys.ts')),
          import(module('/src/v2/shell/ChatHost.tsx')), import(module('/src/i18n/index.ts')),
        ]);
        await i18n.changeLanguage(language);
        const now = new Date();
        const messages = [
          { id: 'admin', authorPlayerId: 'admin', username: 'Admin', content: 'Welcome to the new season.', admin: true },
          { id: 'scout-1', authorPlayerId: 'scout', username: 'Commander Astral Scout', content: 'My scouts have returned from the outer belt.' },
          { id: 'self', authorPlayerId: 'self', username: 'Vantage', content: 'My fleet is heading home.', self: true },
          { id: 'third', authorPlayerId: 'third', username: 'Aurora', content: 'See you near the monuments.' },
          { id: 'scout-2', authorPlayerId: 'scout', username: 'Commander Astral Scout', content: 'There is more ore by the western asteroids.' },
        ].map(message => ({ language, createdAt: now, self: false, ...message }));
        const badge = { available: true, membership: null, attention: false, attentionCount: 0, clanChatUnread: 0 };
        const review = { unexpected: [], closed: 0, focused: 0 };
        window.personalChatReview = review;
        const api = new Api({ fetch: async input => {
          const url = new URL(String(input), location.origin);
          const path = url.pathname;
          let body;
          if (path === '/api/chat/messages') body = url.searchParams.get('before') === 'older-cursor'
            ? { messages: [{ ...messages[3], id: 'older-third', content: 'An earlier visible conversation.' }], nextBefore: null }
            : { messages, nextBefore: null };
          else if (path === '/api/chat/read') body = { ok: true, readAt: now };
          else if (path === '/api/clan/badge') body = badge;
          else if (path.endsWith('/unread')) body = { count: 0 };
          else { review.unexpected.push(path); throw new Error(`Unexpected fixture request: ${path}`); }
          return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
        } });
        const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
        client.setQueryData(keys.chatMessagesFor(language), { pages: [{ messages, nextBefore: null }], pageParams: [null] });
        client.setQueryData(keys.chatUnreadFor(language), { count: 0 });
        client.setQueryData(keys.dmUnread, { count: 0 });
        client.setQueryData(keys.clanBadge, badge);
        const labels = { list: i18n.t('chat.personalMutes.title'), mute: i18n.t('chat.personalMutes.mute', { name: 'Commander Astral Scout' }),
          unmute: i18n.t('chat.personalMutes.unmute', { name: 'Commander Astral Scout' }), close: i18n.t('sheet.close'), older: i18n.t('chat.older') };
        window.personalChatLabels = labels;
        document.getElementById('root').style.display = 'none';
        const mount = document.createElement('div');
        mount.style.cssText = 'position:fixed;inset:0;--v2-top-h:0px;--v2-dock-h:0px';
        document.body.append(mount);
        const root = createRoot(mount);
        window.showPersonalChat = accountId => root.render(h(QueryClientProvider, { client }, h(ApiProvider, { api }, h(ChatHost, {
          key: accountId, accountId, channel: 'general', onClose() { review.closed++; }, onFocusPlanet() { review.focused++; },
        }))));
        window.personalChatEmptyPage = () => client.setQueryData(keys.chatMessagesFor(language), {
          pages: [{ messages: messages.filter(message => message.authorPlayerId === 'scout'), nextBefore: 'older-cursor' }], pageParams: [null],
        });
        window.showPersonalChat('visual-account-a');
      }, language);
      const labels = await page.evaluate(() => window.personalChatLabels);
      await page.locator('[data-chat-message="scout-1"]').waitFor();
      for (const id of ['self', 'admin']) {
        await page.locator(`[data-chat-message="${id}"]`).dispatchEvent('contextmenu');
        assert.equal(await page.locator('[data-chat-mute]').count(), 0, `${id}: personal mute must be absent`);
      }
      const bubble = page.locator('[data-chat-message="scout-1"]');
      await bubble.scrollIntoViewIfNeeded();
      const bounds = await bubble.boundingBox();
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up();
      const mute = page.getByRole('button', { name: labels.mute, exact: true });
      await mute.waitFor();
      const position = await mute.evaluate(button => {
        const left = button.previousElementSibling.getBoundingClientRect(), middle = button.getBoundingClientRect(), right = button.nextElementSibling.getBoundingClientRect();
        return { left: left.right, middle: middle.x, right: right.x, middleEnd: middle.right };
      });
      assert(position.middle >= position.left && position.middleEnd <= position.right);
      await page.screenshot({ path: join(output, `chat-actions-${language}-${width}.png`) });
      await mute.click();
      await page.locator('[data-chat-message="scout-1"]').waitFor({ state: 'detached' });
      assert.equal(await page.locator('[data-chat-message="scout-2"]').count(), 0);
      assert.equal(await page.locator('[data-chat-message="admin"]').count(), 1);
      assert.equal(await page.locator('[data-chat-message="self"]').count(), 1);
      await page.getByRole('button', { name: labels.list, exact: true }).click();
      const list = page.getByRole('dialog', { name: labels.list, exact: true });
      await list.getByRole('button', { name: labels.unmute, exact: true }).waitFor();
      const layout = await list.evaluate(panel => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
        width: panel.getBoundingClientRect().width, scroll: panel.scrollWidth, client: panel.clientWidth }));
      assert(layout.document <= width && layout.scroll <= layout.client + 1);
      await page.screenshot({ path: join(output, `chat-muted-list-${language}-${width}.png`) });
      await page.keyboard.press('Escape');
      await list.waitFor({ state: 'detached' });
      await page.evaluate(() => window.showPersonalChat('visual-account-b'));
      await page.locator('[data-chat-message="scout-1"]').waitFor();
      await page.evaluate(() => window.showPersonalChat('visual-account-a'));
      await page.locator('[data-chat-message="scout-1"]').waitFor({ state: 'detached' });
      await page.getByRole('button', { name: labels.list, exact: true }).click();
      await page.getByRole('button', { name: labels.unmute, exact: true }).click();
      await page.keyboard.press('Escape');
      await page.locator('[data-chat-message="scout-1"]').waitFor();
      await page.evaluate(() => window.personalChatEmptyPage());
      await page.locator('[data-chat-message="scout-1"]').dispatchEvent('contextmenu');
      await page.getByRole('button', { name: labels.mute, exact: true }).click();
      await page.getByRole('button', { name: labels.older, exact: true }).click();
      await page.locator('[data-chat-message="older-third"]').waitFor();
      await page.screenshot({ path: join(output, `chat-muted-history-${language}-${width}.png`) });
      const review = await page.evaluate(() => window.personalChatReview);
      assert.deepEqual({ ...review, errors }, { unexpected: [], closed: 0, focused: 0, errors: [] });
      records.push({ width, language, layout, middleAction: true, selfAdminProtected: true, persists: true, accountsIsolated: true, restored: true, olderHistoryReachable: true });
      console.log(`PASS personal mute: ${width}px ${language}`);
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'review.json'), JSON.stringify(records, null, 2));
}
