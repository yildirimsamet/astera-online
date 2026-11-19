// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderReadings } from '../public/ios-probe.js';

/*
  THE IPHONE HOME-SCREEN PROBE (players' report 2026-11-19, iPhone 14 Pro Max; BrowserStack iPhone XR):
  installed to the home screen, the game showed a frosted band over its top bar (gone with Reduce
  Transparency — WebKit 301994) and an empty band under its dock. Nobody here has an iPhone, so a
  friend installs this page twice and sends screenshots: where each height unit ends, where the web
  layer ends, and how far iOS's frost reaches. It must open exactly as the game does.
*/
const web = resolve(import.meta.dirname, '..');
const read = (path: string): string => readFileSync(resolve(web, path), 'utf8');
const gameViewport = /<meta\s+name="viewport"\s+content="([^"]+)"/u.exec(read('index.html'))?.[1];

const PAGES = [
  { file: 'public/ios-probe.html', bar: 'black-translucent' },
  { file: 'public/ios-probe-black.html', bar: 'black' },
] as const;

describe.each(PAGES)('$file', ({ file, bar }) => {
  const html = read(file);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const meta = (name: string) => doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content');

  it('opens with the game’s own viewport line', () => {
    expect(gameViewport).toBeDefined();
    expect(meta('viewport')).toBe(gameViewport);
  });

  it(`installs as a full-screen home-screen app with the ${bar} status bar`, () => {
    expect(meta('apple-mobile-web-app-capable')).toBe('yes');
    expect(meta('apple-mobile-web-app-status-bar-style')).toBe(bar);
  });

  it('opens itself from the home screen, not the game, and stays out of search', () => {
    expect(doc.querySelector('link[rel="manifest"]')).toBeNull();
    expect(meta('robots')).toBe('noindex, nofollow');
  });

  it('runs only its own script file (the static pages allow no inline script)', () => {
    const scripts = [...doc.querySelectorAll('script')];
    expect(scripts.map(s => s.getAttribute('src'))).toEqual(['/ios-probe.js']);
    expect(scripts.every(s => s.textContent.trim() === '')).toBe(true);
  });
});

describe('the probe’s readings', () => {
  it('prints every number the fix depends on', () => {
    document.body.innerHTML = new DOMParser().parseFromString(read('public/ios-probe.html'), 'text/html').body.innerHTML;
    renderReadings();
    const text = document.querySelector('[data-readings]')?.textContent ?? '';
    for (const label of ['screen', 'innerHeight', 'visualViewport', 'clientHeight', 'dvh', 'svh', 'lvh',
      'safe-area top', 'safe-area bottom', 'standalone', 'iOS']) expect(text).toContain(label);
  });
});

/*
  WHAT THE PROBE SHOWED (2026-11-19, iOS 18.7, home screen). With `black-translucent` the web layer reaches
  the bottom of an 844 px screen, but `innerHeight`, `100dvh` and `position: fixed; bottom: 0` all stop at
  797 — 47 px, the status bar, short — so the game, drawn in `--app-h` = innerHeight, left an empty band
  under its dock. With `black` (XR, 896 px screen) the layer starts under an opaque bar and every height
  (848) ends at its bottom. The game installs with the opaque bar.
*/
it('installs the game with the opaque status bar, whose heights match the screen', () => {
  const doc = new DOMParser().parseFromString(read('index.html'), 'text/html');
  expect(doc.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute('content')).toBe('black');
});
