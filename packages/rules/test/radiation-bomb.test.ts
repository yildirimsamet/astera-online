import { describe, expect, it } from 'vitest';
import {
  HULLS, RADIATION_BOMB, RADIATION_LEVEL_HP_PER_MINUTE,
  applyHpDose, firstHpLossAtMs, hpLethalAtMs, hpWingLethalAtMs,
  protectedRadiationHp, radiationBombBuildSeconds, radiationBombLevel,
  segmentsDoseBp, segmentsExposureHp,
  type HpRadiationSource, type Segment,
} from '../src/index.js';

const minute = 60_000;
const target = { kind: 'MONUMENT' as const, id: 'monument' };
const point = { x: 0, y: 0, z: 0 };
const hold = (from: number, until: number): Segment[] => [{
  from: point, to: point, startMs: from * minute, endMs: until * minute, target,
}];
const source = (id: string, rate: number, from = 0, until: number | null = null,
  capFrom = 0): HpRadiationSource & { totalCapFromMs: number } => ({
  id, mode: 'EMIT', center: point, radius: 10, target,
  intensityHpPerMinute: rate, activeFromMs: from * minute,
  activeUntilMs: until === null ? null : until * minute,
  totalCapFromMs: capFrom * minute,
});

describe('approved Radiation Bomb catalogue', () => {
  it('keeps each level independent with one occupied stock slot and the agreed gates', () => {
    expect(RADIATION_BOMB).toMatchObject({ stockPerLevel: 1, requiredCore: 13,
      requiredShipyard: 5, speed: 1300, durationMinutes: 30, maxHpPerMinute: 50 });
    expect(RADIATION_LEVEL_HP_PER_MINUTE).toEqual({ 1: 9, 2: 12.5, 3: 18 });
    expect(RADIATION_BOMB.levels).toEqual({
      1: { type: 'RADIATION_BOMB_L1', cost: { alloy: 30000, crystal: 20000, deuterium: 2000 }, nominalMinutes: 30, colonyLoyaltyLoss: 5, colonyFaults: 0 },
      2: { type: 'RADIATION_BOMB_L2', cost: { alloy: 40000, crystal: 28000, deuterium: 2500 }, nominalMinutes: 45, colonyLoyaltyLoss: 10, colonyFaults: 1 },
      3: { type: 'RADIATION_BOMB_L3', cost: { alloy: 50000, crystal: 35000, deuterium: 3000 }, nominalMinutes: 60, colonyLoyaltyLoss: 15, colonyFaults: 2 },
    });
  });
  it('rounds paid work once to the database whole-second boundary', () => {
    expect([radiationBombBuildSeconds(1), radiationBombBuildSeconds(2), radiationBombBuildSeconds(3)])
      .toEqual([2194, 3291, 4388]);
  });
  it('never interprets a Death Star, battery or malformed product as a bomb', () => {
    expect(['RADIATION_BOMB_L1', 'RADIATION_BOMB_L2', 'RADIATION_BOMB_L3'].map(radiationBombLevel)).toEqual([1, 2, 3]);
    for (const value of ['DEATH_STAR', 'INTERCEPTOR', 'RADIATION_BOMB_L0', 'RADIATION_BOMB_L4', 'radiation_bomb_l1', '']) {
      expect(radiationBombLevel(value)).toBeNull();
    }
  });
});

