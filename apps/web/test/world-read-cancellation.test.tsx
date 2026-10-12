import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
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
