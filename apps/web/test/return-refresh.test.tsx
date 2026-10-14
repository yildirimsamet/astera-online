import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys, useTraffic } from '../src/api/queries.js';
import { createQueryClient } from '../src/api/queryClient.js';
import { RESUME_RESYNC_MS, useEventStream } from '../src/session/useEventStream.js';

/**
 * COMING BACK IS ONE REFRESH, AND ONLY WHEN SOMETHING COULD HAVE BEEN MISSED.
 * Resource analysis 2026-10-13.
 *
 * Production saw 332 whole-client refresh bursts in 23 minutes — 27% of every
 * request — and at least ~150 of them had no server event behind them: `focus`
 * (alt-tab on a visible page), a short app switch, a plain `pageshow`. Each one
 * also ran React Query's own focus refetch next to the resync, so the same reads
 * went out twice (694 duplicates). While the page is visible the stream is live and
 * nothing can be missed; a short hide is covered by the stream and the polls; only
 * a long hide, a back-forward restore or a network return needs the catch-up pass.
 */
const emptyTraffic = { contacts: [], interceptions: [], interceptionImpacts: [] };
const urlOf = (url: string | URL | Request): string =>
  typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
});
afterEach(() => {
  Reflect.deleteProperty(document, 'visibilityState');
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function mountTraffic() {
  // Real answers take time; an instant fake hides a second pass queued behind the first.
  const http = vi.fn(async (_url: string | URL | Request) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return new Response(JSON.stringify(emptyTraffic), { headers: { 'content-type': 'application/json' } });
  });
  const api = new Api({ fetch: http });
  vi.spyOn(api, 'stream').mockImplementation((_onEvent, signal, onOpen) => {
    onOpen?.();
    return new Promise(resolve => { signal.addEventListener('abort', () => { resolve(); }, { once: true }); });
  });
  const client = createQueryClient();
  client.setQueryData(keys.traffic, emptyTraffic);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
  const view = renderHook(() => { useTraffic(); useEventStream(true); }, { wrapper: Wrapper });
  // The first open's catch-up pass belongs to mounting, not to coming back.
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
  http.mockClear();
  const traffic = () => http.mock.calls.filter(([url]) => urlOf(url) === '/api/galaxy/traffic').length;
  const visibility = async (state: 'hidden' | 'visible') => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
    await act(async () => {
      // Browsers fire it at the document with bubbles=true; React Query listens on window.
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
      await vi.advanceTimersByTimeAsync(0);
    });
  };
  const done = () => { view.unmount(); client.clear(); };
  return { http, traffic, visibility, done };
}

it('does not refetch when a visible page regains focus', async () => {
  const f = await mountTraffic();
  await act(async () => {
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(f.http).not.toHaveBeenCalled();
  f.done();
});

it('does not refetch everything after a short app switch', async () => {
  const f = await mountTraffic();
  await f.visibility('hidden');
  // Long enough for traffic to be stale, shorter than the resume threshold.
  await act(async () => { await vi.advanceTimersByTimeAsync(6_000); });
  await f.visibility('visible');
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  expect(f.http).not.toHaveBeenCalled();
  f.done();
});

it('refreshes once, not twice, after a long hide', async () => {
  const f = await mountTraffic();
  await f.visibility('hidden');
  await act(async () => { await vi.advanceTimersByTimeAsync(RESUME_RESYNC_MS + 1_000); });
  await f.visibility('visible');
  await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
  expect(f.traffic()).toBe(1);
  f.done();
});

it('refreshes on a back-forward restore but not on an ordinary pageshow', async () => {
  const f = await mountTraffic();
  await act(async () => {
    window.dispatchEvent(new Event('pageshow'));
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(f.http).not.toHaveBeenCalled();
  const restored = new Event('pageshow');
  Object.defineProperty(restored, 'persisted', { value: true });
  await act(async () => {
    window.dispatchEvent(restored);
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(f.traffic()).toBe(1);
  f.done();
});
