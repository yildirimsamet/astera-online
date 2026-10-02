import { describe, expect, it } from 'vitest';
import {
  COMBAT_HULLS, HULLS, fleetEntries, missionFuel, mulberry32, needsDock, resolveCombat, resourceValue, shipRepairCost,
} from '@astera/rules';
import { economicFleetValue, fleetAtEconomicBudget, fleetAtWallet, measureFleetBattle, runFleetCalibration } from '../src/fleet-calibration.js';

/**
 * PRICED OFF `HULLS`, NEVER OFF A REMEMBERED NUMBER. Owner review, 2026-09-21, closing the three
 * reds §17.2 assigned to Faz 1.1.
 *
 * These read `840`, `419`, a literal wallet and `-420`, all of which were the Dart's and Viper's
 * prices on the day they were written. A hull rebalance then made three calibration tests fail
 * while nothing about the calibration was wrong — which is the worst kind of red, because it says
 * "the measurement is broken" when the measurement is fine.
 *
 * Every figure below is now derived from the catalogue, so a price change moves the test with the
 * game and only a real defect in `fleetAtEconomicBudget` / `fleetAtWallet` / `measureFleetBattle`
 * can turn one red.
 */
const econ = (id: 'DART' | 'VIPER'): number =>
  HULLS[id].alloy + 2 * HULLS[id].crystal + 32 * HULLS[id].deuterium;

