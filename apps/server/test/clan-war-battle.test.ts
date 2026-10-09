import { pino } from 'pino';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { CLAN, MULTI_WORLD, SERVERS, UNAIDED, distance, escapeFuel, fleetTravelExact, fleetValue } from '@astera/rules';
import {
  battleReports,
  clanRaidRoster,
  clanScoreEvents,
  clanWarContributions,
  clanWarDominionEvents,
  clanWarMissions,
  clanWarOperations,
  clanWarParticipantResults,
  clans,
  missions,
  notifications,
  planets,
  players,
  seasons,
  scheduledEvents,
  units,
} from '../src/db/schema.js';
import {
  acceptClanRequest,
  applyToClan,
  clanActor,
  createClan,
  leaveClan,
} from '../src/services/clan.js';
import {
  markClanWarTarget,
  clanWarEscrowPlanetIds,
  sendClanWarContribution,
  startClanWar,
} from '../src/services/clanWar.js';
import { rememberWorld } from '../src/services/intel.js';
import { planetView } from '../src/services/planetView.js';
import { grantRecoveryShield } from '../src/services/attackProtection.js';
import { busy, reclaimIdleSeats } from '../src/services/reclaim.js';
import { deleteAccount } from '../src/services/accountDeletion.js';
import { readBattleReports } from '../src/services/reports.js';
import { pendingThreads } from '../src/services/session.js';
import { loadTrafficSnapshot, projectGalaxyTraffic, sensorPosts } from '../src/services/traffic.js';
import { isHostileMission } from '../src/services/flight.js';
import { EventWorker } from '../src/worker/loop.js';
import { abandon } from '../src/worker/abandon.js';
import { onMissionArrival, onSeasonEnd } from '../src/worker/handlers.js';
import {
  giveUnits,
  giveInstrument,
  giveSatellite,
  grant,
  levelWorld,
  seedWorld,
  setLevel,
  testDb,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });
const JOINT: number = MULTI_WORLD.clanJointWarRulesetVersion;

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

const workerFor = (f: Fixture) =>
  new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);

/** Advance to the last in-flight arrival and run one tick. */
async function land(f: Fixture): Promise<void> {
  const rows = await f.db
    .select({ arriveAt: missions.arriveAt })
    .from(missions)
    .where(eq(missions.status, 'in_flight'));
  const latest = rows.reduce(
    (at, row) => Math.max(at, row.arriveAt.getTime()),
    f.clock.now().getTime(),
  );
  f.clock.set(new Date(latest + 20_000));
  await workerFor(f).tick();
}

async function setup(count = 4): Promise<Fixture> {
  const f = await seedWorld(count, 808808);
  await f.db.update(seasons).set({ rulesetVersion: JOINT }).where(eq(seasons.id, f.seasonId));
  for (const planetId of f.planetIds) {
    await grant(f.db, planetId, 600_000, 300_000);
    await setLevel(f.db, planetId, 'SHIPYARD', 4);
  }
  await levelWorld(f.db, f.planetIds);
  for (const planetId of f.planetIds) {
    await setLevel(f.db, planetId, 'HANGAR', 10);
    await giveUnits(f.db, planetId, { DART: 100, COURIER: 10, GARBAGE_COLLECTOR: 2 });
  }
  for (const observerPlayerId of f.playerIds) {
    for (const targetPlanetId of f.planetIds) {
      await f.db.transaction((tx) => rememberWorld(tx, {
        observerPlayerId,
        targetPlanetId,
        seasonId: f.seasonId,
        seenAt: f.clock.now(),
        source: 'PROBE',
      }));
    }
  }
  return f;
}

async function mature(f: Fixture, playerId: string): Promise<void> {
  const { clanMemberships } = await import('../src/db/schema.js');
  const joinedAt = new Date(f.clock.now().getTime() - 13 * 3_600_000);
  await f.db.update(clanMemberships)
    .set({ joinedAt, matureAt: new Date(joinedAt.getTime() + CLAN.adaptationMinutes * 60_000) })
    .where(eq(clanMemberships.playerId, playerId));
}

async function readyOperation(f: Fixture, members = [1, 3]): Promise<string> {
  const leader = await clanActor(f.db, f.accountIds[0]!);
  const created = await f.db.transaction((tx) => createClan(tx, {
    actor: leader,
    name: 'Orion Guard',
    tag: 'OG',
    description: 'One horizon.',
    recruiting: true,
    clock: f.clock,
  }));
  for (const index of members) {
    const candidate = await clanActor(f.db, f.accountIds[index]!);
    const application = await f.db.transaction((tx) => applyToClan(tx, {
      actor: candidate,
      clanId: created.clanId,
      now: f.clock.now(),
    }));
    await f.db.transaction((tx) => acceptClanRequest(tx, {
      actor: leader,
      requestId: application.requestId,
      acknowledgeHostile: true,
      now: f.clock.now(),
    }));
  }
  for (const index of [0, ...members]) await mature(f, f.playerIds[index]!);
  // A clan hangar with room for a real pool; the ladder itself has its own tests.
  await f.db.update(clans).set({ level: 5 }).where(eq(clans.id, created.clanId));
  await f.db.transaction(async (tx) => markClanWarTarget(tx, {
    actor: await clanActor(tx, f.accountIds[0]!),
    targetPlanetId: f.planetIds[2]!,
    clock: f.clock,
  }));
  return created.clanId;
}

const send = (f: Fixture, accountIndex: number, originPlanetId: string, fleet: Record<string, number>) =>
  f.db.transaction(async (tx) => sendClanWarContribution(tx, {
    actor: await clanActor(tx, f.accountIds[accountIndex]!),
    originPlanetId,
    fleet,
    acknowledgeShieldLoss: true,
    clock: f.clock,
  }));

const start = (f: Fixture) =>
  f.db.transaction(async (tx) => startClanWar(tx, {
    actor: await clanActor(tx, f.accountIds[0]!),
    acknowledgeShieldLoss: true,
    clock: f.clock,
  }));

