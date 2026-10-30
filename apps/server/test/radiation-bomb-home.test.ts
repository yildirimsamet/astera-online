import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HULLS } from '@astera/rules';
import { buildOrders, hpRadiationSources, planets, players, scheduledEvents, seasons, shipDamageLots, strategicAssets, units } from '../src/db/schema.js';
import { pino } from 'pino';
import { EventWorker } from '../src/worker/loop.js';
import { buildRadiationBomb, launchRadiationBomb, resolveRadiationBomb } from '../src/services/radiationBomb.js';
import { maintenanceAction } from '../src/services/maintenance.js';
import { startRepair } from '../src/services/repair.js';
import { applyBuildCompletion } from '../src/services/buildQueue.js';
import { readHomeHealth, writeHomeHealth } from '../src/services/homeHealth.js';
import { loadLocked } from '../src/services/planet.js';
import * as planetModule from '../src/services/planet.js';
import * as radiationHonorModule from '../src/services/honorRadiation.js';
import { buildPlanetView, loadPlanetViewsData, planetView } from '../src/services/planetView.js';
import { dockLotsOf, landHpShips } from '../src/services/shipDamage.js';
import { tellRadiationLoss } from '../src/services/radiation.js';
import { missions, notifications } from '../src/db/schema.js';
import { resolveTransfer } from '../src/services/movement.js';
import { giveInstrument, giveResearch, giveUnits, grant, placeAt, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let home: string;
beforeEach(async () => {
  f = await seedWorld(2);
  home = f.planetIds[1]!;
  await f.db.update(seasons).set({ radiationBombStartsAt: f.clock.now(), rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
  await f.db.update(players).set({ newcomerShieldUntil: null, recoveryShieldUntil: null });
  for (const id of f.planetIds) {
    await setLevel(f.db, id, 'CORE', 13);
    await setLevel(f.db, id, 'SHIPYARD', 5);
    await grant(f.db, id, 500000, 500000);
    await f.db.update(planets).set({ deuterium: 500000 }).where(eq(planets.id, id));
  }
  await placeAt(f.db, f.planetIds[0]!, { x: 1000 });
  await placeAt(f.db, home, { x: 0 });
});
afterAll(async () => { await (await testDb()).close(); });
afterEach(() => { vi.restoreAllMocks(); });
async function hit(level: 1 | 2 | 3 = 1) {
  const built = await buildRadiationBomb(f.db, f.planetIds[0]!, level, f.clock, f.playerIds[0]);
  await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, built.assetId));
  const sent = await launchRadiationBomb(f.db, { playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    target: { kind: 'PLANET', id: home }, level, key: randomUUID(), clock: f.clock });
  f.clock.set(new Date(sent.arriveAt));
  await resolveRadiationBomb(f.db, sent.flightId, f.clock);
  return sent;
}

it('projects parked ship damage on a read without persisting and settles it once on mutation, excluding mining craft and ground', async () => {
  await giveUnits(f.db, home, { CITADEL: 2, PROSPECTOR: 3, THORN: 4 });
  await hit();
  f.clock.advance(1);
  const [storedBefore] = await f.db.select().from(units).where(and(eq(units.planetId, home), eq(units.hull, 'CITADEL')));
  const view = buildPlanetView(await f.db.transaction(tx => loadPlanetViewsData(tx, [home], f.clock)
    .then(views => views[0]!), { accessMode: 'read only' }));
  expect(view.fleetDamage[0]!.damageBp + view.fleetDamage[0]!.remainderBp!).toBeCloseTo(9 / HULLS.CITADEL.hp * 10000);
  const [storedAfter] = await f.db.select().from(units).where(and(eq(units.planetId, home), eq(units.hull, 'CITADEL')));
  expect(storedAfter).toEqual(storedBefore);
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  const health = await readHomeHealth(f.db, home);
  expect(health.damage).toEqual(view.fleetDamage);
  expect(health.damage.every(lot => lot.hull === 'CITADEL')).toBe(true);
  expect(health.fleet).toEqual({ CITADEL: 2, PROSPECTOR: 3, THORN: 4 });
});

it('caps real staggered L1/L2/L3 hits together with environment, then removes each hit only at its own expiry', async () => {
  await giveResearch(f.db, home, 'RADIATION_SHIELDING', 4);
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'PLANET', anchorId: home,
    x: 0, y: 0, z: 0, radius: 1, intensityHpPerMinute: 12.5, mode: 'EMIT', activeFrom: f.clock.now() });
  const first = await hit(1);
  f.clock.advance(5);
  const second = await hit(2);
  f.clock.advance(5);
  const third = await hit(3);
  await giveUnits(f.db, home, { CITADEL: 1 });
  const ends = [first, second, third].map(sent => new Date(sent.arriveAt).getTime() + 1800000);
  let dose = (ends[0]! - new Date(third.arriveAt).getTime()) / 60000 * 50;
  const check = async (at: number, expected: number) => {
    f.clock.set(new Date(at));
    await f.db.transaction(tx => loadLocked(tx, home, f.clock));
    const [lot] = (await readHomeHealth(f.db, home)).damage;
    expect(lot!.damageBp + (lot!.remainderBp ?? 0)).toBeCloseTo(expected * .42 / HULLS.CITADEL.hp * 10000, 7);
  };
  await check(ends[0]! + 60000, dose + 43);
  dose += (ends[1]! - ends[0]!) / 60000 * 43;
  await check(ends[1]! + 60000, dose + 30.5);
  dose += (ends[2]! - ends[1]!) / 60000 * 30.5;
  await check(ends[2]! + 60000, dose + 12.5);
  expect((await f.db.select().from(hpRadiationSources)).filter(source => source.origin === 'BOMB')).toHaveLength(3);
});

