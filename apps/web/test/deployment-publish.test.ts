import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const publishScript = resolve(import.meta.dirname, '../../../deploy/publish-web.sh');
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fixture(): Promise<{ stage: string; live: string }> {
  const root = await mkdtemp(join(tmpdir(), 'astera-publish-'));
  temporaryDirectories.push(root);
  const stage = join(root, 'stage');
  const live = join(root, 'live');
  await mkdir(join(stage, 'assets'), { recursive: true });
  await mkdir(join(live, 'assets'), { recursive: true });
  await writeFile(join(stage, 'index.html'), '<script src="/assets/index-new.js"></script>');
  await writeFile(join(stage, 'assets/index-new.js'), 'new build');
  await writeFile(join(live, 'index.html'), '<script src="/assets/index-old.js"></script>');
  await writeFile(join(live, 'assets/index-old.js'), 'old build');
  await writeFile(join(live, 'assets/ClanScreen-old.js'), 'lazy old build');
  await writeFile(join(live, 'obsolete.html'), 'retired public page');
  await writeFile(join(live, 'index.html.gz'), 'stale compressed homepage');
  return { stage, live };
}

describe('web deployment keeps lazy chunks requested by open tabs', () => {
  it('does not mark a missing asset as immutable for a year', async () => {
    const nginx = await readFile(resolve(import.meta.dirname, '../../../deploy/nginx/astera.conf'), 'utf8');
    const assetLocation = /location \/assets\/ \{(?<body>[\s\S]*?)\n\s*\}/u.exec(nginx)?.groups?.body;

    expect(assetLocation).toBeTruthy();
    expect(assetLocation).toMatch(/add_header Cache-Control "public, max-age=31536000, immutable";/u);
    expect(assetLocation).not.toMatch(/add_header Cache-Control "public, max-age=31536000, immutable" always;/u);
  });

  it('publishes a new index after its assets while retaining old chunks and discarding stale compressed HTML', async () => {
    const { stage, live } = await fixture();
    const result = spawnSync('bash', [publishScript, stage, live], { encoding: 'utf8' });

    expect(result.status, result.stderr).toBe(0);
    expect(await readFile(join(live, 'index.html'), 'utf8')).toContain('index-new.js');
    expect(await readFile(join(live, 'assets/index-new.js'), 'utf8')).toBe('new build');
    expect(await readFile(join(live, 'assets/index-old.js'), 'utf8')).toBe('old build');
    expect(await readFile(join(live, 'assets/ClanScreen-old.js'), 'utf8')).toBe('lazy old build');
    await expect(readFile(join(live, 'obsolete.html'))).rejects.toThrow();
    await expect(readFile(join(live, 'index.html.gz'))).rejects.toThrow();
  });

  it('does not replace the live index when the staged build has no index', async () => {
    const { stage, live } = await fixture();
    await rm(join(stage, 'index.html'));
    const result = spawnSync('bash', [publishScript, stage, live], { encoding: 'utf8' });

    expect(result.status).not.toBe(0);
    expect(await readFile(join(live, 'index.html'), 'utf8')).toContain('index-old.js');
  });
});

/**
 * THE CSP NONCE, AND THE FOUR FILES THAT HAVE TO AGREE ABOUT IT.
 *
 * Google does not support allow-listing AdSense by domain — its loader fetches
 * more loaders from shards it rotates — so the game document uses their
 * documented `'nonce-…' 'strict-dynamic'` policy instead. That makes `'self'`
 * IGNORED, so every script tag in the page needs the nonce, which means:
 *
 *   · `vite.config.ts` stamps a placeholder on every tag it emits.
 *   · `astera.conf` rewrites that placeholder with `$request_id` per request,
 *     and puts the same value in the header.
 *   · `deploy.sh` never pre-compresses index.html, because `sub_filter` cannot
 *     rewrite a gzipped body.
 *   · `publish-web.sh` deletes any stale `index.html.gz` left by an older deploy.
 *
 * A page served with the placeholder intact has no valid nonce and every script
 * on it is refused: a blank game, with nothing failing on the server. These
 * assertions are the only thing that notices one of the four drifting.
 */
