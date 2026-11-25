import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { z } from 'zod';

/**
 * The oldest app shell (Android versionCode) that can run the web bundle of this commit. Shells
 * without the updater never read `latest.json`, so 1 means "every shell that asks". Raise it when
 * the web starts calling a native plugin an older shell lacks; that shell is sent to the store.
 */
export const OTA_MIN_SHELL = 1;

/** Compressed copies beside text files, served by nginx `gzip_static`; images and audio are compressed already. */
const COMPRESSIBLE = new Set(['.js', '.css', '.json', '.svg', '.html', '.txt', '.wasm', '.glsl']);

const atSchema = z.object({
  version: z.string().regex(/^[a-f0-9]{40}$/u, 'OTA version must be the full commit'),
  baseUrl: z.string().url().refine(value => { const url = new URL(value); return url.protocol === 'https:' && url.origin === value; },
    'OTA base must be an https origin'),
});

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : entry.isFile() ? [path] : [];
  });
}

/**
 * Packs a built app bundle (`mobile-dist/native-production`) for the phones (OTA F2):
 *   files/<sha256><ext>        every file once, by content; a later release reuses it
 *   <version>/manifest.json    file name → hash, size and URL, the list the updater downloads
 *   latest.json                the release phones should run, written last
 */
export function packOta(input: string, output: string, at: { version: string; baseUrl: string }): void {
  const { version, baseUrl } = atSchema.parse(at);
  if (!existsSync(join(input, 'index.html'))) throw new Error(`OTA bundle has no index.html: ${input}`);
  mkdirSync(join(output, 'files'), { recursive: true });
  mkdirSync(join(output, version), { recursive: true });
  const files = walk(input).sort().map(path => {
    const bytes = readFileSync(path);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const extension = extname(path).toLowerCase();
    const stored = join(output, 'files', `${hash}${extension}`);
    if (!existsSync(stored)) {
      copyFileSync(path, stored);
      if (COMPRESSIBLE.has(extension) && bytes.length > 1024) writeFileSync(`${stored}.gz`, gzipSync(bytes, { level: 9 }));
    }
    return { file_name: relative(input, path).split('\\').join('/'), file_hash: hash,
      download_url: `${baseUrl}/ota/files/${hash}${extension}`, size: bytes.length };
  });
  writeFileSync(join(output, version, 'manifest.json'), JSON.stringify({ version, files }));
  writeFileSync(join(output, 'latest.json'), JSON.stringify({ version, minShell: OTA_MIN_SHELL, manifest: `/ota/${version}/manifest.json` }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output, version, baseUrl] = process.argv.slice(2).filter(arg => arg !== '--');
  if (!input || !output || !version || !baseUrl) throw new Error('Usage: otaPack.ts INPUT OUTPUT VERSION BASE_URL');
  packOta(resolve(input), resolve(output), { version, baseUrl });
  console.log(`OTA ${version} packed into ${output}`);
}
