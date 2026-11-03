import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { usePlanet } from '../src/api/queries.js';
import { WorldProvider } from '../src/api/world.js';
import { planetView } from './fixtures.js';

it.each(['world list', 'individual world'] as const)('aborts the %s HTTP request when its provider unmounts', async (reader) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (reader === 'individual world') {
    client.setQueryData(keys.planets, {
      playerId: 'player-1', seasonId: 'season-1', capitalPlanetId: 'capital',
      planets: [planetView({}, { id: 'capital' })],
    });
  }
  const httpState: { signal: AbortSignal | null } = { signal: null };
  const http = vi.fn((_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    httpState.signal = init?.signal ?? null;
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => { reject(new DOMException('Read cancelled', 'AbortError')); }, { once: true });
    });
  });
  const view = render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch: http })}>
    <WorldProvider><div /></WorldProvider>
  </ApiProvider></QueryClientProvider>);
  if (reader === 'individual world') {
    act(() => { void client.fetchQuery({ queryKey: keys.planetById('capital'), staleTime: 0 }).catch(() => undefined); });
  }
  await waitFor(() => { expect(http).toHaveBeenCalledOnce(); });
  view.unmount();
  expect(httpState.signal).toBeInstanceOf(AbortSignal);
  expect(httpState.signal?.aborted).toBe(true);
  client.clear();
});

const address = (url: string | URL | Request): string => url instanceof Request ? url.url : url.toString();

it('refreshes the list and the open world with one HTTP read', async () => {
  const world = planetView({}, { id: 'capital' });
  const list = { playerId: 'player-1', seasonId: 'season-1', capitalPlanetId: 'capital', planets: [world] };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(keys.planets, list);
  client.setQueryData(keys.planetById('capital'), world);
  const http = vi.fn((url: string | URL | Request) => Promise.resolve(new Response(JSON.stringify(address(url).endsWith('/api/planets') ? list : world))));
  function OpenWorld() { usePlanet(); return null; }
  const view = render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch: http })}>
    <WorldProvider><OpenWorld /></WorldProvider>
  </ApiProvider></QueryClientProvider>);
  await waitFor(() => { expect(client.getQueryCache().findAll({ queryKey: keys.planets })[0]?.isActive()).toBe(true); });
  await act(async () => {
    await Promise.all([client.invalidateQueries({ queryKey: keys.planet }), client.invalidateQueries({ queryKey: keys.planets })]);
  });
  expect(http.mock.calls.map(([url]) => new URL(address(url), 'http://game').pathname)).toEqual(['/api/planets']);
  view.unmount();
  client.clear();
});
