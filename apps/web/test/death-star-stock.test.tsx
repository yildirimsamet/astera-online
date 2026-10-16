import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { useLaunchDeathStar, usePlanet } from '../src/api/queries.js';
import { planetSchema, type PlanetView, type PlanetsView } from '../src/api/schemas.js';
import { shareStructure } from '../src/api/structural.js';
import { useWorld, WorldProvider } from '../src/api/world.js';
import { resetClock } from '../src/lib/clock.js';
import { deathStarsOf, readyDeathStar } from '../src/lib/strategic.js';
import { planetView } from './fixtures.js';

/**
 * ÖLÜM YILDIZI STOKU, DÜNYALAR ARASINDA. Sahip sorusu, 2026-10-15: *"Bir ana gezegenden
 * sonra koloniye geçip bir tane oradan sonra tekrar ana gezegene geçip bir tane daha
 * fırlatmak istesem şarj stock stateleri doğru handle ediliyor mu?"*
 *
 * The fake API is the server's pad: each launch spends one READY weapon on the world it was
 * sent from and answers with that world's view, newer than anything cached.
 */

const epoch = new Date('2026-10-15T12:00:00Z').getTime();
const weapons = (worldId: string, count: number) => Array.from({ length: count }, (_, index) => ({
  id: `${worldId}-ds-${String(index)}`, status: 'READY' as const, readyAt: null, remainingSeconds: 0,
}));
const view = (id: string, ready: number, at: number): PlanetView => planetSchema.parse(planetView(
  { deathStars: weapons(id, ready) },
  { id, name: id, snapshotAt: new Date(at) },
));

describe('Death Star stock across launches and world switches', () => {
  let client: QueryClient;
  let api: Api;
  let pad: Map<string, number>;
  let tick: number;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>
    <ApiProvider api={api}><WorldProvider>{children}</WorldProvider></ApiProvider>
  </QueryClientProvider>;

  beforeEach(() => {
    localStorage.clear();
    resetClock();
    pad = new Map([['capital', 2], ['colony', 1]]);
    tick = epoch;
    const capital = view('capital', 2, tick);
    const colony = view('colony', 1, tick);
    const list: PlanetsView = { playerId: 'player-1', seasonId: 'season-1', capitalPlanetId: 'capital', planets: [capital, colony] };
    client = new QueryClient({ defaultOptions: { queries: { retry: false, structuralSharing: shareStructure }, mutations: { retry: false } } });
    client.setQueryData(keys.planets, list);
    client.setQueryData(keys.planetById('capital'), capital);
    client.setQueryData(keys.planetById('colony'), colony);
    api = new Api({ fetch: () => Promise.reject(new Error('unexpected fetch')) });
    api.launchDeathStar = vi.fn().mockImplementation((origin: string) => {
      const left = (pad.get(origin) ?? 0) - 1;
      if (left < 0) return Promise.reject(new Error('DEATH_STAR_NOT_READY'));
      pad.set(origin, left);
      tick += 1_000;
      return Promise.resolve({ missionId: `m-${String(tick)}`, arriveAt: new Date(tick + 60_000), pending: [], planet: view(origin, left, tick) });
    });
    api.planet = vi.fn().mockImplementation((id: string) => Promise.resolve(view(id, pad.get(id) ?? 0, tick)));
    api.planets = vi.fn().mockImplementation(() => Promise.resolve({
      ...list, planets: [view('capital', pad.get('capital') ?? 0, tick), view('colony', pad.get('colony') ?? 0, tick)],
    }));
    api.pending = vi.fn().mockResolvedValue({ pending: [] });
  });
  afterEach(() => { client.clear(); });

  const readyOn = (worldId: string): number =>
    deathStarsOf(client.getQueryData<PlanetView>(keys.planetById(worldId))!)
      .filter((asset) => asset.status === 'READY').length;

  const mount = () => renderHook(() => ({ world: useWorld(), active: usePlanet(), strike: useLaunchDeathStar() }), { wrapper });

  it('spends from the selected world, then the other, then the first again', async () => {
    const { result } = mount();
    await waitFor(() => { expect(result.current.world.activePlanetId).toBe('capital'); });

    await act(async () => { await result.current.strike.mutateAsync('target-1'); });
    expect(readyOn('capital')).toBe(1);
    expect(readyOn('colony')).toBe(1);

    act(() => { result.current.world.selectPlanet('colony'); });
    await waitFor(() => { expect(result.current.active.data?.planet.id).toBe('colony'); });
    expect(readyDeathStar(result.current.active.data!)).toBeDefined();
    await act(async () => { await result.current.strike.mutateAsync('target-2'); });
    expect(readyOn('colony')).toBe(0);
    expect(readyOn('capital')).toBe(1);

    act(() => { result.current.world.selectPlanet('capital'); });
    await waitFor(() => { expect(result.current.active.data?.planet.id).toBe('capital'); });
    expect(deathStarsOf(result.current.active.data!)).toHaveLength(1);
    await act(async () => { await result.current.strike.mutateAsync('target-3'); });
    expect(readyOn('capital')).toBe(0);
    await waitFor(() => { expect(result.current.active.data && readyDeathStar(result.current.active.data)).toBeUndefined(); });

    expect(vi.mocked(api.launchDeathStar).mock.calls).toEqual([
      ['capital', 'target-1'], ['colony', 'target-2'], ['capital', 'target-3'],
    ]);
  });

  it('counts down two launches sent back to back from one world', async () => {
    const { result } = mount();
    await waitFor(() => { expect(result.current.world.activePlanetId).toBe('capital'); });

    await act(async () => {
      await Promise.all([
        result.current.strike.mutateAsync('target-1'),
        result.current.strike.mutateAsync('target-2'),
      ]);
    });

    expect(readyOn('capital')).toBe(0);
    expect(readyOn('colony')).toBe(1);
    expect(vi.mocked(api.launchDeathStar).mock.calls.map(([origin]) => origin)).toEqual(['capital', 'capital']);
  });
});
