import { describe, expect, it } from 'vitest';
import { HULLS, hangarCapacity, hullBulk } from '@astera/rules';
import {
  ARCHETYPES,
  buildWorld,
  enqueueHullOrder,
  ownedHangarLoad,
  runSeason,
  type ArchetypeName,
  type SimPlayer,
  type World,
} from '../src/index.js';

/**
 * THE SIMULATOR BUILDS ONLY THE FLEET THE PRODUCT WOULD LET IT BUILD. Review 2026-09-22, #7.
 *
 * The Hangar came back on 2026-09-18 and the simulator never did: `enqueueHullOrder` still said
 * "D184: the Hangar is gone", and no archetype had a Hangar in its build order. Measured over a
 * 20-player season, 14 of 20 commanders ended it holding more fleet than their Hangar could berth
 * — 4,772 room against a ceiling of 80 — so every band read off those seasons was measuring a
 * game the server refuses to play, and the Hangar price and Core ramp were being judged against
 * fleets nobody can own.
 */

const rich = (world: World): SimPlayer => {
  const p = world.players[0]!;
  p.alloy = 10_000_000;
  p.crystal = 10_000_000;
  p.deuterium = 10_000_000;
  p.buildings.SHIPYARD = 4;
  p.buildings.CORE = 4;
  return p;
};

describe('a ship order in the simulator answers to the Hangar', () => {
  it('refuses the hull that would not fit, and takes the one that does', () => {
    const world = buildWorld({ players: 1, days: 1, seed: 7 });
    const p = rich(world);
    const room = hangarCapacity(p.buildings.HANGAR) - ownedHangarLoad(p, world);
    const fits = Math.floor(room / hullBulk('DART'));
    expect(fits).toBeGreaterThan(0);

    expect(enqueueHullOrder(p, 'DART', fits + 1, 0, world, 'combat')).toBe(false);
    expect(enqueueHullOrder(p, 'DART', fits, 0, world, 'combat')).toBe(true);
  });

  /** Two orders that each fit and together do not — the server refuses the second. */
  it('counts what is already in the yard queue', () => {
    const world = buildWorld({ players: 1, days: 1, seed: 8 });
    const p = rich(world);
    const room = hangarCapacity(p.buildings.HANGAR) - ownedHangarLoad(p, world);
    const fits = Math.floor(room / hullBulk('DART'));
    expect(enqueueHullOrder(p, 'DART', fits, 0, world, 'combat')).toBe(true);
    expect(enqueueHullOrder(p, 'DART', 1, 0, world, 'combat')).toBe(false);
  });

  /** A berth follows the ship: what is in the air still holds its room at home. */
  it('counts the fleet in the air and the Prospectors out mining', () => {
    const world = buildWorld({ players: 1, days: 1, seed: 9 });
    const p = rich(world);
    const before = ownedHangarLoad(p, world);
    world.missions.push({
      from: p.id, to: p.id, fleet: { DART: 3 }, arriveAt: 60, distance: 10,
      scouted: false, returning: true,
    });
    world.miningRuns.push({
      id: 1, playerId: p.id, asteroidIndex: 0, craft: 1, holdEach: 0, arriveAt: 60,
      intercept: { x: 0, y: 0, z: 0 }, returning: false,
    });
    expect(ownedHangarLoad(p, world))
      .toBe(before + 3 * hullBulk('DART') + hullBulk('PROSPECTOR'));
  });

  it('leaves ground defence to the Core, never to the Hangar', () => {
    const world = buildWorld({ players: 1, days: 1, seed: 10 });
    const p = rich(world);
    const room = hangarCapacity(p.buildings.HANGAR) - ownedHangarLoad(p, world);
    expect(enqueueHullOrder(p, 'DART', Math.floor(room / hullBulk('DART')), 0, world, 'combat'))
      .toBe(true);
    expect(HULLS.THORN.ground).toBe(true);
    expect(enqueueHullOrder(p, 'THORN', 1, 0, world, 'defence')).toBe(true);
  });
});

describe('every archetype that flies has a way to more room', () => {
  it('lists the Hangar in each build order', () => {
    for (const name of Object.keys(ARCHETYPES) as ArchetypeName[]) {
      expect(ARCHETYPES[name].buildOrder, name).toContain('HANGAR');
    }
  });
});

/**
 * THE REVIEW'S OWN MEASUREMENT, AS A GATE. The same 20 players and seed; the claim is the one the
 * server makes about every commander at every instant — nobody owns more fleet than they can berth.
 */
describe('a whole season inside the Hangar', () => {
  const { world } = runSeason({ players: 20, days: 30, seed: 42 });

  it('ends with no commander holding more fleet than their Hangar berths', () => {
    for (const p of world.players) {
      expect(ownedHangarLoad(p, world), `player ${String(p.id)} (${p.type})`)
        .toBeLessThanOrEqual(hangarCapacity(p.buildings.HANGAR));
    }
  });

  it('climbs the Hangar where the fleet needed the room', () => {
    expect(world.players.some((p) => p.buildings.HANGAR > 1)).toBe(true);
  });
});
