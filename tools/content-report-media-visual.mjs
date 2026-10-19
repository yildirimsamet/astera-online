import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

/** Real moderation UI; all evidence/transport is a fixture, never a real private report. */
export async function verifyContentReportMedia(output) {
  await mkdir(output, { recursive: true }); const results = [];
  const browser = await chromium.launch();
  try {
    for (const width of [350, 1280]) for (const language of ['tr', 'en', 'de', 'fr', 'es', 'ja']) {
      const page = await browser.newPage({ viewport: { width, height: 812 } });
      const errors = []; const thirdParty = []; let requests = 0;
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (/(?:^|\.)(?:youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com)$/.test(new URL(request.url()).hostname)) thirdParty.push(request.url()); });
      const mediaPattern = '**/api/admin/content-reports/*/media';
      await page.route(mediaPattern, async route => { requests++; await route.fulfill({ path: resolve('apps/web/public/assets/images/landing/orbit-hero-v1.webp'), contentType: 'image/webp', headers: { 'cache-control': 'private, no-store' } }); });
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=base-fleet&lng=${language}`);
      await page.waitForFunction(() => performance.getEntriesByType('resource').some(entry => /\/@tanstack_react-query\.js\?/.test(entry.name)));
      const labels = await page.evaluate(async language => {
        const urls = performance.getEntriesByType('resource').map(entry => entry.name);
        const moduleUrl = path => urls.findLast(url => new URL(url).pathname === path) ?? path;
        const [{ default: { createElement: h } }, { default: { createRoot } }, { QueryClient, QueryClientProvider }, { Api }, { ApiProvider }, { AdminContentReports }, { default: i18n }] = await Promise.all([
          import(urls.find(url => /\/react\.js\?/.test(url))), import(urls.find(url => /\/react-dom_client\.js\?/.test(url))), import(urls.find(url => /\/@tanstack_react-query\.js\?/.test(url))),
          import(moduleUrl('/src/api/client.ts')), import(moduleUrl('/src/api/context.tsx')), import(moduleUrl('/src/screens/AdminContentReports.tsx')), import(moduleUrl('/src/i18n/index.ts')),
        ]);
        await i18n.changeLanguage(language);
        const id = '11111111-1111-4111-8111-111111111111';
        const row = { id, kind: 'message', channel: 'dm', messageId: id, reason: 'OTHER', details: 'Fixture evidence for operator review.', evidence: { username: 'Scout Beyond the Asteroid Belt', playerId: id, content: 'Only the reported attachment is opened.', media: null }, status: 'PENDING', createdAt: new Date(), targetUsername: 'Scout' };
        const record = media => ({ ...row, evidence: { ...row.evidence, media } });
        const query = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
        const image = { kind: 'image', assetId: id, mimeType: 'image/webp' };
        query.setQueryData(['admin-content-reports'], { reports: [record(image)] });
        const api = new Api({ fetch: async () => new Response('{}') });
        window.__reviewKind = kind => { query.setQueryData(['admin-content-reports'], { reports: [record(kind === 'youtube' ? { kind, videoId: 'abcdefghijk' } : { kind, assetId: '22222222-2222-4222-8222-222222222222', mimeType: 'video/mp4' })] }); };
        const host = document.createElement('div'); document.body.replaceChildren(host);
        createRoot(host).render(h(QueryClientProvider, { client: query }, h(ApiProvider, { api }, h('main', { className: 'min-h-dvh bg-v2-void p-3 font-v2-ui text-v2-ink' }, h('div', { className: 'mx-auto max-w-xl' }, h(AdminContentReports))))));
        return Object.fromEntries(['reviewMedia', 'closeMedia', 'mediaImage', 'mediaVideo', 'mediaFailed', 'mediaYouTube'].map(key => [key, i18n.t(`moderation.admin.${key}`)]));
      }, language);
      const capture = async state => {
        await page.waitForTimeout(80);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${language}/${width}/${state}: overflow`);
        assert.deepEqual(errors, []); assert.deepEqual(thirdParty, []);
        await page.screenshot({ path: join(output, `${language}-${width}-${state}.png`), fullPage: true });
        results.push({ language, width, state, noHorizontalOverflow: true, noThirdPartyRequests: true, errors });
      };
      const review = page.getByRole('button', { name: labels.reviewMedia, exact: true });
      await review.waitFor(); assert.equal(requests, 0); await capture('closed');
      await review.click(); const image = page.getByRole('img', { name: labels.mediaImage, exact: true });
      await image.waitFor(); await image.evaluate(node => node.decode()); assert.equal(requests, 1); await capture('image');
      await page.getByRole('button', { name: labels.closeMedia, exact: true }).click();
      await page.unroute(mediaPattern); await page.route(mediaPattern, route => route.fulfill({ status: 404, body: '', headers: { 'cache-control': 'no-store' } }));
      await review.click(); await page.getByRole('alert').filter({ hasText: labels.mediaFailed }).waitFor(); await capture('unavailable');
      await page.evaluate(() => window.__reviewKind('video')); await review.click();
      const video = page.getByLabel(labels.mediaVideo, { exact: true }); await video.waitFor();
      assert.equal(await video.getAttribute('preload'), 'none'); assert.equal(await video.getAttribute('autoplay'), null); await capture('video');
      await page.evaluate(() => window.__reviewKind('youtube'));
      await page.getByRole('link', { name: labels.mediaYouTube, exact: true }).waitFor();
      assert.equal(await page.locator('iframe,video,img').count(), 0); await capture('youtube-link'); await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log(`Reported media review: ${results.length} browser states verified.`);
}