it('cancels paid active and queued repairs, refunds their original invoices once and leaves docked ships exposed and returnable', async () => {
  await giveUnits(f.db, home, { CITADEL: 3 });
  await f.db.transaction(tx => writeHomeHealth(tx, home, { CITADEL: 3 }, [{ hull: 'CITADEL', count: 3, damageBp: 5000 }]));
  await maintenanceAction(f.db, f.playerIds[1]!, home, 'DOCK', { source: 'HOME', groups: [{ hull: 'CITADEL', count: 3, damageBp: 5000 }] }, randomUUID(), f.clock);
  const [lot] = await dockLotsOf(f.db, home);
  const first = await startRepair(f.db, home, { lots: [{ id: lot!.id, count: 1 }] }, f.clock, f.playerIds[1]);
  const [rest] = (await dockLotsOf(f.db, home)).filter(lot => !lot.repairing);
  const second = await startRepair(f.db, home, { lots: [{ id: rest!.id, count: 1 }] }, f.clock, f.playerIds[1]);
  const orders = await f.db.select().from(buildOrders).where(eq(buildOrders.planetId, home));
  const [before] = await f.db.select().from(planets).where(eq(planets.id, home));
  await hit();
  const [after] = await f.db.select().from(planets).where(eq(planets.id, home));
  expect(after!.alloy - before!.alloy).toBeCloseTo(orders.reduce((total, order) => total + order.cost.alloy, 0), 1);
  expect(after!.crystal - before!.crystal).toBeCloseTo(orders.reduce((total, order) => total + order.cost.crystal, 0), 1);
  for (const id of [first.orderId, second.orderId]) {
    expect((await f.db.select().from(buildOrders).where(eq(buildOrders.id, id)))[0]!.status).toBe('CANCELLED');
  }
  expect((await f.db.select().from(shipDamageLots)).every(lot => lot.repairOrderId === null)).toBe(true);
  f.clock.advance(1);
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  const exposed = await dockLotsOf(f.db, home);
  expect(exposed.reduce((total, lot) => total + lot.count, 0)).toBe(3);
  for (const lot of exposed) expect(lot.damageBp + (lot.remainderBp ?? 0)).toBeCloseTo(5000 + 9 / HULLS.CITADEL.hp * 10000);
  const returned = await maintenanceAction(f.db, f.playerIds[1]!, home, 'RETURN', { source: 'DOCK', lots: [{ id: exposed[0]!.id, count: 1 }] }, randomUUID(), f.clock);
  expect(returned.planet.fleet.CITADEL).toBe(1);
  for (const order of orders) expect(await f.db.transaction(tx => applyBuildCompletion(tx, order.id, order.readyAt.toISOString(), f.clock))).toBe(false);
});

