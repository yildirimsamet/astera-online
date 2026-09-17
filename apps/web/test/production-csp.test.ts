import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const nginxConfig = resolve(import.meta.dirname, '../../../deploy/nginx/astera.conf');

const policies = async (): Promise<{ origin: string; document: string }> => {
  const config = await readFile(nginxConfig, 'utf8');
  const headers = config
    .split('\n')
    .filter((line) => line.includes('add_header Content-Security-Policy'));

  // Exactly two, and they are not interchangeable — see the describe below.
  expect(headers).toHaveLength(2);
  const [origin, document] = headers;
  return { origin: origin ?? '', document: document ?? '' };
};

const directive = (policy: string, name: string): string =>
  new RegExp(`${name} (?<value>[^;"]*)`, 'u').exec(policy)?.groups?.value ?? '';

/**
 * TWO POLICIES ON ONE ORIGIN, AND THE SPLIT IS THE DESIGN.
 *
 * The apex serves two completely different kinds of document and they have
 * opposite needs:
 *
 *   · THE PUBLISHER PAGES — about, the quick-start guide, and the six legal
 *     documents — are hand-written HTML that loads nothing but its own
 *     stylesheet. They are governed by the server-level header, which grants no
 *     third-party origin at all. A policy page that provably fetches nothing
 *     external is a better answer to an AdSense site review than one that merely
 *     does not use what it is allowed to.
 *   · THE GAME DOCUMENT — `index.html`, and only it — carries the AdSense tag,
 *     three.js and the announcement renderer. Google does not support
 *     allow-listing AdSense by domain, so it uses their documented per-request
 *     nonce plus `'strict-dynamic'`.
 */
describe('the publisher pages', () => {
  it('are served with no third-party origin whatsoever', async () => {
    const { origin } = await policies();

    expect(directive(origin, 'script-src')).toBe("'self'");
    expect(directive(origin, 'connect-src')).toBe("'self'");
    expect(directive(origin, 'frame-src')).toBe("'none'");
    expect(origin).not.toContain('googlesyndication');
    expect(origin).not.toContain('doubleclick');
    expect(origin).not.toContain('youtube');
  });

  /**
   * An inline block on a publisher page is script that silently does not run —
   * which is how the quick-start guide's "back to the game" handler spent its
   * deployed life doing a plain navigation instead. It is `guide-back.js` now.
   */
  it('never reopen inline or evaluated script', async () => {
    const { origin } = await policies();

    expect(directive(origin, 'script-src')).not.toContain("'unsafe-inline'");
    expect(directive(origin, 'script-src')).not.toContain("'unsafe-eval'");
    // The quick-start guide carries its own inline stylesheet; styles are not
    // executable and this is the one grant that stays.
    expect(directive(origin, 'style-src')).toContain("'unsafe-inline'");
  });
});

describe('the game document', () => {
  it('allows the blob textures and narrow WebAssembly execution Three.js needs', async () => {
    const { document } = await policies();

    expect(directive(document, 'script-src')).toContain("'wasm-unsafe-eval'");
    expect(directive(document, 'script-src')).not.toContain("'unsafe-eval'");
    expect(directive(document, 'connect-src')).toContain('blob:');
    expect(directive(document, 'img-src')).toContain('blob:');
    expect(directive(document, 'worker-src')).toContain('blob:');
  });

  /**
   * THE NONCE IS WHAT MAKES THE FALLBACKS SAFE.
   *
   * Google's published example carries `https:` and `'unsafe-inline'` after the
   * nonce, and a browser that understands `'strict-dynamic'` ignores both — that
   * is the whole point of the pattern. But if the nonce were ever dropped while
   * those two stayed, the policy would silently degrade into "any inline script,
   * from anywhere", which is no policy at all. They travel together or not at
   * all, and this is the assertion that says so.
   */
  it('carries the fallbacks only alongside a real per-request nonce', async () => {
    const { document } = await policies();
    const scriptSrc = directive(document, 'script-src');

    expect(scriptSrc).toContain("'nonce-$request_id'");
    expect(scriptSrc).toContain("'strict-dynamic'");
    if (scriptSrc.includes("'unsafe-inline'") || scriptSrc.includes(" https:")) {
      expect(scriptSrc).toMatch(/'nonce-\$request_id'[^;]*'strict-dynamic'/u);
    }
  });

  /**
   * ADSENSE IS A LOADER THAT FETCHES MORE LOADERS. `'strict-dynamic'` answers the
   * script half; the creatives still arrive in doubleclick frames and the ad
   * traffic quality checks run against their own origin, and neither of those is
   * a script grant. A policy that admits only the tag blanks the ads and reports
   * nothing about why.
   */
  it('admits the origins the ads and the announcements actually fetch from', async () => {
    const { document } = await policies();

    expect(directive(document, 'frame-src')).toContain('https://*.doubleclick.net');
    expect(directive(document, 'frame-src')).toContain('https://www.youtube-nocookie.com');
    expect(directive(document, 'connect-src')).toContain('https://*.googlesyndication.com');
    expect(directive(document, 'connect-src')).toContain('https://*.adtrafficquality.google');
    expect(directive(document, 'connect-src')).toContain('https://*.google-analytics.com');
  });

  it('keeps the structural directives that no ad needs relaxed', async () => {
    const { document } = await policies();

    expect(document).toContain("object-src 'none'");
    expect(document).toContain("base-uri 'self'");
    expect(document).toContain("form-action 'self'");
    expect(document).toContain("frame-ancestors 'self'");
  });
});
