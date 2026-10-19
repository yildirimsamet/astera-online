// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from 'vite';
import { z } from 'zod';
import { expect, it } from 'vitest';

it.each(['web', 'native-production'])('preserves publisher URL selection in an actual %s bundle without a native bridge', async target => {
  const result = await build({
    configFile: false, logLevel: 'silent',
    define: { 'import.meta.env.VITE_ASTERA_PLATFORM': JSON.stringify(target) },
    build: { write: false, minify: false, lib: {
      entry: fileURLToPath(new URL('../src/lib/publisherPages.ts', import.meta.url)),
      name: 'PublisherLinks', formats: ['iife'],
    } },
  });
  const output = Array.isArray(result) ? result[0] : result;
  if (!output || !('output' in output)) throw new Error('Expected a publisher bundle');
  const entry = output.output.find(chunk => chunk.type === 'chunk' && chunk.isEntry);
  if (entry?.type !== 'chunk') throw new Error('No publisher entry');
  const encoded: unknown = runInNewContext(entry.code + '\nJSON.stringify({privacy:PublisherLinks.publisherUrl("privacy","tr-TR"),wiki:PublisherLinks.publisherWikiUrl("tr-TR")});');
  const urls = z.object({ privacy: z.string(), wiki: z.string() }).parse(JSON.parse(z.string().parse(encoded)));
  const origin = target === 'web' ? '' : 'https://asteraonline.space';
  expect(urls).toEqual({ privacy: `${origin}/gizlilik-politikasi.html`, wiki: `${origin}/wiki/tr` });
});
