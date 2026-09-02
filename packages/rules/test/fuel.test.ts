import { describe, expect, it } from 'vitest';
import {
  FUEL,
  GALAXY_SPAN,
  HULLS,
  MOBILE_HULLS,
  PLANET_START,
  deuteriumRate,
  fuelMass,
  hangarLoad,
  hullBulk,
  hullFuelMass,
  hullFuelRate,
  missionFuel,
  type Fleet,
  type MobileHullId,
} from '../src/index.js';

/** A neighbourhood raid: the tempo the hull speeds were set against. */
const NEIGHBOUR = 600;

/**
 * DISTANCE BECOMES AN ECONOMIC COST. T6.
 *
 * D125 and D126 made distance an INFORMATION cost — how far you can see, and how
 * late a warning arrives. Fuel makes the same axis an economic one, which is the
 * consistent version of the same idea: the far target was already harder to know
 * about, and now it is dearer to reach.
 *
 * PRICED ON MASS AND DISTANCE, NEVER ON SPEED. A Rampart already pays for being
 * slow by being slow — it spends longer in the air, longer out of position, and
 * longer visible to everyone watching. Charging it again for the same property
 * would be taxing one decision twice, and the hull table is held at equal-budget
 * power precisely so that no second axis quietly re-rates it.
 */
describe('mission fuel', () => {
  it('costs nothing to send nothing', () => {
    expect(missionFuel({}, NEIGHBOUR, 2)).toBe(0);
  });

  it('rises with mass, with distance and with the number of legs', () => {
    const small: Fleet = { DART: 20 };
    const large: Fleet = { DART: 200 };
    expect(missionFuel(large, NEIGHBOUR, 1)).toBeGreaterThan(missionFuel(small, NEIGHBOUR, 1));
    expect(missionFuel(small, NEIGHBOUR * 3, 1)).toBeGreaterThan(missionFuel(small, NEIGHBOUR, 1));
    expect(missionFuel(small, NEIGHBOUR, 2)).toBe(missionFuel(small, NEIGHBOUR, 1) * 2);
  });

  /**
   * TWO FLEETS OF THE SAME MASS AT THE SAME TIER BURN THE SAME FUEL, whatever they
   * are made of. `bulk` is derived from hull value, so within a tier this is the
   * same statement as "the Hangar caps military, not composition" — one quantity
   * doing one job in two places, which is why they share it. Across tiers it is
   * D153's thirst multiplier that separates them, and nothing else.
   */
  it('charges mass, not composition, inside a tier', () => {
    const darts: Fleet = { DART: hullBulk('RAMPART') };
    const bulwark: Fleet = { RAMPART: 1 };
    expect(hangarLoad(darts)).toBe(hangarLoad(bulwark));
    expect(missionFuel(darts, NEIGHBOUR, 2)).toBe(missionFuel(bulwark, NEIGHBOUR, 2));
  });

  it('never asks for a fraction, and never for less than a drop per leg', () => {
    const fuel = missionFuel({ DART: 1 }, 1, 2);
    expect(Number.isInteger(fuel)).toBe(true);
    expect(fuel).toBe(2);
  });

  it('leaves ground defence out of it — it never travels', () => {
    expect(missionFuel({ BASTION: 5, THORN: 5 }, NEIGHBOUR, 2)).toBe(0);
  });

  describe('what it costs to play', () => {
    /**
     * THE OPENING IS NOT TAXED. A commander's first raids are a handful of Darts
     * at a neighbour, and the tank they are given has to cover a real run of them
     * — the chain the opening teaches is "I have fuel, it is running out, I need a
     * refinery, the refinery needs research", and a tank that ran dry on the second
     * launch would teach panic instead.
     */
    it('gives a fresh commander a real run of early launches', () => {
      const early = missionFuel({ DART: 10 }, NEIGHBOUR, 2);
      expect(PLANET_START.deuterium / early).toBeGreaterThanOrEqual(8);
      // ...and not so many that the lesson never arrives.
      expect(PLANET_START.deuterium / early).toBeLessThan(40);
    });

    /**
     * THE FIRST RESEARCH RUNG HAS TO PAY FOR THE FLYING IT UNLOCKS. A refinery at
     * the ceiling rung one opens must sustain several ordinary raids a day, or the
     * whole chain ends in a building that does not solve the problem it was sold on.
     */
    it('lets the first refinery rung sustain a day of raiding', () => {
      const perDay = deuteriumRate(3) * 24;
      const raid = missionFuel({ DART: 60, WAYFARER: 4 }, NEIGHBOUR, 2);
      expect(perDay / raid).toBeGreaterThan(4);
    });

    /**
     * A CROSSING COSTS REAL MONEY. The disc is 2,500 across and the whole point of
     * the axis is that the far target is dearer — but never so dear that a big
     * committed fleet simply cannot be flown.
     */
    it('makes the long crossing expensive without making it impossible', () => {
      const near = missionFuel({ DART: 200 }, NEIGHBOUR, 2);
      const far = missionFuel({ DART: 200 }, GALAXY_SPAN, 2);
      expect(far).toBeGreaterThan(near * 3);
      expect(far).toBeLessThan(deuteriumRate(9) * 24);
    });
  });

  it('is one dial, and it is the one named for the job', () => {
    expect(FUEL.scale).toBeGreaterThan(0);
    expect(missionFuel({ DART: FUEL.scale }, 1, 1)).toBe(1);
    expect(HULLS.DART.speed).toBeGreaterThan(0);
  });
});

