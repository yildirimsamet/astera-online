import type { ReactNode } from 'react';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import { LandingScreen } from '../src/screens/LandingScreen.js';
import { PUBLISHER_ORIGIN, publisherPaths, publisherUrl } from '../src/lib/publisherPages.js';

vi.mock('../src/landing/LandingScene.jsx', () => ({
  LandingScene: () => <div data-testid="landing-scene" />,
}));

/**
 * THE PUBLISHER SITE, WHICH IS WHAT AN ADSENSE REVIEW ACTUALLY READS.
 *
 * The game is one JavaScript application behind a session. A crawler — and the
 * H5 Games Ads / AdSense site review behind it — sees none of that. What it sees
 * is `public/`: ten hand-written HTML documents and the sitemap that lists them.
 * Every assertion in this file is a thing that review checks and a thing no other
 * test in the project would notice breaking.
 *
 * LANGUAGE-PAIRED, AND THE PAIRING IS LOAD-BEARING. `privacy.html` is English and
 * `gizlilik-politikasi.html` is Turkish, and the same split runs through the legal
 * set. The reviewer reads English; the players read Turkish. A single page cannot
 * serve both without one of them being handed a document they cannot act on, so
 * `src/lib/publisherPages.ts` is the one table and this file holds the files, the
 * canonicals, the sitemap and the in-game links against it.
 */
