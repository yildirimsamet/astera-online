import type { ReactNode, Ref } from 'react';
import { LANGUAGES, LANGUAGE_LABEL, LANGUAGE_SHORT, type Language } from '../../i18n/languages.js';
import { publisherUrl, publisherWikiUrl } from '../../lib/publisherPages.js';
import { LANDING_COPY, LANDING_ACTIONS, LANDING_SEASONS } from './content.js';

export const LANDING_HERO = '/assets/images/landing/orbit-hero-v1.webp';
const CHAPTERS = [
  { id: 'worlds', topic: 'worlds', height: 1024 },
  { id: 'intelligence', topic: 'intel', height: 658 },
  { id: 'fleet', topic: 'fleet', height: 1024 },
  { id: 'clans', topic: 'clan', height: 1024 },
] as const;
const HULLS = ['dart', 'praetorian', 'argosy'] as const;
export const landingWikiTopic = (language: Language, topic: string) => `${language === 'tr' ? '/wiki/tr' : '/wiki'}/${topic}`;

/** Same semantic content in generated HTML and the enhanced browser front door. */
export function PublicLanding({ language, entry, languageSwitch, consentHostRef, privacyControl, footer }: {
  language: Language; entry?: ReactNode; languageSwitch?: ReactNode;
  consentHostRef?: Ref<HTMLDivElement>; privacyControl?: ReactNode; footer?: ReactNode;
}) {
  const c = LANDING_COPY[language];
  const actions = LANDING_ACTIONS[language];
  const season = LANDING_SEASONS[language];
  return <main className="public-landing" data-public-landing lang={language}>
    <a className="landing-skip" href="#start">{c.skip}</a>
    <header className="landing-header landing-container">
      <a href={`/${language}/`} aria-label="Astera Online" className="landing-brand"><img src="/assets/images/logos/logo-lockup.png" width="768" height="433" alt="Astera Online" /></a>
      <nav aria-label={c.explore}><a href="#worlds">{c.explore}</a><a href={publisherWikiUrl(language)}>Wiki <span aria-hidden="true">↗</span></a></nav>
      {languageSwitch ?? <details className="landing-locale-menu"><summary>{LANGUAGE_SHORT[language]} <span aria-hidden="true">⌄</span></summary><nav aria-label="Language">{LANGUAGES.map(lang => <a key={lang} href={`/${lang}/`} hrefLang={lang} lang={lang} aria-current={lang === language ? 'page' : undefined}>{LANGUAGE_LABEL[lang]}</a>)}</nav></details>}
    </header>
    <section className="landing-hero" aria-labelledby="landing-title">
      <picture className="landing-hero-art"><source media="(max-width: 640px)" srcSet="/assets/images/landing/orbit-hero-mobile-v1.webp" /><img src={LANDING_HERO} width="1920" height="1080" alt="" fetchPriority="high" /></picture>
      <div className="landing-container landing-hero-content">
        <p className="landing-kicker"><span aria-hidden="true" />{c.eyebrow}</p>
        <h1 id="landing-title"><span>{c.headline[0]}</span><em>{c.headline[1]}</em></h1>
        <p className="landing-intro">{c.intro}</p>
        <div id="start" className="landing-entry">
          {entry ?? <><a className="landing-button" href="#how-to-play">{actions.play} <span aria-hidden="true">↗</span></a><p>{actions.account}</p></>}
          <noscript><p className="landing-noscript">{actions.javascript}</p></noscript>
        </div>
        <div ref={consentHostRef} className="landing-consent-host" />
      </div>
      <div className="landing-hero-bottom landing-container"><a href="#worlds">{c.scroll} <span aria-hidden="true">↓</span></a><p>{c.art}</p></div>
    </section>
    <div className="landing-container landing-chapters">
      {CHAPTERS.map((chapter, index) => {
        const copy = c.chapters[index];
        if (!copy) return null;
        return <section id={chapter.id} className={`landing-chapter landing-chapter-${chapter.id}`} key={chapter.id} aria-labelledby={`${chapter.id}-title`}>
          <div className="landing-chapter-copy"><p className="landing-kicker">{copy.label}</p><h2 id={`${chapter.id}-title`}>{copy.title}</h2>{copy.paragraphs.map(p => <p key={p}>{p}</p>)}<a className="landing-text-link" href={landingWikiTopic(language, chapter.topic)}>{copy.link} <span aria-hidden="true">↗</span></a></div>
          <figure className="landing-chapter-art"><img src={`/assets/images/landing/chapter-${chapter.id}-v1-768.webp`} srcSet={`/assets/images/landing/chapter-${chapter.id}-v1-768.webp 768w, /assets/images/landing/chapter-${chapter.id}-v1-1536.webp 1536w`} sizes="(min-width: 1100px) 640px, (min-width: 701px) 50vw, calc(100vw - 40px)" width="1536" height={chapter.height} loading="lazy" decoding="async" alt="" /><figcaption>{c.art}</figcaption></figure>
        </section>;
      })}
      <section className="landing-shipyard" aria-labelledby="shipyard-title"><p className="landing-kicker">Dart / Praetorian / Argosy</p><h2 id="shipyard-title">{c.shipsTitle}</h2><p>{c.shipsIntro}</p><div className="landing-hulls">{HULLS.map((hull, index) => <article key={hull}><a href={landingWikiTopic(language, `fleet/${hull}`)}><img src={`/assets/images/ships/${hull}.webp`} width="512" height="512" loading="lazy" decoding="async" alt={hull.toUpperCase()} /><h3>{hull.toUpperCase()} <span aria-hidden="true">↗</span></h3></a><p>{c.ships[index]}</p></article>)}</div></section>
      <section id="how-to-play" className="landing-start" aria-labelledby="start-title"><div><p className="landing-kicker">Astera Online</p><h2 id="start-title">{c.startTitle}</h2><a href={publisherUrl('guide', language)} className="landing-text-link">{c.guide} <span aria-hidden="true">↗</span></a></div><ol>{c.steps.map((step, index) => <li key={step.title}><span aria-hidden="true">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></li>)}</ol></section>
      <section className="landing-reading" aria-labelledby="reading-title"><div><h2 id="reading-title">{c.readingTitle}</h2><p>{c.readingIntro}</p></div><nav aria-label="Wiki">{['worlds', 'intel', 'fleet'].map((topic, index) => <a key={topic} href={landingWikiTopic(language, topic)}><span>0{index + 1}</span>{c.reading[index]}<span aria-hidden="true">↗</span></a>)}</nav></section>
      <section className="landing-faq" aria-labelledby="faq-title"><h2 id="faq-title">{c.faqTitle}</h2><div>{c.faq.map(faq => <details key={faq.title}><summary>{faq.title}<span aria-hidden="true">+</span></summary><p>{faq.body}</p></details>)}<details><summary>{season.title}<span aria-hidden="true">+</span></summary><p>{season.body}<br /><a className="landing-text-link" href={landingWikiTopic(language, 'season')}>{season.link} <span aria-hidden="true">↗</span></a></p></details></div></section>
      <section className="landing-closing"><p className="landing-kicker">Astera Online</p><h2>{c.closing}</h2><p>{c.closingText}</p><a href="#start" className="landing-button">{c.scroll} <span aria-hidden="true">↑</span></a></section>
    </div>
    <footer className="landing-footer landing-container"><div><a href={`/${language}/`} aria-label="Astera Online"><img src="/assets/images/logos/logo-lockup.png" width="768" height="433" alt="Astera Online" loading="lazy" /></a><p>{c.copyright}</p></div>{footer ?? <nav aria-label={c.guide}>{(['about', 'guide', 'privacy', 'cookies', 'terms', 'community', 'contact'] as const).map((page, index) => <a key={page} href={publisherUrl(page, language)}>{actions.links[index]}</a>)}<a href={publisherWikiUrl(language)}>Wiki</a></nav>}{privacyControl}<nav className="landing-languages" aria-label="Language">{LANGUAGES.map(lang => <a key={lang} lang={lang} hrefLang={lang} href={`/${lang}/`} aria-current={lang === language ? 'page' : undefined}>{LANGUAGE_LABEL[lang]}</a>)}</nav></footer>
  </main>;
}
