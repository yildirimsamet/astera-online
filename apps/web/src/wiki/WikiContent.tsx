import type { ComponentType, MouseEvent, ReactNode, Ref } from 'react';
import { AlloyIcon, AttackIcon, ClanIcon, CoreIcon, GalaxyIcon, GuideIcon, HullIcon, LeaderboardIcon, PlanetIcon, ResearchIcon, TelescopeIcon, ExternalIcon, ChevronIcon, CrystalIcon, type IconProps } from '../ui/icons/index.js';
import { getWikiArticle, wikiArticles, wikiCategories, wikiCategoryPath, wikiPath, wikiRoot } from './catalog.js';
import type { WikiArticle, WikiBlock, WikiCategory, WikiLanguage, WikiPage } from './model.js';
import { wikiLabels } from './labels.js';

export type WikiNavigate = (path: string) => void;
interface ContentProps { page: WikiPage; onNavigate?: WikiNavigate }
const icons: Record<WikiCategory['icon'], ComponentType<IconProps>> = { guide: GuideIcon, planet: PlanetIcon, alloy: AlloyIcon, core: CoreIcon, telescope: TelescopeIcon, research: ResearchIcon, fleet: HullIcon, attack: AttackIcon, galaxy: GalaxyIcon, clan: ClanIcon, leaderboard: LeaderboardIcon, commander: GuideIcon };

export function WikiLink({ href, children, onNavigate, className, ...props }: { href: string; children: ReactNode; onNavigate?: WikiNavigate; className?: string; 'aria-current'?: 'page'; 'aria-label'?: string; lang?: string; hrefLang?: string }) {
  const click = (event: MouseEvent<HTMLAnchorElement>): void => {
    if (!onNavigate || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || href.startsWith('#')) return;
    event.preventDefault(); onNavigate(href);
  };
  return <a href={href} onClick={onNavigate ? click : undefined} className={className} {...props}>{children}</a>;
}

export function WikiText({ text, language, onNavigate }: { text: string; language: WikiLanguage; onNavigate?: WikiNavigate }) {
  const nodes: ReactNode[] = [];
  const pattern = /\[\[([^|\]]+)\|([^\]]+)\]\]/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const id = match[1]; const title = match[2];
    if (!id || !title) continue;
    const article = getWikiArticle(id);
    if (!article) throw new Error(`Broken Wiki link ${id}`);
    nodes.push(text.slice(cursor, match.index), <WikiLink key={match.index} href={wikiPath(id, language)} onNavigate={onNavigate}>{title}</WikiLink>);
    cursor = match.index + match[0].length;
  }
  nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

