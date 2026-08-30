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
});
