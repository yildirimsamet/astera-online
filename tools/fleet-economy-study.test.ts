import { describe, expect, it } from 'vitest';
import { HULLS } from '../packages/rules/src/hulls.js';
import { missionFuel } from '../packages/rules/src/fuel.js';
import { affordableFleet, compareFleets, cost } from './fleet-economy-study.js';

describe('fleet economy study accounting', () => {
  it('accounts for a sparse fleet without turning missing entries into NaN', () => {
    expect(cost({ VIPER: undefined, TALON: 1 })).toEqual({
      alloy: HULLS.TALON.alloy, crystal: HULLS.TALON.crystal, deuterium: HULLS.TALON.deuterium,
    });
  });
  it('does not substitute plentiful alloy for missing crystal', () => {
    expect(affordableFleet('TALON', { alloy: 1e6, crystal: 0, deuterium: 1e6 }, 1e6)).toEqual({});
  });
  it('reserves launch fuel as well as the recipe and respects hangar space', () => {
    const h = HULLS.VIPER;
    const wallet = { alloy: h.alloy * 3, crystal: h.crystal * 3,
      deuterium: h.deuterium * 3 + missionFuel({ VIPER: 3 }, 1250, 2) - 1 };
    expect(affordableFleet('VIPER', wallet, 100)).toEqual({ VIPER: 2 });
    expect(affordableFleet('VIPER', { alloy: 1e6, crystal: 1e6, deuterium: 1e6 }, 2)).toEqual({});
  });
  it('rejects invalid wallets instead of generating imaginary fleets', () => {
    expect(() => affordableFleet('VIPER', { alloy: -1, crystal: 100, deuterium: 100 }, 100)).toThrow();
  });
  it('counts destruction and economic losses separately, deterministically', () => {
    const args = [{ VIPER: 20 }, { BALLISTA: 1 }] as const;
    const result = compareFleets(...args);
    expect(compareFleets(...args)).toEqual(result);
    expect(result.samples).toBe(128);
    expect(result.defenderEliminated).toBe(128);
    expect(result.meanDefenderLoss.crystal).toBe(HULLS.BALLISTA.crystal);
    expect(result.meanDefenderLoss.deuterium).toBe(HULLS.BALLISTA.deuterium);
  });
});
