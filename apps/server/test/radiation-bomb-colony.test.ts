import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { FAULT, FAULT_KINDS, HULLS, RADIATION_BOMB, type RadiationBombLevel } from '@astera/rules';
import { buildOrders, hpRadiationSources, notifications, planetFaults, planets, players, radiationBombFlights,
  scheduledEvents, seasons, strategicAssets } from '../src/db/schema.js';
import { launchRadiationBomb, resolveRadiationBomb } from '../src/services/radiationBomb.js';
import { onColonySecession } from '../src/services/loyalty.js';
import { readHomeHealth, writeHomeHealth } from '../src/services/homeHealth.js';
import { maintenanceAction } from '../src/services/maintenance.js';
import { startRepair } from '../src/services/repair.js';
import { dockLotsOf } from '../src/services/shipDamage.js';
import { loadLocked } from '../src/services/planet.js';
import { readBattleReports } from '../src/services/reports.js';
import { giveInstrument, giveSatellite, giveUnits, grant, placeAt, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let origin: string;
let colony: string;
let capital: string;
beforeEach(async () => {
  f = await seedWorld(3);
  origin = f.planetIds[0]!; capital = f.planetIds[1]!; colony = f.planetIds[2]!;
  await f.db.update(seasons).set({ radiationBombStartsAt: f.clock.now(), rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
  await f.db.update(players).set({ newcomerShieldUntil: null, recoveryShieldUntil: null });
  for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 13);
  await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[1]!, statsOwnerPlayerId: f.playerIds[1]! })
    .where(eq(planets.id, colony));
  await placeAt(f.db, origin, { x: 5000 });
  await placeAt(f.db, colony, { x: 0 });
  f.clock.advance(250);
});
afterAll(async () => { await (await testDb()).close(); });
const world = async () => (await f.db.select().from(planets).where(eq(planets.id, colony)))[0]!;
const faults = () => f.db.select().from(planetFaults).where(eq(planetFaults.planetId, colony));
const setLoyalty = (loyalty: number) => f.db.update(planets).set({ loyalty, lastTickAt: f.clock.now() }).where(eq(planets.id, colony));
async function launch(level: RadiationBombLevel, target = colony) {
  await f.db.insert(strategicAssets).values({ planetId: origin, type: RADIATION_BOMB.levels[level].type,
    status: 'READY', startedAt: f.clock.now(), remainingSeconds: 0 });
  return launchRadiationBomb(f.db, { playerId: f.playerIds[0]!, originPlanetId: origin,
    target: { kind: 'PLANET', id: target }, level, key: randomUUID(), clock: f.clock });
}
async function hit(level: RadiationBombLevel, loyalty = 80) {
  const shot = await launch(level);
  f.clock.set(new Date(shot.arriveAt));
  await setLoyalty(loyalty);
  await resolveRadiationBomb(f.db, shot.flightId, f.clock);
  return shot;
}

it.each([[1, 5, 0], [2, 10, 1], [3, 15, 2]] as const)('L%s takes %s loyalty and draws %s distinct faults exactly once', async (level, loss, count) => {
  const shot = await hit(level);
  await resolveRadiationBomb(f.db, shot.flightId, f.clock);
  expect((await world()).loyalty).toBeCloseTo(80 - loss, 6);
  const broken = await faults();
  expect(broken).toHaveLength(count);
  expect(new Set(broken.map(row => row.kind)).size).toBe(count);
  expect(await f.db.select().from(hpRadiationSources)).toHaveLength(1);
  const notices = await f.db.select().from(notifications).where(and(eq(notifications.kind, 'radiation_bomb_result'), eq(notifications.refId, shot.flightId)));
  expect(notices).toHaveLength(2);
  for (const notice of notices) expect(notice.payload).toMatchObject({ loyalty: { before: 80, after: 80 - loss } });
  const defender = notices.find(row => row.playerId === f.playerIds[1])!;
  expect(defender.payload).toMatchObject({ faults: broken.map(row => row.kind) });
  expect(notices.find(row => row.playerId === f.playerIds[0])!.payload).not.toHaveProperty('faults');
  expect(await f.db.select().from(notifications).where(eq(notifications.kind, 'colony_fault'))).toHaveLength(0);
});

it.each([15, 7])('clamps loyalty %s to zero and uses the existing secession without drawing outgoing faults', async loyalty => {
  await hit(3, loyalty);
  expect((await world()).loyalty).toBe(0);
  expect(await faults()).toHaveLength(0);
  const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.kind, 'colony_secession'), eq(scheduledEvents.refId, colony), eq(scheduledEvents.status, 'pending')));
  expect(event).toBeTruthy();
  await onColonySecession({ db: f.db, clock: f.clock }, event!);
  expect(await world()).toMatchObject({ kind: 'NEUTRAL', controllerPlayerId: null });
  expect(await f.db.select().from(hpRadiationSources)).toHaveLength(1);
});

