// @vitest-environment node
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Production 2026-11-26: Cloudflare Web Analytics appended its beacon to the release's index.html
 * for clients that send no Accept header, as the phone's updater does; curl sends one and saw the
 * file intact. Every phone refused the release. The check after each publish asks like the phone.
 */
const run = promisify(execFile);
const script = resolve(__dirname, '../../../deploy/verify-ota.py');
const RELEASE = 'a'.repeat(40);
const html = '<!doctype html><html><body><div id="root"></div></body></html>';
const js = 'console.log("game");';
const hash = (text: string) => createHash('sha256').update(text).digest('hex');

let server: Server | undefined;
afterEach(() => { server?.close(); server = undefined; });

async function site(options: { rewriteWithoutAccept?: boolean; web?: string }): Promise<string> {
  let origin = '';
  server = createServer((req, res) => {
    const files = [
      { file_name: 'index.html', file_hash: hash(html), download_url: `${origin}/ota/files/${hash(html)}.html` },
      { file_name: 'assets/index.js', file_hash: hash(js), download_url: `${origin}/ota/files/${hash(js)}.js` },
    ];
    const routes: Record<string, string> = {
      '/ota/latest.json': JSON.stringify({ version: RELEASE, minShell: 1, manifest: `/ota/${RELEASE}/manifest.json` }),
      [`/ota/${RELEASE}/manifest.json`]: JSON.stringify({ version: RELEASE, files }),
      [`/ota/files/${hash(html)}.html`]: html,
      [`/ota/files/${hash(js)}.js`]: js,
      '/release.txt': `${options.web ?? RELEASE}\n`,
    };
    let body = routes[req.url ?? ''];
    if (body === undefined) { res.writeHead(404).end(); return; }
    if (options.rewriteWithoutAccept && req.url?.endsWith('.html') && !req.headers.accept) body = body.replace('</body>', '<script src="beacon.js"></script></body>');
    if (req.headers['accept-encoding']?.includes('gzip')) { res.writeHead(200, { 'content-encoding': 'gzip' }).end(gzipSync(body)); return; }
    res.writeHead(200).end(body);
  });
  await new Promise<void>(done => server?.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return origin;
}

async function verify(origin: string): Promise<{ code: number; out: string }> {
  try {
    const { stdout, stderr } = await run('python3', [script, origin]);
    return { code: 0, out: stdout + stderr };
  } catch (error) {
    const failed = error as { code: number; stdout: string; stderr: string };
    return { code: failed.code, out: failed.stdout + failed.stderr };
  }
}

describe('the check after an OTA publish', () => {
  it('passes when every HTML file arrives byte-exact and the web serves the same release', async () => {
    const result = await verify(await site({}));
    expect(result.out).toContain(RELEASE);
    expect(result.code).toBe(0);
  });

  it('fails when a proxy rewrites an HTML file for a client that asks like the phone', async () => {
    const result = await verify(await site({ rewriteWithoutAccept: true }));
    expect(result.code).toBe(1);
    expect(result.out).toContain('index.html');
  });

  it('fails when the web and the app update name different releases', async () => {
    const result = await verify(await site({ web: 'b'.repeat(40) }));
    expect(result.code).toBe(1);
    expect(result.out).toMatch(/web .* OTA/);
  });
});
