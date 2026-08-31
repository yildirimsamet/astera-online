import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import {
  RECONNECT_RESYNC_MAX_MS,
  STRATEGIC_SIGHT_CONSISTENCY_MS,
  useEventStream,
} from '../src/session/useEventStream.js';
import { COALESCE_MS } from '../src/session/shardEvents.js';

/**
 * TWO FAMILIES ON ONE STREAM, AND THEY MUST NOT COST THE SAME. D53.
 *
 * A PLAYER event happened to this commander — a battle resolving, a fleet inbound
 * — and almost anything can have moved, so it refreshes everything at once.
 *
 * A SHARD event happened to somebody ELSE in the same galaxy. It is the half no
 * event could ever announce before, and it is also the half that arrives fifty
 * times in a busy minute. Refreshing everything on each one would turn the feature
 * that makes the disc live into the thing that makes it expensive.
 */

let onEvent: ((kind: string) => void) | null = null;
/**
 * Held so a test can close the socket by hand.
 *
 * A real stream stays open until something breaks it; the fake has to be able to
 * break on demand, because half of what this file now tests is what happens
 * AFTER it does.
 */
let closeSocket: (() => void) | null = null;

const fakeApi = (): Api =>
  ({
    stream: (handler: (kind: string) => void, _signal: AbortSignal, onOpen?: () => void) => {
      onEvent = handler;
      // Opens immediately, as a working connection does.
      onOpen?.();
      return new Promise<void>((resolve) => {
        closeSocket = resolve;
      });
    },
  }) as unknown as Api;

const wrapper = (client: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <ApiProvider api={fakeApi()}>{children}</ApiProvider>
      </QueryClientProvider>
    );
  };

