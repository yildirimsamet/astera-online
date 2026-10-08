import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getWikiArticle, getWikiPage, wikiArticles, wikiCategories, wikiRoot, translatedWikiPath } from '../wiki/catalog.js';
import { WikiArticleList, WikiBreadcrumbs, WikiMenu, WikiPageContent, WikiPublicLink, articleSearchText } from '../wiki/WikiContent.js';
import { wikiLabels } from '../wiki/labels.js';
import type { WikiLanguage } from '../wiki/model.js';
import '../wiki/styles.css';

/** Same content and URLs as the public edition. No game query or mutation. */
export function WikiScreen({ language: initialLanguage = 'en' }: { language?: string }) {
  const [language, setLanguage] = useState<WikiLanguage>(initialLanguage === 'tr' ? 'tr' : 'en');
  const [trail, setTrail] = useState<readonly string[]>([wikiRoot(language)]);
  const [query, setQuery] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const tools = useRef<HTMLDivElement>(null);
  const path = trail[trail.length - 1] ?? wikiRoot(language);
  const previousPath = useRef(path);
  const page = getWikiPage(path);
  if (!page) throw new Error(`Unknown Wiki screen path ${path}`);
  const words = wikiLabels[language];
  const searchIndex = useMemo(() => wikiArticles.map(article => ({ article, text: `${article.id.replaceAll('_', ' ')} ${article.title.en} ${articleSearchText(article, language)}`.toLocaleLowerCase(language) })), [language]);
  const terms = query.trim().toLocaleLowerCase(language).split(/\s+/).filter(Boolean);
  const results = terms.length ? searchIndex.filter(entry => terms.every(term => entry.text.includes(term))).map(entry => entry.article) : undefined;
  const navigate = (next: string): void => { if (!getWikiPage(next)) return; if (menu.current) menu.current.open = false; setQuery(''); setTrail(current => current[current.length - 1] === next ? current : [...current, next]); };
  useLayoutEffect(() => {
    if (previousPath.current === path) return;
    previousPath.current = path;
    if (menu.current) menu.current.open = false;
    const room = container.current;
    const scroll = room?.closest<HTMLElement>('[data-sheet-body]') ?? room;
    const target = content.current;
    if (scroll && target) {
      const top = scroll.scrollTop + target.getBoundingClientRect().top - scroll.getBoundingClientRect().top - (tools.current?.getBoundingClientRect().height ?? 0) - 12;
      scroll.scrollTo({ top: Math.max(0, top) });
      target.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
    }
  }, [path]);
  const previous = trail[trail.length - 2];
  const previousPage = previous ? getWikiPage(previous) : undefined;
  const previousName = (previousPage?.articleId ? getWikiArticle(previousPage.articleId)?.title[language]
    : wikiCategories.find(category => category.id === previousPage?.categoryId)?.title[language]) ?? words.home;
  return <div className="wiki wiki-room" ref={container} lang={language}>
    <div className="wiki-room-tools" ref={tools}>{previous ? <button className="wiki-back" onClick={() => { setQuery(''); setTrail(current => current.slice(0, -1)); }}>← {words.back} {previousName}</button> : <span className="wiki-eyebrow">ASTERA / WIKI</span>}<div className="wiki-editions" aria-label={words.edition}>{(['en', 'tr'] as const).map(next => <button key={next} aria-pressed={language === next} onClick={() => { setLanguage(next); setTrail(current => current.map(item => { const old = getWikiPage(item); return old ? translatedWikiPath(old, next) : wikiRoot(next); })); }}>{next === 'en' ? 'English' : 'Türkçe'}</button>)}</div></div>
    <label className="wiki-search"><span>{words.search}</span><input type="search" value={query} placeholder={words.search} onChange={event => { setQuery(event.target.value); }} /></label>
    {results ? <section className="wiki-search-results"><h1>{words.search}</h1><p role="status">{results.length ? `${results.length} ${words.articles}` : words.noResults}</p><WikiArticleList articles={results} language={language} onNavigate={navigate} /></section> : <><WikiMenu page={page} onNavigate={navigate} className="wiki-room-menu" menuRef={menu} /><div className="wiki-room-content" ref={content}><WikiBreadcrumbs page={page} onNavigate={navigate} /><WikiPublicLink page={page} /><WikiPageContent page={page} onNavigate={navigate} /></div></>}
  </div>;
}
