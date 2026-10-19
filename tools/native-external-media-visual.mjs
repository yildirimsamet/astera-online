import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Real native media fallback and rich-content sink, with a simulated platform bridge only. */
export async function verifyNativeExternalMedia(output) {
  await mkdir(output, { recursive: true }); const results = [];
  const browser = await chromium.launch();
  try {
    for (const width of [350, 1280]) for (const language of ['tr', 'en', 'de', 'fr', 'es', 'ja']) {
      const page = await browser.newPage({ viewport: { width, height: 812 } }); const errors = []; const remote = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const host = new URL(route.request().url()).hostname;
        if (host && host !== '127.0.0.1' && host !== 'localhost') { remote.push(route.request().url()); return route.abort(); }
        return route.continue();
      });
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=base-fleet&lng=${language}`);
      await page.waitForFunction(() => {
        const urls = performance.getEntriesByType('resource').map(entry => entry.name);
        return [/\/react\.js\?/, /\/react-dom_client\.js\?/].every(pattern => urls.some(url => pattern.test(url)));
      });
      const labels = await page.evaluate(async language => {
        await import('/src/platform/runtime.ts');
        const runtimeSource = await (await fetch('/src/platform/runtime.ts')).text();
        const coreUrl = /from ["']([^"']*capacitor_core[^"']*)["']/.exec(runtimeSource)?.[1];
        if (!coreUrl) throw new Error('Capacitor import URL missing from Vite platform module');
        const urls = performance.getEntriesByType('resource').map(entry => entry.name);
        const moduleUrl = path => urls.findLast(url => new URL(url).pathname === path) ?? path;
        const [{ default: { createElement: h } }, { default: { createRoot } }, { Capacitor }, { Api }, { ApiProvider }, { ChatMediaAttachment }, { RichContent }, { default: i18n }] = await Promise.all([
          import(urls.find(url => /\/react\.js\?/.test(url))), import(urls.find(url => /\/react-dom_client\.js\?/.test(url))), import(coreUrl),
          import(moduleUrl('/src/api/client.ts')), import(moduleUrl('/src/api/context.tsx')), import(moduleUrl('/src/screens/ChatMediaAttachment.tsx')), import(moduleUrl('/src/ui/RichContent.tsx')), import(moduleUrl('/src/i18n/index.ts')),
        ]);
        await i18n.changeLanguage(language);
        let platform = 'android'; Capacitor.isNativePlatform = () => platform !== 'web'; Capacitor.getPlatform = () => platform;
        const host = document.createElement('div'); document.body.replaceChildren(host); const root = createRoot(host);
        const api = new Api({ authTransport: null });
        const render = () => root.render(h(ApiProvider, { api }, h('main', { key: platform, className: 'min-h-dvh bg-v2-void p-3 font-v2-ui text-v2-ink' }, h('div', { className: 'mx-auto grid max-w-lg gap-4' },
          h(ChatMediaAttachment, { media: { kind: 'youtube', videoId: 'abcdefghijk' } }),
          h(RichContent, { html: '<p>Astera Online</p><iframe src="https://www.youtube-nocookie.com/embed/abcdefghijk"></iframe><img src="https://example.test/external-image.png" alt="Galaxy"><img src="/assets/images/landing/orbit-hero-v1.webp" alt="Astera Online">' })))));
        window.__externalPlatform = next => { platform = next; render(); }; render();
        return { youtube: i18n.t('chat.media.openYouTube'), notice: i18n.t('chat.media.externalNotice'), image: i18n.t('chat.media.openExternalImage') };
      }, language);
      for (const platform of ['android', 'ios']) {
        if (platform === 'ios') await page.evaluate(() => window.__externalPlatform('ios'));
        await page.getByText(labels.notice, { exact: true }).waitFor();
        assert.equal(await page.locator('iframe').count(), 0); assert.equal(await page.getByRole('link', { name: labels.youtube, exact: true }).count(), 2);
        assert.equal(await page.locator('img[src^="http"]').count(), 0); await page.getByRole('link', { name: `${labels.image} · Galaxy`, exact: true }).waitFor();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${platform}/${language}/${width}: overflow`);
        assert.deepEqual(remote, []); assert.deepEqual(errors, []);
        await page.screenshot({ path: join(output, `${language}-${width}-${platform}.png`), fullPage: true });
        results.push({ platform, language, width, noHorizontalOverflow: true, noRemoteMediaRequests: true, errors });
      }
      // Existing browser embeds stay intact. Requests are intercepted, never sent to third parties.
      await page.evaluate(() => window.__externalPlatform('web'));
      await page.locator('iframe').first().waitFor(); assert.equal(await page.locator('iframe').count(), 2);
      assert.equal(await page.locator('img[src="https://example.test/external-image.png"]').count(), 1);
      results.push({ platform: 'web', language, width, browserMediaPreserved: true }); await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log(`Native external media: ${results.length} browser states verified.`);
}
