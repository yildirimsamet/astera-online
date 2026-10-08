import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { wikiPages } from './src/wiki/catalog.js';
import { renderWiki404, renderWikiPage, wikiAssets, wikiSitemap } from './src/wiki/publication.js';

/** Build-time HTML, independent of authentication, the API and the game bundle. */
export function wikiPlugin(): Plugin {
  const root = dirname(fileURLToPath(import.meta.url));
  const require = createRequire(import.meta.url);
  const resources = new Map<string, { source: string | Uint8Array; type: string }>();
  const rendered = new Map<string, string>();
  let html: Map<string, string> | undefined;
  const published = (): Map<string, string> => { html ??= wikiAssets(); return html; };
  const resourceAssets = (): typeof resources => {
    if (resources.size) return resources;
    resources.set('wiki/style.css', { source: readFileSync(resolve(root, 'src/wiki/public-fonts.css'), 'utf8') + readFileSync(resolve(root, 'src/wiki/styles.css'), 'utf8'), type: 'text/css; charset=utf-8' });
    const tokens = readFileSync(resolve(root, 'src/v2/tokens.css'), 'utf8');
    resources.set('wiki/tokens.css', { source: tokens.replace('@theme {', ':root {'), type: 'text/css; charset=utf-8' });
    for (const subset of ['latin', 'latin-ext']) resources.set(`wiki/archivo-${subset}.woff2`, { source: readFileSync(require.resolve(`@fontsource-variable/archivo/files/archivo-${subset}-standard-normal.woff2`)), type: 'font/woff2' });
    return resources;
  };
  const pages = new Map(wikiPages.map(page => [page.path, page]));
  const aliases = new Map<string, string>(wikiPages.flatMap(page => [[`${page.path}/`, page.path], [`/${page.fileName}`, page.path], [`${page.path}.html`, page.path]] as const));
  const middleware = (request: IncomingMessage, response: ServerResponse, next: () => void): void => {
    const url = request.url ?? ''; const separator = url.indexOf('?'); const path = separator === -1 ? url : url.slice(0, separator); const query = separator === -1 ? '' : url.slice(separator);
    if (path !== '/sitemap.xml' && path !== '/wiki' && path !== '/wiki.html' && !path.startsWith('/wiki/')) { next(); return; }
    const end = (status: number, body: string | Uint8Array, type: string): void => { response.statusCode = status; response.setHeader('Content-Type', type); response.setHeader('X-Content-Type-Options', 'nosniff'); response.end(request.method === 'HEAD' ? undefined : body); };
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.setHeader('Allow', 'GET, HEAD'); end(405, 'Method not allowed', 'text/plain; charset=utf-8'); return; }
    if (path === '/sitemap.xml') { end(200, wikiSitemap(), 'application/xml; charset=utf-8'); return; }
    const resource = resourceAssets().get(path.slice(1));
    if (resource) { end(200, resource.source, resource.type); return; }
    const page = pages.get(path);
    if (page) {
      let body = rendered.get(path);
      if (body === undefined) { body = renderWikiPage(page); rendered.set(path, body); }
      end(200, body, 'text/html; charset=utf-8'); return;
    }
    const canonical = aliases.get(path);
    if (canonical) { response.setHeader('Location', canonical + query); end(308, '', 'text/plain; charset=utf-8'); return; }
    response.setHeader('X-Robots-Tag', 'noindex'); end(404, renderWiki404(path.startsWith('/wiki/tr/') ? 'tr' : 'en'), 'text/html; charset=utf-8');
  };
  return {
    name: 'astera-public-wiki',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
    generateBundle() {
      for (const [fileName, source] of published()) this.emitFile({ type: 'asset', fileName, source });
      for (const [fileName, resource] of resourceAssets()) this.emitFile({ type: 'asset', fileName, source: resource.source });
    },
  };
}
