import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys, useTraffic } from '../src/api/queries.js';
import { useEventStream } from '../src/session/useEventStream.js';

const emptyTraffic = { contacts: [], interceptions: [], interceptionImpacts: [] };

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

async function mountTraffic(delayMs: number) {
  let fire: (kind: string) => void = () => undefined;
  let inFlight = 0;
  let peak = 0;
  const signals: (AbortSignal | null | undefined)[] = [];
  const http = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    signals.push(init?.signal);
    inFlight++;
    peak = Math.max(peak, inFlight);
    // Keep counting work even if a query cancels: an origin can already be
    // executing that HTTP request. Avoiding the redundant request is the fix.
    await new Promise(resolve => setTimeout(resolve, delayMs));
    inFlight--;
    return new Response(JSON.stringify(emptyTraffic), {
      headers: { 'content-type': 'application/json' },
    });
  });
  const api = new Api({ fetch: http });
  vi.spyOn(api, 'stream').mockImplementation((onEvent, signal, onOpen) => {
    fire = onEvent;
    onOpen?.();
    return new Promise(resolve => { signal.addEventListener('abort', () => { resolve(); }, { once: true }); });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData(keys.traffic, emptyTraffic);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
  const view = renderHook(() => { useTraffic(); useEventStream(true); }, { wrapper: Wrapper });
  await act(async () => { await vi.advanceTimersByTimeAsync(delayMs + 1); });
  http.mockClear();
  signals.length = 0;
  peak = 0;
  return { view, client, http, signals, fire: (kind: string) => { act(() => { fire(kind); }); }, peak: () => peak };
}

it('reads shard traffic once after the consistency window rather than at 250 and 500 ms', async () => {
  const f = await mountTraffic(20);
  f.fire('shard:launch');
  f.fire('shard:mining');
  await act(async () => { await vi.advanceTimersByTimeAsync(499); });
  expect(f.http).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
  expect(f.http.mock.calls.filter(([url]) =>
    (typeof url === 'string' ? url : url instanceof URL ? url.href : url.url) === '/api/galaxy/traffic')).toHaveLength(1);
  f.view.unmount();
  f.client.clear();
});

it('joins a slow read and performs one fresh follow-up without overlapping origin requests', async () => {
  const f = await mountTraffic(1_000);
  f.fire('private:strategic-sight');
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  for (let n = 0; n < 8; n++) f.fire('private:strategic-sight');
  await act(async () => { await vi.advanceTimersByTimeAsync(899); });
  expect(f.http).toHaveBeenCalledTimes(1);
  expect(f.peak()).toBe(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1_500); });
  expect(f.http).toHaveBeenCalledTimes(2);
  expect(f.peak()).toBe(1);
  expect(f.signals.every(signal => signal instanceof AbortSignal && !signal.aborted)).toBe(true);
  f.view.unmount();
  f.client.clear();
});