const publicFile = (path: string): Promise<string> =>
  readFile(resolve(process.cwd(), 'public', path.replace(/^\//, '')), 'utf8');

const parse = async (path: string): Promise<Document> =>
  new DOMParser().parseFromString(await publicFile(path), 'text/html');

const socialImage = 'https://asteraonline.space/assets/images/general/og-image.png';

const showLanding = (): void => {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );

  render(
    <Wrapper>
      <LandingScreen
        onAuthenticate={vi.fn(() => Promise.resolve())}
        onBegin={vi.fn(() => Promise.resolve())}
        loadAsset={() => Promise.resolve()}
        knownCommander={() => false}
      />
    </Wrapper>,
  );
};

/** Every page, with the language it is written in and the heading it opens on. */
const PAGES = [
  { path: '/about.html', language: 'en', heading: /about astera online/i, pair: '/hakkinda.html' },
  { path: '/hakkinda.html', language: 'tr', heading: /astera online hakkında/i, pair: '/about.html' },
  { path: '/quick-start-guide.html', language: 'en', heading: /how to play astera online/i, pair: '/hizli-baslangic-rehberi.html' },
  { path: '/hizli-baslangic-rehberi.html', language: 'tr', heading: /hızlı başlangıç/i, pair: '/quick-start-guide.html' },
  { path: '/privacy.html', language: 'en', heading: /privacy policy/i, pair: '/gizlilik-politikasi.html' },
  { path: '/gizlilik-politikasi.html', language: 'tr', heading: /gizlilik politikası/i, pair: '/privacy.html' },
  { path: '/cookies.html', language: 'en', heading: /cookie policy/i, pair: '/cerez-politikasi.html' },
  { path: '/cerez-politikasi.html', language: 'tr', heading: /çerez politikası/i, pair: '/cookies.html' },
  { path: '/terms.html', language: 'en', heading: /terms of use/i, pair: '/kullanim-kosullari.html' },
  { path: '/kullanim-kosullari.html', language: 'tr', heading: /kullanım koşulları/i, pair: '/terms.html' },
  { path: '/community-guidelines.html', language: 'en', heading: /community guidelines/i, pair: '/topluluk-kurallari.html' },
  { path: '/topluluk-kurallari.html', language: 'tr', heading: /topluluk kuralları/i, pair: '/community-guidelines.html' },
  { path: '/contact.html', language: 'en', heading: /contact/i, pair: '/iletisim.html' },
  { path: '/iletisim.html', language: 'tr', heading: /[iİ]let[iİ]şim/u, pair: '/contact.html' },
  { path: '/kvkk-aydinlatma-metni.html', language: 'tr', heading: /aydınlatma/i, pair: null },
] as const;

describe('the publisher page table', () => {
  it('names every page that exists and no page that does not', () => {
    expect([...publisherPaths()].sort()).toEqual([...PAGES.map((page) => page.path)].sort());
  });

  it('resolves each language to its own edition', () => {
    expect(publisherUrl('privacy', 'tr')).toBe('/gizlilik-politikasi.html');
    expect(publisherUrl('privacy', 'en-GB')).toBe('/privacy.html');
    expect(publisherUrl('terms', 'tr-TR')).toBe('/kullanim-kosullari.html');
    expect(publisherUrl('terms', undefined)).toBe('/terms.html');
  });

  /**
   * KVKK is a Turkish statutory notice under Law 6698 and has no English
   * edition. An English reader still has to be able to reach it — the English
   * privacy policy links to it — so the table falls back rather than throwing.
   */
  it('serves the one Turkish-only document to an English reader too', () => {
    expect(publisherUrl('kvkk', 'en')).toBe('/kvkk-aydinlatma-metni.html');
  });
});

describe('every page as a document', () => {
  for (const page of PAGES) {
    it(`${page.path} is a self-describing page in ${page.language}`, async () => {
      const source = await publicFile(page.path);
      const document = new DOMParser().parseFromString(source, 'text/html');

      expect(document.documentElement.lang).toBe(page.language);
      expect(document.querySelector('h1')?.textContent).toMatch(page.heading);
      expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBeTruthy();
      expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href'))
        .toBe(`${PUBLISHER_ORIGIN}${page.path}`);
      // A way back into the game from every page, for a reader and a crawler.
      expect(document.querySelector('a[href="/"]')).toBeTruthy();
      expect(source).not.toMatch(/TODO|PLACEHOLDER|lorem ipsum/i);
    });

    /**
     * THE FOOTER IS THE NAVIGATION. Nothing else on these documents links the
     * policy set together, and "a privacy policy the reviewer could not find"
     * fails a site review exactly as hard as not having one.
     */
    it(`${page.path} carries the whole policy set in its footer`, async () => {
      const document = await parse(page.path);
      const footer = document.querySelector('footer');
      const hrefs = [...(footer?.querySelectorAll('a') ?? [])].map((a) => a.getAttribute('href'));
      const language = page.language === 'tr' ? 'tr' : 'en';

      for (const target of ['privacy', 'cookies', 'terms', 'community', 'contact'] as const) {
        expect(hrefs).toContain(publisherUrl(target, language));
      }
      expect(hrefs).toContain('/');
      expect(footer?.textContent).toContain('samety3503@gmail.com');
    });

    if (page.pair !== null) {
      it(`${page.path} points search engines at its other language`, async () => {
        const document = await parse(page.path);
        const alternates = [...document.querySelectorAll('link[rel="alternate"]')]
          .map((node) => `${node.getAttribute('hreflang') ?? ''} ${node.getAttribute('href') ?? ''}`);
        const self = `${PUBLISHER_ORIGIN}${page.path}`;
        const other = `${PUBLISHER_ORIGIN}${page.pair}`;

        expect(alternates).toContain(`${page.language} ${self}`);
        expect(alternates).toContain(`${page.language === 'tr' ? 'en' : 'tr'} ${other}`);
      });
    }
  }
});

describe('the content pages carry real content', () => {
  for (const path of ['/about.html', '/hakkinda.html', '/quick-start-guide.html', '/hizli-baslangic-rehberi.html']) {
    it(`${path} says enough to be worth indexing`, async () => {
      const document = await parse(path);
      const words = document.body.textContent.trim().split(/\s+/u);

      expect(words.length).toBeGreaterThan(180);
    });
  }
});

describe('crawl instructions', () => {
  it('publishes a robots file that points crawlers at the sitemap', async () => {
    const robots = await publicFile('robots.txt');

    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).toMatch(/^Disallow: \/api\/$/m);
    expect(robots).toMatch(/^Sitemap: https:\/\/asteraonline\.space\/sitemap\.xml$/m);
  });

  /**
   * A SITEMAP MAY NOT ADVERTISE A 404, and after the move to `try_files … =404`
   * it can: nginx no longer answers an unknown path with the application shell,
   * so a stale entry here becomes a crawl error on the very domain being
   * submitted for review.
   */
  it('lists the home page and exactly the pages that exist', async () => {
    const source = await publicFile('sitemap.xml');
    const sitemap = new DOMParser().parseFromString(source, 'application/xml');
    const urls = [...sitemap.querySelectorAll('loc')].map((node) => node.textContent);

    expect(sitemap.querySelector('parsererror')).toBeNull();
    expect(urls[0]).toBe(`${PUBLISHER_ORIGIN}/`);
    expect([...urls.slice(1)].sort()).toEqual(
      publisherPaths().map((path) => `${PUBLISHER_ORIGIN}${path}`).sort(),
    );
  });

  it('ships every file the sitemap promises', async () => {
    for (const path of publisherPaths()) {
      await expect(publicFile(path)).resolves.toContain('<html');
    }
  });
});

describe('the legal set says what it has to say', () => {
  it('identifies the real data controller in both languages', async () => {
    for (const path of ['/privacy.html', '/gizlilik-politikasi.html', '/kvkk-aydinlatma-metni.html']) {
      const document = await publicFile(path);

      expect(document).toContain('Samet Yıldırım');
      expect(document).toContain('samety3503@gmail.com');
      expect(document).toMatch(/hesap.*sil|delete.*account|account deletion/is);
    }
  });

  /**
   * AdSense's own privacy-policy requirements: say that third-party vendors
   * including Google use cookies, that they serve on the basis of prior visits,
   * and give the two links a visitor can act on.
   */
  it.each(['/privacy.html', '/gizlilik-politikasi.html'])(
    '%s makes the Google advertising disclosures',
    async (path) => {
      const privacy = await publicFile(path);

      expect(privacy).toMatch(/Google.*çerez|Google.*cookie/is);
      expect(privacy).toMatch(/önceki ziyaret|prior visits/i);
      expect(privacy).toContain('https://myadcenter.google.com/');
      expect(privacy).toContain('https://policies.google.com/technologies/ads');
    },
  );

  it('keeps the KVKK notice a separate document naming Article 11', async () => {
    const kvkk = await publicFile('/kvkk-aydinlatma-metni.html');

    expect(kvkk).toMatch(/Kanun.*11\. madde/is);
    // Both privacy policies have to lead a reader to it rather than restate it.
    expect(await publicFile('/privacy.html')).toContain('/kvkk-aydinlatma-metni.html');
    expect(await publicFile('/gizlilik-politikasi.html')).toContain('/kvkk-aydinlatma-metni.html');
  });

  it.each(['/cookies.html', '/cerez-politikasi.html'])(
    '%s names the storage this game really writes',
    async (path) => {
      const cookies = await publicFile(path);

      expect(cookies).toContain('bs_refresh');
      expect(cookies).toContain('astera.language');
      expect(cookies).toContain('_ga');
      expect(cookies).toMatch(/30 gün|30 days/);
    },
  );

  /**
   * The consent architecture has to be DESCRIBED, not only implemented: a
   * reviewer reads the policy, and a policy that does not mention denied
   * defaults cannot be checked against the page that has them.
   */
  it.each(['/cookies.html', '/cerez-politikasi.html', '/privacy.html', '/gizlilik-politikasi.html'])(
    '%s states that nothing non-essential is stored before a choice',
    async (path) => {
      const page = await publicFile(path);

      expect(page).toMatch(/ad_storage/);
      expect(page).toMatch(/analytics_storage/);
      expect(page).toMatch(/denied|reddedildi/i);
      expect(page).toMatch(/Gizlilik ve çerez seçenekleri|Privacy &amp; cookie settings/);
    },
  );

  it('gives a working contact route and states the season reset', async () => {
    expect(await publicFile('/contact.html')).toContain('mailto:samety3503@gmail.com');
    expect(await publicFile('/iletisim.html')).toContain('mailto:samety3503@gmail.com');
    expect(await publicFile('/terms.html')).toMatch(/season.*reset/is);
    expect(await publicFile('/kullanim-kosullari.html')).toMatch(/sezon.*sıfır/is);
    expect(await publicFile('/community-guidelines.html')).toContain('samety3503@gmail.com');
    expect(await publicFile('/topluluk-kurallari.html')).toContain('samety3503@gmail.com');
  });

  /**
   * Google's rewarded-ad policy in the terms, before a rewarded placement ever
   * ships: the reward is granted only on a completed view, has no value outside
   * the game, and is not saleable. Written now so the terms do not have to be
   * amended on the day the first placement goes live.
   */
  it.each(['/terms.html', '/kullanim-kosullari.html'])('%s states the rewarded-ad rules', async (path) => {
    const terms = await publicFile(path);

    expect(terms).toMatch(/reward|ödül/i);
    expect(terms).toMatch(/completion|tamamlan/i);
    expect(terms).toMatch(/no value outside|oyun dışında|değer taşımaz/i);
  });
});

describe('link previews', () => {
  const socialPages = [
    { title: 'index.html', source: () => readFile(resolve(process.cwd(), 'index.html'), 'utf8'), url: `${PUBLISHER_ORIGIN}/` },
    ...PAGES.map((page) => ({
      title: page.path,
      source: () => publicFile(page.path),
      url: `${PUBLISHER_ORIGIN}${page.path}`,
    })),
  ];

  for (const page of socialPages) {
    it(`${page.title} has complete Open Graph and large-card metadata`, async () => {
      const document = new DOMParser().parseFromString(await page.source(), 'text/html');
      const property = (name: string): string | null =>
        document.querySelector(`meta[property="${name}"]`)?.getAttribute('content') ?? null;
      const named = (name: string): string | null =>
        document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null;

      expect(property('og:title')).toBeTruthy();
      expect(property('og:description')).toBeTruthy();
      expect(property('og:image')).toBe(socialImage);
      expect(property('og:image:type')).toBe('image/png');
      expect(property('og:image:width')).toBe('1733');
      expect(property('og:image:height')).toBe('907');
      expect(property('og:image:alt')).toBeTruthy();
      expect(property('og:url')).toBe(page.url);
      expect(property('og:type')).toBe('website');
      expect(named('twitter:card')).toBe('summary_large_image');
      expect(named('twitter:title')).toBe(property('og:title'));
      expect(named('twitter:description')).toBe(property('og:description'));
      expect(named('twitter:image')).toBe(socialImage);
      expect(named('twitter:image:alt')).toBe(property('og:image:alt'));
    });
  }

  it('ships the social image at the absolute URL used by every page', async () => {
    const bytes = await readFile(resolve(process.cwd(), 'public/assets/images/general/og-image.png'));

    expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(bytes.byteLength).toBeGreaterThan(100_000);
  });
});

/**
 * NO INLINE SCRIPT ON A PAGE SERVED WITH THIS CSP. The production policy grants
 * `script-src 'self'` and never `'unsafe-inline'`, so an inline block is not a
 * style question: it is code that does not run, on a document a review reads.
 */
describe('the publisher pages under the production CSP', () => {
  it.each(PAGES.map((page) => page.path))('%s carries no inline script', async (path) => {
    const source = await publicFile(path);

    expect(source).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/);
  });
});

