import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { LANGUAGES, isLanguage } from './src/i18n/languages.js';
import { renderLandingDocument } from './landingPublication.js';

export function landingPlugin(): Plugin {
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
  const css = () => read('./src/wiki/public-fonts.css') + read('./src/landing/public/public-landing.css');
  let styleFile = 'landing/style.css';
  const publish = (html: string, language: Parameters<typeof renderLandingDocument>[1], path: string) => renderLandingDocument(html, language, path).replace('href="/landing/style.css"', `href="/${styleFile}"`);
  return {
    name: 'astera-public-landing', enforce: 'post',
    configResolved(config) { if (config.command === 'build') styleFile = `assets/landing/style-${createHash('sha256').update(css()).digest('hex').slice(0, 12)}.css`; },
    transformIndexHtml: { order: 'post', handler(html, context) {
      const language = /^\/(tr|en|fr|de|es|ja)\/?$/.exec(context.path)?.[1];
      return publish(html, isLanguage(language) ? language : 'en', isLanguage(language) ? `/${language}/` : '/');
    } },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://landing.invalid');
        const language = /^\/(tr|en|fr|de|es|ja)(\/|\/index\.html)?$/.exec(url.pathname)?.[1];
        if (url.pathname !== '/landing/style.css' && !language) { next(); return; }
        if (request.method !== 'GET' && request.method !== 'HEAD') { response.statusCode = 405; response.setHeader('Allow', 'GET, HEAD'); response.end(); return; }
        if (language && url.pathname !== `/${language}/`) { response.statusCode = 308; response.setHeader('Location', `/${language}/${url.search}`); response.end(); return; }
        response.setHeader('Content-Type', language ? 'text/html; charset=utf-8' : 'text/css; charset=utf-8');
        if (!language) { response.end(request.method === 'HEAD' ? undefined : css()); return; }
        void server.transformIndexHtml(url.pathname, read('./index.html')).then(html => { response.end(request.method === 'HEAD' ? undefined : html); }).catch(next);
      });
    },
    generateBundle(_options, bundle) {
      const index = bundle['index.html'];
      if (index?.type !== 'asset' || typeof index.source !== 'string') throw new Error('Missing web landing HTML');
      // Keep ALL compiled head information, including Vite's dynamic-import CSP nonce meta.
      const built = index.source;
      for (const language of LANGUAGES) {
        this.emitFile({ type: 'asset', fileName: `${language}/index.html`, source: publish(built, language, `/${language}/`) });
      }
      this.emitFile({ type: 'asset', fileName: styleFile, source: css() });
    },
  };
}
