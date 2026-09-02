import { describe, expect, it } from 'vitest';
import {
  BUILD,
  CLAN,
  DEATH_STAR,
  ECON,
  ECONOMY_TEMPO,
  HULLS,
  MULTI_WORLD,
  PROBE,
  RESEARCH_PROJECTS,
  rewardPurse,
  satelliteCost,
  buildMinutes,
  plantCeiling,
  researchMinutes,
  shipMinutes,
  storageCap,
  alloyRate,
  upgradeCost,
} from '../src/index.js';

describe('the calibrated economy tempo', () => {
  it('keeps the upgrade curve inside a raidable storage profile', () => {
    expect(ECON.costBase / 52).toBe(1.05);
    expect(ECON.costMult).toBe(1.54);
    expect(ECON.capHours).toBeCloseTo(13.2);
    expect(ECON.capHoursPerVault).toBeCloseTo(0.88);
  });

  it('keeps the opening in minutes and both meanings of L12 inside one to two hours', () => {
    const intoL2 = buildMinutes(upgradeCost(1), 1);
    const intoL12 = buildMinutes(upgradeCost(11), 11);
    const outOfL12 = buildMinutes(upgradeCost(12), 12);

    expect(intoL2).toBeGreaterThanOrEqual(1);
    expect(intoL2).toBeLessThanOrEqual(3);
    expect(intoL12).toBeGreaterThanOrEqual(60);
    expect(intoL12).toBeLessThanOrEqual(120);
    expect(outOfL12).toBeGreaterThanOrEqual(60);
    expect(outOfL12).toBeLessThanOrEqual(120);
  });

  it('never creates an upgrade a developed Vault cannot hold', () => {
    for (let level = 1; level <= 20; level += 1) {
      const vault = Math.max(0, Math.min(16, level - 3));
      expect(upgradeCost(level).alloy, `L${String(level)} at Vault ${String(vault)}`)
        .toBeLessThanOrEqual(storageCap(alloyRate(level), vault));
    }
  });

  it('makes ordinary hull crafting about 50% slower while keeping it usable', () => {
    expect(HULLS.DART.alloy).toBe(300);
    expect(shipMinutes(HULLS.DART, 0, {})).toBeGreaterThan(1);
    expect(shipMinutes(HULLS.DART, 0, {})).toBeLessThan(2);
    expect(shipMinutes(HULLS.CITADEL, HULLS.CITADEL.minShipyard, {})).toBeGreaterThan(10);
    expect(shipMinutes(HULLS.CITADEL, HULLS.CITADEL.minShipyard, {})).toBeLessThan(15);
  });

  it('applies each price class deliberately instead of one accidental global multiplier', () => {
    expect(HULLS.DART.alloy).toBe(300);
    expect(HULLS.COURIER.deuterium).toBe(63);
    expect(satelliteCost('UPLINK')).toEqual({ alloy: 1125, crystal: 375, deuterium: 0 });
    expect(satelliteCost('FOUNDRY')).toEqual({ alloy: 3400, crystal: 1190, deuterium: 0 });
    expect(MULTI_WORLD.settlement.cost).toEqual({ alloy: 3400, crystal: 1700, deuterium: 0 });
    expect(DEATH_STAR.cost).toEqual({ alloy: 25_500, crystal: 25_500, deuterium: 3900 });
    expect(CLAN.creationCost).toEqual({ alloy: 8500, crystal: 5100, deuterium: 0 });
  });

  it('keeps action rewards and the scouting entry price as intentional exceptions', () => {
    expect(PROBE).toMatchObject({ alloy: 50, crystal: 30 });
    expect(rewardPurse()).toEqual({ alloy: 13_600, crystal: 4740, deuterium: 0 });
  });

  it('keeps the strategic asset timer fixed outside ordinary yard crafting', () => {
    expect(DEATH_STAR.buildMinutes).toBe(60);
  });

  it('keeps seasonal research below the construction cap', () => {
    for (const project of Object.values(RESEARCH_PROJECTS)) {
      const core = project.requiredCore ?? 6;
      for (let level = 1; level <= project.maxLevel; level++) {
        /*
          A LADDER IS PRICED AGAINST THE CORE ITS OWN RUNG IMPLIES.

          The flat default of six is the Core a commander plausibly holds when they
          buy a one-off permission. A rung is different: nobody buys Deuterium
          Synthesis 5 at Core 6, because the plant it opens cannot be built there
          at all. Measured at six the top rung reads exactly at the clamp, which is
          a figure from a world that cannot exist.
        */
        /*
          A LADDER IS PRICED AGAINST THE CORE ITS OWN RUNG IMPLIES.

          The flat default of six is the Core a commander plausibly holds when they
          buy a one-off permission. A rung is different: nobody buys the fifth rung
          of anything at Core 6 — the Deuterium Refinery it opens cannot even be
          built there, and a doctrine's top rung is a season's project. Measured at
          six, every top rung reads exactly at the clamp, which is a figure from a
          world that does not exist. Two Core levels per rung is the honest proxy,
          and the refinery gets the exact answer its own ceiling gives.
        */
        const at = project.maxLevel > 1
          ? Math.max(core + 2 * (level - 1), plantCeiling(level) + 1)
          : core;
        expect(researchMinutes(project.costAt(level), at), `${project.id} L${String(level)}`)
          .toBeLessThan(BUILD.capMinutes);
      }
    }
  });

  it('exposes every chosen lever through one profile', () => {
    expect(ECONOMY_TEMPO.passiveIncome).toBe(0.70);
    expect(ECONOMY_TEMPO.upgradePrice).toBe(1.05);
    expect(ECONOMY_TEMPO.upgradeGrowth).toBe(1.54);
    expect(ECONOMY_TEMPO.storageHours).toBe(1.10);
    expect(ECONOMY_TEMPO.hullPrice).toBe(1.25);
    expect(ECONOMY_TEMPO.hullCrystalPrice).toBe(1.25 * 1.15);
    expect(ECONOMY_TEMPO.fixedPrice).toBe(1.70);
    expect(ECONOMY_TEMPO.gatewayPrice).toBe(1.25);
    expect(ECONOMY_TEMPO.deuteriumPrice).toBe(1.30);
    expect(ECONOMY_TEMPO.constructionBase).toBe(40);
    expect(ECONOMY_TEMPO.researchWork).toBe(0.62);
    expect(BUILD.conBase).toBe(ECONOMY_TEMPO.constructionBase);
    expect(BUILD.yardBase).toBe(ECONOMY_TEMPO.yardBase);
  });
});