/**
 * WHAT ONE CRAFT COSTS TO MOVE, AS A FIGURE A CARD CAN PRINT. Owner report.
 *
 * `missionFuel` answers "what does THIS launch cost", which is the only question
 * the launch screens ask — and it left the ship card unable to answer the question
 * a player holds while CHOOSING a hull: what does one of these cost to fly. The
 * four numbers on a craft sheet decide the counter cycle; since T6 a fifth decides
 * whether the fleet can be moved at all, and it was nowhere in the game.
 *
 * A RATE, NOT A CHARGE, and the distinction is the whole reason it is a separate
 * function. The charge is rounded UP per leg for the whole fleet, so no per-hull
 * figure can ever be added up into it; this is the comparison — a Rampart costs
 * twelve Darts to move — which is exactly the trade the picker is for.
 *
 * QUOTED OVER `FUEL.reference`, a READING unit rather than a dial. Moving it
 * changes no charge anywhere; moving `FUEL.scale` changes every launch in the game.
 */
describe('fuel per craft', () => {
  it('quotes over a span the disc actually contains', () => {
    expect(FUEL.reference).toBeGreaterThan(0);
    expect(FUEL.reference).toBeLessThan(GALAXY_SPAN);
  });

  it('ranks hulls exactly as their fuel mass does — it is the same number', () => {
    for (const id of ['DART', 'PIKE', 'RAMPART', 'CITADEL'] as const) {
      expect(hullFuelRate(id), id).toBeGreaterThan(0);
      expect(hullFuelRate(id) / hullFuelRate('DART'), id).toBeCloseTo(
        hullFuelMass(id) / hullFuelMass('DART'),
        6,
      );
    }
    expect(hullFuelRate('CITADEL')).toBeGreaterThan(hullFuelRate('RAMPART'));
  });

  /** A gun that never leaves the ground never burns a drop, and must not read `0.0`. */
  it('charges nothing to a hull that cannot travel', () => {
    expect(hullFuelRate('BASTION')).toBe(0);
    expect(hullFuelRate('THORN')).toBe(0);
  });

  /**
   * THE CARD AND THE CHARGE HAVE TO BE THE SAME CLAIM. A rate that did not add
   * back up to what the server takes would be a ship card quietly lying about the
   * one figure a commander budgets against.
   */
  it('adds back up to what the server charges', () => {
    const fleet: Fleet = { DART: 40, PIKE: 6, WAYFARER: 3 };
    const span = 1_750;
    const perLeg = (Object.entries(fleet) as [keyof typeof fleet, number][])
      .reduce((sum, [hull, count]) => sum + hullFuelRate(hull) * count, 0)
      * (span / FUEL.reference);

    expect(perLeg).toBeCloseTo((fuelMass(fleet) * span) / FUEL.scale, 6);
    expect(Math.ceil(Number(perLeg.toFixed(6)))).toBe(missionFuel(fleet, span, 1));
  });
});

/**
 * THIRST IS A TIER PROPERTY. D153, owner instruction.
 *
 * THE REPORT: ships burned almost no deuterium. Fuel is mass × distance and mass is
 * `bulk`, which is derived from hull VALUE — so a late fleet already cost more to
 * move than an early one, but only in proportion to what it cost to build, and a
 * refinery that covered the opening covered the endgame too. Deuterium was a lesson
 * in the first hour and then a rounding error, which is the one thing T6 was added
 * to prevent.
 *
 * SO THE LADDER IS A THIRST LADDER: ×1, ×2, ×4, ×5 on the tier's own fuel mass. The
 * opening is untouched by instruction — a fresh commander's Darts, Pikes and
 * Couriers are all tier 1, so `PLANET_START.deuterium` still covers the same run of
 * launches and the chain the opening teaches ("I have fuel, it is running out, I
 * need a refinery") arrives at exactly the same moment it always did.
 *
 * IT IS A SEPARATE NUMBER FROM `bulk` AND IT HAS TO BE. Bulk is Hangar ROOM, priced
 * off hull value so that capacity caps how much military a world holds without
 * caring which hulls it is made of (T4). Folding thirst into it would re-rate every
 * hull against the Hangar as a side effect of a fuel change, and nothing in the hull
 * table would show it. Two numbers, one derived from the other, one job each.
 *
 * WHAT IT DOES NOT TOUCH: prices are still `atk × hp / value²` and do not read fuel;
 * combat, the counter cycle and the 25% research ceiling are untouched; speed is
 * still explicitly not in the fuel model (T6 · D152). A tier-4 fleet is not weaker,
 * it is dearer to fly — which is a decision about WHEN to commit it, taken with the
 * tank in front of you.
 */
