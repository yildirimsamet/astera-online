import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { upgradeCost } from '@blindspace/rules';
import type { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys, useCollect, useUpgrade } from '../src/api/queries.js';
import type { PlanetView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

/**
 * THE TAP, THE ANSWER, AND THE REFUSAL. D53.
 *
 * Construction is instant on payment, and the interface now says so on the frame
 * of the tap. Three things have to hold for that to be honest rather than a lie
 * with good timing, and all three are here: the prediction lands immediately, the
 * server's own answer replaces it, and a refusal puts back exactly what was there.
 *
 * The third is the one that would ship broken. A rollback that half-works leaves a
 * player holding resources they have already spent, and the next action they take
 * is refused for a reason the screen cannot explain.
 */

const start = (): PlanetView =>
  planetView(
    {
      buildings: { CORE: 5, REFINERY: 2, EXTRACTOR: 2, VAULT: 1, SHIPYARD: 1 },
      nextCosts: { REFINERY: upgradeCost(2) },
    },
    { alloy: 500_000, crystal: 500_000, alloyCap: 999_999, crystalCap: 999_999 },
  );

describe('a spend, before the server has answered', () => {
  let client: QueryClient;
  let upgrade: ReturnType<typeof vi.fn>;
  let collect: ReturnType<typeof vi.fn>;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={{ upgrade, collect } as unknown as Api}>{children}</ApiProvider>
    </QueryClientProvider>
  );

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    client.setQueryData(keys.planet, start());
    upgrade = vi.fn();
    collect = vi.fn();
  });

  const held = (): PlanetView => client.getQueryData<PlanetView>(keys.planet)!;

  it('shows the purchase on the tap, not a round trip later', async () => {
    // A request that never settles: the assertion is about what is on screen
    // WHILE it is in flight, which is the whole point.
    upgrade.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useUpgrade(), { wrapper });

    act(() => {
      result.current.mutate('REFINERY');
    });

    await waitFor(() => {
      expect(held().buildings.REFINERY).toBe(3);
    });
    expect(held().planet.alloy).toBe(500_000 - upgradeCost(2).alloy);
  });

  it('takes the server\'s own answer when it lands', async () => {
    const authoritative = planetView(
      { buildings: { CORE: 5, REFINERY: 3, EXTRACTOR: 2, VAULT: 1, SHIPYARD: 1 } },
      { alloy: 1234, crystal: 5678 },
    );
    upgrade.mockResolvedValue({ type: 'REFINERY', level: 3, alloy: 1234, crystal: 5678, planet: authoritative });

    const { result } = renderHook(() => useUpgrade(), { wrapper });
    act(() => {
      result.current.mutate('REFINERY');
    });

    await waitFor(() => {
      expect(held().planet.alloy).toBe(1234);
    });
    // Not the prediction's arithmetic — the server's. Every derived figure the
    // predictor deliberately left alone arrives here.
    expect(held()).toEqual(authoritative);
  });

  /**
   * THE ONE THAT WOULD SHIP BROKEN.
   *
   * A raid landing between the tap and the request emptying a vault is exactly the
   * case this exists for: the prediction spent resources the player turns out not
   * to have, and if the rollback is wrong they are left short with nothing on
   * screen explaining why.
   */
  it('puts everything back when the server refuses', async () => {
    const before = held();
    upgrade.mockRejectedValue(new Error('INSUFFICIENT_RESOURCES'));

    const { result } = renderHook(() => useUpgrade(), { wrapper });
    act(() => {
      result.current.mutate('REFINERY');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    /**
     * Every spent figure is back, and the level with it.
     *
     * Not a deep equality: what a rollback restores is the settled world, whose
     * works have moved forward by however long the request took. Asserting the
     * byte-identical pre-tap object would be asserting that production stopped
     * while the request was in flight, which is the opposite of the point.
     */
    expect(held().planet.alloy).toBe(before.planet.alloy);
    expect(held().planet.crystal).toBe(before.planet.crystal);
    expect(held().buildings).toEqual(before.buildings);
    expect(held().nextCosts).toEqual(before.nextCosts);
    expect(held().planet.bufferAlloy).toBeGreaterThanOrEqual(before.planet.bufferAlloy);
  });

  /** And the works go back into the works, not just the storage figure. */
  it('rolls a refused collect back on both piles', async () => {
    client.setQueryData(
      keys.planet,
      planetView({}, {
        alloy: 100,
        crystal: 50,
        alloyCap: 9999,
        crystalCap: 9999,
        bufferAlloy: 800,
        bufferCrystal: 400,
        // Above what the works hold, or `worksAt` correctly clamps them on the way
        // through and the test would be measuring the fixture rather than the code.
        bufferAlloyCap: 5000,
        bufferCrystalCap: 5000,
      }),
    );
    collect.mockRejectedValue(new Error('nope'));

    const { result } = renderHook(() => useCollect(), { wrapper });
    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    // Storage is back where it was, and the ore is still in the works rather than
    // gone from both piles — which is what a half-done rollback would look like.
    expect(held().planet.alloy).toBe(100);
    expect(held().planet.crystal).toBe(50);
    expect(held().planet.bufferAlloy).toBeCloseTo(800, 2);
    expect(held().planet.bufferCrystal).toBeCloseTo(400, 2);
  });

  /**
   * THE WORKS ARE PROJECTED, AND WRITING TO THE CACHE MOVES THEIR ANCHOR.
   *
   * `useProjected` shows the works as "what was last read, plus production since
   * `dataUpdatedAt`" — and `/api/planet` does not poll, so that anchor can be
   * minutes old by the time somebody taps something. An optimistic write re-anchors
   * it to NOW, so a payload carrying the old works figure makes the projection
   * restart from the older number: the meter visibly DROPS and is then corrected
   * when the server answers. Small on a new planet, hundreds of alloy on a
   * developed one, and exactly the "number that changes without a cause" the
   * projection docblock exists to prevent.
   *
   * The prediction therefore brings the works forward first. Measured here by
   * pretending the cache is five minutes old.
   */
  it('does not knock the works backwards when it writes', async () => {
    const view = planetView({ buildings: { CORE: 5, REFINERY: 2, EXTRACTOR: 2, VAULT: 1, SHIPYARD: 1 }, nextCosts: { REFINERY: upgradeCost(2) } }, {
      alloy: 500_000,
      crystal: 500_000,
      bufferAlloy: 0,
      bufferCrystal: 0,
      bufferAlloyCap: 100_000,
      bufferCrystalCap: 100_000,
      alloyPerHour: 1200,
      crystalPerHour: 600,
    });
    client.setQueryData(keys.planet, view);
    // Five minutes ago: 100 alloy and 50 crystal have accumulated since.
    const state = client.getQueryState(keys.planet);
    if (state) state.dataUpdatedAt = Date.now() - 5 * 60_000;

    upgrade.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useUpgrade(), { wrapper });
    act(() => {
      result.current.mutate('REFINERY');
    });

    await waitFor(() => {
      expect(held().buildings.REFINERY).toBe(3);
    });
    expect(held().planet.bufferAlloy).toBeCloseTo(100, 0);
    expect(held().planet.bufferCrystal).toBeCloseTo(50, 0);
  });

  /** And a rollback must not put the dip back on the way out. */
  it('rolls back to a world whose works are still up to date', async () => {
    const view = planetView({ buildings: { CORE: 5, REFINERY: 2, EXTRACTOR: 2, VAULT: 1, SHIPYARD: 1 }, nextCosts: { REFINERY: upgradeCost(2) } }, {
      alloy: 500_000,
      crystal: 500_000,
      bufferAlloy: 0,
      bufferCrystal: 0,
      bufferAlloyCap: 100_000,
      bufferCrystalCap: 100_000,
      alloyPerHour: 1200,
      crystalPerHour: 600,
    });
    client.setQueryData(keys.planet, view);
    const state = client.getQueryState(keys.planet);
    if (state) state.dataUpdatedAt = Date.now() - 5 * 60_000;

    upgrade.mockRejectedValue(new Error('INSUFFICIENT_RESOURCES'));
    const { result } = renderHook(() => useUpgrade(), { wrapper });
    act(() => {
      result.current.mutate('REFINERY');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    // The spend is undone; the production that really happened is not.
    expect(held().planet.alloy).toBe(500_000);
    expect(held().buildings.REFINERY).toBe(2);
    expect(held().planet.bufferAlloy).toBeCloseTo(100, 0);
  });

  /**
   * A PREDICTOR THAT DECLINES MUST CHANGE NOTHING AT ALL.
   *
   * Raising a structure already at its Command Core is refused by the server, so
   * the predictor returns null — and the screen must sit still until the refusal
   * arrives rather than showing a level that un-happens.
   */
  it('shows nothing at all when the prediction declines', async () => {
    client.setQueryData(
      keys.planet,
      planetView(
        {
          buildings: { CORE: 2, REFINERY: 2, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0 },
          nextCosts: { REFINERY: upgradeCost(2) },
        },
        { alloy: 500_000, crystal: 500_000 },
      ),
    );
    const before = held();
    upgrade.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useUpgrade(), { wrapper });
    act(() => {
      result.current.mutate('REFINERY');
    });

    await waitFor(() => {
      expect(upgrade).toHaveBeenCalled();
    });
    expect(held()).toEqual(before);
  });
});
