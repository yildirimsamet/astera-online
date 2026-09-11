import { rewardPurse } from '../src/rewards.js';
import { DEATH_STAR, ANTI_STRATEGIC, MULTI_WORLD, START, PLANET_START, TRAVEL, PIRATE, TRADE } from '../src/constants.js';
import { CLAN } from '../src/clan.js';
import { describe, expect, it } from 'vitest';
import { ECONOMY_PROFILE, profileBuilding, profileIncome, profileResearch, profileHull } from '../src/economy-profile.js';
import { HULLS } from '../src/hulls.js';
import { alloyRate, crystalRate, deuteriumRate, buildingCost, collectorCap, hullWorkMinutes } from '../src/economy.js';
import { RESEARCH_PROJECTS } from '../src/research.js';
import { hullTech } from '../src/tech.js';
import { hullBulk } from '../src/hulls.js';

describe('monthly economy', () => {
  it('is used by actual production, purchases, ship capacity and propulsion, not only a simulator', () => {
    expect(alloyRate(4)).toBe(profileIncome(4).alloy);
    expect(crystalRate(4)).toBe(profileIncome(4).crystal);
    expect(deuteriumRate(4)).toBe(profileIncome(4).deuterium);
    expect(buildingCost('REFINERY', 3)).toEqual(profileBuilding('REFINERY', 4).cost);
    expect(RESEARCH_PROJECTS.STARSHIP_ENGINEERING.costAt(1)).toEqual(profileResearch('STARSHIP_ENGINEERING', 1).cost);
    expect(collectorCap(100)).toBe(1000);
    expect(HULLS.DART.alloy).toBe(300); expect(hullBulk('DART')).toBe(3);
    expect(hullTech({ SHIP_PROPULSION: 4 }, 'DART').speed).toBe(1.5);
  });
  /**
   * BOTH PUBLIC EVENTS SHIP ON. Owner instruction, 2026-09-12: *"asteroid shower,
   * tradeShip eventleri açılacak! sadece ekonomi testlerine dahil edilmeyecek."*
   * The game runs them; the economy MEASUREMENT (the simulator's ARR and friends)
   * never models them — `packages/sim/test/economy-scope.test.ts` holds that half.
   */
  it('ships the asteroid shower and the merchant switched on', () => {
    expect(ECONOMY_PROFILE.tradeShip).toBe(true);
    expect(ECONOMY_PROFILE.asteroidShower).toBe(true);
  });
  it('uses a finite monthly development and reset horizon', () => {
    expect(ECONOMY_PROFILE.progressionDays).toBe(30);
    expect(ECONOMY_PROFILE.seasonDays).toBe(30);
    expect(ECONOMY_PROFILE.collectorHours).toBe(10);
    expect(ECONOMY_PROFILE.propulsionPerLevel).toBe(0.125);
  });
  it('preserves the opening and extends later investments without creating unaffordable infinities', () => {
    expect(profileIncome(1)).toEqual({ alloy: 100, crystal: 50, deuterium: 4 });
    expect(profileBuilding('CORE', 1, 180)).toEqual(profileBuilding('CORE', 1, 14));
    expect(profileBuilding('REFINERY', 20, 180).cost.alloy).toBeGreaterThan(profileBuilding('REFINERY', 20, 14).cost.alloy);
    expect(profileBuilding('CORE', 50, 180).cost.alloy).toBeLessThan(Number.MAX_SAFE_INTEGER);
    expect(() => profileBuilding('CORE', -1, 180)).toThrow();
    expect(profileResearch('STARSHIP_ENGINEERING', 1, 30).cost.alloy).toBeGreaterThan(profileResearch('STARSHIP_ENGINEERING', 1, 14).cost.alloy);
  });
  it('keeps hull recipes and work independent of calendar length', () => {
    const dart = profileHull(HULLS.DART), atlas = profileHull(HULLS.ATLAS);
    expect(dart.alloy).toBe(300); expect(dart.crystal).toBe(60);
    expect(dart.workMinutes).toBe(2); expect(dart.bulk).toBe(3);
    expect(atlas.atk).toBe(0); expect(atlas.cargo).toBe(9500);
    expect(hullWorkMinutes('DART', 2, 0, {})).toBe(4);
    expect(hullWorkMinutes('CATACLYSM', 2, 6, {})).toBeCloseTo(56 / 1.72);
    expect(() => hullWorkMinutes('DART', 0.5, 0, {})).toThrow();
  });
  it('funds season rewards from the frozen monthly reference', () => {
    const purse = rewardPurse();
    expect(purse.alloy).toBeGreaterThan(45000);
    expect(purse.alloy).toBeLessThanOrEqual(45524);
    expect(purse.crystal).toBeLessThanOrEqual(22337);
    expect(purse.deuterium).toBe(0);
  });
  it('links the other purchases and moving targets to the same economy', () => {
    expect(DEATH_STAR.cost).toEqual({ alloy: 47887, crystal: 23944, deuterium: 1984 });
    expect(DEATH_STAR.buildMinutes).toBe(60);
    expect(ANTI_STRATEGIC.cost).toEqual({ alloy: 28733, crystal: 14367, deuterium: 1191 });
    expect(ANTI_STRATEGIC.buildMinutes).toBe(30);
    expect(CLAN.creationCost.alloy).toBe(Math.ceil(profileIncome(6).alloy * 8));
    expect(MULTI_WORLD.settlement.cost).toEqual({ alloy: 800, crystal: 400, deuterium: 0 });
    expect(PLANET_START).toEqual({ alloy: 1500, crystal: 400, deuterium: 50 });
    expect(START.alloy).toBe((['CORE', 'REFINERY', 'EXTRACTOR'] as const).reduce((a, b) => a + buildingCost(b, 1).alloy, 600));
    expect(START.crystal).toBe((['CORE', 'REFINERY', 'EXTRACTOR'] as const).reduce((a, b) => a + buildingCost(b, 1).crystal, 120));
    expect(PIRATE.speedMin).toBe(HULLS.CATACLYSM.speed / TRAVEL.distanceFactor);
    expect(PIRATE.speedMax).toBe(HULLS.DART.speed / TRAVEL.distanceFactor);
    // The SLOWEST hold anchors the merchant, never a named hull — D186, and D196
    // moved the anchor from the Atlas to the Argosy without a constant changing.
    expect(TRADE.speed).toBe(HULLS.ARGOSY.speed / TRAVEL.distanceFactor / 2);
  });

});