it('keeps paid repair under one Aegis-blocked L1 hit, then cancels with a full invoice refund under two hits', async () => {
  await giveInstrument(f.db, home, 'AEGIS', 10);
  await f.db.update(planets).set({ shield: 500 }).where(eq(planets.id, home));
  await giveUnits(f.db, home, { CITADEL: 1 });
  await f.db.transaction(tx => writeHomeHealth(tx, home, { CITADEL: 1 }, [{ hull: 'CITADEL', count: 1, damageBp: 5000 }]));
  await maintenanceAction(f.db, f.playerIds[1]!, home, 'DOCK', { source: 'HOME',
    groups: [{ hull: 'CITADEL', count: 1, damageBp: 5000 }] }, randomUUID(), f.clock);
  const [lot] = await dockLotsOf(f.db, home);
  const repair = await startRepair(f.db, home, { lots: [{ id: lot!.id, count: 1 }] }, f.clock, f.playerIds[1]);
  const order = async () => (await f.db.select().from(buildOrders).where(eq(buildOrders.id, repair.orderId)))[0]!;
  const invoice = (await order()).cost;
  await hit();
  expect((await order()).status).toBe('BUILDING');
  expect((await dockLotsOf(f.db, home))[0]!.damageBp).toBe(5000);
  const before = await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  const arrived = await hit();
  const [after] = await f.db.select().from(planets).where(eq(planets.id, home));
  expect((await order()).status).toBe('CANCELLED');
  expect(after!.alloy - before.alloy).toBeCloseTo(invoice.alloy, 1);
  expect(after!.crystal - before.crystal).toBeCloseTo(invoice.crystal, 1);
  expect(await f.db.select().from(hpRadiationSources)).toHaveLength(2);
  f.clock.set(new Date(new Date(arrived.arriveAt).getTime() + 60000));
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  const [exposed] = await dockLotsOf(f.db, home);
  expect(exposed!.damageBp + (exposed!.remainderBp ?? 0)).toBeCloseTo(5000 + 8 / HULLS.CITADEL.hp * 10000);
});

it('keeps paid repair running while a shelter blocks a bomb, then cancels it at the shelter expiry', async () => {
  const shelterUntil = new Date(f.clock.now().getTime() + 120000);
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'PLANET', anchorId: home,
    x: 0, y: 0, z: 0, radius: 1, intensityHpPerMinute: 0, mode: 'SHELTER',
    activeFrom: f.clock.now(), activeUntil: shelterUntil });
  await giveUnits(f.db, home, { CITADEL: 1 });
  await f.db.transaction(tx => writeHomeHealth(tx, home, { CITADEL: 1 }, [{ hull: 'CITADEL', count: 1, damageBp: 5000 }]));
  await maintenanceAction(f.db, f.playerIds[1]!, home, 'DOCK', { source: 'HOME',
    groups: [{ hull: 'CITADEL', count: 1, damageBp: 5000 }] }, randomUUID(), f.clock);
  const [lot] = await dockLotsOf(f.db, home);
  const repair = await startRepair(f.db, home, { lots: [{ id: lot!.id, count: 1 }] }, f.clock, f.playerIds[1]);
  const sent = await hit();
  expect(new Date(sent.arriveAt).getTime()).toBeLessThan(shelterUntil.getTime());
  const order = () => f.db.select().from(buildOrders).where(eq(buildOrders.id, repair.orderId));
  expect((await order())[0]!.status).toBe('BUILDING');
  expect((await dockLotsOf(f.db, home))[0]!.repairing).toBe(true);
  const [notice] = await f.db.select().from(notifications).where(and(eq(notifications.refId, sent.flightId),
    eq(notifications.playerId, f.playerIds[1]!)));
  expect(notice!.payload.repairsCancelled).toBeUndefined();
  f.clock.set(shelterUntil);
  const worker = new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));
  await worker.tick();
  expect((await order())[0]!.status).toBe('CANCELLED');
  expect((await dockLotsOf(f.db, home))[0]!.damageBp).toBe(5000);
  f.clock.advance(1);
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  const [exposed] = await dockLotsOf(f.db, home);
  expect(exposed!.damageBp + (exposed!.remainderBp ?? 0)).toBeCloseTo(5000 + 9 / HULLS.CITADEL.hp * 10000);
});