const view = (f: Fixture, planetId: string) =>
  f.db.transaction((tx) => planetView(tx, planetId, f.clock));

const operationRow = async (f: Fixture) => {
  const [row] = await f.db.select().from(clanWarOperations);
  return row!;
};

/**
 * Give the defender something worth taking and a line worth breaking — a thin
 * one, so the pool wins and the loot, the score and the returns are all real.
 */
async function armDefender(f: Fixture, garrison: Record<string, number> = { DART: 4 }): Promise<void> {
  await f.db.delete(units).where(eq(units.planetId, f.planetIds[2]!));
  await giveUnits(f.db, f.planetIds[2]!, garrison);
  await f.db.update(planets)
    .set({ alloy: 50_000, crystal: 20_000, deuterium: 2_000 })
    .where(eq(planets.id, f.planetIds[2]!));
}

/** The whole operation, up to and including the settled battle. */
async function fightIt(f: Fixture): Promise<void> {
  await readyOperation(f);
  await armDefender(f);
  await send(f, 0, f.planetIds[0]!, { DART: 30, COURIER: 3, GARBAGE_COLLECTOR: 1 });
  await send(f, 1, f.planetIds[1]!, { DART: 20, COURIER: 2 });
  await land(f);
  await start(f);
  await land(f);
}

/* ── the battle settles ─────────────────────────────────────────── */

describe('a combined strike settling', () => {
  it('plans every contribution origin into the combined arrival lock set', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 0, f.planetIds[0]!, { DART: 10 });
    await send(f, 1, f.planetIds[1]!, { DART: 10 });
    await land(f);
    const launched = await start(f);

    expect(new Set(await clanWarEscrowPlanetIds(f.db, launched.missionId))).toEqual(
      new Set([f.planetIds[0]!, f.planetIds[1]!]),
    );
  });

  it('writes one report bound to the operation and one result per commander', async () => {
    const f = await setup();
    await fightIt(f);

    const reports = await f.db.select().from(battleReports);
    expect(reports).toHaveLength(1);
    expect(reports[0]!.clanWarOperationId).toBe((await operationRow(f)).id);
    expect(reports[0]!.targetKind).toBe('PLAYER');
    expect(reports[0]!.defenderPlayerId).toBe(f.playerIds[2]);

    const results = await f.db.select().from(clanWarParticipantResults);
    expect(results).toHaveLength(2);
    expect(new Set(results.map((row) => row.playerId)))
      .toEqual(new Set([f.playerIds[0]!, f.playerIds[1]!]));
    expect(results.every((row) => row.reportId === reports[0]!.id)).toBe(true);
  });

  it('keeps every casualty and every survivor with the commander who sent them', async () => {
    const f = await setup();
    await fightIt(f);
    const waves = await f.db.select().from(clanWarContributions);
    for (const wave of waves) {
      expect(wave.losses).not.toBeNull();
      expect(wave.survivors).not.toBeNull();
      for (const hull of Object.keys(wave.fleet)) {
        const sent = wave.fleet[hull as keyof typeof wave.fleet] ?? 0;
        const lost = wave.losses![hull as keyof typeof wave.fleet] ?? 0;
        const alive = wave.survivors![hull as keyof typeof wave.fleet] ?? 0;
        expect(lost + alive).toBe(sent);
      }
    }
    const report = (await f.db.select().from(battleReports))[0]!;
    const summed = waves.reduce((sum, wave) => sum + fleetValue(wave.losses ?? {}), 0);
    expect(summed).toBe(fleetValue(report.attackerLosses));
  });

  it('splits the haul between the commanders and never through the clan share', async () => {
    const f = await setup();
    await fightIt(f);
    const report = (await f.db.select().from(battleReports))[0]!;
    const total = report.loot.alloy + report.loot.crystal + report.loot.deuterium;
    expect(total).toBeGreaterThan(0);

    const results = await f.db.select().from(clanWarParticipantResults);
    const paid = results.reduce(
      (sum, row) => sum + row.loot.alloy + row.loot.crystal + row.loot.deuterium,
      0,
    );
    expect(paid).toBe(total);
    // Both carried something, and nobody was handed a rounding error.
    expect(results.every((row) => row.loot.alloy + row.loot.crystal + row.loot.deuterium > 0))
      .toBe(true);
    // The ordinary ten-percent clan raid path is not on this lane at all.
    expect(await f.db.select().from(clanRaidRoster)).toHaveLength(0);
    const { clanLootShares } = await import('../src/db/schema.js');
    expect(await f.db.select().from(clanLootShares)).toHaveLength(0);
  });

  it('credits each participant their own joint haul in recovery lookback', async () => {
    const f = await setup();
    await fightIt(f);
    const results = await f.db.select().from(clanWarParticipantResults);
    const member = results.find((row) => row.playerId === f.playerIds[1]!)!;
    expect(member.loot.alloy + member.loot.crystal + member.loot.deuterium).toBeGreaterThan(0);
    const loss = { alloy: 1_000_000, crystal: 0, deuterium: 0 };
    const participant = await f.db.transaction((tx) => grantRecoveryShield(tx, {
      playerId: f.playerIds[1]!, planetId: f.planetIds[1]!, lootLost: loss,
      fleetLost: { alloy: 0, crystal: 0, deuterium: 0 }, now: f.clock.now(),
    }));
    const idle = await f.db.transaction((tx) => grantRecoveryShield(tx, {
      playerId: f.playerIds[3]!, planetId: f.planetIds[3]!, lootLost: loss,
      fleetLost: { alloy: 0, crystal: 0, deuterium: 0 }, now: f.clock.now(),
    }));
    expect(participant.hours).toBeLessThan(idle.hours);
  });

  it('moves exactly as much score to the defender as it moves to the pool', async () => {
    const f = await setup();
    await fightIt(f);
    const report = (await f.db.select().from(battleReports))[0]!;
    const audit = await f.db.select().from(clanWarDominionEvents);
    const attackers = audit.filter((row) => row.role === 'ATTACKER');
    const defender = audit.find((row) => row.role === 'DEFENDER')!;

    expect(attackers).toHaveLength(2);
    expect(attackers.reduce((sum, row) => sum + row.delta, 0)).toBe(report.dominionSwing);
    expect(defender.delta).toBe(-report.dominionSwing!);
    expect(defender.attackerCount).toBe(2);
    expect(defender.defenderCount).toBe(1);

    // And the stored ledgers agree with the audit.
    const rows = await f.db.select().from(players);
    const score = (playerId: string) => {
      const row = rows.find((candidate) => candidate.id === playerId)!;
      return row.dominionTaken - row.dominionLost;
    };
    const pool = score(f.playerIds[0]!) + score(f.playerIds[1]!);
    expect(pool + score(f.playerIds[2]!)).toBe(0);
  });

  it('divides a numerically superior win by the head count', async () => {
    const f = await setup();
    await fightIt(f);
    const audit = await f.db.select().from(clanWarDominionEvents);
    const row = audit.find((candidate) => candidate.role === 'DEFENDER')!;
    expect(row.attackerCount).toBe(2);
    if (row.baseExchange > 0) {
      // Two on one: a positive team result is halved.
      expect(row.adjustedTransfer).toBe(Math.trunc(row.baseExchange / 2));
    } else {
      expect(row.adjustedTransfer).toBe(row.baseExchange * 2);
    }
  });

  it('books the clan ladder once, from the operation snapshot', async () => {
    const f = await setup();
    await fightIt(f);
    const events = await f.db.select().from(clanScoreEvents);
    expect(events.filter((row) => row.side === 'ATTACK')).toHaveLength(1);
    const [clan] = await f.db.select().from(clans);
    const report = (await f.db.select().from(battleReports))[0]!;
    expect(clan!.dominionTaken - clan!.dominionLost).toBe(report.dominionSwing);
  });

  it('does not deadlock clan management while settling joint-war Dominion', async () => {
    const f = await setup();
    const scoreClanId = await readyOperation(f);
    await armDefender(f);
    await send(f, 0, f.planetIds[0]!, { DART: 30, COURIER: 2 });
    const launched = await start(f);
    const [event] = await f.db.select().from(scheduledEvents)
      .where(eq(scheduledEvents.refId, launched.missionId));
    f.clock.set(new Date(new Date(launched.resolveAt).getTime() + 1_000));

    let announceClanLocked!: () => void;
    const clanLocked = new Promise<void>((resolve) => { announceClanLocked = resolve; });
    let competeForPlayer!: () => void;
    const compete = new Promise<void>((resolve) => { competeForPlayer = resolve; });
    const clanManagement = f.db.transaction(async (tx) => {
      await tx.select({ id: clans.id }).from(clans)
        .where(eq(clans.id, scoreClanId)).for('update');
      announceClanLocked();
      await compete;
      await tx.select({ id: players.id }).from(players)
        .where(eq(players.id, f.playerIds[0]!)).for('update');
    });
    await clanLocked;

    const arrival = onMissionArrival({ db: f.db, clock: f.clock }, event!);
    await new Promise((resolve) => setTimeout(resolve, 100));
    competeForPlayer();
    const outcomes = await Promise.allSettled([clanManagement, arrival]);

    expect(outcomes.map((outcome) => outcome.status)).toEqual(['fulfilled', 'fulfilled']);
  });
});

