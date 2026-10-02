import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ALL_HULLS,
  HULLS,
  MOBILE_HULLS,
  MULTI_WORLD,
  SHIP_DAMAGE,
  SALVAGE,
  applyDose,
  capLoadToSurvivors,
  carryToBp,
  fleetCargo,
  dockLocation,
  fleetCount,
  hullWorkMinutes,
  isDockLocation,
  lotsWithin,
  needsDock,
  normalizeLots,
  shipDamageApplies,
  shipRepairCost,
  shipRepairInvoice,
  shipRepairMinutes,
  shipRepairWorkMinutes,
  splitForLanding,
  type DamageLot,
  type Fleet,
  type HullId,
} from '../src/index.js';

/**
 * KALICI GEMİ HASARI — THE PURE FOUNDATION. Owner decision, 2026-09-29 (`plan.md` F0).
 *
 * Damage is a share of a ship's maximum hull, in whole basis points. A ship at or under
 * `autoRepairMaxBp` is patched for free the moment it is judged; above it, the ship waits
 * in the Repair Station dock until its commander pays to repair it; at `destroyedBp` it
 * no longer exists.
 */

const lot = (hull: HullId, count: number, damageBp: number): DamageLot => ({ hull, count, damageBp });
const total = (lots: readonly DamageLot[]): number => lots.reduce((sum, row) => sum + row.count, 0);

describe('the rule arrives with a season, never inside one', () => {
  // K5: persistent damage ships with the next season — the one a new galaxy is created at.
  it('is dealt to every season created from now on', () => {
    expect(shipDamageApplies(MULTI_WORLD.rulesetVersion)).toBe(true);
  });

  it('opens at ruleset 14 and stays shut below it', () => {
    expect(MULTI_WORLD.shipDamageRulesetVersion).toBe(14);
    expect(shipDamageApplies(1)).toBe(false);
    expect(shipDamageApplies(13)).toBe(false);
    expect(shipDamageApplies(14)).toBe(true);
    expect(shipDamageApplies(15)).toBe(true);
  });

  it('draws the free-repair line at exactly twenty percent, inclusive', () => {
    expect(SHIP_DAMAGE.autoRepairMaxBp).toBe(2000);
    expect(SHIP_DAMAGE.destroyedBp).toBe(10_000);
    expect(needsDock(1)).toBe(false);
    expect(needsDock(2000)).toBe(false);
    expect(needsDock(2001)).toBe(true);
    expect(needsDock(9999)).toBe(true);
  });
});

describe('the dock is a location in `units`', () => {
  it('namespaces a lot the way mining and raids namespace theirs', () => {
    expect(dockLocation('0f0e8a4e-1111-4222-8333-444455556666'))
      .toBe('dock:0f0e8a4e-1111-4222-8333-444455556666');
    expect(isDockLocation('dock:abc')).toBe(true);
    expect(isDockLocation('home')).toBe(false);
    expect(isDockLocation('mine:abc')).toBe(false);
    expect(isDockLocation('0f0e8a4e-1111-4222-8333-444455556666')).toBe(false);
  });
});

describe('carryToBp — the part-damaged ship a battle leaves behind', () => {
  it('reads the leftover hit as a share of that ship', () => {
    expect(carryToBp(0, 100)).toBe(0);
    expect(carryToBp(20, 100)).toBe(2000);
    expect(carryToBp(64, 100)).toBe(6400);
  });

  it('rounds a sliver to healthy and never rounds a survivor to destroyed', () => {
    expect(carryToBp(0.004, 100)).toBe(0);
    expect(carryToBp(99.996, 100)).toBe(9999);
  });

  it('refuses a carry no survivor could hold', () => {
    expect(() => carryToBp(-1, 100)).toThrow(RangeError);
    expect(() => carryToBp(100, 100)).toThrow(RangeError);
    expect(() => carryToBp(5, 0)).toThrow(RangeError);
    expect(() => carryToBp(Number.NaN, 100)).toThrow(RangeError);
  });
});