function Block({ block, language, onNavigate }: { block: WikiBlock; language: WikiLanguage; onNavigate?: WikiNavigate }) {
  const text = (value: string): ReactNode => <WikiText text={value} language={language} onNavigate={onNavigate} />;
  switch (block.kind) {
    case 'text': return <p>{text(block.text)}</p>;
    case 'note': return <p className="wiki-note">{text(block.text)}</p>;
    case 'list': return <ul>{block.items.map((value, index) => <li key={index}>{text(value)}</li>)}</ul>;
    case 'stats': return <dl className="wiki-stats">{block.items.map(item => <div key={item.key} data-stat={item.key}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>;
    case 'table': return <div className="wiki-table-scroll" role="region" aria-label={block.caption} tabIndex={0}><table><caption>{block.caption}</caption><thead><tr>{block.columns.map((value, index) => <th scope="col" key={index}>{value === 'Alloy' || value === 'Alaşım' ? <AlloyIcon className="wiki-resource wiki-alloy" /> : value === 'Crystal' || value === 'Kristal' ? <CrystalIcon className="wiki-resource wiki-crystal" /> : value === 'Deuterium' || value === 'Döteryum' ? <span aria-hidden className="wiki-deut">◈</span> : null}{value}</th>)}</tr></thead><tbody>{block.rows.map((row, index) => <tr key={index}>{row.map((value, cell) => cell === 0 ? <th scope="row" key={cell}>{text(value)}</th> : <td key={cell}>{text(value)}</td>)}</tr>)}</tbody></table></div>;
  }
}

export function WikiArticleContent({ article, language, onNavigate }: { article: WikiArticle; language: WikiLanguage; onNavigate?: WikiNavigate }) {
  const words = wikiLabels[language]; const category = wikiCategories.find(c => c.id === article.category);
  return <>
    <article className="wiki-article">
      <header className={`wiki-article-head${article.image ? ' wiki-with-art' : ''}`}>
        <div><p className="wiki-eyebrow">{category?.title[language]}</p><h1 tabIndex={-1}>{article.title[language]}</h1><p className="wiki-lede">{article.description[language]}</p></div>
        {article.image ? <img src={article.image} width={180} height={180} alt="" className="wiki-art" /> : null}
      </header>
      <nav className="wiki-toc" aria-label={words.toc}><span className="wiki-eyebrow">{words.toc}</span>{article.sections[language].map(section => <a href={`#${section.id}`} key={section.id}>{section.title}</a>)}</nav>
      {article.sections[language].map(section => <section className="wiki-section" id={section.id} key={section.id}><h2>{section.title}</h2>{section.blocks.map((block, index) => <Block key={index} block={block} language={language} onNavigate={onNavigate} />)}</section>)}
    </article>
    {article.related.length ? <section className="wiki-related"><h2>{words.related}</h2><div className="wiki-related-links">{article.related.map(id => { const target = getWikiArticle(id); if (!target) throw new Error(`Broken related Wiki article ${id}`); return <WikiLink key={id} href={wikiPath(id, language)} onNavigate={onNavigate}>{target.title[language]}<ChevronIcon className="wiki-icon" /></WikiLink>; })}</div></section> : null}
  </>;
}

function CategoryIcon({ category }: { category: WikiCategory }) { const Icon = icons[category.icon]; return <Icon className="wiki-category-icon" />; }
export function WikiNavigation({ page, onNavigate }: ContentProps) {
  const words = wikiLabels[page.language];
  return <nav className="wiki-navigation" aria-label={words.categories}><WikiLink href={wikiRoot(page.language)} onNavigate={onNavigate} className="wiki-nav-home" aria-current={page.categoryId ? undefined : 'page'}><GuideIcon className="wiki-icon" />{words.all}</WikiLink>{wikiCategories.map(category => <WikiLink key={category.id} href={wikiCategoryPath(category.id, page.language)} onNavigate={onNavigate} aria-current={page.categoryId === category.id ? 'page' : undefined}><CategoryIcon category={category} /><span>{category.title[page.language]}</span><span className="wiki-nav-count">{wikiArticles.filter(a => a.category === category.id).length}</span></WikiLink>)}</nav>;
}

export function WikiMenu({ page, onNavigate, className = '', menuRef }: ContentProps & { className?: string; menuRef?: Ref<HTMLDetailsElement> }) {
  const words = wikiLabels[page.language];
  const category = wikiCategories.find(item => item.id === page.categoryId);
  return <details className={`wiki-menu ${className}`} ref={menuRef}>
    <summary><GuideIcon className="wiki-icon" /><span><span className="wiki-menu-label">{words.categories}</span><span className="wiki-menu-current">{category?.title[page.language] ?? words.all}</span></span><ChevronIcon className="wiki-icon wiki-menu-chevron" /></summary>
    <WikiNavigation page={page} onNavigate={onNavigate} />
  </details>;
}

export function WikiBreadcrumbs({ page, onNavigate }: ContentProps) {
  const words = wikiLabels[page.language]; const category = wikiCategories.find(c => c.id === page.categoryId); const article = page.articleId ? getWikiArticle(page.articleId) : undefined;
  return <nav aria-label={page.language === 'en' ? 'Breadcrumb' : 'Sayfa yolu'} className="wiki-breadcrumbs"><ol><li><WikiLink href={wikiRoot(page.language)} onNavigate={onNavigate}>{words.home}</WikiLink></li>{category ? <li><WikiLink href={wikiCategoryPath(category.id, page.language)} onNavigate={onNavigate} aria-current={article ? undefined : 'page'}>{category.title[page.language]}</WikiLink></li> : null}{article ? <li aria-current="page">{article.title[page.language]}</li> : null}</ol></nav>;
}

export function WikiArticleList({ articles, language, onNavigate }: { articles: readonly WikiArticle[]; language: WikiLanguage; onNavigate?: WikiNavigate }) {
  return <div className="wiki-article-list">{articles.map(article => <WikiLink href={wikiPath(article.id, language)} key={article.id} onNavigate={onNavigate} aria-label={article.title[language]} className="wiki-article-row">{article.image ? <img src={article.image} width={72} height={72} alt="" loading="lazy" /> : <span className="wiki-row-glyph"><GuideIcon className="wiki-icon" /></span>}<span><span className="wiki-row-title">{article.title[language]}</span><span className="wiki-row-description">{article.description[language]}</span></span><ChevronIcon className="wiki-icon" /></WikiLink>)}</div>;
}

export function WikiPageContent({ page, onNavigate }: ContentProps) {
  const language = page.language; const words = wikiLabels[language]; const article = page.articleId ? getWikiArticle(page.articleId) : undefined; const category = wikiCategories.find(c => c.id === page.categoryId);
  if (article) return <WikiArticleContent article={article} language={language} onNavigate={onNavigate} />;
  if (category) return <><header className="wiki-category-head"><p className="wiki-eyebrow">{words.home}</p><h1 tabIndex={-1}><CategoryIcon category={category} />{category.title[language]}</h1><p className="wiki-lede">{category.description[language]}</p></header><WikiArticleList articles={wikiArticles.filter(a => a.category === category.id)} language={language} onNavigate={onNavigate} /></>;
  return <>
    <header className="wiki-hero"><div className="wiki-hero-orbit" aria-hidden="true"><i /><i /><i /><span /></div><p className="wiki-eyebrow">ASTERA ONLINE / WIKI</p><h1 tabIndex={-1}>{words.title}</h1><p className="wiki-lede">{words.subtitle}</p><WikiLink className="wiki-start" href={wikiPath('basics.quick-start', language)} onNavigate={onNavigate}>{words.entryTitle}<ChevronIcon className="wiki-icon" /></WikiLink><p className="wiki-hero-caption">{wikiArticles.length} {words.articles} · {wikiCategories.length} {words.categoryCount}</p></header>
    <section className="wiki-index"><h2>{words.categories}</h2><div className="wiki-categories">{wikiCategories.map((cat, index) => <WikiLink className="wiki-category-card" href={wikiCategoryPath(cat.id, language)} key={cat.id} onNavigate={onNavigate}><div className="wiki-card-top"><CategoryIcon category={cat} /><span className="wiki-index-number">{String(index + 1).padStart(2, '0')}</span></div><h3>{cat.title[language]}</h3><p>{cat.description[language]}</p><span className="wiki-card-foot">{wikiArticles.filter(a => a.category === cat.id).length} {words.articles}<ChevronIcon className="wiki-icon" /></span></WikiLink>)}</div></section>
  </>;
}

export function WikiPublicLink({ page }: { page: WikiPage }) { return <a className="wiki-public-link" href={page.path} target="_blank" rel="noopener noreferrer">{wikiLabels[page.language].publicPage}<ExternalIcon className="wiki-icon" /></a>; }

export function articleSearchText(article: WikiArticle, language: WikiLanguage): string {
  const text = [article.title[language], article.description[language]];
  for (const section of article.sections[language]) {
    text.push(section.title);
    for (const block of section.blocks) switch (block.kind) {
      case 'text': case 'note': text.push(block.text); break;
      case 'list': text.push(...block.items); break;
      case 'stats': for (const item of block.items) text.push(item.label, item.value); break;
      case 'table': text.push(block.caption, ...block.columns); for (const row of block.rows) text.push(...row); break;
    }
  }
  return text.join(' ').replace(/\[\[[^|]+\|([^\]]+)\]\]/g, '$1');
}
