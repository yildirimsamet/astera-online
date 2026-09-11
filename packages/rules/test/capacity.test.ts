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
  hullFuelMass,
  hullBulk,
  type Fleet,
  type NeutralTier,
} from '../src/index.js';

const value = (id: (typeof ALL_HULLS)[number]): number =>
  HULLS[id].alloy + HULLS[id].crystal + HULLS[id].deuterium;

/**
 * ROOM, NOT WORTH — but priced off worth on purpose. T4.
 *
 * `bulk` is what a gun takes up on the ground and, from T6, the mass a hull burns
 * fuel to move. The Hangar that once metered it is gone; these two survive it. It
 * is derived from the hull's own price rather than hand-set, and the band below is
 * the reason: a bulk that drifts from value turns fuel into a SECOND pricing axis,
 * one that silently re-rates every hull against the counter
 * cycle the whole game rests on. `atk × hp / value²` is held near-constant across
 * the table (see `hulls.ts`); a capacity measured in value leaves that untouched,
 * and a capacity measured in anything else does not.
 */
describe('what a craft takes up', () => {
  it('gives every hull at least one unit of room', () => {
    for (const id of ALL_HULLS) expect(hullBulk(id)).toBeGreaterThanOrEqual(1);
  });

  it('makes the Dart the unit', () => {
    expect(hullBulk('DART')).toBe(3);
  });

  /**
   * The rounding to whole units is what a player reads on a card, and it is the
   * only licence taken. Fifteen per cent is well inside the 156% the counter cycle
   * buys, so no hull can be made better or worse by the room it takes.
   */
  it('packs higher tiers more efficiently without making them cheaper', () => {
    const line = ['DART', 'VIPER', 'TEMPEST', 'CATACLYSM'] as const;
    expect(line.map(id => hullBulk(id))).toEqual([3, 5, 8, 13]);
    for (let i = 1; i < line.length; i++) expect(value(line[i]!) / hullBulk(line[i]!)).toBeGreaterThan(value(line[i - 1]!) / hullBulk(line[i - 1]!));
  });

  it('keeps cargo capacity a different purchase from combat room', () => {
    expect(hullBulk('COURIER')).toBe(3);
    expect(hullBulk('WAYFARER')).toBe(6);
    expect(hullBulk('ATLAS')).toBe(14);
  });
});

/**
 * ONE POOL, AND IT IS THE GROUND'S. D184.
 *
 * There were two. The Hangar answered "how much fleet" and the Command Core "how
 * many emplacements", and the Hangar is gone: a dedicated building whose only
 * product was a ceiling is a tax rather than a decision, and its price ran away
 * from what it bought — the eighth rung cost more alloy than a whole season makes
 * and bought room for twenty-six Darts.
 *
 * A FLEET IS NOW BRAKED BY WHAT IT COSTS, WHAT IT BURNS AND WHAT IT LOSES, which
 * is how every ship in this genre has always been braked. Ground guns keep their
 * ceiling because they are not symmetric with a fleet: they never move, never fly,
 * salvage at 60%, leave no wreckage and cannot be counter-raided, so an uncapped
 * wall inside D168's tier band would be a world nobody legally able to attack it
 * could ever break.
 */
describe('the ground is the only capacity', () => {
  it('counts only emplacements against the ground slots', () => {
    const fleet: Fleet = { DART: 3, BASTION: 2, THORN: 5 };
    expect(groundLoad(fleet)).toBe(2 * hullBulk('BASTION') + 5 * hullBulk('THORN'));
    for (const id of MOBILE_HULLS) expect(groundLoad({ [id]: 10 })).toBe(0);
  });

  it('loads nothing for an empty world', () => {
    expect(groundLoad({})).toBe(0);
  });

  it('climbs with the Core and never starts at nothing', () => {
    expect(groundSlots(0)).toBeGreaterThan(0);
    for (let level = 1; level <= 20; level++) {
      expect(groundSlots(level)).toBeGreaterThan(groundSlots(level - 1));
    }
  });
});

/**
 * THE HANGAR IS GONE, AND THESE ARE THE EDGES THAT PROVE IT. D184.
 *
 * A removal is only finished when nothing can still name the thing. The building
 * leaves the catalogue, the opening world and the game's own neutral templates
 * together, or a world is written with a level for a building that has no price.
 */
describe('the Hangar is gone', () => {
  it('is not a building any more', () => {
    expect(BUILDING_IDS).not.toContain('HANGAR');
    expect(Object.keys(START_BUILDINGS)).not.toContain('HANGAR');
  });

  it('has no price, because it has no rungs', () => {
    for (const id of BUILDING_IDS) expect(buildingCost(id, 0).alloy).toBeGreaterThan(0);
  });

  /**
   * BULK OUTLIVED BOTH ITS OLD JOBS. The Hangar that rationed it is gone (D184) and
   * D195 moved fuel onto hull VALUE, so what is left is ground room and nothing
   * else — `groundSlots` is its last consumer, and a gun still weighs what it did.
   */
  it('leaves bulk behind as ground room, and only that', () => {
    for (const id of GROUND_HULLS) {
      expect(hullBulk(id), id).toBeGreaterThan(0);
      expect(hullFuelMass(id), id).toBe(0);
    }
    // Fuel no longer reads it: two hulls of equal bulk fly at different prices.
    expect(hullBulk('DART')).toBe(hullBulk('PIKE'));
    expect(hullFuelMass('DART')).not.toBe(hullFuelMass('PIKE'));
  });

  it('names no Hangar in any neutral template', () => {
    for (const tier of [1, 2, 3] as const) {
      expect(Object.keys(MULTI_WORLD.neutral[tier].buildings)).not.toContain('HANGAR');
    }
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
