import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { LANGUAGES } from '../src/i18n/languages.js';
import { PublicLanding } from '../src/landing/public/PublicLanding.js';
import { LANDING_COPY } from '../src/landing/public/content.js';
import { wikiPages } from '../src/wiki/catalog.js';
import { wikiSitemap } from '../src/wiki/publication.js';
import { renderLandingDocument } from '../landingPublication.js';

const template = readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf8');
it.each(LANGUAGES)('publishes readable %s content, language SEO and only real internal destinations', language => {
  const html = renderLandingDocument(template, language, `/${language}/`);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  expect(doc.documentElement.lang).toBe(language);
  expect(doc.title).toBe(LANDING_COPY[language].title);
  expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`https://asteraonline.space/${language}/`);
  expect(doc.querySelectorAll('link[rel="alternate"][hreflang]')).toHaveLength(7);
  expect(doc.querySelectorAll('h1')).toHaveLength(1);
  expect(doc.querySelectorAll('h2').length).toBeGreaterThanOrEqual(5);
  expect(doc.querySelector('script[type="module"]')).not.toBeNull();
  expect(doc.querySelector('[data-loading-screen]')).toBeNull();
  expect(doc.querySelector('meta[property="og:description"]')?.getAttribute('content')).toBe(LANDING_COPY[language].description);
  expect(doc.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
  for (const link of doc.querySelectorAll<HTMLAnchorElement>('a[href^="/wiki"]')) expect(wikiPages.some(page => page.path === link.getAttribute('href'))).toBe(true);
  expect(wikiSitemap()).toContain(`<loc>https://asteraonline.space/${language}/</loc>`);
  // Text belongs to the actual shared presentation, rather than a crawler-only substitute.
  const component = new DOMParser().parseFromString(renderToStaticMarkup(<PublicLanding language={language} />), 'text/html');
  expect(doc.querySelector('[data-public-landing]')?.textContent).toBe(component.querySelector('main')?.textContent);
});
it('keeps root as the English x-default without duplicating canonical or old social metadata', () => {
  const doc = new DOMParser().parseFromString(renderLandingDocument(template, 'en', '/'), 'text/html');
  expect(doc.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://asteraonline.space/');
  expect(doc.querySelectorAll('meta[property="og:title"]')).toHaveLength(1);
  expect(doc.querySelector('noscript main')).toBeNull();
});
it('can localize a compiled entry while retaining Vite nonce metadata and eliminating stale language declarations', () => {
  const built = renderLandingDocument(template, 'en', '/').replace('</head>', '<meta property="csp-nonce" nonce="__CSP_NONCE__"><script type="module" nonce="__CSP_NONCE__" src="/assets/index-hash.js"></script></head>');
  const doc = new DOMParser().parseFromString(renderLandingDocument(built, 'tr', '/tr/'), 'text/html');
  expect(doc.querySelectorAll('h1')).toHaveLength(1);
  expect(doc.querySelectorAll('link[rel="alternate"]')).toHaveLength(7);
  expect(doc.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
  expect(doc.querySelector('meta[property="csp-nonce"]')?.getAttribute('nonce')).toBe('__CSP_NONCE__');
  expect(doc.querySelector('script[src="/assets/index-hash.js"]')).not.toBeNull();
  expect(doc.querySelectorAll('link[href="/landing/style.css"]')).toHaveLength(1);
});
