import { pino } from 'pino';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  HULLS,
  MULTI_WORLD,
  SERVERS,
  deuteriumStorageCap,
  crystalRate,
  upgradeCost,
  DEATH_STAR,
} from '@astera/rules';
import {
  battleReports,
  buildings,
  debrisFields,
  galaxyEvents,
  missions,
  neutralPlanetState,
  notifications,
  planetResearch,
  planets,
  players,
  satellites,
  seasons,
  strategicAssets,
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
import { reinforceNeutral } from '../src/services/neutral.js';
import { colonyStanding } from '../src/services/ownership.js';
import { listServers } from '../src/services/servers.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  FixedClock,
} from '../src/clock.js';
import {
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

describe('ruleset v2 worlds', () => {
  beforeEach(async () => {
    const { db } = await testDb();
    await truncateAll(db);
  });

  it('creates the deterministic fixed 30/15/6 pool outside all capital slots', async () => {
    const f = await setup();
    expect(f.season.rulesetVersion).toBe(2);
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
      const expected = deuteriumStorageCap(
        crystalRate(template.buildings.EXTRACTOR),
        template.buildings.VAULT,
      );
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
    expect(state?.claimUntil?.getTime()).toBe(f.clock.now().getTime() + MULTI_WORLD.claimMinutes * 60_000);
    expect(report).toMatchObject({
      grade: 'DECISIVE',
      defenderPlayerId: null,
      targetKind: 'NEUTRAL',
      cargoLimited: true,
    });
    expect(player?.dominionTaken).toBe(0);
    expect(player?.dominionLost).toBe(0);
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
    for (const type of ['CORE', 'REFINERY', 'EXTRACTOR', 'SHIPYARD'] as const) {
      await setLevel(f.db, target.world.id, type, 6);
    }
    await setLevel(f.db, target.world.id, 'VAULT', 5);
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
    await f.db.insert(planetResearch).values({
      planetId: target.world.id,
      projectId: 'ISOTOPE_SPECTROMETRY',
      completedAt: f.clock.now(),
    });
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
    expect(struck).toMatchObject({
      alloy: 0,
      crystal: 0,
      deuterium: 0,
      bufferAlloy: 0,
      bufferCrystal: 0,
      bufferDeuterium: 0,
      shield: 0,
      disruptedUntil: null,
    });
    expect(struck?.recoveryUntil).not.toBeNull();
    const levels = Object.fromEntries((await f.db.select().from(buildings)
      .where(eq(buildings.planetId, target.world.id))).map((row) => [row.type, row.level]));
    expect(levels).toMatchObject({ CORE: 5, REFINERY: 5, EXTRACTOR: 5, SHIPYARD: 5, VAULT: 5 });
    const hardware = Object.fromEntries((await f.db.select().from(satellites)
      .where(eq(satellites.planetId, target.world.id))).map((row) => [row.type, row.level]));
    expect(hardware).toMatchObject({ AEGIS: 3, TELESCOPE: 3, RADAR: 2, UPLINK: 1 });
    const survivors = await f.db.select().from(units).where(eq(units.planetId, target.world.id));
    expect(survivors.map((row) => [row.hull, row.location, row.count]).sort()).toEqual([
      ['PROSPECTOR', 'mining-away', 1],
      ['WASP', 'mining-away', 1],
    ]);
    expect(await f.db.select().from(planetResearch)
      .where(eq(planetResearch.planetId, target.world.id))).toHaveLength(1);
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
    await f.db.update(planets).set({ x: 0, y: 0, z: 0, alloy: 100_000, crystal: 50_000, deuterium: 10_000 })
      .where(eq(planets.id, capital));
    await f.db.update(planets).set({ x: 20, y: 0, z: 0 }).where(eq(planets.id, target.world.id));
    await setLevel(f.db, capital, 'CORE', 6);
    await setLevel(f.db, capital, 'SHIPYARD', 5);
    await f.db.insert(planetResearch).values([
      { planetId: capital, projectId: 'GRAVITIC_CHARGES', completedAt: f.clock.now() },
      { planetId: capital, projectId: 'DEATH_STAR_PROTOCOL', completedAt: f.clock.now() },
    ]);
    const worker = workerFor(f.db, f.clock);

    const firstBuild = await buildDeathStar(f.db, capital, f.clock);
    f.clock.set(firstBuild.readyAt);
    await worker.tick();
    const first = await launchDeathStar(f.db, capital, target.world.id, f.clock);
    const secondBuild = await buildDeathStar(f.db, capital, f.clock);
    f.clock.set(first.arriveAt);
    await worker.tick();
    let [struck] = await f.db.select().from(planets).where(eq(planets.id, target.world.id));
    expect(struck?.kind).toBe('NEUTRAL');
    expect(struck?.recoveryUntil).not.toBeNull();

    f.clock.set(secondBuild.readyAt);
    await worker.tick();
    const second = await launchDeathStar(f.db, capital, target.world.id, f.clock);
    f.clock.set(second.arriveAt);
    await worker.tick();
    [struck] = await f.db.select().from(planets).where(eq(planets.id, target.world.id));
    expect(struck).toMatchObject({ kind: 'COLONY', controllerPlayerId: f.joined.playerId, recoveryUntil: null });
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
    await setLevel(f.db, capital, 'CORE', 6);
    await setLevel(f.db, capital, 'SHIPYARD', 5);
    await f.db.insert(planetResearch).values({
      planetId: capital,
      projectId: 'DEATH_STAR_PROTOCOL',
      completedAt: f.clock.now(),
    });

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
    await f.db.insert(planetResearch).values({
      planetId: capital,
      projectId: 'DEATH_STAR_PROTOCOL',
      completedAt: f.clock.now(),
    });
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
      alloy: 0,
      crystal: 0,
      deuterium: 0,
    });
    expect(struck?.recoveryUntil?.getTime()).toBeGreaterThan(launched.arriveAt.getTime());
    const [core] = await f.db.select().from(buildings).where(and(
      eq(buildings.planetId, defender.planetId),
      eq(buildings.type, 'CORE'),
    ));
    expect(core?.level).toBe(4);
    expect(await f.db.select().from(units).where(eq(units.planetId, defender.planetId))).toEqual([]);
    const [impact] = await f.db.select().from(galaxyEvents).where(and(
      eq(galaxyEvents.kind, 'death_star_impact'),
      eq(galaxyEvents.refId, launched.missionId),
    ));
    expect(impact?.payload).toMatchObject({
      outcome: 'FIRST_STRIKE',
      capturable: false,
    });
    const [asset] = await f.db.select().from(strategicAssets)
      .where(eq(strategicAssets.planetId, f.joined.planetId));
    expect(asset?.status).toBe('CONSUMED');
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
