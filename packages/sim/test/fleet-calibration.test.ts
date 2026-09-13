import { describe, expect, it } from 'vitest';
import { COMBAT_HULLS, HULLS, fleetEntries, missionFuel } from '@astera/rules';
import { economicFleetValue, fleetAtEconomicBudget, fleetAtWallet, measureFleetBattle, runFleetCalibration } from '../src/fleet-calibration.js';

describe('economic fleet calibration uses the real resolver', () => {
  it('sizes only whole, affordable hulls, including zero and sub-hull budgets', () => {
    expect(fleetAtEconomicBudget('DART', 840)).toEqual({ DART: 2 });
    expect(fleetAtEconomicBudget('DART', 419)).toEqual({});
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
    const wallet = { alloy: 750, crystal: 180, deuterium: 2 };
    expect(fleetAtWallet({ VIPER: 1 }, wallet)).toEqual({ VIPER: 1 });
    expect(fleetAtWallet({ DART: 1 }, wallet)).toEqual({ DART: 2 });
    expect(fleetAtWallet({ DART: 1 }, { alloy: 3000, crystal: 0, deuterium: 100 })).toEqual({});
    expect(fleetAtWallet({ DART: 1 }, { alloy: 300, crystal: 60, deuterium: 0 }, 600)).toEqual({});
    expect(wallet).toEqual({ alloy: 750, crystal: 180, deuterium: 2 });
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
    expect(loss.meanNet).toBe(-420 - loss.fuel * 32);
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
});