describe('normalizeLots — one row per identical damage state', () => {
  it('merges the same hull at the same damage and keeps different damage apart', () => {
    expect(normalizeLots([
      lot('BALLISTA', 1, 6400),
      lot('BALLISTA', 2, 6400),
      lot('BALLISTA', 1, 3000),
    ])).toEqual([lot('BALLISTA', 3, 6400), lot('BALLISTA', 1, 3000)]);
  });

  it('drops empty and healthy rows', () => {
    expect(normalizeLots([lot('DART', 0, 5000), lot('DART', 3, 0)])).toEqual([]);
  });

  it('orders by catalogue, then most damaged first — the order a battle kills them in', () => {
    const out = normalizeLots([lot('PIKE', 1, 2500), lot('DART', 1, 3000), lot('PIKE', 1, 9000)]);
    expect(out).toEqual([lot('DART', 1, 3000), lot('PIKE', 1, 9000), lot('PIKE', 1, 2500)]);
  });

  it('refuses malformed rows rather than guessing at them', () => {
    expect(() => normalizeLots([lot('DART', 1.5, 3000)])).toThrow(RangeError);
    expect(() => normalizeLots([lot('DART', -1, 3000)])).toThrow(RangeError);
    expect(() => normalizeLots([lot('DART', 1, 2500.5)])).toThrow(RangeError);
    expect(() => normalizeLots([lot('DART', 1, -5)])).toThrow(RangeError);
    expect(() => normalizeLots([lot('DART', 1, 10_000)])).toThrow(RangeError);
    expect(() => normalizeLots([lot('NOT_A_HULL' as HullId, 1, 3000)])).toThrow(RangeError);
  });

  it('is idempotent and conserves every ship', () => {
    const arbLot = fc.record({
      hull: fc.constantFrom(...ALL_HULLS),
      count: fc.integer({ min: 0, max: 50 }),
      damageBp: fc.integer({ min: 1, max: 9999 }),
    });
    fc.assert(fc.property(fc.array(arbLot, { maxLength: 20 }), (lots) => {
      const once = normalizeLots(lots);
      expect(normalizeLots(once)).toEqual(once);
      expect(total(once)).toBe(total(lots));
    }));
  });
});

describe('splitForLanding — what the Repair Station decides when ships touch down', () => {
  it('sends the lightly damaged home repaired and docks the rest', () => {
    const out = splitForLanding({ BALLISTA: 10, DART: 4 }, [
      lot('BALLISTA', 1, 2000),
      lot('BALLISTA', 2, 2001),
      lot('DART', 4, 9000),
    ]);
    expect(out.home).toEqual({ BALLISTA: 8 });
    expect(out.autoRepaired).toEqual([lot('BALLISTA', 1, 2000)]);
    // Catalogue order: a Dart is listed before a Ballista.
    expect(out.docked).toEqual([lot('DART', 4, 9000), lot('BALLISTA', 2, 2001)]);
  });

  it('lands an undamaged fleet exactly as it is', () => {
    expect(splitForLanding({ PIKE: 5 }, [])).toEqual({ home: { PIKE: 5 }, autoRepaired: [], docked: [] });
    expect(splitForLanding({ PIKE: 5 }, null)).toEqual({ home: { PIKE: 5 }, autoRepaired: [], docked: [] });
  });

  it('refuses damage on ships that are not in the fleet', () => {
    expect(() => splitForLanding({ PIKE: 1 }, [lot('PIKE', 2, 5000)])).toThrow(RangeError);
    expect(() => splitForLanding({ PIKE: 1 }, [lot('DART', 1, 5000)])).toThrow(RangeError);
  });

  it('never creates or loses a ship', () => {
    const arb = fc.tuple(
      fc.constantFrom(...MOBILE_HULLS),
      fc.integer({ min: 0, max: 40 }),
      fc.array(fc.integer({ min: 1, max: 9999 }), { maxLength: 40 }),
    );
    fc.assert(fc.property(arb, ([hull, healthy, damages]) => {
      const fleet: Fleet = { [hull]: healthy + damages.length };
      const out = splitForLanding(fleet, damages.map((bp) => lot(hull, 1, bp)));
      expect(fleetCount(out.home) + total(out.docked)).toBe(fleetCount(fleet));
      for (const row of out.docked) expect(needsDock(row.damageBp)).toBe(true);
      for (const row of out.autoRepaired) expect(needsDock(row.damageBp)).toBe(false);
    }));
  });
});

describe('lotsWithin — the damage a part of the fleet takes with it', () => {
  it('keeps the lots of the hulls in that part and leaves the rest', () => {
    const lots = [lot('DART', 2, 6000), lot('COURIER', 1, 3000)];
    expect(lotsWithin(lots, { DART: 5 })).toEqual([lot('DART', 2, 6000)]);
    expect(lotsWithin(lots, { COURIER: 1 })).toEqual([lot('COURIER', 1, 3000)]);
    expect(lotsWithin(lots, {})).toEqual([]);
    expect(lotsWithin(null, { DART: 5 })).toEqual([]);
  });

  it('refuses a part too small to carry its own damage', () => {
    expect(() => lotsWithin([lot('DART', 2, 6000)], { DART: 1 })).toThrow(RangeError);
  });
});

