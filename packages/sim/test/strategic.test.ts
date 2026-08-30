import { describe, expect, it } from 'vitest';
import {
  DEATH_STAR,
  MULTI_WORLD,
  RESEARCH_PROJECTS,
  alloyRate,
  computeLoot,
  crystalRate,
  deuteriumStorageCap,
  fleetCargo,
  mulberry32,
  resolveCombat,
  storageCap,
} from '@astera/rules';
import {
  advanceStrategicLayer,
  buildWorld,
  neutralRaidEligible,
  runStrategicSession,
  tryDeathStar,
} from '../src/season.js';

describe('multi-world strategic simulation', () => {
  it('builds the same live 30/15/6 shared neutral pool from the same seed', () => {
    const first = buildWorld({ players: 50, days: 14, seed: 91273 });
    const second = buildWorld({ players: 50, days: 14, seed: 91273 });

    expect(first.neutrals.map((n) => [n.id, n.tier])).toEqual(
      second.neutrals.map((n) => [n.id, n.tier]),
    );
    expect(first.neutrals.filter((n) => n.tier === 1)).toHaveLength(30);
    expect(first.neutrals.filter((n) => n.tier === 2)).toHaveLength(15);
    expect(first.neutrals.filter((n) => n.tier === 3)).toHaveLength(6);
    for (const n of first.neutrals) {
      expect(n.id).toBeGreaterThanOrEqual(MULTI_WORLD.capitalSlots);
      expect(n.deuterium).toBe(
        deuteriumStorageCap(0, crystalRate(n.buildings.EXTRACTOR), n.buildings.VAULT),
      );
    }
  });

  it('keeps T1 accessible, T2 non-automatic, and T3 gated by informed play', () => {
    expect(neutralRaidEligible(1, 'CASUAL', 1, 10_000)).toBe(true);
    expect(neutralRaidEligible(2, 'CASUAL', 1_799, 1_000)).toBe(false);
    expect(neutralRaidEligible(2, 'CASUAL', 1_800, 1_000)).toBe(true);
    expect(neutralRaidEligible(3, 'CASUAL', 100_000, 1_000)).toBe(false);
    expect(neutralRaidEligible(3, 'GRINDER', 2_499, 1_000)).toBe(false);
    expect(neutralRaidEligible(3, 'GRINDER', 2_500, 1_000)).toBe(true);
  });

  it('makes an unguarded T1 lossless and net-positive for a low fleet with cargo', () => {
    const fleet = { WASP: 1, HAULER: 1 } as const;
    const battle = resolveCombat(fleet, {}, 0, mulberry32(1), { attacker: {}, defender: {} });
    const template = MULTI_WORLD.neutral[1];
    const loot = computeLoot(
      {
        alloy: storageCap(alloyRate(template.buildings.REFINERY), template.buildings.VAULT),
        crystal: storageCap(crystalRate(template.buildings.EXTRACTOR), template.buildings.VAULT),
        deuterium: deuteriumStorageCap(0, crystalRate(template.buildings.EXTRACTOR), template.buildings.VAULT),
      },
      { alloy: 0, crystal: 0, deuterium: 0 },
      { alloy: 0, crystal: 0, deuterium: 0 },
      battle.grade,
      fleetCargo(battle.attackerSurvivors, {}),
    );

    expect(battle.grade).toBe('DECISIVE');
    expect(battle.attackerLossValue).toBe(0);
    expect(loot.alloy + loot.crystal + loot.deuterium).toBeGreaterThan(0);
  });

  it('keeps a neutral raid and its loot in flight until their real arrival moments', () => {
    const world = buildWorld({ players: 2, days: 1, seed: 5151 });
    const attacker = world.players[0]!;
    const target = world.neutrals.find((neutral) => neutral.tier === 1)!;
    world.neutrals = [target];
    world.strategicRng = () => 0;
    attacker.fleet = { WASP: 1, HAULER: 1 };
    attacker.alloy = 0;
    attacker.crystal = 0;
    attacker.deuterium = 0;
    const stockBefore = target.alloy + target.crystal + target.deuterium;

    runStrategicSession(attacker, 0, world);
    const outbound = world.strategicMissions.find((mission) =>
      mission.kind === 'neutral_attack' && !mission.returning,
    );
    expect(outbound).toBeDefined();
    expect(outbound!.arriveAt).toBeGreaterThan(0);
    expect(attacker.fleet).toMatchObject({ WASP: 0, HAULER: 0 });
    expect(target.alloy + target.crystal + target.deuterium).toBe(stockBefore);

    advanceStrategicLayer(world, outbound!.arriveAt - 1);
    expect(target.alloy + target.crystal + target.deuterium).toBe(stockBefore);
    advanceStrategicLayer(world, outbound!.arriveAt);
    expect(target.alloy + target.crystal + target.deuterium).toBeLessThan(stockBefore);
    expect(attacker.alloy + attacker.crystal + attacker.deuterium).toBe(0);

    const returning = world.strategicMissions.find((mission) =>
      mission.kind === 'neutral_attack' && mission.returning,
    );
    expect(returning).toBeDefined();
    advanceStrategicLayer(world, returning!.arriveAt);
    expect(attacker.fleet).toMatchObject({ WASP: 1, HAULER: 1 });
    expect(attacker.alloy + attacker.crystal + attacker.deuterium).toBeGreaterThan(0);
  });

  it('allows destructive strikes without capacity and never turns one into a surprise capture', () => {
    const capped = buildWorld({ players: 2, days: 1, seed: 5152 });
    const lowCore = capped.players[0]!;
    lowCore.buildings.CORE = 2;
    capped.deathStars.set(lowCore.id, { status: 'READY', readyAt: 0 });
    tryDeathStar(lowCore, 0, capped);
    const destructive = capped.strategicMissions.find((mission) => mission.kind === 'death_star')!;
    expect(destructive.captureIntent).toBe(false);
    const struck = capped.neutrals.find((neutral) => neutral.id === destructive.targetId)!;
    struck.recoveryUntil = destructive.arriveAt + 60;
    advanceStrategicLayer(capped, destructive.arriveAt);
    expect(struck.controllerId).not.toBe(lowCore.id);
    expect(capped.strategic.deathStar.captures).toBe(0);

    const world = buildWorld({ players: 2, days: 1, seed: 5153 });
    const attacker = world.players[0]!;
    const target = world.neutrals[0]!;
    world.neutrals = [target];
    attacker.buildings.CORE = DEATH_STAR.requiredCore;
    world.deathStars.set(attacker.id, { status: 'READY', readyAt: 0 });
    tryDeathStar(attacker, 0, world);
    const flight = world.strategicMissions.find((mission) => mission.kind === 'death_star')!;
    expect(flight.captureIntent).toBe(false);
    target.recoveryUntil = flight.arriveAt + 60;
    advanceStrategicLayer(world, flight.arriveAt);
    expect(target.controllerId).not.toBe(attacker.id);
    expect(world.strategic.deathStar.captures).toBe(0);
  });

  it('models a build, first strike, second strike capture and the launched-slot release', () => {
    const world = buildWorld({ players: 2, days: 14, seed: 5150 });
    const attacker = world.players[0]!;
    const target = world.neutrals[0]!;
    world.neutrals = [target];
    attacker.buildings.CORE = DEATH_STAR.requiredCore;
    attacker.buildings.SHIPYARD = DEATH_STAR.requiredShipyard;
    attacker.graviticCharges = true;
    // This case starts after the ordinary Construction queue has completed the
    // protocol; build-queue.test.ts owns the research timing itself.
    world.deathStarProtocol.add(attacker.id);
    attacker.alloy = 100_000;
    attacker.crystal = 100_000;
    attacker.deuterium = 100_000;
    const war = RESEARCH_PROJECTS.DEATH_STAR_PROTOCOL.availableAtMinutes;

    tryDeathStar(attacker, war, world);
    expect(world.deathStars.get(attacker.id)?.status).toBe('BUILDING');
    expect(world.strategic.deathStar.builds).toBe(1);

    tryDeathStar(attacker, war + DEATH_STAR.buildMinutes, world);
    expect(world.deathStars.has(attacker.id)).toBe(false);
    const first = world.strategicMissions.find((m) => m.kind === 'death_star')!;
    advanceStrategicLayer(world, first.arriveAt);
    expect(target.recoveryUntil).toBeGreaterThan(first.arriveAt);
    expect(world.strategic.deathStar.firstHits).toBe(1);

    attacker.alloy = 100_000;
    attacker.crystal = 100_000;
    attacker.deuterium = 100_000;
    tryDeathStar(attacker, first.arriveAt + 1, world);
    expect(world.deathStars.get(attacker.id)?.status).toBe('BUILDING');
    const secondReady = first.arriveAt + 1 + DEATH_STAR.buildMinutes;
    tryDeathStar(attacker, secondReady, world);
    const second = world.strategicMissions.find((m) => m.kind === 'death_star')!;
    expect(second.arriveAt).toBeLessThan(target.recoveryUntil);
    advanceStrategicLayer(world, second.arriveAt);

    expect(target.controllerId).toBe(attacker.id);
    expect(target.recoveryUntil).toBe(0);
    expect(target.protectedUntil).toBeGreaterThan(second.arriveAt);
    expect(world.strategic.deathStar).toMatchObject({
      builds: 2,
      launches: 2,
      firstHits: 1,
      captures: 1,
      misses: 0,
    });
  });
});