describe('the event stream', () => {
  let client: QueryClient;
  /** Which keys were asked to refetch, in order. */
  let asked: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    onEvent = null;
    closeSocket = null;
    asked = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.invalidateQueries = (filters?: { queryKey?: readonly unknown[] }) => {
      asked.push(String(filters?.queryKey?.[0]));
      return Promise.resolve();
    };
  });

  afterEach(() => {
    Reflect.deleteProperty(document, 'visibilityState');
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const mount = (onRollover?: () => void) => renderHook(() => {
    useEventStream(true, onRollover);
  }, { wrapper: wrapper(client) });

  /** Start an assertion after the mandatory first-open catch-up has completed. */
  const mountCaughtUp = (onRollover?: () => void) => {
    const view = mount(onRollover);
    asked = [];
    return view;
  };

  const fire = (kind: string): void => {
    act(() => {
      onEvent?.(kind);
    });
  };

  it('refreshes everything when something happens to you', () => {
    mountCaughtUp();
    fire('raided');
    // Every read a resolved event can change, immediately and with no window.
    expect(asked).toContain('planet');
    expect(asked).toContain('reports');
    expect(asked).toContain('notifications');
    expect(asked).toContain('traffic');
    expect(asked.length).toBeGreaterThan(6);
  });

  it('puts a returned probe onto both the Intel screen and the galaxy immediately', () => {
    mountCaughtUp();
    fire('probe_report');
    expect(asked).toContain('intel');
    expect(asked).toContain('galaxy');
    expect(asked).toContain('notifications');
  });

  it('refreshes only announcements immediately when an operator publishes', () => {
    mountCaughtUp();
    fire('global:announcement');
    expect(asked).toEqual(['announcements']);
  });

  it('rechecks strategic sight after replica caches have observed the interception', () => {
    mountCaughtUp();
    fire('private:strategic-sight');
    expect(asked).toEqual(['traffic']);

    act(() => {
      vi.advanceTimersByTime(STRATEGIC_SIGHT_CONSISTENCY_MS);
    });
    expect(asked).toEqual(['traffic', 'traffic']);
  });

  /**
   * THE ONE THAT KEEPS A LIVENESS FEATURE FROM BECOMING A LOAD PROBLEM.
   *
   * A neighbour launching changes exactly one list. If a shard event took the
   * blanket path, three hundred clients would each refetch the whole live set — including
   * `/api/galaxy`, which carries a telescope reading per watched world — every
   * time anybody in the galaxy pressed launch.
   */
  it('reads one list for a neighbour launching, not eight', () => {
    mountCaughtUp();
    fire('shard:launch');
    // Nothing yet: shard events are gathered before they are acted on.
    expect(asked).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(COALESCE_MS);
    });
    expect(asked).toEqual(['traffic']);
  });

  it('rechecks traffic after replica caches observe a shard launch', () => {
    mountCaughtUp();
    fire('shard:launch');

    act(() => {
      vi.advanceTimersByTime(COALESCE_MS);
    });
    expect(asked).toEqual(['traffic']);

    act(() => {
      vi.advanceTimersByTime(STRATEGIC_SIGHT_CONSISTENCY_MS - COALESCE_MS);
    });
    expect(asked).toEqual(['traffic', 'traffic']);
  });

  it('collapses a burst from a busy galaxy into one pass', () => {
    mountCaughtUp();
    for (let i = 0; i < 6; i += 1) fire('shard:launch');
    fire('shard:arrival');

    act(() => {
      vi.advanceTimersByTime(COALESCE_MS);
    });
    // Seven events, two lists, each read once.
    expect(asked.sort()).toEqual(['mining', 'traffic']);
  });

  /**
   * A player event must not be delayed by the coalescing window. A battle
   * resolving is the thing the player is actually waiting for, and a quarter of a
   * second is a quarter of a second too many when the answer already exists.
   */
  it('never puts a player event behind the shard window', () => {
    mountCaughtUp();
    fire('shard:launch');
    fire('raided');
    // The raid is already through; only the launch is still waiting.
    expect(asked).toContain('reports');
    expect(asked).not.toEqual([]);
  });

  it('moves the session at rollover instead of refetching a vanished world', () => {
    const onRollover = vi.fn();
    mountCaughtUp(onRollover);
    fire('shard:rollover');
    expect(onRollover).toHaveBeenCalledOnce();
    expect(asked).toEqual([]);
  });

  it('resyncs immediately when a suspended page is shown again', () => {
    mountCaughtUp();
    act(() => {
      window.dispatchEvent(new Event('pageshow'));
      vi.advanceTimersByTime(0);
    });
    expect(asked).toContain('traffic');
    expect(asked).toContain('pending');
    expect(asked).toContain('galaxy');
  });

  it('coalesces visible lifecycle edges and ignores them while hidden', () => {
    mountCaughtUp();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('online'));
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(0);
    });
    expect(asked).toEqual([]);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('pageshow'));
      vi.advanceTimersByTime(0);
    });
    expect(asked.filter((key) => key === 'planet')).toHaveLength(1);
    expect(asked.filter((key) => key === 'traffic')).toHaveLength(1);
    expect(asked.filter((key) => key === 'galaxy')).toHaveLength(1);
  });

  it('removes lifecycle listeners when the galaxy view unmounts', () => {
    const view = mountCaughtUp();
    view.unmount();
    act(() => {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('pageshow'));
      vi.advanceTimersByTime(0);
    });
    expect(asked).toEqual([]);
  });

  it('rechecks a new world after cross-replica caches have observed the commit', () => {
    mountCaughtUp();
    fire('shard:world');
    act(() => { vi.advanceTimersByTime(COALESCE_MS); });
    expect(asked.filter((key) => key === 'galaxy')).toHaveLength(1);

    act(() => { vi.advanceTimersByTime(1500 - COALESCE_MS); });
    expect(asked.filter((key) => key === 'galaxy')).toHaveLength(2);
    expect(asked.filter((key) => key === 'leaderboard')).toHaveLength(2);
  });

  /* ── coming back after the channel was down ────────────────── */

  /**
   * THE STREAM HAS NO REPLAY, SO A RECONNECTION IS A RESYNC.
   *
   * Every event on this channel is fire-and-forget: no cursor, no backlog, no ids.
   * Whatever happened while the socket was down — a raid resolving, a neighbour
   * launching, a world growing — was simply never delivered, and nothing in the
   * payloads themselves says so.
   *
   * Before this, the only thing that closed the gap was the sixty-second safety-net
   * poll. A proxy dropping the socket, a deploy, or a phone waking from sleep left
   * the disc showing a world up to a minute out of date, with craft parked on their
   * destinations, and nothing on screen admitting it.
   */
  it('closes the initial query/subscription race with a first-open catch-up', () => {
    mount();
    expect(asked, 'the first socket open did not reconcile its query snapshots').toContain('planet');
    expect(asked).toContain('traffic');
    expect(asked).toContain('pending');
    expect(asked).toContain('galaxy');
    expect(asked.length).toBeGreaterThan(6);
  });

  /** Drop the socket and let the reconnect loop's backoff run out. */
  const reconnect = async (): Promise<void> => {
    await act(async () => {
      closeSocket?.();
      // Longer than the capped backoff, so the loop has certainly reopened.
      await vi.advanceTimersByTimeAsync(60_000);
    });
  };

  it('re-reads the whole world when the socket comes back', async () => {
    mountCaughtUp();
    expect(asked).toEqual([]);

    await reconnect();

    expect(asked, 'nothing was re-read after the channel came back').toContain('traffic');
    expect(asked).toContain('pending');
    expect(asked).toContain('planet');
    expect(asked).toContain('mining');
    expect(asked).toContain('galaxy');
  });

  /**
   * ONCE PER RECONNECTION — not once per event, and not on a timer.
   *
   * The cost of a resync is the whole read set, so it has to be tied to the thing
   * that actually loses events: the socket going down and coming back.
   */
  it('resyncs again on a second reconnection', async () => {
    mountCaughtUp();
    await reconnect();
    const first = asked.length;
    expect(first).toBeGreaterThan(6);

    asked = [];
    await reconnect();
    expect(asked).toHaveLength(first);
  });

  it('jitter-coalesces repeated reconnects into one catch-up pass', async () => {
    vi.spyOn(Math, 'random')
      // First reconnect backoff: reopen immediately.
      .mockReturnValueOnce(0)
      // Keep the expensive catch-up pass near the end of its jitter window.
      .mockReturnValueOnce(0.99)
      // A second short close also reopens immediately.
      .mockReturnValue(0);
    mountCaughtUp();

    await act(async () => {
      closeSocket?.();
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(asked, 'catch-up ignored its jitter window').toEqual([]);

    await act(async () => {
      closeSocket?.();
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(asked, 'a flapping socket started a duplicate catch-up').toEqual([]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECONNECT_RESYNC_MAX_MS);
    });
    expect(asked.filter((key) => key === 'planet')).toHaveLength(1);
    expect(asked.filter((key) => key === 'pending')).toHaveLength(1);
    expect(asked.filter((key) => key === 'traffic')).toHaveLength(1);
  });

  /** An unmounted tab must not flush a window it armed on the way out. */
  it('drops a pending shard flush on unmount', () => {
    const view = mountCaughtUp();
    fire('shard:launch');
    view.unmount();

    act(() => {
      vi.advanceTimersByTime(COALESCE_MS * 4);
    });
    expect(asked).toEqual([]);
  });
});
