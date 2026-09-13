import { describe, expect, it } from 'vitest';
import {
  ALL_HULLS, ANTI_STRATEGIC, BUILD, BUILDING_IDS, DEATH_STAR, HULLS, MULTI_WORLD, PROBE,
  RESEARCH_PROJECTS, SATELLITE_IDS, TUTORIAL_EXIT,
  academyExitGrant, alloyRate, buildingCost, buildingMinutes, buildMinutes, constructionThroughput,
  crystalRate, defenceMinutes, defenceThroughput, deuteriumRate, hullWorkMinutes,
  profileBuilding, profileHull, profileIncome, profileResearch, researchMinutes,
  rewardPurse, robotSpeedMult, satelliteCost, satelliteMinutes, shipMinutes,
  yardSpeedMult, yardThroughput,
  type HullId, type TechLevels,
} from '../src/index.js';

/** Component prices at the reviewed 147deca checkpoint, before either owner economy experiment. */
const checkpointPrices: Record<HullId, readonly [number, number, number]> = {
  DART: [300, 60, 0], PIKE: [300, 60, 0], RAMPART: [375, 75, 0], WARDEN: [375, 75, 0],
  COURIER: [600, 150, 0], VIPER: [750, 180, 2], TALON: [750, 180, 2],
  STRONGHOLD: [938, 225, 3], SENTINEL: [938, 225, 3], WAYFARER: [1500, 400, 12],
  TEMPEST: [1800, 450, 6], BALLISTA: [1800, 450, 6], LEVIATHAN: [2250, 563, 8],
  PRAETORIAN: [2250, 563, 8], ATLAS: [3600, 1000, 48], NULLIFIER: [2070, 518, 7],
  GARBAGE_COLLECTOR: [10000, 5000, 0], CATACLYSM: [4500, 1200, 20],
  CORSAIR: [4500, 1200, 20], CITADEL: [5625, 1500, 25], PALADIN: [5625, 1500, 25],
  ARGOSY: [9000, 2600, 130], BASTION: [2400, 600, 0], THORN: [600, 150, 0],
  PROSPECTOR: [600, 180, 0],
};
const technologies: readonly TechLevels[] = [{}, { AI_ROBOTS: 5, YARD_AUTOMATION: 5 }];
const sum = (cost: { alloy: number; crystal: number; deuterium: number }) =>
  cost.alloy + cost.crystal + cost.deuterium;

