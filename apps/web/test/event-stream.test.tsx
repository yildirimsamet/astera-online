import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { useEventStream } from '../src/session/useEventStream.js';
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

const fakeApi = (): Api =>
  ({
    stream: (handler: (kind: string) => void) => {
      onEvent = handler;
      // Never resolves: a real stream stays open, and resolving would send the
      // hook round its reconnect loop and into a backoff timer.
      return new Promise<void>(() => undefined);
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

  const mount = () => renderHook(() => { useEventStream(true); }, { wrapper: wrapper(client) });

  const fire = (kind: string): void => {
    act(() => {
      onEvent?.(kind);
    });
  };

  it('refreshes everything when something happens to you', () => {
    mount();
    fire('raided');
    // Every read a resolved event can change, immediately and with no window.
    expect(asked).toContain('planet');
    expect(asked).toContain('reports');
    expect(asked).toContain('notifications');
    expect(asked).toContain('traffic');
    expect(asked.length).toBeGreaterThan(6);
  });

  /**
   * THE ONE THAT KEEPS A LIVENESS FEATURE FROM BECOMING A LOAD PROBLEM.
   *
   * A neighbour launching changes exactly one list. If a shard event took the
   * blanket path, fifty clients would each refetch eight payloads — including
   * `/api/galaxy`, which carries a telescope reading per watched world — every
   * time anybody in the galaxy pressed launch.
   */
  it('reads one list for a neighbour launching, not eight', () => {
    mount();
    fire('shard:launch');
    // Nothing yet: shard events are gathered before they are acted on.
    expect(asked).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(COALESCE_MS);
    });
    expect(asked).toEqual(['traffic']);
  });

  it('collapses a burst from a busy galaxy into one pass', () => {
    mount();
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
    mount();
    fire('shard:launch');
    fire('raided');
    // The raid is already through; only the launch is still waiting.
    expect(asked).toContain('reports');
    expect(asked).not.toEqual([]);
  });

  /** An unmounted tab must not flush a window it armed on the way out. */
  it('drops a pending shard flush on unmount', () => {
    const view = mount();
    fire('shard:launch');
    view.unmount();

    act(() => {
      vi.advanceTimersByTime(COALESCE_MS * 4);
    });
    expect(asked).toEqual([]);
  });
});