describe('applyDose — environmental damage adds to every ship alike', () => {
  it('changes nothing at zero', () => {
    expect(applyDose({ DART: 3 }, [lot('DART', 1, 4000)], 0)).toEqual({
      fleet: { DART: 3 },
      lots: [lot('DART', 1, 4000)],
      destroyed: {},
    });
  });

  it('damages the healthy ships as a group', () => {
    expect(applyDose({ DART: 5 }, [], 3000)).toEqual({
      fleet: { DART: 5 },
      lots: [lot('DART', 5, 3000)],
      destroyed: {},
    });
  });

  it('kills the ships the dose carries to a full hull, and those only', () => {
    expect(applyDose({ DART: 5 }, [lot('DART', 1, 8000)], 2500)).toEqual({
      fleet: { DART: 4 },
      lots: [lot('DART', 4, 2500)],
      destroyed: { DART: 1 },
    });
    expect(applyDose({ DART: 2 }, [lot('DART', 1, 5000)], 5000)).toEqual({
      fleet: { DART: 1 },
      lots: [lot('DART', 1, 5000)],
      destroyed: { DART: 1 },
    });
    expect(applyDose({ DART: 2, PIKE: 1 }, [], 10_000)).toEqual({ fleet: {}, lots: [], destroyed: { DART: 2, PIKE: 1 } });
  });

  it('refuses a dose that is not a whole, non-negative number of basis points', () => {
    expect(() => applyDose({ DART: 1 }, [], -1)).toThrow(RangeError);
    expect(() => applyDose({ DART: 1 }, [], 10.5)).toThrow(RangeError);
  });

  it('conserves every ship and never leaves a destroyed one in a lot', () => {
    const arb = fc.tuple(
      fc.integer({ min: 0, max: 30 }),
      fc.array(fc.integer({ min: 1, max: 9999 }), { maxLength: 30 }),
      fc.integer({ min: 0, max: 12_000 }),
    );
    fc.assert(fc.property(arb, ([healthy, damages, dose]) => {
      const fleet: Fleet = { TALON: healthy + damages.length };
      const out = applyDose(fleet, damages.map((bp) => lot('TALON', 1, bp)), dose);
      expect(fleetCount(out.fleet) + fleetCount(out.destroyed)).toBe(fleetCount(fleet));
      expect(total(out.lots)).toBeLessThanOrEqual(fleetCount(out.fleet));
      for (const row of out.lots) {
        expect(row.damageBp).toBeLessThan(SHIP_DAMAGE.destroyedBp);
        expect(row.damageBp).toBeGreaterThanOrEqual(dose);
      }
    }));
  });
});

describe('shipRepairInvoice — the damaged share of the ship\'s own price', () => {
  it('prices the owner\'s worked example', () => {
    expect(shipRepairInvoice({ alloy: 1000, crystal: 500, deuterium: 0 }, 1, 4000, 100))
      .toEqual({ alloy: 400, crystal: 200, deuterium: 0 });
  });

  it('charges every production resource, deuterium included, rounded up', () => {
    const ballista = { alloy: 1988, crystal: 761, deuterium: 6 };
    expect(shipRepairInvoice(ballista, 1, 6400, 100)).toEqual({ alloy: 1273, crystal: 488, deuterium: 4 });
    expect(shipRepairInvoice(ballista, 1, 6400, 75)).toEqual({ alloy: 955, crystal: 366, deuterium: 3 });
    expect(shipRepairInvoice(ballista, 1, 6400, 50)).toEqual({ alloy: 637, crystal: 244, deuterium: 2 });
  });

  it('rounds once per lot, in integers, so a float cannot tip a ceiling', () => {
    // 700 × 0.07 is 49.00000000000001 in floating point; the invoice must say 49.
    expect(shipRepairInvoice({ alloy: 700, crystal: 0, deuterium: 0 }, 1, 700, 100).alloy).toBe(49);
    expect(shipRepairInvoice({ alloy: 700, crystal: 0, deuterium: 0 }, 1, 700, 75).alloy).toBe(37);
    expect(shipRepairInvoice({ alloy: 1000, crystal: 0, deuterium: 0 }, 3, 3333, 100).alloy).toBe(1000);
  });

  it('refuses inputs that are not a real repair', () => {
    const unit = { alloy: 100, crystal: 0, deuterium: 0 };
    expect(() => shipRepairInvoice(unit, 0, 3000, 100)).toThrow(RangeError);
    expect(() => shipRepairInvoice(unit, 1, 0, 100)).toThrow(RangeError);
    expect(() => shipRepairInvoice(unit, 1, 10_000, 100)).toThrow(RangeError);
    expect(() => shipRepairInvoice(unit, 1, 3000, 0)).toThrow(RangeError);
    expect(() => shipRepairInvoice(unit, 1, 3000, 101)).toThrow(RangeError);
  });

  it('never costs more than building the same ships new', () => {
    const arb = fc.tuple(
      fc.constantFrom(...ALL_HULLS),
      fc.integer({ min: 1, max: 10_000 }),
      fc.integer({ min: 1, max: 9999 }),
      fc.constantFrom(100, 75, 50),
    );
    fc.assert(fc.property(arb, ([hull, count, bp, pct]) => {
      const bill = shipRepairCost([lot(hull, count, bp)], pct);
      expect(bill.alloy).toBeLessThanOrEqual(HULLS[hull].alloy * count);
      expect(bill.crystal).toBeLessThanOrEqual(HULLS[hull].crystal * count);
      expect(bill.deuterium).toBeLessThanOrEqual(HULLS[hull].deuterium * count);
    }));
  });
});

