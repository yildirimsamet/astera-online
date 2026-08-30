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
  upgradeCost,
  DEATH_STAR,
  fleetCargo,
  fleetValue,
  sensorSphere,
  type Fleet,
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
import { colonyStanding, transferPlanetControl } from '../src/services/ownership.js';
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

describe('ruleset v3 worlds', () => {
  beforeEach(async () => {
    const { db } = await testDb();
    await truncateAll(db);
  });

  it('creates the deterministic fixed 30/15/6 pool outside all capital slots', async () => {
    const f = await setup();
    expect(f.season.rulesetVersion).toBe(3);
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
    const blockedAlloy = HULLS.WASP.alloy;
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
      hull: 'WASP',
      location: 'home',
      count: 7,
    });
    await f.db.update(planets).set({
      alloy: HULLS.LANCE.alloy,
      crystal: HULLS.LANCE.crystal,
      deuterium: HULLS.LANCE.deuterium,
      lastTickAt: f.clock.now(),
    }).where(eq(planets.id, target.world.id));
    await f.db.transaction((tx) => reinforceNeutral(tx, target.world.id, f.clock.now()));
    const garrison = await f.db.select().from(units).where(eq(units.planetId, target.world.id));
    expect(garrison.map((row) => [row.hull, row.count]).sort()).toEqual([
      ['LANCE', 1],
      ['WASP', 7],
    ]);
  });

  it('resolves an empty T1 as decisive, opens one public claim and writes no Dominion', async () => {
    const f = await setup();
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    await f.db.update(planets).set({ x: 150, y: 0, z: 0 }).where(eq(planets.id, target.world.id));
    await f.db.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, f.joined.planetId));
    await setLevel(f.db, f.joined.planetId, 'CORE', 3);
    await giveUnits(f.db, f.joined.planetId, { WASP: 1 });

    const launched = await launchAttack(f.db, f.joined.planetId, target.world.id, { WASP: 1 }, f.clock);
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
      await giveUnits(f.db, f.joined.planetId, { WASP: 1 });
      const away = await launchAttack(f.db, f.joined.planetId, target.world.id, { WASP: 1 }, f.clock);
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
      HAULER: MULTI_WORLD.settlement.haulers,
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
      eq(units.hull, 'HAULER'),
      eq(units.location, 'home'),
    ));
    expect(captured).toMatchObject({ kind: 'COLONY', controllerPlayerId: f.joined.playerId });
    expect(captured?.protectedUntil?.getTime()).toBe(f.clock.now().getTime() + 6 * 60 * 60_000);
    expect(state).toHaveLength(0);
    expect(hauler).toMatchObject({
      ownerPlayerId: f.joined.playerId,
      count: MULTI_WORLD.settlement.haulers,
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
        HAULER: MULTI_WORLD.settlement.haulers,
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
      eq(units.hull, 'HAULER'),
      eq(units.location, 'home'),
    ));
    expect(hauler).toMatchObject({
      planetId: loser.planetId,
      count: MULTI_WORLD.settlement.haulers,
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
    await giveUnits(f.db, f.joined.planetId, { HAULER: 1 });
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
    await giveUnits(f.db, f.joined.planetId, { HAULER: MULTI_WORLD.settlement.haulers });
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

  it('delivers transfer cargo above storage cap without loss', async () => {
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
    await giveUnits(f.db, f.joined.planetId, { HAULER: 1 });
    const before = target.world.alloy;
    const launched = await launchTransfer(
      f.db,
      f.joined.playerId,
      f.joined.planetId,
      target.world.id,
      { HAULER: 1 },
      { alloy: 500, crystal: 100, deuterium: 0 },
      f.clock,
    );
    f.clock.set(launched.arriveAt);
    await workerFor(f.db, f.clock).tick();
    const [delivered] = await f.db.select().from(planets).where(eq(planets.id, target.world.id));
    expect(delivered?.alloy).toBe(before + 500);
    expect(delivered?.crystal).toBe(target.world.crystal + 100);
  });

  it('rejects ground transfers and cargo that dedicated transports cannot carry', async () => {
    const f = await setup();
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    await f.db.update(planets).set({
      kind: 'COLONY',
      controllerPlayerId: f.joined.playerId,
    }).where(eq(planets.id, target.world.id));
    await f.db.delete(neutralPlanetState).where(eq(neutralPlanetState.planetId, target.world.id));
    await giveUnits(f.db, f.joined.planetId, { THORN: 1, WASP: 1, HAULER: 1 });

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
      { WASP: 1 },
      { alloy: 1, crystal: 0, deuterium: 0 },
      f.clock,
    )).rejects.toMatchObject({ code: 'CARGO_CAPACITY' });
    await expect(launchTransfer(
      f.db,
      f.joined.playerId,
      f.joined.planetId,
      target.world.id,
      { HAULER: 1 },
      { alloy: HULLS.HAULER.cargo + 1, crystal: 0, deuterium: 0 },
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
    await giveUnits(f.db, f.joined.planetId, { HAULER: 1 });
    const before = await f.db.select().from(planets).where(eq(planets.id, f.joined.planetId));
    const launched = await launchTransfer(
      f.db,
      f.joined.playerId,
      f.joined.planetId,
      target.world.id,
      { HAULER: 1 },
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
    f.clock.set(rerouted!.arriveAt);
    await workerFor(f.db, f.clock).tick();

    const stacks = await f.db.select().from(units).where(eq(units.ownerPlayerId, f.joined.playerId));
    expect(stacks).toHaveLength(1);
    expect(stacks[0]).toMatchObject({
      planetId: f.joined.planetId,
      hull: 'HAULER',
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
    await giveUnits(f.db, f.joined.planetId, { HAULER: 2 });

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
      WASP: 2,
      LANCE: 2,
      BULWARK: 1,
      HAULER: 1,
      RUNNER: 1,
      BREACHER: 1,
      THORN: 2,
      BASTION: 1,
      PROSPECTOR: 1,
    });
    await giveUnits(f.db, target.world.id, { WASP: 1, PROSPECTOR: 1 }, 'mining-away');
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
    expect(struck?.recoveryUntil?.getTime())
      .toBe(f.clock.now().getTime() + MULTI_WORLD.recoveryMinutes * 60_000);
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
      ['PROSPECTOR', 'mining-away', 1],
      ['WASP', 'mining-away', 1],
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
    expect(await f.db.select().from(notifications).where(eq(notifications.playerId, defender.playerId)))
      .toHaveLength(1);
  });

  it('uses two strategic hits to capture a neutral and resumes a captured build', async () => {
    const f = await setup();
    const capital = f.joined.planetId;
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    await f.db.update(planets).set({
      x: 0,
      y: 0,
      z: 0,
      alloy: DEATH_STAR.cost.alloy * 2,
      crystal: DEATH_STAR.cost.crystal * 2,
      deuterium: DEATH_STAR.cost.deuterium * 2,
    })
      .where(eq(planets.id, capital));
    await f.db.update(planets).set({ x: 20, y: 0, z: 0 }).where(eq(planets.id, target.world.id));
    await setLevel(f.db, capital, 'CORE', DEATH_STAR.requiredCore);
    await setLevel(f.db, capital, 'SHIPYARD', DEATH_STAR.requiredShipyard);
    await giveResearch(f.db, capital, 'GRAVITIC_CHARGES');
    await giveResearch(f.db, capital, 'DEATH_STAR_PROTOCOL');
    const worker = workerFor(f.db, f.clock);

    const firstBuild = await buildDeathStar(f.db, capital, f.clock);
    f.clock.set(firstBuild.readyAt);
    await worker.tick();
    const first = await launchDeathStar(f.db, capital, target.world.id, f.clock);
    const secondBuild = await buildDeathStar(f.db, capital, f.clock);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, target.world.id));
    f.clock.set(first.arriveAt);
    await worker.tick();
    let [struck] = await f.db.select().from(planets).where(eq(planets.id, target.world.id));
    expect(struck?.kind).toBe('NEUTRAL');
    expect(struck?.recoveryUntil).not.toBeNull();
    /**
     * AND A NEUTRAL'S ECONOMY IS ADVANCED BEFORE IT IS HALVED. D113.
     *
     * Nothing else advances a neutral world — its stored row is whatever the last
     * raid or reinforcement left there, and an hour of Death Star build time has
     * passed since. Halving the stale figure would take well over half of what the
     * world actually holds, so the strike advances it first; that is why this is
     * `>=` against half the pre-strike row rather than exactly half of it.
     */
    expect(struck!.alloy).toBeGreaterThanOrEqual(Math.floor(before!.alloy / 2));
    expect(struck!.alloy).toBeGreaterThan(0);
    const halvedAgain = struck!.alloy;

    f.clock.set(secondBuild.readyAt);
    await worker.tick();
    const second = await launchDeathStar(f.db, capital, target.world.id, f.clock);
    f.clock.set(second.arriveAt);
    await worker.tick();
    [struck] = await f.db.select().from(planets).where(eq(planets.id, target.world.id));
    expect(struck).toMatchObject({ kind: 'COLONY', controllerPlayerId: f.joined.playerId, recoveryUntil: null });
    /**
     * HALF OF WHAT WAS LEFT, not half of what there once was — the whole reason
     * the rule is a share rather than a wipe.
     *
     * AT MOST half rather than exactly half, and that is a real interaction worth
     * naming: `advanceNeutralEconomy` clamps a neutral's stock DOWN to its storage
     * cap (player worlds never do this), and the first strike lowered the Core,
     * which pulled the Refinery down with it and shrank that cap. So the second
     * impact halves a figure the smaller store had already trimmed. The exact
     * halving is pinned on player worlds, where nothing clamps: see the damage
     * matrix and the capital case above.
     */
    expect(struck!.alloy * 2).toBeLessThanOrEqual(halvedAgain);
    expect(struck!.alloy).toBeGreaterThan(0);
    const consumed = await f.db.select().from(strategicAssets).where(eq(strategicAssets.status, 'CONSUMED'));
    expect(consumed).toHaveLength(2);
    const inFlight = await f.db.select().from(missions).where(and(
      eq(missions.kind, 'death_star'),
      eq(missions.status, 'in_flight'),
    ));
    expect(inFlight).toHaveLength(0);
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
    await giveUnits(f.db, defender.planetId, { WASP: 5, HAULER: 1 });
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
      .toBe(f.clock.now().getTime() + MULTI_WORLD.recoveryMinutes * 60_000);
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
      destroyedFleet: { WASP: 5, HAULER: 1 },
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
      + fleetValue({ WASP: 5, HAULER: 1 })
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

  it('also requires colony capacity when a Death Star targets an already recovering world', async () => {
    const f = await setup();
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    await setLevel(f.db, f.joined.planetId, 'CORE', 2);
    await f.db.update(planets).set({
      recoveryUntil: new Date(f.clock.now().getTime() + MULTI_WORLD.recoveryMinutes * 60_000),
    }).where(eq(planets.id, target.world.id));
    await f.db.insert(strategicAssets).values({
      planetId: f.joined.planetId,
      status: 'READY',
      startedAt: f.clock.now(),
      remainingSeconds: 0,
    });

    await expect(launchDeathStar(
      f.db,
      f.joined.planetId,
      target.world.id,
      f.clock,
    )).rejects.toMatchObject({ code: 'COLONY_CAP' });
    const [asset] = await f.db.select().from(strategicAssets)
      .where(eq(strategicAssets.planetId, f.joined.planetId));
    expect(asset?.status).toBe('READY');
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
      recoveryUntil: new Date(f.clock.now().getTime() + MULTI_WORLD.recoveryMinutes * 60_000),
    }).where(eq(planets.id, target.world.id));
    f.clock.set(launched.arriveAt);
    await workerFor(f.db, f.clock).tick();

    const [world] = await f.db.select().from(planets).where(eq(planets.id, target.world.id));
    expect(world).toMatchObject({ kind: 'NEUTRAL', controllerPlayerId: null });
    expect(world?.recoveryUntil?.getTime()).toBeGreaterThan(launched.arriveAt.getTime());
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

  it('awards recovery capture to the second attacker and consumes a later protected impact', async () => {
    const f = await setup();
    const secondAccount = await makeAccount(f.db, 'Second Strike');
    const thirdAccount = await makeAccount(f.db, 'Late Strike');
    const defenderAccount = await makeAccount(f.db, 'Colony Holder');
    const second = await joinSeason(f.db, secondAccount.id, f.season.id, f.clock);
    const third = await joinSeason(f.db, thirdAccount.id, f.season.id, f.clock);
    const defender = await joinSeason(f.db, defenderAccount.id, f.season.id, f.clock);
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    await f.db.update(planets).set({
      kind: 'COLONY',
      controllerPlayerId: defender.playerId,
      x: 100,
      y: 0,
      z: 0,
    }).where(eq(planets.id, target.world.id));
    await f.db.delete(neutralPlanetState).where(eq(neutralPlanetState.planetId, target.world.id));

    const launchers = [
      { planetId: f.joined.planetId, x: 0 },
      { planetId: second.planetId, x: 90 },
      { planetId: third.planetId, x: 80 },
    ];
    for (const launcher of launchers) {
      await f.db.update(planets).set({ x: launcher.x, y: 0, z: 0 })
        .where(eq(planets.id, launcher.planetId));
      await setLevel(f.db, launcher.planetId, 'CORE', 6);
      await f.db.insert(strategicAssets).values({
        planetId: launcher.planetId,
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

    const [captured] = await f.db.select().from(planets).where(eq(planets.id, target.world.id));
    expect(captured).toMatchObject({
      kind: 'COLONY',
      controllerPlayerId: second.playerId,
      recoveryUntil: null,
    });
    expect(captured?.protectedUntil?.getTime()).toBeGreaterThan(f.clock.now().getTime());
    const results = await f.db.select().from(notifications).where(and(
      inArray(notifications.playerId, [second.playerId, third.playerId]),
      eq(notifications.kind, 'death_star_result'),
    ));
    expect(results.find((notice) =>
      notice.playerId === second.playerId && notice.refId === secondFlight.missionId,
    )?.payload)
      .toMatchObject({ outcome: 'CAPTURED' });
    expect(results.find((notice) =>
      notice.playerId === third.playerId && notice.refId === lateFlight.missionId,
    )?.payload)
      .toMatchObject({ outcome: 'INEFFECTIVE' });
    // The new owner is also the defender of the late protected impact. Keep that
    // distinct from the result of their own successful rocket: SQL row order is
    // deliberately irrelevant and both events remain independently idempotent.
    expect(results.find((notice) =>
      notice.playerId === second.playerId && notice.refId === lateFlight.missionId,
    )?.payload)
      .toMatchObject({ outcome: 'INEFFECTIVE' });
    expect(await f.db.select().from(strategicAssets)
      .where(eq(strategicAssets.status, 'CONSUMED'))).toHaveLength(3);
  });
});

/**
 * THE ATTACKER'S LADDERS ARE FROZEN ON BOTH BATTLE PATHS. D137.
 *
 * `resolveNeutralBattle` used the mission's snapshot for the combat and re-read the
 * commander's ladders LIVE three lines later for the cargo cap. So the same raid,
 * with Cargo Holds finishing while it was in the air, carried more home from a
 * caretaker world than the identical raid on a player would have — and more than
 * the launch preview quoted, which computes off launch-time tech.
 */
describe('a raid on a caretaker world and the ladders it flew with', () => {
  it('caps the haul with the tech the mission left holding', async () => {
    const f = await setup();
    const capital = f.joined.planetId;
    const target = f.neutrals.find((row) => row.state.tier === 1)!;
    await f.db.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, capital));
    await f.db.update(planets)
      .set({ x: 12, y: 0, z: 0 })
      .where(eq(planets.id, target.world.id));
    await setLevel(f.db, capital, 'SHIPYARD', 6);
    await giveUnits(f.db, capital, { WASP: 80, HAULER: 6 });
    await f.db.update(planets)
      .set({ alloy: 400_000, crystal: 200_000, deuterium: 200_000 })
      .where(eq(planets.id, capital));

    const launched = await launchAttack(
      f.db, capital, target.world.id, { WASP: 80, HAULER: 6 }, f.clock,
    );
    const [mission] = await f.db.select().from(missions)
      .where(eq(missions.id, launched.missionId));
    expect(mission?.tech).toEqual({});

    // The ladder completes mid-flight. It belongs to the next launch, not this one.
    await giveResearch(f.db, capital, 'CARGO_HOLDS', 5);
    // Arrival, then the ten-second engagement window before it settles.
    f.clock.set(launched.arriveAt);
    const w = workerFor(f.db, f.clock);
    await w.tick();
    f.clock.advance(1);
    await w.tick();

    const [report] = await f.db.select().from(battleReports)
      .where(eq(battleReports.targetPlanetId, target.world.id));
    expect(report).toBeTruthy();
    const loot = report!.loot;
    // The report stores losses; what came home is what was sent minus those.
    const sent: Fleet = { WASP: 80, HAULER: 6 };
    const lost = report!.attackerLosses;
    const survivors: Fleet = Object.fromEntries(
      (Object.entries(sent) as [keyof Fleet, number][])
        .map(([hull, count]) => [hull, count - (lost[hull] ?? 0)]),
    );
    const flownWith = fleetCargo(survivors, {});
    const finishedLater = fleetCargo(survivors, { CARGO_HOLDS: 5 });
    expect(finishedLater).toBeGreaterThan(flownWith);
    expect(loot.alloy + loot.crystal + loot.deuterium).toBeLessThanOrEqual(flownWith);
  });
});

/**
 * ONE COMMANDER, ONE GALAXY — AND THE SEAM THAT WROTE THE WRITE DID NOT CHECK IT.
 *
 * The invariant has read "DB-enforced" since D97. `planets` has a unique index for
 * one capital per player and a check tying `kind` to the controller; it has
 * nothing saying a colony must sit in the same season as its owner, and
 * `transferPlanetControl` — the primitive shared by settlement and the second
 * strategic hit — never asked.
 *
 * WHAT THAT PRODUCES IS A WORLD THAT EXISTS AND CANNOT BE SEEN. `commanderTopology`
 * joins on `controllerPlayerId` alone, so a cross-season world lands in
 * `planetIds` and rides out on `/api/planets`: the worlds list offers it and the
 * selector switches to it. `publicWorlds` filters by the caller's season, so the
 * disc never draws it and every surface built on the galaxy payload behaves as
 * though it is not there.
 *
 * Found when a dev tool picked "the nearest unclaimed world" without a season
 * filter — and every season names its neutrals by tier and index, so `Neutral
 * T1-07` exists once per galaxy and the nearest one was in the other shard. The
 * tool was wrong. So was there being nothing here to stop it.
 */
describe('a world in another galaxy', () => {
  it('cannot be handed to a commander who does not play there', async () => {
    const f = await setup();

    // A second galaxy, with its own caretaker worlds and its own commander.
    const { season: elsewhere } = await createSeason(f.db, {
      shardCode: 'EU-OTHER',
      seed: 5150,
      startsAt: f.clock.now(),
      playerCap: SERVERS.capacity,
      rulesetVersion: MULTI_WORLD.rulesetVersion,
    });
    const [foreign] = await f.db
      .select({ id: planets.id })
      .from(planets)
      .where(and(eq(planets.seasonId, elsewhere.id), eq(planets.kind, 'NEUTRAL')))
      .limit(1);
    expect(foreign, 'the second galaxy has caretaker worlds').toBeDefined();

    // The CODE is the contract the client localises against; the message is prose.
    await expect(
      f.db.transaction((tx) => transferPlanetControl(tx, {
        targetPlanetId: foreign!.id,
        newPlayerId: f.joined.playerId,
        expectedControllerPlayerId: null,
        now: f.clock.now(),
        protectedUntil: new Date(f.clock.now().getTime() + 60_000),
      })),
    ).rejects.toMatchObject({ code: 'WRONG_GALAXY' });

    // And it is still a caretaker world, not a half-transferred one.
    const [after] = await f.db
      .select({ kind: planets.kind, owner: planets.controllerPlayerId })
      .from(planets)
      .where(eq(planets.id, foreign!.id));
    expect(after?.kind).toBe('NEUTRAL');
    expect(after?.owner).toBeNull();
  });

  /** The ordinary case still works, or the guard is just breaking settlement. */
  it('still hands over a world in the commander\'s own galaxy', async () => {
    const f = await setup();
    const target = f.neutrals[0]!;

    await f.db.transaction((tx) => transferPlanetControl(tx, {
      targetPlanetId: target.world.id,
      newPlayerId: f.joined.playerId,
      expectedControllerPlayerId: null,
      now: f.clock.now(),
      protectedUntil: new Date(f.clock.now().getTime() + 60_000),
    }));

    const [after] = await f.db
      .select({ kind: planets.kind, owner: planets.controllerPlayerId })
      .from(planets)
      .where(eq(planets.id, target.world.id));
    expect(after?.kind).toBe('COLONY');
    expect(after?.owner).toBe(f.joined.playerId);
  });
});