/* ── everybody flies home ───────────────────────────────────────── */

describe('after the battle', () => {
  it('calls battle survivors a raid return and includes the haul in their notification', async () => {
    const f = await setup();
    await fightIt(f);
    const waves = await f.db.select().from(clanWarContributions);
    await land(f);

    const returned = await f.db.select().from(notifications)
      .where(eq(notifications.kind, 'fleet_returned'));
    for (const wave of waves.filter((row) => row.status === 'RETURNING')) {
      const notice = returned.find((row) => row.playerId === wave.playerId);
      expect(notice?.payload).toMatchObject({
        trip: 'raid',
        ships: Object.values(wave.survivors ?? {}).reduce((sum, count) => sum + count, 0),
        fromPlanetId: f.planetIds[2],
        lootAlloy: wave.loot?.alloy ?? 0,
        lootCrystal: wave.loot?.crystal ?? 0,
        lootDeuterium: wave.loot?.deuterium ?? 0,
      });
    }
  });

  /** Owner decision, 2026-10-06: a fleet flies home at the speed the strike flew out. */
  it('flies the survivors home at the strike pace', async () => {
    const f = await setup();
    await readyOperation(f);
    await armDefender(f);
    await send(f, 1, f.planetIds[1]!, { DART: 20 });
    await land(f);
    const result = await f.db.transaction(async (tx) => startClanWar(tx, {
      actor: await clanActor(tx, f.accountIds[0]!),
      acknowledgeShieldLoss: true,
      pace: 0.5,
      clock: f.clock,
    }));
    await land(f);

    const [leg] = await f.db.select({ mission: missions }).from(clanWarMissions)
      .innerJoin(missions, eq(missions.id, clanWarMissions.missionId))
      .where(eq(clanWarMissions.leg, 'BATTLE_RETURN'));
    expect(result.missionId).toBeTruthy();
    expect(leg).toBeTruthy();
    const back = leg!.mission;
    expect(back.pace).toBe(0.5);
    const rows = await f.db.select().from(planets);
    const from = rows.find((row) => row.id === back.originPlanetId)!;
    const to = rows.find((row) => row.id === back.targetPlanetId)!;
    const minutes = (back.arriveAt.getTime() - back.departAt.getTime()) / 60_000;
    expect(minutes).toBeCloseTo(
      fleetTravelExact(distance(from, to), back.fleet, { ...UNAIDED, pace: 0.5 }), 3);
  });

  it('sends every survivor to the world it left from, carrying its own share', async () => {
    const f = await setup();
    await fightIt(f);

    const legs = await f.db.select().from(clanWarMissions)
      .where(eq(clanWarMissions.leg, 'BATTLE_RETURN'));
    expect(legs.length).toBeGreaterThan(0);
    const returns = await f.db.select().from(missions).where(eq(missions.status, 'in_flight'));
    const destinations = new Set(returns.map((row) => row.targetPlanetId));
    expect(destinations).toContain(f.planetIds[1]!);

    const before = await view(f, f.planetIds[1]!);
    await land(f);
    const after = await view(f, f.planetIds[1]!);
    expect(after.fleet.DART ?? 0).toBeGreaterThan(before.fleet.DART ?? 0);

    const waves = await f.db.select().from(clanWarContributions);
    expect(waves.every((wave) => wave.status === 'HOME' || wave.status === 'LOST')).toBe(true);
    expect((await operationRow(f)).status).toBe('COMPLETED');
  });

  it('falls back to the owner capital when a contribution origin is lost before the return', async () => {
    const f = await setup(5);
    await readyOperation(f);
    const colonyId = f.planetIds[4]!;
    await f.db.update(planets)
      .set({ kind: 'COLONY', controllerPlayerId: f.playerIds[1]! })
      .where(eq(planets.id, colonyId));
    await f.db.delete(units).where(eq(units.planetId, colonyId));
    await giveUnits(f.db, colonyId, { DART: 40 });
    await armDefender(f);
    await send(f, 1, colonyId, { DART: 40 });
    await land(f);
    await start(f);
    await f.db.update(planets)
      .set({ kind: 'CAPITAL', controllerPlayerId: f.playerIds[4]! })
      .where(eq(planets.id, colonyId));
    await land(f);

    const [returnLeg] = await f.db.select({ mission: missions })
      .from(clanWarMissions)
      .innerJoin(missions, eq(missions.id, clanWarMissions.missionId))
      .where(eq(clanWarMissions.leg, 'BATTLE_RETURN'));
    expect(returnLeg!.mission.targetPlanetId).toBe(f.planetIds[1]!);
    await land(f);
    const [wave] = await f.db.select().from(clanWarContributions);
    expect(wave!.status).toBe('HOME');
    const home = await f.db.select().from(units).where(eq(units.planetId, f.planetIds[1]!));
    expect(home.find((row) => row.hull === 'DART' && row.location === 'home')?.count)
      .toBe(100 + (wave!.survivors?.DART ?? 0));
  });

  it('deposits each wave’s loot and salvage on its destination exactly once', async () => {
    const f = await setup();
    await fightIt(f);
    const waves = await f.db.select().from(clanWarContributions);
    const expected = waves.filter((wave) => wave.playerId === f.playerIds[1]!).reduce(
      (sum, wave) => ({
        alloy: sum.alloy + (wave.loot?.alloy ?? 0) + (wave.salvage?.alloy ?? 0),
        crystal: sum.crystal + (wave.loot?.crystal ?? 0) + (wave.salvage?.crystal ?? 0),
        deuterium: sum.deuterium + (wave.loot?.deuterium ?? 0) + (wave.salvage?.deuterium ?? 0),
      }), { alloy: 0, crystal: 0, deuterium: 0 },
    );
    expect(expected.alloy + expected.crystal + expected.deuterium).toBeGreaterThan(0);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
    await land(f);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
    expect(after!.alloy - before!.alloy).toBe(expected.alloy);
    expect(after!.crystal - before!.crystal).toBe(expected.crystal);
    expect(after!.deuterium - before!.deuterium).toBe(expected.deuterium);
    await workerFor(f).tick();
    const [again] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
    expect(again!.alloy).toBe(after!.alloy);
  });

  it('lands the leader capital survivors back on the staging world', async () => {
    const f = await setup();
    await fightIt(f);
    await land(f);
    const wave = (await f.db.select().from(clanWarContributions))
      .find((row) => row.sourceKind === 'LEADER_CAPITAL')!;
    expect(wave.status).toBe('HOME');
    const parked = await f.db.select().from(units).where(eq(units.planetId, f.planetIds[0]!));
    expect(parked.some((row) => row.location.startsWith('clan-war:'))).toBe(false);
  });

  it('does not restore a leader-capital wave to its pre-battle roster while its survivors return', async () => {
    const f = await setup();
    await readyOperation(f);
    await armDefender(f, { BASTION: 4 });
    await send(f, 0, f.planetIds[0]!, { DART: 100 });
    await start(f);
    await land(f);

    const [wave] = await f.db.select().from(clanWarContributions);
    expect(wave!.losses?.DART).toBeGreaterThan(0);
    expect(wave!.survivors?.DART).toBeGreaterThan(0);
    expect(wave!.status).toBe('RETURNING');
    const beforeReturn = await f.db.select().from(units)
      .where(eq(units.planetId, f.planetIds[0]!));
    expect(beforeReturn.find((row) => row.hull === 'DART' && row.location === 'home')?.count ?? 0)
      .toBe(0);

    await land(f);
    const home = await f.db.select().from(units)
      .where(eq(units.planetId, f.planetIds[0]!));
    expect(home.find((row) => row.hull === 'DART' && row.location === 'home')?.count)
      .toBe(wave!.survivors!.DART);
  });

  it('frees the clan hangar and every flight bay once the last wave lands', async () => {
    const f = await setup();
    await fightIt(f);
    await land(f);
    const { baysOf } = await import('../src/services/flight.js');
    const bays = await baysOf(f.db, f.planetIds[1]!, 16);
    expect(bays.used).toBe(0);
    const { readClanWar } = await import('../src/services/clanWar.js');
    const war = await readClanWar(f.db, await clanActor(f.db, f.accountIds[0]!), f.clock.now());
    expect(war.hangar.used + war.hangar.reserved).toBe(0);
    expect(war.operation).toBeNull();
  });

  it('tells every participant, the defender and nobody else', async () => {
    const f = await setup();
    await fightIt(f);
    const rows = await f.db.select().from(notifications);
    const kinds = new Map<string, string[]>();
    for (const row of rows) {
      kinds.set(row.playerId, [...(kinds.get(row.playerId) ?? []), row.kind]);
    }
    expect(kinds.get(f.playerIds[2]!)).toContain('raided');
    expect(kinds.get(f.playerIds[0]!)).toContain('raid_result');
    expect(kinds.get(f.playerIds[1]!)).toContain('raid_result');
    expect(kinds.get(f.playerIds[3]!) ?? []).not.toContain('raid_result');
  });

  it('tells a coordinator who sent no hulls, exactly once', async () => {
    const f = await setup();
    await readyOperation(f);
    await armDefender(f);
    await send(f, 1, f.planetIds[1]!, { DART: 30, COURIER: 2 });
    await land(f);
    await start(f);
    await land(f);

    const rows = await f.db.select().from(notifications)
      .where(eq(notifications.playerId, f.playerIds[0]!));
    const results = rows.filter((row) => row.kind === 'raid_result');
    expect(results).toHaveLength(1);
    expect(results[0]!.payload).toMatchObject({ coordinator: true });
    // And the coordinator has no participant result, because they did not fight.
    const participants = await f.db.select().from(clanWarParticipantResults);
    expect(participants.map((row) => row.playerId)).toEqual([f.playerIds[1]!]);
  });
});

