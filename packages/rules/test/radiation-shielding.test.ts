import { describe, expect, it } from 'vitest';
import {
  HULLS, MONUMENT_BALANCE, RADIATION_LEVEL_HP_PER_MINUTE, RESEARCH_PROJECTS,
  RESEARCH_PROJECT_IDS, applyHpDose, firstHpLossAtMs, hpLethalAtMs,
  hpWingLethalAtMs, hullTech, radiationDamageMult, researchEffectAt,
  settleMonumentHold, type HpRadiationSource, type MonumentShipLot, type TechLevels,
} from '../src/index.js';

const MIN = 60_000;
const position = { x: 0, y: 0, z: 0 };
const path = [{ from: position, to: position, startMs: 0, endMs: 12 * 60 * MIN }];
const sources: HpRadiationSource[] = [{
  id: 'hard', center: position, radius: 1, mode: 'EMIT',
  intensityHpPerMinute: 12.5, activeFromMs: 0, activeUntilMs: null,
}];

describe('fixed radiation levels and commander shielding', () => {
  it('keeps source levels separate from the four research levels and preserves production', () => {
    expect(RADIATION_LEVEL_HP_PER_MINUTE).toEqual({ 1: 9, 2: 12.5, 3: 18 });
    expect(MONUMENT_BALANCE.EASY).toMatchObject({ radiationLevel: 1, intensityHpPerMinute: 9, productionPerMinute: 3 });
    expect(MONUMENT_BALANCE.HARD).toMatchObject({ radiationLevel: 2, intensityHpPerMinute: 12.5, productionPerMinute: 8 });
    for (const [level, rate] of [12.5, 10.5, 8.5, 6.5, 5.25].entries()) {
      expect(12.5 * radiationDamageMult({ RADIATION_SHIELDING: level })).toBeCloseTo(rate, 10);
      expect(researchEffectAt('RADIATION_SHIELDING', level)).toBe(radiationDamageMult({ RADIATION_SHIELDING: level }));
    }
    expect(radiationDamageMult({})).toBe(1);
    expect(radiationDamageMult({ RADIATION_SHIELDING: 99 })).toBe(.42);
    expect(RESEARCH_PROJECT_IDS).toContain('RADIATION_SHIELDING');
    expect(RESEARCH_PROJECTS.RADIATION_SHIELDING).toMatchObject({ maxLevel: 4, requiredCore: 3, prerequisite: null });
    expect([1, 2, 3, 4].map(level => RESEARCH_PROJECTS.RADIATION_SHIELDING.costAt(level))).toEqual([
      { alloy: 2331, crystal: 1434, deuterium: 0 }, { alloy: 4196, crystal: 2582, deuterium: 0 },
      { alloy: 7552, crystal: 4647, deuterium: 0 }, { alloy: 13593, crystal: 8365, deuterium: 0 },
    ]);
  });

  it('removes the same flat HP from different hulls and populations, without changing hull stats', () => {
    const tech: TechLevels = { SHIP_ARMOR: 5, RADIATION_SHIELDING: 4 };
    const outcome = applyHpDose({ ATLAS: 3, ARGOSY: 1, CORSAIR: 2 }, [], 125, tech);
    for (const row of outcome.lots) {
      const hp = HULLS[row.hull].hp * hullTech(tech, row.hull).hp;
      expect(hp * (row.damageBp + (row.remainderBp ?? 0)) / 10_000).toBeCloseTo(52.5, 9);
      expect(hullTech(tech, row.hull)).toEqual(hullTech({ SHIP_ARMOR: 5 }, row.hull));
    }
    expect(applyHpDose({ PROSPECTOR: 1 }, [], 1e9, tech).destroyed).toEqual({});
  });

  it('matches the roughly two-hour and six-hour Corsair targets in every death predictor', () => {
    for (const [tech, minutes] of [[{}, 120.64], [{ SHIP_ARMOR: 5, RADIATION_SHIELDING: 4 }, 1885 / 5.25]] satisfies [TechLevels, number][]) {
      const expected = Math.ceil(minutes * MIN);
      expect(hpLethalAtMs(path, sources, { hull: 'CORSAIR', tech })).toBe(expected);
      expect(firstHpLossAtMs(path, sources, { CORSAIR: 1 }, [], tech)).toBe(expected);
      expect(hpWingLethalAtMs(path, sources, { CORSAIR: 1 }, [], tech)).toBe(expected);
      expect(applyHpDose({ CORSAIR: 1 }, [], 12.5 * (expected - 1) / MIN, tech).fleet).toEqual({ CORSAIR: 1 });
      expect(applyHpDose({ CORSAIR: 1 }, [], 12.5 * expected / MIN, tech).fleet).toEqual({});
    }
  });

  it('keeps wounded fractional damage through split settlements and never heals at zero dose', () => {
    const tech = { RADIATION_SHIELDING: 3 };
    const old = [{ hull: 'ARGOSY', count: 2, damageBp: 4000, remainderBp: .23 }] as const;
    const first = applyHpDose({ ARGOSY: 2 }, old, 12.5, tech);
    const split = applyHpDose(first.fleet, first.lots, 25, tech);
    const whole = applyHpDose({ ARGOSY: 2 }, old, 37.5, tech);
    expect(split.fleet).toEqual(whole.fleet);
    expect(split.lots[0]?.damageBp).toBe(whole.lots[0]?.damageBp);
    expect(split.lots[0]?.remainderBp).toBeCloseTo(whole.lots[0]?.remainderBp ?? -1, 9);
    expect(applyHpDose(first.fleet, first.lots, 0, { RADIATION_SHIELDING: 4 }).lots).toEqual(first.lots);
  });

  it('settles each allied cohort with its own snapshot and stops cargo production at its death', () => {
    const lots: MonumentShipLot[] = [0, 4].flatMap(level => (['CORSAIR', 'ARGOSY'] as const).map(hull => ({
      id: `${level}-${hull}`, playerId: `p${level}`, waveId: `w${level}`,
      hull, count: 1, damageBp: 0, remainderBp: 0, deuterium: 0,
      tech: { RADIATION_SHIELDING: level },
    } satisfies MonumentShipLot)));
    const result = settleMonumentHold(lots, {
      fromMs: 0, toMs: 180 * MIN, position, productionPerMinute: 8, sources,
    });
    expect(result.lots.every(row => row.playerId === 'p4')).toBe(true);
    expect(result.lots.find(row => row.hull === 'ARGOSY')?.deuterium).toBeGreaterThan(8 * 180 / 2);
    const dead = settleMonumentHold(lots.filter(row => row.playerId === 'p0'), {
      fromMs: 0, toMs: 180 * MIN, position, productionPerMinute: 8, sources,
    });
    expect(dead.lots).toEqual([]);
    expect(dead.lostDeuterium).toBeGreaterThan(0);
  });
});
