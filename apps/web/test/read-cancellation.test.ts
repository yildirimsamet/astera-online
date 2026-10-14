import { expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { academyFetch } from '../src/onboarding/academyFetch.js';
import { openAcademy } from '../src/onboarding/academyWorld.js';

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

it('keeps cancellation-compatible reads working in the private Academy transport', async () => {
  const world = openAcademy(Date.now());
  const api = new Api({ fetch: academyFetch(() => world, () => undefined) });
  const controller = new AbortController();
  expect((await api.planet(undefined, { signal: controller.signal })).planet.id).toBe(world.preview.reserved.id);
  expect((await api.miningField({ signal: controller.signal })).asteroids).toBeDefined();
  expect((await api.miningStatus(undefined, { signal: controller.signal })).runs).toBeDefined();
});

it('does not read or advance the Academy world when its local request is already aborted', async () => {
  const read = vi.fn(() => openAcademy(Date.now()));
  const write = vi.fn();
  const controller = new AbortController();
  controller.abort();
  await expect(academyFetch(read, write)('/api/planet', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
});