describe('permanently failed joint-war events', () => {
  const abandonLeg = async (f: Fixture, leg: 'SUPPORT_OUT' | 'COMBINED_ATTACK' | 'BATTLE_RETURN') => {
    const [link] = await f.db.select().from(clanWarMissions).where(eq(clanWarMissions.leg, leg));
    expect(link).toBeDefined();
    const [event] = await f.db.select().from(scheduledEvents)
      .where(eq(scheduledEvents.refId, link!.missionId));
    expect(event).toBeDefined();
    expect(await abandon(f.db, event!, f.clock)).toBe(true);
    expect(await abandon(f.db, event!, f.clock)).toBe(false);
  };

  it('releases a failed support leg and its hangar reservation', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 12 });
    await abandonLeg(f, 'SUPPORT_OUT');
    const [wave] = await f.db.select().from(clanWarContributions);
    expect(wave!.status).toBe('HOME');
    const home = await f.db.select().from(units).where(eq(units.planetId, f.planetIds[1]!));
    expect(home.find((row) => row.hull === 'DART' && row.location === 'home')?.count).toBe(100);
  });

  it('returns every participant intact when the combined arrival fails', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 0, f.planetIds[0]!, { DART: 12 });
    await send(f, 1, f.planetIds[1]!, { DART: 12 });
    await land(f);
    await start(f);
    await abandonLeg(f, 'COMBINED_ATTACK');
    expect(await f.db.select().from(battleReports)).toHaveLength(0);
    expect((await operationRow(f)).closeReason).toBe('FAILED');
    await land(f);
    const waves = await f.db.select().from(clanWarContributions);
    expect(waves.every((wave) => wave.status === 'HOME')).toBe(true);
  });

  it('lands a failed return with its earned haul and completes the operation', async () => {
    const f = await setup();
    await fightIt(f);
    const links = await f.db.select().from(clanWarMissions)
      .where(eq(clanWarMissions.leg, 'BATTLE_RETURN'));
    const returning = await f.db.select().from(clanWarContributions);
    const wave = returning.find((candidate) => candidate.status === 'RETURNING')!;
    const link = links.find((candidate) => candidate.contributionId === wave.id)!;
    const [returnMission] = await f.db.select().from(missions)
      .where(eq(missions.id, link.missionId));
    expect(wave.status).toBe('RETURNING');
    expect(returnMission!.targetPlanetId).toBe(wave.originPlanetId);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, wave.originPlanetId));
    const [event] = await f.db.select().from(scheduledEvents)
      .where(eq(scheduledEvents.refId, link.missionId));
    expect(await abandon(f.db, event!, f.clock)).toBe(true);
    expect(await abandon(f.db, event!, f.clock)).toBe(false);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, wave.originPlanetId));
    expect(after!.alloy - before!.alloy).toBe((wave.loot?.alloy ?? 0) + (wave.salvage?.alloy ?? 0));
    expect((await f.db.select().from(clanWarContributions)
      .where(eq(clanWarContributions.id, wave.id)))[0]!.status).toBe('HOME');
    await land(f);
    expect((await operationRow(f)).status).toBe('COMPLETED');
  });
});

