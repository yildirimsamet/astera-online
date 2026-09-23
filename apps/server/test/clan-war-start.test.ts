import { pino } from 'pino';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { ABUSE, CLAN, MULTI_WORLD, TRAVEL, fleetSpeed } from '@astera/rules';
import {
  attackCommitments,
  clanCeasefires,
  clanRaidRoster,
  clanWarContributions,
  clanWarMissions,
  clanWarOperations,
  missions,
  planets,
  players,
  scheduledEvents,
  seasons,
} from '../src/db/schema.js';
import {
  acceptClanRequest,
  applyToClan,
  clanActor,
  createClan,
} from '../src/services/clan.js';
import {
  cancelClanWarOperation,
  markClanWarTarget,
  quoteClanWarContribution,
  recallClanWarContribution,
  sendClanWarContribution,
  startClanWar,
  resolveClanWarExpiry,
  projectOperation,
} from '../src/services/clanWar.js';
import { rememberWorld } from '../src/services/intel.js';
import { launchAttack } from '../src/services/mission.js';
import { recheckRadarLegsForWorld, wakeInboundRadarWarnings } from '../src/services/radar.js';
import { EventWorker } from '../src/worker/loop.js';
import { ensureWaitingSeason } from '../src/services/waitingServers.js';
import {
  giveNewcomerShield,
  giveSatellite,
  giveUnits,
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

async function landStaging(f: Fixture): Promise<void> {
  const rows = await f.db
    .select({ arriveAt: missions.arriveAt })
    .from(missions)
    .where(eq(missions.status, 'in_flight'));
  const latest = rows.reduce(
    (at, row) => Math.max(at, row.arriveAt.getTime()),
    f.clock.now().getTime(),
  );
  f.clock.set(new Date(latest + 1_000));
  await workerFor(f).tick();
}

async function setup(count = 4): Promise<Fixture> {
  const f = await seedWorld(count, 707707);
  await f.db.update(seasons).set({ rulesetVersion: JOINT }).where(eq(seasons.id, f.seasonId));
  for (const planetId of f.planetIds) {
    await grant(f.db, planetId, 600_000, 300_000);
    await setLevel(f.db, planetId, 'SHIPYARD', 4);
  }
  await levelWorld(f.db, f.planetIds);
  for (const planetId of f.planetIds) {
    await setLevel(f.db, planetId, 'HANGAR', 10);
    await giveUnits(f.db, planetId, { DART: 200, COURIER: 20 });
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

const start = (f: Fixture, acknowledgeShieldLoss = true) =>
  f.db.transaction(async (tx) => startClanWar(tx, {
    actor: await clanActor(tx, f.accountIds[0]!),
    acknowledgeShieldLoss,
    clock: f.clock,
  }));

const operationRow = async (f: Fixture) => {
  const [row] = await f.db.select().from(clanWarOperations);
  return row!;
};

/**
 * Hold the shared staging row until every contender is demonstrably waiting on
 * a PostgreSQL lock. This is a race barrier, not a pair of promises whose order
 * depends on the test runner's timing.
 */
async function raceBehindStagingLock(
  f: Fixture,
  contenders: readonly (() => Promise<unknown>)[],
  lockPlanetId: string = f.planetIds[0]!,
): Promise<PromiseSettledResult<unknown>[]> {
  let locked!: () => void;
  let release!: () => void;
  const hasLock = new Promise<void>((resolve) => { locked = resolve; });
  const mayRelease = new Promise<void>((resolve) => { release = resolve; });
  const holder = f.db.transaction(async (tx) => {
    await tx.select({ id: planets.id }).from(planets)
      .where(eq(planets.id, lockPlanetId))
      .for('update');
    locked();
    await mayRelease;
  });
  await hasLock;
  const outcomes = Promise.allSettled(contenders.map((contender) => contender()));
  try {
    let waiting = 0;
    for (let attempt = 0; attempt < 200 && waiting < contenders.length; attempt += 1) {
      const rows = await f.db.execute<{ count: number }>(sql`
        SELECT count(*)::integer AS count
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
          AND state = 'active'
          AND wait_event_type = 'Lock'
      `);
      waiting = rows[0]?.count ?? 0;
      if (waiting < contenders.length) {
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      }
    }
    expect(waiting, 'not every race contender reached the database lock barrier')
      .toBeGreaterThanOrEqual(contenders.length);
  } finally {
    release();
    await holder;
  }
  return outcomes;
}

/* ── launching ──────────────────────────────────────────────────── */

describe('launching the combined strike', () => {
  it('sends one mission, locks the pool and schedules the arrival and the warning', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await send(f, 0, f.planetIds[0]!, { DART: 15 });
    await landStaging(f);

    const result = await start(f);
    expect(result.participants).toBe(2);

    const combined = await f.db.select().from(clanWarMissions)
      .where(eq(clanWarMissions.leg, 'COMBINED_ATTACK'));
    expect(combined).toHaveLength(1);
    const [mission] = await f.db.select().from(missions)
      .where(eq(missions.id, combined[0]!.missionId));
    expect(mission!.fleet.DART).toBe(30);
    expect(mission!.originPlanetId).toBe(f.planetIds[0]);
    expect(mission!.targetPlanetId).toBe(f.planetIds[2]);
    // The coordinator carries the row; combat ownership never reads it.
    expect(mission!.ownerPlayerId).toBe(f.playerIds[0]);

    const op = await operationRow(f);
    expect(op.status).toBe('ATTACKING');
    expect(op.startedAt).not.toBeNull();
    const waves = await f.db.select().from(clanWarContributions);
    expect(waves.every((wave) => wave.status === 'IN_BATTLE')).toBe(true);

    const events = await f.db.select().from(scheduledEvents)
      .where(eq(scheduledEvents.refId, mission!.id));
    expect(events.map((row) => row.kind).sort()).toEqual(['mission_arrival', 'radar_warning']);
  });

  it('wakes a combined strike when Radar is installed after its warning chain ended', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await landStaging(f);
    const launched = await start(f);
    await f.db.delete(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'radar_warning'),
      eq(scheduledEvents.refId, launched.missionId),
    ));

    await wakeInboundRadarWarnings(f.db, f.planetIds[2]!, f.clock.now());

    const warnings = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'radar_warning'),
      eq(scheduledEvents.refId, launched.missionId),
    ));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ status: 'pending', resolveAt: f.clock.now() });
  });

  it('rechecks a combined strike warning when either Core changes', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await landStaging(f);
    const launched = await start(f);
    const future = new Date(f.clock.now().getTime() + 60_000);
    await f.db.update(scheduledEvents).set({ resolveAt: future }).where(and(
      eq(scheduledEvents.kind, 'radar_warning'),
      eq(scheduledEvents.refId, launched.missionId),
    ));

    await recheckRadarLegsForWorld(f.db, f.planetIds[2]!, f.clock.now());

    const [warning] = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'radar_warning'),
      eq(scheduledEvents.refId, launched.missionId),
    ));
    expect(warning!.resolveAt).toEqual(f.clock.now());
  });

  it('requires acknowledgement before a combined-strike target joins the attacking clan', async () => {
    const f = await setup();
    const clanId = await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await landStaging(f);
    const launched = await start(f);
    const candidate = await clanActor(f.db, f.accountIds[2]!);
    const application = await f.db.transaction((tx) => applyToClan(tx, {
      actor: candidate,
      clanId,
      now: f.clock.now(),
    }));
    const leader = await clanActor(f.db, f.accountIds[0]!);

    await expect(f.db.transaction((tx) => acceptClanRequest(tx, {
      actor: leader,
      requestId: application.requestId,
      acknowledgeHostile: false,
      now: f.clock.now(),
    }))).rejects.toMatchObject({ code: 'CLAN_HOSTILE_FLIGHT_ACK_REQUIRED' });
    await expect(f.db.transaction((tx) => acceptClanRequest(tx, {
      actor: leader,
      requestId: application.requestId,
      acknowledgeHostile: true,
      now: f.clock.now(),
    }))).resolves.toMatchObject({ hostileFlightsContinue: true });

    const [mission] = await f.db.select().from(missions)
      .where(eq(missions.id, launched.missionId));
    expect(mission?.status).toBe('in_flight');
    expect((await operationRow(f)).status).toBe('ATTACKING');
  });

  it('is the leader’s alone', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await landStaging(f);
    await expect(f.db.transaction(async (tx) => startClanWar(tx, {
      actor: await clanActor(tx, f.accountIds[1]!),
      acknowledgeShieldLoss: true,
      clock: f.clock,
    }))).rejects.toMatchObject({ code: 'CLAN_WAR_LEADER_ONLY' });
  });

  it('waits for support that is still in the air', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 0, f.planetIds[0]!, { DART: 15 });
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await expect(start(f)).rejects.toMatchObject({ code: 'CLAN_WAR_SUPPORT_INBOUND' });
  });

  it('does not wait for a wave whose owner has already recalled it', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 0, f.planetIds[0]!, { DART: 15 });
    const leaving = await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await f.db.transaction(async (tx) => recallClanWarContribution(tx, {
      actor: await clanActor(tx, f.accountIds[1]!),
      contributionId: leaving.contributionId,
      clock: f.clock,
    }));
    const result = await start(f);
    expect(result.participants).toBe(1);
  });

  it('refuses an empty pool and a pool of nothing but holds', async () => {
    const f = await setup();
    await readyOperation(f);
    await expect(start(f)).rejects.toMatchObject({ code: 'CLAN_WAR_NO_COMBAT_FLEET' });
    await send(f, 0, f.planetIds[0]!, { COURIER: 4 });
    await expect(start(f)).rejects.toMatchObject({ code: 'CLAN_WAR_NO_COMBAT_FLEET' });
    await send(f, 1, f.planetIds[1]!, { DART: 5 });
    await landStaging(f);
    await expect(start(f)).resolves.toBeDefined();
  });

  it('refuses a participant who has drifted out of the band since committing', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await landStaging(f);
    // The member outgrows the target while their wave waits in escrow.
    await setLevel(f.db, f.planetIds[1]!, 'CORE', 16);
    await setLevel(f.db, f.planetIds[2]!, 'CORE', 1);
    await expect(start(f)).rejects.toMatchObject({ code: 'CLAN_WAR_PARTICIPANT_INELIGIBLE' });
  });

  it('refuses a fleetless leader who has drifted out of the band since marking', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await landStaging(f);
    // The leader still spends quota and protection when they coordinate the
    // launch, so their eligibility must be rechecked even without a wave.
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 16);
    await setLevel(f.db, f.planetIds[1]!, 'CORE', 7);
    await setLevel(f.db, f.planetIds[2]!, 'CORE', 7);

    await expect(start(f)).rejects.toMatchObject({ code: 'CLAN_WAR_PARTICIPANT_INELIGIBLE' });
    expect((await operationRow(f)).status).toBe('ASSEMBLING');
  });

  it('refuses a target that gained a shield while the pool assembled', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await landStaging(f);
    await giveNewcomerShield(
      f.db,
      f.playerIds[2]!,
      new Date(f.clock.now().getTime() + 3_600_000),
    );
    await expect(start(f)).rejects.toMatchObject({ code: 'NEWCOMER_SHIELDED' });
    // The operation is refused, not cancelled.
    expect((await operationRow(f)).status).toBe('ASSEMBLING');
  });

  it.each([
    ['protectedUntil', 'OCCUPATION_PROTECTED'],
    ['recoveryUntil', 'WORLD_RECOVERING'],
  ] as const)('refuses a target whose %s began after the pool assembled', async (field, code) => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 0, f.planetIds[0]!, { DART: 15 });
    await f.db.update(planets)
      .set({ [field]: new Date(f.clock.now().getTime() + 3_600_000) })
      .where(eq(planets.id, f.planetIds[2]!));

    await expect(start(f)).rejects.toMatchObject({ code });
    expect((await operationRow(f)).status).toBe('ASSEMBLING');
    expect(await f.db.select().from(missions)
      .where(eq(missions.kind, 'clan_war'))).toHaveLength(0);
  });

  it('uses the actual destination Beacon for the exact season return boundary', async () => {
    const f = await setup();
    await readyOperation(f);
    await giveSatellite(f.db, f.planetIds[0]!, 'BEACON');
    const operation = await operationRow(f);
    f.clock.set(new Date(operation.expiresAt.getTime() - 1_000));
    const actor = await clanActor(f.db, f.accountIds[0]!);
    const quote = await quoteClanWarContribution(f.db, {
      actor,
      originPlanetId: f.planetIds[0]!,
      fleet: { DART: 15 },
      clock: f.clock,
    });
    const exactHomeAt = new Date(quote.travel.earliestHome!);
    await f.db.update(seasons).set({ endsAt: exactHomeAt })
      .where(eq(seasons.id, f.seasonId));
    await send(f, 0, f.planetIds[0]!, { DART: 15 });

    await expect(start(f)).resolves.toBeDefined();
  });

  it('refuses a target commander whose season no longer matches the operation', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 0, f.planetIds[0]!, { DART: 15 });
    const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
    await f.db.update(players).set({ seasonId: waiting!.id })
      .where(eq(players.id, f.playerIds[2]!));

    await expect(start(f)).rejects.toMatchObject({ code: 'CROSS_SEASON' });
    expect((await operationRow(f)).status).toBe('ASSEMBLING');
  });

  it('rechecks a ceasefire that began while the pool assembled', async () => {
    const f = await setup();
    const clanId = await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await landStaging(f);
    const memberId = f.playerIds[1]!;
    const targetId = f.playerIds[2]!;
    const playerLowId = memberId < targetId ? memberId : targetId;
    const playerHighId = memberId < targetId ? targetId : memberId;
    await f.db.insert(clanCeasefires).values({
      seasonId: f.seasonId,
      playerLowId,
      playerHighId,
      sourceClanId: clanId,
      startsAt: f.clock.now(),
      endsAt: new Date(f.clock.now().getTime() + 3_600_000),
    });

    await expect(start(f)).rejects.toMatchObject({ code: 'CLAN_CEASEFIRE' });
    expect((await operationRow(f)).status).toBe('ASSEMBLING');
    expect(await f.db.select().from(clanWarMissions)
      .where(eq(clanWarMissions.leg, 'COMBINED_ATTACK'))).toHaveLength(0);
  });

  it('refuses an expired target, and the pool is sent home', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await landStaging(f);
    f.clock.set(new Date(f.clock.now().getTime() + CLAN.warTargetMinutes * 60_000 + 1_000));
    await expect(start(f)).rejects.toMatchObject({ code: 'CLAN_WAR_EXPIRED' });
  });

  it('flies at the slowest ship in the pool, at every owner’s own pace', async () => {
    const f = await setup();
    await readyOperation(f);
    await giveUnits(f.db, f.planetIds[1]!, { ATLAS: 2 });
    await send(f, 0, f.planetIds[0]!, { DART: 10 });
    await send(f, 1, f.planetIds[1]!, { ATLAS: 2 });
    await landStaging(f);
    const result = await start(f);

    const [mission] = await f.db.select().from(missions)
      .where(eq(missions.id, result.missionId));
    const minutes = (mission!.arriveAt.getTime() - mission!.departAt.getTime()) / 60_000;
    const dartOnly = fleetSpeed({ DART: 10 }, {});
    const atlasOnly = fleetSpeed({ ATLAS: 2 }, {});
    expect(atlasOnly).toBeLessThan(dartOnly);
    // Long enough that the Atlas, not the Dart, set the pace.
    expect(minutes).toBeGreaterThan(0);
    expect(mission!.fleet.ATLAS).toBe(2);
  });
});

