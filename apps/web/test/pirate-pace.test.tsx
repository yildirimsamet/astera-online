import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { usePirates } from '../src/api/queries.js';
import { createQueryClient } from '../src/api/queryClient.js';

/**
 * THE RENDEZVOUS TABLE IS READ AT THE TRAFFIC PACE ONLY WHILE SOMEBODY IS AIMING.
 * Resource analysis 2026-10-13.
 *
 * The list sat mounted on the galaxy screen and was solved every five seconds for
 * every commander: 10% of all production requests, p95 one second. The five-second
 * pace exists so a launch quote does not drift from the orbit (D183), which only
 * matters while a pirate's focus or its launch sheet is open. The tally on the disc
 * is kept current by `shard:pirate` events and a one-minute net.
 */
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

function mount(live: boolean) {
  const http = vi.fn((_url: string | URL | Request) => Promise.resolve(new Response(JSON.stringify({ originPlanetId: 'capital', pirates: [] }), {
    headers: { 'content-type': 'application/json' },
  })));
  const client = createQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={new Api({ fetch: http })}>{children}</ApiProvider>
    </QueryClientProvider>
  );
  const view = renderHook(() => usePirates({ live }), { wrapper: Wrapper });
  return { http, done: () => { view.unmount(); client.clear(); } };
}

it('reads the lane once a minute while nobody is aiming at a pirate', async () => {
  const f = mount(false);
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(f.http).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
  expect(f.http).toHaveBeenCalledTimes(2);
  f.done();
});

it('reads the lane every five seconds while a pirate is being aimed at', async () => {
  const f = mount(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(20_500); });
  expect(f.http).toHaveBeenCalledTimes(5);
  f.done();
});
