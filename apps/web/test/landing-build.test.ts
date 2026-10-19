// @vitest-environment node
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'vite';
import { expect, it } from 'vitest';
import { landingPlugin } from '../landingPlugin.js';

it('builds all locale documents with the compiled client, nonce metadata and one versioned stylesheet', async () => {
  const root = mkdtempSync(join(tmpdir(), 'astera-landing-build-'));
  try {
    const template = readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf8').replace('/src/main.tsx', '/main.js');
    writeFileSync(join(root, 'index.html'), template);
    writeFileSync(join(root, 'main.js'), 'document.documentElement.dataset.testClient = "ready";');
    await build({ root, configFile: false, logLevel: 'silent', publicDir: resolve(import.meta.dirname, '../public'), plugins: [landingPlugin()], html: { cspNonce: '__CSP_NONCE__' }, build: { outDir: 'dist', copyPublicDir: false } });
    for (const language of ['tr', 'en', 'fr', 'de', 'es', 'ja']) {
      const html = readFileSync(join(root, `dist/${language}/index.html`), 'utf8');
      expect(html).toContain(`lang="${language}"`);
      expect(html).toContain('property="csp-nonce"');
      expect(html).not.toContain('/main.js');
      expect(html).toMatch(/<script[^>]*src="\/assets\/[^/]+\.js"/);
      const css = [...html.matchAll(/href="(\/(?:assets\/)?landing\/style[^"]*\.css)"/g)].map(match => match[1]);
      expect(css).toHaveLength(1);
      expect(css[0]).toMatch(/^\/assets\/landing\/style-[a-f0-9]+\.css$/);
      expect(existsSync(join(root, `dist${css[0]}`))).toBe(true);
      expect(html.match(/<h1\b/g)).toHaveLength(1);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