describe('D153 fuel by hull tier', () => {
  const LADDER: Readonly<Record<1 | 2 | 3 | 4, number>> = { 1: 1, 2: 2, 3: 4, 4: 5 };

  it('multiplies each tier\'s fuel mass by its own rung, and nothing else', () => {
    for (const id of MOBILE_HULLS) {
      const tier = HULLS[id].tier;
      const rung = tier === null ? 1 : LADDER[tier];
      expect(hullFuelMass(id), id).toBe(hullBulk(id) * rung);
    }
  });

  /** Tier 1 was excluded by instruction: the opening must cost what it always did. */
  it('leaves the opening exactly where it was', () => {
    for (const id of MOBILE_HULLS.filter((hull) => HULLS[hull].tier === 1)) {
      expect(hullFuelMass(id), id).toBe(hullBulk(id));
    }
    expect(missionFuel({ DART: 10 }, NEIGHBOUR, 2)).toBe(2);
    expect(PLANET_START.deuterium / missionFuel({ DART: 10 }, NEIGHBOUR, 2))
      .toBeGreaterThanOrEqual(8);
  });

  /**
   * THE POINT, AS A COMPARISON A COMMANDER CAN FEEL: the same Hangar room in tier-4
   * hulls costs five times the deuterium to move that it does in tier-1 hulls. The
   * room is the same, so this is thirst and nothing else — the fleet that fits is
   * not the fleet you can afford to fly.
   */
  it('charges five times as much to move the same room at the top tier', () => {
    const room = hullBulk('CITADEL');
    const early: Fleet = { DART: room };
    const late: Fleet = { CITADEL: 1 };
    expect(hangarLoad(early)).toBe(hangarLoad(late));
    expect(fuelMass(late)).toBe(fuelMass(early) * LADDER[4]);
    expect(missionFuel(late, NEIGHBOUR, 2)).toBe(missionFuel(early, NEIGHBOUR, 2) * LADDER[4]);
  });

  it('rises with the tier at every rung', () => {
    const perRoom = (id: MobileHullId): number => hullFuelMass(id) / hullBulk(id);
    expect(perRoom('DART')).toBeLessThan(perRoom('VIPER'));
    expect(perRoom('VIPER')).toBeLessThan(perRoom('TEMPEST'));
    expect(perRoom('TEMPEST')).toBeLessThan(perRoom('CITADEL'));
  });

  /** A gun that never travels has no thirst, whatever it weighs on the ground. */
  it('charges a ground hull nothing at all', () => {
    expect(hullFuelMass('BASTION')).toBe(0);
    expect(hullFuelMass('THORN')).toBe(0);
    expect(fuelMass({ BASTION: 5, THORN: 5 })).toBe(0);
  });

  /**
   * THE HANGAR DID NOT MOVE, and this is the assertion that keeps it that way. Bulk
   * is room; fuel mass is thirst. The day someone folds the multiplier back into
   * `BULK` this test is what fails.
   */
  it('leaves Hangar room untouched', () => {
    for (const id of MOBILE_HULLS) {
      expect(hangarLoad({ [id]: 1 }), id).toBe(hullBulk(id));
    }
  });

  /**
   * AND THE REFINERY THE OPENING SELLS STILL PAYS FOR THE FLYING IT UNLOCKS. The
   * first rung's raid is a Dart swarm with a Wayfarer or two behind it, so this raid
   * now costs the tier-2 rung on the cargo — and the rung has to stay ahead of it,
   * or the chain the opening teaches ends in a building that does not solve the
   * problem it was sold on.
   */
  it('lets the first refinery rung sustain a day of tier-2 raiding', () => {
    const perDay = deuteriumRate(3) * 24;
    expect(perDay / missionFuel({ DART: 60, WAYFARER: 4 }, NEIGHBOUR, 2)).toBeGreaterThan(4);
  });
});
