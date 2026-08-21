import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys, useLaunch, usePending } from '../src/api/queries.js';
import type { PendingThread, PlanetView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

/**
 * THE SQUADRON THAT APPEARED AND THEN BLINKED OUT.
 *
 * A launch answers with the authoritative planet AND the pending list, built inside
 * the launching transaction (D53), and both are written straight into the cache so
 * the fleet is on the disc on the frame the response lands.
 *
 * A read that was ALREADY IN THE AIR when the player tapped lands afterwards and
 * overwrites both with the world as it was before the launch. React Query cannot
 * know which is newer — it holds whichever response arrived last — so the craft the
 * player has just irreversibly committed disappears from the galaxy until the next
 * refetch, which is up to the sixty-second safety net away.
 *
 * It needs no network trouble to reproduce: `useArrivals` invalidates `pending` and
 * `planet` on every due arrival, so any galaxy with something landing has a read of
 * both in flight for a moment every time.
 *
 * The fix is the one `useOptimisticPlanet` already applied on the way IN —
 * `cancelQueries` before the write — and these hold it for the way out.
 */

const thread = (id: string): PendingThread => ({
  id,
  kind: 'fleet',
  targetName: 'Vega-3',
  minutesRemaining: 4,
  arriveAt: new Date('2026-04-01T12:04:00.000Z'),
  leg: 'outbound',
  fleet: { WASP: 8 },
  path: {
    from: { x: 0, y: 0, z: 0 },
    to: { x: 40, y: 0, z: 0 },
    departAt: new Date('2026-04-01T12:00:00.000Z'),
    arriveAt: new Date('2026-04-01T12:04:00.000Z'),
  },
});

describe('a launch racing a read that is already in the air', () => {
  let client: QueryClient;
  let launch: ReturnType<typeof vi.fn>;
  /** Resolves the `GET /api/session/pending` that was issued before the tap. */
  let answerPending: ((value: { pending: PendingThread[] }) => void) | null;
  let pendingCalls: number;

  const api = () =>
    ({
      launch,
      pending: () => {
        pendingCalls += 1;
        return new Promise<{ pending: PendingThread[] }>((resolve) => {
          answerPending = resolve;
        });
      },
    }) as unknown as Api;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api()}>{children}</ApiProvider>
    </QueryClientProvider>
  );

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    answerPending = null;
    pendingCalls = 0;
    launch = vi.fn();
  });

  const drawn = (): PendingThread[] =>
    client.getQueryData<{ pending: PendingThread[] }>(keys.pending)?.pending ?? [];

  it('keeps the fleet the launch answered with, whichever response lands last', async () => {
    const { result } = renderHook(
      () => ({ pending: usePending(), launch: useLaunch() }),
      { wrapper },
    );

    // A read of the pending list is outstanding, and it predates the tap.
    await waitFor(() => {
      expect(pendingCalls).toBe(1);
    });

    launch.mockResolvedValue({
      missionId: 'm1',
      arriveAt: new Date('2026-04-01T12:04:00.000Z'),
      exposureMinutes: 8,
      homeDefenceAfter: 2,
      pending: [thread('m1')],
      planet: planetView(),
    });

    act(() => {
      result.current.launch.mutate({ targetPlanetId: 'p2', fleet: { WASP: 8 } });
    });

    await waitFor(() => {
      expect(drawn()).toHaveLength(1);
    });

    /**
     * NOW THE STALE READ ARRIVES. It was issued before the fleet existed, so its
     * answer is an empty list — and before `cancelQueries` it was the last write to
     * the cache and won.
     */
    act(() => {
      answerPending?.({ pending: [] });
    });

    await waitFor(() => {
      expect(drawn(), 'the launched fleet was overwritten by an older read').toHaveLength(1);
    });
    expect(drawn()[0]?.id).toBe('m1');
  });

  /** And the same protection on the planet view the answer carries. */
  it('keeps the planet the launch answered with', async () => {
    renderHook(() => usePending(), { wrapper });
    await waitFor(() => {
      expect(pendingCalls).toBe(1);
    });

    const after = planetView({
      buildings: { CORE: 7, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0 },
    });
    launch.mockResolvedValue({
      missionId: 'm2',
      arriveAt: new Date('2026-04-01T12:04:00.000Z'),
      exposureMinutes: 8,
      homeDefenceAfter: 2,
      pending: [thread('m2')],
      planet: after,
    });

    const { result } = renderHook(() => useLaunch(), { wrapper });
    act(() => {
      result.current.mutate({ targetPlanetId: 'p2', fleet: { WASP: 8 } });
    });

    await waitFor(() => {
      expect(client.getQueryData<PlanetView>(keys.planet)?.buildings.CORE).toBe(7);
    });
  });
});