it('removes dead home and dock ships without an invoice refund replay or regeneration after the radiation ends', async () => {
  await giveUnits(f.db, home, { DART: 2 });
  await f.db.transaction(tx => writeHomeHealth(tx, home, { DART: 2 }, [{ hull: 'DART', count: 1, damageBp: 9500 }]));
  await maintenanceAction(f.db, f.playerIds[1]!, home, 'DOCK', { source: 'HOME', groups: [{ hull: 'DART', count: 1, damageBp: 9500 }] }, randomUUID(), f.clock);
  await hit();
  f.clock.advance(61);
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  expect((await readHomeHealth(f.db, home)).fleet.DART ?? 0).toBe(0);
  expect(await dockLotsOf(f.db, home)).toHaveLength(0);
  const view = await f.db.transaction(tx => planetView(tx, home, f.clock));
  expect(view.workshopRadiation).toBe(false);
  expect(await f.db.select().from(hpRadiationSources)).toHaveLength(1);
});

it('settles an offline home casualty through the real boundary worker without a read or per-death report', async () => {
  await giveUnits(f.db, home, { DART: 1 });
  const sent = await hit();
  const events = await f.db.select().from(scheduledEvents).where(and(
    eq(scheduledEvents.refId, home), eq(scheduledEvents.kind, 'planet_radiation_boundary')));
  const next = events.toSorted((a, b) => a.resolveAt.getTime() - b.resolveAt.getTime())[0];
  expect(next).toBeDefined();
  expect(next!.resolveAt.getTime()).toBeLessThan(new Date(sent.arriveAt).getTime() + 3600000);
  f.clock.set(next!.resolveAt);
  const worker = new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));
  await worker.tick();
  expect((await readHomeHealth(f.db, home)).fleet.DART ?? 0).toBe(0);
});

it('does not advance home health past an unresolved impact when an earlier ship completion is processed late', async () => {
  await giveUnits(f.db, home, { CITADEL: 1 });
  const built = await buildRadiationBomb(f.db, f.planetIds[0]!, 1, f.clock, f.playerIds[0]);
  await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, built.assetId));
  const sent = await launchRadiationBomb(f.db, { playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    target: { kind: 'PLANET', id: home }, level: 1, key: randomUUID(), clock: f.clock });
  const readyAt = new Date(new Date(sent.arriveAt).getTime() - 1000);
  const [order] = await f.db.insert(buildOrders).values({ planetId: home, queue: 'YARD', slot: 0,
    kind: 'HULL', subject: 'CITADEL', count: 1, startedAt: f.clock.now(), readyAt,
    remainingSeconds: Math.ceil((readyAt.getTime() - f.clock.now().getTime()) / 1000),
    cost: { alloy: 1, crystal: 0, deuterium: 0 } }).returning();
  f.clock.set(new Date(new Date(sent.arriveAt).getTime() + 60000));
  await f.db.transaction(tx => applyBuildCompletion(tx, order!.id, readyAt.toISOString(), f.clock));
  await resolveRadiationBomb(f.db, sent.flightId, f.clock);
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  const health = await readHomeHealth(f.db, home);
  expect(health.fleet.CITADEL).toBe(2);
  expect(health.damage.reduce((total, lot) => total + lot.count, 0)).toBe(2);
  for (const lot of health.damage) expect(lot.damageBp + (lot.remainderBp ?? 0)).toBeCloseTo(9 / HULLS.CITADEL.hp * 10000);
});

