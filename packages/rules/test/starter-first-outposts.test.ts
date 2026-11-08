import { describe, expect, it } from 'vitest';
import {
  STARTER, distance, firstOutpostPoint, firstOutpostSeed, firstOutpostsMissing, fleetSpeed, playsFirstHunt, seededFrom, starterSitePlan, starterSlots, travelExact,
  type Vec3,
} from '../src/index.js';

const SHIP: Vec3 = { x: 0, y: 0, z: 0 };
const at = (x: number) => ({ x, y: 0, z: 0 });
const outpost = (x: number, level: number, guard: Record<string, number>) => ({ ...at(x), level, guard });

/**
 * THE FIRST HUNT'S TWO OUTPOSTS (owner 2026-11-08, N6–N7). A finished shipyard is shown two named
 * outposts a Dart can reach in three to five minutes: one held by a Sur class its two Darts can beat,
 * and one held by Akıncı or Mızrak, which asks for a counter ship first.
 */
describe('the outposts a new shipyard is shown', () => {
  it('needs both when there is nothing near', () => {
    expect(firstOutpostsMissing(SHIP, [])).toEqual(['wall', 'counter']);
  });

  it('counts a Sur-held first-level outpost and an Akıncı- or Mızrak-held second-level one, in the band', () => {
    expect(firstOutpostsMissing(SHIP, [outpost(350, 1, { WARDEN: 2 }), outpost(-400, 2, { DART: 3 })])).toEqual([]);
    expect(firstOutpostsMissing(SHIP, [outpost(350, 1, { WARDEN: 2 }), outpost(-400, 2, { PIKE: 3 })])).toEqual([]);
  });

  it('does not count one too near, too far, of another class, or of another level', () => {
    expect(firstOutpostsMissing(SHIP, [outpost(200, 1, { WARDEN: 2 }), outpost(600, 2, { DART: 3 })])).toEqual(['wall', 'counter']);
    expect(firstOutpostsMissing(SHIP, [outpost(350, 1, { DART: 2 }), outpost(400, 2, { WARDEN: 3 })])).toEqual(['wall', 'counter']);
    expect(firstOutpostsMissing(SHIP, [outpost(350, 2, { WARDEN: 3 }), outpost(400, 3, { PIKE: 6 })])).toEqual(['wall', 'counter']);
  });

  it('tells a ship which standing outposts are its first hunt, by the same band and roles', () => {
    expect(playsFirstHunt(SHIP, outpost(350, 1, { WARDEN: 2 }))).toBe(true);
    expect(playsFirstHunt(SHIP, outpost(-400, 2, { DART: 3 }))).toBe(true);
    expect(playsFirstHunt(SHIP, outpost(-400, 2, { PIKE: 3 }))).toBe(true);
    expect(playsFirstHunt(SHIP, outpost(200, 1, { WARDEN: 2 }))).toBe(false);
    expect(playsFirstHunt(SHIP, outpost(600, 2, { DART: 3 }))).toBe(false);
    expect(playsFirstHunt(SHIP, outpost(350, 1, { DART: 2 }))).toBe(false);
    expect(playsFirstHunt(SHIP, outpost(400, 3, { PIKE: 6 }))).toBe(false);
  });

  it('lays out each one as the galaxy lays out its own', () => {
    const random = seededFrom('ship', 1);
    expect(firstOutpostSeed('wall', at(350), random)).toEqual({
      kind: 'OUTPOST', ...at(350), level: 1, stock: STARTER.sites.outposts.stock[0], guard: { WARDEN: STARTER.sites.outposts.guards[0] },
    });
    const counters = Array.from({ length: 40 }, (_, i) => firstOutpostSeed('counter', at(400), seededFrom('ship', i)));
    for (const seed of counters) {
      expect(seed).toMatchObject({ kind: 'OUTPOST', level: 2, stock: STARTER.sites.outposts.stock[1] });
      expect(Object.values(seed.guard ?? {})).toEqual([STARTER.sites.outposts.guards[1]]);
    }
    expect(new Set(counters.map(seed => Object.keys(seed.guard ?? {})[0]))).toEqual(new Set(['DART', 'PIKE']));
  });

  it('finds a place a Dart pair reaches in three to five minutes, clear of every berth and site, inside the galaxy', () => {
    const berths = starterSlots(7);
    for (let i = 0; i < 30; i++) {
      const ship = berths[i % berths.length]!;
      const sites = [at(0), at(500), { x: 0, y: 0, z: 500 }];
      const point = firstOutpostPoint(ship, berths, sites, seededFrom('place', i));
      if (!point) continue;
      const span = distance(ship, point);
      expect(span).toBeGreaterThanOrEqual(STARTER.firstOutposts.near);
      expect(span).toBeLessThanOrEqual(STARTER.firstOutposts.far);
      for (const berth of berths) expect(distance(berth, point)).toBeGreaterThanOrEqual(100);
      for (const site of sites) expect(distance(site, point)).toBeGreaterThanOrEqual(200);
      expect(Math.hypot(point.x, point.y, point.z)).toBeLessThanOrEqual(STARTER.radius);
      const minutes = travelExact(span, fleetSpeed({ DART: 2 }, {}));
      expect(minutes).toBeGreaterThanOrEqual(3);
      expect(minutes).toBeLessThanOrEqual(5);
    }
  });

  it('places one for nearly every berth of a galaxy', () => {
    const berths = starterSlots(11);
    const placed = berths.filter((ship, i) => firstOutpostPoint(ship, berths, [], seededFrom('place', i)) !== null);
    expect(placed.length).toBeGreaterThanOrEqual(berths.length - 2);
  });

  it('gives up rather than place one off the map', () => {
    expect(firstOutpostPoint(at(STARTER.radius * 3), [], [], seededFrom('far'))).toBeNull();
  });
});

/**
 * A FULL GALAXY STILL GIVES EVERYONE THEIR FIRST HUNT. Measured 2026-11-08: with room for only eight
 * more outposts, a 30-ship galaxy left about a third of its shipyards with no mark at all. Each yard
 * is given two at most, once, so the galaxy's room is sized by that and not by a smaller guess.
 */
describe('a galaxy filling up', () => {
  it('shows every shipyard both of its first outposts, in order of finishing', () => {
    for (const seed of [3, 11, 29]) {
      const berths = starterSlots(seed);
      const places: { kind: string; x: number; y: number; z: number; level: number; guard: Record<string, number> | null }[] = starterSitePlan(seed, berths);
      berths.forEach((ship, n) => {
        const outposts = places.filter(place => place.kind === 'OUTPOST');
        const room = STARTER.sites.outposts.count + STARTER.firstOutposts.extraMax - outposts.length;
        const random = seededFrom(`ship-${String(seed)}-${String(n)}`, 'first-outposts');
        for (const role of firstOutpostsMissing(ship, outposts).slice(0, Math.max(0, room))) {
          const point = firstOutpostPoint(ship, berths, places, random);
          if (point) places.push(firstOutpostSeed(role, point, random));
        }
        expect(firstOutpostsMissing(ship, places.filter(place => place.kind === 'OUTPOST'))).toEqual([]);
      });
    }
  });
});
