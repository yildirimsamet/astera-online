import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Real chat and sheet, browser-only message fixtures; no account or game writes. */
export async function verifyChatRecognition(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const width of [350, 1280]) {
      for (const language of ['tr', 'en']) {
        const page = await browser.newPage({ viewport: { width, height: 812 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=base-fleet&lng=${language}`);
        await page.getByRole('tab').first().waitFor();
        await page.evaluate(async language => {
          const resources = performance.getEntriesByType('resource').map(entry => entry.name);
          const reactUrl = resources.find(name => /\/react\.js\?/.test(name));
          const domUrl = resources.find(name => /\/react-dom_client\.js\?/.test(name));
          const queryUrl = resources.find(name => /\/@tanstack_react-query\.js\?/.test(name));
          if (!reactUrl || !domUrl || !queryUrl) throw new Error('Gallery modules not loaded');
          const moduleUrl = path => resources.findLast(name => new URL(name).pathname === path) ?? path;
          const [{ default: { createElement: h } }, { default: { createRoot } }, { QueryClient, QueryClientProvider },
            { Api }, { ApiProvider }, { keys }, { ChatHost }, { default: i18n }] = await Promise.all([
            import(reactUrl), import(domUrl), import(queryUrl), import(moduleUrl('/src/api/client.ts')),
            import(moduleUrl('/src/api/context.tsx')), import(moduleUrl('/src/api/keys.ts')),
            import(moduleUrl('/src/v2/shell/ChatHost.tsx')), import(moduleUrl('/src/i18n/index.ts')),
          ]);
          await i18n.changeLanguage(language);
          const now = new Date();
          const messages = [
            { id: 'gold', username: 'Vantage', previousSeasonRank: 1, supporter: true, content: 'Galaksinin yeni sezonuna hazırız.' },
            { id: 'silver', username: 'Sable', previousSeasonRank: 2, content: 'Anıtların çevresinde yeni hareketler var.' },
            { id: 'bronze', username: 'Rook', previousSeasonRank: 3, self: true, content: 'Sondam birazdan hedefe varacak.' },
            { id: 'supporter', username: 'Aurora', supporter: true, content: 'Herkese iyi oyunlar!' },
          ].map((row, index) => ({ authorPlayerId: row.id, planetId: `planet-${row.id}`, language,
            createdAt: new Date(now.getTime() - (4 - index) * 60_000), self: false, ...row }));
          const badge = { available: true, membership: null, attention: false, attentionCount: 0, clanChatUnread: 0 };
          const review = { unexpected: [], closed: 0, focused: 0 };
          window.__chatRecognitionReview = review;
          const api = new Api({ fetch: async input => {
            const path = new URL(String(input), location.origin).pathname;
            let body;
            if (path === '/api/chat/messages') body = { messages, nextBefore: null };
            else if (path === '/api/chat/read') body = { ok: true, readAt: now };
            else if (path === '/api/clan/badge') body = badge;
            else if (path.endsWith('/unread')) body = { count: 0 };
            else { review.unexpected.push(path); throw new Error(`Unexpected fixture read: ${path}`); }
            return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
          } });
          const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
          client.setQueryData(keys.chatMessagesFor(language), { pages: [{ messages, nextBefore: null }], pageParams: [null] });
          client.setQueryData(keys.chatUnreadFor(language), { count: 0 });
          client.setQueryData(keys.dmUnread, { count: 0 });
          client.setQueryData(keys.clanBadge, badge);
          document.getElementById('root').style.display = 'none';
          const mount = document.createElement('div');
          mount.style.cssText = 'position:fixed;inset:0;--v2-top-h:0px;--v2-dock-h:0px';
          document.body.append(mount);
          createRoot(mount).render(h(QueryClientProvider, { client }, h(ApiProvider, { api }, h(ChatHost, {
            channel: 'general', onClose() { review.closed++; }, onFocusPlanet() { review.focused++; },
          }))));
        }, language);
        await page.locator('[data-chat-message="supporter"]').waitFor();
        for (const [name, selector] of [
          ['heart', '[data-chat-message="gold"] [data-chat-supporter-icon]'],
          ['gold', '[data-chat-message="gold"] [data-chat-podium-icon]'],
          ['silver', '[data-chat-message="silver"] [data-chat-podium-icon]'],
          ['bronze', '[data-chat-message="bronze"] [data-chat-podium-icon]'],
          ['supporter', '[data-chat-message="supporter"] [data-chat-supporter-icon]'],
        ]) {
          const button = page.locator(selector);
          await button.click();
          await page.getByRole('tooltip').waitFor();
          const geometry = await page.getByRole('tooltip').evaluate((hint, selector) => {
            const box = hint.getBoundingClientRect();
            const button = document.querySelector(selector).getBoundingClientRect();
            return { text: hint.textContent, above: box.bottom <= button.top,
              fits: box.left >= 0 && box.right <= window.innerWidth && box.top >= 0,
              pageFits: document.documentElement.scrollWidth <= window.innerWidth };
          }, selector);
          assert(geometry.above && geometry.fits && geometry.pageFits, JSON.stringify({ width, language, name, ...geometry }));
          assert.equal(await page.getByRole('tooltip').count(), 1);
          await page.screenshot({ path: join(output, `${width}-${language}-${name}.png`) });
          results.push({ width, language, name, ...geometry });
        }
        await page.getByRole('tooltip').waitFor({ state: 'detached', timeout: 4_000 });
        await page.locator('[data-chat-message="gold"] [data-chat-supporter-icon]').focus();
        await page.keyboard.press('Enter');
        await page.getByRole('tooltip').waitFor();
        await page.keyboard.press('Escape');
        await page.getByRole('tooltip').waitFor({ state: 'detached' });
        const review = await page.evaluate(() => window.__chatRecognitionReview);
        assert.deepEqual({ ...review, errors }, { unexpected: [], closed: 0, focused: 0, errors: [] });
        console.log(`PASS chat badges: ${width}px ${language}, five explanations, timeout and keyboard`);
        await page.close();
      }
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
}
