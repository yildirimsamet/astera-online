import { describe, expect, it } from 'vitest';
import { ECON, ECONOMY_PROFILE, DEATH_STAR, SEASON, HULLS, MULTI_WORLD, PROBE,
  profileBuilding, profileResearch, hullWorkMinutes, RESEARCH_PROJECTS,
  storageCap, alloyRate, crystalRate, buildingCost, satelliteCost } from '../src/index.js';

describe('monthly economy tempo', () => {
  it('uses a thirty-day deadline and preserves early work', () => {
    expect(SEASON.days).toBe(30);
    expect(ECONOMY_PROFILE.progressionDays).toBe(SEASON.days);
    expect(profileBuilding('CORE', 2).minutes).toBe(2.72);
    expect(profileBuilding('CORE', 12).minutes).toBeLessThan(60);
  });
  it('keeps reachable producer investments within storage', () => {
    for (let level = 1; level <= 30; level++) {
      const refinery = buildingCost('REFINERY', level);
      const extractor = buildingCost('EXTRACTOR', level);
      expect(storageCap(alloyRate(level), level)).toBeGreaterThanOrEqual(
        Math.ceil(refinery.alloy * ECON.producerUpgradeStorageMargin),
      );
      expect(storageCap(crystalRate(level), level)).toBeGreaterThanOrEqual(
        Math.ceil(extractor.crystal * ECON.producerUpgradeStorageMargin),
      );
    }
    // The works cap is a different contract and `economy.test.ts` owns it; a copy
    // here only ever went stale, which is what it did.
  });
  it('prices work independently of resources and keeps the evening playable', () => {
    expect(hullWorkMinutes('DART', 1, 0, {})).toBe(2);
    expect(hullWorkMinutes('CITADEL', 1, 6, {})).toBeCloseTo(35 / 1.72);
    for (const p of Object.values(RESEARCH_PROJECTS)) {
      for (let level = 1; level <= p.maxLevel; level++) {
        expect(profileResearch(p.id, level).minutes).toBeLessThanOrEqual(480);
      }
    }
    expect(DEATH_STAR.buildMinutes).toBe(60);
  });
  it('keeps entry purchases reachable and founding capital separate', () => {
    expect(HULLS.DART.alloy).toBe(390);
    // D209, owner instruction: the Uplink is priced by hand, not by the tempo.
    expect(satelliteCost('UPLINK')).toEqual({ alloy: 1000, crystal: 500, deuterium: 0 });
    expect(MULTI_WORLD.settlement.charge).toEqual({ alloy: 1000, crystal: 500, deuterium: 0 });
    expect(PROBE.alloy).toBe(65);
  });
});
