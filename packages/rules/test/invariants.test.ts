import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ALL_HULLS,
  ECON,
  alloyRate,
  crystalRate,
  storageCap,
  upgradeCost,
  bookBattle,
  computeLoot,
  dominion,
  emptyLedger,
  fleetCargo,
  fleetCount,
  generateGalaxy,
  mulberry32,
  resolveCombat,
  travelMinutes,
  type Fleet,
} from '../src/index.js';

/** Small random fleets, biased towards mixes that actually occur in play. */
const arbFleet = fc
  .record({
    WASP: fc.integer({ min: 0, max: 300 }),
    LANCE: fc.integer({ min: 0, max: 60 }),
    BULWARK: fc.integer({ min: 0, max: 20 }),
    HAULER: fc.integer({ min: 0, max: 40 }),
  })
  .filter((f) => f.WASP + f.LANCE + f.BULWARK + f.HAULER > 0);

const arbDefence = fc.record({
  WASP: fc.integer({ min: 0, max: 200 }),
  BULWARK: fc.integer({ min: 0, max: 15 }),
  BASTION: fc.integer({ min: 0, max: 25 }),
});

describe('combat invariants — must hold for ALL inputs', () => {
  it('never produces a negative unit count', () => {
    fc.assert(
      fc.property(arbFleet, arbDefence, fc.integer({ min: 0, max: 40_000 }), fc.nat(), (a, d, shield, seed) => {
        const r = resolveCombat(a, d, shield, mulberry32(seed));
        for (const id of ALL_HULLS) {
          expect(r.attackerSurvivors[id] ?? 0).toBeGreaterThanOrEqual(0);
          expect(r.defenderSurvivors[id] ?? 0).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('never creates units out of nothing', () => {
    fc.assert(
      fc.property(arbFleet, arbDefence, fc.nat(), (a, d, seed) => {
        const r = resolveCombat(a, d, 0, mulberry32(seed));
        for (const id of ALL_HULLS) {
          expect(r.attackerSurvivors[id] ?? 0).toBeLessThanOrEqual((a as Fleet)[id] ?? 0);
          expect(r.defenderSurvivors[id] ?? 0).toBeLessThanOrEqual((d as Fleet)[id] ?? 0);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('never reports negative destroyed value, even with salvage', () => {
    fc.assert(
      fc.property(arbFleet, arbDefence, fc.nat(), (a, d, seed) => {
        const r = resolveCombat(a, d, 0, mulberry32(seed));
        expect(r.defenderLossValue).toBeGreaterThanOrEqual(0);
        expect(r.attackerLossValue).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 300 },
    );
  });

  it('DECISIVE implies the defence is actually gone', () => {
    fc.assert(
      fc.property(arbFleet, arbDefence, fc.nat(), (a, d, seed) => {
        const r = resolveCombat(a, d, 0, mulberry32(seed));
        if (r.grade === 'DECISIVE') expect(fleetCount(r.defenderSurvivors)).toBe(0);
      }),
      { numRuns: 300 },
    );
  });

  it('resolves in at most three rounds', () => {
    fc.assert(
      fc.property(arbFleet, arbDefence, fc.nat(), (a, d, seed) => {
        const r = resolveCombat(a, d, 0, mulberry32(seed));
        expect(r.rounds.length).toBeLessThanOrEqual(3);
      }),
      { numRuns: 200 },
    );
  });

  it('is deterministic for a given seed', () => {
    fc.assert(
      fc.property(arbFleet, arbDefence, fc.nat(), (a, d, seed) => {
        const one = resolveCombat(a, d, 0, mulberry32(seed));
        const two = resolveCombat(a, d, 0, mulberry32(seed));
        expect(two).toEqual(one);
      }),
      { numRuns: 200 },
    );
  });
});

describe('dominion is zero-sum for ALL battles', () => {
  it('holds across arbitrary fleets and loot', () => {
    fc.assert(
      fc.property(
        arbFleet,
        arbDefence,
        fc.integer({ min: 0, max: 200_000 }),
        fc.nat(),
        (a, d, loot, seed) => {
          const atk = emptyLedger();
          const def = emptyLedger();
          bookBattle(atk, def, loot, resolveCombat(a, d, 0, mulberry32(seed)));
          expect(dominion(atk) + dominion(def)).toBe(0);
        },
      ),
      { numRuns: 400 },
    );
  });
});

describe('loot invariants', () => {
  it('never exceeds cargo, never exceeds what is available', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500_000 }),
        fc.integer({ min: 0, max: 500_000 }),
        fc.integer({ min: 0, max: 100_000 }),
        fc.integer({ min: 0, max: 200_000 }),
        fc.constantFrom('DECISIVE' as const, 'PARTIAL' as const, 'REPELLED' as const),
        (alloy, crystal, floor, cargo, grade) => {
          const loot = computeLoot({ alloy, crystal }, floor, grade, cargo);
          expect(loot.alloy + loot.crystal).toBeLessThanOrEqual(cargo);
          expect(loot.alloy).toBeLessThanOrEqual(Math.max(0, alloy - floor));
          expect(loot.crystal).toBeLessThanOrEqual(Math.max(0, crystal - floor));
          expect(loot.alloy).toBeGreaterThanOrEqual(0);
          expect(loot.crystal).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('a fleet can never carry more than its hulls allow', () => {
    fc.assert(
      fc.property(arbFleet, (f) => {
        const loot = computeLoot({ alloy: 1e9, crystal: 1e9 }, 0, 'DECISIVE', fleetCargo(f));
        expect(loot.alloy + loot.crystal).toBeLessThanOrEqual(fleetCargo(f));
      }),
      { numRuns: 200 },
    );
  });
});

describe('travel', () => {
  it('is monotonic in distance and never instant', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4000 }), fc.integer({ min: 1, max: 60 }), (d, s) => {
        expect(travelMinutes(d, s)).toBeGreaterThanOrEqual(3);
        expect(travelMinutes(d + 100, s)).toBeGreaterThanOrEqual(travelMinutes(d, s));
      }),
      { numRuns: 300 },
    );
  });

  it('an immobile fleet cannot travel', () => {
    expect(travelMinutes(100, 0)).toBe(Infinity);
  });
});

describe('galaxy generation', () => {
  it('is deterministic — same seed, same galaxy', () => {
    fc.assert(
      fc.property(fc.nat(), (seed) => {
        expect(generateGalaxy(seed, 40)).toEqual(generateGalaxy(seed, 40));
      }),
      { numRuns: 30 },
    );
  });

  it('keeps every planet inside the disc', () => {
    const g = generateGalaxy(99, 200);
    for (const s of g.slots) {
      expect(Math.hypot(s.x, s.z)).toBeLessThanOrEqual(1001);
      expect(Math.abs(s.y)).toBeLessThanOrEqual(121);
    }
  });

  it('produces the requested number of slots', () => {
    expect(generateGalaxy(4, 200).slots).toHaveLength(200);
  });
});

/**
 * THE SCARCE RESOURCE HAS TO BE SPENDABLE.
 *
 * Crystal is the gate on everything interesting, which only works if a player is
 * ever short of it. It shipped the other way round: income was 33% of alloy
 * income while upgrades charged 22% and the first three levels charged nothing,
 * so crystal filled its twelve-hour store overnight and wasted from then on. The
 * symptom in play is a resource bar that only ever goes up and a second currency
 * nobody thinks about.
 *
 * These hold the shape of the fix rather than the exact numbers, so the curve can
 * be retuned by playtest without the guard becoming a rewrite.
 */
describe('crystal is a constraint, not a souvenir', () => {
  const incomeShare = (level: number): number => crystalRate(level) / alloyRate(level);
  const costShare = (level: number): number => {
    const cost = upgradeCost(level);
    return cost.crystal / cost.alloy;
  };

  it('charges crystal at roughly the rate crystal arrives', () => {
    /**
     * The band, and why it is not centred on 1.0.
     *
     * Spending crystal as fast as it arrives leaves nothing in the store, and a
     * store with nothing in it is nothing to raid — the simulator showed exactly
     * that at parity: raid returns fell under their floor on seed 7 and the
     * informed archetype dropped off the top of the ladder, because selective
     * raiding pays a fixed scouting cost against a shrinking prize.
     *
     * So crystal is charged at about four fifths of the rate it arrives: enough
     * that it is always being spent, little enough that a raid still finds
     * something worth the trip. Below 0.6 it piles up unspendably; above 1.0 it
     * becomes the only bottleneck and alloy stops mattering.
     */
    const levels = Array.from({ length: 12 }, (_, i) => ECON.crystalCostFromLevel + i);
    for (const level of levels) {
      const ratio = costShare(level) / incomeShare(level);
      expect(ratio, `level ${String(level)} charges ${costShare(level).toFixed(2)}`).toBeGreaterThan(0.6);
      expect(ratio, `level ${String(level)} charges ${costShare(level).toFixed(2)}`).toBeLessThan(1);
    }
  });

  /**
   * The opening is where a dead resource does the most damage: it is the first
   * thing a new player learns about the economy. A store that fills before it has
   * anything to buy teaches them the number does not matter.
   */
  it('finds crystal something to buy before the store can fill', () => {
    const hoursToFirstSink = (() => {
      // Crystal earned by the time the player can afford the first upgrade that
      // charges any, assuming they spend nothing else on the way.
      const level = ECON.crystalCostFromLevel;
      const alloyNeeded = Array.from({ length: level + 1 }, (_, l) => upgradeCost(l).alloy).reduce(
        (a, b) => a + b,
        0,
      );
      return alloyNeeded / alloyRate(1);
    })();
    const hoursToFillStore = storageCap(crystalRate(1)) / crystalRate(1);
    expect(hoursToFirstSink).toBeLessThan(hoursToFillStore);
  });
});