describe('shipRepairCost — every lot at the catalogue price', () => {
  it('sums the lots, each invoiced on its own', () => {
    const lots = [lot('BALLISTA', 1, 6400), lot('TALON', 2, 3500)];
    const one = shipRepairInvoice(HULLS.BALLISTA, 1, 6400, 100);
    const two = shipRepairInvoice(HULLS.TALON, 2, 3500, 100);
    expect(shipRepairCost(lots, 100)).toEqual({
      alloy: one.alloy + two.alloy,
      crystal: one.crystal + two.crystal,
      deuterium: one.deuterium + two.deuterium,
    });
    expect(shipRepairCost([], 100)).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
  });
});

describe('shipRepairMinutes — the damaged share of the yard\'s own time', () => {
  it('works the owner\'s example: ten minutes at forty percent is four', () => {
    expect(shipRepairWorkMinutes(10, 4000, 100)).toBeCloseTo(4, 10);
    expect(shipRepairWorkMinutes(10, 4000, 75)).toBeCloseTo(3, 10);
    expect(shipRepairWorkMinutes(10, 4000, 50)).toBeCloseTo(2, 10);
  });

  it('prices a lot at the world\'s Shipyard and the commander\'s research', () => {
    const tech = { YARD_AUTOMATION: 2 };
    const expected = hullWorkMinutes('BALLISTA', 3, 4, tech) * 0.64
      + hullWorkMinutes('TALON', 1, 4, tech) * 0.35;
    expect(shipRepairMinutes([lot('BALLISTA', 3, 6400), lot('TALON', 1, 3500)], 4, tech, 100))
      .toBeCloseTo(expected, 9);
    expect(shipRepairMinutes([lot('BALLISTA', 3, 6400)], 4, tech, 50))
      .toBeCloseTo(hullWorkMinutes('BALLISTA', 3, 4, tech) * 0.32, 9);
    expect(shipRepairMinutes([], 4, tech, 100)).toBe(0);
  });
});

describe('capLoadToSurvivors — what a wing carries is what its survivors can hold (D9)', () => {
  const loot = { alloy: 6_000, crystal: 3_000, deuterium: 1_000 };
  const salvage = { alloy: 9_000, crystal: 4_500, deuterium: 1_500 };

  it('leaves a load the survivors can carry exactly as it was', () => {
    const survivors: Fleet = { COURIER: 100, GARBAGE_COLLECTOR: 2 };
    expect(fleetCargo(survivors, {})).toBeGreaterThanOrEqual(10_000);
    expect(capLoadToSurvivors({ loot, salvage }, survivors, {})).toEqual({ loot, salvage });
  });

  it('shrinks the haul to the holds left, in its own proportions, never rounding up', () => {
    const survivors: Fleet = { COURIER: 1 };
    const room = fleetCargo(survivors, {});
    const capped = capLoadToSurvivors({ loot, salvage: null }, survivors, {});
    const kept = capped.loot!;
    expect(kept.alloy + kept.crystal + kept.deuterium).toBeLessThanOrEqual(room);
    expect(kept.alloy).toBe(Math.floor(6_000 * (room / 10_000)));
    expect(kept.crystal).toBe(Math.floor(3_000 * (room / 10_000)));
    expect(capped.salvage).toBeNull();
  });

  it('lifts only what the surviving collectors can', () => {
    const one = capLoadToSurvivors({ loot: null, salvage }, { GARBAGE_COLLECTOR: 1 }, {});
    const lifted = one.salvage!;
    expect(lifted.alloy + lifted.crystal + lifted.deuterium).toBeLessThanOrEqual(SALVAGE.perCollector);
    expect(one.loot).toBeNull();
    // A collector's hold is not a cargo hold, and a cargo hold is not a collector.
    expect(capLoadToSurvivors({ loot: null, salvage }, { COURIER: 100 }, {}).salvage)
      .toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
  });

  it('loses everything with the last ship', () => {
    expect(capLoadToSurvivors({ loot, salvage }, {}, {})).toEqual({
      loot: { alloy: 0, crystal: 0, deuterium: 0 },
      salvage: { alloy: 0, crystal: 0, deuterium: 0 },
    });
  });
});
