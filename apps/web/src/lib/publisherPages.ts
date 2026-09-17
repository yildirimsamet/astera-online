/**
 * THE PUBLISHER SITE, AS ONE TABLE THE TYPE SYSTEM CAN SEE.
 *
 * Everything under `public/` that is not the game is a hand-written HTML file:
 * the about page, the quick-start guide, and the six legal documents Google's
 * publisher policies and Türkiye's KVKK both require. Vite copies `public/`
 * untouched and nginx serves the webroot flat, so each of these is reachable at
 * its own address — and NOTHING IN THE TYPE SYSTEM CONNECTS A STRING IN A
 * COMPONENT TO A FILE ON DISK. A rename produces a menu row that opens a 404 and
 * nothing fails anywhere.
 *
 * So the addresses are stated once, here, and `public-site-readiness` asserts
 * three things against this table: every file exists, every page's `canonical`
 * agrees with the address it is listed under, and `sitemap.xml` lists exactly
 * these and nothing else. A sitemap that advertises a page nginx answers 404 for
 * is a crawl error on the domain being submitted for review, which is precisely
 * the kind of thing an AdSense site review counts against a site.
 *
 * ONE PAGE PER LANGUAGE, WITH THE SLUG IN THAT LANGUAGE. `about.html` is
 * English and `hakkinda.html` is Turkish; the same pairing runs through the
 * legal set. Google's reviewer reads English and the players read Turkish, and
 * a single page cannot serve both without one of them reading a translation
 * notice instead of a policy. `hreflang` on every page ties each pair together.
 *
 * KVKK IS THE ONE EXCEPTION and it is not an oversight: the aydınlatma metni is
 * a Turkish statutory disclosure under Law 6698, addressed to data subjects in
 * Türkiye. The English privacy policy links to it rather than duplicating it,
 * because an English "translation of a Turkish legal notice" is not the notice.
 */

/** The languages the publisher site is written in. Matches the i18n tree. */
export type PublisherLanguage = 'en' | 'tr';

/** Every standalone page, named by what it is rather than by its filename. */
export type PublisherPage =
  | 'about'
  | 'guide'
  | 'privacy'
  | 'cookies'
  | 'terms'
  | 'community'
  | 'contact'
  | 'kvkk';

/**
 * The table. `null` means the page has no edition in that language and the
 * other one is served instead — see the KVKK note above.
 */
const PAGES: Record<PublisherPage, Record<PublisherLanguage, string | null>> = {
  about: { en: '/about.html', tr: '/hakkinda.html' },
  guide: { en: '/quick-start-guide.html', tr: '/hizli-baslangic-rehberi.html' },
  privacy: { en: '/privacy.html', tr: '/gizlilik-politikasi.html' },
  cookies: { en: '/cookies.html', tr: '/cerez-politikasi.html' },
  terms: { en: '/terms.html', tr: '/kullanim-kosullari.html' },
  community: { en: '/community-guidelines.html', tr: '/topluluk-kurallari.html' },
  contact: { en: '/contact.html', tr: '/iletisim.html' },
  kvkk: { en: null, tr: '/kvkk-aydinlatma-metni.html' },
};

/** The origin every canonical and sitemap entry is written against. */
export const PUBLISHER_ORIGIN = 'https://asteraonline.space';

/**
 * Where a page lives for a reader in this language.
 *
 * The language argument is whatever `i18next` resolved, which is a full tag on
 * some browsers (`tr-TR`, `en-GB`), so it is narrowed here rather than at every
 * call site. Anything that is not Turkish gets the English page: the game has
 * two languages and English is the fallback everywhere else in the client.
 */
export function publisherUrl(page: PublisherPage, language: string | undefined): string {
  const lang: PublisherLanguage = language?.toLowerCase().startsWith('tr') ? 'tr' : 'en';
  const entry = PAGES[page];
  // `??` covers the one-language page: the KVKK notice is served to an English
  // reader too, in Turkish, because that is the document that exists.
  const url = entry[lang] ?? entry[lang === 'tr' ? 'en' : 'tr'];
  if (url === null) throw new Error(`publisher page ${page} has no address`);
  return url;
}

/** Every real address on the publisher site, for the sitemap and its test. */
export const publisherPaths = (): string[] =>
  Object.values(PAGES).flatMap((entry) =>
    [entry.en, entry.tr].filter((url): url is string => url !== null),
  );
