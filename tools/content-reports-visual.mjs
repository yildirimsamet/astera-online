import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Real chat/Sheet/operator components, fixture transport; no real accounts or moderation. */
export async function verifyContentReports(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [];
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
        const [{ default: { createElement: h } }, { default: { createRoot } }, { QueryClient, QueryClientProvider }, { Api }, { ApiProvider }, { ChatScreen }, { AdminContentReports }, { keys }, { default: i18n }] = await Promise.all([
          import(urls.find(url => /\/react\.js\?/.test(url))), import(urls.find(url => /\/react-dom_client\.js\?/.test(url))),
          import(urls.find(url => /\/@tanstack_react-query\.js\?/.test(url))), import(moduleUrl('/src/api/client.ts')),
          import(moduleUrl('/src/api/context.tsx')), import(moduleUrl('/src/screens/ChatScreen.tsx')), import(moduleUrl('/src/screens/AdminContentReports.tsx')),
          import(moduleUrl('/src/api/keys.ts')), import(moduleUrl('/src/i18n/index.ts')),
        ]);
        await i18n.changeLanguage(language);
        const id = '11111111-1111-4111-8111-111111111111'; const playerId = '22222222-2222-4222-8222-222222222222'; const at = new Date();
        const message = { id, authorPlayerId: playerId, username: 'Commander Beyond the Asteroid Belt', content: 'A message for the moderation preview.', self: false, createdAt: at, language };
        const api = new Api({ fetch: async (url, init) => {
          const result = String(url).startsWith('/api/admin/content-reports') ? { reports: [{ id, kind: 'message', channel: 'general', messageId: id, reason: 'HARASSMENT', details: 'Private explanation from the reporter.', evidence: { username: message.username, playerId, content: '<script>Rendered as text, never executed</script>\nA message for the moderation preview.', media: null }, status: 'PENDING', createdAt: at, targetUsername: 'scout' }] }
            : String(url).startsWith('/api/community/reports') ? { report: { id, createdAt: at, status: 'received' } }
              : { ok: true, readAt: at };
          return new Response(JSON.stringify(result), { status: init?.method === 'POST' && String(url).includes('/community/reports') ? 202 : 200 });
        } });
        const queries = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
        queries.setQueryData(keys.communityPolicy, { version: '2026-10-19', acceptedAt: at });
        queries.setQueryData(keys.chatMessagesFor(language), { pages: [{ messages: [message], nextBefore: null }], pageParams: [null] });
        queries.setQueryData(keys.chatUnreadFor(language), { count: 0 }); queries.setQueryData(keys.dmUnread, { count: 0 });
        queries.setQueryData(keys.clanBadge, { available: true, membership: null, attentionCount: 0, clanChatUnread: 0 });
        const host = document.createElement('div'); document.body.replaceChildren(host); const root = createRoot(host);
        const wrap = child => h(QueryClientProvider, { client: queries }, h(ApiProvider, { api }, h('main', { className: 'h-dvh bg-v2-void font-v2-ui text-v2-ink [--v2-top-h:0px] [--v2-dock-h:0px]' }, h('div', { className: 'mx-auto flex h-full max-w-xl flex-col p-3' }, child))));
        window.__reportsAdmin = () => root.render(wrap(h(AdminContentReports)));
        root.render(wrap(h(ChatScreen, { onFocusPlanet: () => undefined })));
        return { id, ...Object.fromEntries(['report', 'title', 'reason', 'submit', 'received'].map(key => [key, i18n.t(`moderation.${key}`)])), confirm: i18n.t('moderation.admin.confirm'), mask: i18n.t('moderation.admin.mask') };
      }, language);
      const capture = async state => {
        await page.waitForTimeout(100);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${language}/${width}/${state}: page overflow`);
        const dialog = page.getByRole('dialog').last();
        if (await dialog.count()) assert(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth), `${language}/${width}/${state}: dialog overflow`);
        assert.deepEqual(errors, []);
        await page.screenshot({ path: join(output, `${language}-${width}-${state}.png`) }); results.push({ language, width, state, errors, noHorizontalOverflow: true });
      };
      const bubble = page.locator(`[data-chat-message="${labels.id}"]`); await bubble.waitFor();
      await capture('chat'); await bubble.click({ button: 'right' });
      await page.getByRole('button', { name: labels.report, exact: true }).waitFor(); await capture('actions');
      await page.getByRole('button', { name: labels.report, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: labels.title, exact: true }); await dialog.waitFor(); await capture('report');
      await dialog.getByLabel(labels.reason, { exact: true }).selectOption('HARASSMENT');
      await dialog.getByRole('button', { name: labels.submit, exact: true }).click();
      await dialog.getByRole('status').filter({ hasText: labels.received }).waitFor(); await capture('receipt');
      await page.evaluate(() => window.__reportsAdmin());
      await page.getByRole('button', { name: labels.mask, exact: true }).waitFor();
      await page.getByLabel(labels.confirm, { exact: true }).check(); await capture('admin'); await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log(`Content reports: ${results.length} browser states verified.`);
}