describe('joint-war lifecycle guards', () => {
  it('defers reclaim of the coordinator, a staged contributor and the marked target', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 12 });
    await land(f);
    const empty = { runIds: [], raidIds: [], tradeIds: [], convoyIds: [] };
    const guarded = [];
    for (const index of [0, 1, 2]) {
      guarded.push(await f.db.transaction((tx) => busy(
        tx, [f.planetIds[index]!], f.playerIds[index]!, empty,
      )));
    }
    expect(guarded).toEqual([true, true, true]);
  });

  it('defers an idle coordinator and refuses account deletion while the operation is active', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 12 });
    await land(f);
    const old = new Date(f.clock.now().getTime() - (SERVERS.idleDays + 1) * 86_400_000);
    await f.db.update(players).set({ joinedAt: old, lastActiveAt: old })
      .where(eq(players.id, f.playerIds[0]!));
    const reclaim = await reclaimIdleSeats(f.db, f.clock);
    expect(reclaim).toMatchObject({ reclaimed: [], deferred: 1, failed: 0 });
    await expect(deleteAccount(f.db, f.clock, 'Tester0'))
      .rejects.toMatchObject({ code: 'WORLD_BUSY' });
  });

  it('reclaims a commander after every joint-war return is terminal', async () => {
    const f = await setup();
    await fightIt(f);
    await land(f);
    expect((await operationRow(f)).status).toBe('COMPLETED');
    const old = new Date(f.clock.now().getTime() - (SERVERS.idleDays + 1) * 86_400_000);
    await f.db.update(players).set({ joinedAt: old, lastActiveAt: old })
      .where(eq(players.id, f.playerIds[0]!));
    const reclaim = await reclaimIdleSeats(f.db, f.clock);
    expect(reclaim.failed).toBe(0);
    expect(reclaim.reclaimed).toHaveLength(1);
  });

  it('postpones season freeze while an assembling pool still holds a staged wave', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 12 });
    await land(f);
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const [event] = await f.db.select().from(scheduledEvents)
      .where(eq(scheduledEvents.kind, 'season_end'));
    f.clock.set(season!.endsAt);
    await onSeasonEnd({ db: f.db, clock: f.clock }, event!);
    const [after] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    expect(after!.status).toBe('live');
    const [replacement] = await f.db.select().from(scheduledEvents)
      .where(eq(scheduledEvents.kind, 'season_end'));
    expect(replacement!.id).not.toBe(event!.id);
  });
});

