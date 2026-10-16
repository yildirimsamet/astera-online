import { afterAll, beforeEach, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { monuments, monumentShipLots, monumentWaves, notifications, planets, scheduledEvents, seasons, units } from '../src/db/schema.js';
import { sendMonument } from '../src/services/monument.js';
import { advanceMonument } from '../src/services/monumentArrival.js';
import { recallMonumentFleets } from '../src/services/monumentRecall.js';
import { activateMonumentMotion } from '../src/services/monumentMotionAdoption.js';
import { launchMonumentProbe } from '../src/services/monumentProbe.js';
import { loadLocked } from '../src/services/planet.js';
import { giveUnits, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * Owner-authorized maintenance recall in a LIVE season (2026-10-16): every monument fleet lands
 * at home with its ships, health, carried Deuterium and unspent return reserve; the season stays
 * open; vacated monuments follow the ordinary empty → 24 h garrison rule.
 */
let f: Fixture;
let target: typeof monuments.$inferSelect;
beforeEach(async () => {
  f = await seedWorld(2, 20261016);
  await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
  for (const planetId of f.planetIds.slice(0, 2)) {
    await setLevel(f.db, planetId, 'CORE', 8);
    await setLevel(f.db, planetId, 'HANGAR', 10);
    await grant(f.db, planetId, 100_000, 100_000);
  }
  await giveUnits(f.db, f.planetIds[0]!, { RAMPART: 2, COURIER: 2 });
  const [home] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  const [row] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: home!.x + 300, y: home!.y, z: home!.z,
    capacity: 100_000, garrison: {}, productionPerMinute: 2, settledAt: f.clock.now() }).returning();
  target = row!;
});
afterAll(async () => { await (await testDb()).close(); });

const send = (fleet = { RAMPART: 2, COURIER: 2 }) => f.db.transaction(tx => sendMonument(tx, {
  senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, monumentId: target.id,
  fleet, purpose: 'ATTACK', acknowledgeShieldLoss: true, clock: f.clock }));
async function held() {
  const sent = await send();
  f.clock.set(new Date(sent.wave.arriveAt!.getTime() + 1));
  await f.db.transaction(tx => advanceMonument(tx, { monumentId: target.id, at: f.clock.now() }));
  f.clock.advance(90);
  return sent;
}
const recall = (apply: boolean) => recallMonumentFleets(f.db, { seasonId: f.seasonId, clock: f.clock, apply, adminUsernames: [] });
const homeUnits = async () => (await f.db.select().from(units).where(eq(units.planetId, f.planetIds[0]!)))
  .filter(row => row.location === 'home').reduce<Record<string, number>>((all, row) => ({ ...all, [row.hull]: (all[row.hull] ?? 0) + row.count }), {});

it('previews without writing anything', async () => {
  const sent = await held();
  const result = await recall(false);
  expect(result).toMatchObject({ status: 'READY', applied: false, fleets: 1, probes: 0, operations: 0 });
  const [wave] = await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, sent.wave.id));
  expect(wave!.status).toBe('HOLD');
  const [m] = await f.db.select().from(monuments).where(eq(monuments.id, target.id));
  expect(m!.controllerPlayerId).toBe(f.playerIds[0]);
});

it('lands a held fleet at home with its ships, earned Deuterium and return reserve, and keeps the season open', async () => {
  const sent = await held();
  const before = await f.db.transaction(tx => loadLocked(tx, f.planetIds[0]!, f.clock));
  // Settle the hold to the same instant so the expected cargo includes everything earned so far.
  await f.db.transaction(tx => advanceMonument(tx, { monumentId: target.id, at: f.clock.now() }));
  const lots = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, sent.wave.id));
  const cargo = lots.reduce((sum, lot) => sum + lot.deuterium, 0);
  const reserve = lots.reduce((sum, lot) => sum + lot.returnFuelReserve + lot.fuelRefund, 0);
  expect(cargo).toBeGreaterThan(0);

  const result = await recall(true);
  expect(result).toMatchObject({ status: 'READY', applied: true, fleets: 1 });

  const [wave] = await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, sent.wave.id));
  expect(wave!.status).toBe('HOME');
  expect(await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, sent.wave.id))).toHaveLength(0);
  expect(await homeUnits()).toMatchObject({ RAMPART: 2, COURIER: 2 });
  const [home] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  expect(home!.deuterium - before.deuterium).toBeCloseTo(cargo + reserve, 6);
  const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  expect(season!.status).toBe('live');
  expect(season!.closedAt).toBeNull();
  const receipt = (await f.db.select().from(notifications)).find(row => row.kind === 'fleet_returned');
  expect(receipt?.payload).toMatchObject({ trip: 'monument', craft: 4, fuelRefund: reserve });
});

