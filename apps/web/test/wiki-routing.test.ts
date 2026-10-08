// @vitest-environment node
import { createServer, preview, type ViteDevServer, type PreviewServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { wikiPlugin } from '../wikiPlugin.js';
import { wikiPages } from '../src/wiki/catalog.js';
import { renderWikiPage } from '../src/wiki/publication.js';

let server: ViteDevServer;
let previewServer: PreviewServer;
let origin: string;
let previewOrigin: string;
beforeAll(async () => {
  server = await createServer({ configFile: false, plugins: [wikiPlugin()], optimizeDeps: { noDiscovery: true, include: [] }, server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  origin = server.resolvedUrls?.local[0] ?? '';
  previewServer = await preview({ configFile: false, plugins: [wikiPlugin()], preview: { host: '127.0.0.1', port: 0 } });
  previewOrigin = previewServer.resolvedUrls?.local[0] ?? '';
});
afterAll(async () => {
  await server.close();
  await new Promise<void>((resolve, reject) => { previewServer.httpServer.close(error => { if (error) reject(error); else resolve(); }); });
});
for (const mode of ['dev', 'preview'] as const) describe(`${mode} Wiki delivery`, () => {
  const url = (path: string): string => `${mode === 'dev' ? origin : previewOrigin}${path.replace(/^\//, '')}`;
  it('serves first-response article HTML with no login or API dependency', async () => {
    const page = wikiPages.find(p => p.articleId === 'hull.DART' && p.language === 'tr');
    if (!page) throw new Error('missing Dart');
    const response = await fetch(url(`${page.path}?utm_source=wiki`));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toBe(renderWikiPage(page));
    expect((await fetch(url(page.path), { method: 'HEAD' })).status).toBe(200);
  });
  it.each(['/wiki/unknown', '/wiki/tr/fleet/nonexistent', '/wiki/en', '/wiki/fleet/DART', '/wiki/fleet/dart/extra', '/wiki/%ZZ', '/wiki/fleet/dart.json'])('returns a genuine noindex 404 for %s', async path => {
    const response = await fetch(url(path));
    expect(response.status).toBe(404);
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect(await response.text()).toContain('404');
  });
  it.each(['/wiki.html', '/wiki/', '/wiki/fleet/dart/', '/wiki/fleet/dart.html', '/wiki/tr/index.html'])('redirects an existing alias %s permanently', async path => {
    const response = await fetch(url(`${path}?utm_source=wiki`), { redirect: 'manual' });
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toMatch(/^\/wiki/);
    expect(response.headers.get('location')).toMatch(/\?utm_source=wiki$/);
  });
  it('serves an automatically merged sitemap', async () => {
    const response = await fetch(url('/sitemap.xml'));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('https://asteraonline.space/wiki/tr/fleet/dart');
  });
});