describe('joint report visibility', () => {
  it('shows every participant and the defender while refusing an uninvolved commander', async () => {
    const f = await setup();
    await fightIt(f);
    const member = await readBattleReports(f.db, f.playerIds[1]!);
    const defender = await readBattleReports(f.db, f.playerIds[2]!);
    const outsider = await readBattleReports(f.db, f.playerIds[3]!);
    expect(member.reports).toHaveLength(1);
    expect(defender.reports).toHaveLength(1);
    expect(outsider.reports).toHaveLength(0);
    expect(member.reports[0]).toMatchObject({ kind: 'BATTLE', attacking: true });
    expect(defender.reports[0]).toMatchObject({ kind: 'BATTLE', attacking: false });
    if (member.reports[0]?.kind !== 'BATTLE' || defender.reports[0]?.kind !== 'BATTLE') return;
    expect(member.reports[0].yourFleet.DART).toBe(20);
    expect(member.reports[0].theirFleet).toEqual({});
    // S4: a participant's balance carries what their own waves paid up front; the defender's none.
    const paid = (await f.db.select({ fuelPaid: clanWarContributions.fuelPaid }).from(clanWarContributions)
      .where(eq(clanWarContributions.playerId, f.playerIds[1]!)))
      .reduce((sum, wave) => sum + wave.fuelPaid, 0);
    expect(paid).toBeGreaterThan(0);
    expect(member.reports[0].fuelPaid).toBe(paid);
    expect(defender.reports[0].fuelPaid).toBeNull();
    expect(defender.reports[0].theirFleet.DART).toBe(50);
    expect(member.reports[0].jointWar?.participants).toHaveLength(2);
    expect(member.reports[0].jointWar?.participants.find((result) => result.playerId === f.playerIds[1])
      ?.waves[0]?.originPlanetId).toBe(f.planetIds[1]);
    const [memberOrigin] = await f.db.select({ name: planets.name }).from(planets)
      .where(eq(planets.id, f.planetIds[1]!));
    expect(member.reports[0].jointWar?.participants.find((result) => result.playerId === f.playerIds[1])
      ?.waves[0]?.destinationPlanetName).toBe(memberOrigin!.name);
    expect(member.rivals.some((rival) => rival.playerId === f.playerIds[2])).toBe(true);
    const departing = await clanActor(f.db, f.accountIds[1]!);
    await f.db.transaction((tx) => leaveClan(tx, { actor: departing, now: f.clock.now() }));
    expect((await readBattleReports(f.db, f.playerIds[1]!)).reports).toHaveLength(1);
  });

  it('gives a coordinator with no ships attacker fog and no personal loot', async () => {
    const f = await setup();
    await readyOperation(f);
    await armDefender(f);
    await send(f, 1, f.planetIds[1]!, { DART: 30, COURIER: 2 });
    await land(f);
    await start(f);
    await land(f);
    const leader = await readBattleReports(f.db, f.playerIds[0]!);
    expect(leader.reports).toHaveLength(1);
    expect(leader.reports[0]).toMatchObject({ kind: 'BATTLE', attacking: true, lootAlloy: 0 });
    if (leader.reports[0]?.kind !== 'BATTLE') return;
    expect(leader.reports[0].yourFleet).toEqual({});
    expect(leader.reports[0].theirFleet).toEqual({});
    expect(leader.rivals).toHaveLength(0);
  });
});