describe('economic fleet calibration uses the real resolver', () => {
  it('sizes only whole, affordable hulls, including zero and sub-hull budgets', () => {
    expect(fleetAtEconomicBudget('DART', econ('DART') * 2)).toEqual({ DART: 2 });
    expect(fleetAtEconomicBudget('DART', econ('DART') - 1)).toEqual({});
    expect(fleetAtEconomicBudget('DART', 0)).toEqual({});
    for (const budget of [-1, NaN, Infinity]) expect(() => fleetAtEconomicBudget('DART', budget)).toThrow();
    for (const id of COMBAT_HULLS) {
      const f = fleetAtEconomicBudget(id, 240_000);
      expect(economicFleetValue(f)).toBeLessThanOrEqual(240_000);
      expect(economicFleetValue(f) + HULLS[id].alloy + 2 * HULLS[id].crystal + 32 * HULLS[id].deuterium)
        .toBeGreaterThan(240_000);
    }
  });

  it('does not count defeated, empty or mutually annihilated wings as profitable victories', () => {
    const r = measureFleetBattle({ DART: 1 }, { BALLISTA: 100 }, { samples: 16 });
    expect(r.victories).toBe(0);
    expect(r.meanWinningLoss).toBeNull();
    const walkover = measureFleetBattle({ DART: 1 }, {}, { samples: 16 });
    expect(walkover.grades.DECISIVE).toBe(16);
    expect(walkover.defended).toBe(false);
    expect(walkover.roundsMean).toBe(0);
    const empty = measureFleetBattle({}, {}, { samples: 16 });
    expect(empty.victories).toBe(0);
  });

  it('reproduces seeded results and rejects meaningless sample counts', () => {
    const run = () => measureFleetBattle({ VIPER: 12 }, { SENTINEL: 12 }, { samples: 16 });
    expect(run()).toEqual(run());
    for (const samples of [0, -1, 1.5, Infinity]) {
      expect(() => measureFleetBattle({ DART: 1 }, {}, { samples })).toThrow();
    }
  });

  it('compares physical wallets without converting spare ore or granting missing fuel', () => {
    /*
      A PURSE THAT HOLDS EXACTLY ONE VIPER AND EXACTLY TWO DARTS, whatever those two cost today.
      The Viper is the larger of the two packets in every resource, so its price IS the purse — and
      two Darts fit inside it while three do not, which is what makes both assertions below say
      something about the sizer rather than about a remembered number.
    */
    const wallet = {
      alloy: HULLS.VIPER.alloy,
      crystal: HULLS.VIPER.crystal,
      deuterium: HULLS.VIPER.deuterium,
    };
    const fits = Math.min(
      Math.floor(wallet.alloy / HULLS.DART.alloy),
      Math.floor(wallet.crystal / HULLS.DART.crystal),
    );
    expect(fits).toBe(2);
    expect(fleetAtWallet({ VIPER: 1 }, wallet)).toEqual({ VIPER: 1 });
    expect(fleetAtWallet({ DART: 1 }, wallet)).toEqual({ DART: 2 });
    // Alloy alone never buys a hull that also wants crystal, however much of it there is.
    expect(fleetAtWallet({ DART: 1 }, { alloy: HULLS.DART.alloy * 8, crystal: 0, deuterium: 100 }))
      .toEqual({});
    // And a purse one unit short of a single hull buys none of it.
    expect(fleetAtWallet(
      { DART: 1 },
      { alloy: HULLS.DART.alloy - 1, crystal: HULLS.DART.crystal, deuterium: 0 },
      600,
    )).toEqual({});
    expect(wallet).toEqual({
      alloy: HULLS.VIPER.alloy, crystal: HULLS.VIPER.crystal, deuterium: HULLS.VIPER.deuterium,
    });
    for (const invalid of [{}, { DART: 0 }, { DART: 1.5 }, { THORN: 1 }]) {
      expect(() => fleetAtWallet(invalid, wallet)).toThrow();
    }
    expect(() => fleetAtWallet({ DART: 1 }, { ...wallet, crystal: -1 })).toThrow();
    expect(() => fleetAtWallet({ DART: 1 }, wallet, Infinity)).toThrow();
  });

  it('reserves both real fuel legs before sizing a mixed packet', () => {
    const wallet = { alloy: 10_000, crystal: 5000, deuterium: 40 };
    const fleet = fleetAtWallet({ VIPER: 2, TALON: 1, WAYFARER: 1 }, wallet, 1250);
    const price = (f: typeof fleet, key: 'alloy' | 'crystal' | 'deuterium') =>
      fleetEntries(f).reduce((sum, [id, count]) => sum + HULLS[id][key] * count, 0);
    expect(fleet).toEqual({ VIPER: 2, TALON: 1, WAYFARER: 1 });
    expect(price(fleet, 'deuterium') + missionFuel(fleet, 1250, 2)).toBeLessThanOrEqual(wallet.deuterium);
    const next = { VIPER: 4, TALON: 2, WAYFARER: 2 };
    expect(price(next, 'deuterium') + missionFuel(next, 1250, 2)).toBeGreaterThan(wallet.deuterium);
  });

  it('prices raid proceeds after real cargo, losses, salvage and prepaid fuel', () => {
    const emptyRaid = measureFleetBattle({ DART: 1 }, {}, { samples: 8,
      raid: { store: { alloy: 0, crystal: 1000, deuterium: 0 },
        buffer: { alloy: 0, crystal: 0, deuterium: 0 },
        protected: { alloy: 0, crystal: 0, deuterium: 0 }, distance: 600 } });
    expect(emptyRaid.meanLoot).toEqual({ alloy: 0, crystal: HULLS.DART.cargo, deuterium: 0 });
    expect(emptyRaid.fuel).toBe(missionFuel({ DART: 1 }, 600, 2));
    expect(emptyRaid.meanNet).toBe(HULLS.DART.cargo * 2 - emptyRaid.fuel * 32);
    expect(emptyRaid.defended).toBe(false);
    const loss = measureFleetBattle({ DART: 1 }, { BALLISTA: 100 }, { samples: 8,
      raid: { store: { alloy: 1000, crystal: 1000, deuterium: 1000 },
        buffer: { alloy: 0, crystal: 0, deuterium: 0 },
        protected: { alloy: 0, crystal: 0, deuterium: 0 }, distance: 600 } });
    expect(loss.meanLoot).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
    /*
      THE WHOLE COMMITTED HULL, PRICED ON THE REPLACEMENT BASE. A+2C+32D, the same base the fuel
      below it is priced on — mixing the two was the defect the raid ledger was built to make
      impossible, and this line is where the sim states the same rule.
    */
    expect(loss.meanNet).toBe(-econ('DART') - loss.fuel * 32);
  });

  const report = () => runFleetCalibration({ samples: 64, budgets: [240_000] });
  it('checks every ordered combat pair at equal economic budget, with neutral and equal maximum research', () => {
    const r = report();
    expect(r.pairs).toHaveLength(COMBAT_HULLS.length ** 2 * 2);
    for (const row of r.pairs) {
      expect(row.attackerSpend).toBeLessThanOrEqual(row.budget);
      expect(row.defenderSpend).toBeLessThanOrEqual(row.budget);
      if (row.counter > 1) expect(row.result.meanExchange, `${row.attacker} -> ${row.defender}`).toBeGreaterThan(0);
      if (row.counter < 1) expect(row.result.meanExchange, `${row.attacker} -> ${row.defender}`).toBeLessThan(0);
    }
  });

  it('makes every higher-tier hull win the mean same-profile exchange at the same available economic budget', () => {
    const r = report();
    expect(r.progression).toHaveLength(12);
    for (const row of r.progression) {
      expect(row.result.meanExchange, `${row.higher} against ${row.lower}`).toBeGreaterThan(0);
      expect(row.result.meanAttackerRetained).toBeGreaterThan(row.result.meanDefenderRetained);
    }
  });

  /*
    KALICI GEMİ HASARI, PRICED. `plan.md` F7.

    A survivor carried out over 20% damaged waits in the Repair Station, and its repair
    is a bill the fight left behind. Measured at full price (no Industrial), for both
    sides, from the resolver's own damage lists — so the calibration can say whether
    that bill moves any exchange it reports.
  */
  it('prices the Repair Station bill each side carries out of a fight', () => {
    const attacker = { DART: 2 }, defender = { STRONGHOLD: 1 };
    const r = measureFleetBattle(attacker, defender, { samples: 16 });
    let a = 0, d = 0;
    for (let seed = 1; seed <= 16; seed++) {
      const fight = resolveCombat(attacker, defender, 0, mulberry32(seed), { attacker: { tech: {} }, defender: { tech: {} } });
      a += resourceValue(shipRepairCost(fight.attackerDamage.filter((lot) => needsDock(lot.damageBp)), 100)) / 16;
      d += resourceValue(shipRepairCost(fight.defenderDamage.filter((lot) => needsDock(lot.damageBp)), 100)) / 16;
    }
    expect(a).toBeGreaterThan(0);
    expect(d).toBeGreaterThan(0);
    expect(r.meanAttackerRepair).toBeCloseTo(a, 6);
    expect(r.meanDefenderRepair).toBeCloseTo(d, 6);
  });

  it('bills nothing for a walkover, and nothing for guns on the ground', () => {
    expect(measureFleetBattle({ DART: 3 }, {}, { samples: 8 }).meanAttackerRepair).toBe(0);
    expect(measureFleetBattle({ DART: 1 }, { THORN: 4 }, { samples: 8 }).meanDefenderRepair).toBe(0);
  });
});
