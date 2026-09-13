import { describe, expect, it } from 'vitest';

/** Legacy mobile bulk diagnostic. The Hangar is gone and D208 fuel does not read it. */
const fleetBulk = (fleet: Record<string, number | undefined>): number =>
  Object.entries(fleet).reduce((sum, [id, n]) => sum + (n ?? 0) * hullBulk(id as never), 0);
import {
  FUEL,
  GALAXY_SPAN,
  HULLS,
  MOBILE_HULLS,
  PLANET_START,
  deuteriumRate,
  fuelMass,
  hullBulk,
  hullFuelMass,
  hullFuelRate,
  hullRoundTrip,
  missionFuel,
  resourceValue,
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
   * A FLEET'S THIRST IS THE SUM OF ITS HULLS' AND NOTHING ELSE. D195 replaced
   * D153's `bulk x tierMass` with a fraction of hull VALUE, so composition now
   * decides the bill — a Rampart costs more to move than a Dart because it is worth
   * more to field, which is the whole point of the change. What survives from the
   * old statement is the part that matters to a caller: no mix is cheaper than the
   * hulls in it, so a commander can price a wing one hull at a time and add up.
   */
  it('adds up hull by hull, with no discount for the mix', () => {
    const mixed: Fleet = { DART: 3, RAMPART: 2, CITADEL: 1 };
    expect(fuelMass(mixed)).toBe(
      3 * hullFuelMass('DART') + 2 * hullFuelMass('RAMPART') + hullFuelMass('CITADEL'),
    );
    expect(fuelMass({ DART: 10 })).toBe(10 * fuelMass({ DART: 1 }));
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
      // The fleet the opening actually hands over, not a wing five times its size:
      // ten Darts is 2,400 alloy past the first hour, so measuring the granted TANK
      // against a fleet nobody is granted was the pairing that made D153 believe it
      // needed a tier-1 exemption to protect the opening.
      const early = missionFuel({ DART: 2 }, NEIGHBOUR, 2);
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
    expect(missionFuel({ DART: FUEL.scale }, 1, 1)).toBe(hullFuelMass('DART'));
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
 * WHAT ONE CRAFT COSTS TO MOVE, AND WHY IT IS NOT A LADDER ANY MORE. D153 · D195.
 *
 * D153 charged `bulk x tierMass` with the rungs x1/x2/x4/x5 and excluded tier 1 by
 * instruction, to protect the opening. Measured across the whole catalogue at D195,
 * power per unit of fuel came out 13.4 / 10.6 / 8.2 / 10.6 from tier 1 to tier 4 —
 * so the ENTRY hull was the most fuel-efficient warship in the game and the middle
 * of the catalogue the least. The owner named the consequence: *"bu sefer tier 1
 * karli diye full ondan uretiyorlar"*. A ladder whose protected rung is also its
 * efficient rung deletes everything above it.
 *
 * SO THERE IS NO LADDER AND NOTHING TO EXCLUDE. Fuel is a fixed fraction of what
 * the hull cost, tilted by how fast it flies. Value already carries power — D148
 * prices the catalogue at `atk x hp / value^2` — so charging against value charges
 * against power, monotonically, with no rung to sit on for a discount.
 *
 * `bulk` SURVIVES AS GROUND ROOM AND NOTHING ELSE. The Hangar that metered it is
 * gone (D184) and fuel no longer reads it, so the two can no longer re-rate each
 * other; `groundSlots` is its last consumer.
 */
describe('D195 fuel by hull value', () => {
  const value = (id: MobileHullId): number =>
    resourceValue(HULLS[id]);

  /**
   * ONE HULL IS OUTSIDE THIS, BY NAME AND BY INSTRUCTION. D200: the owner set the
   * Garbage Collector's thirst by hand (`SALVAGE.fuelMass`, *"19.1 döteryum yakıt
   * çok. 10 yap."*). The exception is asserted to be exactly that one hull, so a
   * second can only join it by changing this line on purpose.
   */
  it('charges a fixed fraction of hull value, tilted by the hull\'s own trip', () => {
    const handSet = MOBILE_HULLS.filter((id) => HULLS[id].profile === 'COLLECTOR');
    expect(handSet).toEqual(['GARBAGE_COLLECTOR']);
    for (const id of MOBILE_HULLS) {
      if (handSet.includes(id)) continue;
      const thirst = FUEL.pivotRoundTrip / (hullRoundTrip(id) ?? FUEL.pivotRoundTrip);
      expect(hullFuelMass(id), id).toBe(
        Math.max(1, Math.ceil(value(id) * FUEL.perValue * thirst)),
      );
    }
  });

  /**
   * THE DEFECT D195 EXISTS TO REMOVE. Within one design line, a hull that is worth
   * more to field must never be cheaper to move per unit of power than the hull
   * below it. This is the assertion that would have caught D153's inversion.
   */
  it('never gets more fuel-efficient at a lower tier, in any line', () => {
    const lines = ['RAIDER', 'STRIKER', 'FORTRESS', 'ESCORT'] as const;
    for (const profile of lines) {
      const line = MOBILE_HULLS.filter((id) => HULLS[id].profile === profile)
        .sort((a, b) => (HULLS[a].tier ?? 0) - (HULLS[b].tier ?? 0));
      for (let i = 1; i < line.length; i += 1) {
        const before = Math.sqrt(HULLS[line[i - 1]!].atk * HULLS[line[i - 1]!].hp)
          / hullFuelMass(line[i - 1]!);
        const after = Math.sqrt(HULLS[line[i]!].atk * HULLS[line[i]!].hp)
          / hullFuelMass(line[i]!);
        expect(after, `${profile}: ${line[i - 1]!} -> ${line[i]!}`).toBeGreaterThan(before);
      }
    }
  });

  /** And the entry hull is the worst of them, which is what stops the tier-1 swarm. */
  it('leaves the cheapest warship the least fuel-efficient one', () => {
    const power = (id: MobileHullId): number =>
      Math.sqrt(HULLS[id].atk * HULLS[id].hp) / hullFuelMass(id);
    const warships = MOBILE_HULLS.filter((id) => HULLS[id].atk > 0);
    for (const id of warships) {
      if (id === 'DART') continue;
      expect(power(id), id).toBeGreaterThan(power('DART'));
    }
  });

  it('drinks more the faster it flies, at equal value', () => {
    // Pike and Warden cost exactly the same to build and fly different trips; since
    // D207 the Warden is the quicker of the two, so it is the thirstier one.
    expect(value('PIKE')).toBe(value('WARDEN'));
    expect(hullRoundTrip('WARDEN')!).toBeLessThan(hullRoundTrip('PIKE')!);
    expect(hullFuelMass('WARDEN')).toBeGreaterThan(hullFuelMass('PIKE'));
  });

  /** A gun that never travels has no thirst, whatever it weighs on the ground. */
  it('charges a ground hull nothing at all', () => {
    expect(hullFuelMass('BASTION')).toBe(0);
    expect(hullFuelMass('THORN')).toBe(0);
    expect(fuelMass({ BASTION: 5, THORN: 5 })).toBe(0);
  });

  /** Nothing that flies is ever free to move, however cheap it is. */
  it('never charges a mobile hull nothing', () => {
    for (const id of MOBILE_HULLS) expect(hullFuelMass(id), id).toBeGreaterThanOrEqual(1);
  });

  /**
   * BULK DID NOT MOVE, and this is the assertion that keeps it that way. It is
   * ground room now; the day someone folds thirst back into it this test fails.
   */
  it('leaves raw bulk untouched', () => {
    for (const id of MOBILE_HULLS) {
      expect(fleetBulk({ [id]: 1 }), id).toBe(hullBulk(id));
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
