import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { ALL_HULLS, BUILDING_IDS, INSTRUMENT_IDS, RESEARCH_PROJECT_IDS, SATELLITE_IDS, HULLS, storageHours, PIRATE, PROSPECTOR, CLAN, TRAVEL } from '@astera/rules';
import { subjectReference } from '../src/wiki/facts.js';
import { wikiArticles, wikiCategories, wikiPages, wikiPath, getWikiArticle } from '../src/wiki/catalog.js';
import { renderWikiPage, wikiAssets, wikiSitemap } from '../src/wiki/publication.js';
import { PUBLISHER_ORIGIN, publisherPaths } from '../src/lib/publisherPages.js';
import { en } from '../src/i18n/locales/en/index.js';
import { tr } from '../src/i18n/locales/tr/index.js';

const documentFor = (html: string): Document => new DOMParser().parseFromString(html, 'text/html');

describe('the published Wiki contract', () => {
  it('provides a collapsed native mobile menu with the current category in its summary', () => {
    for (const language of ['en', 'tr'] as const) {
      const page = wikiPages.find(p => p.articleId === 'hull.DART' && p.language === language);
      if (!page) throw new Error('Missing Dart page');
      const doc = documentFor(renderWikiPage(page));
      const menu = doc.querySelector('details.wiki-mobile-menu');
      expect(menu).not.toBeNull();
      expect(menu?.hasAttribute('open')).toBe(false);
      expect(menu?.querySelector('summary')?.textContent).toContain(language === 'en' ? 'Fleet & flights' : 'Filo ve uçuşlar');
      expect(menu?.querySelectorAll('nav a')).toHaveLength(wikiCategories.length + 1);
      expect(doc.querySelector('main h1')).not.toBeNull();
    }
  });
  it('publishes the same Command Core explanation as the in-game item sheet', () => {
    for (const [language, locale] of [['en', en], ['tr', tr]] as const) {
      const page = wikiPages.find(p => p.articleId === 'building.CORE' && p.language === language);
      if (!page) throw new Error('Missing Core page');
      const doc = documentFor(renderWikiPage(page));
      expect(doc.querySelector('article')?.textContent).toContain(locale.vocabulary.building.CORE.detail);
    }
  });
  it('covers every current rule catalogue in both languages with useful content', () => {
    for (const [kind, ids] of [
      ['building', BUILDING_IDS], ['instrument', INSTRUMENT_IDS], ['satellite', SATELLITE_IDS],
      ['hull', ALL_HULLS], ['research', RESEARCH_PROJECT_IDS],
    ] as const) {
      expect(wikiArticles.filter(a => a.subject?.kind === kind).map(a => a.subject?.id).sort()).toEqual([...ids].sort());
    }
    expect(wikiCategories.length).toBeGreaterThanOrEqual(10);
    for (const article of wikiArticles) for (const language of ['en', 'tr'] as const) {
      const page = wikiPages.find(p => p.articleId === article.id && p.language === language);
      expect(page, article.id).toBeDefined();
      if (!page) throw new Error(article.id);
      const doc = documentFor(renderWikiPage(page));
      expect((doc.querySelector('article')?.textContent ?? '').length, article.id).toBeGreaterThan(450);
      expect(doc.querySelectorAll('article h2').length, article.id).toBeGreaterThanOrEqual(2);
      expect(doc.body.textContent, `${article.id} ${language}`).not.toMatch(/being written|yakında eklenecek|TODO|\bD\d{3}\b|packages\/rules|apps\/server|localhost|admin\/|\bbots?\b|server.played|yapay komutan/i);
      expect(doc.body.textContent).not.toMatch(/\[\[|\{\{/);
    }
  });

  it('has permanent unique lowercase paths and no phantom articles', () => {
    const paths = wikiPages.map(p => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path).toMatch(/^\/wiki(?:\/[a-z0-9-]+)*$/);
    expect(getWikiArticle('no-such-article')).toBeUndefined();
    expect(wikiPath('hull.DART', 'en')).toBe('/wiki/fleet/dart');
    expect(wikiPath('hull.DART', 'tr')).toBe('/wiki/tr/fleet/dart');
  });

  it('renders complete metadata, semantic headings, breadcrumbs and static navigation for every page', () => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    const knownPaths = new Set([...wikiPages.map(p => p.path), '/', ...publisherPaths()]);
    for (const page of wikiPages) {
      const doc = documentFor(renderWikiPage(page));
      const canonical = `${PUBLISHER_ORIGIN}${page.path}`;
      expect(doc.documentElement.lang).toBe(page.language);
      expect(doc.querySelectorAll('h1')).toHaveLength(1);
      expect((doc.querySelector('main')?.textContent ?? '').length).toBeGreaterThan(200);
      expect(doc.querySelector('nav[aria-label]')).not.toBeNull();
      expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(canonical);
      expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index,follow');
      expect(doc.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(canonical);
      expect(doc.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(doc.title);
      const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
      expect(description.length).toBeGreaterThan(50);
      expect(description.length).toBeLessThanOrEqual(200);
      expect(doc.querySelector('meta[property="og:description"]')?.getAttribute('content')).toBe(description);
      expect(titles.has(doc.title)).toBe(false);
      expect(descriptions.has(description)).toBe(false);
      titles.add(doc.title); descriptions.add(description);
      const raw: unknown = JSON.parse(doc.querySelector('script[type="application/ld+json"]')?.textContent ?? 'null');
      const data = z.object({ '@context': z.literal('https://schema.org'), '@graph': z.array(z.object({ '@type': z.string() })) }).parse(raw);
      expect(data['@graph'].some(node => node['@type'] === 'BreadcrumbList')).toBe(true);
      const translated = doc.querySelector(`link[rel="alternate"][hreflang="${page.language === 'en' ? 'tr' : 'en'}"]`)?.getAttribute('href');
      expect(wikiPages.some(p => `${PUBLISHER_ORIGIN}${p.path}` === translated && p.articleId === page.articleId && p.categoryId === page.categoryId)).toBe(true);
      const icon = doc.querySelector('link[rel="icon"]')?.getAttribute('href');
      expect(icon).toBeTruthy();
      expect(existsSync(resolve(process.cwd(), `public${icon ?? ''}`))).toBe(true);
      for (const image of doc.querySelectorAll('img[src]')) expect(existsSync(resolve(process.cwd(), `public${image.getAttribute('src')?.split('?')[0] ?? ''}`))).toBe(true);
      expect(doc.querySelectorAll('script:not([type="application/ld+json"])')).toHaveLength(0);
      for (const link of doc.querySelectorAll('a[href]')) {
        const href = link.getAttribute('href') ?? '';
        if (href.startsWith('#')) { expect(doc.getElementById(href.slice(1))).not.toBeNull(); continue; }
        expect(knownPaths.has(href.split('#')[0] ?? ''), `${page.path} → ${href}`).toBe(true);
      }
    }
  });

  it('uses the current base hull values, rather than the September draft', () => {
    const page = wikiPages.find(p => p.articleId === 'hull.DART' && p.language === 'en');
    if (!page) throw new Error('Dart page missing');
    const doc = documentFor(renderWikiPage(page));
    expect(doc.querySelector('[data-stat="attack"]')?.textContent).toContain(String(HULLS.DART.atk));
    expect(doc.querySelector('[data-stat="hull"]')?.textContent).toContain(String(HULLS.DART.hp));
  });

  it('quotes Store capacity through the effective storage rule, including price headroom', () => {
    const reference = subjectReference({ kind: 'building', id: 'VAULT' }, 'en');
    const table = reference.blocks.find(block => block.kind === 'table');
    if (table?.kind !== 'table') throw new Error('Missing storage table');
    const column = table.columns.indexOf('Base storage hours');
    for (const [index, row] of table.rows.entries()) expect(row[column]).toBe(new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(storageHours(index + 1)));
  });

  it('uses the game’s Turkish class names in the counter comparison', () => {
    const article = getWikiArticle('combat.counters');
    if (!article) throw new Error('Missing counter guide');
    const table = article.sections.tr.flatMap(s => s.blocks).find(b => b.kind === 'table');
    if (table?.kind !== 'table') throw new Error('Missing counter table');
    expect(table.rows.map(row => row[0])).toEqual(['Akıncı', 'Sur', 'Mızrak']);
    const text = JSON.stringify([article.description.tr, article.sections.tr]);
    expect(text).toContain('Akıncı');
    expect(text).toContain('Sur');
    expect(text).not.toMatch(/Avcı|Siper/);
  });

  it('publishes the quoted mining, pirate and clan-aid limits rather than referring to absent numbers', () => {
    const values = (id: string): string => {
      const article = getWikiArticle(id);
      if (!article) throw new Error(`Missing ${id}`);
      return article.sections.en.flatMap(s => s.blocks.flatMap(b => b.kind === 'table' ? b.rows.flat() : [])).join(' ');
    };
    expect(values('galaxy.mining')).toContain(String(PROSPECTOR.max));
    expect(values('galaxy.mining')).toContain(String(PROSPECTOR.thirdCraftRung));
    expect(values('galaxy.pirates')).toContain(`${PIRATE.captureChance[4] * 100}%`);
    expect(values('clan.aid')).toContain(`${CLAN.raidLootShare * 100}%`);
    expect(values('clan.aid')).toContain(`${CLAN.aidSpeedMultiplier}×`);
  });

  it('generates the entire sitemap and physical static HTML from the same page manifest', () => {
    const doc = new DOMParser().parseFromString(wikiSitemap(), 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    const urls = [...doc.querySelectorAll('loc')].map(n => n.textContent);
    const expected = ['/', ...publisherPaths(), ...wikiPages.map(p => p.path)].map(p => `${PUBLISHER_ORIGIN}${p}`);
    expect(urls).toEqual(expected);
    const assets = wikiAssets();
    expect(assets.get('sitemap.xml')).toBe(wikiSitemap());
    for (const page of wikiPages) expect(assets.get(page.fileName)).toContain('<main');
    expect(readFileSync(resolve(process.cwd(), 'public/robots.txt'), 'utf8')).not.toMatch(/Disallow: \/wiki/);
  });

  it('explains the slower-pace ceiling without capping a full-speed crossing', () => {
    const article = getWikiArticle('fleet.flights');
    if (!article) throw new Error('Missing flight guide');
    const tables = article.sections.en.flatMap(section => section.blocks.flatMap(block => block.kind === 'table' ? block.rows.flat() : []));
    expect(tables).toContain(`${TRAVEL.pacedFlightCapMinutes / 60} h`);
    const prose = article.sections.en.flatMap(section => section.blocks.flatMap(block => block.kind === 'text' ? [block.text] : [])).join(' ');
    expect(prose).toMatch(/full speed.*longer/i);
    expect(prose).not.toContain('Each leg has a maximum flight duration');
  });

  it('ships clean production routing without an SPA fallback for missing Wiki pages', () => {
    const nginx = readFileSync(resolve(process.cwd(), '../../deploy/nginx/astera.conf'), 'utf8');
    expect(nginx).toContain('location = /wiki {');
    expect(nginx).toContain('location /wiki/ {');
    expect(nginx).toContain('try_files $uri.html $uri/index.html $uri =404;');
    expect(nginx).toContain('error_page 404 /wiki/404.html;');
    expect(nginx).toContain('return 308 $wiki_slash$is_args$args;');
  });

  it('makes the Wiki discoverable in the original home HTML and existing publisher pages', () => {
    expect(readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')).toContain('href="/wiki"');
    expect(readFileSync(resolve(process.cwd(), 'public/about.html'), 'utf8')).toContain('href="/wiki"');
    expect(readFileSync(resolve(process.cwd(), 'public/hakkinda.html'), 'utf8')).toContain('href="/wiki/tr"');
    expect(readFileSync(resolve(process.cwd(), 'public/quick-start-guide.html'), 'utf8')).toContain('href="/wiki/basics/quick-start"');
    expect(readFileSync(resolve(process.cwd(), 'public/hizli-baslangic-rehberi.html'), 'utf8')).toContain('href="/wiki/tr/basics/quick-start"');
  });
});