/* ── quota ──────────────────────────────────────────────────────── */

describe('what a combined strike costs in quota', () => {
  it('serializes an ordinary raid and joint start against the same personal quota', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await landStaging(f);
    for (let hit = 1; hit < ABUSE.bashLimit; hit += 1) {
      const [historical] = await f.db.insert(missions).values({
        fuelPaid: 0,
        seasonId: f.seasonId,
        kind: 'attack',
        status: 'resolved',
        ownerPlayerId: f.playerIds[1]!,
        originPlanetId: f.planetIds[1]!,
        targetPlanetId: f.planetIds[2]!,
        fleet: { DART: 1 },
        distance: 1,
        departAt: f.clock.now(),
        arriveAt: f.clock.now(),
      }).returning({ id: missions.id });
      await f.db.insert(attackCommitments).values({
        seasonId: f.seasonId,
        missionId: historical!.id,
        attackerPlayerId: f.playerIds[1]!,
        targetPlayerId: f.playerIds[2]!,
        launchedAt: f.clock.now(),
        expiresAt: new Date(f.clock.now().getTime() + 12 * 3_600_000),
      });
    }

    const outcomes = await raceBehindStagingLock(f, [
      () => start(f),
      () => launchAttack(
        f.db,
        f.planetIds[1]!,
        f.planetIds[2]!,
        { DART: 5 },
        f.clock,
        f.playerIds[1],
        true,
      ),
    ], f.planetIds[2]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);

    const memberHits = await f.db.select().from(attackCommitments)
      .where(eq(attackCommitments.attackerPlayerId, f.playerIds[1]!));
    expect(memberHits).toHaveLength(ABUSE.bashLimit);
    const combined = await f.db.select().from(clanWarMissions)
      .where(eq(clanWarMissions.leg, 'COMBINED_ATTACK'));
    if (combined.length === 1) {
      expect((await operationRow(f)).status).toBe('ATTACKING');
      expect(outcomes[0]!.status).toBe('fulfilled');
    } else {
      expect((await operationRow(f)).status).toBe('ASSEMBLING');
      expect(outcomes[1]!.status).toBe('fulfilled');
    }
  });

  it('spends one personal hit per commander and one clan attack in total', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 0, f.planetIds[0]!, { DART: 10 });
    await send(f, 1, f.planetIds[1]!, { DART: 10 });
    await send(f, 3, f.planetIds[3]!, { DART: 10 });
    await landStaging(f);
    const result = await start(f);

    const rows = await f.db.select().from(attackCommitments)
      .where(eq(attackCommitments.missionId, result.missionId));
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((row) => row.attackerPlayerId)).size).toBe(3);
    expect(rows.every((row) => row.quotaClanId !== null)).toBe(true);
    // One clan attack, not three.
    expect(new Set(rows.map((row) => row.missionId)).size).toBe(1);
    // And the ordinary ten-percent roster is not written at all.
    expect(await f.db.select().from(clanRaidRoster)).toHaveLength(0);
  });

  it('counts a commander with three waves exactly once', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 5 });
    await send(f, 1, f.planetIds[1]!, { DART: 5 });
    await send(f, 1, f.planetIds[1]!, { DART: 5 });
    await landStaging(f);
    const result = await start(f);
    expect(result.participants).toBe(1);
    const rows = await f.db.select().from(attackCommitments)
      .where(eq(attackCommitments.missionId, result.missionId));
    // The member who flew, plus the coordinating leader who did not.
    expect(rows).toHaveLength(2);
  });

  it('charges the fleetless leader a hit and their shield, and counts them once when they fly', async () => {
    const f = await setup();
    await readyOperation(f);
    await giveNewcomerShield(
      f.db,
      f.playerIds[0]!,
      new Date(f.clock.now().getTime() + 3_600_000),
    );
    await send(f, 1, f.planetIds[1]!, { DART: 10 });
    await landStaging(f);

    await expect(start(f, false)).rejects.toMatchObject({ code: 'SHIELD_WOULD_DROP' });
    const result = await start(f, true);
    expect(result.participants).toBe(1);
    const rows = await f.db.select().from(attackCommitments)
      .where(eq(attackCommitments.missionId, result.missionId));
    expect(rows.map((row) => row.attackerPlayerId).sort())
      .toEqual([f.playerIds[0], f.playerIds[1]].sort());
    const [leader] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
    expect(leader!.newcomerShieldUntil).toBeNull();
  });

  /**
   * A commander whose ships are already in the pool is ATTACKING, whatever happens
   * to them at home. Without this they could take a beating, collect a recovery
   * shield, and have their fleet arrive at the defender anyway — and the leader's
   * launch would then have to spend a shield its owner never offered.
   */
  it('lets nobody in the pool earn a shield while their hulls are committed', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 10 });
    const { forceRecoveryShield } = await import('../src/services/attackProtection.js');
    const granted = await f.db.transaction((tx) => forceRecoveryShield(tx, {
      playerId: f.playerIds[1]!,
      planetId: f.planetIds[1]!,
      now: f.clock.now(),
    }));
    expect(granted).toBeNull();
    const [member] = await f.db.select().from(players).where(eq(players.id, f.playerIds[1]!));
    expect(member!.recoveryShieldUntil).toBeNull();
  });

  it('refuses when a participant has already spent their bash quota', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 10 });
    await landStaging(f);
    for (let hit = 0; hit < ABUSE.bashLimit; hit++) {
      await f.db.insert(attackCommitments).values({
        seasonId: f.seasonId,
        missionId: (await f.db.insert(missions).values({
          fuelPaid: 0,
          seasonId: f.seasonId,
          kind: 'attack',
          ownerPlayerId: f.playerIds[1]!,
          originPlanetId: f.planetIds[1]!,
          targetPlanetId: f.planetIds[2]!,
          fleet: { DART: 1 },
          distance: 1,
          departAt: f.clock.now(),
          arriveAt: new Date(f.clock.now().getTime() + 60_000),
        }).returning({ id: missions.id }))[0]!.id,
        attackerPlayerId: f.playerIds[1]!,
        targetPlayerId: f.playerIds[2]!,
        launchedAt: f.clock.now(),
        expiresAt: new Date(f.clock.now().getTime() + 12 * 3_600_000),
      });
    }
    await expect(start(f)).rejects.toMatchObject({ code: 'BASH_LIMIT' });
  });

  it('leaves an ordinary raid’s quota behaviour exactly as it was', async () => {
    const f = await setup();
    await readyOperation(f);
    const result = await launchAttack(
      f.db, f.planetIds[1]!, f.planetIds[2]!, { DART: 5 }, f.clock, f.playerIds[1], true,
    );
    const rows = await f.db.select().from(attackCommitments)
      .where(eq(attackCommitments.missionId, result.missionId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.attackerPlayerId).toBe(f.playerIds[1]);
  });
});