describe('total HP radiation cap and independent hit windows', () => {
  it('subtracts planet protection once after the total cap and before ship research', () => {
    const planet = { kind: 'PLANET' as const, id: 'home' };
    const sources = [source('a', 40), source('b', 40)].map(row => ({ ...row, target: planet }));
    const path = hold(0, 1).map(segment => ({ ...segment, target: planet, radiationProtectionHpPerMinute: 10 }));
    expect(segmentsExposureHp(path, sources)).toBeCloseTo(40);
    expect(protectedRadiationHp(segmentsExposureHp(path, sources), { RADIATION_SHIELDING: 2 })).toBeCloseTo(27.2);
  });
  it('does not apply planet protection at monuments or in flight and never produces negative damage', () => {
    const sources = [source('a', 9)];
    const monument = hold(0, 1).map(segment => ({ ...segment, radiationProtectionHpPerMinute: 10 }));
    expect(segmentsExposureHp(monument, sources)).toBe(9);
    const planet = { kind: 'PLANET' as const, id: 'home' };
    expect(segmentsExposureHp(monument.map(segment => ({ ...segment, target: planet })),
      sources.map(row => ({ ...row, target: planet })))).toBe(0);
  });
  it('retains each hit for its own half-hour without refreshing the older one', () => {
    const sources = [source('L1', 9, 0, 30), source('L2', 12.5, 20, 50)];
    expect(segmentsExposureHp(hold(0, 20), sources)).toBeCloseTo(180);
    expect(segmentsExposureHp(hold(20, 30), sources)).toBeCloseTo(215);
    expect(segmentsExposureHp(hold(30, 50), sources)).toBeCloseTo(250);
    expect(segmentsExposureHp(hold(50, 51), sources)).toBe(0);
  });
  it('caps the sum of natural radiation and every bomb, retaining excess sources until they expire', () => {
    const sources = [source('natural', 12.5), source('A', 18, 0, 60), source('B', 18, 10, 70), source('C', 18, 20, 80)];
    expect(segmentsExposureHp(hold(20, 60), sources)).toBeCloseTo(50 * 40);
    expect(segmentsExposureHp(hold(60, 70), sources)).toBeCloseTo(48.5 * 10);
    expect(segmentsExposureHp(hold(70, 80), sources)).toBeCloseTo(30.5 * 10);
    expect(segmentsExposureHp(hold(80, 81), sources)).toBeCloseTo(12.5);
  });
  it('does not rewrite exposure earned before the explicit season cutover', () => {
    const sources = [source('a', 40, 0, null, 10), source('b', 40, 0, null, 10)];
    expect(segmentsExposureHp(hold(0, 20), sources)).toBeCloseTo(80 * 10 + 50 * 10);
    expect(segmentsExposureHp([...hold(0, 7), ...hold(7, 13), ...hold(13, 20)], sources))
      .toBeCloseTo(segmentsExposureHp(hold(0, 20), sources));
    const { totalCapFromMs: _cap, ...legacy } = sources[0]!;
    expect(segmentsExposureHp(hold(0, 1), [{ ...legacy, intensityHpPerMinute: 80 }])).toBeCloseTo(80);
  });
  it('applies shielding after the total cap, preserving Prospector immunity and physical ship counts', () => {
    const dose = segmentsExposureHp(hold(0, 1), [source('a', 45), source('b', 45)]);
    const tech = { RADIATION_SHIELDING: 4 };
    expect(protectedRadiationHp(dose, tech)).toBeCloseTo(21);
    const outcome = applyHpDose({ CITADEL: 2, PROSPECTOR: 3 }, [], dose, tech);
    expect(outcome.fleet).toEqual({ CITADEL: 2, PROSPECTOR: 3 });
    expect(outcome.lots.every(lot => lot.hull === 'CITADEL')).toBe(true);
    expect(outcome.lots[0]!.damageBp + outcome.lots[0]!.remainderBp!)
      .toBeCloseTo(21 / HULLS.CITADEL.hp * 10000);
  });
  it('uses that same capped profile for individual, first and final casualty prediction', () => {
    const sources = [source('a', 40), source('b', 40)];
    const path = hold(0, 120);
    const expected = Math.ceil(HULLS.DART.hp / 50 * minute);
    expect(hpLethalAtMs(path, sources, { hull: 'DART' })).toBe(expected);
    expect(firstHpLossAtMs(path, sources, { DART: 2 }, [])).toBe(expected);
    expect(hpWingLethalAtMs(path, sources, { DART: 2 }, [])).toBe(expected);
    expect(applyHpDose({ DART: 2 }, [], segmentsExposureHp(hold(0, (expected - 1) / minute), sources)).destroyed).toEqual({});
    expect(applyHpDose({ DART: 2 }, [], segmentsExposureHp(hold(0, expected / minute), sources)).destroyed).toEqual({ DART: 2 });
  });
  it('keeps entity exposure off passing flights and other targets and preserves shelter semantics', () => {
    const sources = [source('a', 80)];
    const [segment] = hold(0, 1);
    expect(segmentsExposureHp([{ ...segment!, target: undefined }], sources)).toBe(0);
    expect(segmentsExposureHp([{ ...segment!, target: { kind: 'PLANET', id: target.id } }], sources)).toBe(0);
    expect(segmentsExposureHp(hold(0, 1), [...sources, { ...source('shelter', 0), mode: 'SHELTER' }])).toBe(0);
  });
  it('never applies a 50 HP limit to the legacy percentage radiation API', () => {
    const clouds = [source('legacy', 0)].map(({ intensityHpPerMinute: _hp, ...rest }) => ({ ...rest, intensityPctPerMinute: 80 }));
    expect(segmentsDoseBp(hold(0, 1), clouds)).toBe(8000);
  });
});