describe('owner 30% economy experiment against the checkpoint', () => {
  it('raises every flying hull metal invoice once, keeps D and combat hardware unchanged', () => {
    expect(ALL_HULLS.length).toBe(Object.keys(checkpointPrices).length);
    for (const id of ALL_HULLS) {
      const hull = HULLS[id], baseline = checkpointPrices[id];
      const multiplier = hull.ground ? 1 : 1.30;
      expect(hull.alloy, id).toBe(Math.ceil(baseline[0] * multiplier));
      expect(hull.crystal, id).toBe(Math.ceil(baseline[1] * multiplier));
      expect(hull.deuterium, id).toBe(baseline[2]);
      const hardware = profileHull(hull);
      expect([hull.atk, hull.hp, hull.speed, hull.cargo], id)
        .toEqual([hardware.atk, hardware.hp, hardware.speed, hardware.cargo]);
    }
  });

  it('also raises the disposable probe invoice, without changing flight time', () => {
    expect(PROBE.alloy).toBe(65);
    expect(PROBE.crystal).toBe(39);
    expect(PROBE.speed).toBe(3510);
  });

  it('cuts all three actual producer ladders by 30%, not their design reference invoices', () => {
    for (let level = 0; level <= 100; level += 1) {
      const reference = profileIncome(level);
      expect(alloyRate(level)).toBeCloseTo(reference.alloy * 0.70, 8);
      expect(crystalRate(level)).toBeCloseTo(reference.crystal * 0.70, 8);
      expect(deuteriumRate(level)).toBeCloseTo(reference.deuterium * 0.70, 8);
    }
    for (const id of BUILDING_IDS) {
      expect(buildingCost(id, 5)).toEqual(profileBuilding(id, 6).cost);
    }
    expect(RESEARCH_PROJECTS.SHIP_POWER.costAt(2)).toEqual(profileResearch('SHIP_POWER', 2).cost);
  });

  it('extends every building level by 30%, retaining the robots discount', () => {
    for (const id of BUILDING_IDS) {
      for (let level = 1; level <= 100; level += 1) {
        for (const tech of technologies) {
          expect(buildingMinutes(id, level, tech), `${id}:${String(level)}`)
            .toBeCloseTo(profileBuilding(id, level).minutes * 1.30 * robotSpeedMult(tech), 8);
        }
      }
    }
  });

  it('extends physical hull batches once, independently of their dearer component bill', () => {
    for (const id of ALL_HULLS) {
      for (const count of [1, 3]) {
        for (const yard of [0, 6]) {
          for (const tech of technologies) {
            expect(hullWorkMinutes(id, count, yard, tech), id)
              .toBeCloseTo(profileHull(HULLS[id]).workMinutes * count / (1 + 0.12 * yard)
                * yardSpeedMult(tech) * 1.30, 8);
          }
        }
      }
    }
  });

  it('extends price-based construction, yard, defence and research work including capped orders', () => {
    for (const total of [0, 750, 1_000_000]) {
      const cost = { alloy: total, crystal: 0, deuterium: 0 };
      for (const level of [0, 6, 22]) {
        for (const tech of technologies) {
          expect(buildMinutes(cost, level, tech))
            .toBeCloseTo(Math.min(480, total / constructionThroughput(level))
              * robotSpeedMult(tech) * 1.30, 8);
          expect(shipMinutes(cost, level, tech))
            .toBeCloseTo(Math.min(480, total / yardThroughput(level) * yardSpeedMult(tech)) * 1.30, 8);
        }
        expect(defenceMinutes(cost, level))
          .toBeCloseTo(Math.min(480, total / defenceThroughput(level)) * 1.30, 8);
        expect(researchMinutes(cost, level))
          .toBeCloseTo(Math.min(480, BUILD.researchTimeMult * total / constructionThroughput(level)) * 1.30, 8);
      }
    }
    expect(BUILD.capMinutes).toBe(624);
  });

  it('extends every satellite, including the fixed Uplink timer, and strategic crafting', () => {
    for (const id of SATELLITE_IDS) {
      for (const tech of technologies) {
        const baseline = id === 'UPLINK' ? 5
          : Math.min(480, sum(satelliteCost(id)) / constructionThroughput(6));
        expect(satelliteMinutes(id, 6, tech)).toBeCloseTo(baseline * robotSpeedMult(tech) * 1.30, 8);
      }
    }
    expect(DEATH_STAR.buildMinutes).toBe(78);
    expect(ANTI_STRATEGIC.buildMinutes).toBe(39);
  });

  it('keeps the already-halved reward purse and Academy reward grant rather than halving again', () => {
    expect(rewardPurse()).toEqual({ alloy: 22743, crystal: 11149, deuterium: 0 });
    expect(academyExitGrant(TUTORIAL_EXIT.claimedRewards))
      .toEqual({ alloy: 2223, crystal: 1089, deuterium: 0 });
    // Dearer Academy purchases can change its remainder; do not compensate with a new free grant.
    expect(TUTORIAL_EXIT.resources).toEqual({ alloy: 2518, crystal: 1484, deuterium: 46 });
    expect(TUTORIAL_EXIT.queue?.seconds).toBe(Math.ceil(222 / 60 * 1.30 * 60));
  });

  it('sets the requested guards and T1 dome without changing guns, stock or rearm cadence', () => {
    expect(MULTI_WORLD.neutral[1]).toEqual({
      buildings: { CORE: 2, REFINERY: 2, EXTRACTOR: 2, VAULT: 0, SHIPYARD: 0, DEUTERIUM_PLANT: 0 },
      instruments: { AEGIS: 1 }, fleet: { DART: 12, PIKE: 6, VIPER: 1, STRONGHOLD: 1 }, ground: { THORN: 1 },
      deuteriumLootMultiplier: 0.30,
      captureStock: { alloy: 1000, crystal: 500, deuterium: 0 }, reinforcementMinutes: null,
    });
    expect(MULTI_WORLD.neutral[2]).toEqual({
      buildings: { CORE: 5, REFINERY: 5, EXTRACTOR: 5, VAULT: 0, SHIPYARD: 2, DEUTERIUM_PLANT: 0 },
      instruments: { AEGIS: 2 }, fleet: { DART: 20, PIKE: 20, VIPER: 8, STRONGHOLD: 8 },
      deuteriumLootMultiplier: 0.50,
      ground: { THORN: 2, BASTION: 2 }, captureStock: { alloy: 5000, crystal: 2500, deuterium: 1000 },
      reinforcementMinutes: 360,
    });
    expect(MULTI_WORLD.neutral[3]).toEqual({
      buildings: { CORE: 8, REFINERY: 8, EXTRACTOR: 8, VAULT: 0, SHIPYARD: 4, DEUTERIUM_PLANT: 0 },
      instruments: { AEGIS: 4 },
      fleet: { VIPER: 15, STRONGHOLD: 15, TEMPEST: 5, BALLISTA: 5, SENTINEL: 5, LEVIATHAN: 5, PRAETORIAN: 5 },
      deuteriumLootMultiplier: 0.70,
      ground: { THORN: 5, BASTION: 3 }, captureStock: { alloy: 15000, crystal: 5000, deuterium: 3000 },
      reinforcementMinutes: 240,
    });
  });
});