it('refuses a mutable action past an overdue unresolved bomb, so it cannot consume the impact’s unpaid history', async () => {
  await giveUnits(f.db, home, { CITADEL: 1 });
  const built = await buildRadiationBomb(f.db, f.planetIds[0]!, 1, f.clock, f.playerIds[0]);
  await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, built.assetId));
  const sent = await launchRadiationBomb(f.db, { playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    target: { kind: 'PLANET', id: home }, level: 1, key: randomUUID(), clock: f.clock });
  f.clock.set(new Date(new Date(sent.arriveAt).getTime() + 60000));
  await expect(f.db.transaction(tx => loadLocked(tx, home, f.clock))).rejects.toMatchObject({ code: 'RADIATION_IMPACT_PENDING' });
  await resolveRadiationBomb(f.db, sent.flightId, f.clock);
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  const [lot] = (await readHomeHealth(f.db, home)).damage;
  expect(lot!.damageBp + (lot!.remainderBp ?? 0)).toBeCloseTo(9 / HULLS.CITADEL.hp * 10000);
});

it('settles the old home population before a late landing adds healthy ships, so arrivals inherit only later dose', async () => {
  await giveUnits(f.db, home, { CITADEL: 1 });
  const sent = await hit();
  const arrival = new Date(new Date(sent.arriveAt).getTime() + 60000);
  f.clock.set(new Date(arrival.getTime() + 60000));
  await f.db.transaction(tx => landHpShips(tx, { planetId: home, ownerPlayerId: f.playerIds[1]!,
    fleet: { CITADEL: 1 }, damage: [], at: arrival }));
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  const health = await readHomeHealth(f.db, home);
  expect(health.fleet.CITADEL).toBe(2);
  expect(health.damage).toHaveLength(2);
  expect(health.damage.map(lot => lot.damageBp + (lot.remainderBp ?? 0))).toEqual([
    expect.closeTo(18 / HULLS.CITADEL.hp * 10000), expect.closeTo(9 / HULLS.CITADEL.hp * 10000),
  ]);
});

it('charges a late landing’s own home interval even if another action already advanced the planet cursor', async () => {
  await giveUnits(f.db, home, { CITADEL: 1 });
  const sent = await hit();
  const arrival = new Date(new Date(sent.arriveAt).getTime() + 60000);
  f.clock.set(new Date(arrival.getTime() + 60000));
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  await f.db.transaction(tx => landHpShips(tx, { planetId: home, ownerPlayerId: f.playerIds[1]!,
    fleet: { CITADEL: 1 }, damage: [], at: arrival }));
  const health = await readHomeHealth(f.db, home);
  expect(health.damage).toHaveLength(2);
  expect(health.damage.map(lot => lot.damageBp + (lot.remainderBp ?? 0))).toEqual([
    expect.closeTo(18 / HULLS.CITADEL.hp * 10000), expect.closeTo(9 / HULLS.CITADEL.hp * 10000),
  ]);
});

it('charges a late ship completion from its actual birth even after the planet health cursor advanced', async () => {
  const sent = await hit();
  const readyAt = new Date(new Date(sent.arriveAt).getTime() + 60000);
  const [order] = await f.db.insert(buildOrders).values({ planetId: home, queue: 'YARD', slot: 0,
    kind: 'HULL', subject: 'CITADEL', count: 1, startedAt: new Date(sent.arriveAt), readyAt,
    remainingSeconds: 60, cost: { alloy: 1, crystal: 0, deuterium: 0 } }).returning();
  f.clock.set(new Date(readyAt.getTime() + 60000));
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  await f.db.transaction(tx => applyBuildCompletion(tx, order!.id, readyAt.toISOString(), f.clock));
  const health = await readHomeHealth(f.db, home);
  expect(health.fleet.CITADEL).toBe(1);
  expect(health.damage).toHaveLength(1);
  expect(health.damage[0]!.damageBp + (health.damage[0]!.remainderBp ?? 0)).toBeCloseTo(9 / HULLS.CITADEL.hp * 10000);
});

