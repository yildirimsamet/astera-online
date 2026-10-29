import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { nativeCompatibilityScript, nativeStartupHtml } from './nativeStartupPage.js';
import { NATIVE_STARTUP_PATH } from './mobileBuild.js';

/** Controlled Vite HTML, not a general-purpose untrusted HTML sanitizer. */
export function nativeHtml(input: string, apiUrl: string): string {
  const hashes = [`'sha256-${createHash('sha256').update(nativeCompatibilityScript).digest('base64')}'`];
  for (const match of input.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const src = /\bsrc=["']([^"']+)["']/i.exec(match[1] ?? '')?.[1];
    if (src) {
      if (!src.startsWith('/assets/') || src.includes('..')) throw new Error('Unexpected native script URL');
    } else hashes.push(`'sha256-${createHash('sha256').update(match[2] ?? '').digest('base64')}'`);
  }
  const csp = ["default-src 'none'", `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(' ')}`,
    "style-src 'self' 'unsafe-inline'", `connect-src 'self' blob: ${apiUrl}`, "img-src 'self' data: blob:",
    "font-src 'self' data:", "media-src 'self' blob:", "worker-src 'self' blob:",
    "frame-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"].join('; ');
  return input.replace(/\snonce=["']__CSP_NONCE__["']/g, '')
    .replace(/<meta\b[^>]*property=["']csp-nonce["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']manifest["'][^>]*>/gi, '')
    .replace(/<meta\b[^>]*charset=["'][^"']+["'][^>]*>/i, match => `${match}<meta http-equiv="Content-Security-Policy" content="${csp}"><script data-native-compatibility>${nativeCompatibilityScript}</script>`);
}

/** The pack an app carries: the webp lite one, which needs no KTX2 transcoder (owner 2026-10-30). */
export const NATIVE_REFERENCE_MANIFEST = 'dist/v2/manifest-lite.json';

/** Copies the lite manifest and only the files it names; the archive's other packs and raw extracts stay out. */
function embedReferencePack(refs: string, output: string): void {
  const manifest = resolve(refs, NATIVE_REFERENCE_MANIFEST);
  if (!existsSync(manifest)) throw new Error(`Native build needs the reference pack: ${manifest} (set ASTERA_REF_ASSETS_DIR)`);
  const named = new Set([NATIVE_REFERENCE_MANIFEST]);
  for (const match of readFileSync(manifest, 'utf8').matchAll(/"\/__ref\/((?:dist|audio)\/[a-zA-Z0-9_./-]+)"/g)) {
    const path = match[1] ?? '';
    if (path.split('/').some(part => part === '' || part === '.' || part === '..')) throw new Error(`Invalid reference pack path: ${path}`);
    named.add(path);
  }
  for (const path of named) {
    const source = resolve(refs, path);
    if (!existsSync(source)) throw new Error(`Incomplete reference pack: ${path} is missing`);
    mkdirSync(dirname(resolve(output, '__ref', path)), { recursive: true });
    cpSync(source, resolve(output, '__ref', path));
  }
}

/** Copies only game assets. Publisher HTML/scripts, dev fixtures and PWA files never enter this output. */
export function nativeBundlePlugin(apiUrl: string, target: string, root: string, refs?: string): Plugin {
  let outDir = '';
  return {
    name: 'astera-native-bundle',
    configResolved(config) { outDir = config.build.outDir; },
    closeBundle() {
      const output = resolve(root, outDir);
      const index = resolve(output, 'index.html');
      writeFileSync(index, nativeHtml(readFileSync(index, 'utf8'), apiUrl));
      mkdirSync(resolve(output, 'assets'), { recursive: true });
      // Immutable authoring drop; runtime uses the processed models/ships and images/ships.
      const staging = resolve(root, 'public/assets/new_test_ship_modals');
      const marketing = resolve(root, 'public/assets/images/landing');
      cpSync(resolve(root, 'public/assets'), resolve(output, 'assets'), {
        recursive: true, errorOnExist: false, filter: source => source !== staging && source !== marketing,
      });
      cpSync(resolve(root, 'public/icons'), resolve(output, 'icons'), { recursive: true });
      if (refs !== undefined) embedReferencePack(refs, output);
      writeFileSync(resolve(output, NATIVE_STARTUP_PATH), nativeStartupHtml());
      writeFileSync(resolve(output, 'native-build.json'), JSON.stringify({ target, apiUrl, bundled: true, storeReady: false }, null, 2) + '\n');
    },
  };
}
