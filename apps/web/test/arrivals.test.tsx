import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { keys } from '../src/api/queries.js';
import { useArrivals } from '../src/session/useArrivals.js';

/**
 * NOTHING MAY SIT ON ITS TARGET DOING NOTHING.
 *
 * Every craft on the disc is drawn by interpolating between two timestamps, and
 * that interpolation CLAMPS at the end of the flight. While a craft is flying that
 * is exactly right; the instant it arrives it is exactly wrong — the craft does not
 * turn for home, does not shrink to its survivors and does not disappear. It stops,
 * on top of whatever it flew at, and stays there until the list it came from is
 * fetched again.
 *
 * "Again" used to mean an event-stream message, a window focus, or a poll, and the
 * polls were tens of seconds. A drill really could hang over a rock with its work
 * finished. The reasonable conclusion a player draws from that is that the game is
 * stuck, and the owner drew it.
 *
 * D53 put a galaxy-wide broadcast under all of it, which shortens the fallback but
 * does not replace this: a broadcast says something happened, and this knows WHEN
 * it is going to.
 *
 * The client already knows every arrival instant — the whole rendering model is
 * built on them — so there is nothing to poll for. One timer, fired when the
 * soonest craft lands.
 */

const wrapper = (client: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

describe('refetching when something lands', () => {
  let client: QueryClient;
  /** Which keys were asked to refetch, in order. Recorded rather than spied on, so
   *  the assertion does not depend on TanStack's overloaded signature. */
  let asked: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    asked = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.invalidateQueries = (filters?: { queryKey?: readonly unknown[] }) => {
      asked.push(String(filters?.queryKey?.[0]));
      return Promise.resolve();
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const refetched = (): string[] => asked;

  const inMinutes = (n: number): Date => new Date(Date.now() + n * 60_000);

  it('refetches the lists a landing changes, once the craft has landed', () => {
    renderHook(() => { useArrivals([inMinutes(2)]); }, { wrapper: wrapper(client) });

    // Nothing yet: the craft is still in the air.
    vi.advanceTimersByTime(60_000);
    expect(refetched()).toEqual([]);

    vi.advanceTimersByTime(70_000);
    expect(refetched()).toEqual(
      expect.arrayContaining([keys.pending[0], keys.mining[0], keys.traffic[0]]),
    );
  });

  /**
   * ONE TIMER, FOR THE SOONEST. A busy galaxy has dozens of contacts in the air and
   * arming a timeout for each would be dozens of timers rewritten on every refetch.
   * Refetching re-runs the hook with the next arrival, so the chain continues.
   */
  it('waits for the soonest arrival, not the first in the list', () => {
    renderHook(
      () => { useArrivals([inMinutes(30), inMinutes(1), inMinutes(9)]); },
      { wrapper: wrapper(client) },
    );

    vi.advanceTimersByTime(70_000);
    expect(refetched().length).toBeGreaterThan(0);
  });

  /**
   * A BEAT PAST THE ARRIVAL, NOT EXACTLY ON IT. The event that resolves a flight is
   * scheduled for the same instant on the server; a refetch that wins that race
   * reads the world one moment before it changes, which is the stale render this
   * hook exists to prevent, reached by another route.
   */
  it('does not fire before the arrival instant', () => {
    renderHook(() => { useArrivals([inMinutes(1)]); }, { wrapper: wrapper(client) });
    vi.advanceTimersByTime(60_000);
    expect(refetched()).toEqual([]);
    vi.advanceTimersByTime(2_000);
    expect(refetched().length).toBeGreaterThan(0);
  });

  it('ignores arrivals that have already happened', () => {
    renderHook(
      () => { useArrivals([new Date(Date.now() - 60_000)]); },
      { wrapper: wrapper(client) },
    );
    vi.advanceTimersByTime(10 * 60_000);
    expect(refetched()).toEqual([]);
  });

  /** Nulls arrive from a mining run that has not turned for home yet. */
  it('tolerates an empty list and missing instants', () => {
    expect(() => {
      renderHook(() => { useArrivals([]); }, { wrapper: wrapper(client) });
      renderHook(() => { useArrivals([null, undefined]); }, { wrapper: wrapper(client) });
      vi.advanceTimersByTime(10 * 60_000);
    }).not.toThrow();
    expect(refetched()).toEqual([]);
  });

  /** An invalid date must not arm a timer that fires immediately, forever. */
  it('ignores an unparseable instant', () => {
    renderHook(
      () => { useArrivals([new Date(Number.NaN)]); },
      { wrapper: wrapper(client) },
    );
    vi.advanceTimersByTime(10 * 60_000);
    expect(refetched()).toEqual([]);
  });

  /** Unmounting must take its timer with it — a closed screen refetches nothing. */
  it('clears its timer when the screen goes away', () => {
    const { unmount } = renderHook(
      () => { useArrivals([inMinutes(1)]); },
      { wrapper: wrapper(client) },
    );
    unmount();
    vi.advanceTimersByTime(10 * 60_000);
    expect(refetched()).toEqual([]);
  });

  /**
   * The array is rebuilt on every render, so depending on it directly would re-arm
   * the timer on every frame and never fire. The hook depends on the numeric
   * instant instead, and this is what proves it.
   */
  it('does not re-arm on a re-render with the same arrivals', () => {
    const at = inMinutes(1);
    const { rerender } = renderHook(
      () => { useArrivals([new Date(at)]); },
      { wrapper: wrapper(client) },
    );
    for (let i = 0; i < 20; i++) rerender();
    // Stopped just past the instant and before the chase's first follow-up, so this
    // counts arming and nothing else. Fired one round, not twenty. Counted by how
    // many times one key was asked for, so adding a key to the round cannot break it.
    vi.advanceTimersByTime(60_500);
    expect(refetched().filter((key) => key === keys.pending[0])).toHaveLength(1);
  });

  /**
   * THE OUTCOME OF YOUR OWN RAID IS IN THIS ROUND. D45.
   *
   * It was not. The round refetched the planet, the map and the three craft lists
   * and left out the two that say what actually happened — so an attacker watching
   * their own bombardment land got a refreshed world with no report in it, and no
   * notification either. Both are what the player is waiting for at that instant.
   */
  it('asks for the outcome, not only for the world', () => {
    renderHook(() => { useArrivals([inMinutes(1)]); }, { wrapper: wrapper(client) });
    vi.advanceTimersByTime(62_000);
    expect(refetched()).toEqual(
      expect.arrayContaining([keys.reports[0], keys.notifications[0]]),
    );
  });

  /**
   * THE CHAIN CONTINUES WITHOUT WAITING FOR THE DATA TO CHANGE.
   *
   * The next instant is normally reached by a refetch changing the payload — but a
   * refetch that reads back exactly what it had returns the same object (React
   * Query's structural sharing), nothing re-renders, and no further timer is armed.
   * That is the NORMAL case for a raid: the refetch a second after `arriveAt` finds
   * the mission still in flight, because the engagement is a real ten-second window
   * and nothing has been decided yet. Without a self re-arm, the settlement instant
   * ten seconds later would never be armed at all and the attacker would sit on a
   * stale world until a poll or a focus event rescued them.
   */
  it('arms the next instant itself after firing', () => {
    const arriveAt = inMinutes(1);
    const settledAt = new Date(arriveAt.getTime() + 10_000);
    renderHook(
      () => { useArrivals([arriveAt, settledAt]); },
      { wrapper: wrapper(client) },
    );

    vi.advanceTimersByTime(60_500);
    expect(refetched().filter((key) => key === keys.pending[0])).toHaveLength(1);

    // The list handed to the hook never changed; only the clock did.
    vi.advanceTimersByTime(10_000);
    expect(refetched().filter((key) => key === keys.pending[0])).toHaveLength(2);
  });

  /**
   * AND THEN IT KEEPS ASKING UNTIL THE WORLD HAS MOVED ON. D52.
   *
   * The one-shot fired at the last instant and gave up, and the case it gave up on
   * is the common one: the event that resolves a raid is scheduled for that same
   * instant, the worker picks it up on its next tick, and a refetch that lands first
   * reads back a mission that is still `in_flight`. Structural sharing then returns
   * the same object, nothing re-renders, this effect does not re-run — and the
   * squadron hangs over a world it has finished bombarding until an unrelated poll
   * rescues it. The owner's words: "boş boş bekliyorlar".
   *
   * It is a chase, not a poll: it is bounded, and a payload that actually changes
   * re-runs the effect and cancels it.
   */
  it('keeps asking after the last instant until the payload changes', () => {
    renderHook(() => { useArrivals([inMinutes(1)]); }, { wrapper: wrapper(client) });

    vi.advanceTimersByTime(60_500);
    expect(refetched().filter((key) => key === keys.pending[0])).toHaveLength(1);

    // Three seconds is several worker ticks; the chase must have asked again.
    vi.advanceTimersByTime(3_000);
    const chased = refetched().filter((key) => key === keys.pending[0]).length;
    expect(chased).toBeGreaterThan(1);
  });

  it('gives up chasing rather than turning into a poll', () => {
    renderHook(() => { useArrivals([inMinutes(1)]); }, { wrapper: wrapper(client) });
    vi.advanceTimersByTime(60_500 + 10 * 60_000);
    // Bounded: a payload that never changes must not be asked for forever.
    expect(refetched().filter((key) => key === keys.pending[0]).length).toBeLessThan(20);
  });
});
