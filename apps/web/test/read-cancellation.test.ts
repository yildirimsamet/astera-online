import { expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';

const readers = [
  ['traffic', (api: Api, signal: AbortSignal) => api.traffic({ signal })],
  ['planets', (api: Api, signal: AbortSignal) => api.planets({ signal })],
  ['planet', (api: Api, signal: AbortSignal) => api.planet('world', { signal })],
  ['miningField', (api: Api, signal: AbortSignal) => api.miningField({ signal })],
  ['miningStatus', (api: Api, signal: AbortSignal) => api.miningStatus('world', { signal })],
  ['pirates', (api: Api, signal: AbortSignal) => api.pirates('world', { signal })],
  ['pending', (api: Api, signal: AbortSignal) => api.pending({ signal })],
  ['monuments', (api: Api, signal: AbortSignal) => api.monuments({ signal })],
] as const;

it.each(readers)('cancels the %s HTTP read when its query is removed', async (_name, read) => {
  const controller = new AbortController();
  const http = vi.fn((_url: string | URL | Request, init?: RequestInit): Promise<Response> =>
    new Promise((_resolve, reject) => {
      if (!init?.signal) { reject(new Error('no cancellation signal reached fetch')); return; }
      init.signal.addEventListener('abort', () => { reject(new DOMException('Read cancelled', 'AbortError')); }, { once: true });
    }));
  const result = read(new Api({ fetch: http }), controller.signal).catch((error: unknown) => error);
  controller.abort();
  expect(await result).toMatchObject({ name: 'AbortError' });
  expect(http).toHaveBeenCalledTimes(1);
});

it('preserves cancellation during response-body parsing instead of reporting a schema error', async () => {
  const controller = new AbortController();
  const api = new Api({ fetch: () => Promise.resolve(new Response(new ReadableStream({
    start(body) {
      controller.signal.addEventListener('abort', () => { body.error(controller.signal.reason); }, { once: true });
    },
  }))) });
  const result = api.traffic({ signal: controller.signal }).catch((error: unknown) => error);
  await Promise.resolve();
  controller.abort();
  expect(await result).toMatchObject({ name: 'AbortError' });
});
