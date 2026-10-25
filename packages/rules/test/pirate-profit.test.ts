import { describe, expect, it } from 'vitest';
import {
  COMBAT, HULLS, capLoadToSurvivors, claimPirateLoot, currentPirateGeneration,
  forecastPirateProfit, fleetCargo, fleetCount, missionFuel, pirateHoard, pirateOverrun,
  pirateRaidTrial, pirateStats, resolveBattle, seededFrom, shipHpRepairCost, soloStack,
  type Resources,
} from '../src/index.js';

const zero = { alloy: 0, crystal: 0, deuterium: 0 };
const keys = ['alloy', 'crystal', 'deuterium'] as const;
const attacker = { CORSAIR: 12, ARGOSY: 1 };
const crew = { PALADIN: 3, CORSAIR: 1 };
const tech = { SHIP_POWER: 2, SHIP_ARMOR: 2, CARGO_HOLDS: 2 };
const input = { attacker, crew, level: 4 as const, tech, rulesetVersion: 16,
  hoard: pirateHoard(crew, currentPirateGeneration()), paid: zero, fuel: missionFuel(attacker, 1000, 2) };

describe('pirate launch economics', () => {
  it('carries initial wounds and includes paid repair even for tiny surviving damage', () => {
    const damage = [{ hull: 'DART' as const, count: 2, damageBp: 1, remainderBp: 0.25 }];
    const trial = pirateRaidTrial({ ...input, attacker: { DART: 2 }, crew: {}, damage,
      tech: {}, hoard: zero, fuel: 0 }, seededFrom('tiny-maintenance'));
    expect(trial.returning).toEqual({ DART: 2 });
    expect(trial.repair).toEqual(shipHpRepairCost(damage, 100));
    expect(trial.repair.alloy).toBeGreaterThan(0);
  });

  it('does not credit pirate loot from ships that cannot fire when the fight starts', () => {
    const trial = pirateRaidTrial({ ...input, attacker: { CITADEL: 100 }, crew: { DART: 1 }, tech: {},
      damage: [{ hull: 'CITADEL', count: 100, damageBp: 9500 }],
      hoard: { alloy: 1000, crystal: 1000, deuterium: 0 }, fuel: 0 }, seededFrom('passive-maintenance'));
    expect(trial.loot).toEqual(zero);
    expect(trial.returning.CITADEL).toBeGreaterThan(0);
    const unarmedCrew = pirateRaidTrial({ ...input, attacker: { CITADEL: 100 }, crew: { COURIER: 1 }, tech: {},
      damage: [{ hull: 'CITADEL', count: 100, damageBp: 9500 }],
      hoard: { alloy: 1000, crystal: 1000, deuterium: 0 }, fuel: 0 }, seededFrom('passive-transports'));
    expect(unarmedCrew.loot).toEqual(zero);
  });
  it('settles the HP fight, the unpaid hoard, surviving cargo and the actual paid dock invoice', () => {
    const trial = pirateRaidTrial(input, seededFrom('preview-test'));
    const fight = pirateOverrun(resolveBattle([soloStack(attacker, { tech })],
      [{ stackId: 'pirate', playerId: '', fleet: crew, tech: { tech: {}, damageMult: 0.85 } }],
      0, seededFrom('preview-test'), 'HP_PLANET'));
    expect(trial.grade).toBe(fight.grade);
    expect(trial.loot).toEqual(claimPirateLoot(input.hoard, zero, fight.grade,
      fleetCargo(fight.attackerSurvivors, tech)).fromStock);
    expect(trial.repair).toEqual(shipHpRepairCost(fight.attackerDamage, 100));
    expect(trial.salvage).toEqual(zero);
    for (const key of keys) expect(trial.net[key]).toBeCloseTo(trial.loot[key] - trial.lossCost[key]
      - trial.repair[key] - (key === 'deuterium' ? input.fuel : 0), 8);
  });

  it('uses the remaining original reward after earlier partial payments', () => {
    const paid = claimPirateLoot(input.hoard, zero, 'PARTIAL', Number.MAX_SAFE_INTEGER).fromStock;
    const result = pirateRaidTrial({ ...input, paid }, seededFrom('preview-test'));
    for (const key of keys) expect(result.loot[key] + paid[key]).toBeLessThanOrEqual(Math.floor(input.hoard[key] * COMBAT.lootDecisive));
    const exhausted = forecastPirateProfit({ ...input, paid: input.hoard });
    expect(exhausted.verdict).toBe('LOSS');
    expect(exhausted.loot).toEqual(zero);
    expect(exhausted.net.deuterium).toBeLessThan(0);
  });

  it('adds only wreck collected by surviving collectors and never treats a captured ship as income', () => {
    const base = pirateRaidTrial(input, seededFrom('preview-test'));
    const collected = pirateRaidTrial({ ...input, attacker: { ...attacker, GARBAGE_COLLECTOR: 1 } }, seededFrom('preview-test'));
    expect(base.salvage).toEqual(zero);
    expect(collected.salvage.alloy + collected.salvage.crystal).toBeGreaterThan(0);
    expect(keys.reduce((sum, key) => sum + collected.salvage[key], 0)).toBeLessThanOrEqual(7500);
    expect(collected).not.toHaveProperty('capturedHull');
  });

  it('does not let a collector that retreated alive lift wreck after the battle', () => {
    const config = { ...input, attacker: { DART: 20, GARBAGE_COLLECTOR: 1 }, crew: { CORSAIR: 2 },
      level: 1 as const, tech: {}, hoard: zero, fuel: 0,
      damage: [{ hull: 'GARBAGE_COLLECTOR' as const, count: 1, damageBp: 8000 }] };
    const fight = resolveBattle([soloStack(config.attacker, { tech: {} }, config.damage)],
      [{ stackId: 'pirate', playerId: '', fleet: config.crew, tech: { tech: {}, damageMult: pirateStats(1).damageMult }, maintenanceExempt: true }],
      0, seededFrom('retreated-collector', 1), 'HP_PLANET', true);
    expect(fight.attackerRetreated?.GARBAGE_COLLECTOR).toBe(1);
    expect(fleetCount(fight.attackerLosses)).toBeGreaterThan(0);
    const trial = pirateRaidTrial(config, seededFrom('retreated-collector', 1));
    expect(trial.returning.GARBAGE_COLLECTOR).toBe(1);
    expect(trial.salvage).toEqual(zero);
  });

  it('includes outbound destruction and full launch fuel when the fleet never reaches the fight', () => {
    const forecast = forecastPirateProfit({ ...input, radiation: { outboundHp: 1e9, returnHp: 0 } });
    expect(forecast.verdict).toBe('LOSS');
    expect(forecast.loot).toEqual(zero);
    expect(forecast.lossCost.alloy).toBe(HULLS.CORSAIR.alloy * 12 + HULLS.ARGOSY.alloy);
    expect(forecast.net.deuterium).toBe(-forecast.lossCost.deuterium - input.fuel);
  });

  it('loads at battle survival, then caps homecoming cargo again after return radiation', () => {
    const before = pirateRaidTrial(input, seededFrom('preview-test'));
    const home = pirateRaidTrial({ ...input, radiation: { outboundHp: 0, returnHp: 1e9 } }, seededFrom('preview-test'));
    expect(before.loot.alloy).toBeGreaterThan(0);
    expect(home.loot).toEqual(zero);
    expect(home.salvage).toEqual(zero);
    expect(fleetCount(home.returning)).toBe(0);
    expect(home.net.alloy).toBe(-home.lossCost.alloy);
    expect(capLoadToSurvivors({ loot: before.loot, salvage: before.salvage }, {}, tech).loot).toEqual(zero);
  });

  it('distinguishes likely profit from a fleet that can survive yet pays too much fuel', () => {
    const cheap = forecastPirateProfit({ ...input, crew: { DART: 2 }, hoard: { alloy: 1000, crystal: 500, deuterium: 333 } });
    expect(cheap.verdict).toBe('PROFIT');
    expect(cheap.net.alloy).toBeGreaterThan(0);
    expect(cheap.net.crystal).toBeGreaterThan(0);
    expect(cheap.net.deuterium).toBeGreaterThan(0);
    const costly = forecastPirateProfit({ ...input, fuel: 10000 });
    expect(costly.verdict).toBe('LOSS');
    expect(costly.net.deuterium).toBeLessThan(0);
    expect(forecastPirateProfit(input)).toEqual(forecastPirateProfit(input));
  });

  it('does not call an ore-versus-fuel tradeoff likely profit when paid repairs consume the ore return', () => {
    const attacker = { CORSAIR: 12 };
    const forecast = forecastPirateProfit({ ...input, attacker, crew: { PALADIN: 3 },
      fuel: missionFuel(attacker, 900, 2), hoard: { alloy: 1950, crystal: 1050, deuterium: 2000 },
      damage: [{ hull: 'CORSAIR', count: 12, damageBp: 3000 }] });
    expect(forecast.net.alloy + forecast.net.crystal).toBeLessThan(0);
    expect(forecast.net.deuterium).toBeGreaterThan(0);
    expect(forecast.verdict).toBe('RISK');
  });

  it('caps poor holds and omits paid repairs in seasons without persistent ship damage', () => {
    const small = forecastPirateProfit({ ...input, attacker: { CORSAIR: 30 }, hoard: { alloy: 50000, crystal: 25000, deuterium: 333 } });
    expect(small.cargoLimitedShare).toBeGreaterThan(0);
    const legacy = pirateRaidTrial({ ...input, rulesetVersion: 1 }, seededFrom('preview-test'));
    expect(legacy.repair).toEqual(zero);
  });

  it('rejects malformed costs and resource ledgers instead of producing a favourable NaN preview', () => {
    for (const fuel of [-1, Infinity, Number.NaN]) expect(() => forecastPirateProfit({ ...input, fuel })).toThrow();
    expect(() => forecastPirateProfit({ ...input, attacker: { CORSAIR: -1 } })).toThrow();
    expect(() => forecastPirateProfit({ ...input, hoard: { ...zero, deuterium: Number.NaN } })).toThrow();
    const net: Resources = forecastPirateProfit(input).net;
    expect(keys.every(key => Number.isFinite(net[key]))).toBe(true);
  });
});
