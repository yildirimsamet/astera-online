import { describe, expect, it } from 'vitest';
import {
  ALL_HULLS,
  BUILDING_IDS,
  GROUND_HULLS,
  HULLS,
  MOBILE_HULLS,
  MULTI_WORLD,
  START_BUILDINGS,
  buildingCost,
  groundLoad,
  groundSlots,
  hangarCapacity,
  hangarLoad,
  hullBulk,
  upgradeCost,
  type Fleet,
  type NeutralTier,
} from '../src/index.js';

const value = (id: (typeof ALL_HULLS)[number]): number =>
  HULLS[id].alloy + HULLS[id].crystal + HULLS[id].deuterium;

/**
 * ROOM, NOT WORTH — but priced off worth on purpose. T4.
 *
 * `bulk` is what a craft takes up in a Hangar and, from T6, the mass it burns fuel
 * to move. It is derived from the hull's own price rather than hand-set, and the
 * band below is the reason: a bulk that drifts from value turns the Hangar into a
 * SECOND pricing axis, one that silently re-rates every hull against the counter
 * cycle the whole game rests on. `atk × hp / value²` is held near-constant across
 * the table (see `hulls.ts`); a capacity measured in value leaves that untouched,
 * and a capacity measured in anything else does not.
 */
describe('what a craft takes up', () => {
  it('gives every hull at least one unit of room', () => {
    for (const id of ALL_HULLS) expect(hullBulk(id)).toBeGreaterThanOrEqual(1);
  });

  it('makes the Wasp the unit', () => {
    expect(hullBulk('WASP')).toBe(1);
  });

  /**
   * The rounding to whole units is what a player reads on a card, and it is the
   * only licence taken. Fifteen per cent is well inside the 156% the counter cycle
   * buys, so no hull can be made better or worse by the room it takes.
   */
  it('stays proportional to what the hull costs, within the rounding', () => {
    const perUnit = value('WASP');
    for (const id of ALL_HULLS) {
      const exact = value(id) / perUnit;
      expect(Math.abs(hullBulk(id) - exact) / exact).toBeLessThan(0.15);
    }
  });

  it('rises with the hull, never falls', () => {
    const byValue = [...ALL_HULLS].sort((a, b) => value(a) - value(b));
    for (let i = 1; i < byValue.length; i++) {
      expect(hullBulk(byValue[i]!)).toBeGreaterThanOrEqual(hullBulk(byValue[i - 1]!));
    }
  });
});

/**
 * TWO POOLS, TWO SOURCES, DELIBERATELY. T4b.
 *
 * Investment in a fleet must not steal from defence and investment in defence must
 * not steal from a fleet — they are two decisions and one pool would bind them to
 * a single slider. So the Hangar answers "how much fleet" and the Command Core,
 * which already says how big a world is, answers "how many emplacements".
 *
 * A caller cannot pass the wrong half: `hangarLoad` counts only what flies and
 * `groundLoad` only what cannot. That is the D131 lesson — a rule honoured on one
 * path and forgotten on another is the failure mode this code base has already
 * shipped once.
 */