describe('joint fleet traffic', () => {
  it('classifies only COMBINED_ATTACK as hostile among the four joint-war legs', () => {
    const mission = { kind: 'clan_war' as const, parentMissionId: null, recalledAt: null };
    expect(isHostileMission(mission, 'SUPPORT_OUT')).toBe(false);
    expect(isHostileMission(mission, 'SUPPORT_RETURN')).toBe(false);
    expect(isHostileMission(mission, 'COMBINED_ATTACK')).toBe(true);
    expect(isHostileMission(mission, 'BATTLE_RETURN')).toBe(false);
  });

  it('applies NONE, every Radar disclosure rung, and Telescope identity to the combined strike', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 20 });
    const support = (await f.db.select().from(clanWarMissions))
      .find((leg) => leg.leg === 'SUPPORT_OUT')!;
    const posts = await sensorPosts(f.db, [f.planetIds[3]!]);
    const exactPosts = posts.map((post) => ({ ...post, detect: 1e9, identify: 1e9 }));
    const traffic = async (sensors: typeof exactPosts) => projectGalaxyTraffic(
      await loadTrafficSnapshot(f.db, f.seasonId, f.clock.now()),
      f.planetIds[3]!, f.clock.now(), f.playerIds[3]!, [f.planetIds[3]!],
      sensors, new Set(), null, new Set(),
    );
    const supportContact = (await traffic(exactPosts))
      .find((contact) => contact.id === support.missionId);
    expect(supportContact?.clanFleet).toBeUndefined();
    expect(supportContact?.inbound).toBeUndefined();
    expect(supportContact?.engagement).toBeUndefined();
    await land(f);
    await start(f);
    const combined = (await f.db.select().from(clanWarMissions))
      .find((leg) => leg.leg === 'COMBINED_ATTACK')!;

    const snapshot = await loadTrafficSnapshot(f.db, f.seasonId, f.clock.now());
    const defenderPosts = await sensorPosts(f.db, [f.planetIds[2]!]);
    const project = (sensors: typeof defenderPosts, now = f.clock.now()) => projectGalaxyTraffic(
      snapshot, f.planetIds[2]!, now, f.playerIds[2]!, [f.planetIds[2]!],
      sensors, new Set(), null, new Set(),
    );
    expect(project([]).find((contact) => contact.id === combined.missionId)).toBeUndefined();

    const contactPost = defenderPosts.map((post) => ({
      ...post, detect: 1e9, identify: 0, revealsSize: false, revealsKind: false,
    }));
    const low = project(contactPost).find((contact) => contact.id === combined.missionId)!;
    expect(low).toMatchObject({ kind: 'unknown', inbound: true });
    expect(low.mass).toBeUndefined();
    expect(low.silhouette).toBeUndefined();
    expect(low.fleet).toBeUndefined();
    expect(low.clanFleet).toBeUndefined();

    const medium = project(contactPost.map((post) => ({ ...post, revealsSize: true })))
      .find((contact) => contact.id === combined.missionId)!;
    expect(medium).toMatchObject({ inbound: true, mass: 'LIGHT' });
    expect(medium.silhouette).toBeUndefined();

    const high = project(contactPost.map((post) => ({
      ...post, revealsSize: true, revealsKind: true,
    }))).find((contact) => contact.id === combined.missionId)!;
    expect(high).toMatchObject({ inbound: true, mass: 'LIGHT', silhouette: 'fleet' });
    expect(high.fleet).toBeUndefined();
    expect(high.clanFleet).toBeUndefined();

    const telescope = defenderPosts.map((post) => ({ ...post, detect: 1e9, identify: 1e9 }));
    const exact = project(telescope).find((contact) => contact.id === combined.missionId)!;
    expect(exact.inbound).toBe(true);
    expect(exact.clanFleet).toMatchObject({ tag: 'OG', label: '[OG] Klan Filosu' });
    expect(exact.fleet?.DART).toBe(20);

    const [mission] = await f.db.select().from(missions).where(eq(missions.id, combined.missionId));
    f.clock.set(new Date(mission!.arriveAt.getTime() + 1));
    const engagementSnapshot = await loadTrafficSnapshot(f.db, f.seasonId, f.clock.now());
    const engagement = projectGalaxyTraffic(
      engagementSnapshot, f.planetIds[2]!, f.clock.now(), f.playerIds[2]!, [f.planetIds[2]!],
      [], new Set(), null, new Set(),
    ).find((contact) => contact.id === combined.missionId)!;
    expect(engagement.effectOnly).toBe(true);
    expect(engagement.engagement?.target).toBeDefined();
  });

  it('warns through pending at L3/L4/L5 and reveals only the frozen clan fleet identity', async () => {
    const f = await setup();
    await readyOperation(f);
    await giveSatellite(f.db, f.planetIds[2]!, 'UPLINK');
    await giveInstrument(f.db, f.planetIds[2]!, 'RADAR', 3);
    await send(f, 1, f.planetIds[1]!, { DART: 20 });
    await land(f);
    await start(f);
    const combined = (await f.db.select().from(clanWarMissions))
      .find((leg) => leg.leg === 'COMBINED_ATTACK')!;
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, combined.missionId));
    f.clock.set(new Date(mission!.arriveAt.getTime() - 1_000));

    const [low] = await pendingThreads(f.db, f.planetIds[2]!, f.clock.now());
    expect(low).toMatchObject({ kind: 'incoming', contactId: combined.missionId });
    expect(low!.mass).toBeUndefined();
    expect(low!.fleet).toBeUndefined();
    expect(low!.originName).toBeUndefined();

    await giveInstrument(f.db, f.planetIds[2]!, 'RADAR', 4);
    const [medium] = await pendingThreads(f.db, f.planetIds[2]!, f.clock.now());
    expect(medium).toMatchObject({ kind: 'incoming', mass: 'LIGHT' });
    expect(medium!.fleet).toBeUndefined();
    expect(medium!.originName).toBeUndefined();

    await giveInstrument(f.db, f.planetIds[2]!, 'RADAR', 5);
    const [high] = await pendingThreads(f.db, f.planetIds[2]!, f.clock.now());
    expect(high).toMatchObject({
      kind: 'incoming', mass: 'LIGHT', fleet: { DART: 20 }, originName: '[OG] Klan Filosu',
    });
    expect(JSON.stringify(high)).not.toContain(f.planetIds[0]!);
    expect(JSON.stringify(high)).not.toContain('Tester0');
  });

  it('sends the L5 radar warning with clan identity and no coordinator identity', async () => {
    const f = await setup();
    await readyOperation(f);
    await giveSatellite(f.db, f.planetIds[2]!, 'UPLINK');
    await giveInstrument(f.db, f.planetIds[2]!, 'RADAR', 5);
    await send(f, 1, f.planetIds[1]!, { DART: 20 });
    await land(f);
    await start(f);
    const combined = (await f.db.select().from(clanWarMissions))
      .find((leg) => leg.leg === 'COMBINED_ATTACK')!;
    const [warningEvent] = (await f.db.select().from(scheduledEvents))
      .filter((event) => event.kind === 'radar_warning' && event.refId === combined.missionId);
    expect(warningEvent).toBeDefined();
    f.clock.set(new Date(Math.max(f.clock.now().getTime(), warningEvent!.resolveAt.getTime()) + 1));
    await workerFor(f).tick();

    const [warning] = (await f.db.select().from(notifications))
      .filter((row) => row.kind === 'incoming_fleet' && row.refId === combined.missionId);
    expect(warning?.payload).toMatchObject({
      originUsername: 'Klan Filosu', originClanTag: 'OG', fleet: { DART: 20 }, mass: 'LIGHT',
    });
    expect(warning?.payload).not.toHaveProperty('originPlanetId');
    expect(warning?.payload).not.toHaveProperty('originPlanetName');
    expect(JSON.stringify(warning?.payload)).not.toContain('Tester0');
    expect(JSON.stringify(warning?.payload)).not.toContain(f.planetIds[0]!);
  });
});

