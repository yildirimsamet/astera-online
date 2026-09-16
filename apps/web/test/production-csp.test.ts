import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const nginxConfig = resolve(import.meta.dirname, '../../../deploy/nginx/astera.conf');

describe('production content security policy', () => {
  it('allows the blob textures and narrow WebAssembly execution used by Three.js loaders', async () => {
    const config = await readFile(nginxConfig, 'utf8');
    const policies = config
      .split('\n')
      .filter((line) => line.includes('add_header Content-Security-Policy'));

    // The apex and SPA fallback carry separate headers; neither may blank the scene.
    expect(policies).toHaveLength(2);
    for (const policy of policies) {
      expect(policy).toMatch(/script-src[^;]*'wasm-unsafe-eval'/);
      expect(policy).toMatch(/connect-src[^;]*\bblob:/);
    }
  });

  /**
   * ADSENSE IS A LOADER THAT FETCHES MORE LOADERS. The tag in `<head>` comes from
   * googlesyndication, the creatives arrive in doubleclick frames, and the ad
   * traffic quality checks run against their own origin — a policy that admits
   * only the first of those blanks the ads and reports nothing about why.
   *
   * What is deliberately NOT granted: `'unsafe-inline'` on script-src. Stored
   * announcements are player-authored, and that directive is the last wall
   * standing between a sanitizer regression and executable markup. If Google ever
   * needs it, the ads lose rather than the wall.
   */
  it('admits the origins Google serves ads from, without reopening inline script', async () => {
    const config = await readFile(nginxConfig, 'utf8');
    const policies = config
      .split('\n')
      .filter((line) => line.includes('add_header Content-Security-Policy'));

    expect(policies).toHaveLength(2);
    for (const policy of policies) {
      expect(policy).toMatch(/script-src[^;]*https:\/\/pagead2\.googlesyndication\.com/);
      expect(policy).toMatch(/frame-src[^;]*https:\/\/\*\.doubleclick\.net/);
      expect(policy).toMatch(/connect-src[^;]*https:\/\/\*\.googlesyndication\.com/);
      expect(policy).toMatch(/script-src[^;]*https:\/\/\*\.adtrafficquality\.google/);
      expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
      expect(policy).not.toMatch(/script-src[^;]*'unsafe-eval'/);
    }
  });
});
