import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { HULLS, MULTI_WORLD, type Fleet } from '@astera/rules';
import { hpRadiationSources, missions, monuments, monumentShipLots, monumentWaves, planets, players, radiationSources, scheduledEvents, seasons, units } from '../src/db/schema.js';
import { recomputePlayerWealth } from '../src/services/planet.js';
import { readMonuments } from '../src/services/monumentView.js';
import { launchAttack } from '../src/services/mission.js';
import {
  addRadiationSource,
  addHpRadiationSource,
  endHpRadiationSource,
  endRadiationSource,
  listRadiationSources,
  listHpRadiationSources,
  settleMissionRadiation,
  sourcesForSeason,
} from '../src/services/radiation.js';
import { wipeAllServers } from '../src/services/servers.js';
import { forceSeasonEnd } from '../src/worker/handlers.js';
import { fuelUp, giveUnits, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * RADIATION ON THE SERVER: THE SOURCE ROWS AND THE SETTLEMENT. `plan.md` F9.
 *
 * A source is data an operator writes (K4: no live season has one), and a flight takes
 * its dose when it lands — over its whole path, from each source's own window, with the
 * rules package's one dose function. What a cloud finished leaves `units`; what it only
 * hurt is written on the flight's `damage`.
 */

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

let f: Fixture;
let raider: string;
let target: string;

const ruleset = (version: number) =>
  f.db.update(seasons).set({ rulesetVersion: version }).where(eq(seasons.id, f.seasonId));

const positionOf = async (planetId: string) => {
  const [row] = await f.db.select({ x: planets.x, y: planets.y, z: planets.z }).from(planets)
    .where(eq(planets.id, planetId));
  return row!;
};

const parked = async (planetId: string, location: string): Promise<Fleet> => {
  const rows = await f.db.select().from(units).where(and(eq(units.planetId, planetId), eq(units.location, location)));
  const out: Fleet = {};
  for (const row of rows) if (row.count > 0) out[row.hull] = row.count;
  return out;
};

/** A cloud over the whole lane, dosing `pct` of a full hull across the flight. */
const cloudOver = async (flight: { departAt: Date; arriveAt: Date }, pct: number, over: { activeFrom?: Date } = {}) => {
  const a = await positionOf(raider), b = await positionOf(target);
  const minutes = (flight.arriveAt.getTime() - flight.departAt.getTime()) / 60_000;
  const span = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  return addRadiationSource(f.db, {
    seasonId: f.seasonId,
    anchor: { kind: 'ZONE', at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 } },
    radius: span + 50,
    intensityPctPerMinute: pct / minutes,
    mode: 'EMIT',
    label: 'test cloud',
    ...over,
  }, f.clock);
};

const settle = async (missionId: string) => f.db.transaction(async (tx) => {
  const [row] = await tx.select().from(missions).where(eq(missions.id, missionId));
  return settleMissionRadiation(tx, row!, { storagePlanetId: raider, rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion });
});

beforeEach(async () => {
  f = await seedWorld(2, 30_931);
  [raider, target] = f.planetIds as [string, string];
  await ruleset(MULTI_WORLD.shipDamageRulesetVersion);
  for (const id of f.planetIds) await setLevel(f.db, id, 'SHIPYARD', 4);
  await fuelUp(f.db, raider);
});