describe('the per-request CSP nonce', () => {
  const read = (path: string): Promise<string> =>
    readFile(resolve(import.meta.dirname, '../../..', path), 'utf8');

  const indexLocation = async (): Promise<string> => {
    const nginx = await read('deploy/nginx/astera.conf');
    const body = /location = \/index\.html \{(?<body>[\s\S]*?)\n\s*\}/u.exec(nginx)?.groups?.body;
    expect(body).toBeTruthy();
    return body ?? '';
  };

  it('stamps the same literal the server rewrites', async () => {
    const vite = await read('apps/web/vite.config.ts');
    const location = await indexLocation();

    expect(vite).toContain("html: { cspNonce: '__CSP_NONCE__' }");
    expect(location).toContain("sub_filter '__CSP_NONCE__' $request_id;");
    expect(location).toContain('sub_filter_once off;');
    expect(location).toContain('sub_filter_types text/html;');
  });

  it('serves the game document under nonce plus strict-dynamic', async () => {
    const location = await indexLocation();
    const policy = /add_header Content-Security-Policy "(?<value>[^"]*)"/u.exec(location)?.groups?.value;
    const scriptSrc = /script-src (?<value>[^;]*)/u.exec(policy ?? '')?.groups?.value;

    expect(scriptSrc).toContain("'nonce-$request_id'");
    expect(scriptSrc).toContain("'strict-dynamic'");
    // The Draco decoder compiles WebAssembly; `'strict-dynamic'` does not cover it.
    expect(scriptSrc).toContain("'wasm-unsafe-eval'");
    // Still no framing, no plugins, no base tag takeover.
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'self'");
  });

  /**
   * THREE LOCKS ON ONE DOOR, because opening it serves an unrewritten page.
   */
  it('never lets a pre-compressed index reach the substitution filter', async () => {
    const location = await indexLocation();
    const deploy = await read('deploy/deploy.sh');
    const publish = await read('deploy/publish-web.sh');

    expect(location).toContain('gzip_static off;');
    expect(deploy).toContain("! -name 'index.html'");
    expect(publish).toContain('rm -f "$webroot/index.html.gz"');
  });

  it('refuses to deploy onto an nginx that cannot substitute', async () => {
    const deploy = await read('deploy/deploy.sh');

    expect(deploy).toContain('--with-http_sub_module');
    expect(deploy).toContain('__CSP_NONCE__');
  });

  /**
   * THE WEBROOT GOES FIRST, AND THE ORDER IS NOT A PREFERENCE.
   *
   * The two halves of this release only work together, and they fail in
   * opposite directions:
   *
   *   · NEW PAGE + OLD VHOST is harmless. The old policy carries no nonce
   *     source, so a browser ignores the `nonce` attribute entirely and the
   *     scripts are allowed by `'self'` exactly as before.
   *   · OLD PAGE + NEW VHOST IS A BLANK GAME. `'strict-dynamic'` makes `'self'`
   *     and every host source IGNORED, so a page whose script tags carry no
   *     nonce has nothing left to allow them. Every script is refused.
   *
   * So the vhost must never be reloaded while the previous client is still in
   * the webroot. `deploy.sh` used to install it right after starting the API
   * replicas — minutes before the client was even built — which would have
   * blanked the live site for the length of a Docker build.
   */
  it('publishes the client before it reloads the vhost that needs the nonce', async () => {
    const deploy = await read('deploy/deploy.sh');

    const publish = deploy.indexOf('deploy/publish-web.sh');
    const installVhost = deploy.indexOf('deploy/nginx/astera.conf "$nginx_live"');
    const reload = deploy.indexOf('systemctl reload nginx');

    expect(publish).toBeGreaterThan(-1);
    expect(installVhost).toBeGreaterThan(-1);
    expect(reload).toBeGreaterThan(-1);
    expect(installVhost).toBeGreaterThan(publish);
    expect(reload).toBeGreaterThan(publish);
  });

  /**
   * The runbook's rolling path carried the same hazard in prose: it told the
   * operator to install a changed vhost BEFORE the webroot rename. A document
   * that contradicts the script is worse than either alone, because the manual
   * path is the one taken when the script has already gone wrong.
   */
  it('tells the operator the same order in the runbook', async () => {
    const doc = await read('docs/deployment.md');

    expect(doc).not.toMatch(/install and validate it as in step 10 BEFORE the rename/u);
    expect(doc).toMatch(/AFTER the rename/u);
  });
});