/* ── the awkward outcomes ───────────────────────────────────────── */

describe('the outcomes that are not a clean win', () => {
  it('returns the pool untouched when a contributor takes the target in flight', async () => {
    const f = await setup();
    await readyOperation(f);
    await armDefender(f);
    await send(f, 1, f.planetIds[1]!, { DART: 20 });
    await land(f);
    await start(f);
    await f.db.update(planets)
      .set({ kind: 'COLONY', controllerPlayerId: f.playerIds[1]! })
      .where(eq(planets.id, f.planetIds[2]!));
    await land(f);

    expect(await f.db.select().from(battleReports)).toHaveLength(0);
    expect(await f.db.select().from(clanWarDominionEvents)).toHaveLength(0);
    expect((await operationRow(f)).closeReason).toBe('TARGET_CHANGED');
    expect((await f.db.select().from(clanWarContributions))[0]!.status).toBe('RETURNING');
  });

  it('turns the pool round untouched when the target gained a shield in flight', async () => {
    const f = await setup();
    await readyOperation(f);
    await armDefender(f);
    await send(f, 1, f.planetIds[1]!, { DART: 20 });
    await land(f);
    await start(f);
    await f.db.update(planets)
      .set({ protectedUntil: new Date(f.clock.now().getTime() + 6 * 3_600_000) })
      .where(eq(planets.id, f.planetIds[2]!));
    const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[2]!));
    await land(f);

    expect(await f.db.select().from(battleReports)).toHaveLength(0);
    expect(await f.db.select().from(clanWarDominionEvents)).toHaveLength(0);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[2]!));
    expect(Math.round(after!.alloy)).toBe(Math.round(before!.alloy));
    const op = await operationRow(f);
    expect(op.closeReason).toBe('TARGET_CHANGED');
    const wave = (await f.db.select().from(clanWarContributions))[0]!;
    expect(wave.status).toBe('RETURNING');
  });

  it('marks a wiped wave LOST and still settles everybody else', async () => {
    const f = await setup();
    await readyOperation(f);
    // A wall nothing in the pool can break.
    await armDefender(f, { BASTION: 200 });
    await send(f, 0, f.planetIds[0]!, { DART: 1 });
    await send(f, 1, f.planetIds[1]!, { DART: 1 });
    await land(f);
    await start(f);
    await land(f);

    const waves = await f.db.select().from(clanWarContributions);
    expect(waves.every((wave) => wave.status === 'LOST')).toBe(true);
    expect((await operationRow(f)).status).toBe('COMPLETED');
    const report = (await f.db.select().from(battleReports))[0]!;
    expect(report.grade).toBe('REPELLED');
    // The defender came out ahead, and the ledgers still sum to zero.
    const rows = await f.db.select().from(players);
    const score = (playerId: string) => {
      const row = rows.find((candidate) => candidate.id === playerId)!;
      return row.dominionTaken - row.dominionLost;
    };
    expect(score(f.playerIds[2]!)).toBeGreaterThan(0);
    expect(score(f.playerIds[0]!) + score(f.playerIds[1]!) + score(f.playerIds[2]!)).toBe(0);
  });

  it('settles once however many times the arrival is delivered', async () => {
    const f = await setup();
    await fightIt(f);
    const first = await f.db.select().from(battleReports);
    await workerFor(f).tick();
    await workerFor(f).tick();
    expect(await f.db.select().from(battleReports)).toHaveLength(first.length);
    expect(await f.db.select().from(clanWarParticipantResults)).toHaveLength(2);
  });
});

/* ── taktik geri çekilme ────────────────────────────────────────── */

/**
 * THE ESCAPE READS THE WHOLE POOL. Owner decision, 2026-09-23.
 *
 * A joint war is one wing arriving at once, so the waves are added up before they are
 * weighed against the line — three commanders who each send a match for it are three
 * times it, exactly as one commander sending all three would be. The rule itself is
 * `packages/rules/test/escape.test.ts`; this holds the settlement's bookkeeping.
 */
describe('a combined strike and the fleet escape', () => {
  const garrison = async (f: Fixture) => {
    const rows = await f.db.select().from(units).where(eq(units.planetId, f.planetIds[2]!));
    return rows.filter((row) => row.location === 'home' && row.count > 0)
      .reduce<Record<string, number>>((fleet, row) => ({ ...fleet, [row.hull]: row.count }), {});
  };

  it('lets the defending ships lift off when the combined waves exceed the escape threshold', async () => {
    const f = await setup();
    await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.fleetEscapeRulesetVersion })
      .where(eq(seasons.id, f.seasonId));
    await fightIt(f);

    const report = (await f.db.select().from(battleReports))[0]!;
    expect(report.fleetEscape).toEqual({ kind: 'ESCAPED', ships: { DART: 4 }, fuel: escapeFuel({ DART: 4 }) });
    expect(report.defenderLosses).toEqual({});
    expect(report.defenderFleet).toEqual({});
    expect(await garrison(f)).toEqual({ DART: 4 });
    const [world] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[2]!));
    expect(world!.deuterium).toBeCloseTo(2_000 - escapeFuel({ DART: 4 }) - report.loot.deuterium, 0);
  });

  it('keeps a joint war in a season dealt before the rule on the old one', async () => {
    const f = await setup();
    await fightIt(f);
    const report = (await f.db.select().from(battleReports))[0]!;
    expect(report.fleetEscape).toBeNull();
    expect(report.defenderLosses).toEqual({ DART: 4 });
    expect(await garrison(f)).toEqual({});
  });
});
