// @vitest-environment node
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { build } from 'vite';
import { nativeBundlePlugin } from '../nativeBundlePlugin.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

it.each(['native-local', 'native-staging', 'native-production'])('%s packages runtime assets without the immutable ship staging drop', async target => {
  const root = mkdtempSync(join(tmpdir(), 'astera-native-assets-'));
  roots.push(root);
  const files = {
    'public/assets/new_test_ship_modals/cargo/cargo_lvl_1.glb': 'raw model source',
    'public/assets/new_test_ship_modals/cargo/cargo_lvl_1.png': 'raw card source',
    'public/assets/models/ships/courier.glb': 'processed runtime model',
    'public/assets/images/ships/courier.webp': 'processed runtime card',
    'public/assets/images/landing/orbit-hero-v1.webp': 'web-only promotional artwork',
    'public/assets/audio/premium/tap-v1.mp3': 'runtime audio',
    'public/assets/new_test_ship_modals-extra/keep.bin': 'unrelated runtime asset',
    'public/icons/icon-192.png': 'runtime icon',
    'public/checkout.html': 'web checkout',
    'index.html': '<html><head><meta charset="UTF-8"></head><body><script type="module" src="/main.js"></script></body></html>',
    'main.js': 'document.documentElement.dataset.ready = "true";',
  };
  for (const [path, contents] of Object.entries(files)) {
    const destination = join(root, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, contents);
  }
  await build({ root, configFile: false, logLevel: 'silent', publicDir: false,
    plugins: [nativeBundlePlugin('https://api.example.test', target, root)], build: { outDir: 'dist' } });

  const output = join(root, 'dist');
  expect(existsSync(join(output, 'assets/new_test_ship_modals'))).toBe(false);
  expect(existsSync(join(output, 'assets/images/landing'))).toBe(false);
  for (const [path, contents] of Object.entries(files)) {
    expect(readFileSync(join(root, path), 'utf8')).toBe(contents);
    if (path.startsWith('public/') && !path.includes('/new_test_ship_modals/') && !path.includes('/images/landing/') && !path.endsWith('checkout.html')) {
      expect(readFileSync(join(output, path.slice('public/'.length)), 'utf8')).toBe(contents);
    }
  }
  expect(existsSync(join(output, 'checkout.html'))).toBe(false);
  const html = readFileSync(join(output, 'index.html'), 'utf8');
  const entry = /<script[^>]+src="([^"]+)"/.exec(html)?.[1];
  expect(entry).toMatch(/^\/assets\/[^/]+\.js$/);
  expect(readFileSync(join(output, entry ?? ''), 'utf8')).toContain('dataset.ready');
});

/** Owner 2026-10-30: the pack is ours; an app carries the webp lite one and only what its manifest names. */
it('embeds the webp lite reference pack and nothing else from the archive', async () => {
  const root = mkdtempSync(join(tmpdir(), 'astera-native-refs-'));
  roots.push(root);
  const manifest = JSON.stringify({ ship: '/__ref/dist/v2/ship.glb', sounds: { engine: ['/__ref/audio/v2/engine.ogg'] } });
  const files = {
    'refs/dist/v2/manifest-lite.json': manifest,
    'refs/dist/v2/ship.glb': 'owned ship',
    'refs/audio/v2/engine.ogg': 'owned sound',
    'refs/dist/v2/manifest-ktx2.json': '{}',
    'refs/dist/lite/unused.glb': 'not named by the lite manifest',
    'refs/extract/raw.bin': 'raw archive',
    'public/assets/models/ships/courier.glb': 'processed runtime model',
    'public/icons/icon-192.png': 'runtime icon',
    'index.html': '<html><head><meta charset="UTF-8"></head><body><script type="module" src="/main.js"></script></body></html>',
    'main.js': 'document.documentElement.dataset.ready = "true";',
  };
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  await build({ root, configFile: false, logLevel: 'silent', publicDir: false,
    plugins: [nativeBundlePlugin('https://api.example.test', 'native-production', root, join(root, 'refs'))], build: { outDir: 'dist' } });

  const pack = join(root, 'dist/__ref');
  expect(readFileSync(join(pack, 'dist/v2/manifest-lite.json'), 'utf8')).toBe(manifest);
  expect(readFileSync(join(pack, 'dist/v2/ship.glb'), 'utf8')).toBe('owned ship');
  expect(readFileSync(join(pack, 'audio/v2/engine.ogg'), 'utf8')).toBe('owned sound');
  for (const absent of ['dist/v2/manifest-ktx2.json', 'dist/lite/unused.glb', 'extract/raw.bin']) expect(existsSync(join(pack, absent))).toBe(false);
});

it('stops a native build whose reference pack is missing or incomplete', async () => {
  const root = mkdtempSync(join(tmpdir(), 'astera-native-refs-missing-'));
  roots.push(root);
  writeFileSync(join(root, 'index.html'), '<html><head><meta charset="UTF-8"></head><body><script type="module" src="/main.js"></script></body></html>');
  writeFileSync(join(root, 'main.js'), 'void 0;');
  mkdirSync(join(root, 'public/assets'), { recursive: true }); mkdirSync(join(root, 'public/icons'), { recursive: true });
  const run = () => build({ root, configFile: false, logLevel: 'silent', publicDir: false,
    plugins: [nativeBundlePlugin('https://api.example.test', 'native-production', root, join(root, 'refs'))], build: { outDir: 'dist' } });
  await expect(run()).rejects.toThrow(/reference pack/i);
  mkdirSync(join(root, 'refs/dist/v2'), { recursive: true });
  writeFileSync(join(root, 'refs/dist/v2/manifest-lite.json'), JSON.stringify({ ship: '/__ref/dist/v2/missing.glb' }));
  await expect(run()).rejects.toThrow(/reference pack/i);
});