it('subtracts simultaneous hits under the target lock, rather than losing an increment', async () => {
  const first = await launch(1); const second = await launch(2);
  expect(first.arriveAt).toBe(second.arriveAt);
  f.clock.set(new Date(first.arriveAt)); await setLoyalty(80);
  await Promise.all([resolveRadiationBomb(f.db, first.flightId, f.clock), resolveRadiationBomb(f.db, second.flightId, f.clock)]);
  expect((await world()).loyalty).toBe(65);
  expect(await faults()).toHaveLength(1);
});

it('settles gradual loyalty loss before applying the payload', async () => {
  const shot = await launch(1);
  for (const kind of FAULT_KINDS) await f.db.insert(planetFaults).values({ planetId: colony, kind, startedAt: f.clock.now() });
  await setLoyalty(80);
  f.clock.set(new Date(shot.arriveAt));
  await resolveRadiationBomb(f.db, shot.flightId, f.clock);
  expect((await world()).loyalty).toBeLessThan(75);
});

it('does not rewind an observed economic tick when a hit is processed late', async () => {
  const shot = await launch(3);
  f.clock.set(new Date(new Date(shot.arriveAt).getTime() + 60000)); await setLoyalty(80);
  await resolveRadiationBomb(f.db, shot.flightId, f.clock);
  expect((await world()).lastTickAt).toEqual(f.clock.now());
  expect((await world()).loyalty).toBe(65);
});

it('does not skip late radiation damage when the new fault turns Aegis off', async () => {
  await giveInstrument(f.db, colony, 'AEGIS', 10);
  await f.db.update(planets).set({ shield: 500 }).where(eq(planets.id, colony));
  await giveUnits(f.db, colony, { CITADEL: 1 });
  for (const kind of FAULT_KINDS.filter(kind => kind !== 'CORE_OUTAGE')) {
    await f.db.insert(planetFaults).values({ planetId: colony, kind, startedAt: f.clock.now() });
  }
  await f.db.transaction(tx => loadLocked(tx, colony, f.clock));
  const shot = await launch(3);
  f.clock.set(new Date(new Date(shot.arriveAt).getTime() + 60000)); await setLoyalty(80);
  await resolveRadiationBomb(f.db, shot.flightId, f.clock);
  const [lot] = (await readHomeHealth(f.db, colony)).damage;
  expect(lot).toBeTruthy();
  expect(lot!.damageBp + (lot!.remainderBp ?? 0)).toBeCloseTo(8 / HULLS.CITADEL.hp * 10000, 5);
});

it.each(['young', 'protected', 'full'] as const)('still takes loyalty when the fault pool is %s', async reason => {
  if (reason === 'young') await setLevel(f.db, colony, 'CORE', FAULT.minCoreLevel - 1);
  if (reason === 'protected') await f.db.update(planets).set({ faultProtectedUntil: new Date(f.clock.now().getTime() + 86400000) }).where(eq(planets.id, colony));
  if (reason === 'full') for (const kind of FAULT_KINDS) await f.db.insert(planetFaults).values({ planetId: colony, kind, startedAt: f.clock.now() });
  await hit(3);
  expect((await world()).loyalty).toBe(65);
  expect(await faults()).toHaveLength(reason === 'full' ? FAULT_KINDS.length : 0);
});

it('draws only the remaining eligible fault when L3 cannot break two', async () => {
  await setLevel(f.db, colony, 'DEUTERIUM_PLANT', 1);
  for (const kind of FAULT_KINDS.slice(1)) await f.db.insert(planetFaults).values({ planetId: colony, kind, startedAt: f.clock.now() });
  await hit(3);
  expect(await faults()).toHaveLength(FAULT_KINDS.length);
});

it('applies the colony payload even when Aegis absorbs the whole radiation rate', async () => {
  await giveInstrument(f.db, colony, 'AEGIS', 10);
  await f.db.update(planets).set({ shield: 500 }).where(eq(planets.id, colony));
  await hit(1);
  expect((await world()).loyalty).toBe(75);
});

it('does not apply colony effects to a capital', async () => {
  const shot = await launch(3, capital);
  f.clock.set(new Date(shot.arriveAt));
  await resolveRadiationBomb(f.db, shot.flightId, f.clock);
  const [target] = await f.db.select().from(planets).where(eq(planets.id, capital));
  expect(target!.loyalty).toBe(100);
  expect(await f.db.select().from(planetFaults).where(eq(planetFaults.planetId, capital))).toHaveLength(0);
});

it('does not apply colony effects to a neutral planet', async () => {
  await f.db.update(planets).set({ kind: 'NEUTRAL', controllerPlayerId: null }).where(eq(planets.id, colony));
  await hit(3);
  expect((await world()).loyalty).toBe(80);
  expect(await faults()).toHaveLength(0);
});

