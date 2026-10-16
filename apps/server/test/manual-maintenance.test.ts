import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { fleetCount, HULLS } from '@astera/rules';
import { battleReports, hpRadiationSources, missions, planets, seasons, units } from '../src/db/schema.js';
import { pino } from 'pino';
import { EventWorker } from '../src/worker/loop.js';
import { readHomeHealth, takeHomeHealth, writeHomeHealth } from '../src/services/homeHealth.js';
import { setUnits, totalUnitsOf } from '../src/services/planet.js';
import { dockLotsOf, landHpShips } from '../src/services/shipDamage.js';
import { launchTransfer } from '../src/services/movement.js';
import { launchAttack } from '../src/services/mission.js';
import { fuelUp, grant, levelWorld, giveUnits, seedWorld, settledAt, testDb, type Fixture } from './helpers.js';

describe('manual maintenance inventory', () => {
  let f: Fixture;
  let world: string;
  let owner: string;
  beforeEach(async () => {
    f = await seedWorld(2, 131026);
    world = f.planetIds[0]!;
    owner = f.playerIds[0]!;
    await giveUnits(f.db, world, { DART: 2 });
  });
  afterAll(async () => { await (await testDb()).close(); });

  it('stores only canonical health metadata when a landing carries monument provenance and cargo fields', async () => {
    const carried = { hull: 'DART' as const, count: 1, damageBp: 1000, remainderBp: 0.25,
      id: 'old-monument-lot', waveId: 'old-wave', deuterium: 25, tech: { SHIP_ARMOR: 5 } };
    await f.db.transaction(tx => landHpShips(tx, { planetId: world, ownerPlayerId: owner,
      fleet: { DART: 1 }, damage: [carried], at: f.clock.now() }));
    const [row] = await f.db.select().from(units).where(and(eq(units.planetId, world), eq(units.location, 'home'), eq(units.hull, 'DART')));
    expect(row?.damage).toEqual([{ hull: 'DART', count: 1, damageBp: 1000, remainderBp: 0.25 }]);
  });

  it('keeps every surviving landing at home, including tiny wounds and former auto-dock damage', async () => {
    const damage = [{ hull: 'DART' as const, count: 1, damageBp: 0, remainderBp: 0.125 },
      { hull: 'DART' as const, count: 2, damageBp: 6000, remainderBp: 0.25 }];
    const before = fleetCount(await totalUnitsOf(f.db, world));
    const report = await f.db.transaction((tx) => landHpShips(tx, {
      planetId: world, ownerPlayerId: owner, fleet: { DART: 3 }, damage, at: f.clock.now(),
    }));
    expect(report).toEqual({ autoRepaired: [], docked: [] });
    expect(await dockLotsOf(f.db, world)).toEqual([]);
    const health = await readHomeHealth(f.db, world);
    expect(health.fleet.DART).toBe(5);
    expect(health.damage).toEqual([damage[1], damage[0]]);
    expect(fleetCount(await totalUnitsOf(f.db, world))).toBe(before + 3);
  });

  it('merges identical wounds across landings and leaves new healthy ships healthy', async () => {
    for (let n = 0; n < 2; n += 1) await f.db.transaction((tx) => landHpShips(tx, {
      planetId: world, ownerPlayerId: owner, fleet: { DART: 2 },
      damage: [{ hull: 'DART', count: 1, damageBp: 500, remainderBp: 0.5 }], at: f.clock.now(),
    }));
    expect(await readHomeHealth(f.db, world)).toEqual({ fleet: { DART: 6 },
      damage: [{ hull: 'DART', count: 2, damageBp: 500, remainderBp: 0.5 }] });
  });

  it('does not rewrite unchanged home health rows when only another hull changes', async () => {
    await giveUnits(f.db, world, { CITADEL: 1 });
    const revision = () => f.db.select({ revision: sql<string>`xmin::text` }).from(units)
      .where(and(eq(units.planetId, world), eq(units.hull, 'CITADEL'), eq(units.location, 'home')));
    const [before] = await revision();
    const home = await readHomeHealth(f.db, world);
    await f.db.transaction(tx => writeHomeHealth(tx, world, home.fleet,
      [{ hull: 'DART', count: 1, damageBp: 1000, remainderBp: 0.25 }]));
    expect((await revision())[0]?.revision).toBe(before?.revision);
    expect((await readHomeHealth(f.db, world)).damage).toEqual([{ hull: 'DART', count: 1, damageBp: 1000, remainderBp: 0.25 }]);
  });

  it('takes a partial launch with wounds and rolls back metadata if the launch fails', async () => {
    await f.db.transaction((tx) => landHpShips(tx, { planetId: world, ownerPlayerId: owner,
      fleet: { DART: 3 }, damage: [{ hull: 'DART', count: 3, damageBp: 1000, remainderBp: 0.75 }], at: f.clock.now() }));
    await expect(f.db.transaction(async (tx) => {
      await takeHomeHealth(tx, world, { DART: 4 });
      throw new Error('abort dispatch');
    })).rejects.toThrow('abort dispatch');
    expect((await readHomeHealth(f.db, world)).damage[0]?.count).toBe(3);
    const selected = await f.db.transaction(async (tx) => {
      const result = await takeHomeHealth(tx, world, { DART: 4 });
      await setUnits(tx, world, { DART: 1 }, 'home', owner);
      return result;
    });
    expect(selected).toEqual([{ hull: 'DART', count: 2, damageBp: 1000, remainderBp: 0.75 }]);
    expect((await readHomeHealth(f.db, world)).damage[0]?.count).toBe(1);
    const rows = await f.db.select().from(units).where(and(eq(units.planetId, world), eq(units.location, 'home')));
    expect(rows.find((row) => row.hull === 'DART')?.count).toBe(1);
  });

  it('carries real home wounds onto a transfer, including ships unable to fight', async () => {
    const target = f.planetIds[1]!;
    await levelWorld(f.db, f.planetIds);
    await grant(f.db, world, 200_000, 60_000);
    await fuelUp(f.db, world, 200_000);
    await f.db.update(planets).set({ controllerPlayerId: owner, kind: 'COLONY' }).where(eq(planets.id, target));
    await f.db.transaction((tx) => landHpShips(tx, { planetId: world, ownerPlayerId: owner,
      fleet: { DART: 2 }, damage: [{ hull: 'DART', count: 2, damageBp: 9700, remainderBp: 0.25 }], at: f.clock.now() }));
    const flight = await launchTransfer(f.db, owner, world, target, { DART: 4 }, { alloy: 0, crystal: 0, deuterium: 0 }, f.clock);
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, flight.missionId));
    expect(mission?.damage).toEqual([{ hull: 'DART', count: 2, damageBp: 9700, remainderBp: 0.25 }]);
    expect((await readHomeHealth(f.db, world)).damage).toEqual([]);
  });

  it('refuses a combat dispatch that would need a critically wounded home ship', async () => {
    await levelWorld(f.db, f.planetIds);
    await grant(f.db, world, 200_000, 60_000);
    await fuelUp(f.db, world, 200_000);
    await f.db.transaction((tx) => landHpShips(tx, { planetId: world, ownerPlayerId: owner,
      fleet: { DART: 1 }, damage: [{ hull: 'DART', count: 1, damageBp: 9500 }], at: f.clock.now() }));
    await expect(launchAttack(f.db, world, f.planetIds[1]!, { DART: 3 }, f.clock, owner))
      .rejects.toMatchObject({ code: 'NOT_ENOUGH_COMBAT_READY_SHIPS' });
    expect((await readHomeHealth(f.db, world)).fleet.DART).toBe(3);
    expect(await f.db.select().from(missions).where(eq(missions.originPlanetId, world))).toEqual([]);
  });

  it('warns before a transfer whose radiation is lethal only to its already wounded ships', async () => {
    const target = f.planetIds[1]!;
    await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
    await levelWorld(f.db, f.planetIds);
    await fuelUp(f.db, world, 200_000);
    await f.db.update(planets).set({ controllerPlayerId: owner, kind: 'COLONY', x: 1000, y: 0, z: 0 }).where(eq(planets.id, target));
    await f.db.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, world));
    await f.db.transaction(tx => landHpShips(tx, { planetId: world, ownerPlayerId: owner,
      fleet: { DART: 2 }, damage: [{ hull: 'DART', count: 2, damageBp: 9700, remainderBp: 0.25 }], at: f.clock.now() }));
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'ZONE', x: 0, y: 0, z: 0,
      radius: 100_000, mode: 'EMIT', intensityHpPerMinute: HULLS.DART.hp * 0.03, activeFrom: f.clock.now() });
    await expect(launchTransfer(f.db, owner, world, target, { DART: 4 },
      { alloy: 0, crystal: 0, deuterium: 0 }, f.clock)).rejects.toMatchObject({ code: 'RADIATION_LETHAL', params: { count: 2 } });
    expect(await f.db.select().from(missions).where(eq(missions.originPlanetId, world))).toEqual([]);
  });

  it('keeps critically wounded home ships and their wounds outside an enemy raid', async () => {
    const target = f.planetIds[1]!;
    await f.db.update(seasons).set({ rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
    await levelWorld(f.db, f.planetIds);
    await fuelUp(f.db, world);
    await giveUnits(f.db, world, { DART: 100 });
    await f.db.transaction((tx) => landHpShips(tx, { planetId: target, ownerPlayerId: f.playerIds[1]!,
      fleet: { DART: 3 }, damage: [{ hull: 'DART', count: 2, damageBp: 9500, remainderBp: 0.25 }], at: f.clock.now() }));
    const launched = await launchAttack(f.db, world, target, { DART: 100 }, f.clock, owner);
    f.clock.set(settledAt(launched.arriveAt));
    const worker = new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));
    await worker.tick();
    const health = await readHomeHealth(f.db, target);
    expect(health.fleet.DART).toBe(2);
    expect(health.damage).toEqual([{ hull: 'DART', count: 2, damageBp: 9500, remainderBp: 0.25 }]);
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launched.missionId));
    expect(report?.defenderLosses.DART).toBe(1);
    expect(await dockLotsOf(f.db, target)).toEqual([]);
  });
});
