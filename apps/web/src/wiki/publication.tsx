import { renderToStaticMarkup } from 'react-dom/server';
import { PUBLISHER_ORIGIN, publisherPaths } from '../lib/publisherPages.js';
import { getWikiArticle, wikiCategories, wikiCategoryPath, wikiPages, wikiRoot, translatedWikiPath } from './catalog.js';
import { WikiBreadcrumbs, WikiMenu, WikiNavigation, WikiPageContent } from './WikiContent.js';
import { wikiLabels } from './labels.js';
import type { WikiLanguage, WikiPage } from './model.js';

const absolute = (path: string): string => `${PUBLISHER_ORIGIN}${path}`;
export function wikiMetadata(page: WikiPage): { title: string; description: string } {
  const article = page.articleId ? getWikiArticle(page.articleId) : undefined;
  const category = wikiCategories.find(c => c.id === page.categoryId);
  const language = page.language;
  return { title: `${article?.title[language] ?? category?.title[language] ?? wikiLabels[language].home} | Astera Online ${language === 'en' ? 'Wiki' : 'Türkçe Wiki'}`, description: article?.description[language] ?? category?.description[language] ?? (language === 'en' ? 'Explore the Astera Online Wiki: current rules, buildings, research, ships, intelligence, combat, colonies, clans and galaxy events.' : 'Astera Online Wiki: güncel kurallar, binalar, araştırmalar, gemiler, istihbarat, savaş, koloniler, klanlar ve galaksi etkinlikleri.') };
}
function structuredData(page: WikiPage): string {
  const words = wikiLabels[page.language]; const meta = wikiMetadata(page); const category = wikiCategories.find(c => c.id === page.categoryId); const article = page.articleId ? getWikiArticle(page.articleId) : undefined;
  const crumbs = [{ name: words.home, path: wikiRoot(page.language) }, ...(category ? [{ name: category.title[page.language], path: wikiCategoryPath(category.id, page.language) }] : []), ...(article ? [{ name: article.title[page.language], path: page.path }] : [])];
  const data = { '@context': 'https://schema.org', '@graph': [
    { '@type': page.articleId ? 'Article' : 'CollectionPage', '@id': `${absolute(page.path)}#page`, url: absolute(page.path), name: meta.title, headline: meta.title, description: meta.description, inLanguage: page.language, isPartOf: { '@id': `${absolute(wikiRoot(page.language))}#wiki` }, ...(page.articleId ? { author: { '@type': 'Organization', name: 'Astera Online', url: PUBLISHER_ORIGIN }, mainEntityOfPage: absolute(page.path) } : {}) },
    { '@type': 'WebSite', '@id': `${absolute(wikiRoot(page.language))}#wiki`, name: 'Astera Online Wiki', url: absolute(wikiRoot(page.language)), inLanguage: page.language },
    { '@type': 'BreadcrumbList', itemListElement: crumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, name: crumb.name, item: absolute(crumb.path) })) },
  ] };
  return JSON.stringify(data).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
}

export function renderWikiPage(page: WikiPage): string {
  const words = wikiLabels[page.language]; const meta = wikiMetadata(page); const url = absolute(page.path);
  return '<!doctype html>' + renderToStaticMarkup(<html lang={page.language}><head>
    <meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="theme-color" content="#04060b" />
    <title>{meta.title}</title><meta name="description" content={meta.description} /><meta name="robots" content="index,follow" /><link rel="canonical" href={url} />
    {(['en', 'tr'] as const).map(language => <link key={language} rel="alternate" hrefLang={language} href={absolute(translatedWikiPath(page, language))} />)}<link rel="alternate" hrefLang="x-default" href={absolute(translatedWikiPath(page, 'en'))} />
    <meta property="og:type" content={page.articleId ? 'article' : 'website'} /><meta property="og:site_name" content="Astera Online" /><meta property="og:title" content={meta.title} /><meta property="og:description" content={meta.description} /><meta property="og:url" content={url} /><meta property="og:locale" content={page.language === 'en' ? 'en_US' : 'tr_TR'} /><meta property="og:locale:alternate" content={page.language === 'en' ? 'tr_TR' : 'en_US'} /><meta property="og:image" content={absolute('/assets/images/general/og-image.png')} /><meta property="og:image:alt" content="Astera Online" /><meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" type="image/png" href="/icons/favicon-32.png" /><link rel="stylesheet" href="/wiki/tokens.css" /><link rel="stylesheet" href="/wiki/style.css" />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData(page) }} />
  </head><body className="wiki-public"><div className="wiki">
    <a className="wiki-skip" href="#content">{page.language === 'en' ? 'Skip to content' : 'İçeriğe geç'}</a>
    <header className="wiki-topbar"><a href="/" className="wiki-brand"><img src="/assets/images/logos/logo-mark.png" width={36} height={36} alt="" /><span>ASTERA<span>ONLINE / WIKI</span></span></a><nav aria-label={words.edition} className="wiki-editions">{(['en', 'tr'] as const).map(language => <a href={translatedWikiPath(page, language)} lang={language} hrefLang={language} aria-current={page.language === language ? 'page' : undefined} key={language}>{language === 'en' ? 'English' : 'Türkçe'}</a>)}</nav><a href="/" className="wiki-play">{words.game}<span aria-hidden="true">↗</span></a></header>
    <div className="wiki-layout"><aside className="wiki-sidebar"><div className="wiki-desktop-navigation"><p className="wiki-eyebrow">{words.home}</p><WikiNavigation page={page} /></div><WikiMenu page={page} className="wiki-mobile-menu" /></aside><main id="content" className="wiki-main"><WikiBreadcrumbs page={page} /><WikiPageContent page={page} /><footer className="wiki-footer"><span>ASTERA ONLINE</span><span>{words.external}</span></footer></main></div>
  </div></body></html>);
}

export function renderWiki404(language: WikiLanguage): string {
  const words = wikiLabels[language];
  return '<!doctype html>' + renderToStaticMarkup(<html lang={language}><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="robots" content="noindex,follow" /><title>404 | Astera Online Wiki</title><link rel="stylesheet" href="/wiki/tokens.css" /><link rel="stylesheet" href="/wiki/style.css" /></head><body className="wiki-public"><main className="wiki wiki-error"><p className="wiki-eyebrow">ASTERA ONLINE / WIKI / 404</p><h1>{words.notFound}</h1><p>{words.notFoundText}</p><a className="wiki-start" href={wikiRoot(language)}>{words.home} →</a></main></body></html>);
}
export function wikiSitemap(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['/', ...publisherPaths(), ...wikiPages.map(p => p.path)].map(path => `  <url><loc>${absolute(path)}</loc></url>`).join('\n')}\n</urlset>\n`;
}
export function wikiAssets(): Map<string, string> {
  return new Map([['sitemap.xml', wikiSitemap()], ['wiki/404.html', renderWiki404('en')], ...wikiPages.map(page => [page.fileName, renderWikiPage(page)] as const)]);
}
