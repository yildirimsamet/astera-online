import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Real chat and safety sheets. Transport is a fixture; no real account or player is changed. */
export async function verifyCommunityBlocks(output) {
  await mkdir(output, { recursive: true }); const results = [];
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const width of [350, 1280]) for (const language of ['tr', 'en', 'de', 'fr', 'es', 'ja']) {
      const page = await browser.newPage({ viewport: { width, height: 812 } }); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=base-fleet&lng=${language}`);
      await page.waitForFunction(() => {
        const urls = performance.getEntriesByType('resource').map(entry => entry.name);
        return [/\/react\.js\?/, /\/react-dom_client\.js\?/, /\/@tanstack_react-query\.js\?/].every(pattern => urls.some(url => pattern.test(url)));
      });
      const labels = await page.evaluate(async language => {
        const urls = performance.getEntriesByType('resource').map(entry => entry.name);
        const moduleUrl = path => urls.findLast(url => new URL(url).pathname === path) ?? path;
        const [{ default: { createElement: h } }, { default: { createRoot } }, { QueryClient, QueryClientProvider }, { Api }, { ApiProvider }, { ChatHost }, { keys }, { default: i18n }] = await Promise.all([
          import(urls.find(url => /\/react\.js\?/.test(url))), import(urls.find(url => /\/react-dom_client\.js\?/.test(url))),
          import(urls.find(url => /\/@tanstack_react-query\.js\?/.test(url))), import(moduleUrl('/src/api/client.ts')), import(moduleUrl('/src/api/context.tsx')),
          import(moduleUrl('/src/v2/shell/ChatHost.tsx')), import(moduleUrl('/src/api/keys.ts')), import(moduleUrl('/src/i18n/index.ts')),
        ]);
        await i18n.changeLanguage(language); let blocked = false;
        const playerId = '11111111-1111-4111-8111-111111111111'; const accountId = '22222222-2222-4222-8222-222222222222'; const at = new Date();
        const messages = [{ id: 'long', authorPlayerId: playerId, username: 'Commander Beyond the Asteroid Belt', content: 'A message in the Astera Online safety preview.', self: false, language, createdAt: at }, { id: 'short', authorPlayerId: playerId, username: 'Scout', content: 'Hi', self: false, language, createdAt: at }];
        const chat = () => ({ messages: blocked ? [] : messages, nextBefore: null });
        const badge = { available: true, membership: null, attention: false, attentionCount: 0, clanChatUnread: 0 };
        const api = new Api({ fetch: async (url, init) => {
          const path = String(url);
          if (init?.method === 'POST' && path === '/api/community/blocks') blocked = true;
          if (init?.method === 'DELETE') blocked = false;
          const result = path === '/api/community/blocks' ? init?.method === 'POST' ? { blocked: true } : { blocks: blocked ? [{ accountId, username: messages[0].username, createdAt: at }] : [] }
            : init?.method === 'DELETE' ? { blocked: false } : path.startsWith('/api/chat/messages') ? chat() : path === '/api/clan/badge' ? badge
              : path === '/api/dm/conversations' ? { conversations: [], totalUnread: 0 } : path.includes('/unread') ? { count: 0 } : { ok: true, readAt: at };
          return new Response(JSON.stringify(result));
        } });
        const queries = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
        queries.setQueryData(keys.communityPolicy, { version: '2026-10-19', acceptedAt: at });
        queries.setQueryData(keys.chatMessagesFor(language), { pages: [chat()], pageParams: [null] });
        queries.setQueryData(keys.chatUnreadFor(language), { count: 0 }); queries.setQueryData(keys.dmUnread, { count: 0 }); queries.setQueryData(keys.clanBadge, badge);
        const host = document.createElement('div'); document.body.replaceChildren(host);
        createRoot(host).render(h(QueryClientProvider, { client: queries }, h(ApiProvider, { api }, h('main', { className: 'h-dvh bg-v2-void font-v2-ui text-v2-ink [--v2-top-h:0px] [--v2-dock-h:0px]' }, h(ChatHost, { accountId: 'fixture-account', channel: 'general', onClose: () => undefined, onFocusPlanet: () => undefined })))));
        return { ...Object.fromEntries(['action', 'title', 'submit', 'done', 'empty'].map(key => [key, i18n.t(`moderation.blocks.${key}`)])), close: i18n.t('moderation.close'), unblock: i18n.t('moderation.blocks.unblock', { name: messages[0].username }) };
      }, language);
      const capture = async state => {
        await page.waitForTimeout(120);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${language}/${width}/${state}: page overflow`);
        for (const node of await page.locator('[data-sheet-panel], [role=log]').all()) assert(await node.evaluate(element => element.scrollWidth <= element.clientWidth), `${language}/${width}/${state}: panel overflow`);
        assert.deepEqual(errors, []); await page.screenshot({ path: join(output, `${language}-${width}-${state}.png`) });
        results.push({ language, width, state, errors, noHorizontalOverflow: true });
      };
      await page.locator('[data-chat-message="long"]').waitFor(); await capture('chat');
      await page.locator('[data-chat-message="short"]').click({ button: 'right' }); await capture('short-actions');
      await page.locator('[data-chat-message="long"]').click({ button: 'right' });
      await page.getByRole('button', { name: labels.action, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: labels.action, exact: true }); await dialog.waitFor(); await capture('confirm');
      await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: labels.submit, exact: true }).click();
      await dialog.getByRole('status').filter({ hasText: labels.done }).waitFor(); await capture('blocked');
      await dialog.getByRole('button', { name: labels.close, exact: true }).last().click();
      await page.getByRole('button', { name: labels.title, exact: true }).click();
      const manager = page.getByRole('dialog', { name: labels.title, exact: true });
      await manager.getByRole('button', { name: labels.unblock, exact: true }).waitFor(); await capture('manager');
      await manager.getByRole('button', { name: labels.unblock, exact: true }).click();
      await manager.getByText(labels.empty, { exact: true }).waitFor(); await capture('unblocked'); await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log(`Community blocks: ${results.length} browser states verified.`);
}
