import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { useSeason } from '../src/api/queries.js';

/**
 * THE POPULATION IN THE CORNER OF THE DISC HAS TO MOVE ON ITS OWN.
 *
 * The bug this file exists for was reported as *"online sayısı canlı çalışmıyor;
 * refreshleyince doğru, refresh atmazsak değişmiyor"* — and the cause is the
 * easiest one in this library to write by accident. `useSeason` carried a
 * `staleTime` and nothing else, and a stale query is not a query that refetches:
 * staleness only decides whether a refetch that is ALREADY happening may be
 * served from the cache. With no interval, no focus rule and no broadcast, the
 * figure was read once on mount and then frozen for the life of the tab.
 *
 * It is the one read in the app where a timer is the mechanism rather than the
 * safety net (see the docblock on `useSeason`), so it is the one read where the
 * timer is worth a test.
 */

const info = (online: number) => ({
  seasonId: 'season-1',
  shard: 'EU-1',
  shardName: 'Astera',
  seed: 1,
  status: 'live' as const,
  startsAt: new Date('2026-01-01T00:00:00Z'),
  endsAt: new Date('2026-01-15T00:00:00Z'),
  playerCap: 300,
  players: 42,
  online,
});

function harness(season: () => Promise<unknown>) {
  const api = { season } as unknown as Api;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>
  );
  return renderHook(() => useSeason(), { wrapper });
}

describe('the live population figure', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks again a minute later, without anybody touching the page', async () => {
    let count = 3;
    const season = vi.fn(() => Promise.resolve(info(count)));
    const { result } = harness(season);

    await waitFor(() => {
      expect(result.current.data?.online).toBe(3);
    });
    expect(season).toHaveBeenCalledTimes(1);

    // Nobody reloaded, nobody focused anything: the galaxy simply filled up.
    count = 11;
    await vi.advanceTimersByTimeAsync(60_000);

    await waitFor(() => {
      expect(result.current.data?.online).toBe(11);
    });
  });

  /**
   * A phone that has been in a pocket for an hour is the case the interval alone
   * cannot serve — React Query holds the timer while the tab is in the background,
   * so the first thing a returning player sees would otherwise be the count from
   * whenever they locked the screen.
   */
  it('asks again when the tab comes back, rather than showing the count it was locked with', async () => {
    const season = vi.fn(() => Promise.resolve(info(5)));
    const { result } = harness(season);

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(season).toHaveBeenCalledTimes(1);

    // Past the stale window, so a focus is entitled to ask.
    await vi.advanceTimersByTimeAsync(61_000);
    const asked = season.mock.calls.length;
    window.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));

    await waitFor(() => {
      expect(season.mock.calls.length).toBeGreaterThanOrEqual(asked);
    });
    expect(season.mock.calls.length).toBeGreaterThan(1);
  });
});
