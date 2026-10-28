import { describe, expect, it } from 'vitest';
import { MULTI_WORLD } from '../../src/constants.js';
import { ADMIRAL_WAIT, admiralBonuses, admiralDefeated, admiralOpen, admiralOutcome, admiralApplies, admiralXp } from '../../src/arena/admiral.js';

describe('the commander as a fleet admiral', () => {
  it('gates the new bonuses on the new season and bounds class/level effects to the approved ceilings', () => {
    expect(admiralApplies(18)).toBe(false); expect(admiralApplies(19)).toBe(true);
    expect(admiralBonuses('akinci', 1)).toEqual({ damage: 1.02, hull: 1, time: 1, fuel: 1 });
    expect(admiralBonuses('akinci', 20).damage).toBeCloseTo(1.05);
    expect(admiralBonuses('muhafiz', 1).hull).toBeCloseTo(1.02);
    expect(admiralBonuses('muhafiz', 20).hull).toBeCloseTo(1.05);
    expect(admiralBonuses('kilavuz', 1)).toEqual({ damage: 1, hull: 1, time: .97, fuel: .95 });
    expect(admiralBonuses('kilavuz', 20).time).toBeCloseTo(.94);
    expect(admiralBonuses('kilavuz', 20).fuel).toBeCloseTo(.9);
    expect(admiralBonuses('akinci', 100)).toEqual(admiralBonuses('akinci', 20));
    expect(admiralBonuses('kilavuz', Number.NaN)).toEqual(admiralBonuses('kilavuz', 1));
  });
  // Owner 2026-10-26: the escort opens in the live season too, from one explicit instant.
  it('opens in a season dealt it, or in a live one from the moment it was switched on', () => {
    const at = new Date('2026-10-27T10:00:00Z');
    expect(admiralOpen({ rulesetVersion: 19, admiralStartsAt: null }, at)).toBe(true);
    expect(admiralOpen({ rulesetVersion: 18, admiralStartsAt: null }, at)).toBe(false);
    expect(admiralOpen({ rulesetVersion: 18, admiralStartsAt: at }, at)).toBe(true);
    expect(admiralOpen({ rulesetVersion: 18, admiralStartsAt: at }, new Date(at.getTime() - 1))).toBe(false);
    // Codex review CR5: a new season is dealt it with no switch.
    expect(admiralApplies(MULTI_WORLD.rulesetVersion)).toBe(true);
  });
  it('earns XP by the size of the battle, bounded, and a little for a quiet escort', () => {
    expect(admiralXp(false, 0)).toBe(5);
    expect(admiralXp(true, 0)).toBe(10);
    expect(admiralXp(true, 8_000)).toBe(40);
    expect(admiralXp(true, 1_000_000)).toBe(100);
    expect(admiralXp(true, Number.NaN)).toBe(10);
  });
  it('never dies with its fleet: a lost battle or a fleet gone to the last ship sends it to repair, otherwise service', () => {
    // Owner 2026-10-28: the Yarık's waits went to 3 min for now; an escort keeps its own 60 / 10.
    expect(ADMIRAL_WAIT).toEqual({ repairMinutes: 60, serviceMinutes: 10 });
    expect(admiralOutcome({ fought: false, lost: false, landedShips: 3, lostValue: 0 })).toEqual({ xp: 5, readyReason: 'service', minutes: 10 });
    expect(admiralOutcome({ fought: true, lost: false, landedShips: 8, lostValue: 8_000 })).toEqual({ xp: 40, readyReason: 'service', minutes: 10 });
    expect(admiralOutcome({ fought: true, lost: true, landedShips: 4, lostValue: 8_000 })).toEqual({ xp: 40, readyReason: 'repair', minutes: 60 });
    expect(admiralOutcome({ fought: true, lost: false, landedShips: 0, lostValue: 0 })).toEqual({ xp: 10, readyReason: 'repair', minutes: 60 });
  });
  it('reads defeat from the escorted side: a raid repelled, a defence broken decisively', () => {
    expect(admiralDefeated('attack', 'REPELLED')).toBe(true);
    expect(admiralDefeated('attack', 'PARTIAL')).toBe(false);
    expect(admiralDefeated('attack', 'DECISIVE')).toBe(false);
    expect(admiralDefeated('defence', 'DECISIVE')).toBe(true);
    expect(admiralDefeated('defence', 'PARTIAL')).toBe(false);
    expect(admiralDefeated('defence', 'REPELLED')).toBe(false);
  });
});