it('charges the current colony owner if control changes during flight', async () => {
  const shot = await launch(2);
  await f.db.update(planets).set({ controllerPlayerId: f.playerIds[2]!, statsOwnerPlayerId: f.playerIds[2]! }).where(eq(planets.id, colony));
  f.clock.set(new Date(shot.arriveAt)); await setLoyalty(80);
  await resolveRadiationBomb(f.db, shot.flightId, f.clock);
  expect((await world()).loyalty).toBe(70);
  const notices = await f.db.select().from(notifications).where(eq(notifications.refId, shot.flightId));
  expect(notices.map(row => row.playerId).sort()).toEqual([f.playerIds[0]!, f.playerIds[2]!].sort());
});

it.each(['protected', 'intercepted'] as const)('takes no loyalty and breaks nothing when %s at impact', async reason => {
  const shot = await launch(3);
  if (reason === 'protected') await f.db.update(planets).set({ protectedUntil: new Date(new Date(shot.arriveAt).getTime() + 60000) }).where(eq(planets.id, colony));
  else {
    await giveSatellite(f.db, colony, 'UPLINK'); await giveInstrument(f.db, colony, 'RADAR', 3);
    await f.db.insert(strategicAssets).values({ planetId: colony, type: 'INTERCEPTOR', status: 'READY', startedAt: f.clock.now() });
  }
  f.clock.set(new Date(shot.arriveAt)); await setLoyalty(80);
  await resolveRadiationBomb(f.db, shot.flightId, f.clock);
  expect((await world()).loyalty).toBe(80);
  expect(await faults()).toHaveLength(0);
  expect(await f.db.select().from(hpRadiationSources)).toHaveLength(0);
  expect((await f.db.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, shot.flightId)))[0]!.status)
    .toBe(reason === 'protected' ? 'INEFFECTIVE' : 'INTERCEPTED');
});

it('retains actual loyalty in both reports and exposes new fault names only to the defender', async () => {
  const shot = await hit(3);
  for (const playerId of [f.playerIds[0]!, f.playerIds[1]!]) {
    const { reports } = await readBattleReports(f.db, playerId);
    const report = reports.find(row => row.kind === 'STRATEGIC' && row.id === shot.flightId);
    if (report?.kind !== 'STRATEGIC') throw new Error('Missing bomb report');
    expect(report.loyalty).toEqual({ before: 80, after: 65 });
    if (playerId === f.playerIds[1]) expect(report.radiation).toHaveProperty('faults', expect.arrayContaining((await faults()).map(row => row.kind)));
    else expect(report.radiation).not.toHaveProperty('faults');
  }
});

it.each([1, 2, 3] as const)('does not revive a colony reduced to zero by L%s before a late secession handler', async level => {
  await hit(level, RADIATION_BOMB.levels[level].colonyLoyaltyLoss);
  const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.kind, 'colony_secession'),
    eq(scheduledEvents.refId, colony), eq(scheduledEvents.status, 'pending')));
  expect(event).toBeTruthy();
  f.clock.advance(1);
  const state = await f.db.transaction(tx => loadLocked(tx, colony, f.clock));
  expect(state.loyalty).toBe(0);
  await onColonySecession({ db: f.db, clock: f.clock }, event!);
  expect(await world()).toMatchObject({ kind: 'NEUTRAL', controllerPlayerId: null });
});

it('includes the full repair refund in the hit receipt when its new Core fault cancels the job', async () => {
  for (const id of [origin, capital, colony]) await grant(f.db, id, 500000, 500000);
  await placeAt(f.db, origin, { x: 100 });
  await giveInstrument(f.db, colony, 'AEGIS', 18);
  await f.db.update(planets).set({ shield: 500 }).where(eq(planets.id, colony));
  await giveUnits(f.db, colony, { CITADEL: 1 });
  await f.db.transaction(tx => writeHomeHealth(tx, colony, { CITADEL: 1 }, [{ hull: 'CITADEL', count: 1, damageBp: 5000 }]));
  await maintenanceAction(f.db, f.playerIds[1]!, colony, 'DOCK', { source: 'HOME', groups: [{ hull: 'CITADEL', count: 1, damageBp: 5000 }] }, randomUUID(), f.clock);
  const [lot] = await dockLotsOf(f.db, colony);
  const repair = await startRepair(f.db, colony, { lots: [{ id: lot!.id, count: 1 }] }, f.clock, f.playerIds[1]);
  const [order] = await f.db.select().from(buildOrders).where(eq(buildOrders.id, repair.orderId));
  for (const kind of FAULT_KINDS.filter(kind => kind !== 'CORE_OUTAGE')) {
    await f.db.insert(planetFaults).values({ planetId: colony, kind, startedAt: f.clock.now() });
  }
  const shot = await hit(2);
  expect(new Date(shot.arriveAt).getTime()).toBeLessThan(order!.readyAt.getTime());
  expect((await f.db.select().from(buildOrders).where(eq(buildOrders.id, repair.orderId)))[0]!.status).toBe('CANCELLED');
  const [notice] = await f.db.select().from(notifications).where(and(eq(notifications.kind, 'radiation_bomb_result'),
    eq(notifications.refId, shot.flightId), eq(notifications.playerId, f.playerIds[1]!)));
  expect(notice!.payload).toMatchObject({ repairsCancelled: 1, refund: order!.cost });
});
