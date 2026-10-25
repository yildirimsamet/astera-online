// @vitest-environment node
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { ViteDevServer } from 'vite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { refAssetsPlugin } from '../../src/lib/refAssetsPlugin.js';

let directory: string;
let server: ViteDevServer | undefined;
let base: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'astera-ref-test-'));
  await mkdir(join(directory, 'dist'));
  await mkdir(join(directory, 'audio'));
  await mkdir(join(directory, 'raw'));
  await writeFile(join(directory, 'manifest.json'), '{"ship.pilot":"/__ref/dist/ship.glb"}');
  await writeFile(join(directory, 'dist/ship.glb'), 'model');
  await writeFile(join(directory, 'audio/fire.ogg'), 'audio');
  await writeFile(join(directory, 'raw/private.apk'), 'private');
});
afterEach(async () => { await server?.close(); server = undefined; await rm(directory, { recursive: true, force: true }); });

async function listen(): Promise<void> {
  const { createServer } = await import('vite');
  server = await createServer({ configFile: false, root: directory,
    plugins: [refAssetsPlugin(directory, resolve('../..'))],
    server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent',
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') throw new Error('No test server port');
  base = `http://127.0.0.1:${String(address.port)}`;
}

describe('development-only external references', () => {
  it('is inactive without a directory and excluded from production builds', () => {
    expect(refAssetsPlugin(undefined, resolve('../..'))).toBeNull();
    expect(refAssetsPlugin(directory, resolve('../..'))?.apply).toBe('serve');
  });

  it('rejects a repository directory and a symlink pointing inside it', async () => {
    expect(() => refAssetsPlugin(resolve('../..'), resolve('../..'))).toThrow(/astera-refs|outside|depo/i);
    const link = join(directory, 'repo-link');
    await symlink(resolve('../..'), link);
    expect(() => refAssetsPlugin(link, resolve('../..'))).toThrow(/astera-refs|outside|depo/i);
  });

  it('serves only the manifest, prepared models and audio', async () => {
    await listen();
    expect(await (await fetch(`${base}/__ref/manifest.json`)).json()).toEqual({ 'ship.pilot': '/__ref/dist/ship.glb' });
    expect(await (await fetch(`${base}/__ref/dist/ship.glb`)).text()).toBe('model');
    expect(await (await fetch(`${base}/__ref/audio/fire.ogg`)).text()).toBe('audio');
    expect((await fetch(`${base}/__ref/raw/private.apk`)).status).toBe(404);
  });

  it('rejects traversal, malformed escaping and symlinks leaving the allowed subtree', async () => {
    await symlink(join(directory, 'raw/private.apk'), join(directory, 'dist/escape.glb'));
    await listen();
    for (const path of ['/__ref/dist/escape.glb', '/__ref/dist/%2e%2e%2fraw/private.apk', '/__ref/dist/%']) {
      const result = await fetch(base + path);
      expect([400, 403, 404]).toContain(result.status);
      expect(await result.text()).not.toBe('private');
    }
  });
});
