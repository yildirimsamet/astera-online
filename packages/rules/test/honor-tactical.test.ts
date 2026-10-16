import { describe, expect, it } from 'vitest';
import { honorPairCredit } from '../src/honor.js';
import { honorTacticalSide, type HonorTacticalInput } from '../src/honorTactical.js';

const fair: HonorTacticalInput = { ownTier: 4, enemyTier: 4, ownNavy: 379800, enemyNavy: 427200,
  related: false, eligible: true, weakRepeat: 0, retaliationFifths: 0,
  shieldDestroyed: 506, groundValue: 45000, groundWasOnline: true,
  addedBlackoutPpm: 1_000_000, loyaltyLost: 0 };

describe('proposed tactical EMP calculation, not yet activated in game settlements', () => {
  it('recognises new preparation without inventing a permanent ship loss', () => {
    const result = honorTacticalSide(fair);
    expect(result).toMatchObject({ raw: 4_000_000, gain: 4_000_000, lossDebit: 0, weakDebit: 0,
      groundBand: 'MEDIUM', pressureFifths: 160_000, retaliationSpentFifths: 0 });
    expect(honorPairCredit(0, result.raw, 0).a).toBe(3_921_568);
  });

  it.each([
    { enemyTier: 5, enemyNavy: fair.enemyNavy, raw: 5_000_000 },
    { enemyTier: 4, enemyNavy: 220000, raw: 2_000_000 },
    { enemyTier: 4, enemyNavy: 100000, raw: 0 },
  ])('uses the ordinary challenge bands: $enemyTier / $enemyNavy', ({ enemyTier, enemyNavy, raw }) => {
    expect(honorTacticalSide({ ...fair, enemyTier, enemyNavy }).raw).toBe(raw);
  });

  it('requires a genuine effect, not merely a successful launch', () => {
    expect(honorTacticalSide({ ...fair, shieldDestroyed: 0, groundValue: 0 }))
      .toMatchObject({ raw: 0, gain: 0, pressureFifths: 0, groundBand: 'NONE' });
    expect(honorTacticalSide({ ...fair, shieldDestroyed: 0, groundValue: 900 }).raw).toBe(0);
    expect(honorTacticalSide({ ...fair, shieldDestroyed: 0, groundWasOnline: false, addedBlackoutPpm: 0 }))
      .toMatchObject({ raw: 0, pressureFifths: 0, groundBand: 'NONE' });
  });

  it.each([
    { groundValue: 4999, band: 'NONE', raw: 0 }, { groundValue: 5000, band: 'SMALL', raw: 1_000_000 },
    { groundValue: 24999, band: 'SMALL', raw: 1_000_000 }, { groundValue: 25000, band: 'MEDIUM', raw: 2_000_000 },
    { groundValue: 99999, band: 'MEDIUM', raw: 2_000_000 }, { groundValue: 100000, band: 'LARGE', raw: 3_000_000 },
  ])('has an explicit coarse ground boundary: $groundValue', ({ groundValue, band, raw }) => {
    expect(honorTacticalSide({ ...fair, shieldDestroyed: 0, groundValue })).toMatchObject({ groundBand: band, raw });
  });

  it('reveals no exact private ground value through points or blackout duration', () => {
    for (const addedBlackoutPpm of [0, 1000, 100000, 1_000_000]) for (const enemyTier of [3, 4]) {
      const args = { ...fair, enemyTier, enemyNavy: 100000, addedBlackoutPpm };
      expect(honorTacticalSide({ ...args, groundValue: 25000 })).toEqual(honorTacticalSide({ ...args, groundValue: 99999 }));
    }
  });

  it('does not award fresh preparation for extending a currently disabled line', () => {
    const extended = { ...fair, shieldDestroyed: 0, groundWasOnline: false, addedBlackoutPpm: 100000 };
    expect(honorTacticalSide(extended)).toMatchObject({ raw: 0, pressureFifths: 8000 });
    expect(honorTacticalSide({ ...extended, enemyTier: 3, enemyNavy: 100000 }))
      .toMatchObject({ raw: -400000, weakDebit: 400000 });
  });

  it('counts fresh loyalty loss, capped despite the game’s small zero tolerance', () => {
    expect(honorTacticalSide({ ...fair, loyaltyLost: 20 }).raw).toBe(8_000_000);
    expect(honorTacticalSide({ ...fair, loyaltyLost: 20.0100002 }).raw).toBe(8_000_000);
    expect(honorTacticalSide({ ...fair, shieldDestroyed: 0, groundValue: 0, loyaltyLost: 10 }).raw).toBe(2_000_000);
  });

  it.each([{ weakRepeat: 0, raw: -8_000_000 }, { weakRepeat: 1, raw: -12_000_000 },
    { weakRepeat: 2, raw: -16_000_000 }, { weakRepeat: 200, raw: -16_000_000 }])('scales actual weak pressure, repeat $weakRepeat', ({ weakRepeat, raw }) => {
    expect(honorTacticalSide({ ...fair, enemyTier: 3, enemyNavy: 100000, weakRepeat })).toMatchObject({ raw, gain: 0, lossDebit: 0 });
  });

  it('keeps total pressure and consumed retaliation separate, without permitting a positive weak result', () => {
    const weak = { ...fair, enemyTier: 3, enemyNavy: 100000 };
    expect(honorTacticalSide({ ...weak, retaliationFifths: 80000 }))
      .toMatchObject({ raw: -4_000_000, pressureFifths: 160000, retaliationSpentFifths: 80000 });
    expect(honorTacticalSide({ ...weak, retaliationFifths: 999999 }))
      .toMatchObject({ raw: 0, pressureFifths: 160000, retaliationSpentFifths: 160000 });
  });

  it('bounds the maximum resource payment below one percent of the consumed weapon value', () => {
    const result = honorTacticalSide({ ...fair, enemyTier: 5, shieldDestroyed: 1e9, groundValue: 1e9, loyaltyLost: 20 });
    expect(result.raw).toBe(11_250_000);
    expect(honorPairCredit(0, result.raw, 0).a / 1e6 * 200).toBeLessThan(216000 * 0.01);
  });

  it('does not feed competitive points through related or excluded encounters', () => {
    expect(honorTacticalSide({ ...fair, related: true }).raw).toBe(0);
    expect(honorTacticalSide({ ...fair, eligible: false }))
      .toMatchObject({ raw: 0, pressureFifths: 0, groundBand: 'NONE' });
    expect(honorTacticalSide({ ...fair, related: true, enemyTier: 3, enemyNavy: 100000 }).raw).toBeLessThan(0);
  });

  it('preserves actual tiny effects in integer micros and does not award rounded phantom pressure', () => {
    const tiny = { ...fair, shieldDestroyed: 0.25, groundValue: 0, addedBlackoutPpm: 0 };
    expect(honorTacticalSide(tiny)).toMatchObject({ raw: 1000, pressureFifths: 40 });
    expect(honorTacticalSide({ ...tiny, shieldDestroyed: 0 })).toMatchObject({ raw: 0, pressureFifths: 0 });
  });

  it.each([
    { shieldDestroyed: -1 }, { shieldDestroyed: Infinity }, { groundValue: -1 }, { groundValue: 1.5 },
    { addedBlackoutPpm: 1_000_001 }, { addedBlackoutPpm: -1 }, { loyaltyLost: 21 }, { loyaltyLost: NaN },
    { weakRepeat: -1 }, { retaliationFifths: -1 },
  ])('rejects invalid tactical evidence: %j', over => {
    expect(() => honorTacticalSide({ ...fair, ...over })).toThrow();
  });
});