/* ── the pool is locked once it flies ───────────────────────────── */

describe('once the strike is in the air', () => {
  it('replays the same HTTP idempotency key with one mission and one commitment set', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await landStaging(f);
    const { buildApp } = await import('../src/app.js');
    const { TokenService } = await import('../src/auth/tokens.js');
    const { testEnv } = await import('./helpers.js');
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    await built.app.ready();
    try {
      const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
      const headers = {
        authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}`,
        'idempotency-key': 'clan-war-start-0001',
      };
      const request = () => built.app.inject({
        method: 'POST',
        url: '/api/clan/war/start',
        headers,
        payload: { acknowledgeShieldLoss: true },
      });
      const [first, replay] = await Promise.all([request(), request()]);
      expect(first.statusCode).toBe(200);
      expect(replay.statusCode).toBe(200);
      expect(replay.json()).toEqual(first.json());

      const combined = await f.db.select().from(clanWarMissions)
        .where(eq(clanWarMissions.leg, 'COMBINED_ATTACK'));
      expect(combined).toHaveLength(1);
      const commitments = await f.db.select().from(attackCommitments)
        .where(eq(attackCommitments.missionId, combined[0]!.missionId));
      expect(commitments.map((row) => row.attackerPlayerId).sort())
        .toEqual([f.playerIds[0]!, f.playerIds[1]!].sort());
    } finally {
      await built.close();
    }
  });

  it('refuses a new wave, a recall and a cancel', async () => {
    const f = await setup();
    await readyOperation(f);
    const wave = await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await landStaging(f);
    await start(f);

    await expect(send(f, 3, f.planetIds[3]!, { DART: 5 }))
      .rejects.toMatchObject({ code: 'CLAN_WAR_NOT_ASSEMBLING' });
    await expect(f.db.transaction(async (tx) => recallClanWarContribution(tx, {
      actor: await clanActor(tx, f.accountIds[1]!),
      contributionId: wave.contributionId,
      clock: f.clock,
    }))).rejects.toMatchObject({ code: 'CLAN_WAR_POOL_LOCKED' });
    await expect(f.db.transaction(async (tx) => cancelClanWarOperation(tx, {
      actor: await clanActor(tx, f.accountIds[0]!),
      clock: f.clock,
    }))).rejects.toMatchObject({ code: 'CLAN_WAR_NOT_ASSEMBLING' });
  });

  it('lets only one of two simultaneous launches through', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await landStaging(f);
    const results = await Promise.allSettled([start(f), start(f)]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    const combined = await f.db.select().from(clanWarMissions)
      .where(eq(clanWarMissions.leg, 'COMBINED_ATTACK'));
    expect(combined).toHaveLength(1);
  });

  it('is left alone by the expiry timer it outran', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await landStaging(f);
    await start(f);

    // A day later the target would have expired — but the strike left in time,
    // and an operation in the air is no longer the timer's business.
    f.clock.set(new Date(f.clock.now().getTime() + CLAN.warTargetMinutes * 60_000 + 1_000));
    const before = await operationRow(f);
    const { resolveClanWarExpiry } = await import('../src/services/clanWar.js');
    await f.db.transaction((tx) => resolveClanWarExpiry(tx, before.id, f.clock.now()));

    const after = await operationRow(f);
    expect(after.status).toBe('ATTACKING');
    expect(after.closeReason).toBeNull();
    expect(after.startedAt?.getTime()).toBe(before.startedAt?.getTime());
  });

  it('serializes start against a simultaneously due expiry at the staging lock', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await landStaging(f);
    const operation = await operationRow(f);
    const outcomes = await raceBehindStagingLock(f, [
      () => start(f),
      () => f.db.transaction((tx) => resolveClanWarExpiry(tx, operation.id, operation.expiresAt)),
    ]);

    const after = await operationRow(f);
    const combined = await f.db.select().from(clanWarMissions)
      .where(eq(clanWarMissions.leg, 'COMBINED_ATTACK'));
    if (after.status === 'ATTACKING') {
      expect(outcomes[0]!.status).toBe('fulfilled');
      expect(combined).toHaveLength(1);
    } else {
      expect(after).toMatchObject({ status: 'RETURNING', closeReason: 'EXPIRED' });
      expect(outcomes[0]!.status).toBe('rejected');
      expect(combined).toHaveLength(0);
    }
  });

  it('serializes start against cancel without a partial launch', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await landStaging(f);
    const cancel = () => f.db.transaction(async (tx) => cancelClanWarOperation(tx, {
      actor: await clanActor(tx, f.accountIds[0]!),
      clock: f.clock,
    }));
    const outcomes = await raceBehindStagingLock(f, [() => start(f), cancel]);

    const after = await operationRow(f);
    const combined = await f.db.select().from(clanWarMissions)
      .where(eq(clanWarMissions.leg, 'COMBINED_ATTACK'));
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    if (after.status === 'ATTACKING') {
      expect(combined).toHaveLength(1);
      expect(await f.db.select().from(attackCommitments)
        .where(eq(attackCommitments.missionId, combined[0]!.missionId))).toHaveLength(2);
    } else {
      expect(after).toMatchObject({ status: 'RETURNING', closeReason: 'LEADER_CANCEL' });
      expect(combined).toHaveLength(0);
      expect(await f.db.select().from(attackCommitments)).toHaveLength(0);
    }
  });
});

/* ── when the strike lands ──────────────────────────────────────── */

/**
 * THE LEADER CHOOSES WHEN THE JOINT STRIKE LANDS. Review 2026-09-22, finding #2 · plan §15.5a.
 *
 * The pace rungs were offered on every personal launch and refused here by the strict body —
 * `Unrecognized key(s) in object: 'pace'` — so the one attack most about TIMING, five commanders
 * arriving together at the hour the target is least ready, was the one that could not choose it.
 * Only the combined leg is paced; survivors fly home at full speed, as on every other lane.
 */
describe('choosing when the joint strike lands', () => {
  const startAt = (f: Fixture, pace: number) =>
    f.db.transaction(async (tx) => startClanWar(tx, {
      actor: await clanActor(tx, f.accountIds[0]!),
      acknowledgeShieldLoss: true,
      pace,
      clock: f.clock,
    }));
  const strikeMinutes = async (f: Fixture) =>
    (await projectOperation(f.db, await operationRow(f), f.playerIds[0], f.clock.now()))
      .pool.strikeMinutes;

  it('publishes the full-speed strike once a wave is staged, and not before', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    expect(await strikeMinutes(f)).toBeNull();
    await landStaging(f);
    expect(await strikeMinutes(f)).toBeGreaterThan(0);
  });

  it('flies the combined leg at the chosen pace and records it', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await landStaging(f);
    const full = (await strikeMinutes(f))!;

    const result = await startAt(f, 0.5);
    const [mission] = await f.db.select().from(missions)
      .where(eq(missions.id, result.missionId));
    const minutes = (mission!.arriveAt.getTime() - mission!.departAt.getTime()) / 60_000;
    expect(minutes).toBeCloseTo(full / 0.5, 3);
    expect(mission!.pace).toBe(0.5);
  });

  it('refuses a speed that is not a rung, and launches nothing', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await landStaging(f);

    await expect(startAt(f, 0.37)).rejects.toMatchObject({ code: 'BAD_PACE' });
    expect((await operationRow(f)).status).toBe('ASSEMBLING');
    expect(await f.db.select().from(attackCommitments)).toHaveLength(0);
  });

  it('refuses a rung that would keep the strike up past the ceiling, and launches nothing', async () => {
    const f = await setup();
    await readyOperation(f);
    await f.db.update(planets).set({ x: sql`${planets.x} + 20000` })
      .where(eq(planets.id, f.planetIds[2]!));
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await landStaging(f);
    const full = (await strikeMinutes(f))!;
    expect(full).toBeLessThanOrEqual(TRAVEL.pacedFlightCapMinutes);
    expect(full / 0.1).toBeGreaterThan(TRAVEL.pacedFlightCapMinutes);

    await expect(startAt(f, 0.1)).rejects.toMatchObject({ code: 'PACE_TOO_SLOW' });
    expect((await operationRow(f)).status).toBe('ASSEMBLING');
    expect(await f.db.select().from(attackCommitments)).toHaveLength(0);
  });

  it('takes the pace over HTTP instead of rejecting the field', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await landStaging(f);
    const { buildApp } = await import('../src/app.js');
    const { TokenService } = await import('../src/auth/tokens.js');
    const { testEnv } = await import('./helpers.js');
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    await built.app.ready();
    try {
      const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
      const response = await built.app.inject({
        method: 'POST',
        url: '/api/clan/war/start',
        headers: {
          authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}`,
          'idempotency-key': 'clan-war-start-pace-0001',
        },
        payload: { acknowledgeShieldLoss: true, pace: 0.5 },
      });
      expect(response.statusCode).toBe(200);
      const [mission] = await f.db.select().from(missions)
        .where(eq(missions.id, (response.json<{ missionId: string }>()).missionId));
      expect(mission!.pace).toBe(0.5);
    } finally {
      await built.close();
    }
  });
});