/**
 * A ROLLBACK NEEDS THREE THINGS, AND THE SCRIPT USED TO KEEP NONE OF THEM.
 *
 * Going back means the image that was running, the client files that were
 * serving, and the vhost that was loaded. The runbook's manual path copies all
 * three by hand; `deploy.sh` overwrote the image tag, published over the webroot
 * in place, and wrote the vhost to a `mktemp` it deleted on the way out. After
 * the 2026-09-17 release the only way back was to check out the old commit and
 * rebuild — which is not a rollback plan when the site is down.
 *
 * The two shas here are deliberately different and answer different questions:
 * `rollback-<previous>` is the commit the image takes you back TO, while
 * `pre-<new>` is the release the vhost came BEFORE. Both conventions already
 * exist on the box from the manual path; the script now matches them.
 */
describe('the rollback boundary', () => {
  const read = (path: string): Promise<string> =>
    readFile(resolve(import.meta.dirname, '../../..', path), 'utf8');

  it('captures the replaced commit before the reset that makes it unnameable', async () => {
    const deploy = await read('deploy/deploy.sh');

    const capture = deploy.indexOf('export ASTERA_PREVIOUS_SHA=');
    const reset = deploy.indexOf('git reset --hard --quiet origin/master');

    expect(capture).toBeGreaterThan(-1);
    expect(reset).toBeGreaterThan(capture);
    // It has to survive the re-exec, so it is exported rather than a local.
    expect(deploy).toMatch(/export ASTERA_PREVIOUS_SHA=/u);
    expect(deploy).toMatch(/ROLLBACK_SHA=\$\{ASTERA_PREVIOUS_SHA:-/u);
  });

  it('retains the running image, the serving webroot and the loaded vhost', async () => {
    const deploy = await read('deploy/deploy.sh');

    expect(deploy).toMatch(/docker tag astera-server:latest "astera-server:rollback-\$\{ROLLBACK_SHA\}"/u);
    expect(deploy).toContain('/var/www/astera-previous/');
    expect(deploy).toMatch(/nginx_previous="\$\{nginx_live\}\.pre-/u);
  });

  /**
   * All three must be taken BEFORE anything is replaced. A copy made after the
   * publish is a copy of the release being rolled back, which is worse than
   * none: it looks like an escape route and is not one.
   */
  it('takes every copy before the thing it copies is overwritten', async () => {
    const deploy = await read('deploy/deploy.sh');

    const tagImage = deploy.indexOf('docker tag astera-server:latest');
    const buildImage = deploy.indexOf('$COMPOSE build api1');
    const copyWebroot = deploy.indexOf('/var/www/astera-previous/');
    const publish = deploy.indexOf('deploy/publish-web.sh');

    expect(buildImage).toBeGreaterThan(tagImage);
    expect(publish).toBeGreaterThan(copyWebroot);
  });

  /** The vhost copy is the rollback artifact, so it must outlive the script. */
  it('never deletes the vhost copy it just retained', async () => {
    const deploy = await read('deploy/deploy.sh');

    expect(deploy).not.toMatch(/rm -f "\$nginx_previous"/u);
  });
});
