import { describe, expect, it } from 'vitest';
import { DEBRIS, PIRATE, SALVAGE } from '../packages/rules/src/constants.js';
import { fleetCargo, fleetCount, fleetEntries, fleetSpeed, HULLS } from '../packages/rules/src/hulls.js';
import { pirateHoard } from '../packages/rules/src/pirates.js';
import { missionFuel } from '../packages/rules/src/fuel.js';
import { resourceValue } from '../packages/rules/src/valuation.js';
import { travelExact } from '../packages/rules/src/travel.js';
import { ENGAGEMENT_MS } from '../packages/rules/src/combat.js';
import type { Fleet, Resources } from '../packages/rules/src/types.js';
import {
  AUDIT_TECH, auditRaid, fleetRecipe, paidRepairCost, runBalancedPirateAudit, runPirateProfitAudit, sampleCrews, supplyProjection,
} from './pirate-profit-audit.js';

const zero: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
const keys = ['alloy', 'crystal', 'deuterium'] as const;
const strong: Fleet = { CORSAIR: 20, ARGOSY: 2 };
const crew: Fleet = { PALADIN: 5 };
const args = { attacker: strong, crew, level: 4 as const, distance: 1000, seed: ['test', 1] };

describe('pirate profit audit accounting', () => {
  it('counts component replacement costs and tolerates absent hulls', () => {
    expect(fleetRecipe({ PALADIN: 5, ARGOSY: undefined })).toEqual({
      alloy: 31_685, crystal: 12_190, deuterium: 125,
    });
    expect(() => fleetRecipe({ PALADIN: -1 })).toThrow();
    expect(() => fleetRecipe({ PALADIN: 0.5 })).toThrow();
  });

  it('uses the actual HP battle, decisive share and surviving cargo deterministically', () => {
    const result = auditRaid(args);
    expect(auditRaid(args)).toEqual(result);
    expect(result.grade).toBe('DECISIVE');
    expect(result.loot).toEqual({ alloy: 26_426, crystal: 14_414, deuterium: 102 });
    expect(result.fullLoot).toBe(true);
    expect(result.fuel).toBe(missionFuel(strong, 1000, 2));
    expect(result.straightRoundTripMinutes).toBeCloseTo(
      travelExact(1000, fleetSpeed(strong, AUDIT_TECH))
      + travelExact(1000, fleetSpeed(result.attackerSurvivors, AUDIT_TECH)) + ENGAGEMENT_MS / 60000, 10);
  });

  it('deducts only losses, paid repair and fuel from loot, keeping reusable capital separate', () => {
    const result = auditRaid(args);
    for (const key of keys) {
      expect(result.net[key]).toBeCloseTo(result.loot[key] + result.salvage[key]
        - result.lossCost[key] - result.repair[key] - (key === 'deuterium' ? result.fuel : 0), 10);
    }
    expect(resourceValue(result.capital)).toBeGreaterThan(resourceValue(result.loot));
    expect(resourceValue(result.net)).toBeGreaterThan(0);
    expect(result.expectedCapture.alloy + result.expectedCapture.crystal + result.expectedCapture.deuterium)
      .toBeCloseTo(PIRATE.captureChance[4] * 8_800);
  });

  it('counts no public wreck as automatically delivered income', () => {
    const result = auditRaid(args);
    expect(result.salvage).toEqual(zero);
    expect(result.wreckCreated.alloy + result.wreckCreated.crystal + result.wreckCreated.deuterium)
      .toBeCloseTo(DEBRIS.share * (44_000 + keys.reduce((sum, key) => sum + result.lossCost[key], 0)));
    expect(result.publicWreck).not.toBeNull();
  });

  it('credits only the wreck that a surviving collector can lift', () => {
    const result = auditRaid({ ...args, attacker: { ...strong, GARBAGE_COLLECTOR: 1 } });
    const lifted = keys.reduce((sum, key) => sum + result.salvage[key], 0);
    expect(lifted).toBeGreaterThan(0);
    expect(lifted).toBeLessThanOrEqual(SALVAGE.perCollector);
    for (const key of keys) expect(result.salvage[key]).toBeLessThanOrEqual(result.wreckCreated[key]);
  });

  it('treats at most 20% damage as free repair and invoices the entire larger wound', () => {
    const fleet = { PALADIN: 1 };
    expect(paidRepairCost(fleet, [{ hull: 'PALADIN', count: 1, damageBp: 2000 }], {})).toEqual(zero);
    expect(paidRepairCost(fleet, [{ hull: 'PALADIN', count: 1, damageBp: 2000, remainderBp: 0.5 }], {}))
      .toEqual({ alloy: 1268, crystal: 488, deuterium: 6 });
    expect(paidRepairCost(fleet, [{ hull: 'PALADIN', count: 1, damageBp: 5000 }], { INDUSTRIAL: 2 }))
      .toEqual({ alloy: 1585, crystal: 610, deuterium: 7 });
  });

  it('still charges full launch fuel when no attacker survives', () => {
    const result = auditRaid({ ...args, attacker: { DART: 1 } });
    expect(result.survived).toBe(false);
    expect(result.loot).toEqual(zero);
    expect(result.expectedCapture).toEqual(zero);
    expect(result.lossCost.alloy).toBe(HULLS.DART.alloy);
    expect(result.fuel).toBeGreaterThan(0);
    expect(resourceValue(result.net)).toBeLessThan(0);
  });

  it('caps loot by actual surviving holds, even against an unusually large purse', () => {
    const fleet: Fleet = { CORSAIR: 30 };
    const result = auditRaid({ ...args, attacker: fleet, hoard: { alloy: 500_000, crystal: 500_000, deuterium: 1000 } });
    expect(result.grade).toBe('DECISIVE');
    expect(keys.reduce((sum, key) => sum + result.loot[key], 0))
      .toBeLessThanOrEqual(fleetCargo(result.attackerSurvivors, AUDIT_TECH));
    expect(result.fullLoot).toBe(false);
  });

  it('accounts for a partial raid with transports surviving after the guns are lost', () => {
    const result = auditRaid({ ...args, attacker: { CORSAIR: 1, ARGOSY: 2 }, crew: { PALADIN: 2 },
      seed: ['partial-repro', 1], hoard: pirateHoard(crew) });
    expect(result.grade).toBe('PARTIAL');
    expect(result.attackerSurvivors.CORSAIR ?? 0).toBe(0);
    expect(result.survived).toBe(true);
    expect(result.loot).toEqual({ alloy: 13_213, crystal: 7_207, deuterium: 51 });
    expect(result.expectedCapture).toEqual(zero);
  });

  it('reproduces the current repeated-partial payout from the original, undepleted hoard', () => {
    const original = pirateHoard(crew);
    let living: Fleet = crew;
    const receipts: Resources = { ...zero };
    const grades: string[] = [];
    for (const [step, count] of [3, 1, 1].entries()) {
      const result = auditRaid({ ...args, attacker: { CORSAIR: count, ARGOSY: 2 }, crew: living,
        seed: ['partial-repro', step], hoard: original });
      grades.push(result.grade);
      for (const key of keys) receipts[key] += result.loot[key];
      living = result.defenderSurvivors;
    }
    expect(grades).toEqual(['PARTIAL', 'PARTIAL', 'DECISIVE']);
    expect(receipts).toEqual({ alloy: 52_852, crystal: 28_828, deuterium: 204 });
    expect(keys.reduce((sum, key) => sum + receipts[key], 0)).toBeGreaterThan(68_238);
  });

  it('samples existing generation weights and conditions war-only crews without rerolling their size', () => {
    const all = sampleCrews(4, 128, 'normal');
    expect(sampleCrews(4, 128, 'normal')).toEqual(all);
    expect(all.some(f => fleetEntries(f).some(([id]) => HULLS[id].cls === 'SUPPORT'))).toBe(true);
    const armed = sampleCrews(4, 128, 'war-only');
    for (const fleet of armed) {
      const entries = fleetEntries(fleet);
      expect(entries.every(([id]) => HULLS[id].cls !== 'SUPPORT')).toBe(true);
      expect(entries.some(([id]) => HULLS[id].tier === 4)).toBe(true);
      const size = fleetCount(fleet);
      expect(size).toBeGreaterThanOrEqual(2);
      expect(size).toBeLessThanOrEqual(5);
    }
  });

  it('projects shared hourly supply once per galaxy, including half-weight bots and the floor', () => {
    expect(supplyProjection(100, 200, 24)).toEqual({ eligible: 200, perHour: 50, total: 1200 });
    expect(supplyProjection(0, 0, 24)).toEqual({ eligible: 0, perHour: 1, total: 24 });
    expect(supplyProjection(100, 3, 4)).toEqual({ eligible: 101, perHour: 25, total: 100 });
    expect(() => supplyProjection(-1, 0, 24)).toThrow();
    expect(() => auditRaid({ ...args, distance: Number.NaN })).toThrow();
  });

  it('keeps level weighting, shared supply and policy selection intact in a small audit', () => {
    const report = runPirateProfitAudit(2, 2, 2);
    expect(report.normal.map(s => s.level)).toEqual([1, 2, 3, 4]);
    expect(report.warOnly.level).toBe(4);
    expect(report.normal.every(s => s.rows.every(r => r.trials === 4))).toBe(true);
    const galaxy = report.supply.find(s => s.peoplePerHour === 100 && s.activeBotsPerHour === 0)!;
    expect(galaxy.total).toBe(600);
    const base = report.weightedPolicyMeans.find(p => p.policy === 'profit')!;
    const half = galaxy.uptake.find(u => u.attemptedFraction === 0.5)!.policies.find(p => p.policy === 'profit')!;
    expect(half.lootPerDay.alloy).toBeCloseTo(base.loot.alloy * 300, 8);
    expect(report.repeatedPartial.directLootRatio).toBeGreaterThan(1);
  });

  it('checks new-generation crews with legal matching-tier fleets and independent validation', () => {
    const report = runBalancedPirateAudit(2, 2, 2);
    expect(report.levels.map(s => s.level)).toEqual([1, 2, 3, 4]);
    for (const rung of report.levels) {
      expect(rung.meanPirateShips).toBeGreaterThanOrEqual(2);
      expect(rung.meanPirateShips).toBeLessThanOrEqual(5);
      expect(fleetEntries(rung.representative.crew!).every(([id]) => HULLS[id].cls !== 'SUPPORT')).toBe(true);
      for (const fleet of Object.values(rung.representative.fleets!)) {
        expect(fleetEntries(fleet).every(([id]) => (HULLS[id].tier ?? Infinity) <= rung.level
          || id === 'GARBAGE_COLLECTOR')).toBe(true);
      }
    }
    expect(report.levels[3]!.maxOrePayout).toBeLessThanOrEqual(3000);
    expect(report.levels[3]!.maxDeuteriumPayout).toBeLessThanOrEqual(200);
    expect(report.sourceHashes['packages/rules/src/pirateLoot.ts']).toMatch(/^[a-f0-9]{64}$/);
    for (const name of ['economy', 'radiationHp', 'rng', 'travel']) {
      expect(report.sourceHashes[`packages/rules/src/${name}.ts`]).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('meets the owner’s net ore and fuel targets with a rising matching-tier reward ladder', () => {
    const report = runBalancedPirateAudit(32, 4, 8);
    const profits = report.levels.map(rung => rung.rows.find(row => row.policy === 'profit')!);
    const ores = profits.map(row => row.net.alloy + row.net.crystal);
    expect(ores[3]).toBeGreaterThanOrEqual(1000);
    expect(ores[3]).toBeLessThanOrEqual(2000);
    expect(profits[3]!.net.deuterium).toBeGreaterThanOrEqual(100);
    expect(profits[3]!.net.deuterium).toBeLessThanOrEqual(150);
    for (let i = 0; i < profits.length; i++) {
      expect(ores[i]).toBeGreaterThan(0);
      expect(profits[i]!.net.deuterium).toBeGreaterThan(0);
      expect(profits[i]!.decisivePct).toBeGreaterThanOrEqual(95);
      if (i > 0) expect(ores[i]).toBeGreaterThan(ores[i - 1]!);
    }
  }, 120_000);
});
