import { pino } from 'pino';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  HULLS,
  GALAXY,
  GALAXY_SPAN,
  MULTI_WORLD,
  SERVERS,
  SETTLEMENT_CLAIM_MINUTES,
  deuteriumStorageCap,
  crystalRate,
  recoveryMinutesFor,
  upgradeCost,
  DEATH_STAR,
  fleetValue,
  sensorSphere,
} from '@astera/rules';
import {
  battleReports,
  buildOrders,
  buildings,
  debrisFields,
  galaxyEvents,
  missions,
  neutralPlanetState,
  notifications,
  playerResearch,
  planets,
  players,
  satellites,
  seasons,
  sensorEpochs,
  strategicAssets,
  strategicImpacts,
  units,
} from '../src/db/schema.js';
import { createSeason } from '../src/services/season.js';
import { joinSeason } from '../src/services/player.js';
import { launchAttack } from '../src/services/mission.js';
import {
  buildDeathStar,
  endOccupation,
  endRecovery,
  launchDeathStar,
} from '../src/services/strategic.js';
import { launchSettlement, launchTransfer } from '../src/services/movement.js';
import { upgradeBuilding } from '../src/services/build.js';
import { reinforceNeutral } from '../src/services/neutral.js';
import { colonyStanding } from '../src/services/ownership.js';
import { refreshSensorEpoch } from '../src/services/sensorHistory.js';
import { listServers } from '../src/services/servers.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  FixedClock,
} from '../src/clock.js';
import {
  giveResearch,
  giveUnits,
  giveInstrument,
  giveSatellite,
  makeAccount,
  setLevel,
  testDb,
  truncateAll,
} from './helpers.js';

const silent = pino({ level: 'silent' });
const workerFor = (db: Awaited<ReturnType<typeof testDb>>['db'], clock: FixedClock) =>
  new EventWorker(db, clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);