it.each(['THORN', 'BASTION', 'HARPOON', 'PROSPECTOR'] as const)(
  'delivers completed %s production unharmed after radiation settlement has advanced past its deadline', async hull => {
    const sent = await hit();
    const readyAt = new Date(new Date(sent.arriveAt).getTime() + 60000);
    const [order] = await f.db.insert(buildOrders).values({ planetId: home, queue: 'YARD', slot: 0,
      kind: 'HULL', subject: hull, count: 2, startedAt: new Date(sent.arriveAt), readyAt,
      remainingSeconds: 60, cost: { alloy: 1, crystal: 0, deuterium: 0 } }).returning();
    f.clock.set(new Date(readyAt.getTime() + 1000));
    await f.db.transaction(tx => loadLocked(tx, home, f.clock));

    await expect(f.db.transaction(tx => applyBuildCompletion(tx, order!.id, readyAt.toISOString(), f.clock)))
      .resolves.toBe(true);
    expect(await readHomeHealth(f.db, home)).toEqual({ fleet: { [hull]: 2 }, damage: [] });
    await expect(f.db.transaction(tx => applyBuildCompletion(tx, order!.id, readyAt.toISOString(), f.clock)))
      .resolves.toBe(false);
    f.clock.advance(1);
    await f.db.transaction(tx => loadLocked(tx, home, f.clock));
    expect(await readHomeHealth(f.db, home)).toEqual({ fleet: { [hull]: 2 }, damage: [] });
  });

it('does not generate per-cohort flight radiation death notifications in a bomb-enabled season', async () => {
  await f.db.transaction(tx => tellRadiationLoss(tx, { playerId: f.playerIds[1]!, refId: randomUUID(), toPlanetId: home },
    { fleet: {}, damage: [], destroyed: { DART: 1 }, doseBp: 0, doseHp: 100 }, f.clock.now()));
  expect(await f.db.select().from(notifications).where(eq(notifications.kind, 'radiation_lost'))).toHaveLength(0);
});

it('uses the transfer mission arrival as the birth of parked ships when its worker runs late', async () => {
  const sent = await hit();
  const arrived = new Date(new Date(sent.arriveAt).getTime() + 60000);
  const [mission] = await f.db.insert(missions).values({ seasonId: f.seasonId, kind: 'transfer',
    ownerPlayerId: f.playerIds[1]!, originPlanetId: f.planetIds[0]!, targetPlanetId: home,
    fleet: { CITADEL: 1 }, fuelPaid: 0, distance: 1000, departAt: new Date(sent.arriveAt), arriveAt: arrived,
    parentMissionId: randomUUID() }).returning();
  await f.db.insert(units).values({ planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[1]!,
    location: mission!.id, hull: 'CITADEL', count: 1 });
  f.clock.set(new Date(arrived.getTime() + 60000));
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  await f.db.transaction(tx => resolveTransfer(tx, mission!, f.clock.now(), 18));
  const health = await readHomeHealth(f.db, home);
  expect(health.fleet.CITADEL).toBe(1);
  expect(health.damage[0]!.damageBp + (health.damage[0]!.remainderBp ?? 0)).toBeCloseTo(9 / HULLS.CITADEL.hp * 10000);
});

it('also settles radiation deaths in a neutral NPC planet through the offline boundary worker', async () => {
  await giveUnits(f.db, home, { DART: 1 });
  await f.db.update(planets).set({ kind: 'NEUTRAL', controllerPlayerId: null }).where(eq(planets.id, home));
  await f.db.update(units).set({ ownerPlayerId: null }).where(eq(units.planetId, home));
  await hit();
  f.clock.advance(10);
  await new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' })).tick();
  expect((await readHomeHealth(f.db, home)).fleet.DART ?? 0).toBe(0);
});

