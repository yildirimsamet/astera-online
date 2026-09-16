import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ADSENSE_CLIENT,
  ADSENSE_LOADER_SRC,
  adsenseHeadTag,
  adsensePlugin,
} from '../src/lib/adsense.js';

const webRoot = resolve(import.meta.dirname, '..');

/**
 * ADSENSE, AND THE THREE THINGS THAT HAVE TO HOLD.
 *
 * 1. The built page carries Google's snippet VERBATIM in `<head>`: async,
 *    crossorigin, the loader src Google published. Verification and ad serving
 *    both read the head of the document, so this is the one third-party tag in
 *    this project that is NOT allowed to wait for an idle callback.
 * 2. It is injected at BUILD time only. A dev server and a `vitest` browser must
 *    never fire it — the visual tool drives `vite dev`, and a screenshot with an
 *    ad in it is a screenshot of something else.
 * 3. `/ads.txt` names the same publisher as the tag. AdSense reports "earnings at
 *    risk" against a site it cannot find an authorized-seller record on, and a
 *    record that disagrees with the tag is worse than none.
 */
describe('adsense head tag', () => {
  it('is the loader Google publishes, for this publisher', () => {
    expect(ADSENSE_CLIENT).toMatch(/^ca-pub-\d{16}$/);
    expect(ADSENSE_LOADER_SRC).toBe(
      `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`,
    );
  });

  it('goes into the head, async and crossorigin', () => {
    const tag = adsenseHeadTag();

    expect(tag.tag).toBe('script');
    expect(tag.injectTo).toBe('head');
    // `attrs` is optional on Vite's descriptor; `?.` keeps a missing one a failed
    // assertion rather than a type error.
    expect(tag.attrs?.async).toBe(true);
    expect(tag.attrs?.crossorigin).toBe('anonymous');
    expect(tag.attrs?.src).toBe(ADSENSE_LOADER_SRC);
  });
});

describe('the build plugin', () => {
  /**
   * `apply: 'build'` is the whole of the dev-side opt-out. Without it the loader
   * fires on every `pnpm dev`, on a phone on the LAN, and inside every Playwright
   * frame the visual tool captures.
   */
  it('runs on build only, never on the dev server', () => {
    expect(adsensePlugin().apply).toBe('build');
  });

  it('is wired into the client build', async () => {
    const config = await readFile(resolve(webRoot, 'vite.config.ts'), 'utf8');
    expect(config).toContain('adsensePlugin()');
  });
});

describe('ads.txt', () => {
  it('declares the same publisher the tag loads, as a direct seller', async () => {
    const adsTxt = await readFile(resolve(webRoot, 'public/ads.txt'), 'utf8');
    const sellerId = ADSENSE_CLIENT.replace(/^ca-/, '');

    expect(adsTxt).toContain(`google.com, ${sellerId}, DIRECT, f08c47fec0942fa0`);
  });
});

/**
 * The pasted snippet must never be committed into the page itself. A hardcoded
 * tag fires on every dev server and in every test browser — a third-party request
 * leaving a machine that never asked for one — which is exactly what the plugin's
 * `apply: 'build'` exists to prevent. Read raw, like the viewport tests.
 */
describe('index.html', () => {
  it('carries no hardcoded ad tag', async () => {
    const html = await readFile(resolve(webRoot, 'index.html'), 'utf8');

    expect(html).not.toContain('googlesyndication');
    expect(html).not.toContain('adsbygoogle');
    expect(html).not.toContain('ca-pub-');
  });
});
