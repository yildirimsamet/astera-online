import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { coalesceLatest, CHAT_READ_COALESCE_MS } from '../src/api/coalesceLatest.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { useMarkChatRead } from '../src/api/queries.js';

/**
 * A READ MARKER, ONE WRITE PER FEW SECONDS. Scaling plan F1.8 (Q16).
 *
 * A busy chat marked every arriving message. The cursor only moves forward, so the
 * newest mark carries all the others: the first goes at once, the rest of a burst
 * join one trailing mark with the newest id. The badge still clears on the spot.
 */
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('coalesceLatest', () => {
  it('sends the first call at once and the rest of the window as one call with the newest argument', async () => {
    const send = vi.fn((id: string) => Promise.resolve(`sent ${id}`));
    const mark = coalesceLatest(send, 2_500);
    await expect(mark('a')).resolves.toBe('sent a');
    const joined = [mark('b'), mark('c')];
    expect(mark.queued()).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_499);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(Promise.all(joined)).resolves.toEqual(['sent c', 'sent c']);
    expect(send.mock.calls).toEqual([['a'], ['c']]);
    expect(mark.queued()).toBe(false);
  });

  it('sends at once again after a quiet window', async () => {
    const send = vi.fn((id: string) => Promise.resolve(id));
    const mark = coalesceLatest(send, 2_500);
    await mark('a');
    await vi.advanceTimersByTimeAsync(2_500);
    await mark('b');
    expect(send.mock.calls).toEqual([['a'], ['b']]);
  });

  it('fails every caller that joined a failed send, and the next call sends again', async () => {
    const send = vi.fn((id: string) => id === 'b' ? Promise.reject(new Error('offline')) : Promise.resolve(id));
    const mark = coalesceLatest(send, 2_500);
    await mark('a');
    const joined = mark('b');
    const failed = expect(joined).rejects.toThrow('offline');
    await vi.advanceTimersByTimeAsync(2_500);
    await failed;
    await vi.advanceTimersByTimeAsync(2_500);
    await expect(mark('c')).resolves.toBe('c');
  });
});

it('clears the general unread count on every mark and writes a burst once', async () => {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const at = new Date('2026-10-31T10:00:00Z');
  const markChatRead = vi.spyOn(api, 'markChatRead').mockResolvedValue({ ok: true, readAt: at });
  vi.spyOn(api, 'chatUnread').mockResolvedValue({ count: 0 });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>
  );
  const { result } = renderHook(() => useMarkChatRead('en'), { wrapper });

  client.setQueryData(keys.chatUnreadFor('en'), { count: 2 });
  await act(async () => { result.current.mutate('one'); await vi.advanceTimersByTimeAsync(0); });
  expect(client.getQueryData(keys.chatUnreadFor('en'))).toEqual({ count: 0 });

  client.setQueryData(keys.chatUnreadFor('en'), { count: 1 });
  await act(async () => { result.current.mutate('two'); await vi.advanceTimersByTimeAsync(0); });
  expect(client.getQueryData(keys.chatUnreadFor('en'))).toEqual({ count: 0 });
  await act(async () => { result.current.mutate('three'); await vi.advanceTimersByTimeAsync(0); });
  expect(markChatRead.mock.calls).toEqual([['en', 'one']]);

  await act(async () => { await vi.advanceTimersByTimeAsync(CHAT_READ_COALESCE_MS); });
  expect(markChatRead.mock.calls).toEqual([['en', 'one'], ['en', 'three']]);
});
