/** Local-only report review. Start apps/server/test/battleReplayPreview.ts against its isolated test DB first. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from '../apps/web/node_modules/vite/dist/node/index.js';
import { battleReplayPreviewPage } from './battle-replay-preview-page.mjs';

const fixture = JSON.parse(await readFile('/tmp/astera-real-replay-preview.json', 'utf8'));
process.chdir(fileURLToPath(new URL('../apps/web', import.meta.url)));
let html = '';
const server = await createServer({
  server: { watch: null, host: '0.0.0.0', port: 5190, strictPort: true, proxy: {
    '/api': { target: 'http://127.0.0.1:5191', changeOrigin: true, configure(proxy) {
      proxy.on('proxyReq', (request, incoming) => {
        const viewer = /(?:^|;\s*)astera_preview_viewer=1(?:;|$)/.test(incoming.headers.cookie ?? '') ? 1 : 0;
        request.setHeader('authorization', `Bearer ${fixture.tokens[viewer]}`);
      });
    } },
  } },
  plugins: [{ name: 'isolated-battle-replay-preview',
  // Vite's config merge skips inline nulls; disable watching after resolution.
  configResolved(config) { config.server.watch = null; },
  configureServer(vite) {
    vite.middlewares.use('/real-battle-preview', (request, response) => {
      const viewer = new URL(request.url ?? '/', 'http://localhost').searchParams.get('viewer') === 'defender' ? 1 : 0;
      response.setHeader('Set-Cookie', `astera_preview_viewer=${viewer}; Path=/; SameSite=Strict`);
      response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html);
    });
  } }],
});
await server.listen();
const source = await (await fetch('http://localhost:5190/src/api/queries.ts')).text();
const queryModule = source.match(/from "([^"]*\/@tanstack_react-query\.js[^"]*)"/)?.[1];
if (!queryModule) throw new Error('Application React Query module could not be resolved');
html = battleReplayPreviewPage({ queryModule, missionId: fixture.missionId });
if (process.stdin.isTTY) process.stdin.on('data', () => { server.moduleGraph.invalidateAll(); });
console.log('Actual battle report: http://localhost:5190/real-battle-preview');
console.log('Defender: http://localhost:5190/real-battle-preview?viewer=defender');