describe('the two capacities', () => {
  it('uses the reduced Hangar ladder and charges double for every rung', () => {
    expect(hangarCapacity(0)).toBe(100);
    expect(hangarCapacity(1)).toBe(180);
    expect(hangarCapacity(12)).toBe(1_060);

    for (const level of [0, 1, 5, 12]) {
      const ordinary = upgradeCost(level);
      expect(buildingCost('HANGAR', level)).toEqual({
        alloy: ordinary.alloy * 2,
        crystal: ordinary.crystal * 2,
        deuterium: ordinary.deuterium * 2,
      });
      expect(buildingCost('SHIPYARD', level)).toEqual(ordinary);
    }
  });

  it('counts only flying craft against the Hangar', () => {
    const fleet: Fleet = { WASP: 3, BASTION: 2, THORN: 5 };
    expect(hangarLoad(fleet)).toBe(3 * hullBulk('WASP'));
    for (const id of GROUND_HULLS) expect(hangarLoad({ [id]: 10 })).toBe(0);
  });

  it('counts only emplacements against the ground slots', () => {
    const fleet: Fleet = { WASP: 3, BASTION: 2, THORN: 5 };
    expect(groundLoad(fleet)).toBe(2 * hullBulk('BASTION') + 5 * hullBulk('THORN'));
    for (const id of MOBILE_HULLS) expect(groundLoad({ [id]: 10 })).toBe(0);
  });

  /** The mining craft flies, so it takes hangar room. Mining is a choice against fleet size. */
  it('charges the Hangar for mining craft', () => {
    expect(hangarLoad({ PROSPECTOR: 2 })).toBe(2 * hullBulk('PROSPECTOR'));
  });

  it('loads nothing for an empty world', () => {
    expect(hangarLoad({})).toBe(0);
    expect(groundLoad({})).toBe(0);
  });

  it('both ladders climb, and neither starts at nothing', () => {
    expect(hangarCapacity(0)).toBeGreaterThan(0);
    expect(groundSlots(0)).toBeGreaterThan(0);
    for (let level = 1; level <= 20; level++) {
      expect(hangarCapacity(level)).toBeGreaterThan(hangarCapacity(level - 1));
      expect(groundSlots(level)).toBeGreaterThan(groundSlots(level - 1));
    }
  });

  /**
   * A world opens with no Hangar and must still be able to keep a fleet, or the
   * game locks at the moment it is handed over. `START_BUILDINGS` is what a fresh
   * planet is written with, and the rehearsal replays it — a capacity of zero at
   * level zero would break both.
   */
  it('lets a world with no Hangar at all keep a real fleet', () => {
    expect(START_BUILDINGS.HANGAR).toBe(0);
    expect(hangarCapacity(START_BUILDINGS.HANGAR)).toBeGreaterThan(hangarLoad({ WASP: 50 }));
  });

  it('is a building like any other', () => {
    expect(BUILDING_IDS).toContain('HANGAR');
  });
});

/**
 * THE GAME'S OWN WORLDS OBEY THE GAME'S OWN CAPS.
 *
 * `MULTI_WORLD.neutral` is seeded straight into the database, bypassing every
 * check in `build.ts`, and `reinforceNeutral` rebuilds up to the same template. A
 * template over its own ceiling would put a world on the disc that the rules say
 * cannot exist — and the tier-3 garrison is the one most likely to do it, because
 * it is the only template with ground guns at all.
 */
describe('the neutral templates fit under their own ceilings', () => {
  const tiers = [1, 2, 3] as const;

  it.each(tiers)('tier %i keeps its fleet inside a Hangar it has not built', (tier: NeutralTier) => {
    const template = MULTI_WORLD.neutral[tier];
    expect(template.buildings.HANGAR).toBe(0);
    expect(hangarLoad(template.fleet)).toBeLessThanOrEqual(
      hangarCapacity(template.buildings.HANGAR),
    );
  });

  it.each(tiers)('tier %i keeps its guns inside its own Core', (tier: NeutralTier) => {
    const template = MULTI_WORLD.neutral[tier];
    expect(groundLoad(template.ground)).toBeLessThanOrEqual(
      groundSlots(template.buildings.CORE),
    );
  });

  /**
   * The fortified tier is the design's own statement of a defended world. Its
   * garrison should be a real fraction of the ceiling rather than a rounding
   * error against it — a cap the game's hardest PvE target barely touches is a
   * cap that will never be felt by anybody.
   */
  it('makes the fortified tier a meaningful share of its ceiling', () => {
    const template = MULTI_WORLD.neutral[3];
    const share = groundLoad(template.ground) / groundSlots(template.buildings.CORE);
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(1);
  });
});