describe('a radiation source', () => {
  it('refuses percentage sources in a fixed-HP season instead of accepting an ineffective cloud', async () => {
    await ruleset(16);
    await expect(addRadiationSource(f.db, { seasonId: f.seasonId, anchor: { kind: 'ZONE', at: { x: 0, y: 0, z: 0 } },
      radius: 1000, intensityPctPerMinute: 1, mode: 'EMIT', label: 'wrong model' }, f.clock)).rejects.toMatchObject({ code: 'RADIATION_UNAVAILABLE' });
    expect(await listRadiationSources(f.db, f.seasonId)).toEqual([]);
  });

  it('refuses backdating or an already-ended HP source without rewriting historical exposure', async () => {
    await ruleset(16);
    const base = { seasonId: f.seasonId, anchor: { kind: 'ZONE' as const, at: { x: 0, y: 0, z: 0 } },
      radius: 1000, intensityHpPerMinute: 4, mode: 'EMIT' as const, label: 'historical' };
    await expect(addHpRadiationSource(f.db, { ...base, activeFrom: new Date(f.clock.now().getTime() - 120 * 60_000) }, f.clock))
      .rejects.toMatchObject({ code: 'RADIATION_BAD_SOURCE' });
    await expect(addHpRadiationSource(f.db, { ...base, activeUntil: f.clock.now() }, f.clock))
      .rejects.toMatchObject({ code: 'RADIATION_BAD_SOURCE' });
    expect(await listHpRadiationSources(f.db, f.seasonId)).toEqual([]);
  });

  it('schedules the first HOLD casualty when an operator adds a cloud without charging time before its creation', async () => {
    await ruleset(16);
    const [m] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
      capacity: 7270, productionPerMinute: 10, controllerPlayerId: f.playerIds[0]!, settledAt: f.clock.now() }).returning();
    const id = randomUUID();
    await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: m!.id, playerId: f.playerIds[0]!,
      originPlanetId: raider, unitLocation: `monument:${id}`, purpose: 'ATTACK', sentFleet: { DART: 1 }, tech: {}, route: [],
      status: 'HOLD', sentAt: f.clock.now(), heldAt: f.clock.now(), radiationSettledAt: f.clock.now(), fuelPaid: 0 });
    await f.db.insert(monumentShipLots).values({ waveId: id, hull: 'DART', count: 1, damageBp: 0, remainderBp: 0, deuterium: 0 });
    await giveUnits(f.db, raider, { DART: 1 }, `monument:${id}`);
    f.clock.advance(120);
    const cloud = await addHpRadiationSource(f.db, { seasonId: f.seasonId, anchor: { kind: 'MONUMENT', monumentId: m!.id },
      radius: 1000, intensityHpPerMinute: 100, mode: 'EMIT', label: 'new hazard' }, f.clock);
    const events = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.kind, 'monument_loss'), eq(scheduledEvents.status, 'pending')));
    expect(events).toHaveLength(1);
    expect(events[0]?.resolveAt.getTime()).toBe(f.clock.now().getTime() + Math.ceil(HULLS.DART.hp / 100 * 60_000));
    expect((await f.db.select().from(monumentShipLots))[0]).toMatchObject({ count: 1, damageBp: 0, remainderBp: 0 });
    await endHpRadiationSource(f.db, cloud.id, f.clock);
    expect(await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.kind, 'monument_loss'), eq(scheduledEvents.status, 'pending')))).toEqual([]);
  });

  it('keeps HP source history separate, supports monument anchors, and refuses ruleset 15', async () => {
    await ruleset(16);
    const [monument] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
      capacity: 7270, productionPerMinute: 10, settledAt: f.clock.now() }).returning();
    const row = await addHpRadiationSource(f.db, {
      seasonId: f.seasonId, anchor: { kind: 'MONUMENT', monumentId: monument!.id },
      radius: 1000, intensityHpPerMinute: 4, mode: 'EMIT', label: 'approved',
    }, f.clock);
    expect(row).toMatchObject({ anchorKind: 'MONUMENT', anchorId: monument!.id, radius: 1000, intensityHpPerMinute: 4 });
    await endHpRadiationSource(f.db, row.id, f.clock);
    expect((await listHpRadiationSources(f.db, f.seasonId))[0]?.activeUntil).toEqual(f.clock.now());
    expect(await f.db.select().from(radiationSources)).toEqual([]);
    await ruleset(15);
    await expect(addHpRadiationSource(f.db, {
      seasonId: f.seasonId, anchor: { kind: 'ZONE', at: { x: 0, y: 0, z: 0 } },
      radius: 1000, intensityHpPerMinute: 4, mode: 'EMIT', label: '',
    }, f.clock)).rejects.toMatchObject({ code: 'RADIATION_UNAVAILABLE' });
    expect(await f.db.select().from(hpRadiationSources)).toHaveLength(1);
  });

  it('cancels a future HP source without a negative window, damage or a surviving loss timer', async () => {
    await ruleset(16);
    const from = new Date(f.clock.now().getTime() + 60 * 60_000);
    const cloud = await addHpRadiationSource(f.db, { seasonId: f.seasonId,
      anchor: { kind: 'ZONE', at: { x: 6000, y: 0, z: 0 } }, radius: 1000, mode: 'EMIT',
      intensityHpPerMinute: 100, label: 'future', activeFrom: from }, f.clock);
    const cancelled = await endHpRadiationSource(f.db, cloud.id, f.clock);
    expect(cancelled.activeUntil).toEqual(from);
    f.clock.advance(70);
    expect(await endHpRadiationSource(f.db, cloud.id, f.clock)).toEqual(cancelled);
    expect(await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, 'monument_loss'))).toEqual([]);
  });

  it('settles exposure before an operator ends the source and preserves that wound on subsequent reads', async () => {
    await ruleset(16);
    const [target] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
      capacity: 7270, productionPerMinute: 10, controllerPlayerId: f.playerIds[0]!, settledAt: f.clock.now() }).returning();
    const id = randomUUID();
    await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: target!.id, playerId: f.playerIds[0]!,
      originPlanetId: raider, unitLocation: `monument:${id}`, purpose: 'ATTACK', sentFleet: { DART: 1 }, tech: {}, route: [],
      status: 'HOLD', sentAt: f.clock.now(), heldAt: f.clock.now(), radiationSettledAt: f.clock.now(), fuelPaid: 0 });
    await f.db.insert(monumentShipLots).values({ waveId: id, hull: 'DART', count: 1, damageBp: 0, remainderBp: 0, deuterium: 0 });
    await giveUnits(f.db, raider, { DART: 1 }, `monument:${id}`);
    const cloud = await addHpRadiationSource(f.db, { seasonId: f.seasonId,
      anchor: { kind: 'MONUMENT', monumentId: target!.id }, radius: 1000, mode: 'EMIT', intensityHpPerMinute: 4, label: 'ten minutes' }, f.clock);
    f.clock.advance(10);
    await endHpRadiationSource(f.db, cloud.id, f.clock);
    const before = await f.db.select().from(monumentShipLots);
    expect((before[0]!.damageBp + before[0]!.remainderBp) * HULLS.DART.hp / 10_000).toBeCloseTo(40, 10);
    expect(await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.kind, 'monument_loss'), eq(scheduledEvents.status, 'pending')))).toEqual([]);
    f.clock.advance(5);
    const view = await f.db.transaction((tx) => readMonuments(tx, { playerId: f.playerIds[0]!, seasonId: f.seasonId, at: f.clock.now(), adminUsernames: [] }));
    expect(view.waves[0]?.lots[0]?.remainingHp).toBeCloseTo(HULLS.DART.hp - 40, 10);
    expect(view.waves[0]?.returnForecast).toMatchObject({ doseHp: 0, destroyed: 0 });
    expect(await f.db.select().from(monumentShipLots)).toEqual(before);
  });

  it('stands on a world\'s centre, or on a point in space', async () => {
    const world = await addRadiationSource(f.db, {
      seasonId: f.seasonId, anchor: { kind: 'PLANET', planetId: target },
      radius: 20, intensityPctPerMinute: 0.5, mode: 'EMIT', label: 'on the world',
    }, f.clock);
    expect(world).toMatchObject({ anchorKind: 'PLANET', anchorId: target, ...(await positionOf(target)) });
    const zone = await addRadiationSource(f.db, {
      seasonId: f.seasonId, anchor: { kind: 'ZONE', at: { x: 1, y: 2, z: 3 } },
      radius: 5, intensityPctPerMinute: 0, mode: 'SHELTER', label: 'shelter',
    }, f.clock);
    expect(zone).toMatchObject({ anchorKind: 'ZONE', anchorId: null, x: 1, y: 2, z: 3, mode: 'SHELTER' });
    expect(zone.activeFrom).toEqual(f.clock.now());
    expect(zone.activeUntil).toBeNull();
  });

  it('is refused in a season dealt before ship damage', async () => {
    await ruleset(13);
    await expect(addRadiationSource(f.db, {
      seasonId: f.seasonId, anchor: { kind: 'ZONE', at: { x: 0, y: 0, z: 0 } },
      radius: 5, intensityPctPerMinute: 1, mode: 'EMIT', label: '',
    }, f.clock)).rejects.toMatchObject({ code: 'RADIATION_UNAVAILABLE' });
  });

  it('is refused when it cannot exist, or names a world of another season', async () => {
    const base = { seasonId: f.seasonId, anchor: { kind: 'ZONE' as const, at: { x: 0, y: 0, z: 0 } }, mode: 'EMIT' as const, label: '' };
    for (const bad of [{ radius: 0, intensityPctPerMinute: 1 }, { radius: 5, intensityPctPerMinute: -1 },
      { radius: Number.NaN, intensityPctPerMinute: 1 }]) {
      await expect(addRadiationSource(f.db, { ...base, ...bad }, f.clock)).rejects.toMatchObject({ code: 'RADIATION_BAD_SOURCE' });
    }
    await expect(addRadiationSource(f.db, {
      ...base, radius: 5, intensityPctPerMinute: 1, anchor: { kind: 'PLANET', planetId: '00000000-0000-0000-0000-000000000000' },
    }, f.clock)).rejects.toMatchObject({ code: 'RADIATION_BAD_SOURCE' });
  });

  it('ends without being deleted, and stays ended at the moment it first ended', async () => {
    const row = await addRadiationSource(f.db, {
      seasonId: f.seasonId, anchor: { kind: 'ZONE', at: { x: 0, y: 0, z: 0 } },
      radius: 5, intensityPctPerMinute: 1, mode: 'EMIT', label: '',
    }, f.clock);
    const first = f.clock.now();
    await endRadiationSource(f.db, row.id, f.clock);
    f.clock.advance(60);
    await endRadiationSource(f.db, row.id, f.clock);
    const [ended] = await listRadiationSources(f.db, f.seasonId);
    expect(ended?.activeUntil).toEqual(first);
    await expect(endRadiationSource(f.db, '00000000-0000-0000-0000-000000000000', f.clock))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('reads as the rules package\'s source', async () => {
    const row = await addRadiationSource(f.db, {
      seasonId: f.seasonId, anchor: { kind: 'ZONE', at: { x: 4, y: 5, z: 6 } },
      radius: 7, intensityPctPerMinute: 1.5, mode: 'EMIT', label: '',
    }, f.clock);
    const sources = await f.db.transaction((tx) => sourcesForSeason(tx, f.seasonId));
    expect(sources).toEqual([{
      id: row.id, mode: 'EMIT', center: { x: 4, y: 5, z: 6 }, radius: 7, intensityPctPerMinute: 1.5,
      activeFromMs: f.clock.now().getTime(), activeUntilMs: null,
    }]);
  });

  it('goes with the galaxy when it is wiped', async () => {
    await addRadiationSource(f.db, {
      seasonId: f.seasonId, anchor: { kind: 'ZONE', at: { x: 0, y: 0, z: 0 } },
      radius: 5, intensityPctPerMinute: 1, mode: 'EMIT', label: '',
    }, f.clock);
    await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
    await wipeAllServers(f.db, f.clock, { count: 1, capacity: 4 });
    expect(await f.db.select().from(radiationSources)).toEqual([]);
  });
});