async function setup() {
  const { db } = await testDb();
  await truncateAll(db);
  const clock = new FixedClock(new Date('2026-08-01T00:00:00.000Z'));
  const { season } = await createSeason(db, {
    shardCode: 'EU-MULTI',
    seed: 91273,
    startsAt: clock.now(),
    playerCap: SERVERS.capacity,
    rulesetVersion: MULTI_WORLD.rulesetVersion,
  });
  const account = await makeAccount(db, 'Strategist');
  const joined = await joinSeason(db, account.id, season.id, clock);
  const neutrals = await db
    .select({ world: planets, state: neutralPlanetState })
    .from(planets)
    .innerJoin(neutralPlanetState, eq(neutralPlanetState.planetId, planets.id));
  return { db, clock, season, joined, neutrals };
}

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('current multi-world ruleset', () => {
  beforeEach(async () => {
    const { db } = await testDb();
    await truncateAll(db);
  });

  it('creates the deterministic fixed 30/15/6 pool outside all capital slots', async () => {
    const f = await setup();
    // The current ruleset, which stopped being the Fleet V2 boundary at D156.
    expect(f.season.rulesetVersion).toBe(MULTI_WORLD.rulesetVersion);
    expect(f.neutrals).toHaveLength(51);
    expect(f.neutrals.filter((row) => row.state.tier === 1)).toHaveLength(30);
    expect(f.neutrals.filter((row) => row.state.tier === 2)).toHaveLength(15);
    expect(f.neutrals.filter((row) => row.state.tier === 3)).toHaveLength(6);
    expect(f.neutrals.every((row) => row.world.slotIndex >= SERVERS.capacity)).toBe(true);
    expect(f.neutrals.every((row) => row.world.controllerPlayerId === null)).toBe(true);
    expect(f.neutrals.every((row) => row.world.alloy > 0 && row.world.crystal > 0)).toBe(true);
    expect(f.neutrals.every((row) => row.world.deuterium > 0)).toBe(true);
    expect(await listServers(f.db, f.clock)).toContainEqual(expect.objectContaining({
      code: 'EU-MULTI',
      planets: 1,
      capacity: SERVERS.capacity,
    }));
    for (const row of f.neutrals) {
      const template = MULTI_WORLD.neutral[row.state.tier as 1 | 2 | 3];
      const expected = deuteriumStorageCap(0, crystalRate(template.buildings.EXTRACTOR), template.buildings.VAULT);
      expect(row.world.deuterium).toBe(expected);
    }
  });

  it('spends reinforcement stock in strict infrastructure then proportional-garrison order', async () => {
    const f = await setup();
    const target = f.neutrals.find((row) => row.state.tier === 2)!;
    const blockedAlloy = HULLS.DART.alloy;
    expect(upgradeCost(4).alloy).toBeGreaterThan(blockedAlloy);
    await setLevel(f.db, target.world.id, 'CORE', 4);
    await f.db.delete(units).where(eq(units.planetId, target.world.id));
    await f.db.update(planets).set({
      alloy: blockedAlloy,
      crystal: 100_000,
      deuterium: 100_000,
      lastTickAt: f.clock.now(),
    }).where(eq(planets.id, target.world.id));

    await f.db.transaction((tx) => reinforceNeutral(tx, target.world.id, f.clock.now()));
    expect(await f.db.select().from(units).where(eq(units.planetId, target.world.id))).toEqual([]);
    const [blocked] = await f.db.select().from(planets).where(eq(planets.id, target.world.id));
    expect(blocked?.alloy).toBe(blockedAlloy);

    await setLevel(f.db, target.world.id, 'CORE', 5);
    await f.db.insert(units).values({
      planetId: target.world.id,
      ownerPlayerId: null,
      hull: 'DART',
      location: 'home',
      count: 7,
    });
    await f.db.update(planets).set({
      alloy: HULLS.PIKE.alloy,
      crystal: HULLS.PIKE.crystal,
      deuterium: HULLS.PIKE.deuterium,
      lastTickAt: f.clock.now(),
    }).where(eq(planets.id, target.world.id));
    await f.db.transaction((tx) => reinforceNeutral(tx, target.world.id, f.clock.now()));
    const garrison = await f.db.select().from(units).where(eq(units.planetId, target.world.id));
    expect(garrison.map((row) => [row.hull, row.count]).sort()).toEqual([
      ['DART', 7],
      ['PIKE', 1],
    ]);
  });

  it('resolves an empty T1 as decisive, opens one public claim and writes no Dominion', async () => {
    const f = await setup();
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    await f.db.update(planets).set({ x: 150, y: 0, z: 0 }).where(eq(planets.id, target.world.id));
    await f.db.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, f.joined.planetId));
    await setLevel(f.db, f.joined.planetId, 'CORE', 3);
    await giveUnits(f.db, f.joined.planetId, { DART: 1 });

    const launched = await launchAttack(f.db, f.joined.planetId, target.world.id, { DART: 1 }, f.clock);
    f.clock.set(new Date(launched.arriveAt.getTime() + 11_000));
    await workerFor(f.db, f.clock).tick();

    const [state] = await f.db.select().from(neutralPlanetState).where(eq(neutralPlanetState.planetId, target.world.id));
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.targetPlanetId, target.world.id));
    const [player] = await f.db.select().from(players).where(eq(players.id, f.joined.playerId));
    expect(state?.claimUntil?.getTime()).toBe(f.clock.now().getTime() + SETTLEMENT_CLAIM_MINUTES * 60_000);
    expect(report).toMatchObject({
      grade: 'DECISIVE',
      defenderPlayerId: null,
      targetKind: 'NEUTRAL',
      cargoLimited: true,
    });
    expect(player?.dominionTaken).toBe(0);
    expect(player?.dominionLost).toBe(0);
  });

  /**
   * D112. Both halves of one guard, on one world, in order: a raid landing while
   * the window is OPEN must not push its end back, and a raid landing after it has
   * CLOSED must open a fresh one. The second half is what the old
   * `claim_until IS NULL` guard could not do, which retired a neutral world for
   * the season the first time nobody's Haulers made it.
   */
  it('never extends a live claim, and reopens one that has closed', async () => {
    const f = await setup();
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    await f.db.update(planets).set({ x: 150, y: 0, z: 0 }).where(eq(planets.id, target.world.id));
    await f.db.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, f.joined.planetId));
    await setLevel(f.db, f.joined.planetId, 'CORE', 3);

    /** One whole raid: out, decisive, and home again, so the next one may launch. */
    const raid = async () => {
      await giveUnits(f.db, f.joined.planetId, { DART: 1 });
      const away = await launchAttack(f.db, f.joined.planetId, target.world.id, { DART: 1 }, f.clock);
      f.clock.set(new Date(away.arriveAt.getTime() + 11_000));
      await workerFor(f.db, f.clock).tick();
      const [state] = await f.db.select().from(neutralPlanetState)
        .where(eq(neutralPlanetState.planetId, target.world.id));
      const settled = { claimUntil: state?.claimUntil ?? null, at: f.clock.now() };
      const [home] = await f.db.select().from(missions).where(and(
        eq(missions.ownerPlayerId, f.joined.playerId),
        eq(missions.kind, 'return'),
        eq(missions.status, 'in_flight'),
      ));
      if (home) {
        f.clock.set(home.arriveAt);
        await workerFor(f.db, f.clock).tick();
      }
      return settled;
    };

    const first = await raid();
    expect(first.claimUntil?.getTime())
      .toBe(first.at.getTime() + SETTLEMENT_CLAIM_MINUTES * 60_000);

    // Still inside the window: a second decisive raid leaves the deadline alone.
    const second = await raid();
    expect(second.at.getTime()).toBeLessThan(first.claimUntil!.getTime());
    expect(second.claimUntil?.getTime()).toBe(first.claimUntil?.getTime());

    // Past it: the world is worth taking again.
    f.clock.set(new Date(first.claimUntil!.getTime() + 60_000));
    const third = await raid();
    expect(third.claimUntil?.getTime())
      .toBe(third.at.getTime() + SETTLEMENT_CLAIM_MINUTES * 60_000);
    expect(third.claimUntil!.getTime()).toBeGreaterThan(first.claimUntil!.getTime());
  });

  it('settles atomically, preserves the neutral world and starts occupation protection', async () => {
    const f = await setup();
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    await f.db.update(planets).set({ x: 40, y: 0, z: 0 }).where(eq(planets.id, target.world.id));
    await f.db.update(planets).set({ x: 0, y: 0, z: 0, alloy: 10_000, crystal: 5_000 })
      .where(eq(planets.id, f.joined.planetId));
    await setLevel(f.db, f.joined.planetId, 'CORE', 3);
    await giveUnits(f.db, f.joined.planetId, {
      COURIER: MULTI_WORLD.settlement.transports,
    });
    await f.db.update(neutralPlanetState)
      .set({ claimUntil: new Date(f.clock.now().getTime() + 30 * 60_000) })
      .where(eq(neutralPlanetState.planetId, target.world.id));

    const launched = await launchSettlement(
      f.db,
      f.joined.playerId,
      f.joined.planetId,
      target.world.id,
      f.clock,
    );
    f.clock.set(launched.arriveAt);
    await workerFor(f.db, f.clock).tick();

    const [captured] = await f.db.select().from(planets).where(eq(planets.id, target.world.id));
    const state = await f.db.select().from(neutralPlanetState).where(eq(neutralPlanetState.planetId, target.world.id));
    const [hauler] = await f.db.select().from(units).where(and(
      eq(units.planetId, target.world.id),
      eq(units.hull, 'COURIER'),
      eq(units.location, 'home'),
    ));
    expect(captured).toMatchObject({ kind: 'COLONY', controllerPlayerId: f.joined.playerId });
    expect(captured?.protectedUntil?.getTime()).toBe(f.clock.now().getTime() + 6 * 60 * 60_000);
    expect(state).toHaveLength(0);
    expect(hauler).toMatchObject({
      ownerPlayerId: f.joined.playerId,
      count: MULTI_WORLD.settlement.transports,
    });
  });

  it('serializes two settlement arrivals so one captures and the loser returns intact', async () => {
    const f = await setup();
    const rivalAccount = await makeAccount(f.db, 'Rival Settler');
    const rival = await joinSeason(f.db, rivalAccount.id, f.season.id, f.clock);
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    const claimUntil = new Date(f.clock.now().getTime() + 30 * 60_000);
    await f.db.update(planets).set({ x: 20, y: 0, z: 0 }).where(eq(planets.id, target.world.id));
    await f.db.update(planets).set({ x: 0, y: 0, z: 0, alloy: 10_000, crystal: 5_000 })
      .where(inArray(planets.id, [f.joined.planetId, rival.planetId]));
    await f.db.update(neutralPlanetState).set({ claimUntil })
      .where(eq(neutralPlanetState.planetId, target.world.id));
    for (const capital of [f.joined.planetId, rival.planetId]) {
      await setLevel(f.db, capital, 'CORE', 3);
      await giveUnits(f.db, capital, {
        COURIER: MULTI_WORLD.settlement.transports,
      });
    }

    const [left, right] = await Promise.all([
      launchSettlement(f.db, f.joined.playerId, f.joined.planetId, target.world.id, f.clock),
      launchSettlement(f.db, rival.playerId, rival.planetId, target.world.id, f.clock),
    ]);
    expect(left.arriveAt.getTime()).toBe(right.arriveAt.getTime());
    f.clock.set(left.arriveAt);
    await workerFor(f.db, f.clock).tick();

    const [captured] = await f.db.select().from(planets).where(eq(planets.id, target.world.id));
    expect([f.joined.playerId, rival.playerId]).toContain(captured?.controllerPlayerId);
    const loser = captured?.controllerPlayerId === f.joined.playerId ? rival : f.joined;
    const loserReturn = await f.db.select().from(missions).where(and(
      eq(missions.ownerPlayerId, loser.playerId),
      eq(missions.kind, 'transfer'),
      eq(missions.status, 'in_flight'),
    ));
    expect(loserReturn).toHaveLength(1);
    f.clock.set(loserReturn[0]!.arriveAt);
    await workerFor(f.db, f.clock).tick();
    const [hauler] = await f.db.select().from(units).where(and(
      eq(units.ownerPlayerId, loser.playerId),
      eq(units.hull, 'COURIER'),
      eq(units.location, 'home'),
    ));
    expect(hauler).toMatchObject({
      planetId: loser.planetId,
      count: MULTI_WORLD.settlement.transports,
    });
    const loserNotices = await f.db.select().from(notifications).where(and(
      eq(notifications.playerId, loser.playerId),
      eq(notifications.kind, 'settlement_lost'),
    ));
    expect(loserNotices).toHaveLength(1);
  });

  it('treats the claim end as a strict boundary', async () => {
    const f = await setup();
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    await setLevel(f.db, f.joined.planetId, 'CORE', 3);
    await giveUnits(f.db, f.joined.planetId, { COURIER: 1 });
    await f.db.update(planets).set({ alloy: 10_000, crystal: 5_000 })
      .where(eq(planets.id, f.joined.planetId));
    await f.db.update(neutralPlanetState).set({ claimUntil: f.clock.now() })
      .where(eq(neutralPlanetState.planetId, target.world.id));
    await expect(launchSettlement(
      f.db,
      f.joined.playerId,
      f.joined.planetId,
      target.world.id,
      f.clock,
    )).rejects.toMatchObject({ code: 'CLAIM_EXPIRED' });
  });

  /**
   * D111. Every other settlement test above puts its two worlds 20 to 150 units
   * apart, which is why a window that could not cross the galaxy passed all of them
   * for a release. This one uses ANTIPODES of the sphere — the longest
   * settlement flight the map can produce — and it is the case the shipped
   * thirty-minute window refused.
   */
  it('lets a settlement cross the whole sphere inside one claim window', async () => {
    const f = await setup();
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    await f.db.update(planets)
      .set({ x: -GALAXY.radius, y: 0, z: 0 })
      .where(eq(planets.id, f.joined.planetId));
    await f.db.update(planets)
      .set({ x: GALAXY.radius, y: 0, z: 0 })
      .where(eq(planets.id, target.world.id));
    await setLevel(f.db, f.joined.planetId, 'CORE', 3);
    await giveUnits(f.db, f.joined.planetId, { COURIER: MULTI_WORLD.settlement.transports });
    await f.db.update(planets).set({ alloy: 10_000, crystal: 5_000 })
      .where(eq(planets.id, f.joined.planetId));
    await f.db.update(neutralPlanetState)
      .set({ claimUntil: new Date(f.clock.now().getTime() + SETTLEMENT_CLAIM_MINUTES * 60_000) })
      .where(eq(neutralPlanetState.planetId, target.world.id));

    const launched = await launchSettlement(
      f.db,
      f.joined.playerId,
      f.joined.planetId,
      target.world.id,
      f.clock,
    );
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    expect(mission?.distance).toBeCloseTo(GALAXY_SPAN, 2);

    f.clock.set(launched.arriveAt);
    await workerFor(f.db, f.clock).tick();
    const [captured] = await f.db.select().from(planets).where(eq(planets.id, target.world.id));
    expect(captured).toMatchObject({ kind: 'COLONY', controllerPlayerId: f.joined.playerId });
  });

  it('keeps a loaded transfer one-way and delivers above storage cap without loss', async () => {
    const f = await setup();
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    await f.db.update(planets).set({
      kind: 'COLONY',
      controllerPlayerId: f.joined.playerId,
      x: 20,
      y: 0,
      z: 0,
    }).where(eq(planets.id, target.world.id));
    await f.db.delete(neutralPlanetState).where(eq(neutralPlanetState.planetId, target.world.id));
    await f.db.update(planets).set({ x: 0, y: 0, z: 0, alloy: 20_000, crystal: 10_000 })
      .where(eq(planets.id, f.joined.planetId));
    await setLevel(f.db, f.joined.planetId, 'CORE', 3);
    await giveUnits(f.db, f.joined.planetId, { COURIER: 1 });
    const before = target.world.alloy;
    const launched = await launchTransfer(
      f.db,
      f.joined.playerId,
      f.joined.planetId,
      target.world.id,
      { COURIER: 1 },
      { alloy: 500, crystal: 100, deuterium: 0 },
      f.clock,
    );
    f.clock.set(launched.arriveAt);
    await workerFor(f.db, f.clock).tick();
    const [delivered] = await f.db.select().from(planets).where(eq(planets.id, target.world.id));
    expect(delivered?.alloy).toBe(before + 500);
    expect(delivered?.crystal).toBe(target.world.crystal + 100);
    const [landedFleet] = await f.db.select().from(units).where(and(
      eq(units.planetId, target.world.id),
      eq(units.hull, 'COURIER'),
      eq(units.location, 'home'),
    ));
    expect(landedFleet).toMatchObject({ ownerPlayerId: f.joined.playerId, count: 1 });
    expect(await f.db.select().from(missions).where(eq(missions.status, 'in_flight'))).toHaveLength(0);
    expect(await f.db.select().from(notifications).where(eq(notifications.refId, launched.missionId)))
      .toHaveLength(0);
  });

  it('rejects ground transfers and cargo that dedicated transports cannot carry', async () => {
    const f = await setup();
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    await f.db.update(planets).set({
      kind: 'COLONY',
      controllerPlayerId: f.joined.playerId,
    }).where(eq(planets.id, target.world.id));
    await f.db.delete(neutralPlanetState).where(eq(neutralPlanetState.planetId, target.world.id));
    await giveUnits(f.db, f.joined.planetId, { THORN: 1, DART: 1, COURIER: 1 });

    await expect(launchTransfer(
      f.db,
      f.joined.playerId,
      f.joined.planetId,
      target.world.id,
      { THORN: 1 },
      { alloy: 0, crystal: 0, deuterium: 0 },
      f.clock,
    )).rejects.toMatchObject({ code: 'GROUND_UNIT' });
    await expect(launchTransfer(
      f.db,
      f.joined.playerId,
      f.joined.planetId,
      target.world.id,
      { DART: 1 },
      { alloy: 1, crystal: 0, deuterium: 0 },
      f.clock,
    )).rejects.toMatchObject({ code: 'CARGO_CAPACITY' });
    await expect(launchTransfer(
      f.db,
      f.joined.playerId,
      f.joined.planetId,
      target.world.id,
      { COURIER: 1 },
      { alloy: HULLS.COURIER.cargo + 1, crystal: 0, deuterium: 0 },
      f.clock,
    )).rejects.toMatchObject({ code: 'CARGO_CAPACITY' });
  });

  it('reroutes a transfer whose target changed and leaves no duplicate away stack', async () => {
    const f = await setup();
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    await f.db.update(planets).set({
      kind: 'COLONY',
      controllerPlayerId: f.joined.playerId,
      x: 20,
      y: 0,
      z: 0,
    }).where(eq(planets.id, target.world.id));
    await f.db.delete(neutralPlanetState).where(eq(neutralPlanetState.planetId, target.world.id));
    await f.db.update(planets).set({ x: 0, y: 0, z: 0, alloy: 20_000, crystal: 10_000 })
      .where(eq(planets.id, f.joined.planetId));
    await setLevel(f.db, f.joined.planetId, 'CORE', 3);
    await giveUnits(f.db, f.joined.planetId, { COURIER: 1 });
    const before = await f.db.select().from(planets).where(eq(planets.id, f.joined.planetId));
    const launched = await launchTransfer(
      f.db,
      f.joined.playerId,
      f.joined.planetId,
      target.world.id,
      { COURIER: 1 },
      { alloy: 500, crystal: 100, deuterium: 0 },
      f.clock,
    );
    await f.db.update(planets).set({ controllerPlayerId: null, kind: 'NEUTRAL' })
      .where(eq(planets.id, target.world.id));
    f.clock.set(launched.arriveAt);
    await workerFor(f.db, f.clock).tick();
    const [rerouted] = await f.db.select().from(missions).where(and(
      eq(missions.kind, 'transfer'),
      eq(missions.status, 'in_flight'),
    ));
    expect(rerouted?.parentMissionId).toBe(launched.missionId);
    const [notice] = await f.db.select().from(notifications)
      .where(eq(notifications.refId, launched.missionId));
    expect(notice).toMatchObject({
      playerId: f.joined.playerId,
      kind: 'fleet_returned',
      payload: {
        trip: 'transfer_rerouted',
        reason: 'OWNERSHIP',
        targetPlanetId: target.world.id,
      },
    });
    f.clock.set(rerouted!.arriveAt);
    await workerFor(f.db, f.clock).tick();

    const stacks = await f.db.select().from(units).where(eq(units.ownerPlayerId, f.joined.playerId));
    expect(stacks).toHaveLength(1);
    expect(stacks[0]).toMatchObject({
      planetId: f.joined.planetId,
      hull: 'COURIER',
      location: 'home',
      count: 1,
    });
    const [after] = await f.db.select().from(planets).where(eq(planets.id, f.joined.planetId));
    expect(after?.alloy).toBe(before[0]!.alloy);
    expect(after?.crystal).toBe(before[0]!.crystal);
  });

  it('reserves colony capacity at launch and honours an in-flight claim after Core falls', async () => {
    const f = await setup();
    const [first, second] = f.neutrals.filter((row) => row.state.tier === 1);
    await setLevel(f.db, f.joined.planetId, 'CORE', 3);
    await f.db.update(planets).set({ x: 0, y: 0, z: 0, alloy: 20_000, crystal: 10_000 })
      .where(eq(planets.id, f.joined.planetId));
    await f.db.update(planets).set({ x: 20, y: 0, z: 0 }).where(eq(planets.id, first!.world.id));
    await f.db.update(planets).set({ x: 25, y: 0, z: 0 }).where(eq(planets.id, second!.world.id));
    await f.db.update(neutralPlanetState).set({
      claimUntil: new Date(f.clock.now().getTime() + 30 * 60_000),
    }).where(inArray(neutralPlanetState.planetId, [first!.world.id, second!.world.id]));
    await giveUnits(f.db, f.joined.planetId, { COURIER: 2 });

    const launched = await launchSettlement(
      f.db,
      f.joined.playerId,
      f.joined.planetId,
      first!.world.id,
      f.clock,
    );
    await expect(launchSettlement(
      f.db,
      f.joined.playerId,
      f.joined.planetId,
      second!.world.id,
      f.clock,
    )).rejects.toMatchObject({ code: 'COLONY_CAP' });

    await setLevel(f.db, f.joined.planetId, 'CORE', 2);
    f.clock.set(launched.arriveAt);
    await workerFor(f.db, f.clock).tick();
    const [captured] = await f.db.select().from(planets).where(eq(planets.id, first!.world.id));
    expect(captured).toMatchObject({ kind: 'COLONY', controllerPlayerId: f.joined.playerId });
    await expect(launchSettlement(
      f.db,
      f.joined.playerId,
      f.joined.planetId,
      second!.world.id,
      f.clock,
    )).rejects.toMatchObject({ code: 'COLONY_CAP' });
  });

  it('applies the exact first-strike damage matrix and pauses then resumes production', async () => {
    const f = await setup();
    const defenderAccount = await makeAccount(f.db, 'Defender');
    const defender = await joinSeason(f.db, defenderAccount.id, f.season.id, f.clock);
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    await f.db.update(planets).set({
      kind: 'COLONY',
      controllerPlayerId: defender.playerId,
      x: 20,
      y: 0,
      z: 0,
      alloy: 9_000,
      crystal: 8_000,
      deuterium: 700,
      bufferAlloy: 600,
      bufferCrystal: 500,
      bufferDeuterium: 40,
      shield: 1234,
      disruptedUntil: new Date(f.clock.now().getTime() + 20 * 60_000),
    }).where(eq(planets.id, target.world.id));
    await f.db.delete(neutralPlanetState).where(eq(neutralPlanetState.planetId, target.world.id));
    // Levels chosen to separate the two building rules: CORE and REFINERY sit on
    // the ceiling, EXTRACTOR and VAULT one under it, SHIPYARD well under.
    await setLevel(f.db, target.world.id, 'CORE', 6);
    await setLevel(f.db, target.world.id, 'REFINERY', 6);
    await setLevel(f.db, target.world.id, 'EXTRACTOR', 5);
    await setLevel(f.db, target.world.id, 'VAULT', 5);
    await setLevel(f.db, target.world.id, 'SHIPYARD', 3);
    await giveInstrument(f.db, target.world.id, 'AEGIS', 4);
    await giveInstrument(f.db, target.world.id, 'TELESCOPE', 3);
    await giveInstrument(f.db, target.world.id, 'RADAR', 2);
    await giveSatellite(f.db, target.world.id, 'UPLINK');
    await giveUnits(f.db, target.world.id, {
      DART: 2,
      PIKE: 2,
      RAMPART: 1,
      COURIER: 1,
      WAYFARER: 1,
      NULLIFIER: 1,
      THORN: 2,
      BASTION: 1,
      PROSPECTOR: 1,
    });
    await giveUnits(f.db, target.world.id, { DART: 1, PROSPECTOR: 1 }, 'mining-away');
    const targetReadyAt = new Date(f.clock.now().getTime() + 30 * 60_000);
    await f.db.insert(strategicAssets).values({
      planetId: target.world.id,
      status: 'BUILDING',
      startedAt: f.clock.now(),
      readyAt: targetReadyAt,
      remainingSeconds: 30 * 60,
    });

    await f.db.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, f.joined.planetId));
    await setLevel(f.db, f.joined.planetId, 'CORE', 6);
    await f.db.insert(strategicAssets).values({
      planetId: f.joined.planetId,
      status: 'READY',
      startedAt: f.clock.now(),
      readyAt: null,
      remainingSeconds: 0,
    });
    const launch = await launchDeathStar(f.db, f.joined.planetId, target.world.id, f.clock);
    f.clock.set(launch.arriveAt);
    await workerFor(f.db, f.clock).tick();

    const [struck] = await f.db.select().from(planets).where(eq(planets.id, target.world.id));
    // HALF, NOT ALL (D113). The world was recovering-free and untouched since the
    // fixture set it, so the stored figures are already current.
    expect(struck).toMatchObject({
      alloy: 4_500,
      crystal: 4_000,
      deuterium: 350,
      bufferAlloy: 300,
      bufferCrystal: 250,
      bufferDeuterium: 20,
      shield: 0,
      disruptedUntil: null,
    });
    // The window is the WORLD'S, and this one was made a colony above — eight hours
    // since D167, against a capital's two.
    expect(struck?.recoveryUntil?.getTime())
      .toBe(f.clock.now().getTime() + recoveryMinutesFor('COLONY') * 60_000);
    const levels = Object.fromEntries((await f.db.select().from(buildings)
      .where(eq(buildings.planetId, target.world.id))).map((row) => [row.type, row.level]));
    // CORE drops. REFINERY was ON the old ceiling so the new Core pulls it down;
    // EXTRACTOR and VAULT are already at the new ceiling and SHIPYARD is nowhere
    // near it, so none of the three loses anything.
    expect(levels).toMatchObject({ CORE: 5, REFINERY: 5, EXTRACTOR: 5, VAULT: 5, SHIPYARD: 3 });
    const hardware = Object.fromEntries((await f.db.select().from(satellites)
      .where(eq(satellites.planetId, target.world.id))).map((row) => [row.type, row.level]));
    // Aegis alone, and by two. Every other instrument keeps its stored level and
    // is only ever capped by the Core it hangs off (D97).
    expect(hardware).toMatchObject({
      AEGIS: 4 - DEATH_STAR.aegisLevelsLost,
      TELESCOPE: 3,
      RADAR: 2,
      UPLINK: 1,
    });
    const survivors = await f.db.select().from(units).where(eq(units.planetId, target.world.id));
    expect(survivors.map((row) => [row.hull, row.location, row.count]).sort()).toEqual([
      ['DART', 'mining-away', 1],
      ['PROSPECTOR', 'mining-away', 1],
    ]);
    expect(await f.db.select().from(battleReports)
      .where(eq(battleReports.targetPlanetId, target.world.id))).toEqual([]);
    expect(await f.db.select().from(debrisFields)
      .where(eq(debrisFields.planetId, target.world.id))).toEqual([]);
    const [paused] = await f.db.select().from(strategicAssets)
      .where(eq(strategicAssets.planetId, target.world.id));
    expect(paused?.status).toBe('PAUSED');
    expect(paused?.remainingSeconds).toBeGreaterThan(28 * 60);
    expect(paused?.remainingSeconds).toBeLessThanOrEqual(30 * 60);

    f.clock.set(struck!.recoveryUntil!);
    await workerFor(f.db, f.clock).tick();
    const [resumed] = await f.db.select().from(strategicAssets)
      .where(eq(strategicAssets.planetId, target.world.id));
    expect(resumed?.status).toBe('BUILDING');
    expect(resumed?.readyAt?.getTime()).toBe(
      f.clock.now().getTime() + resumed!.remainingSeconds! * 1000,
    );
    const [defenderScore] = await f.db.select().from(players).where(eq(players.id, defender.playerId));
    expect(defenderScore).toMatchObject({ dominionTaken: 0, dominionLost: 0 });
    /*
      SCOPED PAST THE GALAXY'S OWN NEWS. The claim is that the defender is told
      about the strike ONCE — not that nothing else happens to them for the length
      of the window. D166 put four merchants a day in the sky and D167 made a
      colony's window eight hours, so a lifecycle notice or two now lands inside it.
    */
    const told = await f.db.select().from(notifications)
      .where(eq(notifications.playerId, defender.playerId));
    expect(told.filter((row) => !row.kind.startsWith('galaxy_event_'))).toHaveLength(1);
  });

  /**
   * TWO HITS NO LONGER TAKE A WORLD. D167 retired D105/D113's second-strike
   * capture: a rocket darkens a world and restarts its deadline, and that is all
   * it ever does. A neutral has no commander to answer the deadline and no control
   * to lose, so repeated strikes simply keep it dark.
   *
   * This replaces two tests — "uses two strategic hits to capture a neutral" and
   * "awards recovery capture to the second attacker" — whose whole subject was the
   * route that is gone. What they also guarded, and what is kept here, is that a
   * paused strategic build on the struck world resumes when the window closes.
   */
  it('leaves a neutral neutral however many rockets land on it', async () => {
    const f = await setup();
    const capital = f.joined.planetId;
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    await f.db.update(planets).set({
      x: 0,
      y: 0,
      z: 0,
      alloy: DEATH_STAR.cost.alloy * 3,
      crystal: DEATH_STAR.cost.crystal * 3,
      deuterium: DEATH_STAR.cost.deuterium * 3,
    }).where(eq(planets.id, capital));
    await f.db.update(planets).set({ x: 20, y: 0, z: 0 }).where(eq(planets.id, target.world.id));
    await setLevel(f.db, capital, 'CORE', DEATH_STAR.requiredCore);
    await setLevel(f.db, capital, 'SHIPYARD', DEATH_STAR.requiredShipyard);
    await giveResearch(f.db, capital, 'GRAVITIC_CHARGES');
    await giveResearch(f.db, capital, 'DEATH_STAR_PROTOCOL');
    const worker = workerFor(f.db, f.clock);

    for (let round = 0; round < 2; round += 1) {
      const built = await buildDeathStar(f.db, capital, f.clock);
      f.clock.set(built.readyAt);
      await worker.tick();
      const flight = await launchDeathStar(f.db, capital, target.world.id, f.clock);
      f.clock.set(flight.arriveAt);
      await worker.tick();

      const [struck] = await f.db.select().from(planets).where(eq(planets.id, target.world.id));
      expect(struck).toMatchObject({ kind: 'NEUTRAL', controllerPlayerId: null });
      // A world nobody holds takes the short window: there is no commander to
      // answer a deadline and nothing to be released from.
      expect(struck?.recoveryUntil?.getTime())
        .toBe(flight.arriveAt.getTime() + recoveryMinutesFor('NEUTRAL') * 60_000);
    }

    // The neutral state row survives every strike — the world was never taken.
    const [state] = await f.db.select().from(neutralPlanetState)
      .where(eq(neutralPlanetState.planetId, target.world.id));
    expect(state).toBeDefined();
  });

  it('serializes Death Star construction and never charges a rejected duplicate', async () => {
    const f = await setup();
    const capital = f.joined.planetId;
    const purse = { alloy: 100_000, crystal: 50_000, deuterium: 10_000 };
    await f.db.update(planets).set(purse).where(eq(planets.id, capital));
    await setLevel(f.db, capital, 'CORE', DEATH_STAR.requiredCore);
    await setLevel(f.db, capital, 'SHIPYARD', DEATH_STAR.requiredShipyard);
    await giveResearch(f.db, capital, 'DEATH_STAR_PROTOCOL');

    const results = await Promise.allSettled([
      buildDeathStar(f.db, capital, f.clock),
      buildDeathStar(f.db, capital, f.clock),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toMatchObject({ reason: { code: 'DEATH_STAR_EXISTS' } });
    expect(await f.db.select().from(strategicAssets)
      .where(eq(strategicAssets.planetId, capital))).toHaveLength(1);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, capital));
    expect(world).toMatchObject({
      alloy: purse.alloy - DEATH_STAR.cost.alloy,
      crystal: purse.crystal - DEATH_STAR.cost.crystal,
      deuterium: purse.deuterium - DEATH_STAR.cost.deuterium,
    });
  });

  it('does not sell a Death Star that cannot finish before the season freezes', async () => {
    const f = await setup();
    const capital = f.joined.planetId;
    const purse = { alloy: 100_000, crystal: 50_000, deuterium: 10_000 };
    await f.db.update(planets).set(purse).where(eq(planets.id, capital));
    await setLevel(f.db, capital, 'CORE', DEATH_STAR.requiredCore);
    await setLevel(f.db, capital, 'SHIPYARD', DEATH_STAR.requiredShipyard);
    await giveResearch(f.db, capital, 'DEATH_STAR_PROTOCOL');
    await f.db
      .update(seasons)
      .set({ endsAt: new Date(f.clock.now().getTime() + DEATH_STAR.buildMinutes * 60_000) })
      .where(eq(seasons.id, f.season.id));

    await expect(buildDeathStar(f.db, capital, f.clock)).rejects.toMatchObject({
      code: 'SEASON_ENDS_BEFORE_BUILD',
    });
    const [world] = await f.db.select().from(planets).where(eq(planets.id, capital));
    expect(world).toMatchObject(purse);
    expect(await f.db.select().from(strategicAssets)).toHaveLength(0);
  });

  it('devastates a capital without reserving capacity or transferring control', async () => {
    const f = await setup();
    const defenderAccount = await makeAccount(f.db, 'Capital Defender');
    const defender = await joinSeason(f.db, defenderAccount.id, f.season.id, f.clock);
    await f.db.update(planets).set({ x: 0, y: 0, z: 0 })
      .where(eq(planets.id, f.joined.planetId));
    await f.db.update(planets).set({
      x: 200,
      y: 0,
      z: 0,
      alloy: 20_000,
      crystal: 8_000,
      deuterium: 2_000,
      // A capital already in recovery is still a destructive target. Its window
      // must never turn this mission into a capacity-reserving capture attempt.
      recoveryUntil: new Date(f.clock.now().getTime() + 60_000),
    }).where(eq(planets.id, defender.planetId));
    await setLevel(f.db, defender.planetId, 'CORE', 5);
    await setLevel(f.db, defender.planetId, 'REFINERY', 4);
    await giveUnits(f.db, defender.planetId, { DART: 5, COURIER: 1 });
    await setLevel(f.db, f.joined.planetId, 'CORE', 2);
    await f.db.insert(strategicAssets).values({
      planetId: f.joined.planetId,
      status: 'READY',
      startedAt: f.clock.now(),
      remainingSeconds: 0,
    });

    const launched = await launchDeathStar(
      f.db,
      f.joined.planetId,
      defender.planetId,
      f.clock,
    );
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    expect(mission).toMatchObject({ deathStarCapture: false, targetPlanetId: defender.planetId });
    await expect(colonyStanding(f.db, f.joined.playerId)).resolves.toMatchObject({
      capacity: 0,
      reservations: 0,
    });

    f.clock.set(launched.arriveAt);
    await workerFor(f.db, f.clock).tick();
    const [struck] = await f.db.select().from(planets).where(eq(planets.id, defender.planetId));
    expect(struck).toMatchObject({
      kind: 'CAPITAL',
      controllerPlayerId: defender.playerId,
      // Halved (D113). This world was already recovering, so nothing accrued
      // between the fixture and the impact and these are exactly half of it.
      alloy: 10_000,
      crystal: 4_000,
      deuterium: 1_000,
    });
    expect(struck?.recoveryUntil?.getTime())
      .toBe(f.clock.now().getTime() + recoveryMinutesFor('CAPITAL') * 60_000);
    const damaged = Object.fromEntries((await f.db.select().from(buildings)
      .where(eq(buildings.planetId, defender.planetId))).map((row) => [row.type, row.level]));
    // Core 5 → 4; the Refinery was already under the new ceiling and stays put.
    expect(damaged).toMatchObject({ CORE: 4, REFINERY: 4 });
    expect(await f.db.select().from(units).where(eq(units.planetId, defender.planetId))).toEqual([]);
    const [impact] = await f.db.select().from(galaxyEvents).where(and(
      eq(galaxyEvents.kind, 'death_star_impact'),
      eq(galaxyEvents.refId, launched.missionId),
    ));
    expect(impact?.payload).toMatchObject({
      outcome: 'FIRST_STRIKE',
      capturable: false,
    });
    const [ledger] = await f.db.select().from(strategicImpacts)
      .where(eq(strategicImpacts.missionId, launched.missionId));
    expect(ledger).toMatchObject({
      attackerPlayerId: f.joined.playerId,
      defenderPlayerId: defender.playerId,
      targetPlanetId: defender.planetId,
      outcome: 'FIRST_STRIKE',
      destroyedFleet: { DART: 5, COURIER: 1 },
      destroyedResources: {
        alloy: struck!.alloy + struck!.bufferAlloy,
        crystal: struck!.crystal + struck!.bufferCrystal,
        deuterium: struck!.deuterium + struck!.bufferDeuterium,
      },
      levelChanges: [{ kind: 'BUILDING', id: 'CORE', before: 5, after: 4 }],
      destroyedOrders: [],
      shieldDestroyed: 0,
    });
    /**
     * THE FIGURE, ITEM BY ITEM, RATHER THAN A THRESHOLD. D113.
     *
     * It used to read `> 30_000`, which passed both before and after the strike
     * stopped emptying the stores — a bound loose enough to survive the change it
     * was meant to notice. Stated as a sum it cannot: halve the wrong pile, drop
     * a building the rule no longer drops, or count the Aegis on a world that has
     * none, and this moves. `real` is float4, hence the tolerance.
     */
    const coreLoss = upgradeCost(4);
    /**
     * WHAT WAS DESTROYED EQUALS WHAT SURVIVED, which is the halving rule stated
     * as an identity rather than as a number. Read off the struck world so it
     * holds whatever the Works accrued between the fixture and the impact —
     * roughly eleven units here, and the reason a hand-summed figure was wrong.
     *
     * It used to read `> 30_000`, a bound loose enough to pass both before and
     * after the strike stopped emptying the stores.
     */
    const survived = struck!.alloy + struck!.crystal + struck!.deuterium
      + struck!.bufferAlloy + struck!.bufferCrystal + struck!.bufferDeuterium;
    expect(ledger!.damage).toBeCloseTo(
      survived
      + fleetValue({ DART: 5, COURIER: 1 })
      + coreLoss.alloy + coreLoss.crystal + coreLoss.deuterium,
      // Six piles, each floored, against a float4 column.
      -1,
    );
    const [asset] = await f.db.select().from(strategicAssets)
      .where(eq(strategicAssets.planetId, f.joined.planetId));
    expect(asset?.status).toBe('CONSUMED');
  });

  it('records a delayed strike sensor loss at the promised arrival instant', async () => {
    const f = await setup();
    const defenderAccount = await makeAccount(f.db, 'Delayed Sensor Defender');
    const defender = await joinSeason(f.db, defenderAccount.id, f.season.id, f.clock);
    await f.db.update(planets).set({ x: 0, y: 0, z: 0 })
      .where(eq(planets.id, f.joined.planetId));
    await f.db.update(planets).set({ x: 200, y: 0, z: 0 })
      .where(eq(planets.id, defender.planetId));
    await setLevel(f.db, f.joined.planetId, 'CORE', 2);
    await setLevel(f.db, defender.planetId, 'CORE', 3);
    await giveSatellite(f.db, defender.planetId, 'UPLINK');
    await giveInstrument(f.db, defender.planetId, 'TELESCOPE', 3);
    await refreshSensorEpoch(f.db, defender.planetId, f.clock.now());
    await f.db.insert(strategicAssets).values({
      planetId: f.joined.planetId,
      status: 'READY',
      startedAt: f.clock.now(),
      remainingSeconds: 0,
    });

    const launched = await launchDeathStar(
      f.db,
      f.joined.planetId,
      defender.planetId,
      f.clock,
    );
    f.clock.set(new Date(launched.arriveAt.getTime() + 6 * 60_000));
    await workerFor(f.db, f.clock).tick();

    const epochs = await f.db
      .select()
      .from(sensorEpochs)
      .where(eq(sensorEpochs.planetId, defender.planetId))
      .orderBy(sensorEpochs.startsAt);
    expect(epochs).toHaveLength(2);
    expect(epochs[0]).toMatchObject({
      reach: sensorSphere({ x: 0, y: 0, z: 0 }, 3, 0).identify,
      endsAt: launched.arriveAt,
    });
    expect(epochs[1]).toMatchObject({
      reach: sensorSphere({ x: 0, y: 0, z: 0 }, 2, 0).identify,
      startsAt: launched.arriveAt,
      endsAt: null,
    });
  });

  /**
   * D113, owner instruction. A bombardment destroys the work in progress and
   * refunds nothing — `cancelBuildOrder` gives half back because that is the
   * player's own change of mind, and this is not that.
   *
   * It also closes the one way a building could stand ABOVE its Core ceiling:
   * `applyOrderEffect` raises to `before + 1` without re-reading the Core, so an
   * order placed at Core 12 completing after a strike left Core 11 would have put
   * a Refinery at 12 — a level `build.ts` refuses to sell.
   */
  it('burns every queued building order on impact and refunds nothing', async () => {
    const f = await setup();
    const defenderAccount = await makeAccount(f.db, 'Builder');
    const defender = await joinSeason(f.db, defenderAccount.id, f.season.id, f.clock);
    await f.db.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, f.joined.planetId));
    await f.db.update(planets).set({
      x: 200, y: 0, z: 0, kind: 'COLONY',
      alloy: 400_000, crystal: 200_000, deuterium: 40_000, lastTickAt: f.clock.now(),
    }).where(eq(planets.id, defender.planetId));
    await setLevel(f.db, defender.planetId, 'CORE', 8);
    await setLevel(f.db, defender.planetId, 'REFINERY', 7);
    await setLevel(f.db, f.joined.planetId, 'CORE', 2);

    // Two orders in one queue: a Refinery that would land ON the old ceiling, and
    // a research order that has no Core level and must survive.
    await upgradeBuilding(f.db, defender.planetId, 'REFINERY', f.clock);
    await giveResearch(f.db, defender.planetId, 'ISOTOPE_SPECTROMETRY');
    const queuedBefore = await f.db.select().from(buildOrders)
      .where(and(eq(buildOrders.planetId, defender.planetId), eq(buildOrders.status, 'BUILDING')));
    expect(queuedBefore).toHaveLength(1);
    const [purse] = await f.db.select().from(planets).where(eq(planets.id, defender.planetId));

    await f.db.insert(strategicAssets).values({
      planetId: f.joined.planetId,
      status: 'READY',
      startedAt: f.clock.now(),
      remainingSeconds: 0,
    });
    const launched = await launchDeathStar(f.db, f.joined.planetId, defender.planetId, f.clock);
    f.clock.set(launched.arriveAt);
    await workerFor(f.db, f.clock).tick();

    const orders = await f.db.select().from(buildOrders)
      .where(eq(buildOrders.planetId, defender.planetId));
    expect(orders.map((row) => row.status)).toEqual(['CANCELLED']);
    // Nothing came back: the survivor is exactly half the pre-strike purse, with
    // no refund folded into it.
    const [after] = await f.db.select().from(planets).where(eq(planets.id, defender.planetId));
    expect(after?.alloy).toBe(Math.floor(purse!.alloy / 2));
    expect(after?.crystal).toBe(Math.floor(purse!.crystal / 2));
    // And the order can never complete into a level above the new Core.
    const levels = Object.fromEntries((await f.db.select().from(buildings)
      .where(eq(buildings.planetId, defender.planetId))).map((row) => [row.type, row.level]));
    expect(levels).toMatchObject({ CORE: 7, REFINERY: 7 });
    /*
      EVERY CORE-BOUND BUILDING, not just the ones that were on the list when it
      was written. The Deuterium Refinery was added in T5 and left off it — the
      strike dropped the Core and the plant stayed standing above a level that
      could not have built it, which is the illegal post-strike state the clamp
      exists to prevent. Read off the rule rather than named here, so the next
      building added is covered the day it exists.
    */
    for (const [type, level] of Object.entries(levels)) {
      if (type === 'CORE') continue;
      expect(level, `${type} above its Core`).toBeLessThanOrEqual(levels.CORE!);
    }
    await workerFor(f.db, f.clock).tick();
    /*
      RESEARCH SURVIVES A STRIKE, and after T7 that is a statement about the
      COMMANDER rather than the world. It used to be asserted on a neutral target,
      where it no longer has any content — a caretaker world has no commander and
      so holds no research at all.
    */
    expect(await f.db.select().from(playerResearch)
      .where(eq(playerResearch.playerId, defender.playerId))).toHaveLength(1);
    const [stillSeven] = await f.db.select().from(buildings).where(and(
      eq(buildings.planetId, defender.planetId),
      eq(buildings.type, 'REFINERY'),
    ));
    expect(stillSeven?.level).toBe(7);
    // The value it cost is counted as damage rather than quietly vanishing.
    const [impact] = await f.db.select().from(strategicImpacts)
      .where(eq(strategicImpacts.missionId, launched.missionId));
    const order = queuedBefore[0]!;
    expect(impact!.damage).toBeGreaterThan(
      order.cost.alloy + order.cost.crystal + order.cost.deuterium,
    );
  });

  it('allows a destructive Death Star strike with no colony capacity', async () => {
    const f = await setup();
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    await setLevel(f.db, f.joined.planetId, 'CORE', 2);
    await f.db.insert(strategicAssets).values({
      planetId: f.joined.planetId,
      status: 'READY',
      startedAt: f.clock.now(),
      remainingSeconds: 0,
    });

    const launched = await launchDeathStar(
      f.db,
      f.joined.planetId,
      target.world.id,
      f.clock,
    );
    const [mission] = await f.db.select().from(missions)
      .where(eq(missions.id, launched.missionId));
    expect(mission).toMatchObject({
      targetPlanetId: target.world.id,
      kind: 'death_star',
      deathStarCapture: false,
    });
    await expect(colonyStanding(f.db, f.joined.playerId)).resolves.toMatchObject({
      capacity: 0,
      colonies: 0,
      reservations: 0,
    });
  });

  it('counts lazily accrued Works in Death Star damage without a defender refresh', async () => {
    const f = await setup();
    const defenderAccount = await makeAccount(f.db, 'Sleeping Defender');
    const defender = await joinSeason(f.db, defenderAccount.id, f.season.id, f.clock);
    await f.db.update(planets).set({ x: 0, y: 0, z: 0 })
      .where(eq(planets.id, f.joined.planetId));
    await f.db.update(planets).set({
      x: 200,
      y: 0,
      z: 0,
      alloy: 0,
      crystal: 0,
      deuterium: 0,
      bufferAlloy: 0,
      bufferCrystal: 0,
      bufferDeuterium: 0,
      lastTickAt: f.clock.now(),
    }).where(eq(planets.id, defender.planetId));
    await setLevel(f.db, defender.planetId, 'CORE', 5);
    await setLevel(f.db, defender.planetId, 'REFINERY', 5);
    await setLevel(f.db, defender.planetId, 'EXTRACTOR', 5);
    await setLevel(f.db, f.joined.planetId, 'CORE', 2);
    await f.db.insert(strategicAssets).values({
      planetId: f.joined.planetId,
      status: 'READY',
      startedAt: f.clock.now(),
      remainingSeconds: 0,
    });

    const launched = await launchDeathStar(
      f.db,
      f.joined.planetId,
      defender.planetId,
      f.clock,
    );
    f.clock.set(launched.arriveAt);
    await workerFor(f.db, f.clock).tick();

    const [ledger] = await f.db.select().from(strategicImpacts)
      .where(eq(strategicImpacts.missionId, launched.missionId));
    const replacement = ['CORE', 'REFINERY', 'EXTRACTOR']
      .map(() => upgradeCost(4))
      .reduce(
        (sum, cost) => sum + cost.alloy + cost.crystal + cost.deuterium,
        0,
      );
    expect(ledger!.damage).toBeGreaterThan(replacement);
  });

  /**
   * D167 RETIRED THE CAPACITY RESERVATION WITH THE CAPTURE ROUTE. A strike at a
   * world that is already recovering used to be an ACQUISITION, so it reserved a
   * colony slot and was refused with `COLONY_CAP` when the attacker had none. The
   * weapon takes nothing now — it restarts the target's deadline — so a full
   * commander may fire it exactly like an empty one.
   */
  it('no longer reserves colony capacity to strike a recovering world', async () => {
    const f = await setup();
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    await setLevel(f.db, f.joined.planetId, 'CORE', 2);
    await f.db.update(planets).set({
      recoveryUntil: new Date(f.clock.now().getTime() + recoveryMinutesFor('CAPITAL') * 60_000),
    }).where(eq(planets.id, target.world.id));
    await f.db.insert(strategicAssets).values({
      planetId: f.joined.planetId,
      status: 'READY',
      startedAt: f.clock.now(),
      remainingSeconds: 0,
    });

    const launched = await launchDeathStar(f.db, f.joined.planetId, target.world.id, f.clock);
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    expect(mission?.deathStarCapture).toBe(false);
    await expect(colonyStanding(f.db, f.joined.playerId)).resolves.toMatchObject({
      reservations: 0,
    });
  });

  it('never turns a destructive rocket into an accidental capture while it is in flight', async () => {
    const f = await setup();
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    await setLevel(f.db, f.joined.planetId, 'CORE', 2);
    await f.db.insert(strategicAssets).values({
      planetId: f.joined.planetId,
      status: 'READY',
      startedAt: f.clock.now(),
      remainingSeconds: 0,
    });
    const launched = await launchDeathStar(
      f.db,
      f.joined.planetId,
      target.world.id,
      f.clock,
    );

    // Another impact begins recovery after this destructive flight committed.
    await f.db.update(planets).set({
      recoveryUntil: new Date(f.clock.now().getTime() + recoveryMinutesFor('CAPITAL') * 60_000),
    }).where(eq(planets.id, target.world.id));
    f.clock.set(launched.arriveAt);
    await workerFor(f.db, f.clock).tick();

    const [world] = await f.db.select().from(planets).where(eq(planets.id, target.world.id));
    expect(world).toMatchObject({ kind: 'NEUTRAL', controllerPlayerId: null });
    expect(world?.recoveryUntil?.getTime()).toBeGreaterThan(launched.arriveAt.getTime());
  });

  /* ── a colony that is not answered for ─────────────────────── */

  /**
   * THE DEATH STAR STOPPED TAKING WORLDS AND STARTED LOSING THEM FOR PEOPLE. D167.
   *
   * Owner instruction, and it replaces D105/D113's second-strike capture outright.
   * A struck COLONY goes dark for eight hours, and the clock is a DEADLINE: put a
   * ship on it before the window closes or it stops being yours. What the attacker
   * gets is not the world — it is the world being on the table, for everybody.
   *
   * A CAPITAL IS OUTSIDE ALL OF IT. Two hours, never released: "capitals cannot be
   * captured" is a locked constraint, and an outage long enough to drop one would
   * be that rule reinterpreted rather than kept.
   *
   * WHAT SURVIVES THE RELEASE IS EVERYTHING. Buildings, satellites, research and
   * whatever stock the strike left stay exactly where they are — the world changes
   * hands, not shape, and whoever settles it next inherits what is standing.
   */
  const armed = async (f: Awaited<ReturnType<typeof setup>>, from: string) => {
    await setLevel(f.db, from, 'CORE', DEATH_STAR.requiredCore);
    await setLevel(f.db, from, 'SHIPYARD', DEATH_STAR.requiredShipyard);
    await f.db.insert(strategicAssets).values({
      planetId: from,
      status: 'READY',
      startedAt: f.clock.now(),
      remainingSeconds: 0,
    });
  };

  /** A colony of the caller's, settled the ordinary way, at a known distance. */
  const withColony = async (f: Awaited<ReturnType<typeof setup>>) => {
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    await f.db.update(planets).set({ x: 40, y: 0, z: 0 }).where(eq(planets.id, target.world.id));
    await f.db.update(planets).set({ x: 0, y: 0, z: 0, alloy: 400_000, crystal: 200_000, deuterium: 60_000 })
      .where(eq(planets.id, f.joined.planetId));
    await setLevel(f.db, f.joined.planetId, 'CORE', 3);
    await giveUnits(f.db, f.joined.planetId, { COURIER: MULTI_WORLD.settlement.transports });
    await f.db.update(neutralPlanetState)
      .set({ claimUntil: new Date(f.clock.now().getTime() + 30 * 60_000) })
      .where(eq(neutralPlanetState.planetId, target.world.id));
    const settling = await launchSettlement(
      f.db, f.joined.playerId, f.joined.planetId, target.world.id, f.clock,
    );
    f.clock.set(settling.arriveAt);
    await workerFor(f.db, f.clock).tick();
    // Settling grants six hours of occupation protection; a strike needs it gone.
    await f.db.update(planets).set({ protectedUntil: null }).where(eq(planets.id, target.world.id));
    return target.world.id;
  };

  /** A second commander with a pad, since nobody may strike their own world. */
  const rivalPad = async (f: Awaited<ReturnType<typeof setup>>, name: string) => {
    const account = await makeAccount(f.db, name);
    const rival = await joinSeason(f.db, account.id, f.season.id, f.clock);
    await f.db.update(planets)
      .set({ x: 0, y: 0, z: 200, alloy: 400_000, crystal: 200_000, deuterium: 60_000 })
      .where(eq(planets.id, rival.planetId));
    return rival;
  };

  const strike = async (f: Awaited<ReturnType<typeof setup>>, from: string, at: string) => {
    await armed(f, from);
    const launched = await launchDeathStar(f.db, from, at, f.clock);
    f.clock.set(launched.arriveAt);
    await workerFor(f.db, f.clock).tick();
    return launched;
  };

  it('darkens a struck colony for eight hours, not the capital’s two', async () => {
    const f = await setup();
    const colony = await withColony(f);
    const rival = await rivalPad(f, 'Colony Breaker');
    await strike(f, rival.planetId, colony);

    const [struck] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(struck?.recoveryUntil?.getTime())
      .toBe(f.clock.now().getTime() + recoveryMinutesFor('COLONY') * 60_000);
    // And it is still theirs while the clock runs.
    expect(struck?.controllerPlayerId).toBe(f.joined.playerId);
    expect(struck?.recoveryReliefAt).toBeNull();
  });

  it('releases a colony nobody sent a ship to, keeping everything standing', async () => {
    const f = await setup();
    const colony = await withColony(f);
    const rival = await rivalPad(f, 'Colony Breaker');
    await strike(f, rival.planetId, colony);
    // Read AFTER the strike: the impact drops the Core, and what this test is about
    // is that RELEASING the world changes nothing further.
    const before = Object.fromEntries((await f.db.select().from(buildings)
      .where(eq(buildings.planetId, colony))).map((row) => [row.type, row.level]));
    const [dark] = await f.db.select().from(planets).where(eq(planets.id, colony));

    f.clock.set(new Date(dark!.recoveryUntil!.getTime() + 1_000));
    await workerFor(f.db, f.clock).tick();

    const [released] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(released).toMatchObject({ controllerPlayerId: null, recoveryUntil: null });
    /*
      NEUTRAL AGAIN AND ACTUALLY SETTLEABLE, which is a stronger claim than it looks
      and the one this test was missing. `resolveSettlement` reads `claimUntil` as
      the SETTLE PERMIT rather than as a race window, so the obvious "no race, so
      null" left the released world permanently unclaimable. It runs to the end of
      the season instead: open at once, and open until the season is.
    */
    const [state] = await f.db.select().from(neutralPlanetState)
      .where(eq(neutralPlanetState.planetId, colony));
    expect(state).toBeDefined();
    expect(state?.claimUntil?.getTime()).toBeGreaterThan(f.clock.now().getTime());
    // The world changed hands, not shape.
    const after = Object.fromEntries((await f.db.select().from(buildings)
      .where(eq(buildings.planetId, colony))).map((row) => [row.type, row.level]));
    expect(after).toEqual(before);
    await expect(colonyStanding(f.db, f.joined.playerId)).resolves.toMatchObject({ colonies: 0 });

    // ...and a founding flight really does land on it. The whole instruction was
    // that the world opens up, so nothing short of a completed settlement proves it.
    await giveUnits(f.db, f.joined.planetId, { COURIER: MULTI_WORLD.settlement.transports });
    await f.db.update(planets).set({ alloy: 200_000, crystal: 100_000, deuterium: 40_000 })
      .where(eq(planets.id, f.joined.planetId));
    const settling = await launchSettlement(
      f.db, f.joined.playerId, f.joined.planetId, colony, f.clock,
    );
    f.clock.set(settling.arriveAt);
    await workerFor(f.db, f.clock).tick();
    const [resettled] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(resettled).toMatchObject({ kind: 'COLONY', controllerPlayerId: f.joined.playerId });
  });

  it('keeps a colony whose commander put a ship on it before the clock ran out', async () => {
    const f = await setup();
    const colony = await withColony(f);
    const rival = await rivalPad(f, 'Colony Breaker');
    await strike(f, rival.planetId, colony);
    const [dark] = await f.db.select().from(planets).where(eq(planets.id, colony));

    await giveUnits(f.db, f.joined.planetId, { COURIER: 2 });
    const relief = await launchTransfer(
      f.db,
      f.joined.playerId,
      f.joined.planetId,
      colony,
      { COURIER: 1 },
      { alloy: 0, crystal: 0, deuterium: 0 },
      f.clock,
    );
    f.clock.set(relief.arriveAt);
    await workerFor(f.db, f.clock).tick();

    const [answered] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(answered?.recoveryReliefAt).not.toBeNull();
    // The relief does NOT end the outage — only the drop.
    expect(answered?.recoveryUntil?.getTime()).toBe(dark!.recoveryUntil!.getTime());

    f.clock.set(new Date(dark!.recoveryUntil!.getTime() + 1_000));
    await workerFor(f.db, f.clock).tick();
    const [kept] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(kept).toMatchObject({
      controllerPlayerId: f.joined.playerId,
      kind: 'COLONY',
      recoveryUntil: null,
      recoveryReliefAt: null,
    });
  });

  /**
   * AND THE ANSWER HAS TO BE GIVEN AGAIN EVERY TIME. A second strike restarts the
   * eight hours and forgets the relief, so a commander who saved a colony once has
   * to save it again — which is the whole shape the owner asked for.
   */
  it('makes a second strike restart the deadline rather than take the world', async () => {
    const f = await setup();
    const colony = await withColony(f);
    const rival = await rivalPad(f, 'Colony Breaker');
    await strike(f, rival.planetId, colony);

    await giveUnits(f.db, f.joined.planetId, { COURIER: 2 });
    const relief = await launchTransfer(
      f.db, f.joined.playerId, f.joined.planetId, colony,
      { COURIER: 1 }, { alloy: 0, crystal: 0, deuterium: 0 }, f.clock,
    );
    f.clock.set(relief.arriveAt);
    await workerFor(f.db, f.clock).tick();

    const second = await strike(f, rival.planetId, colony);
    const [again] = await f.db.select().from(planets).where(eq(planets.id, colony));
    // Still the defender's — the weapon never transfers control any more.
    expect(again?.controllerPlayerId).toBe(f.joined.playerId);
    expect(again?.recoveryReliefAt).toBeNull();
    expect(again?.recoveryUntil?.getTime())
      .toBe(second.arriveAt.getTime() + recoveryMinutesFor('COLONY') * 60_000);
  });

  it('never releases a capital, however many times it is struck', async () => {
    const f = await setup();
    const victimAccount = await makeAccount(f.db, 'Struck Capital');
    const victim = await joinSeason(f.db, victimAccount.id, f.season.id, f.clock);
    await f.db.update(planets).set({ x: 0, y: 0, z: 0, alloy: 400_000, crystal: 200_000, deuterium: 60_000 })
      .where(eq(planets.id, f.joined.planetId));
    await f.db.update(planets).set({ x: 40, y: 0, z: 0, protectedUntil: null })
      .where(eq(planets.id, victim.planetId));

    const first = await strike(f, f.joined.planetId, victim.planetId);
    const [dark] = await f.db.select().from(planets).where(eq(planets.id, victim.planetId));
    expect(dark?.recoveryUntil?.getTime())
      .toBe(first.arriveAt.getTime() + recoveryMinutesFor('CAPITAL') * 60_000);

    f.clock.set(new Date(dark!.recoveryUntil!.getTime() + 1_000));
    await workerFor(f.db, f.clock).tick();
    const [after] = await f.db.select().from(planets).where(eq(planets.id, victim.planetId));
    expect(after).toMatchObject({
      kind: 'CAPITAL',
      controllerPlayerId: victim.playerId,
      recoveryUntil: null,
    });
  });

  it('treats stale recovery and occupation events as idempotent no-ops', async () => {
    const f = await setup();
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    const currentRecovery = new Date(f.clock.now().getTime() + 60_000);
    const currentProtection = new Date(f.clock.now().getTime() + 120_000);
    await f.db.update(planets).set({
      recoveryUntil: currentRecovery,
      protectedUntil: currentProtection,
    }).where(eq(planets.id, target.world.id));

    const staleRecovery = new Date(currentRecovery.getTime() - 1_000).toISOString();
    const staleProtection = new Date(currentProtection.getTime() - 1_000).toISOString();
    await expect(f.db.transaction((tx) => endRecovery(
      tx,
      target.world.id,
      staleRecovery,
      f.clock.now(),
    ))).resolves.toBe(false);
    await expect(f.db.transaction((tx) => endOccupation(
      tx,
      target.world.id,
      staleProtection,
    ))).resolves.toBe(false);
    const [unchanged] = await f.db.select().from(planets).where(eq(planets.id, target.world.id));
    expect(unchanged?.recoveryUntil?.getTime()).toBe(currentRecovery.getTime());
    expect(unchanged?.protectedUntil?.getTime()).toBe(currentProtection.getTime());
  });

  /**
   * THREE ROCKETS, ONE DARK WORLD, AND NOBODY OWNS IT AT THE END. D167.
   *
   * This test used to prove that the SECOND impact inside a recovery window handed
   * the colony to its attacker and a later one arrived to find the world protected.
   * That route is retired: every strike is a first strike now, so what has to hold
   * instead is that each one lands, each one restarts the deadline, control never
   * moves, and every weapon is consumed exactly once.
   */
  it('lets three rockets land without any of them taking the world', async () => {
    const f = await setup();
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    const secondAccount = await makeAccount(f.db, 'Second Rocket');
    const second = await joinSeason(f.db, secondAccount.id, f.season.id, f.clock);
    const thirdAccount = await makeAccount(f.db, 'Third Rocket');
    const third = await joinSeason(f.db, thirdAccount.id, f.season.id, f.clock);
    await f.db.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, f.joined.planetId));
    await f.db.update(planets).set({ x: 20, y: 0, z: 0 }).where(eq(planets.id, target.world.id));
    await f.db.update(planets).set({ x: 0, y: 60, z: 0 }).where(eq(planets.id, second.planetId));
    await f.db.update(planets).set({ x: 0, y: 0, z: 400 }).where(eq(planets.id, third.planetId));
    for (const pad of [f.joined.planetId, second.planetId, third.planetId]) {
      await setLevel(f.db, pad, 'CORE', 2);
      await f.db.insert(strategicAssets).values({
        planetId: pad,
        status: 'READY',
        startedAt: f.clock.now(),
        remainingSeconds: 0,
      });
    }
    const worker = workerFor(f.db, f.clock);
    const first = await launchDeathStar(f.db, f.joined.planetId, target.world.id, f.clock);
    f.clock.set(first.arriveAt);
    await worker.tick();

    const secondFlight = await launchDeathStar(f.db, second.planetId, target.world.id, f.clock);
    const lateFlight = await launchDeathStar(f.db, third.planetId, target.world.id, f.clock);
    expect(secondFlight.arriveAt.getTime()).toBeLessThan(lateFlight.arriveAt.getTime());
    f.clock.set(lateFlight.arriveAt);
    await worker.tick();

    const [struck] = await f.db.select().from(planets).where(eq(planets.id, target.world.id));
    expect(struck).toMatchObject({ kind: 'NEUTRAL', controllerPlayerId: null });
    // The LAST rocket set the clock: every impact restarts the window.
    expect(struck?.recoveryUntil?.getTime())
      .toBe(lateFlight.arriveAt.getTime() + recoveryMinutesFor('NEUTRAL') * 60_000);
    expect(struck?.protectedUntil).toBeNull();

    // Nobody is told they captured anything, and all three weapons are spent.
    const results = await f.db.select().from(notifications).where(and(
      inArray(notifications.playerId, [second.playerId, third.playerId]),
      eq(notifications.kind, 'death_star_result'),
    ));
    for (const notice of results) {
      expect(notice.payload).not.toMatchObject({ outcome: 'CAPTURED' });
    }
    expect(await f.db.select().from(strategicAssets)
      .where(eq(strategicAssets.status, 'CONSUMED'))).toHaveLength(3);
  });
});