describe('public navigation from the front door', () => {
  it('links English visitors to English publisher content', async () => {
    await i18n.changeLanguage('en');
    showLanding();

    expect(screen.getByRole('link', { name: /about astera/i })).toHaveAttribute('href', '/about.html');
    expect(screen.getByRole('link', { name: /how to play/i })).toHaveAttribute('href', '/quick-start-guide.html');
    expect(screen.getByRole('link', { name: /privacy/i })).toHaveAttribute('href', '/privacy.html');
    expect(screen.getByRole('link', { name: /terms/i })).toHaveAttribute('href', '/terms.html');
    expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute('href', '/contact.html');
  });

  it('links Turkish visitors to Turkish publisher content', async () => {
    await i18n.changeLanguage('tr');
    showLanding();

    expect(screen.getByRole('link', { name: /astera hakkında/i })).toHaveAttribute('href', '/hakkinda.html');
    expect(screen.getByRole('link', { name: /nasıl oynanır/i })).toHaveAttribute('href', '/hizli-baslangic-rehberi.html');
    expect(screen.getByRole('link', { name: /gizlilik/i })).toHaveAttribute('href', '/gizlilik-politikasi.html');
    expect(screen.getByRole('link', { name: /koşullar/i })).toHaveAttribute('href', '/kullanim-kosullari.html');
    expect(screen.getByRole('link', { name: /[iİ]let[iİ]ş[iİ]m/u })).toHaveAttribute('href', '/iletisim.html');
  });
});

describe('production route fallthrough', () => {
  it('returns a real 404 for unknown paths instead of the application shell', async () => {
    const nginx = await readFile(
      resolve(import.meta.dirname, '../../../deploy/nginx/astera.conf'),
      'utf8',
    );
    const locations = [...nginx.matchAll(/location \/ \{(?<body>[\s\S]*?)\n\s*\}/g)];
    const location = locations.map((match) => match.groups?.body).find((body) => body?.includes('try_files'));

    expect(location).toMatch(/try_files \$uri \$uri\/ =404;/);
    expect(location).not.toMatch(/\/index\.html/);
  });
});