it('keeps dock injuries authoritative in the dock lot, including read-only projection and partial evacuation', async () => {
  await giveUnits(f.db, home, { CITADEL: 3 });
  await f.db.transaction(tx => writeHomeHealth(tx, home, { CITADEL: 3 }, [{ hull: 'CITADEL', count: 3, damageBp: 5000 }]));
  await maintenanceAction(f.db, f.playerIds[1]!, home, 'DOCK', { source: 'HOME', groups: [{ hull: 'CITADEL', count: 3, damageBp: 5000 }] }, randomUUID(), f.clock);
  await hit(); f.clock.advance(1);
  const view = buildPlanetView(await f.db.transaction(tx => loadPlanetViewsData(tx, [home], f.clock).then(views => views[0]!), { accessMode: 'read only' }));
  expect(view.dock.lots[0]!.damageBp + (view.dock.lots[0]!.remainderBp ?? 0)).toBeCloseTo(5000 + 9 / HULLS.CITADEL.hp * 10000);
  expect((await f.db.select().from(shipDamageLots))[0]!.damageBp).toBe(5000);
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  const [waiting] = await dockLotsOf(f.db, home);
  expect((await f.db.select().from(units).where(eq(units.location, `dock:${waiting!.id}`)))[0]!.damage).toEqual([]);
  await maintenanceAction(f.db, f.playerIds[1]!, home, 'RETURN', { source: 'DOCK', lots: [{ id: waiting!.id, count: 1 }] }, randomUUID(), f.clock);
  f.clock.advance(1);
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  const [remaining] = await dockLotsOf(f.db, home);
  expect(remaining!.count).toBe(2);
  const expected = 5000 + 18 / HULLS.CITADEL.hp * 10000;
  expect(remaining!.damageBp + (remaining!.remainderBp ?? 0)).toBeCloseTo(expected);
  const health = await readHomeHealth(f.db, home);
  expect(health.fleet.CITADEL).toBe(1);
  expect(health.damage[0]!.damageBp + (health.damage[0]!.remainderBp ?? 0)).toBeCloseTo(expected);
  expect((await f.db.select().from(units).where(eq(units.location, `dock:${waiting!.id}`)))[0]!.damage).toEqual([]);
});

it('avoids wealth/Honor inventory recalculation for wounds alone, but recalculates once when physical ships die', async () => {
  await giveUnits(f.db, home, { DART: 1, CITADEL: 1 });
  await hit();
  const recalculate = vi.spyOn(planetModule, 'recomputePlayerWealth');
  f.clock.advance(1);
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  expect((await readHomeHealth(f.db, home)).damage.length).toBeGreaterThan(0);
  expect(recalculate.mock.calls.length).toBe(0);
  f.clock.advance(10);
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  expect((await readHomeHealth(f.db, home)).fleet.DART ?? 0).toBe(0);
  expect(recalculate.mock.calls.length).toBe(1);
});

it('checks Honor once per owner for a mixed hangar and several injured workshop groups', async () => {
  const damage = [5000, 6000, 7000].map(damageBp => ({ hull: 'CITADEL' as const, count: 1, damageBp }));
  await giveUnits(f.db, home, { CITADEL: 3 });
  await f.db.transaction(tx => writeHomeHealth(tx, home, { CITADEL: 3 }, damage));
  await maintenanceAction(f.db, f.playerIds[1]!, home, 'DOCK', { source: 'HOME', groups: damage }, randomUUID(), f.clock);
  await giveUnits(f.db, home, { CITADEL: 1 });
  await hit();
  const record = vi.spyOn(radiationHonorModule, 'recordRadiationHonor');
  f.clock.advance(1);
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  expect(record.mock.calls.length).toBe(1);
  expect(record.mock.calls[0]![1]).toMatchObject({ victim: f.playerIds[1], fleet: { CITADEL: 4 } });
  expect((await dockLotsOf(f.db, home)).map(lot => lot.damageBp)).toEqual(expect.arrayContaining(
    damage.map(lot => Math.floor(lot.damageBp + 9 / HULLS.CITADEL.hp * 10000))));
});