describe('a flight settling its dose', () => {
  it('writes what a cloud hurt on the flight, and leaves every ship flying', async () => {
    await giveUnits(f.db, raider, { DART: 3 });
    const launch = await launchAttack(f.db, raider, target, { DART: 3 }, f.clock);
    const [flight] = await f.db.select().from(missions).where(eq(missions.id, launch.missionId));
    await cloudOver(flight!, 30);

    const settled = await settle(launch.missionId);

    expect(settled.destroyed).toEqual({});
    expect(settled.mission.damage).toEqual([{ hull: 'DART', count: 3, damageBp: 3000 }]);
    const [row] = await f.db.select().from(missions).where(eq(missions.id, launch.missionId));
    expect(row?.damage).toEqual([{ hull: 'DART', count: 3, damageBp: 3000 }]);
    expect(await parked(raider, launch.missionId)).toEqual({ DART: 3 });
  });

  it('takes the ships a cloud finished out of `units` and off the flight', async () => {
    await giveUnits(f.db, raider, { DART: 3 });
    const launch = await launchAttack(f.db, raider, target, { DART: 3 }, f.clock);
    const [flight] = await f.db.select().from(missions).where(eq(missions.id, launch.missionId));
    await cloudOver(flight!, 150);

    const settled = await settle(launch.missionId);

    expect(settled.destroyed).toEqual({ DART: 3 });
    expect(settled.fleet).toEqual({});
    expect(await parked(raider, launch.missionId)).toEqual({});
    const [row] = await f.db.select().from(missions).where(eq(missions.id, launch.missionId));
    expect(row?.fleet).toEqual({});
    expect(row?.damage).toBeNull();
  });

  /** Wealth counts the ships a commander owns; the ones a cloud finished are not owned any more. */
  it('takes the ships it finished out of the commander\'s wealth at once', async () => {
    await giveUnits(f.db, raider, { DART: 3 });
    const launch = await launchAttack(f.db, raider, target, { DART: 3 }, f.clock);
    const [flight] = await f.db.select().from(missions).where(eq(missions.id, launch.missionId));
    await f.db.transaction((tx) => recomputePlayerWealth(tx, f.playerIds[0]!));
    const wealth = async () =>
      (await f.db.select({ wealth: players.wealth }).from(players).where(eq(players.id, f.playerIds[0]!)))[0]!.wealth;
    const before = await wealth();
    await cloudOver(flight!, 150);

    await settle(launch.missionId);

    expect(await wealth()).toBeLessThan(before);
  });

  it('takes nothing where no cloud stood while it flew, or before the rule', async () => {
    await giveUnits(f.db, raider, { DART: 3 });
    const launch = await launchAttack(f.db, raider, target, { DART: 3 }, f.clock);
    const [flight] = await f.db.select().from(missions).where(eq(missions.id, launch.missionId));
    // Lit only after the ships were down.
    await cloudOver(flight!, 150, { activeFrom: new Date(flight!.arriveAt.getTime() + 60_000) });
    expect((await settle(launch.missionId)).destroyed).toEqual({});

    await cloudOver(flight!, 150);
    const before = await f.db.transaction(async (tx) => {
      const [row] = await tx.select().from(missions).where(eq(missions.id, launch.missionId));
      return settleMissionRadiation(tx, row!, { storagePlanetId: raider, rulesetVersion: 13 });
    });
    expect(before.destroyed).toEqual({});
    expect(await parked(raider, launch.missionId)).toEqual({ DART: 3 });
  });
});
