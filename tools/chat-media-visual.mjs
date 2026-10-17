import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Actual chat components with browser fixtures; no writes to local player accounts. */
export async function verifyChatMedia(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const photo = await readFile(new URL('../apps/web/public/assets/images/atmosphere/dart-scene-v1.webp', import.meta.url));
  const video = await readFile(new URL('../apps/server/test/fixtures/chat-video.mp4', import.meta.url));
  const results = [];
  try {
    for (const [width, viewportHeight] of [[350, 812], [350, 480], [1280, 812]]) {
      for (const language of ['tr', 'en']) {
        const page = await browser.newPage({ viewport: { width, height: viewportHeight } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/api/chat/media/**', route => {
          const isVideo = route.request().url().includes('000000000002');
          return route.fulfill({ contentType: isVideo ? 'video/mp4' : 'image/webp', body: isVideo ? video : photo });
        });
        await page.route('**/api/admin/chat/media', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ media: { kind: 'image', assetId: '00000000-0000-4000-8000-000000000003', mimeType: 'image/webp' } }) }));
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
            { id: 'photo', username: 'adminlesh', admin: true, content: 'Astera Online · Yeni keşifler', media: { kind: 'image', assetId: '00000000-0000-4000-8000-000000000001', mimeType: 'image/webp' } },
            { id: 'video', username: 'adminlesh', admin: true, content: '', media: { kind: 'video', assetId: '00000000-0000-4000-8000-000000000002', mimeType: 'video/mp4' } },
            { id: 'youtube', username: 'adminlesh', admin: true, content: 'YouTube', media: { kind: 'youtube', videoId: 'dQw4w9WgXcQ' } },
            { id: 'reaction', username: 'Aurora', content: 'Hazırız! Galakside görüşürüz.', reactions: [{ emoji: '👍', count: 6, mine: true }, { emoji: '❤️', count: 3, mine: false }] },
          ].map((row, index) => ({ authorPlayerId: row.id, language, createdAt: new Date(now.getTime() - (4 - index) * 60000), self: false, ...row }));
          const badge = { available: true, membership: null, attention: false, attentionCount: 0, clanChatUnread: 0 };
          const review = { mutations: [], unexpected: [], closed: 0, focused: 0, labels: Object.fromEntries(['add', 'youtube', 'url', 'attach', 'remove', 'photo', 'showPortrait', 'showLandscape'].map(key => [key, i18n.t(`chat.media.${key}`)])), send: i18n.t('chat.send'), reactions: i18n.t('chat.reactions') };
          window.__chatMediaReview = review;
          const api = new Api({ fetch: async (input, options) => {
            const path = new URL(String(input), location.origin).pathname;
            let body;
            if (options?.method === 'POST' && path === '/api/chat/reactions') {
              review.mutations.push(JSON.parse(options.body)); body = { reactions: [] };
            } else if (options?.method === 'POST' && path === '/api/chat/messages') {
              const sent = JSON.parse(options.body); review.mutations.push(sent);
              body = { message: { id: 'sent-' + review.mutations.length, authorPlayerId: 'admin', username: 'adminlesh', admin: true, self: true, createdAt: now, ...sent } };
            } else if (path === '/api/chat/reactions') body = { participants: Array.from({ length: 9 }, (_, i) => ({ playerId: `reactor-${i}`, username: ['Aurora', 'Vantage', 'Sable', 'Rook', 'Nova', 'Orion', 'Lyra', 'Sol', 'Vega'][i], emoji: i < 6 ? '👍' : '❤️' })) };
            else if (path === '/api/chat/messages') body = { messages, nextBefore: null };
            else if (path === '/api/chat/read') body = { ok: true, readAt: now };
            else if (path === '/api/clan/badge') body = badge;
            else if (path.endsWith('/unread')) body = { count: 0 };
            else { review.unexpected.push(path); throw new Error(`Unexpected fixture read: ${path}`); }
            return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
          } });
          const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
          client.setQueryData(keys.chatMessagesFor(language), { pages: [{ messages, nextBefore: null }], pageParams: [null] });
          client.setQueryData(keys.chatUnreadFor(language), { count: 0 });
          client.setQueryData(keys.dmUnread, { count: 0 }); client.setQueryData(keys.clanBadge, badge);
          document.getElementById('root').style.display = 'none';
          const mount = document.createElement('div'); mount.style.cssText = 'position:fixed;inset:0;--v2-top-h:0px;--v2-dock-h:0px'; document.body.append(mount);
          createRoot(mount).render(h(QueryClientProvider, { client }, h(ApiProvider, { api }, h(ChatHost, { isAdmin: true, channel: 'general', onClose() { review.closed++; }, onFocusPlanet() { review.focused++; } }))));
        }, language);
        await page.locator('[data-chat-message="reaction"]').waitFor();
        const labels = await page.evaluate(() => ({ ...window.__chatMediaReview, ...window.__chatMediaReview.labels }));
        await page.getByRole('button', { name: /👍.*6/ }).click();
        const roster = page.getByRole('dialog', { name: labels.reactions });
        await roster.getByText('Vega', { exact: true }).waitFor({ state: 'attached' });
        const geometry = await roster.evaluate(panel => {
          const rows = panel.querySelector('[data-reaction-roster]'); const rect = panel.getBoundingClientRect();
          return { height: rows.clientHeight, scrollHeight: rows.scrollHeight, fits: rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0 && rect.bottom <= window.innerHeight };
        });
        assert.equal(geometry.height, 108); assert(geometry.scrollHeight > geometry.height && geometry.fits, JSON.stringify(geometry));
        assert.equal((await page.evaluate(() => window.__chatMediaReview.mutations)).length, 0);
        await page.screenshot({ path: join(output, `${width}x${viewportHeight}-${language}-reactions.png`) });
        await page.keyboard.press('Escape'); await roster.waitFor({ state: 'detached' });
        await page.locator('[data-chat-message="photo"]').scrollIntoViewIfNeeded();
        await page.screenshot({ path: join(output, `${width}x${viewportHeight}-${language}-media.png`) });
        const image = page.locator('[data-chat-message="photo"] img');
        assert(await image.evaluate(img => img.complete && img.naturalWidth > 0));
        const uploadedVideo = page.locator('video');
        await uploadedVideo.evaluate(async element => { if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true })); });
        assert(await uploadedVideo.evaluate(element => element.controls && !element.autoplay && element.duration > 0));
        const youtubeMessage = page.locator('[data-chat-message="youtube"]');
        const youtubeFrame = youtubeMessage.locator('iframe');
        const landscape = await youtubeFrame.boundingBox();
        assert(landscape);
        await youtubeFrame.evaluate(frame => { frame.dataset.orientationProbe = 'same-player'; });
        await youtubeMessage.getByRole('button', { name: labels.showPortrait, exact: true }).click();
        const portrait = await youtubeFrame.evaluate(frame => {
          const rect = frame.getBoundingClientRect();
          return { width: rect.width, height: rect.height, fits: rect.left >= 0 && rect.right <= innerWidth, player: frame.dataset.orientationProbe };
        });
        assert(portrait.fits && portrait.height > landscape.height + (viewportHeight >= 600 ? 40 : 0), JSON.stringify({ landscape, portrait }));
        assert(Math.abs(portrait.height / portrait.width - 16 / 9) < 0.03);
        assert.equal(portrait.player, 'same-player');
        await youtubeMessage.scrollIntoViewIfNeeded();
        await page.screenshot({ path: join(output, `${width}x${viewportHeight}-${language}-portrait.png`) });
        await youtubeMessage.getByRole('button', { name: labels.showLandscape, exact: true }).click();
        assert.equal(await youtubeFrame.getAttribute('data-orientation-probe'), 'same-player');
        await page.getByRole('button', { name: labels.add, exact: true }).click();
        await page.locator('input[type=file]').setInputFiles({ name: 'astera.webp', mimeType: 'image/webp', buffer: photo });
        await page.getByRole('button', { name: labels.remove }).waitFor();
        const composerGeometry = await page.locator('[data-chat-room] form').evaluate(form => {
          const rect = form.getBoundingClientRect();
          const room = form.closest('[data-chat-room]').getBoundingClientRect();
          const send = form.querySelector('button[type="submit"]').getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom, roomTop: room.top, fits: rect.top >= room.top && rect.bottom <= window.innerHeight && send.bottom <= window.innerHeight };
        });
        assert(composerGeometry.fits, JSON.stringify({ width, viewportHeight, composerGeometry }));
        await page.screenshot({ path: join(output, `${width}x${viewportHeight}-${language}-upload.png`) });
        await page.getByRole('button', { name: labels.remove }).click();
        await page.locator('textarea').evaluate((textarea, encoded) => {
          const clipboard = new DataTransfer();
          clipboard.items.add(new File([Uint8Array.from(atob(encoded), char => char.charCodeAt(0))], 'Screenshot.webp', { type: 'image/webp' }));
          textarea.focus();
          textarea.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: clipboard }));
        }, photo.toString('base64'));
        await page.getByRole('button', { name: labels.remove }).waitFor();
        assert.equal((await page.evaluate(() => window.__chatMediaReview.mutations)).length, 0);
        await page.screenshot({ path: join(output, `${width}x${viewportHeight}-${language}-paste.png`) });
        await page.getByRole('button', { name: labels.remove }).click();
        await page.getByRole('button', { name: labels.add, exact: true }).click();
        await page.getByRole('button', { name: labels.youtube, exact: true }).click();
        await page.getByRole('textbox', { name: labels.url }).fill('https://youtu.be/dQw4w9WgXcQ');
        await page.getByRole('button', { name: labels.attach }).click();
        await page.getByRole('button', { name: labels.send, exact: true }).click();
        const review = await page.evaluate(() => window.__chatMediaReview);
        assert(review.mutations.some(item => item.media?.videoId === 'dQw4w9WgXcQ' && item.content === ''));
        assert.equal(review.unexpected.length, 0); assert.equal(review.closed, 0); assert.equal(review.focused, 0); assert.equal(errors.length, 0, errors.join('\n'));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        results.push({ width, viewportHeight, language, ...geometry, portrait, errors }); await page.close();
      }
    }
    await writeFile(join(output, 'review.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
}
