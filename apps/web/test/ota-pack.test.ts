// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { OTA_MIN_SHELL, packOta } from '../otaPack.js';

const VERSION = 'c'.repeat(40);
const BASE = 'https://asteraonline.space';
const roots: string[] = [];
const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

async function bundle(): Promise<{ input: string; output: string }> {
  const root = await mkdtemp(join(tmpdir(), 'astera-ota-pack-'));
  roots.push(root);
  const input = join(root, 'bundle');
  await mkdir(join(input, 'assets'), { recursive: true });
  await mkdir(join(input, '__ref/dist/v2'), { recursive: true });
  await writeFile(join(input, 'index.html'), '<script src="/assets/index-1.js"></script>');
  await writeFile(join(input, 'assets/index-1.js'), 'console.log("game");'.repeat(200));
  await writeFile(join(input, 'assets/copy-of-index.js'), 'console.log("game");'.repeat(200));
  await writeFile(join(input, 'assets/ship.webp'), Buffer.alloc(4096, 7));
  await writeFile(join(input, '__ref/dist/v2/manifest-lite.json'), '{}');
  return { input, output: join(root, 'ota') };
}

interface Entry { file_name: string; file_hash: string; download_url: string; size: number }

/**
 * OTA F2: every web deploy packs the app bundle for the phones. Files are stored once under their
 * content hash, so a phone fetches only what changed and an old manifest keeps working.
 */
describe('the OTA pack', () => {
  it('lists every bundle file once, by the hash of its bytes, at a URL that serves those bytes', async () => {
    const { input, output } = await bundle();
    packOta(input, output, { version: VERSION, baseUrl: BASE });
    const manifest = JSON.parse(await readFile(join(output, VERSION, 'manifest.json'), 'utf8')) as { version: string; files: Entry[] };
    expect(manifest.version).toBe(VERSION);
    expect(manifest.files.map(entry => entry.file_name).sort()).toEqual(
      ['__ref/dist/v2/manifest-lite.json', 'assets/copy-of-index.js', 'assets/index-1.js', 'assets/ship.webp', 'index.html']);
    for (const entry of manifest.files) {
      const bytes = await readFile(join(input, entry.file_name));
      expect(entry.file_hash).toBe(sha(bytes));
      expect(entry.size).toBe(bytes.length);
      const extension = /\.[a-z0-9]+$/.exec(entry.file_name)?.[0] ?? '';
      expect(entry.download_url).toBe(`${BASE}/ota/files/${entry.file_hash}${extension}`);
      expect(await readFile(join(output, 'files', `${entry.file_hash}${extension}`))).toEqual(bytes);
    }
  });

  it('stores identical files once and compresses only text worth compressing', async () => {
    const { input, output } = await bundle();
    packOta(input, output, { version: VERSION, baseUrl: BASE });
    const stored = await readdir(join(output, 'files'));
    const script = `${sha('console.log("game");'.repeat(200))}.js`;
    expect(stored.filter(name => name === script)).toHaveLength(1);
    expect(gunzipSync(await readFile(join(output, 'files', `${script}.gz`))).toString()).toBe('console.log("game");'.repeat(200));
    expect(stored.some(name => name.endsWith('.webp.gz'))).toBe(false);
    expect(stored.some(name => name.endsWith('.html.gz'))).toBe(false);
  });

  it('names the release, the oldest shell that runs it and where its manifest is', async () => {
    const { input, output } = await bundle();
    packOta(input, output, { version: VERSION, baseUrl: BASE });
    expect(JSON.parse(await readFile(join(output, 'latest.json'), 'utf8'))).toEqual({
      version: VERSION, minShell: OTA_MIN_SHELL, manifest: `/ota/${VERSION}/manifest.json`,
    });
  });

  it.each([
    ['a short version', { version: 'abc123', baseUrl: BASE }],
    ['a dirty version', { version: `${VERSION}.dirty`, baseUrl: BASE }],
    ['an insecure origin', { version: VERSION, baseUrl: 'http://asteraonline.space' }],
    ['an origin with a path', { version: VERSION, baseUrl: `${BASE}/ota` }],
  ])('refuses %s', async (_case, at) => {
    const { input, output } = await bundle();
    expect(() => { packOta(input, output, at); }).toThrow();
  });

  it('refuses a bundle without its entry document', async () => {
    const { input, output } = await bundle();
    await rm(join(input, 'index.html'));
    expect(() => { packOta(input, output, { version: VERSION, baseUrl: BASE }); }).toThrow(/index\.html/);
  });
});
