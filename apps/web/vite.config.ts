import { defineConfig, loadEnv } from 'vite';
import { mobileBuild } from './mobileBuild.js';
import { nativeBundlePlugin } from './nativeBundlePlugin.js';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { adsensePlugin } from './src/lib/adsense.js';
import { wikiPlugin } from './wikiPlugin.js';
import { landingPlugin } from './landingPlugin.js';
import { openingScreenPlugin } from './openingScreenPlugin.js';
import { fileURLToPath } from 'node:url';
import { referenceArtPlugin } from './src/lib/referenceArtPlugin.js';
import { refAssetsPlugin } from './src/lib/refAssetsPlugin.js';

/**
 * Everything is served same-origin in dev, through this proxy.
 *
 * The refresh token is an httpOnly, SameSite=Lax cookie. Talking to the API on
 * another origin would mean SameSite=None plus CORS credentials — a weaker cookie
 * and two more things to get wrong — for no benefit in a single-deployment game.
 */
const API = process.env.ASTERA_API ?? 'http://localhost:3100';
const referenceDirectory = resolve(process.cwd(), '../../astera-refs');
const apiProxy = {
  '/arena': { target: process.env.ASTERA_ARENA ?? 'http://localhost:3101', ws: true },
  '/api': {
    target: API,
    changeOrigin: true,
    // SSE must not be buffered by the proxy or the return moment arrives
    // in one lump when the connection closes.
    ws: false,
  },
};

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_ASTERA_');
  const mobile = mobileBuild(env);
  const { target } = mobile;
  const references = command === 'serve' ? referenceArtPlugin(fileURLToPath(new URL('../..', import.meta.url))) : null;
  // Arena reference pack (Komutan Gemisi); dev server only, never in a build.
  const arenaReferences = command === 'serve' ? refAssetsPlugin(
    process.env.ASTERA_REF_ASSETS_DIR ?? loadEnv(mode, process.cwd(), '').ASTERA_REF_ASSETS_DIR
      ?? (existsSync(resolve(referenceDirectory, 'manifest.json')) ? referenceDirectory : undefined),
    resolve(process.cwd(), '../..')) : null;
  return {
  plugins: [react(), tailwindcss(), openingScreenPlugin(), target === 'web' && adsensePlugin(), target === 'web' && wikiPlugin(), target === 'web' && landingPlugin(), references, arenaReferences,
    mobile.target !== 'web' && nativeBundlePlugin(mobile.apiUrl, target, fileURLToPath(new URL('.', import.meta.url)))],
  publicDir: target === 'web' ? 'public' : false,
  define: {
    'import.meta.env.VITE_ASTERA_PLATFORM': JSON.stringify(target),
    'import.meta.env.VITE_ASTERA_REFERENCE_ART': JSON.stringify(references ? 'true' : 'false'),
    ...(mobile.target === 'web' ? {} : { 'import.meta.env.VITE_ASTERA_API_URL': JSON.stringify(mobile.apiUrl) }),
    ...(mobile.target === 'web' ? {} : { 'import.meta.env.VITE_ASTERA_NATIVE_BUILD': JSON.stringify(mobile.nativeBuild) }),
    ...(mobile.target === 'web' ? {} : { 'import.meta.env.VITE_VISUAL_TEST': JSON.stringify('0') }),
  },
  /**
   * THE CSP NONCE PLACEHOLDER, FILLED IN PER REQUEST BY NGINX.
   *
   * Google does not support allow-listing AdSense by domain: the tag in `<head>`
   * fetches further loaders from shards Google rotates, so a list is a policy
   * that breaks on a Tuesday. Their documented model is a nonce plus
   * `'strict-dynamic'`, which trusts what a nonced script loads rather than
   * where it came from.
   *
   * `'strict-dynamic'` also makes `'self'` IGNORED, so EVERY script tag in the
   * document needs the nonce — Vite's own module tag included, which is why this
   * is a build option and not three hand-written attributes. The literal is
   * replaced with `$request_id` by `sub_filter` in `deploy/nginx/astera.conf`;
   * `deploy.sh` therefore refuses to pre-compress `index.html`, because a
   * gzipped body is one `sub_filter` cannot rewrite.
   */
  html: target === 'web' ? { cspNonce: '__CSP_NONCE__' } : {},
  /**
   * ONE THREE, STATED RATHER THAN HOPED FOR.
   *
   * `three` is a peer dependency of five packages here — fiber, drei,
   * postprocessing, three-stdlib, troika — and a second copy is the worst kind of
   * bug this client can have: every `instanceof` across the boundary is false, two
   * renderers fight over the same GPU state, and the only symptom is one console
   * line. The graph resolves to a single copy today; this is what keeps it there
   * through an upgrade that would otherwise change it silently.
   */
  resolve: { dedupe: ['three'] },
  server: {
    port: 5173,
    // Reachable from a phone on the same network — this game is played in gaps,
    // standing up, on a small screen. Testing it on a desktop only is testing
    // something else.
    host: true,
    proxy: apiProxy,
  },
  // Visual regression runs use an immutable production build. Keeping the same
  // same-origin API seam in preview makes those captures immune to an unrelated
  // source file being saved halfway through a Playwright frame sequence.
  preview: { host: true, proxy: apiProxy },
  build: { target: 'es2022', ...(mobile.target === 'web' ? {} : { outDir: mobile.webDir }) },
  };
});
