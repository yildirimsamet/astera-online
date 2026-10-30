import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { keys } from '../src/api/keys.js';
import type { GalaxyView, IntelView } from '../src/api/schemas.js';
import { readIntelSnapshot } from '../src/api/sightCache.js';

/**
 * THE MAP'S READINGS COME OFF THE INTEL READ. Scaling plan F1.8 (Q15).
 *
 * A watched world's fleet moving refetched `galaxy` and `intel`, and both ran the
 * same telescope read. The map's `fleet` is that reading, rounded, so `intel`
 * now writes it onto the held map as it lands. It never adds a reading the map did
 * not already show: the map alone knows which worlds the caller can resolve.
 */
type World = GalaxyView['planets'][number];
const world = (id: string, fleet?: World['fleet']): World => ({ id, ...(fleet ? { fleet } : {}) }) as World;
const watch = (targetPlanetId: string, status: 'HOME' | 'AWAY', staleMinutes: number): IntelView['watching'][number] => ({
  slot: 0, targetPlanetId, targetName: targetPlanetId, ownerName: 'x', cooldownUntil: null,
  reading: { status, staleMinutes, etaMinutes: status === 'AWAY' ? 12 : null, state: 'CLEAR', clarity: 0.8 },
});
const intel = (watching: IntelView['watching']): IntelView => ({ watching }) as IntelView;

describe('readIntelSnapshot', () => {
  it('rewrites the readings the map already shows, and only those', async () => {
    const client = new QueryClient();
    const held = { planets: [world('a', { status: 'HOME', staleMinutes: 0, etaMinutes: null, clarity: 'FULL' }), world('b'), world('c')] } as GalaxyView;
    client.setQueryData(keys.galaxy, held);
    const fresh = intel([watch('a', 'AWAY', 2.6), watch('b', 'AWAY', 1)]);
    expect(await readIntelSnapshot(client, () => Promise.resolve(fresh))).toBe(fresh);
    const map = client.getQueryData<GalaxyView>(keys.galaxy)!;
    expect(map.planets[0]!.fleet).toEqual({ status: 'AWAY', staleMinutes: 3, etaMinutes: 12, clarity: 'CLEAR' });
    expect(map.planets[1]).toBe(held.planets[1]);
    expect(map.planets[2]).toBe(held.planets[2]);
  });

  it('leaves the map untouched when nothing moved, or when there is no map', async () => {
    const client = new QueryClient();
    const held = { planets: [world('a', { status: 'AWAY', staleMinutes: 3, etaMinutes: 12, clarity: 'CLEAR' })] } as GalaxyView;
    client.setQueryData(keys.galaxy, held);
    await readIntelSnapshot(client, () => Promise.resolve(intel([watch('a', 'AWAY', 2.6)])));
    expect(client.getQueryData(keys.galaxy)).toBe(held);
    const empty = new QueryClient();
    await readIntelSnapshot(empty, () => Promise.resolve(intel([watch('a', 'AWAY', 1)])));
    expect(empty.getQueryData(keys.galaxy)).toBeUndefined();
  });
});
