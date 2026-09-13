import { describe, expect, it } from 'vitest';
import {
  COMBAT,
  DEATH_STAR,
  MULTI_WORLD,
  RESEARCH_PROJECTS,
  SHIELD,
  alloyRate,
  computeLoot,
  crystalRate,
  deuteriumStorageCap,
  fleetCargo,
  mulberry32,
  resolveCombat,
  shieldHp,
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
  it('builds the same live 38/19/8 shared neutral pool from the same seed', () => {
    const first = buildWorld({ players: 50, days: 14, seed: 91273 });
    const second = buildWorld({ players: 50, days: 14, seed: 91273 });

    expect(first.neutrals.map((n) => [n.id, n.tier])).toEqual(
      second.neutrals.map((n) => [n.id, n.tier]),
    );
    expect(first.neutrals.filter((n) => n.tier === 1)).toHaveLength(38);
    expect(first.neutrals.filter((n) => n.tier === 2)).toHaveLength(19);
    expect(first.neutrals.filter((n) => n.tier === 3)).toHaveLength(8);
    for (const n of first.neutrals) {
      expect(n.id).toBeGreaterThanOrEqual(MULTI_WORLD.capitalSlots);
      // D209: each dome is its template's own.
      expect(n.aegis).toBe(MULTI_WORLD.neutral[n.tier].instruments.AEGIS);
      expect(n.shield).toBe(shieldHp(n.aegis));
      expect(n.deuterium).toBe(
        deuteriumStorageCap(0, crystalRate(n.buildings.EXTRACTOR), n.buildings.VAULT),
      );
    }
  });

  it('weighs a guarded T1 like a T2, keeps T2 non-automatic, and T3 gated by informed play', () => {
    // D209 guards tier 1, so a bot no longer throws a token wing at it.
    expect(neutralRaidEligible(1, 'CASUAL', 1, 10_000)).toBe(false);
    expect(neutralRaidEligible(1, 'CASUAL', 1_799, 1_000)).toBe(false);
    expect(neutralRaidEligible(1, 'CASUAL', 1_800, 1_000)).toBe(true);
    expect(neutralRaidEligible(2, 'CASUAL', 1_799, 1_000)).toBe(false);
    expect(neutralRaidEligible(2, 'CASUAL', 1_800, 1_000)).toBe(true);
    expect(neutralRaidEligible(3, 'CASUAL', 100_000, 1_000)).toBe(false);
    expect(neutralRaidEligible(3, 'GRINDER', 2_499, 1_000)).toBe(false);
    expect(neutralRaidEligible(3, 'GRINDER', 2_500, 1_000)).toBe(true);
  });

  it('makes a T1 whose guard has fallen lossless and net-positive for a low fleet with cargo', () => {
    const fleet = { DART: 1, WAYFARER: 1 } as const;
    const battle = resolveCombat(fleet, {}, 0, mulberry32(1), { attacker: { tech: {} }, defender: { tech: {} } });
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

  it.each([1, 2, 3] as const)('applies the tier %i neutral deuterium loot reduction', (tier) => {
    const world = buildWorld({ players: 2, days: 1, seed: 5151 });
    const attacker = world.players[0]!;
    const target = world.neutrals.find((neutral) => neutral.tier === tier)!;
    target.fleet = {};
    target.aegis = 0;
    target.shield = 0;
    target.alloy = 1000;
    target.crystal = 1000;
    target.deuterium = 1000;
    target.lastTick = 0;
    target.nextReinforcement = null;
    world.neutrals = [target];
    world.strategicMissions = [{ id: 917 + tier, kind: 'neutral_attack', ownerId: attacker.id,
      targetId: target.id, arriveAt: 0, fleet: { DART: 1, COURIER: 8 }, returning: false }];

    advanceStrategicLayer(world, 0);

    const returning = world.strategicMissions.find((mission) => mission.kind === 'neutral_attack' && mission.returning);
    if (returning?.kind !== 'neutral_attack') throw new Error('missing neutral return');
    const baseLoot = 1000 * COMBAT.lootDecisive;
    const expected = Math.floor(baseLoot * Math.round(
      MULTI_WORLD.neutral[tier].deuteriumLootMultiplier * 100,
    ) / 100);
    expect(returning.cargo).toEqual({ alloy: baseLoot, crystal: baseLoot, deuterium: expected });
    expect(target.deuterium).toBe(1000 - expected);
  });

  it('keeps a neutral raid and its loot in flight until their real arrival moments', () => {
    const world = buildWorld({ players: 2, days: 1, seed: 5151 });
    const attacker = world.players[0]!;
    const target = world.neutrals.find((neutral) => neutral.tier === 1)!;
    // D209 guards tier 1; this case is about timing, so the guard has already fallen.
    target.fleet = {};
    world.neutrals = [target];
    world.strategicRng = () => 0;
    // Two Darts: a bot commits 60% of each combat hull (D209 treats tier 1 like any other tier).
    attacker.fleet = { DART: 2, WAYFARER: 1 };
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
    expect(attacker.fleet).toMatchObject({ DART: 1, WAYFARER: 0 });
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
    expect(attacker.fleet).toMatchObject({ DART: 2, WAYFARER: 1 });
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

  it('models repeated outages without changing colony ownership', () => {
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
    /*
      FUNDED OFF THE PRICE RATHER THAN OFF A LITERAL. D203 tripled `DEATH_STAR.cost`
      and this purse stayed at its old figure, so the attacker could no longer
      afford the weapon and the case silently stopped testing outages at all — the
      first assertion read `undefined` instead of `BUILDING`. Reading the cost means
      the next retune cannot do the same thing.
    */
    const fund = (): void => {
      attacker.alloy = DEATH_STAR.cost.alloy * 2;
      attacker.crystal = DEATH_STAR.cost.crystal * 2;
      attacker.deuterium = DEATH_STAR.cost.deuterium * 2;
    };
    fund();
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

    fund();
    tryDeathStar(attacker, first.arriveAt + 1, world);
    expect(world.deathStars.get(attacker.id)?.status).toBe('BUILDING');
    const secondReady = first.arriveAt + 1 + DEATH_STAR.buildMinutes;
    target.recoveryUntil = secondReady + 90; // An overlapping strike must not capture either.
    tryDeathStar(attacker, secondReady, world);
    const second = world.strategicMissions.find((m) => m.kind === 'death_star')!;
    expect(second.arriveAt).toBeLessThan(target.recoveryUntil);
    advanceStrategicLayer(world, second.arriveAt);

    expect(target.controllerId).toBeNull();
    expect(target.recoveryUntil).toBe(second.arriveAt + MULTI_WORLD.recoveryMinutes);
    expect(target.protectedUntil).toBe(0);
    expect(world.strategic.deathStar).toMatchObject({
      builds: 2,
      launches: 2,
      firstHits: 2,
      captures: 0,
      misses: 0,
    });
  });

  describe('D209 caretaker rules, mirrored from the server', () => {
    it('re-arms a fallen tier 2 guard and dome in full without touching its stores', () => {
      const world = buildWorld({ players: 2, days: 1, seed: 5151 });
      const target = world.neutrals.find((neutral) => neutral.tier === 2)!;
      const template = MULTI_WORLD.neutral[2];
      target.fleet = {};
      target.aegis = 0;
      target.shield = 0;
      target.alloy = 0;
      target.crystal = 0;
      target.deuterium = 0;
      target.lastTick = 0;
      target.nextReinforcement = 0;
      world.neutrals = [target];

      advanceStrategicLayer(world, 0);

      expect(target.fleet).toEqual({ ...template.fleet, ...template.ground });
      expect(target.aegis).toBe(template.instruments.AEGIS);
      expect(target.shield).toBe(shieldHp(template.instruments.AEGIS));
      expect(target.alloy + target.crystal + target.deuterium).toBe(0);
    });

    it('persists battle damage and regenerates a caretaker dome from its remaining charge', () => {
      const world = buildWorld({ players: 2, days: 1, seed: 5151 });
      const attacker = world.players[0]!;
      const target = world.neutrals.find((neutral) => neutral.tier === 2)!;
      world.neutrals = [target];
      target.shield = 1;
      target.lastTick = 0;
      const fleet = { TEMPEST: 100 } as const;
      const mission = {
        id: 71,
        kind: 'neutral_attack' as const,
        ownerId: attacker.id,
        targetId: target.id,
        arriveAt: 60,
        fleet,
        returning: false,
      };
      world.strategicMissions = [mission];
      const beforeBattle = Math.min(
        shieldHp(target.aegis),
        1 + shieldHp(target.aegis) * SHIELD.regenPerHour,
      );
      const expected = resolveCombat(
        fleet,
        target.fleet,
        beforeBattle,
        mulberry32((mission.id * 104729 + mission.arriveAt) >>> 0),
        { attacker: { tech: attacker.tech }, defender: { tech: {} } },
      );

      advanceStrategicLayer(world, mission.arriveAt);

      expect(target.shield).toBeCloseTo(expected.shieldLeft, 8);
      expect(target.shield).toBeLessThan(beforeBattle);
    });

    it('waits out an open claim instead of re-arming the world', () => {
      const world = buildWorld({ players: 2, days: 1, seed: 5151 });
      const target = world.neutrals.find((neutral) => neutral.tier === 2)!;
      target.fleet = {};
      target.nextReinforcement = 0;
      target.claimUntil = 30;
      world.neutrals = [target];

      advanceStrategicLayer(world, 0);

      expect(target.fleet).toEqual({});
      expect(target.nextReinforcement).toBe(30);
    });

    it('counts colony slots off the capital Core, never a captured world', () => {
      const world = buildWorld({ players: 2, days: 1, seed: 5151 });
      const settler = world.players[0]!;
      const [tall, target] = world.neutrals.filter((neutral) => neutral.tier === 3);
      world.neutrals = [tall!, target!];
      world.strategicRng = () => 0;
      tall!.controllerId = settler.id;
      tall!.buildings.CORE = 12;
      settler.buildings.CORE = MULTI_WORLD.colonyCoreThresholds[1] - 1;
      settler.fleet = { [MULTI_WORLD.settlement.transportHull]: MULTI_WORLD.settlement.transports };
      settler.alloy = 100_000;
      settler.crystal = 100_000;
      settler.deuterium = 100_000;
      target!.claimUntil = 10_000;

      runStrategicSession(settler, 0, world);

      expect(world.strategicMissions.some((mission) => mission.kind === 'settlement')).toBe(false);
    });

    it('opens a settled world on its capture stock, with no founding cargo and no caretaker guard', () => {
      const world = buildWorld({ players: 2, days: 1, seed: 5151 });
      const settler = world.players[0]!;
      const target = world.neutrals.find((neutral) => neutral.tier === 2)!;
      world.neutrals = [target];
      world.strategicRng = () => 0;
      settler.buildings.CORE = MULTI_WORLD.colonyCoreThresholds[0];
      settler.fleet = { [MULTI_WORLD.settlement.transportHull]: MULTI_WORLD.settlement.transports };
      settler.alloy = 100_000;
      settler.crystal = 100_000;
      settler.deuterium = 100_000;
      target.claimUntil = 10_000;

      runStrategicSession(settler, 0, world);
      const settlement = world.strategicMissions.find((mission) => mission.kind === 'settlement');
      expect(settlement).toBeDefined();
      advanceStrategicLayer(world, settlement!.arriveAt);

      expect(target.controllerId).toBe(settler.id);
      const stock = MULTI_WORLD.neutral[2].captureStock;
      expect({ alloy: target.alloy, crystal: target.crystal, deuterium: target.deuterium }).toEqual(stock);
      expect(Object.keys(target.fleet).filter((hull) => (target.fleet[hull as keyof typeof target.fleet] ?? 0) > 0))
        .toEqual([MULTI_WORLD.settlement.transportHull]);
    });
  });
});
