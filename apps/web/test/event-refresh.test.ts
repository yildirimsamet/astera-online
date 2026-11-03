import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { cancelEventRefreshes, EVENT_REFRESH_GAP_MS, refreshForEvent } from '../src/api/eventRefresh.js';
import * as refresh from '../src/api/refreshQueries.js';

/**
 * ONE READ FOR A BURST OF EVENTS. Query plan, 2026-11-03.
 *
 * One production request in five repeated the same read within three seconds: a battle
 * sends several events, and each asked for everything again. An event's first refresh
 * still leaves at once. The rest of a burst share one read after a short gap, and that
 * read starts after the last of them, so none of them is lost.
 */
let client: QueryClient;
let spy: MockInstance<typeof refresh.refreshQueries>;
const reads = () => spy.mock.calls.map(([, filters]) => filters?.queryKey);

beforeEach(() => {
  vi.useFakeTimers();
  client = new QueryClient();
  spy = vi.spyOn(refresh, 'refreshQueries').mockResolvedValue(undefined);
});
afterEach(() => { vi.useRealTimers(); client.clear(); });

describe('refreshForEvent', () => {
  it('refreshes at once when nothing was asked for lately', () => {
    refreshForEvent(client, ['pending']);
    expect(reads()).toEqual([['pending']]);
  });

  it('holds a burst to one read at once and one after the gap', () => {
    refreshForEvent(client, ['pending']);
    for (let i = 0; i < 5; i += 1) {
      vi.advanceTimersByTime(100);
      refreshForEvent(client, ['pending']);
    }
    expect(reads()).toHaveLength(1);
    vi.advanceTimersByTime(EVENT_REFRESH_GAP_MS);
    expect(reads()).toEqual([['pending'], ['pending']]);
  });

  it('sends the following read after the last event of the burst was asked for', () => {
    refreshForEvent(client, ['pending']);
    vi.advanceTimersByTime(EVENT_REFRESH_GAP_MS - 1);
    refreshForEvent(client, ['pending']);
    expect(reads()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(reads()).toHaveLength(2);
  });

  it('adds nothing after a lone event', () => {
    refreshForEvent(client, ['pending']);
    vi.advanceTimersByTime(EVENT_REFRESH_GAP_MS * 4);
    expect(reads()).toHaveLength(1);
  });

  it('refreshes at once again when the gap has passed', () => {
    refreshForEvent(client, ['pending']);
    vi.advanceTimersByTime(EVENT_REFRESH_GAP_MS);
    refreshForEvent(client, ['pending']);
    expect(reads()).toHaveLength(2);
  });

  it('keeps each read to its own gap', () => {
    refreshForEvent(client, ['pending']);
    refreshForEvent(client, ['planets']);
    expect(reads()).toEqual([['pending'], ['planets']]);
  });

  it('keeps each session to its own gap', () => {
    const other = new QueryClient();
    refreshForEvent(client, ['pending']);
    refreshForEvent(other, ['pending']);
    expect(reads()).toHaveLength(2);
    other.clear();
  });

  it('can be called off, for a stream being taken down or a galaxy being left', () => {
    refreshForEvent(client, ['pending']);
    refreshForEvent(client, ['pending']);
    cancelEventRefreshes(client);
    vi.advanceTimersByTime(EVENT_REFRESH_GAP_MS * 2);
    expect(reads()).toHaveLength(1);
    refreshForEvent(client, ['pending']);
    expect(reads()).toHaveLength(2);
  });

  it('stays short enough that a player never reads it as a late answer', () => {
    expect(EVENT_REFRESH_GAP_MS).toBeLessThanOrEqual(2_000);
  });
});