it('keeps battle damage on the landed ships', async () => {
  const sent = await held();
  await f.db.update(monumentShipLots).set({ damageBp: 4000 })
    .where(and(eq(monumentShipLots.waveId, sent.wave.id), eq(monumentShipLots.hull, 'RAMPART')));
  await recall(true);
  const rampart = (await f.db.select().from(units).where(eq(units.planetId, f.planetIds[0]!)))
    .filter(row => row.hull === 'RAMPART' && row.location === 'home');
  expect(rampart.reduce((n, row) => n + row.count, 0)).toBe(2);
  expect(JSON.stringify(rampart.map(row => row.damage))).toContain('4000');
});

it('vacates the monument without deleting its lifecycle and schedules the ordinary 24 h garrison return', async () => {
  await held();
  const [beforeRow] = await f.db.select().from(monuments).where(eq(monuments.id, target.id));
  await recall(true);
  const [m] = await f.db.select().from(monuments).where(eq(monuments.id, target.id));
  expect(m!.controllerPlayerId).toBeNull();
  expect(m!.controllerClanId).toBeNull();
  expect(m!.generation).toBeGreaterThan(beforeRow!.generation);
  expect(m!.emptySince?.getTime()).toBe(f.clock.now().getTime());
  const respawn = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.kind, 'monument_respawn'), eq(scheduledEvents.refId, target.id)));
  expect(respawn.map(row => row.resolveAt.getTime())).toContain(f.clock.now().getTime() + 86_400_000);
  expect(respawn.find(row => row.resolveAt.getTime() === f.clock.now().getTime() + 86_400_000)?.payload).toMatchObject({ generation: m!.generation });
});

it('also brings an outbound fleet home directly with its whole return reserve', async () => {
  const sent = await send();
  f.clock.advance(1);
  const lots = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, sent.wave.id));
  const reserve = lots.reduce((sum, lot) => sum + lot.returnFuelReserve + lot.fuelRefund, 0);
  const before = await f.db.transaction(tx => loadLocked(tx, f.planetIds[0]!, f.clock));
  await recall(true);
  const [wave] = await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, sent.wave.id));
  expect(wave!.status).toBe('HOME');
  expect(await homeUnits()).toMatchObject({ RAMPART: 2, COURIER: 2 });
  const [home] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  expect(home!.deuterium - before.deuterium).toBeCloseTo(reserve, 6);
});

it('unblocks the idle monument motion cutover', async () => {
  await held();
  expect((await activateMonumentMotion(f.db, { seasonId: f.seasonId, clock: f.clock, apply: false, adminUsernames: [] })).status).toBe('BUSY');
  await recall(true);
  expect((await activateMonumentMotion(f.db, { seasonId: f.seasonId, clock: f.clock, apply: false, adminUsernames: [] })).status).toBe('READY');
});

it('is a no-op when run again', async () => {
  await held();
  await recall(true);
  const [m1] = await f.db.select().from(monuments).where(eq(monuments.id, target.id));
  const notes = (await f.db.select().from(notifications)).length;
  const again = await recall(true);
  expect(again).toMatchObject({ status: 'IDLE', applied: false, fleets: 0 });
  const [m2] = await f.db.select().from(monuments).where(eq(monuments.id, target.id));
  expect(m2!.generation).toBe(m1!.generation);
  expect((await f.db.select().from(notifications)).length).toBe(notes);
});

it('refuses without writing while a monument probe is travelling', async () => {
  const sent = await held();
  await f.db.transaction(tx => launchMonumentProbe(tx, { playerId: f.playerIds[1]!, originPlanetId: f.planetIds[1]!, monumentId: target.id, clock: f.clock }));
  const result = await recall(true);
  expect(result).toMatchObject({ status: 'BUSY', applied: false, probes: 1 });
  const [wave] = await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, sent.wave.id));
  expect(wave!.status).toBe('HOLD');
});

it('refuses a closed season', async () => {
  await held();
  await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
  await expect(recall(true)).rejects.toMatchObject({ code: 'SEASON_FROZEN' });
});
