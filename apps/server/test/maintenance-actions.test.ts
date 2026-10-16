import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { HULLS } from '@astera/rules';
import { buildOrders, hpRadiationSources, planets, requestLog, seasons, units } from '../src/db/schema.js';
import { startRepair } from '../src/services/repair.js';
import { applyBuildCompletion } from '../src/services/buildQueue.js';
import { readHomeHealth } from '../src/services/homeHealth.js';
import { maintenanceAction } from '../src/services/maintenance.js';
import { dockLotsOf, landHpShips } from '../src/services/shipDamage.js';
import { grant, giveUnits, seedWorld, testDb, type Fixture } from './helpers.js';

describe('explicit workshop actions', () => {
  let f: Fixture;
  let world: string;
  let owner: string;
  beforeEach(async () => {
    f = await seedWorld(2, 131027);
    world = f.planetIds[0]!;
    owner = f.playerIds[0]!;
    await giveUnits(f.db, world, { DART: 3 });
    await f.db.transaction((tx) => landHpShips(tx, { planetId: world, ownerPlayerId: owner,
      fleet: { DART: 4 }, damage: [{ hull: 'DART', count: 4, damageBp: 100, remainderBp: 0.25 }], at: f.clock.now() }));
  });
  afterAll(async () => { await (await testDb()).close(); });
  const home = (count: number, damageBp = 100, remainderBp = 0.25) => ({ source: 'HOME' as const,
    groups: [{ hull: 'DART' as const, count, damageBp, remainderBp }] });
  const act = (action: 'DOCK' | 'RETURN' | 'SCRAP', selection: Parameters<typeof maintenanceAction>[4], key = randomUUID()) =>
    maintenanceAction(f.db, owner, world, action, selection, key, f.clock);

  it('docks only the selected quantity for free and can return part of it without healing', async () => {
    const [before] = await f.db.select().from(planets).where(eq(planets.id, world));
    await act('DOCK', home(3));
    const [lot] = await dockLotsOf(f.db, world);
    expect(lot).toMatchObject({ count: 3, damageBp: 100, remainderBp: 0.25, repairing: false });
    expect((await readHomeHealth(f.db, world)).damage[0]?.count).toBe(1);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, world));
    expect(after?.alloy).toBe(before?.alloy);
    await act('RETURN', { source: 'DOCK', lots: [{ id: lot!.id, count: 2 }] });
    expect((await dockLotsOf(f.db, world))[0]?.count).toBe(1);
    expect((await readHomeHealth(f.db, world)).damage[0]?.count).toBe(3);
  });

  it('scraps healthy home ships and credits half their recipe once across retries', async () => {
    const key = randomUUID();
    const [before] = await f.db.select().from(planets).where(eq(planets.id, world));
    const first = await act('SCRAP', home(2, 0, 0), key);
    const replay = await act('SCRAP', home(2, 0, 0), key);
    expect(first).toEqual(replay);
    expect(first.returned.alloy).toBe(HULLS.DART.alloy);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, world));
    expect(after!.alloy - before!.alloy).toBe(HULLS.DART.alloy);
    expect((await readHomeHealth(f.db, world)).fleet.DART).toBe(5);
  });

  it('stores only the immutable scrap receipt and reads current planet state on a retry', async () => {
    const key = randomUUID();
    await act('SCRAP', home(1, 0, 0), key);
    const [receipt] = await f.db.select().from(requestLog).where(eq(requestLog.idempotencyKey, key));
    expect(receipt?.response).toEqual({ returned: { alloy: Math.floor(HULLS.DART.alloy / 2),
      crystal: Math.floor(HULLS.DART.crystal / 2), deuterium: Math.floor(HULLS.DART.deuterium / 2) } });
    await f.db.update(planets).set({ alloy: 12345 }).where(eq(planets.id, world));
    const replay = await act('SCRAP', home(1, 0, 0), key);
    expect(replay.planet.planet.alloy).toBe(12345);
    expect((await readHomeHealth(f.db, world)).fleet.DART).toBe(6);
  });

  it('allows only one concurrent scrap to consume the same remaining cohort', async () => {
    const outcomes = await Promise.allSettled([act('SCRAP', home(4)), act('SCRAP', home(4))]);
    expect(outcomes.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find((row) => row.status === 'rejected');
    expect(rejected?.status === 'rejected' ? rejected.reason : null).toMatchObject({ code: 'SHIP_SELECTION_CHANGED' });
    expect((await readHomeHealth(f.db, world)).fleet.DART).toBe(3);
  });

  it('rejects healthy docking, stale wounds and another player without moving ships', async () => {
    await expect(act('DOCK', home(1, 0, 0))).rejects.toMatchObject({ code: 'SHIP_NOT_DAMAGED' });
    await expect(act('SCRAP', home(1, 100, 0.5))).rejects.toMatchObject({ code: 'SHIP_SELECTION_CHANGED' });
    await expect(maintenanceAction(f.db, f.playerIds[1]!, world, 'SCRAP', home(1), randomUUID(), f.clock))
      .rejects.toMatchObject({ code: 'PLANET_NOT_OWNED' });
    const [row] = await f.db.select().from(units).where(and(eq(units.planetId, world), eq(units.hull, 'DART'), eq(units.location, 'home')));
    expect(row?.count).toBe(7);
  });

  it('rejects empty repair selections before creating or charging an order', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 14 }).where(eq(seasons.id, f.seasonId));
    for (const request of [{ lots: [] }, { lotIds: [] }]) {
      await expect(startRepair(f.db, world, request, f.clock, owner, randomUUID()))
        .rejects.toMatchObject({ code: 'REPAIR_NOTHING_WAITING' });
    }
    expect(await f.db.select().from(buildOrders).where(eq(buildOrders.planetId, world))).toEqual([]);
  });

  it('rejects direct workshop entry for ground defenses', async () => {
    await giveUnits(f.db, world, { BASTION: 1 });
    await f.db.update(units).set({ damage: [{ hull: 'BASTION', count: 1, damageBp: 1000 }] })
      .where(and(eq(units.planetId, world), eq(units.location, 'home'), eq(units.hull, 'BASTION')));
    await expect(act('DOCK', { source: 'HOME', groups: [{ hull: 'BASTION', count: 1, damageBp: 1000 }] }))
      .rejects.toMatchObject({ code: 'BAD_MAINTENANCE_SELECTION' });
    expect(await dockLotsOf(f.db, world)).toEqual([]);
    expect((await readHomeHealth(f.db, world)).fleet.BASTION).toBe(1);
  });

  it('rejects a dock scrap quote after the same lot has taken more damage', async () => {
    await act('DOCK', home(2));
    const [lot] = await dockLotsOf(f.db, world);
    const { shipDamageLots } = await import('../src/db/schema.js');
    await f.db.update(shipDamageLots).set({ damageBp: 2000 }).where(eq(shipDamageLots.id, lot!.id));
    await expect(act('SCRAP', { source: 'DOCK', lots: [{ id: lot!.id, count: 1,
      damageBp: 100, remainderBp: 0.25 }] })).rejects.toMatchObject({ code: 'SHIP_SELECTION_CHANGED' });
    expect((await dockLotsOf(f.db, world))[0]?.count).toBe(2);
  });

  it('returns selected ships at their current wounds even if radiation has changed the displayed health', async () => {
    await act('DOCK', home(2));
    const [lot] = await dockLotsOf(f.db, world);
    const { shipDamageLots } = await import('../src/db/schema.js');
    await f.db.update(shipDamageLots).set({ damageBp: 9000, remainderBp: 0.75 }).where(eq(shipDamageLots.id, lot!.id));
    await act('RETURN', { source: 'DOCK', lots: [{ id: lot!.id, count: 1, damageBp: 100, remainderBp: 0.25 }] });
    expect((await readHomeHealth(f.db, world)).damage).toContainEqual({ hull: 'DART', count: 1, damageBp: 9000, remainderBp: 0.75 });
    expect((await dockLotsOf(f.db, world))[0]).toMatchObject({ count: 1, damageBp: 9000, remainderBp: 0.75 });
  });

  it('blocks entry, repair and scrap during radiation but leaves dock exit available', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 18, monumentMotionStartsAt: f.clock.now() }).where(eq(seasons.id, f.seasonId));
    await act('DOCK', home(2));
    const [lot] = await dockLotsOf(f.db, world);
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'PLANET', anchorId: world,
      x: 0, y: 0, z: 0, radius: 1, mode: 'EMIT', intensityHpPerMinute: 9, activeFrom: f.clock.now() });
    await expect(act('DOCK', home(1))).rejects.toMatchObject({ code: 'WORKSHOP_RADIATION' });
    await expect(act('SCRAP', home(1))).rejects.toMatchObject({ code: 'WORKSHOP_RADIATION' });
    await expect(startRepair(f.db, world, { lotIds: [lot!.id] }, f.clock, owner)).rejects.toMatchObject({ code: 'WORKSHOP_RADIATION' });
    await expect(act('RETURN', { source: 'DOCK', lots: [{ id: lot!.id, count: 2 }] })).resolves.toBeDefined();
  });

  it('shows workshop availability from effective radiation rather than a sheltered emitter', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 18, monumentMotionStartsAt: f.clock.now() }).where(eq(seasons.id, f.seasonId));
    for (const mode of ['EMIT', 'SHELTER'] as const) await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId,
      anchorKind: 'PLANET', anchorId: world, x: 0, y: 0, z: 0, radius: 1, mode, intensityHpPerMinute: mode === 'EMIT' ? 9 : 0,
      activeFrom: f.clock.now() });
    const { planetView } = await import('../src/services/planetView.js');
    const view = await f.db.transaction((tx) => planetView(tx, world, f.clock));
    expect(view.workshopRadiation).toBe(false);
    await expect(act('DOCK', home(1))).resolves.toBeDefined();
  });

  it('repairs only a chosen part of a dock group and leaves its other ships wounded', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
    await grant(f.db, world, 200_000, 60_000);
    await act('DOCK', home(4));
    const [lot] = await dockLotsOf(f.db, world);
    const result = await startRepair(f.db, world, { lots: [{ id: lot!.id, count: 2 }] }, f.clock, owner);
    const docked = await dockLotsOf(f.db, world);
    expect(docked.filter((row) => row.repairing).map((row) => row.count)).toEqual([2]);
    expect(docked.filter((row) => !row.repairing).map((row) => row.count)).toEqual([2]);
    const working = docked.find((row) => row.repairing)!;
    await expect(act('SCRAP', { source: 'DOCK', lots: [{ id: working.id, count: 1 }] }))
      .rejects.toMatchObject({ code: 'REPAIR_LOT_BUSY' });
    const [order] = await f.db.select().from(buildOrders).where(eq(buildOrders.id, result.orderId));
    f.clock.set(order!.readyAt);
    await f.db.transaction((tx) => applyBuildCompletion(tx, order!.id, order!.readyAt.toISOString(), f.clock));
    expect((await dockLotsOf(f.db, world)).map((row) => row.count)).toEqual([2]);
    expect((await readHomeHealth(f.db, world)).fleet.DART).toBe(5);
    expect((await readHomeHealth(f.db, world)).damage).toEqual([]);
  });

  it('does not charge twice when a partial repair request is retried', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
    await grant(f.db, world, 200_000, 60_000);
    await act('DOCK', home(4));
    const [lot] = await dockLotsOf(f.db, world);
    const request = { lots: [{ id: lot!.id, count: 2 }] };
    const key = randomUUID();
    const first = await startRepair(f.db, world, request, f.clock, owner, key);
    const retry = await startRepair(f.db, world, request, f.clock, owner, key);
    expect(retry.orderId).toBe(first.orderId);
    expect(await f.db.select().from(buildOrders).where(eq(buildOrders.kind, 'REPAIR'))).toHaveLength(1);
    expect((await dockLotsOf(f.db, world)).find((row) => !row.repairing)?.count).toBe(2);
  });

  it('rejects a partial repair quote if its selected health changed before payment', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
    await grant(f.db, world, 200_000, 60_000);
    await act('DOCK', home(2));
    const [lot] = await dockLotsOf(f.db, world);
    const { shipDamageLots } = await import('../src/db/schema.js');
    await f.db.update(shipDamageLots).set({ damageBp: 2000 }).where(eq(shipDamageLots.id, lot!.id));
    await expect(startRepair(f.db, world, { lots: [{ id: lot!.id, count: 1, damageBp: 100,
      remainderBp: 0.25 }] }, f.clock, owner, randomUUID())).rejects.toMatchObject({ code: 'SHIP_SELECTION_CHANGED' });
    expect(await f.db.select().from(buildOrders).where(eq(buildOrders.kind, 'REPAIR'))).toHaveLength(0);
    expect((await dockLotsOf(f.db, world))[0]?.count).toBe(2);
  });
});
